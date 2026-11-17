import 'server-only'
import { rows, sql } from '@/lib/db'
import { botToken, callBot } from '@/lib/telegram-mirror'
import { getChatConfig, type ChatConfig } from '@/lib/telegram-chat'
import { CHAT_MOD_ROLE, CHAT_MUTE_MINUTES } from '@/lib/chat-mod-shared'

type Mod = { id: string; name: string }

type ChatRow = { id: number; tg_message_id: string | null; from_tg_id: string | null; user_id: string | null; author: string; text: string }

const MOD_CACHE_MS = 60_000
const modCache = new Map<string, { at: number; mod: boolean }>()

/** Staff roles the member holds, newest first. No badge tables yet means nobody is staff. */
async function staffRoles(userId: string) {
  try {
    return await rows<{ id: string; name: string }>(sql`SELECT b.id, b.name FROM kp_awards a JOIN kp_badges b ON b.id = a.badge_id
      WHERE a.user_id = ${userId} AND b.role_staff AND b.active ORDER BY a.awarded_at DESC`)
  } catch {
    return []
  }
}

/** Cached for a minute: the chat feed asks on every poll. */
export async function isChatModerator(userId: string): Promise<boolean> {
  const hit = modCache.get(userId)
  if (hit && Date.now() - hit.at < MOD_CACHE_MS) return hit.mod
  const mod = (await staffRoles(userId)).some((r) => r.id === CHAT_MOD_ROLE)
  modCache.set(userId, { at: Date.now(), mod })
  return mod
}

/** Role shown next to the name when staff write from the site (Moderatör, Sponsor Destek...). */
export async function staffRoleName(userId: string): Promise<string | null> {
  return (await staffRoles(userId))[0]?.name ?? null
}

export async function mutedUntil(tgId: number): Promise<Date | null> {
  const [row] = await rows<{ until: string }>(sql`SELECT until FROM chat_mutes WHERE tg_id = ${tgId} AND until > now()`)
  return row ? new Date(row.until) : null
}

async function requireConfig() {
  const config = await getChatConfig()
  if (!config) throw new Error('Sohbet grubu henüz bağlanmadı.')
  return config
}

async function findMessage(config: ChatConfig, id: number) {
  if (!Number.isSafeInteger(id) || id <= 0) return null
  const [m] = await rows<ChatRow>(sql`SELECT id, tg_message_id, from_tg_id, user_id, author, text FROM tg_chat_messages
    WHERE id = ${id} AND chat_id = ${config.chatId}`)
  return m ?? null
}

/** The chat bot may lack the right in the group, so the guard bot gets a turn too. True when either one succeeds. */
async function viaBots(config: ChatConfig, run: (token: string) => Promise<unknown>) {
  const ids = [config.botId]
  const { getHub } = await import('@/lib/tg-hub')
  const hub = await getHub().catch(() => null)
  if (hub?.guardBotId && hub.guardBotId !== config.botId) ids.push(hub.guardBotId)
  for (const id of ids) {
    try {
      await run(await botToken(id))
      return true
    } catch {
      // Try the next bot.
    }
  }
  return false
}

async function record(config: ChatConfig, m: ChatRow, action: string, reason: string) {
  const { modLog } = await import('@/lib/tg-hub')
  await modLog({
    chatId: config.chatId,
    chatTitle: config.title,
    user: m.from_tg_id ? { id: Number(m.from_tg_id), first_name: m.author } : undefined,
    action,
    reason,
  }).catch((error) => console.error('[chat-mod] kayıt yazılamadı', (error as Error).message))
}

export async function modDeleteMessage(mod: Mod, messageId: number) {
  const config = await requireConfig()
  const m = await findMessage(config, messageId)
  if (!m) throw new Error('Mesaj bulunamadı ya da zaten silinmiş.')
  const tgMessageId = m.tg_message_id ? Number(m.tg_message_id) : null
  if (tgMessageId) {
    await rows(sql`INSERT INTO tg_site_removed (chat_id, tg_message_id) VALUES (${config.chatId}, ${tgMessageId}) ON CONFLICT DO NOTHING`)
  }
  await rows(sql`DELETE FROM tg_chat_messages WHERE id = ${m.id}`)
  const inTelegram = tgMessageId
    ? await viaBots(config, (token) => callBot(token, 'deleteMessage', { chat_id: config.chatId, message_id: tgMessageId }))
    : false
  const excerpt = m.text.slice(0, 120)
  await record(config, m, 'Mesaj silindi', `Site sohbetinden, moderatör ${mod.name}${excerpt ? `: "${excerpt}"` : ''}`)
  if (inTelegram) return 'Mesaj siteden ve Telegram grubundan silindi.'
  return tgMessageId
    ? 'Mesaj siteden silindi. Telegram grubundan silinemedi: 48 saatten eski olabilir ya da botun silme yetkisi yok.'
    : 'Mesaj siteden silindi.'
}

export async function modMute(mod: Mod, messageId: number, minutes: number) {
  if (!CHAT_MUTE_MINUTES.includes(minutes)) throw new Error('Geçersiz süre.')
  const config = await requireConfig()
  const m = await findMessage(config, messageId)
  if (!m) throw new Error('Mesaj bulunamadı ya da silinmiş.')
  const tgId = m.from_tg_id ? Number(m.from_tg_id) : null
  if (!tgId) throw new Error('Bu mesajın sahibi susturulamaz.')
  if (m.user_id === mod.id) throw new Error('Kendini susturamazsın.')
  if (m.user_id && (await staffRoles(m.user_id)).length) throw new Error('Görevliler susturulamaz.')
  await rows(sql`INSERT INTO chat_mutes (tg_id, user_id, name, until, by_id, by_name)
    VALUES (${tgId}, ${m.user_id}, ${m.author.slice(0, 60)}, now() + make_interval(mins => ${minutes}), ${mod.id}, ${mod.name.slice(0, 60)})
    ON CONFLICT (tg_id) DO UPDATE SET user_id = EXCLUDED.user_id, name = EXCLUDED.name, until = EXCLUDED.until,
      by_id = EXCLUDED.by_id, by_name = EXCLUDED.by_name, created_at = now()`)
  const inTelegram = await viaBots(config, async (token) => {
    const { muteMember } = await import('@/lib/tg-guard')
    await muteMember(token, config.chatId, tgId, minutes)
  })
  const span = minutes >= 60 ? `${minutes / 60} saat` : `${minutes} dakika`
  await record(config, m, `Susturuldu (${minutes} dk)`, `Site sohbetinden, moderatör ${mod.name}`)
  return inTelegram
    ? `${m.author} ${span} susturuldu: siteden ve Telegram grubundan yazamaz.`
    : `${m.author} ${span} susturuldu: siteden yazamaz, Telegram'dan yazdıkları sitede görünmez. Telegram grubunda susturulamadı (grup yöneticisi olabilir ya da botun yetkisi yok).`
}

export async function modUnmute(mod: Mod, messageId: number) {
  const config = await requireConfig()
  const m = await findMessage(config, messageId)
  if (!m) throw new Error('Mesaj bulunamadı ya da silinmiş.')
  const tgId = m.from_tg_id ? Number(m.from_tg_id) : null
  if (!tgId) throw new Error('Bu mesajın sahibi için susturma yok.')
  const removed = await rows(sql`DELETE FROM chat_mutes WHERE tg_id = ${tgId} RETURNING tg_id`)
  if (!removed.length) return `${m.author} susturulmuş değil.`
  await viaBots(config, async (token) => {
    const { unmuteMember } = await import('@/lib/tg-guard')
    await unmuteMember(token, config.chatId, tgId)
  })
  await record(config, m, 'Susturma kaldırıldı', `Site sohbetinden, moderatör ${mod.name}`)
  return `${m.author} için susturma kaldırıldı.`
}
