import { decryptSecret } from "./crypto.mjs";
import { formatBotAdmins, hasBotAdmins, isBotAdmin } from "./bot-admins.mjs";
import {
  buttonHelpHtml,
  formatButtonsHtml,
  formatLayoutLabel,
  layoutHelpHtml,
  normalizeFooterButtonLayout,
  normalizeFooterButtons,
  parseButtonMessage,
  serializeFooterButtons,
} from "./footer-buttons.mjs";
import {
  decorateKeyboard,
  footerToHtml,
  harvestPremiumIcons,
  normalizeFooterInput,
  premiumizeHtml,
  serializeMessageEntities,
} from "./premium.mjs";


const API = "https://api.telegram.org/bot";
const wizards = new Map(); // chatId -> { step, payload, at }
const WIZARD_TTL_MS = 10 * 60 * 1000;

let currentToken = "";
let offset = 0;
let running = false;
let botGeneration = 0;

function btn(text, callback_data, style) {
  const button = { text, callback_data };
  if (style) button.style = style;
  return button;
}

function keyboard(rows) {
  return { inline_keyboard: rows };
}

function menuKeyboard() {
  return keyboard([
    [btn("💎 Durum", "status", "primary"), btn("📡 Eşleştirmeler", "rules", "success")],
    [btn("✨ Yeni eşleştirme", "add", "primary")],
    [btn("⚡️ Son aktivite", "logs", "primary")],
    [btn("🏠 Ana menü", "menu", "success")],
  ]);
}

function cancelKeyboard() {
  return keyboard([[btn("❌ Vazgeç", "cancel", "danger")]]);
}

function isAdmin(from) {
  return isBotAdmin(from);
}

function stillFresh(state) {
  return state && Date.now() - state.at < WIZARD_TTL_MS;
}

function setWizard(chatId, step, payload = {}) {
  wizards.set(chatId, { step, payload, at: Date.now() });
}

function clearWizard(chatId) {
  wizards.delete(chatId);
}

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

async function api(token, method, body) {
  const res = await fetch(`${API}${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!data.ok) {
    const err = new Error(data.description || method);
    err.code = data.error_code;
    throw err;
  }
  return data.result;
}

async function send(token, chatId, html, extra = {}) {
  const decorated = extra.reply_markup
    ? { ...extra, reply_markup: decorateKeyboard(extra.reply_markup) }
    : extra;
  try {
    return await api(token, "sendMessage", {
      chat_id: chatId,
      text: premiumizeHtml(html),
      parse_mode: "HTML",
      disable_web_page_preview: true,
      ...decorated,
    });
  } catch (err) {
    if (!String(err.message || "").toLowerCase().includes("emoji")) throw err;
    return api(token, "sendMessage", {
      chat_id: chatId,
      text: html,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      ...extra,
    });
  }
}

async function edit(token, chatId, messageId, html, extra = {}) {
  const decorated = extra.reply_markup
    ? { ...extra, reply_markup: decorateKeyboard(extra.reply_markup) }
    : extra;
  try {
    return await api(token, "editMessageText", {
      chat_id: chatId,
      message_id: messageId,
      text: premiumizeHtml(html),
      parse_mode: "HTML",
      disable_web_page_preview: true,
      ...decorated,
    });
  } catch (err) {
    if (String(err.message || "").includes("message is not modified")) return;
    if (!String(err.message || "").toLowerCase().includes("emoji")) throw err;
    return api(token, "editMessageText", {
      chat_id: chatId,
      message_id: messageId,
      text: html,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      ...extra,
    });
  }
}

async function answer(token, id, text = "", extra = {}) {
  try {
    await api(token, "answerCallbackQuery", { callback_query_id: id, text, ...extra });
  } catch {
    // Süresi dolmuş callback yok sayılır.
  }
}

function header(title) {
  return `✨ <b>AL KANKA</b> · ${title}\n<blockquote expandable>Yönetim yalnızca ${esc(formatBotAdmins())} hesabına açık. Premium görünüm: renkli yeni nesil butonlar.</blockquote>\n`;
}

function menuText() {
  return `${header("Aktarma Merkezi")}
Kanal eşleştirmelerini, alt metni ve canlı aktiviteyi buradan yönetin.

<i>Görselli postlar hedefe iletilmez. Kaynak izi bırakılmaz.</i>`;
}

async function loadAllRules(pool) {
  const { rows } = await pool.query(
    `select id, source_channel, target_channel, footer_text, footer_buttons, footer_entities, footer_button_layout, active, sort_order
     from telegram_forward_rules
     order by sort_order asc, id asc`,
  );
  return rows;
}

async function loadConfig(pool) {
  const { rows } = await pool.query(
    "select * from telegram_config order by id desc limit 1",
  );
  return rows[0] ?? null;
}

async function loadLogs(pool) {
  const { rows } = await pool.query(
    `select source_channel, target_channel, status, detail, preview, created_at
     from telegram_forward_log
     order by created_at desc
     limit 8`,
  );
  return rows;
}

function statusHtml(config, rules) {
  const userbot = config?.connected
    ? `🟢 <b>Hesap bağlı</b> · ${esc(config.account_label || "oturum açık")}`
    : "🔴 <b>Hesap bağlı değil</b> · admin panelden giriş yapın";
  const active = rules.filter((r) => r.active).length;
  return `${header("Durum")}
${userbot}
🤖 Bot: @${esc(config?.bot_username || "—")}
👤 Yetkili: ${esc(formatBotAdmins())}
📡 Eşleştirme: <b>${active}</b> aktif / ${rules.length} kayıt`;
}

function rulesHtml(rules) {
  if (!rules.length) {
    return `${header("Eşleştirmeler")}\nHenüz kayıt yok. Aşağıdan yeni eşleştirme ekleyin.`;
  }
  const lines = rules.map((r) => {
    const mark = r.active ? "🟢" : "⏸";
    const footer = r.footer_text
      ? `\n    <i>${esc(textPreview(r.footer_text, 60))}</i>`
      : "";
    const buttonCount = normalizeFooterButtons(r.footer_buttons).length;
    const buttonLine = buttonCount ? `\n    🎛 ${buttonCount} buton` : "";
    return `${mark} <b>#${r.id}</b> ${esc(r.source_channel)} → ${esc(r.target_channel)}${footer}${buttonLine}`;
  });
  return `${header("Eşleştirmeler")}\n${lines.join("\n\n")}`;
}

function rulesKeyboard(rules) {
  const rows = rules.map((r) => [
    btn(`${r.active ? "🟢" : "⏸"} #${r.id}`, `rule:${r.id}`, "primary"),
    btn(r.active ? "Durdur" : "Başlat", `toggle:${r.id}`, r.active ? "danger" : "success"),
  ]);
  rows.push([btn("✨ Yeni eşleştirme", "add", "success")]);
  rows.push([btn("🏠 Ana menü", "menu", "primary")]);
  return keyboard(rows);
}

function ruleDetailHtml(rule) {
  const footer = rule.footer_text
    ? `<blockquote>${footerToHtml(rule.footer_text, rule.footer_entities, esc)}</blockquote>`
    : "<i>Alt metin yok</i>";
  return `${header(`Eşleştirme #${rule.id}`)}
Kaynak: <code>${esc(rule.source_channel)}</code>
Hedef: <code>${esc(rule.target_channel)}</code>
Durum: ${rule.active ? "🟢 Aktif" : "⏸ Pasif"}

${footer}

${formatButtonsHtml(rule.footer_buttons, esc, rule.footer_button_layout)}`;
}

function ruleDetailKeyboard(rule) {
  return keyboard([
    [
      btn(rule.active ? "⏸ Durdur" : "🟢 Başlat", `toggle:${rule.id}`, rule.active ? "danger" : "success"),
    ],
    [
      btn("📝 Kaynak", `es:${rule.id}`, "primary"),
      btn("🎯 Hedef", `et:${rule.id}`, "primary"),
    ],
    [btn("💬 Alt metin", `ef:${rule.id}`, "primary")],
    [btn("🎛 Alt butonlar", `eb:${rule.id}`, "success")],
    [btn("↕ Düzen", `el:${rule.id}`, "primary")],
    [btn("🗑 Sil", `del:${rule.id}`, "danger")],
    [btn("← Liste", "rules", "success")],
  ]);
}

function logsHtml(rows) {
  if (!rows.length) {
    return `${header("Aktivite")}\nHenüz kayıt yok.`;
  }
  const label = {
    forwarded: "🟢 İletildi",
    skipped_media: "⏸ Atlandı",
    skipped_format: "⏸ Atlandı",
    error: "🔴 Hata",
  };
  const lines = rows.map((r) => {
    const when = new Date(r.created_at).toLocaleString("tr-TR");
    const extra = r.preview || r.detail || "";
    return `${label[r.status] || r.status} <code>${esc(r.source_channel)} → ${esc(r.target_channel)}</code>\n<i>${esc(when)}</i>${extra ? `\n${esc(textPreview(extra, 90))}` : ""}`;
  });
  return `${header("Son aktivite")}\n${lines.join("\n\n")}`;
}

function textPreview(text, max = 120) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

async function findRule(pool, id) {
  const { rows } = await pool.query(
    "select * from telegram_forward_rules where id = $1",
    [id],
  );
  return rows[0] ?? null;
}

async function ensureCommands(token) {
  await api(token, "setMyCommands", {
    commands: [
      { command: "start", description: "Aktarma merkezi" },
      { command: "durum", description: "Bağlantı ve özet" },
      { command: "eslesme", description: "Kanal eşleştirmeleri" },
      { command: "yeni", description: "Yeni eşleştirme" },
      { command: "aktivite", description: "Son iletilenler" },
    ],
  }).catch(() => {});
}

async function deny(token, chatId, from) {
  await send(
    token,
    chatId,
    hasBotAdmins()
      ? `⛔️ <b>Yetkisiz</b>\n<blockquote>Bu botu yalnızca ${esc(formatBotAdmins())} kullanabilir.</blockquote>`
      : `⛔️ <b>Yetkisiz</b>\n<blockquote>Bot yöneticisi tanımlı değil. Sunucuda TELEGRAM_BOT_ADMINS ayarına kendi kullanıcı adınızı veya Telegram ID'nizi yazın. Sizin ID'niz: <code>${esc(from?.id ?? "")}</code></blockquote>`,
  );
}

async function finishAdd(pool, token, chatId, wizard, layout, messageId) {
  const footer = wizard.payload.footer || "";
  const footerEntities = wizard.payload.footerEntities || "[]";
  const footerButtons = wizard.payload.footerButtons || "[]";
  const { rows } = await pool.query("select coalesce(max(sort_order), 0) + 1 as n from telegram_forward_rules");
  const sortOrder = Number(rows[0]?.n || 1);
  const inserted = await pool.query(
    `insert into telegram_forward_rules
       (source_channel, target_channel, footer_text, footer_buttons, footer_entities, footer_button_layout, active, sort_order)
     values ($1, $2, $3, $4, $5, $6, true, $7)
     returning *`,
    [
      wizard.payload.source,
      wizard.payload.target,
      footer,
      footerButtons,
      footerEntities,
      normalizeFooterButtonLayout(layout),
      sortOrder,
    ],
  );
  clearWizard(chatId);
  const rule = inserted.rows[0];
  const html = `🟢 <b>Eşleştirme eklendi</b>\n\n${ruleDetailHtml(rule).replace(header(`Eşleştirme #${rule.id}`) + "\n", "")}`;
  const extra = { reply_markup: ruleDetailKeyboard(rule) };
  if (messageId) return edit(token, chatId, messageId, html, extra);
  return send(token, chatId, html, extra);
}

async function showMenu(token, chatId, messageId) {
  const html = menuText();
  const extra = { reply_markup: menuKeyboard() };
  if (messageId) return edit(token, chatId, messageId, html, extra);
  return send(token, chatId, html, extra);
}

async function handleCallback(pool, token, query, logError) {
  const from = query.from;
  const chatId = query.message?.chat?.id;
  const messageId = query.message?.message_id;
  const data = String(query.data || "");
  if (!chatId) return;

  if (!isAdmin(from)) {
    await answer(token, query.id, "Yetkisiz", { show_alert: true });
    return;
  }

  const [action, rawId, extra] = data.split(":");
  const id = Number(rawId);

  if (action === "menu") {
    clearWizard(chatId);
    await answer(token, query.id);
    await showMenu(token, chatId, messageId);
    return;
  }

  if (action === "cancel") {
    clearWizard(chatId);
    await answer(token, query.id, "İptal");
    await showMenu(token, chatId, messageId);
    return;
  }

  if (action === "status") {
    const [config, rules] = await Promise.all([loadConfig(pool), loadAllRules(pool)]);
    await answer(token, query.id);
    await edit(token, chatId, messageId, statusHtml(config, rules), {
      reply_markup: menuKeyboard(),
    });
    return;
  }

  if (action === "rules") {
    const rules = await loadAllRules(pool);
    await answer(token, query.id);
    await edit(token, chatId, messageId, rulesHtml(rules), {
      reply_markup: rulesKeyboard(rules),
    });
    return;
  }

  if (action === "logs") {
    const logs = await loadLogs(pool);
    await answer(token, query.id);
    await edit(token, chatId, messageId, logsHtml(logs), {
      reply_markup: keyboard([[btn("🏠 Ana menü", "menu", "primary")]]),
    });
    return;
  }

  if (action === "add") {
    setWizard(chatId, "add_source", {});
    await answer(token, query.id);
    await edit(
      token,
      chatId,
      messageId,
      `${header("Yeni eşleştirme")}\nKaynak kanalı gönderin.\nÖrnek: <code>@kanaladi</code>`,
      { reply_markup: cancelKeyboard() },
    );
    return;
  }

  if (action === "rule") {
    const rule = await findRule(pool, id);
    if (!rule) {
      await answer(token, query.id, "Kayıt yok", { show_alert: true });
      return;
    }
    await answer(token, query.id);
    await edit(token, chatId, messageId, ruleDetailHtml(rule), {
      reply_markup: ruleDetailKeyboard(rule),
    });
    return;
  }

  if (action === "toggle") {
    const rule = await findRule(pool, id);
    if (!rule) {
      await answer(token, query.id, "Kayıt yok", { show_alert: true });
      return;
    }
    await pool.query(
      "update telegram_forward_rules set active = $2, updated_at = now() where id = $1",
      [id, !rule.active],
    );
    const updated = await findRule(pool, id);
    await answer(token, query.id, updated.active ? "Aktif" : "Durduruldu");
    await edit(token, chatId, messageId, ruleDetailHtml(updated), {
      reply_markup: ruleDetailKeyboard(updated),
    });
    return;
  }

  if (action === "del") {
    await answer(token, query.id);
    await edit(
      token,
      chatId,
      messageId,
      `${header("Silinsin mi?")}\n<blockquote>#${id} eşleştirmesi kalıcı olarak silinir.</blockquote>`,
      {
        reply_markup: keyboard([
          [btn("🗑 Evet, sil", `wipe:${id}`, "danger")],
          [btn("← Vazgeç", `rule:${id}`, "primary")],
        ]),
      },
    );
    return;
  }

  if (action === "wipe") {
    await pool.query("delete from telegram_forward_rules where id = $1", [id]);
    const rules = await loadAllRules(pool);
    await answer(token, query.id, "Silindi");
    await edit(token, chatId, messageId, rulesHtml(rules), {
      reply_markup: rulesKeyboard(rules),
    });
    return;
  }

  if (action === "wlayout") {
    const wizard = wizards.get(chatId);
    if (!stillFresh(wizard) || wizard.step !== "add_layout") {
      await answer(token, query.id, "Süre doldu", { show_alert: true });
      return;
    }
    await answer(token, query.id);
    await finishAdd(pool, token, chatId, wizard, rawId, messageId);
    return;
  }

  if (action === "layout") {
    const rule = await findRule(pool, id);
    if (!rule) {
      await answer(token, query.id, "Kayıt yok", { show_alert: true });
      return;
    }
    const layout = normalizeFooterButtonLayout(extra);
    await pool.query(
      "update telegram_forward_rules set footer_button_layout = $2, updated_at = now() where id = $1",
      [id, layout],
    );
    const updated = await findRule(pool, id);
    await answer(token, query.id, formatLayoutLabel(layout));
    await edit(token, chatId, messageId, ruleDetailHtml(updated), {
      reply_markup: ruleDetailKeyboard(updated),
    });
    return;
  }

  if (action === "el") {
    const rule = await findRule(pool, id);
    if (!rule) {
      await answer(token, query.id, "Kayıt yok", { show_alert: true });
      return;
    }
    await answer(token, query.id);
    await edit(token, chatId, messageId, `${header("Buton düzeni")}\n${layoutHelpHtml()}`, {
      reply_markup: keyboard([
        [
          btn("Alt alta", `layout:${id}:stack`, "success"),
          btn("Yan yana", `layout:${id}:row`, "primary"),
        ],
        [btn("← Vazgeç", `rule:${id}`, "danger")],
      ]),
    });
    return;
  }

  if (action === "es" || action === "et" || action === "ef" || action === "eb") {
    const rule = await findRule(pool, id);
    if (!rule) {
      await answer(token, query.id, "Kayıt yok", { show_alert: true });
      return;
    }
    const step =
      action === "es"
        ? "edit_source"
        : action === "et"
          ? "edit_target"
          : action === "ef"
            ? "edit_footer"
            : "edit_buttons";
    setWizard(chatId, step, { id });
    const ask =
      step === "edit_source"
        ? "Yeni kaynak kanalı gönderin."
        : step === "edit_target"
          ? "Yeni hedef kanalı gönderin."
          : step === "edit_footer"
            ? "Yeni alt metni gönderin. Telegram’ın kendi biçimlendirmesini kullanın (kalın, italik, altı çizili, spoiler, link, kod, alıntı, premium emoji). Boş bırakmak için <code>-</code> yazın."
            : buttonHelpHtml();
    await answer(token, query.id);
    await edit(token, chatId, messageId, `${header("Düzenle")}\n${ask}`, {
      reply_markup: cancelKeyboard(),
    });
    return;
  }

  await answer(token, query.id);
}

async function handleMessage(pool, token, message, logError) {
  const from = message.from;
  const chatId = message.chat?.id;
  const text = String(message.text || message.caption || "").trim();
  if (!chatId) return;

  if (!isAdmin(from)) {
    await deny(token, chatId, from);
    return;
  }

  harvestPremiumIcons(text, message.entities || message.caption_entities);

  const cmd = text.split(/\s+/)[0].split("@")[0].toLowerCase();
  if (cmd === "/start" || cmd === "/menu") {
    clearWizard(chatId);
    await showMenu(token, chatId);
    return;
  }
  if (cmd === "/durum") {
    const [config, rules] = await Promise.all([loadConfig(pool), loadAllRules(pool)]);
    await send(token, chatId, statusHtml(config, rules), { reply_markup: menuKeyboard() });
    return;
  }
  if (cmd === "/eslesme" || cmd === "/eslestirme") {
    const rules = await loadAllRules(pool);
    await send(token, chatId, rulesHtml(rules), { reply_markup: rulesKeyboard(rules) });
    return;
  }
  if (cmd === "/yeni") {
    setWizard(chatId, "add_source", {});
    await send(
      token,
      chatId,
      `${header("Yeni eşleştirme")}\nKaynak kanalı gönderin.\nÖrnek: <code>@kanaladi</code>`,
      { reply_markup: cancelKeyboard() },
    );
    return;
  }
  if (cmd === "/aktivite") {
    const logs = await loadLogs(pool);
    await send(token, chatId, logsHtml(logs), {
      reply_markup: keyboard([[btn("🏠 Ana menü", "menu", "primary")]]),
    });
    return;
  }
  if (cmd === "/iptal") {
    clearWizard(chatId);
    await showMenu(token, chatId);
    return;
  }

  const wizard = wizards.get(chatId);
  if (!stillFresh(wizard)) {
    if (wizard) clearWizard(chatId);
    await send(
      token,
      chatId,
      `${header("Aktarma")}\nKomut seçin veya menüyü açın.`,
      { reply_markup: menuKeyboard() },
    );
    return;
  }

  try {
    await continueWizard(pool, token, chatId, message, wizard);
  } catch (err) {
    logError("bot sihirbazı", err);
    await send(token, chatId, "⚠️ İşlem tamamlanamadı, tekrar deneyin.", {
      reply_markup: menuKeyboard(),
    });
  }
}

async function continueWizard(pool, token, chatId, message, wizard) {
  const text = String(message.text || message.caption || "").trim();
  const incomingEntities = message.entities || message.caption_entities || [];
  if (wizard.step === "add_source") {
    setWizard(chatId, "add_target", { source: text });
    await send(
      token,
      chatId,
      `${header("Hedef kanal")}\nHedef kanalı gönderin.\nÖrnek: <code>@hedefkanal</code>`,
      { reply_markup: cancelKeyboard() },
    );
    return;
  }
  if (wizard.step === "add_target") {
    setWizard(chatId, "add_footer", { ...wizard.payload, target: text });
    await send(
      token,
      chatId,
      `${header("Alt metin")}\nPostun altına eklenecek metni gönderin.\nAtlamak için <code>-</code> yazın.\n\nTelegram uygulamasındaki biçimlendirmeyi kullanın: <b>kalın</b>, <i>italik</i>, <u>altı çizili</u>, <s>üstü çizili</s>, spoiler, link, kod, alıntı ve premium özel emoji. Seçip biçimlendirmeniz yeter; markdown yazmanıza gerek yok.`,
      { reply_markup: cancelKeyboard() },
    );
    return;
  }
  if (wizard.step === "add_footer") {
    const footer = normalizeFooterInput(message.text || message.caption || "", incomingEntities);
    setWizard(chatId, "add_buttons", {
      ...wizard.payload,
      footer: footer.text,
      footerEntities: serializeMessageEntities(footer.entities),
    });
    await send(token, chatId, `${header("Alt butonlar")}\n${buttonHelpHtml()}`, {
      reply_markup: cancelKeyboard(),
    });
    return;
  }
  if (wizard.step === "add_buttons") {
    const parsed = parseButtonMessage(text);
    const footerButtons = serializeFooterButtons(parsed);
    if (!parsed.length) {
      await finishAdd(pool, token, chatId, {
        ...wizard,
        payload: { ...wizard.payload, footerButtons },
      }, "stack");
      return;
    }
    setWizard(chatId, "add_layout", { ...wizard.payload, footerButtons });
    await send(token, chatId, `${header("Buton düzeni")}\n${layoutHelpHtml()}`, {
      reply_markup: keyboard([
        [
          btn("Alt alta", "wlayout:stack", "success"),
          btn("Yan yana", "wlayout:row", "primary"),
        ],
        [btn("❌ Vazgeç", "cancel", "danger")],
      ]),
    });
    return;
  }
  if (wizard.step === "add_layout") {
    await finishAdd(pool, token, chatId, wizard, text);
    return;
  }

  if (wizard.step === "edit_source" || wizard.step === "edit_target" || wizard.step === "edit_footer" || wizard.step === "edit_buttons") {
    if (wizard.step === "edit_footer") {
      const footer = normalizeFooterInput(message.text || message.caption || "", incomingEntities);
      await pool.query(
        `update telegram_forward_rules
         set footer_text = $2, footer_entities = $3, updated_at = now()
         where id = $1`,
        [wizard.payload.id, footer.text, serializeMessageEntities(footer.entities)],
      );
    } else {
      const column =
        wizard.step === "edit_source"
          ? "source_channel"
          : wizard.step === "edit_target"
            ? "target_channel"
            : "footer_buttons";
      const value =
        wizard.step === "edit_buttons"
          ? serializeFooterButtons(parseButtonMessage(text))
          : text;
      await pool.query(
        `update telegram_forward_rules set ${column} = $2, updated_at = now() where id = $1`,
        [wizard.payload.id, value],
      );
    }
    const rule = await findRule(pool, wizard.payload.id);
    clearWizard(chatId);
    await send(token, chatId, `🟢 <b>Güncellendi</b>\n\n${ruleDetailHtml(rule).replace(header(`Eşleştirme #${rule.id}`) + "\n", "")}`, {
      reply_markup: ruleDetailKeyboard(rule),
    });
  }
}

async function processUpdate(pool, token, update, logError) {
  try {
    if (update.callback_query) {
      await handleCallback(pool, token, update.callback_query, logError);
      return;
    }
    if (update.message) {
      await handleMessage(pool, token, update.message, logError);
    }
  } catch (err) {
    logError("bot güncelleme", err);
  }
}

export async function tickBot(pool, config, { log, logError }) {
  const encrypted = config?.bot_token_encrypted || "";
  if (!encrypted) {
    if (running) {
      botGeneration += 1;
      running = false;
      currentToken = "";
      log("bot tokeni yok, dinleme durdu");
    }
    return;
  }

  const token = decryptSecret(encrypted);
  if (!token) return;

  if (running && currentToken === token) return;

  const gen = ++botGeneration;
  currentToken = token;
  running = true;
  offset = 0;
  log(`bot dinleniyor (@${config.bot_username || "bot"}) · yetkili ${formatBotAdmins()}`);
  if (!hasBotAdmins()) {
    log("UYARI: TELEGRAM_BOT_ADMINS boş, bot kimseye yönetim izni vermeyecek");
  }
  await ensureCommands(token);
  try {
    const rules = await loadAllRules(pool);
    for (const rule of rules) {
      harvestPremiumIcons(rule.footer_text, rule.footer_entities);
    }
  } catch (err) {
    logError("premium ifadeler yüklenemedi", err);
  }

  void pollLoop(pool, token, gen, log, logError);
}

async function pollLoop(pool, token, gen, log, logError) {
  while (botGeneration === gen && currentToken === token) {
    try {
      const updates = await api(token, "getUpdates", {
        offset,
        timeout: 25,
        allowed_updates: ["message", "callback_query"],
      });
      if (botGeneration !== gen) break;
      for (const update of updates) {
        offset = update.update_id + 1;
        await processUpdate(pool, token, update, logError);
      }
    } catch (err) {
      if (botGeneration !== gen || currentToken !== token) break;
      if (err.code === 409) {
        logError("bot getUpdates çakışması, 5sn bekleniyor", err);
        await sleep(5000);
        continue;
      }
      if (err.code === 401) {
        logError("bot tokeni geçersiz", err);
        if (botGeneration === gen) {
          running = false;
          currentToken = "";
        }
        break;
      }
      logError("bot polling", err);
      await sleep(2000);
    }
  }
  if (botGeneration === gen) running = false;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function stopBot() {
  botGeneration += 1;
  running = false;
  currentToken = "";
}
