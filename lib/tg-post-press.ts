import 'server-only'
import { randomInt } from 'node:crypto'
import { rows, sql } from '@/lib/db'
import { TelegramError, botToken, callBot } from '@/lib/telegram-mirror'
import type { TgCallback } from '@/lib/tg-hub'
import { countPress, ensurePostTables, explain, getPost, liveSends, markupFor, type SendOutcome } from '@/lib/tg-posts'
import { DEFAULT_ALT, DEFAULT_JOINED, POPUP_LIMIT, escapeText, type PostButton, type RaffleWinner } from '@/lib/tg-posts-shared'

/** Telegram limits how often a message may be edited, so a busy vote redraws its counters at most this often. */
const MARKUP_GAP_SEC = 4
const MAX_WINNERS = 50

type Press = { token: string; q: TgCallback; postId: number | null; button: PostButton }

/** null when Telegram would not say (the bot lacks the rights, or the chat is gone). */
async function isMember(token: string, chatId: number, userId: number) {
  try {
    const m = await callBot<{ status: string; is_member?: boolean }>(token, 'getChatMember', { chat_id: chatId, user_id: userId })
    return ['creator', 'administrator', 'member'].includes(m.status) || (m.status === 'restricted' && m.is_member === true)
  } catch {
    return null
  }
}

/** A channel post shown in its comment group is still the channel's post, so membership is asked of the channel. */
function pressedIn(q: TgCallback) {
  const m = q.message
  if (!m) return null
  return m.is_automatic_forward && m.sender_chat?.type === 'channel' ? m.sender_chat.id : m.chat.id
}

const UNKNOWN_MEMBER = 'Üyeliğin şu an kontrol edilemedi. Biraz sonra tekrar dene.'

export async function handlePress({ token, q, postId, button }: Press) {
  const answer = (text: string, alert = true) =>
    callBot(token, 'answerCallbackQuery', { callback_query_id: q.id, text: text.slice(0, POPUP_LIMIT), show_alert: alert }).catch((error) =>
      console.error('[tg-posts] press answer failed', error),
    )
  const memberHere = async () => {
    const chat = pressedIn(q)
    return chat == null ? null : isMember(token, chat, q.from.id)
  }

  if (button.kind === 'member') {
    const member = await memberHere()
    if (member === null) return answer(UNKNOWN_MEMBER)
    await answer(member ? button.value : button.alt || DEFAULT_ALT)
    if (postId != null) await countPress(postId, button.id).catch(() => null)
    return
  }

  if (postId == null) return answer(button.kind === 'vote' ? 'Bu bir deneme postu. Oylar gerçek postta sayılır.' : 'Bu bir deneme postu. Katılımlar gerçek postta sayılır.')

  if (button.kind === 'vote') {
    // One row per person and post: a second press on another option moves the vote instead of adding one.
    const voted = await rows<{ fresh: boolean }>(sql`INSERT INTO tg_post_votes (post_id, tg_id, button_id) VALUES (${postId}, ${q.from.id}, ${button.id})
      ON CONFLICT (post_id, tg_id) DO UPDATE SET button_id = EXCLUDED.button_id, created_at = now()
      WHERE tg_post_votes.button_id <> EXCLUDED.button_id RETURNING (xmax = 0) AS fresh`)
    if (!voted.length) return answer(`“${button.label}” için zaten oy verdin.`, false)
    await answer(voted[0].fresh ? `Oyun kaydedildi: ${button.label}` : `Oyun değişti: ${button.label}`, false)
    await refreshMarkup(postId)
    return
  }

  if (button.kind === 'raffle') {
    const [state] = await rows<{ raffle_closed: boolean }>(sql`SELECT raffle_closed FROM tg_post_live WHERE post_id = ${postId}`)
    if (state?.raffle_closed) return answer('Bu çekiliş sona erdi.')
    if (button.gate) {
      const member = await memberHere()
      if (member === null) return answer(UNKNOWN_MEMBER)
      if (!member) return answer('Çekilişe katılmak için önce buraya katıl, sonra butona tekrar bas.')
    }
    const name = [q.from.first_name, q.from.last_name].filter(Boolean).join(' ').trim().slice(0, 80) || 'Adsız'
    const joined = await rows(sql`INSERT INTO tg_post_entries (post_id, tg_id, name, username) VALUES (${postId}, ${q.from.id}, ${name}, ${q.from.username ?? null})
      ON CONFLICT DO NOTHING RETURNING tg_id`)
    if (!joined.length) return answer('Zaten katıldın. Bol şans!')
    await answer(button.value || DEFAULT_JOINED)
    await refreshMarkup(postId)
  }
}

// --- Counters on the buttons -----------------------------------------------------

/**
 * Redraws the buttons of every standing copy with the current counts. When the last redraw was moments ago
 * the post is only marked, and the next press or the next tick catches it up.
 */
export async function refreshMarkup(postId: number, force = false) {
  const claimed = await rows(sql`INSERT INTO tg_post_live (post_id) VALUES (${postId})
    ON CONFLICT (post_id) DO UPDATE SET markup_at = now(), dirty = false
    WHERE ${force ? sql`true` : sql`tg_post_live.markup_at < now() - make_interval(secs => ${MARKUP_GAP_SEC})`} RETURNING post_id`)
  const later = () => rows(sql`UPDATE tg_post_live SET dirty = true WHERE post_id = ${postId}`)
  if (!claimed.length) return void (await later())

  const post = await getPost(postId)
  if (!post) return
  const markup = (await markupFor(postId, post.content.buttons)) ?? { inline_keyboard: [] }
  for (const send of await liveSends(postId)) {
    // An album cannot hold buttons, so there is nothing to redraw on it.
    if (send.mainId == null || !send.botId || (send.mainMedia && send.ids.length > 1)) continue
    try {
      await callBot(await botToken(send.botId), 'editMessageReplyMarkup', { chat_id: send.chatId, message_id: send.mainId, reply_markup: markup })
    } catch (error) {
      if (error instanceof TelegramError && error.retryAfter != null) return void (await later())
    }
  }
}

export async function flushMarkups() {
  const waiting = await rows<{ post_id: number }>(sql`SELECT post_id FROM tg_post_live
    WHERE dirty AND markup_at < now() - make_interval(secs => ${MARKUP_GAP_SEC}) ORDER BY markup_at LIMIT 10`)
  for (const w of waiting) await refreshMarkup(Number(w.post_id))
}

// --- Raffle, from the panel ------------------------------------------------------

async function rafflePost(postId: number) {
  await ensurePostTables()
  const post = await getPost(postId)
  if (!post || !post.content.buttons.flat().some((b) => b.kind === 'raffle')) throw new Error('Bu postta çekiliş butonu yok.')
  return post
}

async function setClosed(postId: number, closed: boolean) {
  await rows(sql`INSERT INTO tg_post_live (post_id, raffle_closed) VALUES (${postId}, ${closed})
    ON CONFLICT (post_id) DO UPDATE SET raffle_closed = EXCLUDED.raffle_closed`)
}

export async function setRaffleClosed(postId: number, closed: boolean): Promise<SendOutcome> {
  await rafflePost(postId)
  await setClosed(postId, closed)
  return { ok: true, message: closed ? 'Çekiliş katılıma kapatıldı. Butona basan “çekiliş sona erdi” yazısını görür.' : 'Çekiliş yeniden katılıma açıldı.' }
}

const winnerName = (w: RaffleWinner) => (w.username ? `${w.name} (@${w.username})` : w.name)

/** Picks winners among the entrants who have not won yet and closes the raffle. Asking again draws spares. */
export async function drawRaffle(postId: number, count: number): Promise<SendOutcome> {
  await rafflePost(postId)
  const pool = await rows<{ tg_id: string; name: string; username: string | null }>(sql`SELECT tg_id, name, username FROM tg_post_entries WHERE post_id = ${postId} AND NOT winner ORDER BY tg_id`)
  if (!pool.length) return { ok: false, message: 'Kazanan seçilecek katılımcı yok.' }
  const wanted = Math.min(pool.length, Math.max(1, Math.min(MAX_WINNERS, Math.round(count) || 1)))
  // Partial Fisher–Yates on a cryptographic source: every entrant has the same chance.
  for (let i = 0; i < wanted; i++) {
    const j = i + randomInt(pool.length - i)
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  const winners = pool.slice(0, wanted)
  await rows(sql`UPDATE tg_post_entries SET winner = true WHERE post_id = ${postId} AND tg_id IN ${winners.map((w) => Number(w.tg_id))}`)
  await setClosed(postId, true)
  const names = winners.map((w) => winnerName({ tgId: Number(w.tg_id), name: w.name, username: w.username })).join(', ')
  return { ok: true, message: `${winners.length} kazanan seçildi: ${names}. Çekiliş katılıma kapatıldı.` }
}

/** Writes the winners under the post, as a reply in every chat the post stands in. */
export async function announceRaffle(postId: number): Promise<SendOutcome> {
  await rafflePost(postId)
  const winners = await rows<{ tg_id: string; name: string; username: string | null }>(sql`SELECT tg_id, name, username FROM tg_post_entries WHERE post_id = ${postId} AND winner ORDER BY created_at`)
  if (!winners.length) return { ok: false, message: 'Önce kazanan seç.' }
  const sends = await liveSends(postId)
  if (!sends.length) return { ok: false, message: 'Bu postun Telegram’da duran bir kopyası yok.' }
  const lines = winners.map((w, i) => `${i + 1}. <a href="tg://user?id=${Number(w.tg_id)}">${escapeText(w.name || 'Adsız')}</a>${w.username ? ` (@${escapeText(w.username)})` : ''}`)
  const text = [`<b>Çekiliş sonuçlandı</b>`, '', winners.length > 1 ? 'Kazananlar:' : 'Kazanan:', ...lines].join('\n')
  const failed: string[] = []
  for (const send of sends) {
    try {
      if (!send.botId) throw new Error('Gönderen bot kayıtlı değil')
      await callBot(await botToken(send.botId), 'sendMessage', {
        chat_id: send.chatId,
        text,
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
        ...(send.mainId != null ? { reply_parameters: { message_id: send.mainId, allow_sending_without_reply: true } } : {}),
      })
    } catch (error) {
      failed.push(`${send.chatTitle}: ${explain(error)}`)
    }
  }
  if (failed.length === sends.length) return { ok: false, message: `Duyurulamadı. ${failed.join(' · ')}` }
  return { ok: true, message: `Kazananlar ${sends.length - failed.length} sohbette duyuruldu.${failed.length ? ` ${failed.join(' · ')}` : ''}` }
}
