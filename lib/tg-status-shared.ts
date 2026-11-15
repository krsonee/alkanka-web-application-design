/** Id of the status tab. Its light sums up the other tabs, so the status screen leaves itself out of its own list. */
export const STATUS_TAB = 'status'

/** ok: working · warn: works but needs a look · bad: broken · idle: not in use, which is not a fault. */
export type Health = 'ok' | 'warn' | 'bad' | 'idle'

export type ChatNeed = 'write' | 'delete' | 'restrict' | 'invite'

export const NEED_LABEL: Record<ChatNeed, string> = {
  write: 'mesaj gönderme',
  delete: 'mesaj silme',
  restrict: 'üye engelleme',
  invite: 'davet linkiyle üye ekleme',
}

export type MemberRights = {
  status: string
  can_post_messages?: boolean
  can_send_messages?: boolean
  can_delete_messages?: boolean
  can_restrict_members?: boolean
  can_invite_users?: boolean
}

export type BotHealth = { id: number; username: string; name: string; roles: string[]; state: Health; pending: number; note: string | null }

export type ChatHealth = {
  key: string
  chatId: string
  title: string
  kind: 'channel' | 'group' | 'unknown'
  botUsername: string
  uses: string[]
  state: Health
  /** Rights the bot needs here and does not have, already in words. */
  missing: string[]
  note: string | null
}

export type TgStatus = { checkedAt: string; bots: BotHealth[]; chats: ChatHealth[] }

/** Whether a bot holds the rights its job in this chat needs. */
export function judgeChat(chatType: string, m: MemberRights, needs: ChatNeed[]): { state: 'ok' | 'bad'; missing: ChatNeed[]; note: string | null } {
  if (m.status === 'left' || m.status === 'kicked') return { state: 'bad', missing: needs, note: 'Bot bu sohbette değil. Önce botu ekle.' }
  if (m.status === 'creator') return { state: 'ok', missing: [], note: null }
  const admin = m.status === 'administrator'
  const channel = chatType === 'channel'
  const has: Record<ChatNeed, boolean> = {
    // Telegram leaves `can_post_messages` out for some admins; only an explicit "false" means the right is off.
    write: channel ? admin && m.can_post_messages !== false : m.status !== 'restricted' || m.can_send_messages === true,
    delete: admin && m.can_delete_messages === true,
    restrict: admin && m.can_restrict_members === true,
    invite: admin && m.can_invite_users === true,
  }
  const missing = needs.filter((n) => !has[n])
  if (!missing.length) return { state: 'ok', missing: [], note: null }
  const needsAdmin = channel || needs.some((n) => n !== 'write')
  if (!admin && needsAdmin) return { state: 'bad', missing, note: 'Bot burada yönetici değil.' }
  if (!admin) return { state: 'bad', missing, note: 'Bot bu grupta kısıtlı, yazamıyor.' }
  return { state: 'bad', missing, note: null }
}

const RECENT_ERROR_MS = 15 * 60_000
const BACKLOG = 50

function ago(ms: number) {
  const min = Math.round(ms / 60_000)
  if (min < 60) return `${Math.max(1, min)} dk önce`
  const hours = Math.round(min / 60)
  return hours < 48 ? `${hours} saat önce` : `${Math.round(hours / 24)} gün önce`
}

/**
 * Reads a bot's webhook report. Telegram keeps the last delivery error forever, so an old one is
 * shown as a note; only a fresh error or a missing address counts as broken.
 */
export function judgeBot(input: {
  roles: string[]
  /** True when a job this bot has only works if Telegram can reach the site. */
  listens: boolean
  /** Paths on this site the bot's webhook may point at. */
  ownPaths: string[]
  url: string
  pending: number
  lastError: string | null
  lastErrorAt: number | null
  now: number
}): { state: Health; note: string | null } {
  const { roles, listens, ownPaths, url, pending, lastError, lastErrorAt, now } = input
  if (!roles.length && !url) return { state: 'idle', note: 'Bu bota görev atanmamış.' }
  if (listens) {
    if (!url) return { state: 'bad', note: 'Bildirim adresi kurulu değil, bot hiçbir şeyi duymuyor. Kurulum sekmesinden "Bağla".' }
    let path = ''
    try {
      path = new URL(url).pathname
    } catch {
      path = url
    }
    if (!ownPaths.includes(path)) return { state: 'bad', note: 'Bildirimler başka bir adrese gidiyor. Kurulum sekmesinden yeniden "Bağla".' }
  }
  const fresh = lastError && lastErrorAt != null && now - lastErrorAt < RECENT_ERROR_MS
  if (fresh) return { state: 'bad', note: `Telegram az önce bildirimi teslim edemedi: ${lastError}` }
  if (pending >= BACKLOG) return { state: 'warn', note: `${pending} bildirim sırada bekliyor; site yanıt vermekte gecikiyor olabilir.` }
  if (lastError) return { state: 'ok', note: `Son teslim hatası${lastErrorAt != null ? ` ${ago(now - lastErrorAt)}` : ''}: ${lastError}` }
  return { state: 'ok', note: null }
}

const ORDER: Record<Health, number> = { bad: 0, warn: 1, ok: 2, idle: 3 }

export const byHealth = <T extends { state: Health }>(a: T, b: T) => ORDER[a.state] - ORDER[b.state]
