import 'server-only'
import { rows, sql } from '@/lib/db'
import { botToken, callBot, ensureTables, normalizeChat } from '@/lib/telegram-mirror'
import { FILTER_PRESETS } from '@/lib/telegram-filters'
import type { TgMessage, TgUpdate } from '@/lib/telegram-chat'

export type ApprovalKind = 'market' | 'task' | 'complaint'

export type BotSuite = {
  siteOrigin: string
  share: {
    enabled: boolean
    botId: number | null
    sourceChat: string
    sourceTitle: string
    trigger: string
    appendText: string
    replyText: string
    targetIds: number[]
  }
  odds: { note: string; winText: string; targetIds: number[] }
  approvals: { enabled: boolean; botId: number | null; chatId: string; chatTitle: string; templates: Record<ApprovalKind, string> }
}

export type ShareStatus = { lastError: string | null; lastRunAt: string | null; shared: number }

export type OddsDeal = { id: number; brand: string; title: string; link: string; createdAt: string; result: 'won' | 'lost' | null }

export const APPROVAL_LABELS: Record<ApprovalKind, string> = {
  market: 'Market talebi',
  task: 'Görev onayı',
  complaint: 'Şikâyet',
}

export const DEFAULT_SUITE: BotSuite = {
  siteOrigin: '',
  share: {
    enabled: false,
    botId: null,
    sourceChat: '',
    sourceTitle: '',
    trigger: '#paylaş',
    appendText: 'Güncel giriş ve bonuslar: alkanka.com',
    replyText: 'Paylaşıldı:',
    targetIds: [],
  },
  odds: {
    note: '',
    winText: 'ÖZEL ORAN KAZANDI\n\n{marka}: {baslik}\n\n{link}',
    targetIds: [],
  },
  approvals: {
    enabled: false,
    botId: null,
    chatId: '',
    chatTitle: '',
    templates: {
      market: 'Yeni market talebi\nÜye: {uye}\nÜrün: {detay}\nTarih: {tarih}\nOnay için: {panel}',
      task: 'Görev onay bekliyor\nÜye: {uye}\nGörev: {detay}\nTarih: {tarih}\nOnay için: {panel}',
      complaint: 'Yeni şikâyet\nÜye: {uye}\nKonu: {detay}\nTarih: {tarih}\nİncelemek için: {panel}',
    },
  },
}

const SUITE_KEY = 'bot_suite'
const CAPTION_LIMIT = 1024
const MESSAGE_LIMIT = 4096
const NOTIFY_TIMEOUT_MS = 6000

let ready: Promise<void> | null = null
function ensureSuiteTables() {
  ready ??= (async () => {
    await ensureTables()
    await rows(sql`CREATE TABLE IF NOT EXISTS tg_share_log (
      id serial PRIMARY KEY, chat_id text NOT NULL, message_id bigint NOT NULL, status text NOT NULL, detail text,
      created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (chat_id, message_id))`)
    await rows(sql`ALTER TABLE deals ADD COLUMN IF NOT EXISTS result text`)
    await rows(sql`ALTER TABLE deals ADD COLUMN IF NOT EXISTS result_at timestamptz`)
  })().catch((error) => {
    ready = null
    throw error
  })
  return ready
}

const ids = (v: unknown) => (Array.isArray(v) ? v.map(Number).filter((n) => Number.isInteger(n) && n > 0) : [])
const str = (v: unknown, fallback: string) => (typeof v === 'string' ? v : fallback)
const num = (v: unknown) => (Number.isInteger(Number(v)) && Number(v) > 0 ? Number(v) : null)

function parseSuite(raw: string | undefined): BotSuite {
  let data: Record<string, any> = {}
  try {
    data = raw ? JSON.parse(raw) : {}
  } catch {
    data = {}
  }
  const d = DEFAULT_SUITE
  const s = data.share ?? {}
  const o = data.odds ?? {}
  const a = data.approvals ?? {}
  const t = a.templates ?? {}
  return {
    siteOrigin: str(data.siteOrigin, ''),
    share: {
      enabled: Boolean(s.enabled),
      botId: num(s.botId),
      sourceChat: str(s.sourceChat, ''),
      sourceTitle: str(s.sourceTitle, ''),
      trigger: str(s.trigger, d.share.trigger),
      appendText: str(s.appendText, d.share.appendText),
      replyText: str(s.replyText, d.share.replyText),
      targetIds: ids(s.targetIds),
    },
    odds: { note: str(o.note, ''), winText: str(o.winText, d.odds.winText), targetIds: ids(o.targetIds) },
    approvals: {
      enabled: Boolean(a.enabled),
      botId: num(a.botId),
      chatId: str(a.chatId, ''),
      chatTitle: str(a.chatTitle, ''),
      templates: {
        market: str(t.market, d.approvals.templates.market),
        task: str(t.task, d.approvals.templates.task),
        complaint: str(t.complaint, d.approvals.templates.complaint),
      },
    },
  }
}

async function getSetting(key: string) {
  const r = await rows<{ value: string }>(sql`SELECT value FROM tg_settings WHERE key = ${key}`)
  return r[0]?.value
}

async function setSetting(key: string, value: string) {
  await rows(sql`INSERT INTO tg_settings (key, value) VALUES (${key}, ${value}) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`)
}

export async function getBotSuite(): Promise<BotSuite> {
  await ensureSuiteTables()
  return parseSuite(await getSetting(SUITE_KEY))
}

async function saveSuite(suite: BotSuite) {
  await setSetting(SUITE_KEY, JSON.stringify(suite))
}

async function resolveChat(botId: number, chatInput: string) {
  const chat = normalizeChat(chatInput)
  if (!chat) throw new Error('Grup geçersiz. Örnek: @grupadi ya da -1001234567890')
  const token = await botToken(botId)
  const info = await callBot<{ id: number; title?: string; username?: string }>(token, 'getChat', { chat_id: chat })
  const member = await callBot<{ status: string }>(token, 'getChatMember', { chat_id: info.id, user_id: Number(token.split(':')[0]) })
  if (!['administrator', 'creator', 'member'].includes(member.status)) throw new Error('Bot bu grupta değil. Önce botu gruba ekle')
  return { id: String(info.id), title: info.title ?? (info.username ? `@${info.username}` : String(info.id)), isAdmin: member.status === 'administrator' || member.status === 'creator' }
}

async function validTargetIds(input: number[]) {
  if (!input.length) return []
  const r = await rows<{ id: number }>(sql`SELECT id FROM tg_targets WHERE id IN ${input}`)
  const known = new Set(r.map((t) => Number(t.id)))
  return input.filter((id) => known.has(id))
}

export async function saveShareSettings(input: {
  enabled: boolean
  botId: number | null
  sourceChat: string
  trigger: string
  appendText: string
  replyText: string
  targetIds: number[]
  siteOrigin: string
}) {
  const suite = await getBotSuite()
  let sourceChat = suite.share.sourceChat
  let sourceTitle = suite.share.sourceTitle
  if (input.enabled) {
    if (!input.botId) throw new Error('Paylaşım botunu seç')
    if (!input.sourceChat.trim()) throw new Error('Sponsor destek grubunu yaz')
    const targets = await validTargetIds(input.targetIds)
    if (!targets.length) throw new Error('En az bir hedef kanal seç')
    const chat = await resolveChat(input.botId, input.sourceChat)
    if (!chat.isAdmin) {
      const me = await callBot<{ can_read_all_group_messages?: boolean }>(await botToken(input.botId), 'getMe')
      if (!me.can_read_all_group_messages) throw new Error('Bot gruptaki mesajları okuyamıyor. Botu grupta yönetici yap ya da BotFather’da /setprivacy → Disable yap')
    }
    sourceChat = chat.id
    sourceTitle = chat.title
    input.targetIds = targets
  }
  suite.siteOrigin = input.siteOrigin || suite.siteOrigin
  suite.share = {
    enabled: input.enabled,
    botId: input.botId,
    sourceChat,
    sourceTitle,
    trigger: input.trigger.trim().slice(0, 40),
    appendText: input.appendText.trim().slice(0, 600),
    replyText: input.replyText.trim().slice(0, 200) || DEFAULT_SUITE.share.replyText,
    targetIds: input.targetIds,
  }
  await saveSuite(suite)
  if (input.enabled) await setSetting('share_last_error', '')
  return sourceTitle
}

export async function saveOddsSettings(input: { note: string; winText: string; targetIds: number[] }) {
  const suite = await getBotSuite()
  suite.odds = {
    note: input.note.trim().slice(0, 300),
    winText: input.winText.trim().slice(0, 1000) || DEFAULT_SUITE.odds.winText,
    targetIds: await validTargetIds(input.targetIds),
  }
  await saveSuite(suite)
}

export async function saveApprovalSettings(input: {
  enabled: boolean
  botId: number | null
  chatId: string
  templates: Record<ApprovalKind, string>
  siteOrigin: string
}) {
  const suite = await getBotSuite()
  let chatId = suite.approvals.chatId
  let chatTitle = suite.approvals.chatTitle
  if (input.enabled) {
    if (!input.botId) throw new Error('Bildirim botunu seç')
    if (!input.chatId.trim()) throw new Error('Onay grubunu yaz')
    const chat = await resolveChat(input.botId, input.chatId)
    chatId = chat.id
    chatTitle = chat.title
  }
  suite.siteOrigin = input.siteOrigin || suite.siteOrigin
  suite.approvals = {
    enabled: input.enabled,
    botId: input.botId,
    chatId,
    chatTitle,
    templates: {
      market: input.templates.market.trim().slice(0, 1000) || DEFAULT_SUITE.approvals.templates.market,
      task: input.templates.task.trim().slice(0, 1000) || DEFAULT_SUITE.approvals.templates.task,
      complaint: input.templates.complaint.trim().slice(0, 1000) || DEFAULT_SUITE.approvals.templates.complaint,
    },
  }
  await saveSuite(suite)
  return chatTitle
}

// --- Shared helpers --------------------------------------------------------

type TargetRow = { id: number; chat_id: string; title: string; bot_id: number }

async function targetsFor(targetIds: number[], fallbackAll: boolean) {
  const r = targetIds.length
    ? await rows<TargetRow>(sql`SELECT id, chat_id, title, bot_id FROM tg_targets WHERE active AND id IN ${targetIds} ORDER BY id`)
    : fallbackAll
      ? await rows<TargetRow>(sql`SELECT id, chat_id, title, bot_id FROM tg_targets WHERE active ORDER BY id`)
      : []
  const list: { id: number; chatId: string; title: string; token: string }[] = []
  for (const t of r) {
    try {
      list.push({ id: Number(t.id), chatId: String(t.chat_id), title: String(t.title), token: await botToken(Number(t.bot_id)) })
    } catch {
      // Token encrypted with an older secret; the panel already asks to re-add that bot.
    }
  }
  return list
}

function fill(template: string, vars: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => (key in vars ? vars[key] : whole))
}

function postLink(chat: { id: number | string; username?: string }, messageId: number) {
  if (chat.username) return `https://t.me/${chat.username}/${messageId}`
  const id = String(chat.id)
  return id.startsWith('-100') ? `https://t.me/c/${id.slice(4)}/${messageId}` : null
}

export function isOddsText(text: string) {
  const words = FILTER_PRESETS.find((p) => p.id === 'oran')?.words ?? []
  const lower = text.toLocaleLowerCase('tr')
  return words.some((w) => lower.includes(w))
}

/** Note appended to mirrored special-odds posts. Empty when not set. */
export async function oddsMirrorExtras() {
  const suite = await getBotSuite().catch(() => null)
  return { note: suite?.odds.note ?? '', targetIds: suite?.odds.targetIds ?? [] }
}

// --- 32. Post sharing bot --------------------------------------------------

const MEDIA_KEYS = ['photo', 'video', 'document', 'animation', 'audio', 'voice', 'video_note', 'sticker'] as const

function hasMedia(m: TgMessage) {
  const record = m as unknown as Record<string, unknown>
  return MEDIA_KEYS.some((k) => record[k] != null)
}

function stripTrigger(text: string, trigger: string) {
  if (!trigger) return text.trim()
  const escaped = trigger.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return text.replace(new RegExp(escaped, 'giu'), '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
}

function withAppend(body: string, append: string, limit: number) {
  const tail = append ? `\n\n${append}` : ''
  const room = limit - tail.length
  const trimmed = body.length > room ? `${body.slice(0, Math.max(0, room - 1)).trimEnd()}…` : body
  return `${trimmed}${tail}`.trim()
}

/**
 * Handles a message from the sponsor support group. Returns true when the
 * message belonged to that group so other handlers can skip it.
 */
export async function handleShareMessage(m: TgMessage, viaBotId: number): Promise<boolean> {
  const suite = await getBotSuite()
  const share = suite.share
  if (!share.enabled || share.botId !== viaBotId || !share.sourceChat || String(m.chat.id) !== share.sourceChat) return false
  if (m.from?.is_bot && m.from.username !== 'GroupAnonymousBot') return true

  const raw = m.text ?? m.caption ?? ''
  if (share.trigger && !raw.toLocaleLowerCase('tr').includes(share.trigger.toLocaleLowerCase('tr'))) return true
  const body = stripTrigger(raw, share.trigger)
  const media = hasMedia(m)
  if (!media && !body) return true

  const claimed = await rows<{ id: number }>(sql`INSERT INTO tg_share_log (chat_id, message_id, status)
    VALUES (${share.sourceChat}, ${m.message_id}, 'pending') ON CONFLICT (chat_id, message_id) DO NOTHING RETURNING id`)
  if (!claimed.length) return true

  const targets = await targetsFor(share.targetIds, false)
  const links: string[] = []
  const failures: string[] = []
  const sourceToken = await botToken(viaBotId)

  for (const target of targets) {
    try {
      let sentId: number
      if (media) {
        // copyMessage only works with the bot that can see the source, so the share bot must also be admin in every target.
        try {
          const res = await callBot<{ message_id: number }>(sourceToken, 'copyMessage', {
            chat_id: target.chatId,
            from_chat_id: m.chat.id,
            message_id: m.message_id,
            caption: withAppend(body, share.appendText, CAPTION_LIMIT),
          })
          sentId = res.message_id
        } catch (error) {
          if (!/caption|can't be edited|message can't be copied/i.test(String((error as Error).message))) throw error
          const res = await callBot<{ message_id: number }>(sourceToken, 'copyMessage', {
            chat_id: target.chatId,
            from_chat_id: m.chat.id,
            message_id: m.message_id,
          })
          sentId = res.message_id
          if (share.appendText) await callBot(sourceToken, 'sendMessage', { chat_id: target.chatId, text: share.appendText })
        }
      } else {
        const res = await callBot<{ message_id: number }>(sourceToken, 'sendMessage', {
          chat_id: target.chatId,
          text: withAppend(body, share.appendText, MESSAGE_LIMIT),
        })
        sentId = res.message_id
      }
      const info = await callBot<{ id: number; username?: string }>(sourceToken, 'getChat', { chat_id: target.chatId }).catch(() => ({ id: Number(target.chatId) }))
      const link = postLink(info, sentId)
      links.push(link ? `${target.title}: ${link}` : target.title)
    } catch (error) {
      failures.push(`${target.title}: ${String((error as Error).message)}`)
    }
  }

  const status = links.length ? 'sent' : 'failed'
  const detail = failures.length ? failures.join(' | ').slice(0, 300) : null
  await rows(sql`UPDATE tg_share_log SET status = ${status}, detail = ${detail} WHERE id = ${claimed[0].id}`)

  const replyText = links.length ? `${share.replyText}\n${links.join('\n')}` : `Paylaşılamadı. ${detail ?? 'Hedef kanal yok'}`
  await callBot(sourceToken, 'sendMessage', {
    chat_id: m.chat.id,
    text: replyText.slice(0, MESSAGE_LIMIT),
    reply_parameters: { message_id: m.message_id, allow_sending_without_reply: true },
    link_preview_options: { is_disabled: true },
  }).catch((error) => console.error('[share-bot] reply failed', error))
  return true
}

/** Polls updates for a share bot that is not the webhook-connected chat bot. */
export async function pollShareBot(): Promise<{ handled: number; error: string | null }> {
  const suite = await getBotSuite()
  const share = suite.share
  if (!share.enabled || !share.botId) return { handled: 0, error: null }
  const { getChatConfig } = await import('@/lib/telegram-chat')
  const chat = await getChatConfig().catch(() => null)
  if (chat?.botId === share.botId) return { handled: 0, error: null }
  // A bot that already has a Telegram Merkezi webhook receives source posts there instead of polling.
  const { hasHook } = await import('@/lib/tg-hub')
  if (await hasHook(share.botId)) return { handled: 0, error: null }

  let handled = 0
  try {
    const token = await botToken(share.botId)
    const offset = Number((await getSetting('share_offset')) ?? 0)
    const updates = await callBot<TgUpdate[]>(token, 'getUpdates', { offset: offset || undefined, limit: 50, timeout: 0, allowed_updates: ['message'] })
    for (const update of updates) {
      if (update.message) {
        try {
          if (await handleShareMessage(update.message, share.botId)) handled++
        } catch (error) {
          console.error('[share-bot] message failed', error)
        }
      }
      await setSetting('share_offset', String(update.update_id + 1))
    }
    await setSetting('share_last_error', '')
    await setSetting('share_last_run', new Date().toISOString())
    return { handled, error: null }
  } catch (error) {
    let message = String((error as Error).message)
    if (/conflict|webhook/i.test(message)) message = 'Bu botta webhook açık. Paylaşım için canlı sohbet botunu seç ya da farklı bir bot kullan'
    await setSetting('share_last_error', message.slice(0, 300))
    await setSetting('share_last_run', new Date().toISOString())
    return { handled, error: message }
  }
}

export async function shareStatus(): Promise<ShareStatus> {
  await ensureSuiteTables()
  const [err, run, count] = await Promise.all([
    getSetting('share_last_error'),
    getSetting('share_last_run'),
    rows<{ c: string }>(sql`SELECT count(*) AS c FROM tg_share_log WHERE status = 'sent'`),
  ])
  return { lastError: err || null, lastRunAt: run || null, shared: Number(count[0]?.c ?? 0) }
}

// --- 33. Special odds results ----------------------------------------------

export async function listOddsDeals(limit = 30): Promise<OddsDeal[]> {
  await ensureSuiteTables()
  const r = await rows(sql`SELECT id, brand, title, link, created_at, result FROM deals WHERE kind = 'oran' ORDER BY created_at DESC LIMIT ${limit}`)
  return r.map((d) => ({
    id: Number(d.id),
    brand: String(d.brand),
    title: String(d.title),
    link: String(d.link),
    createdAt: new Date(String(d.created_at)).toISOString(),
    result: d.result === 'won' || d.result === 'lost' ? d.result : null,
  }))
}

export async function setOddsResult(dealId: number, result: 'won' | 'lost' | null) {
  await ensureSuiteTables()
  const before = await rows<{ result: string | null; brand: string; title: string; link: string }>(
    sql`SELECT result, brand, title, link FROM deals WHERE id = ${dealId} AND kind = 'oran'`,
  )
  if (!before.length) throw new Error('Özel oran bulunamadı')
  await rows(sql`UPDATE deals SET result = ${result}, result_at = ${result ? new Date().toISOString() : null} WHERE id = ${dealId}`)
  if (result !== 'won' || before[0].result === 'won') return { posted: 0 }

  const suite = await getBotSuite()
  const text = fill(suite.odds.winText, { marka: before[0].brand, baslik: before[0].title, link: before[0].link })
  const targets = await targetsFor(suite.odds.targetIds, true)
  let posted = 0
  const failures: string[] = []
  for (const t of targets) {
    try {
      await callBot(t.token, 'sendMessage', { chat_id: t.chatId, text: text.slice(0, MESSAGE_LIMIT) })
      posted++
    } catch (error) {
      failures.push(`${t.title}: ${String((error as Error).message)}`)
    }
  }
  if (!posted && targets.length) throw new Error(`Sonuç kaydedildi ama mesaj gönderilemedi. ${failures.join(' | ')}`)
  return { posted }
}

/** Champion podium announcement: goes to every active channel/group the panel has connected. */
export async function broadcastPodium(build: (origin: string) => string) {
  await ensureSuiteTables()
  const suite = await getBotSuite()
  const text = build(suite.siteOrigin || '').slice(0, MESSAGE_LIMIT)
  let posted = 0
  for (const t of await targetsFor([], true)) {
    try {
      await callBot(t.token, 'sendMessage', { chat_id: t.chatId, text, disable_web_page_preview: true })
      posted++
    } catch (error) {
      console.error('[kursu] paylaşılamadı', t.title, (error as Error).message)
    }
  }
  return posted
}

// --- 34. Approval notifier -------------------------------------------------

async function sendApproval(kind: ApprovalKind, vars: { uye: string; detay: string }) {
  const suite = await getBotSuite()
  const a = suite.approvals
  if (!a.enabled || !a.botId || !a.chatId) return
  const token = await botToken(a.botId)
  const text = fill(a.templates[kind], {
    ...vars,
    tur: APPROVAL_LABELS[kind],
    tarih: new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' }),
    panel: suite.siteOrigin ? `${suite.siteOrigin}/panel` : '/panel',
  })
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: a.chatId, text: text.slice(0, MESSAGE_LIMIT), link_preview_options: { is_disabled: true } }),
    signal: AbortSignal.timeout(NOTIFY_TIMEOUT_MS),
  })
  if (!res.ok) console.error('[approval-bot] send failed', res.status, await res.text().catch(() => ''))
}

/** Never throws: a Telegram outage must not break the member's purchase or claim. */
export async function notifyApproval(kind: ApprovalKind, vars: { uye: string; detay: string }) {
  const run = () => sendApproval(kind, vars).catch((error) => console.error('[approval-bot]', error))
  try {
    const { after } = await import('next/server')
    after(run)
  } catch {
    await run()
  }
}

export async function testApproval() {
  const suite = await getBotSuite()
  if (!suite.approvals.enabled) throw new Error('Önce bildirimleri açıp kaydet')
  await sendApproval('market', { uye: 'Test Üye', detay: 'Test ürünü' })
}
