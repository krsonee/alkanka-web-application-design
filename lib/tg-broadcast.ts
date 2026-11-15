import 'server-only'
import { rows, sql } from '@/lib/db'
import { TelegramError, botToken, callBot, callBotUpload, normalizeChat } from '@/lib/telegram-mirror'
import { ensureHubTables, getSetting, setSetting } from '@/lib/tg-hub'
import {
  DM_AUDIENCES,
  DM_BUTTON_MAX,
  DM_CAPTION_MAX,
  DM_SCHEDULE_MAX_DAYS,
  DM_TEXT_MAX,
  readReplyButtons,
  type BroadcastRow,
  type DmAudience,
  type DmDraft,
  type DmPanelData,
  type ReplyButton,
} from '@/lib/tg-hub-shared'
import { MEDIA_PATH, localToIso, mediaKindOf } from '@/lib/tg-posts-shared'

const PER_RUN = 900
const DELAY_MS = 40
const RUN_MS = 25_000
/** Longer than one run, so a runner that died mid-way frees the announcement by itself. */
const LEASE_SECONDS = 60
const STOP_CHECK_EVERY = 25
const TEST_CHAT_KEY = 'dm_test_chat'

type Clean = { text: string; photoPath: string | null; buttons: ReplyButton[]; audience: DmAudience; sendAt: string | null }
type Photo = { blob: Blob; name: string }
type Key = { text: string; url?: string; callback_data?: string }

const audienceOf = (value: unknown): DmAudience => DM_AUDIENCES.find((a) => a.value === value)?.value ?? 'all'

/** Evaluated when each slice is sent, so the audience is whoever fits at that moment, not when the text was written. */
function audienceWhere(audience: DmAudience) {
  switch (audience) {
    case 'linked7':
      return sql`AND l.linked_at > now() - interval '7 days'`
    case 'chat7':
      return sql`AND EXISTS (SELECT 1 FROM tg_guard_msgs g WHERE g.tg_id = l.tg_id AND g.created_at > now() - interval '7 days')`
    case 'site7':
      return sql`AND EXISTS (SELECT 1 FROM session s WHERE s."userId" = l.user_id AND s."updatedAt" > now() - interval '7 days')`
    case 'away30':
      return sql`AND NOT EXISTS (SELECT 1 FROM session s WHERE s."userId" = l.user_id AND s."updatedAt" > now() - interval '30 days')`
    default:
      return sql``
  }
}

async function countAudience(audience: DmAudience) {
  const [row] = await rows<{ n: string }>(sql`SELECT count(*) AS n FROM tg_links l WHERE NOT l.dm_off AND NOT l.dm_blocked ${audienceWhere(audience)}`)
  return Number(row?.n ?? 0)
}

function check(input: DmDraft): Clean {
  const text = String(input?.text ?? '').trim()
  const photoPath = input?.photoPath ? String(input.photoPath) : null
  if (photoPath && (!MEDIA_PATH.test(photoPath) || photoPath.includes('..') || mediaKindOf(photoPath) !== 'photo')) throw new Error('Görsel geçersiz. JPG, PNG ya da WEBP yükle.')
  if (text.length < 3) throw new Error('Mesaj çok kısa.')
  const max = photoPath ? DM_CAPTION_MAX : DM_TEXT_MAX
  if (text.length > max) throw new Error(photoPath ? `Görselli duyuruda yazı en fazla ${max} karakter olabilir (Telegram sınırı). Şu an ${text.length}.` : `Mesaj en fazla ${max} karakter olabilir.`)
  const { buttons, problem } = readReplyButtons(input?.buttons, DM_BUTTON_MAX)
  if (problem) throw new Error(problem)

  let sendAt: string | null = null
  if (input?.sendAt) {
    sendAt = localToIso(String(input.sendAt))
    if (!sendAt) throw new Error('Gönderim zamanı okunamadı.')
    const at = Date.parse(sendAt)
    if (at < Date.now() - 60_000) throw new Error('Gönderim zamanı geçmişte. İleri bir saat seç ya da zamanlamayı kapat.')
    if (at > Date.now() + DM_SCHEDULE_MAX_DAYS * 86_400_000) throw new Error(`En fazla ${DM_SCHEDULE_MAX_DAYS} gün sonrasına zamanlanabilir.`)
  }
  return { text, photoPath, buttons, audience: audienceOf(input?.audience), sendAt }
}

function keyboardOf(buttons: ReplyButton[], offData: string): Key[][] {
  return [...buttons.map((b) => [{ text: b.text, url: b.url }]), [{ text: 'Bildirimleri kapat', callback_data: offData }]]
}

/** Announcements queued before buttons became a list carry a single text/link pair. */
function buttonsOf(row: Record<string, unknown>): ReplyButton[] {
  if (row.buttons) {
    try {
      return readReplyButtons(JSON.parse(String(row.buttons)), DM_BUTTON_MAX).buttons
    } catch {
      return []
    }
  }
  return row.button_text && row.button_url ? [{ text: String(row.button_text), url: String(row.button_url) }] : []
}

async function readPhoto(path: string): Promise<Photo> {
  const { readMedia } = await import('@/lib/tg-posts')
  return readMedia({ kind: 'photo', path, name: path.split('/').pop() ?? 'gorsel.jpg', size: 0 })
}

/** Returns Telegram's id for a photo it has just received, so every later recipient gets it without a new upload. */
async function sendOne(token: string, chatId: number | string, msg: { text: string; fileId: string | null; photo: Photo | null }, keyboard: Key[][]) {
  const reply_markup = { inline_keyboard: keyboard }
  if (msg.fileId) {
    await callBot(token, 'sendPhoto', { chat_id: chatId, photo: msg.fileId, caption: msg.text, reply_markup })
    return null
  }
  if (msg.photo) {
    const sent = await callBotUpload<{ photo?: { file_id: string }[] }>(token, 'sendPhoto', { chat_id: chatId, caption: msg.text, reply_markup }, { photo: msg.photo })
    return sent.photo?.at(-1)?.file_id ?? null
  }
  await callBot(token, 'sendMessage', { chat_id: chatId, text: msg.text, reply_markup, link_preview_options: { is_disabled: true } })
  return null
}

async function chatBotToken() {
  const { getChatConfig } = await import('@/lib/telegram-chat')
  const chat = await getChatConfig()
  return chat ? botToken(chat.botId) : null
}

export async function queueBroadcast(input: DmDraft, author: string) {
  await ensureHubTables()
  const d = check(input)
  const total = await countAudience(d.audience)
  // Left in the queue it would wait for the next pass and reach whoever joins the audience in between, after the panel said nobody would get it.
  if (!total && !d.sendAt) return { total, sendAt: null, queued: false }
  await rows(sql`INSERT INTO tg_broadcasts (text, photo_path, buttons, audience, send_at, author, total)
    VALUES (${d.text}, ${d.photoPath}, ${JSON.stringify(d.buttons)}, ${d.audience}, ${d.sendAt}::timestamptz, ${author.slice(0, 80)}, ${total})`)
  return { total, sendAt: d.sendAt, queued: true }
}

/** One copy to a single chat, exactly as members will get it, without queueing anything. */
export async function testBroadcast(input: DmDraft, chatInput: string): Promise<{ ok: boolean; message: string }> {
  await ensureHubTables()
  const d = check({ ...input, sendAt: null })
  const chat = normalizeChat(chatInput)
  if (!chat) return { ok: false, message: 'Deneme için kendi Telegram sayı ID’ni yaz.' }
  const token = await chatBotToken()
  if (!token) return { ok: false, message: 'Canlı Sohbet botu bağlı değil. Duyurular o bottan gider.' }
  await setSetting(TEST_CHAT_KEY, chat)
  try {
    const photo = d.photoPath ? await readPhoto(d.photoPath) : null
    // The trial's own button does nothing: pressing it must not switch announcements off for the admin.
    await sendOne(token, chat, { text: d.text, fileId: null, photo }, keyboardOf(d.buttons, 'dm:test'))
    return { ok: true, message: 'Deneme gönderildi. Telegram’da Canlı Sohbet botuyla olan sohbetine bak.' }
  } catch (error) {
    const tg = error instanceof TelegramError ? error : null
    if (tg && (tg.code === 403 || /chat not found/i.test(tg.description))) {
      return { ok: false, message: 'Bot bu hesaba yazamıyor. Önce Telegram’da Canlı Sohbet botuna /start yaz, sonra tekrar dene.' }
    }
    return { ok: false, message: `Deneme gönderilemedi: ${String((error as Error).message)}` }
  }
}

const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null)

export async function listBroadcasts(limit = 15): Promise<BroadcastRow[]> {
  await ensureHubTables()
  const r = await rows(sql`SELECT id, text, status, sent, failed, blocked, total, created_at, send_at, finished_at, audience, photo_path, buttons,
      button_text, button_url, author, note
    FROM tg_broadcasts ORDER BY id DESC LIMIT ${limit}`)
  return r.map((x) => ({
    id: Number(x.id),
    text: String(x.text),
    status: String(x.status),
    sent: Number(x.sent),
    failed: Number(x.failed),
    blocked: Number(x.blocked ?? 0),
    total: Number(x.total),
    createdAt: new Date(String(x.created_at)).toISOString(),
    sendAt: iso(x.send_at),
    finishedAt: iso(x.finished_at),
    audience: audienceOf(x.audience),
    photoPath: (x.photo_path as string | null) ?? null,
    buttons: buttonsOf(x),
    author: (x.author as string | null) ?? null,
    note: (x.note as string | null) ?? null,
  }))
}

export async function cancelBroadcast(id: number) {
  const r = await rows(sql`UPDATE tg_broadcasts SET status = 'cancelled', finished_at = now() WHERE id = ${id} AND status IN ('queued','sending') RETURNING id`)
  return r.length > 0
}

/** Sends the next slice of the oldest due announcement through the chat bot (members pressed Start there). */
export async function processBroadcasts() {
  await ensureHubTables()
  // The lease keeps a second runner (the panel's immediate send beside the background tick) from mailing the same slice twice.
  const [job] = await rows(sql`UPDATE tg_broadcasts SET lease_until = now() + make_interval(secs => ${LEASE_SECONDS})
    WHERE id = (SELECT id FROM tg_broadcasts
        WHERE status IN ('queued','sending') AND (send_at IS NULL OR send_at <= now()) AND (lease_until IS NULL OR lease_until < now())
        ORDER BY id LIMIT 1)
      AND (lease_until IS NULL OR lease_until < now())
    RETURNING *`)
  if (!job) return
  const id = Number(job.id)
  const free = () => rows(sql`UPDATE tg_broadcasts SET lease_until = NULL WHERE id = ${id}`).catch(() => null)
  const token = await chatBotToken().catch(() => null)
  if (!token) return free()

  const audience = audienceOf(job.audience)
  if (job.status === 'queued') {
    const total = await countAudience(audience)
    const begun = await rows(sql`UPDATE tg_broadcasts SET status = 'sending', total = ${total} WHERE id = ${id} AND status = 'queued' RETURNING id`)
    // Stopped from the panel in the moment between picking it up and starting.
    if (!begun.length) return free()
  }

  let fileId = (job.photo_file_id as string | null) ?? null
  let photo: Photo | null = null
  if (job.photo_path && !fileId) {
    try {
      photo = await readPhoto(String(job.photo_path))
    } catch (error) {
      // Without its picture the announcement would go out as something the admin never approved.
      await rows(sql`UPDATE tg_broadcasts SET status = 'cancelled', finished_at = now(), lease_until = NULL,
        note = ${`Görsel okunamadı, duyuru durduruldu: ${String((error as Error).message).slice(0, 200)}`} WHERE id = ${id}`)
      return
    }
  }

  const people = await rows<{ tg_id: string }>(sql`SELECT l.tg_id FROM tg_links l
    WHERE NOT l.dm_off AND NOT l.dm_blocked AND l.tg_id > ${job.cursor} ${audienceWhere(audience)} ORDER BY l.tg_id LIMIT ${PER_RUN}`)
  const keyboard = keyboardOf(buttonsOf(job), 'dm:off')
  let sent = 0
  let failed = 0
  let blocked = 0
  let cursor = Number(job.cursor)
  let reached = 0
  const started = Date.now()
  for (const [i, p] of people.entries()) {
    if (Date.now() - started > RUN_MS) break
    if (i > 0 && i % STOP_CHECK_EVERY === 0) {
      const [now] = await rows<{ status: string }>(sql`SELECT status FROM tg_broadcasts WHERE id = ${id}`)
      if (now?.status !== 'sending') break
    }
    const tgId = Number(p.tg_id)
    try {
      const got = await sendOne(token, tgId, { text: String(job.text), fileId, photo }, keyboard)
      if (got) {
        fileId = got
        photo = null
        await rows(sql`UPDATE tg_broadcasts SET photo_file_id = ${got} WHERE id = ${id}`).catch(() => null)
      }
      sent++
    } catch (error) {
      const tg = error instanceof TelegramError ? error : null
      // Still rate-limited after callBot's own short waits: stop before moving the cursor so this member is retried next run.
      if (tg?.code === 429) break
      if (tg && (tg.code === 403 || /chat not found|user is deactivated/i.test(tg.description))) {
        blocked++
        await rows(sql`UPDATE tg_links SET dm_blocked = true WHERE tg_id = ${tgId}`).catch(() => null)
      } else failed++
    }
    cursor = tgId
    reached++
    await new Promise((r) => setTimeout(r, DELAY_MS))
  }
  const done = people.length < PER_RUN && reached === people.length
  await rows(sql`UPDATE tg_broadcasts SET sent = sent + ${sent}, failed = failed + ${failed}, blocked = blocked + ${blocked}, cursor = ${cursor}, lease_until = NULL,
    finished_at = CASE WHEN status = 'sending' AND ${done} THEN now() ELSE finished_at END,
    status = CASE WHEN status = 'sending' AND ${done} THEN 'done' ELSE status END
    WHERE id = ${id}`)
}

export async function loadDmPanel(): Promise<DmPanelData> {
  await ensureHubTables()
  const [broadcasts, [counts], testChat, token] = await Promise.all([
    listBroadcasts(15),
    rows<Record<DmAudience, string>>(sql`SELECT count(*) AS "all",
        count(*) FILTER (WHERE true ${audienceWhere('linked7')}) AS linked7,
        count(*) FILTER (WHERE true ${audienceWhere('chat7')}) AS chat7,
        count(*) FILTER (WHERE true ${audienceWhere('site7')}) AS site7,
        count(*) FILTER (WHERE true ${audienceWhere('away30')}) AS away30
      FROM tg_links l WHERE NOT l.dm_off AND NOT l.dm_blocked`),
    getSetting(TEST_CHAT_KEY).catch(() => null),
    chatBotToken().catch(() => null),
  ])
  const audiences = Object.fromEntries(DM_AUDIENCES.map((a) => [a.value, Number(counts?.[a.value] ?? 0)])) as Record<DmAudience, number>
  return { broadcasts, audiences, testChat: testChat ?? '', botReady: Boolean(token) }
}
