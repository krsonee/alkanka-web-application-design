import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import { pool } from "@/db";
import { getPointsConfig } from "@/lib/points";
import { getSessionSecret } from "@/lib/secrets";
import { SITE_URL } from "@/lib/seo";
import { decryptSecret } from "@/lib/telegram-crypto";

export const TG_STATE_COOKIE = "alkanka_tg_state";

export async function readBotToken(): Promise<string | null> {
  try {
    const { rows } = await pool.query<{ bot_token_encrypted: string }>(
      `SELECT bot_token_encrypted FROM telegram_config ORDER BY id LIMIT 1`,
    );
    const token = decryptSecret(rows[0]?.bot_token_encrypted ?? "");
    return token || null;
  } catch {
    return null;
  }
}

let botCache: { token: string; id: string } | null = null;

async function botId(token: string): Promise<string | null> {
  if (botCache?.token === token) return botCache.id;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
      signal: AbortSignal.timeout(8000),
    });
    const data = (await res.json()) as { ok?: boolean; result?: { id?: number } };
    if (!data.ok || !data.result?.id) return null;
    const id = String(data.result.id);
    botCache = { token, id };
    return id;
  } catch {
    return null;
  }
}

export async function telegramStatus() {
  const token = await readBotToken();
  return { connected: Boolean(token) };
}

export function signTelegramState(memberId: number) {
  const exp = Date.now() + 10 * 60 * 1000;
  const nonce = randomBytes(8).toString("hex");
  const payload = `${memberId}.${exp}.${nonce}`;
  const sig = createHmac("sha256", getSessionSecret()).update(`tg.${payload}`).digest("hex");
  return `${payload}.${sig}`;
}

export function readTelegramState(token: string | undefined): number | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [idRaw, expRaw, nonce, sig] = parts;
  const payload = `${idRaw}.${expRaw}.${nonce}`;
  const expected = createHmac("sha256", getSessionSecret()).update(`tg.${payload}`).digest("hex");
  const left = Buffer.from(sig);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  const id = Number(idRaw);
  const exp = Number(expRaw);
  if (!Number.isInteger(id) || id <= 0 || !Number.isFinite(exp) || exp < Date.now()) return null;
  return id;
}

export function verifyTelegramLogin(params: Record<string, string>, botToken: string) {
  const hash = params.hash ?? "";
  if (!/^[0-9a-f]{64}$/i.test(hash)) return false;
  const lines = Object.keys(params)
    .filter((key) => key !== "hash" && key !== "state")
    .sort()
    .map((key) => `${key}=${params[key]}`);
  const secret = createHash("sha256").update(botToken).digest();
  const hmac = createHmac("sha256", secret).update(lines.join("\n")).digest("hex");
  const left = Buffer.from(hmac);
  const right = Buffer.from(hash.toLowerCase());
  if (left.length !== right.length || !timingSafeEqual(left, right)) return false;
  const authDate = Number(params.auth_date);
  if (!Number.isFinite(authDate) || Date.now() / 1000 - authDate > 86_400) return false;
  return /^\d{1,20}$/.test(params.id ?? "");
}

export async function startTelegramLink(memberId: number) {
  const token = await readBotToken();
  const id = token ? await botId(token) : null;
  if (!token || !id) {
    return { connected: false as const, message: "Telegram henüz bağlanmadı." };
  }
  const state = signTelegramState(memberId);
  const returnTo = `${SITE_URL}/uye/telegram?state=${encodeURIComponent(state)}`;
  const url =
    `https://oauth.telegram.org/auth?bot_id=${id}` +
    `&origin=${encodeURIComponent(SITE_URL)}` +
    `&request_access=write&return_to=${encodeURIComponent(returnTo)}`;
  return { connected: true as const, url, state };
}

export function channelChatId(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  if (value.startsWith("@")) return value;
  const fromLink = value.match(/t\.me\/([A-Za-z0-9_]+)/i);
  if (fromLink && fromLink[1].toLowerCase() !== "joinchat") return `@${fromLink[1]}`;
  if (/^-?\d+$/.test(value)) return value;
  if (/^[A-Za-z0-9_]{4,}$/.test(value)) return `@${value}`;
  return null;
}

export async function channelTarget() {
  const config = await getPointsConfig();
  if (config.telegramChannel) return channelChatId(config.telegramChannel);
  const { rows } = await pool.query<{ value: string }>(
    `SELECT value FROM settings WHERE key = 'telegram_url'`,
  );
  return channelChatId(rows[0]?.value ?? "");
}

export async function checkChannelMembership(telegramId: string) {
  const token = await readBotToken();
  if (!token) {
    return { connected: false, inChannel: false, message: "Telegram henüz bağlanmadı." };
  }
  const chatId = await channelTarget();
  if (!chatId) {
    return { connected: true, inChannel: false, message: "Kanal ayarı yok." };
  }
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/getChatMember?chat_id=${encodeURIComponent(chatId)}&user_id=${encodeURIComponent(telegramId)}`,
      { signal: AbortSignal.timeout(8000) },
    );
    const data = (await res.json()) as { ok?: boolean; result?: { status?: string } };
    const status = data.result?.status ?? "";
    const inChannel = status === "creator" || status === "administrator" || status === "member";
    return {
      connected: true,
      inChannel,
      message: inChannel ? "Kanaldasın." : "Kanalda görünmüyorsun.",
    };
  } catch {
    return { connected: true, inChannel: false, message: "Kanal kontrolü yapılamadı." };
  }
}

export async function linkTelegram(memberId: number, telegramId: string, username: string) {
  const updated = await pool.query(
    `UPDATE members
     SET telegram_id = $1, telegram_username = $2
     WHERE id = $3
       AND NOT EXISTS (SELECT 1 FROM members WHERE telegram_id = $1 AND id <> $3)
     RETURNING id`,
    [telegramId, username.slice(0, 64), memberId],
  );
  return (updated.rowCount ?? 0) > 0;
}

export async function unlinkTelegram(memberId: number) {
  await pool.query(
    `UPDATE members SET telegram_id = NULL, telegram_username = '' WHERE id = $1`,
    [memberId],
  );
}
