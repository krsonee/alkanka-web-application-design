import 'server-only'
import { rows, sql } from '@/lib/db'
import { ensureChatTables, getChatConfig } from '@/lib/telegram-chat'
import { botToken } from '@/lib/telegram-mirror'

/** The site chat shows this many messages; older ones are out of sight and are left alone. */
const ON_SCREEN = 50
/** The newest messages are asked about on every pass; that is where deletions happen. */
const FRESH = 8
/** Older messages on screen take turns, the one asked about longest ago first. */
const TURNS = 12
const AT_ONCE = 5
const ANSWER_WITHIN_MS = 6_000

type Fate = 'there' | 'gone' | 'unknown' | 'busy'

/**
 * Telegram tells a bot nothing when a message is deleted, by its author or by a moderator. So the bot
 * asks: clearing its own reaction changes nothing on a message that is there, and is refused in
 * these words on one that is not. Any other answer leaves the site copy alone.
 */
const GONE = /message to react not found|message not found|MESSAGE_ID_INVALID/i

async function fateOf(token: string, chatId: string, messageId: number): Promise<{ fate: Fate; said: string }> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/setMessageReaction`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, message_id: messageId, reaction: [] }),
      signal: AbortSignal.timeout(ANSWER_WITHIN_MS),
    })
    if (res.status === 429) return { fate: 'busy', said: '' }
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; description?: string }
    if (data.ok) return { fate: 'there', said: '' }
    const said = String(data.description ?? `HTTP ${res.status}`)
    return { fate: res.status === 400 && GONE.test(said) ? 'gone' : 'unknown', said }
  } catch {
    return { fate: 'unknown', said: '' }
  }
}

type Shown = { id: number; tg_message_id: string | null; checked_at: string | null }

const askedAt = (m: Shown) => (m.checked_at ? new Date(m.checked_at).getTime() : 0)

/**
 * Removes from the site chat what is no longer in the Telegram group. Works for messages written in
 * Telegram and for site messages the bot carried over, whoever deleted them there.
 */
export async function syncChatWithTelegram(): Promise<{ asked: number; removed: number }> {
  const config = await getChatConfig()
  if (!config) return { asked: 0, removed: 0 }
  await ensureChatTables()
  const shown = await rows<Shown>(sql`SELECT id, tg_message_id, checked_at FROM tg_chat_messages
    WHERE chat_id = ${config.chatId} ORDER BY id DESC LIMIT ${ON_SCREEN}`)
  const mirrored = shown.filter((m) => m.tg_message_id)
  const fresh = mirrored.slice(0, FRESH)
  const turns = mirrored
    .slice(FRESH)
    .sort((a, b) => askedAt(a) - askedAt(b) || b.id - a.id)
    .slice(0, TURNS)
  const picked = [...fresh, ...turns]
  if (!picked.length) return { asked: 0, removed: 0 }

  const token = await botToken(config.botId)
  const kept: number[] = []
  const gone: Shown[] = []
  const odd = new Set<string>()
  for (let i = 0; i < picked.length; i += AT_ONCE) {
    const batch = picked.slice(i, i + AT_ONCE)
    const answers = await Promise.all(batch.map((m) => fateOf(token, config.chatId, Number(m.tg_message_id))))
    answers.forEach(({ fate, said }, n) => {
      if (fate === 'gone') gone.push(batch[n])
      else if (fate !== 'busy') kept.push(batch[n].id)
      if (fate === 'unknown' && said) odd.add(said)
    })
    // Telegram asked for a pause: the rest waits for the next pass.
    if (answers.some((a) => a.fate === 'busy')) break
  }
  // An answer this code does not know keeps the message, and is written down so it can be learned from.
  if (odd.size) console.warn('[chat-sync] beklenmeyen cevap', [...odd].slice(0, 3))

  if (gone.length) {
    const tgIds = gone.map((m) => Number(m.tg_message_id))
    // Recorded as removed first, so a late copy of the same message is not written back.
    await rows(sql`INSERT INTO tg_site_removed (chat_id, tg_message_id)
      SELECT ${config.chatId}, unnest(${`{${tgIds.join(',')}}`}::bigint[]) ON CONFLICT DO NOTHING`)
    await rows(sql`DELETE FROM tg_chat_messages WHERE id IN ${gone.map((m) => m.id)}`)
    const { chatFeedChanged } = await import('@/lib/chat-feed-read')
    chatFeedChanged()
  }
  if (kept.length) await rows(sql`UPDATE tg_chat_messages SET checked_at = now() WHERE id IN ${kept}`)
  return { asked: kept.length + gone.length, removed: gone.length }
}
