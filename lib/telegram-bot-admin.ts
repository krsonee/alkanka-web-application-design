// worker/telegram-forwarder/bot-admins.mjs ile aynı kural; panelde yalnızca
// kimin yetkili olduğunu göstermek için kullanılır.
export function formatTelegramBotAdmins(raw = process.env.TELEGRAM_BOT_ADMINS): string {
  const usernames: string[] = [];
  const ids: string[] = [];
  for (const part of String(raw ?? "").split(",")) {
    const value = part.trim().replace(/^@/, "").toLowerCase();
    if (!value) continue;
    if (/^\d+$/.test(value)) ids.push(`ID ${value}`);
    else if (/^[a-z0-9_]{4,32}$/.test(value)) usernames.push(`@${value}`);
  }
  return [...usernames, ...ids].join(", ");
}
