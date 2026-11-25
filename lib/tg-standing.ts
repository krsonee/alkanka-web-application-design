import 'server-only'
import { rows, sql } from '@/lib/db'
import { TelegramError, botToken, callBot } from '@/lib/telegram-mirror'

/** `unknown`: no bot of ours could ask Telegram, so nothing may be concluded about the person. */
export type Standing = 'in' | 'out' | 'unknown'

/** Telegram's answers when the asking bot cannot see who is in the chat (it is not an administrator there, or not in it at all). */
const BLIND_BOT = /member list is inaccessible|chat not found|bot is not a member|bot was kicked|CHAT_ADMIN_REQUIRED|CHANNEL_PRIVATE|not enough rights/i
/** The bot sees the chat but has never met this account. A bot that has met it gives a real answer. */
const STRANGER = /PARTICIPANT_ID_INVALID|USER_ID_INVALID|user not found|member not found/i

const SEEING_MS = 30 * 60_000
const BLIND_MS = 10 * 60_000
const BOT_LIST_MS = 5 * 60_000

const seeingBot = new Map<string, { at: number; botId: number }>()
const blindBots = new Map<string, Map<number, number>>()
let botList: { at: number; ids: Promise<number[]> } | null = null

function allBotIds() {
  if (!botList || Date.now() - botList.at > BOT_LIST_MS) {
    const ids = rows<{ id: number }>(sql`SELECT id FROM tg_bots ORDER BY id`).then((r) => r.map((b) => Number(b.id)))
    botList = { at: Date.now(), ids }
    ids.catch(() => {
      botList = null
    })
  }
  return botList.ids
}

type Answer = Exclude<Standing, 'unknown'> | 'blind' | 'stranger' | 'failed'

async function ask(botId: number, chatId: string, tgId: number): Promise<Answer> {
  try {
    const member = await callBot<{ status: string; is_member?: boolean }>(await botToken(botId), 'getChatMember', { chat_id: chatId, user_id: tgId })
    if (member.status === 'restricted') return member.is_member === false ? 'out' : 'in'
    return ['left', 'kicked'].includes(member.status) ? 'out' : 'in'
  } catch (error) {
    const said = error instanceof TelegramError ? error.description : ''
    if (BLIND_BOT.test(said)) return 'blind'
    if (STRANGER.test(said)) return 'stranger'
    console.error('[tg-standing] üyelik sorulamadı', chatId, botId, said || error)
    return 'failed'
  }
}

/**
 * Whether a Telegram account is in one of our chats. Only a bot that administers a channel may ask who is
 * in it, and the bot members link their account with is not always that bot: when it cannot see the
 * channel, the question goes to whichever of our other bots can. `fresh` asks again the bots remembered
 * as unable to see, for a person who has just been told to try again.
 */
export async function askStanding(chatId: string, tgId: number, homeBotId: number, fresh = false): Promise<Standing> {
  const now = Date.now()
  const known = seeingBot.get(chatId)
  const blind = blindBots.get(chatId)
  const skipped = (botId: number) => !fresh && now - (blind?.get(botId) ?? 0) < BLIND_MS
  const asked = new Set<number>()
  let reached = false

  const tryBots = async (ids: number[]): Promise<Standing | null> => {
    for (const botId of ids) {
      if (asked.has(botId) || skipped(botId)) continue
      asked.add(botId)
      const answer = await ask(botId, chatId, tgId)
      if (answer === 'in' || answer === 'out') {
        seeingBot.set(chatId, { at: Date.now(), botId })
        return answer
      }
      if (answer === 'failed') return 'unknown'
      if (answer === 'stranger') reached = true
      else blindBots.set(chatId, (blindBots.get(chatId) ?? new Map<number, number>()).set(botId, Date.now()))
    }
    return null
  }

  const first = known && now - known.at < SEEING_MS ? [known.botId, homeBotId] : [homeBotId]
  return (await tryBots(first)) ?? (await tryBots(await allBotIds())) ?? (reached ? 'out' : 'unknown')
}
