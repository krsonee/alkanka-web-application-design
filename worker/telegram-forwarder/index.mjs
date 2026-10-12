import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import dotenv from "dotenv";
import pg from "pg";
import { TelegramClient, Api } from "teleproto";
// Node'un katı ESM çözümleyicisi (Next.js'in derleyicisinin aksine) dizin
// içe aktarımlarına izin vermez; bu yüzden alt yollar tam dosya adıyla verilir.
import { StringSession } from "teleproto/sessions/index.js";
import { NewMessage } from "teleproto/events/index.js";
import { _parseMessageText } from "teleproto/client/messageParse.js";
import { decryptSecret } from "./crypto.mjs";
import { stopBot, tickBot } from "./bot.mjs";
import {
  footerButtonsToInlineKeyboard,
  normalizeFooterButtonLayout,
  normalizeFooterButtons,
} from "./footer-buttons.mjs";
import { harvestGramjsPremium, parseMessageEntities } from "./premium.mjs";
import { extractCodeAndLink } from "./extract.mjs";
// Özel oran listesi için kanca ./odds-hook.mjs içindedir (insertOddsCard).
// Bu sürüm onu çağırmaz; canlı oturum gerekmez. Panel kartları elle girer.

// Yerel geliştirmede .env.local'den okunur; üretimde systemd
// EnvironmentFile zaten process.env'i doldurur, dosya yoksa sessizce geçilir.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
dotenv.config({ path: join(root, ".env.local"), quiet: true });

const POLL_INTERVAL_MS = 8_000;
const SEPARATOR = "\n\n";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

let client = null;
let currentSessionSignature = "";
let activeHandlers = []; // { handler, builder, sourceChannel }
let currentSourceKey = "";
let hasLoggedWaiting = false;
let botToken = "";

function log(message) {
  console.log(`[telegram-forwarder] ${message}`);
}

function logError(message, err) {
  console.error(`[telegram-forwarder] ${message}:`, err?.errorMessage || err?.message || err);
}

async function loadConfig() {
  const { rows } = await pool.query(
    "select * from telegram_config order by id desc limit 1",
  );
  return rows[0] ?? null;
}

async function loadActiveRules() {
  const { rows } = await pool.query(
    `select id, source_channel, target_channel, footer_text, footer_buttons, footer_entities, footer_button_layout
     from telegram_forward_rules
     where active = true
     order by sort_order asc, id asc`,
  );
  return rows;
}

function botEntitiesToGramjs(entities, shift = 0) {
  const out = [];
  for (const entity of parseMessageEntities(entities)) {
    const offset = entity.offset + shift;
    const length = entity.length;
    if (entity.type === "custom_emoji" && entity.custom_emoji_id) {
      out.push(
        new Api.MessageEntityCustomEmoji({
          offset,
          length,
          documentId: entity.custom_emoji_id,
        }),
      );
    } else if (entity.type === "bold") {
      out.push(new Api.MessageEntityBold({ offset, length }));
    } else if (entity.type === "italic") {
      out.push(new Api.MessageEntityItalic({ offset, length }));
    } else if (entity.type === "underline") {
      out.push(new Api.MessageEntityUnderline({ offset, length }));
    } else if (entity.type === "strikethrough") {
      out.push(new Api.MessageEntityStrike({ offset, length }));
    } else if (entity.type === "spoiler") {
      out.push(new Api.MessageEntitySpoiler({ offset, length }));
    } else if (entity.type === "code") {
      out.push(new Api.MessageEntityCode({ offset, length }));
    } else if (entity.type === "pre") {
      out.push(new Api.MessageEntityPre({ offset, length, language: entity.language || "" }));
    } else if (entity.type === "text_link" && entity.url) {
      out.push(new Api.MessageEntityTextUrl({ offset, length, url: entity.url }));
    } else if (entity.type === "url") {
      out.push(new Api.MessageEntityUrl({ offset, length }));
    } else if (entity.type === "mention") {
      out.push(new Api.MessageEntityMention({ offset, length }));
    } else if (entity.type === "blockquote" || entity.type === "expandable_blockquote") {
      out.push(
        new Api.MessageEntityBlockquote({
          offset,
          length,
          collapsed: entity.type === "expandable_blockquote",
        }),
      );
    }
  }
  return out;
}

function toBotApiEntities(entities) {
  if (!entities?.length) return undefined;
  const out = [];
  for (const entity of entities) {
    const kind = entity.className || entity.constructor?.name || "";
    const base = { offset: entity.offset, length: entity.length };
    if (kind === "MessageEntityBold") out.push({ ...base, type: "bold" });
    else if (kind === "MessageEntityItalic") out.push({ ...base, type: "italic" });
    else if (kind === "MessageEntityCode") out.push({ ...base, type: "code" });
    else if (kind === "MessageEntityPre") {
      out.push({ ...base, type: "pre", language: entity.language || undefined });
    } else if (kind === "MessageEntityUnderline") out.push({ ...base, type: "underline" });
    else if (kind === "MessageEntityStrike") out.push({ ...base, type: "strikethrough" });
    else if (kind === "MessageEntitySpoiler") out.push({ ...base, type: "spoiler" });
    else if (kind === "MessageEntityTextUrl") out.push({ ...base, type: "text_link", url: entity.url });
    else if (kind === "MessageEntityUrl") out.push({ ...base, type: "url" });
    else if (kind === "MessageEntityMention") out.push({ ...base, type: "mention" });
    else if (kind === "MessageEntityHashtag") out.push({ ...base, type: "hashtag" });
    else if (kind === "MessageEntityCashtag") out.push({ ...base, type: "cashtag" });
    else if (kind === "MessageEntityBotCommand") out.push({ ...base, type: "bot_command" });
    else if (kind === "MessageEntityPhone") out.push({ ...base, type: "phone_number" });
    else if (kind === "MessageEntityEmail") out.push({ ...base, type: "email" });
    else if (kind === "MessageEntityBlockquote") out.push({ ...base, type: "blockquote" });
    else if (kind === "MessageEntityCustomEmoji") {
      out.push({
        ...base,
        type: "custom_emoji",
        custom_emoji_id: String(entity.documentId ?? ""),
      });
    }
  }
  return out.length ? out : undefined;
}

async function sendViaBot(targetChannel, text, entities, buttons, layout) {
  if (!botToken) {
    throw new Error("Renkli buton için yönetim botu kaydedilmeli ve hedef kanalda yönetici olmalı");
  }
  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: targetChannel,
      text,
      entities: toBotApiEntities(entities),
      link_preview_options: { is_disabled: true },
      reply_markup: footerButtonsToInlineKeyboard(buttons, layout),
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!data.ok) {
    throw new Error(data.description || "bot sendMessage başarısız");
  }
}

function keyboardStyle(kind) {
  if (kind === "danger") return new Api.KeyboardButtonStyle({ bgDanger: true });
  if (kind === "success") return new Api.KeyboardButtonStyle({ bgSuccess: true });
  return new Api.KeyboardButtonStyle({ bgPrimary: true });
}

function toUserbotButtons(buttons, layout = "stack") {
  const perRow = layout === "row" ? 2 : 1;
  const rows = [];
  for (let i = 0; i < buttons.length; i += perRow) {
    rows.push(
      buttons.slice(i, i + perRow).map(
        (button) =>
          new Api.KeyboardButtonUrl({
            text: button.text,
            url: button.url,
            style: keyboardStyle(button.style),
          }),
      ),
    );
  }
  return rows;
}

async function writeLog({ ruleId, sourceChannel, targetChannel, status, detail, preview }) {
  try {
    await pool.query(
      `insert into telegram_forward_log
         (rule_id, source_channel, target_channel, status, detail, preview)
       values ($1, $2, $3, $4, $5, $6)`,
      [ruleId ?? null, sourceChannel ?? "", targetChannel ?? "", status, detail ?? "", preview ?? ""],
    );
  } catch (err) {
    logError("log yazılamadı", err);
  }
}

function isVisualMedia(media) {
  if (!media) return false;
  const kind = media.className || media.constructor?.name || "";
  // Link önizlemesi (MessageMediaWebPage) metin postudur: kullanıcının
  // asıl senaryosu "kod + link" tek post içinde. Bunu atlamak, iletilmesi
  // gereken her şeyin atlanması anlamına gelir.
  if (kind === "MessageMediaWebPage" || kind === "MessageMediaEmpty") return false;
  return true;
}

function textPreview(text) {
  const clean = (text || "").replace(/\s+/g, " ").trim();
  return clean.length > 120 ? `${clean.slice(0, 117)}...` : clean;
}

// Kaynak posttan yalnızca bonus kodu ve giriş linki alınır. Başlık, duyuru
// bandı, sohbet/sponsor satırları ve yorum çağrıları hedefe hiç gitmez.
async function forwardMessage(message, rule) {
  const originalText = message.message || "";
  const originalEntities = message.entities || [];
  harvestGramjsPremium(originalText, originalEntities);

  const extracted = extractCodeAndLink(originalText, originalEntities);
  if (!extracted) {
    await writeLog({
      ruleId: rule.id,
      sourceChannel: rule.source_channel,
      targetChannel: rule.target_channel,
      status: "skipped_format",
      detail: "Kod ve link yok, post atlandı",
      preview: textPreview(originalText),
    });
    return;
  }

  const bodyText = extracted.text;
  const bodyEntities = [
    new Api.MessageEntityCode({
      offset: 0,
      length: extracted.code.length,
    }),
    new Api.MessageEntityUrl({
      offset: extracted.urlOffset,
      length: extracted.urlLength,
    }),
  ];

  const footerText = (rule.footer_text || "").trim();
  const footerButtons = normalizeFooterButtons(rule.footer_buttons);
  const footerLayout = normalizeFooterButtonLayout(rule.footer_button_layout);
  const storedFooterEntities = parseMessageEntities(rule.footer_entities);

  let combinedText = bodyText;
  let combinedEntities = [...bodyEntities];

  if (footerText) {
    const shift = bodyText.length + SEPARATOR.length;
    if (storedFooterEntities.length) {
      combinedText = `${bodyText}${SEPARATOR}${footerText}`;
      combinedEntities = [
        ...bodyEntities,
        ...botEntitiesToGramjs(storedFooterEntities, shift),
      ];
    } else {
      try {
        const [parsedFooter, footerEntities] = await _parseMessageText(
          client,
          footerText,
          "markdown",
        );
        for (const entity of footerEntities) entity.offset += shift;
        combinedText = `${bodyText}${SEPARATOR}${parsedFooter}`;
        combinedEntities = [...bodyEntities, ...footerEntities];
      } catch (err) {
        logError(`alt metin ayrıştırılamadı (kural #${rule.id})`, err);
        combinedText = `${bodyText}${SEPARATOR}${footerText}`;
        combinedEntities = bodyEntities;
      }
    }
  }

  if (!combinedText.trim()) {
    await writeLog({
      ruleId: rule.id,
      sourceChannel: rule.source_channel,
      targetChannel: rule.target_channel,
      status: "skipped_media",
      detail: "Boş metin, gönderilecek içerik yok",
    });
    return;
  }

  try {
    const payload = {
      message: combinedText,
      formattingEntities: combinedEntities,
      linkPreview: false,
    };
    if (footerButtons.length) {
      try {
        await sendViaBot(
          rule.target_channel,
          combinedText,
          combinedEntities,
          footerButtons,
          footerLayout,
        );
      } catch (err) {
        logError(
          `bot ile butonlu gönderim olmadı, hesaptan denenecek (kural #${rule.id})`,
          err,
        );
        await client.sendMessage(rule.target_channel, {
          ...payload,
          buttons: toUserbotButtons(footerButtons, footerLayout),
        });
      }
    } else {
      await client.sendMessage(rule.target_channel, payload);
    }
    await writeLog({
      ruleId: rule.id,
      sourceChannel: rule.source_channel,
      targetChannel: rule.target_channel,
      status: "forwarded",
      preview: textPreview(combinedText),
    });
    log(`iletildi: ${rule.source_channel} -> ${rule.target_channel}`);
  } catch (err) {
    await writeLog({
      ruleId: rule.id,
      sourceChannel: rule.source_channel,
      targetChannel: rule.target_channel,
      status: "error",
      detail: String(err?.errorMessage || err?.message || err),
      preview: textPreview(combinedText),
    });
    logError(`gönderilemedi (${rule.source_channel} -> ${rule.target_channel})`, err);
  }
}

async function handleIncomingMessage(event, rulesForSource) {
  const message = event.message;
  if (!message) return;

  const hasMedia = isVisualMedia(message.media);

  for (const rule of rulesForSource) {
    if (hasMedia) {
      await writeLog({
        ruleId: rule.id,
        sourceChannel: rule.source_channel,
        targetChannel: rule.target_channel,
        status: "skipped_media",
        detail: "Görsel/medya içeren post atlandı",
        preview: textPreview(message.message),
      });
      continue;
    }
    await forwardMessage(message, rule);
  }
}

async function ensureClient(config) {
  const signature = `${config.api_id}:${config.session_encrypted}`;
  if (client && currentSessionSignature === signature) return client;

  if (client) {
    await client.disconnect().catch(() => {});
    client = null;
    activeHandlers = [];
    currentSourceKey = "";
  }

  const apiId = Number(config.api_id);
  const apiHash = decryptSecret(config.api_hash_encrypted);
  const sessionString = decryptSecret(config.session_encrypted);
  if (!apiId || !apiHash || !sessionString) return null;

  const newClient = new TelegramClient(new StringSession(sessionString), apiId, apiHash, {
    connectionRetries: 10,
  });

  try {
    await newClient.connect();
  } catch (err) {
    logError("bağlantı kurulamadı", err);
    return null;
  }

  client = newClient;
  currentSessionSignature = signature;
  log(`bağlandı (${config.account_label || "hesap"})`);
  return client;
}

// Aktif kurallar kaynak kanala göre gruplanır; her benzersiz kaynak için tek
// bir NewMessage dinleyicisi kurulur. Kanal kimliği çözümlemesini teleproto
// kendi içinde yapar (kullanıcı adı, davet linki veya sayısal id kabul eder),
// bu yüzden burada elle bir ID eşleştirmesi yapılmaz.
async function refreshHandlers() {
  const rules = await loadActiveRules();

  const bySource = new Map();
  for (const rule of rules) {
    const key = rule.source_channel;
    if (!bySource.has(key)) bySource.set(key, []);
    bySource.get(key).push(rule);
  }

  const sourceKey = JSON.stringify(
    rules.map((r) => [
      r.id,
      r.source_channel,
      r.target_channel,
      r.footer_text,
      r.footer_buttons,
      r.footer_entities,
      r.footer_button_layout,
    ]),
  );
  if (sourceKey === currentSourceKey) return;

  for (const { handler, builder } of activeHandlers) {
    try {
      client.removeEventHandler(handler, builder);
    } catch {
      // Zaten kaldırılmış olabilir, yoksayılır.
    }
  }
  activeHandlers = [];

  for (const [sourceChannel, rulesForSource] of bySource) {
    try {
      const builder = new NewMessage({ chats: [sourceChannel] });
      const handler = (event) =>
        handleIncomingMessage(event, rulesForSource).catch((err) =>
          logError(`işleme hatası (${sourceChannel})`, err),
        );
      client.addEventHandler(handler, builder);
      activeHandlers.push({ handler, builder, sourceChannel });
    } catch (err) {
      logError(`kaynak kanal dinlenemedi: ${sourceChannel}`, err);
    }
  }

  currentSourceKey = sourceKey;
  log(`${bySource.size} kaynak kanal dinleniyor (${activeHandlers.length} kayıt aktif)`);
}

async function tick() {
  try {
    const config = await loadConfig();
    botToken = config?.bot_token_encrypted
      ? decryptSecret(config.bot_token_encrypted)
      : "";
    await tickBot(pool, config, { log, logError });
    await tickUserbot(config);
  } catch (err) {
    logError("döngü hatası", err);
  }
}

async function tickUserbot(config) {
  if (!config || !config.session_encrypted || !config.connected) {
    if (client) {
      await client.disconnect().catch(() => {});
      client = null;
      currentSessionSignature = "";
      activeHandlers = [];
      currentSourceKey = "";
    }
    if (!hasLoggedWaiting) {
      log("oturum yok, bekleniyor (admin panelden giriş yapılmalı)");
      hasLoggedWaiting = true;
    }
    return;
  }

  hasLoggedWaiting = false;
  const active = await ensureClient(config);
  if (active) await refreshHandlers();
}

async function shutdown(signal) {
  log(`${signal} alındı, kapatılıyor`);
  if (client) await client.disconnect().catch(() => {});
  stopBot();
  await pool.end().catch(() => {});
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("unhandledRejection", (err) => logError("yakalanmamış hata", err));

log("servis başlatıldı");
await tick();
setInterval(tick, POLL_INTERVAL_MS);
