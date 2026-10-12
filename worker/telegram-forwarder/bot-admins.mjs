// src/lib/telegram-bot-admin.ts ile aynı kural. TELEGRAM_BOT_ADMINS virgülle
// ayrılmış kullanıcı adları (@ olsun olmasın) ve/veya sayısal Telegram
// kullanıcı kimlikleri içerir. Kullanıcı adı değiştirilebilir ve başkası
// tarafından alınabilir; sayısal kimlik kalıcıdır, bu yüzden tercih edilmeli.
export function parseBotAdmins(raw = process.env.TELEGRAM_BOT_ADMINS) {
  const ids = new Set();
  const usernames = new Set();
  for (const part of String(raw ?? "").split(",")) {
    const value = part.trim().replace(/^@/, "").toLowerCase();
    if (!value) continue;
    if (/^\d+$/.test(value)) ids.add(value);
    else if (/^[a-z0-9_]{4,32}$/.test(value)) usernames.add(value);
  }
  return { ids, usernames };
}

export const BOT_ADMINS = parseBotAdmins();

export function hasBotAdmins() {
  return BOT_ADMINS.ids.size > 0 || BOT_ADMINS.usernames.size > 0;
}

export function isBotAdmin(from) {
  if (!from) return false;
  if (BOT_ADMINS.ids.has(String(from.id ?? ""))) return true;
  const username = String(from.username ?? "").toLowerCase();
  return Boolean(username) && BOT_ADMINS.usernames.has(username);
}

export function formatBotAdmins() {
  const list = [
    ...[...BOT_ADMINS.usernames].map((u) => `@${u}`),
    ...[...BOT_ADMINS.ids].map((id) => `ID ${id}`),
  ];
  return list.length ? list.join(", ") : "tanımlı değil";
}
