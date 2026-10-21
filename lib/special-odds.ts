import 'server-only'
import { randomBytes, timingSafeEqual } from 'node:crypto'
import { rows, sql } from '@/lib/db'
import { botToken, callBot, ensureTables, fetchChannel, normalizeChat, stripTags } from '@/lib/telegram-mirror'
import { parseOddsPost } from '@/lib/odds-parse'
import { isOddsText } from '@/lib/telegram-bots'
import type { TgMessage } from '@/lib/telegram-chat'
import {
  DEFAULT_ODDS_BOT,
  istanbulDay,
  splitWords,
  type OddResult,
  type OddsBotConfig,
  type OddsBotStatus,
  type OddsDayStats,
  type OddsPreview,
  type OddsSource,
  type SpecialOdd,
} from '@/lib/special-odds-shared'

type OddsUpdate = { update_id: number; message?: TgMessage; channel_post?: TgMessage; edited_channel_post?: TgMessage; edited_message?: TgMessage }

const CONFIG_KEY = 'odds_bot'
const SECRET_KEY = 'odds_bot_secret'
const LAST_UPDATE_KEY = 'odds_bot_last_update'
const OFFSET_KEY = 'odds_bot_offset'
const CAPTION_LIMIT = 1024
const MESSAGE_LIMIT = 4096
const RESULT_LOOKBACK_HOURS = 48

let ready: Promise<void> | null = null
function ensureOddsTables() {
  ready ??= (async () => {
    await ensureTables()
    await rows(sql`CREATE TABLE IF NOT EXISTS odds_sources (
      id serial PRIMARY KEY, chat_id text NOT NULL UNIQUE, title text NOT NULL, site_name text NOT NULL, site_link text NOT NULL,
      site_logo text, active boolean NOT NULL DEFAULT true, last_at timestamptz, created_at timestamptz NOT NULL DEFAULT now())`)
    await rows(sql`CREATE TABLE IF NOT EXISTS special_odds (
      id serial PRIMARY KEY, source_id int REFERENCES odds_sources(id) ON DELETE SET NULL, source_chat text NOT NULL, source_msg bigint NOT NULL,
      idx int NOT NULL DEFAULT 0, our_msg bigint, site_name text NOT NULL, site_logo text, link text NOT NULL,
      match text NOT NULL, league text NOT NULL DEFAULT '', market text NOT NULL DEFAULT '', old_odd numeric, new_odd numeric,
      kickoff text NOT NULL DEFAULT '', limit_text text NOT NULL DEFAULT '', body text NOT NULL, photo text,
      status text NOT NULL DEFAULT 'open', result text, opened_at timestamptz NOT NULL DEFAULT now(), filled_at timestamptz, result_at timestamptz,
      UNIQUE (source_chat, source_msg, idx))`)
    await rows(sql`CREATE INDEX IF NOT EXISTS special_odds_opened_idx ON special_odds (opened_at DESC)`)
    await rows(sql`ALTER TABLE odds_sources ADD COLUMN IF NOT EXISTS username text`)
    await rows(sql`ALTER TABLE odds_sources ADD COLUMN IF NOT EXISTS web_last bigint`)
    await rows(sql`ALTER TABLE odds_sources ADD COLUMN IF NOT EXISTS web_error text`)
  })().catch((error) => {
    ready = null
    throw error
  })
  return ready
}

async function getSetting(key: string) {
  const r = await rows<{ value: string }>(sql`SELECT value FROM tg_settings WHERE key = ${key}`)
  return r[0]?.value
}
async function setSetting(key: string, value: string) {
  await rows(sql`INSERT INTO tg_settings (key, value) VALUES (${key}, ${value}) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`)
}

// --- Config ----------------------------------------------------------------

export async function getOddsBotConfig(): Promise<OddsBotConfig> {
  await ensureOddsTables()
  let data: Partial<OddsBotConfig> = {}
  try {
    data = JSON.parse((await getSetting(CONFIG_KEY)) ?? '{}')
  } catch {
    data = {}
  }
  const d = DEFAULT_ODDS_BOT
  const s = (v: unknown, f: string) => (typeof v === 'string' ? v : f)
  const minutes = Number(data.expireMinutes)
  return {
    enabled: Boolean(data.enabled),
    botId: Number.isInteger(Number(data.botId)) && Number(data.botId) > 0 ? Number(data.botId) : null,
    channelId: s(data.channelId, ''),
    channelTitle: s(data.channelTitle, ''),
    channelUsername: s(data.channelUsername, ''),
    footer: s(data.footer, d.footer),
    filledWords: s(data.filledWords, d.filledWords),
    wonWords: s(data.wonWords, d.wonWords),
    lostWords: s(data.lostWords, d.lostWords),
    voidWords: s(data.voidWords, d.voidWords),
    expireMinutes: Number.isFinite(minutes) && minutes >= 5 && minutes <= 720 ? Math.round(minutes) : d.expireMinutes,
    filledText: s(data.filledText, d.filledText),
    wonText: s(data.wonText, d.wonText),
    lostText: s(data.lostText, d.lostText),
    postResults: data.postResults === undefined ? d.postResults : Boolean(data.postResults),
  }
}

export async function saveOddsBotConfig(input: Omit<OddsBotConfig, 'channelId' | 'channelTitle' | 'channelUsername'> & { channel: string }) {
  const current = await getOddsBotConfig()
  let { channelId, channelTitle, channelUsername } = current
  if (input.channel.trim() && input.botId) {
    const chat = normalizeChat(input.channel)
    if (!chat) throw new Error('Kanal geçersiz. Örnek: @alkankaoran ya da -1001234567890')
    const token = await botToken(input.botId)
    const info = await callBot<{ id: number; title?: string; username?: string }>(token, 'getChat', { chat_id: chat })
    const member = await callBot<{ status: string; can_post_messages?: boolean }>(token, 'getChatMember', { chat_id: info.id, user_id: Number(token.split(':')[0]) })
    if (member.status !== 'administrator' && member.status !== 'creator') throw new Error('Bot özel oran kanalımızda yönetici değil. Botu kanala ekleyip “Mesaj gönder” yetkisi ver')
    channelId = String(info.id)
    channelTitle = info.title ?? String(info.id)
    channelUsername = info.username ?? ''
  }
  if (input.enabled && (!input.botId || !channelId)) throw new Error('Açmak için bot ve özel oran kanalımızı seç')
  const config: OddsBotConfig = {
    enabled: input.enabled,
    botId: input.botId,
    channelId,
    channelTitle,
    channelUsername,
    footer: input.footer.trim().slice(0, 300),
    filledWords: input.filledWords.slice(0, 400),
    wonWords: input.wonWords.slice(0, 400),
    lostWords: input.lostWords.slice(0, 400),
    voidWords: input.voidWords.slice(0, 400),
    expireMinutes: Math.min(720, Math.max(5, Math.round(input.expireMinutes) || DEFAULT_ODDS_BOT.expireMinutes)),
    filledText: input.filledText.trim().slice(0, 500) || DEFAULT_ODDS_BOT.filledText,
    wonText: input.wonText.trim().slice(0, 500) || DEFAULT_ODDS_BOT.wonText,
    lostText: input.lostText.trim().slice(0, 500) || DEFAULT_ODDS_BOT.lostText,
    postResults: input.postResults,
  }
  await setSetting(CONFIG_KEY, JSON.stringify(config))
  return config
}

// --- Webhook ---------------------------------------------------------------

export async function connectOddsWebhook(siteOrigin: string) {
  const config = await getOddsBotConfig()
  if (!config.botId) throw new Error('Önce botu seçip kaydet')
  if (!/^https:\/\//.test(siteOrigin)) throw new Error('Webhook için site HTTPS adresinde yayında olmalı')
  const { getChatConfig } = await import('@/lib/telegram-chat')
  const chat = await getChatConfig().catch(() => null)
  if (chat?.botId === config.botId) throw new Error('Bu bot canlı sohbette kullanılıyor. Özel oran için ayrı bir bot seç')
  const secret = randomBytes(24).toString('base64url')
  await callBot(await botToken(config.botId), 'setWebhook', {
    url: `${siteOrigin}/api/telegram/odds`,
    secret_token: secret,
    allowed_updates: ['channel_post', 'edited_channel_post', 'message', 'edited_message'],
  })
  await setSetting(SECRET_KEY, secret)
}

export async function disconnectOddsWebhook() {
  const config = await getOddsBotConfig()
  if (config.botId) await callBot(await botToken(config.botId), 'deleteWebhook').catch(() => null)
  await setSetting(SECRET_KEY, '')
}

export async function verifyOddsSecret(header: string | null) {
  await ensureOddsTables()
  const secret = await getSetting(SECRET_KEY)
  if (!secret || !header) return false
  const a = Buffer.from(secret)
  const b = Buffer.from(header)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function oddsBotStatus(): Promise<OddsBotStatus> {
  const config = await getOddsBotConfig()
  let webhookUrl: string | null = null
  let pending = 0
  let lastError: string | null = null
  if (config.botId) {
    try {
      const info = await callBot<{ url: string; pending_update_count: number; last_error_message?: string }>(await botToken(config.botId), 'getWebhookInfo')
      webhookUrl = info.url || null
      pending = info.pending_update_count
      lastError = info.last_error_message ?? null
    } catch (error) {
      lastError = String((error as Error).message)
    }
  }
  const [today] = await rows<{ c: string }>(sql`SELECT count(*) AS c FROM special_odds
    WHERE (opened_at AT TIME ZONE 'Europe/Istanbul')::date = ${istanbulDay()}::date`)
  return { webhookUrl, pending, lastError, lastUpdateAt: (await getSetting(LAST_UPDATE_KEY)) || null, todayTotal: Number(today?.c ?? 0) }
}

// --- Sources ---------------------------------------------------------------

function mapSource(r: Record<string, unknown>): OddsSource {
  return {
    id: Number(r.id),
    chatId: String(r.chat_id),
    title: String(r.title),
    siteName: String(r.site_name),
    siteLink: String(r.site_link),
    siteLogo: r.site_logo ? String(r.site_logo) : null,
    active: Boolean(r.active),
    lastAt: r.last_at ? new Date(String(r.last_at)).toISOString() : null,
    total: Number(r.total ?? 0),
    webError: r.web_error ? String(r.web_error) : null,
  }
}

export async function listOddsSources(): Promise<OddsSource[]> {
  await ensureOddsTables()
  const r = await rows(sql`SELECT s.*, (SELECT count(*) FROM special_odds o WHERE o.source_id = s.id) AS total FROM odds_sources s ORDER BY s.id`)
  return r.map(mapSource)
}

export async function addOddsSource(input: { chat: string; siteName: string; siteLink: string; siteLogo: string }) {
  await ensureOddsTables()
  const config = await getOddsBotConfig()
  const siteName = input.siteName.trim().slice(0, 40)
  const siteLink = input.siteLink.trim()
  if (!siteName) throw new Error('Site adını yaz')
  if (!/^https?:\/\/\S+$/i.test(siteLink)) throw new Error('Site linki http(s):// ile başlamalı')
  const chat = normalizeChat(input.chat)
  if (!chat) throw new Error('Kaynak kanal geçersiz. Örnek: @siteoranlar ya da -1001234567890')
  let chatId = chat
  let title = chat
  if (config.botId) {
    try {
      const info = await callBot<{ id: number; title?: string }>(await botToken(config.botId), 'getChat', { chat_id: chat })
      chatId = String(info.id)
      title = info.title ?? chat
    } catch {
      // The bot may not be in the channel yet; keep the raw handle and resolve on first post.
    }
  }
  const logo = input.siteLogo.trim()
  await rows(sql`INSERT INTO odds_sources (chat_id, title, site_name, site_link, site_logo)
    VALUES (${chatId}, ${title.slice(0, 80)}, ${siteName}, ${siteLink.slice(0, 400)}, ${/^https?:\/\/|^\//.test(logo) ? logo.slice(0, 400) : null})
    ON CONFLICT (chat_id) DO UPDATE SET site_name = EXCLUDED.site_name, site_link = EXCLUDED.site_link, site_logo = EXCLUDED.site_logo, active = true`)
  return title
}

export async function setOddsSourceActive(id: number, active: boolean) {
  await ensureOddsTables()
  await rows(sql`UPDATE odds_sources SET active = ${active} WHERE id = ${id}`)
}

export async function deleteOddsSource(id: number) {
  await ensureOddsTables()
  await rows(sql`DELETE FROM odds_sources WHERE id = ${id}`)
}

async function findSource(chat: TgMessage['chat']) {
  const username = (chat as { username?: string }).username
  const keys = [String(chat.id), username ? `@${username}` : ''].filter(Boolean)
  const r = await rows(sql`SELECT *, 0 AS total FROM odds_sources WHERE active AND chat_id IN ${keys} LIMIT 1`)
  if (!r.length) return null
  const source = mapSource(r[0])
  if (source.chatId !== String(chat.id)) {
    await rows(sql`UPDATE odds_sources SET chat_id = ${String(chat.id)}, title = ${chat.title ?? source.title} WHERE id = ${source.id}`).catch(() => null)
    source.chatId = String(chat.id)
  }
  return source
}

// --- Classification & rewriting -------------------------------------------

function classify(text: string, config: OddsBotConfig): OddsPreview['kind'] {
  const lower = text.toLocaleLowerCase('tr')
  const has = (list: string) => splitWords(list).some((w) => lower.includes(w))
  if (has(config.filledWords)) return 'filled'
  if (has(config.voidWords)) return 'void'
  if (has(config.wonWords)) return 'won'
  if (has(config.lostWords)) return 'lost'
  return isOddsText(text) || /\d[.,]\d{2}/.test(text) ? 'odds' : 'ignore'
}

export function rewriteText(text: string, source: Pick<OddsSource, 'siteName' | 'siteLink'>, config: Pick<OddsBotConfig, 'footer'>) {
  const body = text
    .replace(/https?:\/\/\S+/gi, source.siteLink)
    .replace(/(^|\s)(t\.me|telegram\.me)\/\S+/gi, `$1${source.siteLink}`)
    .replace(/(^|\s)@[A-Za-z0-9_]{4,}/g, '$1')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  const footer = config.footer ? `\n\n${config.footer}` : ''
  return `${body}${footer}`.trim()
}

const fit = (text: string, limit: number) => (text.length > limit ? `${text.slice(0, limit - 1).trimEnd()}…` : text)

export async function previewOddsPost(text: string, sourceId: number | null): Promise<OddsPreview> {
  const config = await getOddsBotConfig()
  const sources = await listOddsSources()
  const source = sources.find((s) => s.id === sourceId) ?? { siteName: 'Site', siteLink: 'https://site.com' }
  const kind = classify(text, config)
  const odds = kind === 'odds' ? (await parseOddsPost(text)).map((o) => ({ match: o.match, market: o.market, oldOdd: o.oldOdd, newOdd: o.newOdd })) : []
  return { kind, odds, rewritten: kind === 'odds' ? rewriteText(text, source, config) : '' }
}

// --- Ingest ----------------------------------------------------------------

type Incoming = { chatId: string; messageId: number; replyTo: number | null; text: string; photo: string | null; edited: boolean }

async function publishToChannel(config: OddsBotConfig, incoming: Incoming, rewritten: string, fromChat: string | null) {
  if (!config.enabled || !config.botId || !config.channelId) return null
  const token = await botToken(config.botId)
  if (incoming.photo && fromChat) {
    const res = await callBot<{ message_id: number }>(token, 'copyMessage', {
      chat_id: config.channelId,
      from_chat_id: fromChat,
      message_id: incoming.messageId,
      caption: fit(rewritten, CAPTION_LIMIT),
    })
    return res.message_id
  }
  if (incoming.photo && /^https?:\/\//.test(incoming.photo)) {
    const res = await callBot<{ message_id: number }>(token, 'sendPhoto', {
      chat_id: config.channelId,
      photo: incoming.photo,
      caption: fit(rewritten, CAPTION_LIMIT),
    }).catch(() => null)
    if (res) return res.message_id
  }
  const res = await callBot<{ message_id: number }>(token, 'sendMessage', {
    chat_id: config.channelId,
    text: fit(rewritten, MESSAGE_LIMIT),
    link_preview_options: { is_disabled: true },
  })
  return res.message_id
}

async function replyInChannel(config: OddsBotConfig, ourMsg: number | null, text: string) {
  if (!config.enabled || !config.botId || !config.channelId || !text) return
  await callBot(await botToken(config.botId), 'sendMessage', {
    chat_id: config.channelId,
    text: fit(text, MESSAGE_LIMIT),
    ...(ourMsg ? { reply_parameters: { message_id: ourMsg, allow_sending_without_reply: true } } : {}),
  }).catch((error) => console.error('[odds-bot] channel reply failed', error))
}

/** Picks the odds a "limit doldu" or result post refers to: reply target first, then match names, then the latest post. */
async function targetRows(source: OddsSource, incoming: Incoming, where: 'open' | 'unsettled') {
  const filter = where === 'open'
    ? sql`status = 'open'`
    : sql`result IS NULL AND opened_at > now() - make_interval(hours => ${RESULT_LOOKBACK_HOURS})`
  if (incoming.replyTo) {
    const r = await rows<{ id: number; our_msg: number | null; match: string }>(
      sql`SELECT id, our_msg, match FROM special_odds WHERE source_chat = ${source.chatId} AND source_msg = ${incoming.replyTo} AND ${filter}`,
    )
    if (r.length) return r
  }
  const candidates = await rows<{ id: number; our_msg: number | null; match: string; source_msg: number }>(
    sql`SELECT id, our_msg, match, source_msg FROM special_odds WHERE source_id = ${source.id} AND ${filter} ORDER BY opened_at DESC LIMIT 30`,
  )
  const lower = incoming.text.toLocaleLowerCase('tr')
  const named = candidates.filter((c) =>
    c.match
      .toLocaleLowerCase('tr')
      .split(/\s*(?:-|vs\.?|–|—)\s*/)
      .filter((team) => team.length > 2)
      .some((team) => lower.includes(team)),
  )
  if (named.length) return named
  if (!candidates.length) return []
  const latest = candidates[0].source_msg
  return candidates.filter((c) => c.source_msg === latest)
}

async function ingest(source: OddsSource, incoming: Incoming, fromChat: string | null) {
  const config = await getOddsBotConfig()
  await rows(sql`UPDATE odds_sources SET last_at = now() WHERE id = ${source.id}`)

  // An edited post that now says "limit doldu" closes the odds it originally announced.
  const kind = classify(incoming.text, config)
  if (incoming.edited && kind !== 'filled' && !['won', 'lost', 'void'].includes(kind)) return { kind: 'ignore' as const, count: 0 }
  const effective: Incoming = incoming.edited ? { ...incoming, replyTo: incoming.messageId } : incoming

  if (kind === 'filled') {
    const targets = await targetRows(source, effective, 'open')
    if (!targets.length) return { kind, count: 0 }
    await rows(sql`UPDATE special_odds SET status = 'filled', filled_at = now() WHERE id IN ${targets.map((t) => t.id)}`)
    await replyInChannel(config, targets[0].our_msg, config.filledText)
    return { kind, count: targets.length }
  }

  if (kind === 'won' || kind === 'lost' || kind === 'void') {
    const targets = await targetRows(source, effective, 'unsettled')
    if (!targets.length) return { kind, count: 0 }
    await rows(sql`UPDATE special_odds SET result = ${kind}, result_at = now(),
      status = CASE WHEN status = 'open' THEN 'expired' ELSE status END WHERE id IN ${targets.map((t) => t.id)}`)
    if (config.postResults && kind !== 'void') await replyInChannel(config, targets[0].our_msg, kind === 'won' ? config.wonText : config.lostText)
    return { kind, count: targets.length }
  }

  if (kind !== 'odds') return { kind, count: 0 }

  const exists = await rows(sql`SELECT 1 FROM special_odds WHERE source_chat = ${source.chatId} AND source_msg = ${incoming.messageId} LIMIT 1`)
  if (exists.length) return { kind, count: 0 }

  const parsed = await parseOddsPost(incoming.text)
  const rewritten = rewriteText(incoming.text, source, config)
  let ourMsg: number | null = null
  try {
    ourMsg = await publishToChannel(config, incoming, rewritten, fromChat)
  } catch (error) {
    console.error('[odds-bot] publish failed', error)
  }
  const firstLine = incoming.text.split('\n').find((l) => l.trim().length > 3)?.trim() ?? 'Özel oran'
  const items = parsed.length ? parsed : [{ match: firstLine.slice(0, 80), league: '', market: '', oldOdd: null, newOdd: null, kickoff: '', limit: '' }]
  for (const [idx, o] of items.entries()) {
    await rows(sql`INSERT INTO special_odds (source_id, source_chat, source_msg, idx, our_msg, site_name, site_logo, link, match, league, market,
        old_odd, new_odd, kickoff, limit_text, body, photo)
      VALUES (${source.id}, ${source.chatId}, ${incoming.messageId}, ${idx}, ${ourMsg}, ${source.siteName}, ${source.siteLogo}, ${source.siteLink},
        ${o.match}, ${o.league}, ${o.market}, ${o.oldOdd}, ${o.newOdd}, ${o.kickoff}, ${o.limit}, ${rewritten.slice(0, 4000)}, ${incoming.photo})
      ON CONFLICT (source_chat, source_msg, idx) DO NOTHING`)
  }
  return { kind, count: items.length }
}

function toIncoming(m: TgMessage, edited: boolean): Incoming {
  const photos = (m as unknown as { photo?: { file_id: string }[] }).photo
  return {
    chatId: String(m.chat.id),
    messageId: m.message_id,
    replyTo: m.reply_to_message?.message_id ?? null,
    text: m.text ?? m.caption ?? '',
    photo: photos?.length ? photos[photos.length - 1].file_id : null,
    edited,
  }
}

export async function handleOddsUpdate(update: OddsUpdate) {
  await ensureOddsTables()
  await setSetting(LAST_UPDATE_KEY, new Date().toISOString())
  const edited = update.edited_channel_post ?? update.edited_message
  const m = update.channel_post ?? update.message ?? edited
  if (!m || !(m.text ?? m.caption)) return
  const source = await findSource(m.chat)
  if (!source) return
  await ingest(source, toIncoming(m, Boolean(edited)), String(m.chat.id))
}

/** Panel fallback: paste a source post by hand while bots are not connected yet. */
export async function ingestManual(sourceId: number, text: string) {
  await ensureOddsTables()
  const r = await rows(sql`SELECT *, 0 AS total FROM odds_sources WHERE id = ${sourceId}`)
  if (!r.length) throw new Error('Kaynak bulunamadı')
  if (text.trim().length < 10) throw new Error('Post metni çok kısa')
  const source = mapSource(r[0])
  const messageId = -Date.now()
  return ingest(source, { chatId: source.chatId, messageId, replyTo: null, text: text.trim(), photo: null, edited: false }, null)
}

const WEB_BATCH = 10

/**
 * Telegram only pushes channel posts to bots that are admins of that channel. Sponsor channels
 * are usually run by someone else, so public sources are read from their t.me/s web page instead.
 * Message ids match the real ones, so a post arriving via both paths is stored once.
 */
export async function scrapeOddsSources(config?: OddsBotConfig) {
  await ensureOddsTables()
  const cfg = config ?? (await getOddsBotConfig())
  const token = cfg.botId ? await botToken(cfg.botId).catch(() => null) : null
  const sources = await rows(sql`SELECT *, 0 AS total FROM odds_sources WHERE active ORDER BY id`)
  let handled = 0
  for (const r of sources) {
    const source = mapSource(r)
    let username = r.username ? String(r.username) : ''
    try {
      if (!username) {
        if (source.chatId.startsWith('@')) username = source.chatId.slice(1)
        else if (token) username = (await callBot<{ username?: string }>(token, 'getChat', { chat_id: source.chatId }).catch(() => null))?.username ?? ''
        if (!username) throw new Error('Kanal herkese açık değil (kullanıcı adı yok). Botu bu kanalda yönetici yap.')
        await rows(sql`UPDATE odds_sources SET username = ${username} WHERE id = ${source.id}`)
      }
      const posts = (await fetchChannel(username)).sort((a, b) => a.id - b.id)
      if (!posts.length) throw new Error('Kanalın web sayfası okunamadı')
      let last = r.web_last === null || r.web_last === undefined ? null : Number(r.web_last)
      if (last === null) {
        // First run: only posts from the open window, so expired odds are not re-announced.
        const cutoff = Date.now() - cfg.expireMinutes * 60_000
        const older = posts.filter((p) => !p.date || new Date(p.date).getTime() < cutoff)
        last = older.length ? older[older.length - 1].id : posts[0].id - 1
      }
      const fresh = posts.filter((p) => p.id > last!).slice(0, WEB_BATCH)
      for (const post of fresh) {
        await rows(sql`UPDATE odds_sources SET web_last = GREATEST(COALESCE(web_last, 0), ${post.id}) WHERE id = ${source.id}`)
        const text = stripTags(post.html).trim()
        if (!text) continue
        await ingest(source, { chatId: source.chatId, messageId: post.id, replyTo: null, text, photo: post.photos[0] ?? null, edited: false }, null)
          .catch((error) => console.error('[odds-bot] web ingest failed', error))
        handled++
      }
      if (!fresh.length) await rows(sql`UPDATE odds_sources SET web_last = ${last} WHERE id = ${source.id} AND web_last IS NULL`)
      await rows(sql`UPDATE odds_sources SET web_error = NULL WHERE id = ${source.id}`)
    } catch (error) {
      await rows(sql`UPDATE odds_sources SET web_error = ${String((error as Error).message).slice(0, 300)} WHERE id = ${source.id}`).catch(() => null)
    }
  }
  return { handled }
}


/** Fallback for when the webhook is not set: pulls updates on each cron run. */
export async function pollOddsBot() {
  const config = await getOddsBotConfig()
  await expireStaleOdds()
  await scrapeOddsSources(config).catch((error) => console.error('[odds-bot] web sources', error))
  if (!config.botId || (await getSetting(SECRET_KEY))) return { handled: 0 }
  const token = await botToken(config.botId)
  const offset = Number((await getSetting(OFFSET_KEY)) ?? 0)
  const updates = await callBot<OddsUpdate[]>(token, 'getUpdates', {
    offset: offset || undefined,
    limit: 50,
    timeout: 0,
    allowed_updates: ['channel_post', 'edited_channel_post', 'message', 'edited_message'],
  })
  for (const update of updates) {
    await handleOddsUpdate(update).catch((error) => console.error('[odds-bot] poll update failed', error))
    await setSetting(OFFSET_KEY, String(update.update_id + 1))
  }
  return { handled: updates.length }
}

// --- Reads & admin ---------------------------------------------------------

export async function expireStaleOdds() {
  await ensureOddsTables()
  const config = await getOddsBotConfig()
  await rows(sql`UPDATE special_odds SET status = 'expired'
    WHERE status = 'open' AND opened_at < now() - make_interval(mins => ${config.expireMinutes})`)
}

const numOrNull = (v: unknown) => (v == null ? null : Number(v))

function mapOdd(r: Record<string, unknown>): SpecialOdd {
  const result = r.result === 'won' || r.result === 'lost' || r.result === 'void' ? r.result : null
  const status = r.status === 'filled' || r.status === 'expired' ? r.status : 'open'
  return {
    id: Number(r.id),
    sourceId: r.source_id == null ? null : Number(r.source_id),
    siteName: String(r.site_name),
    siteLogo: r.site_logo ? String(r.site_logo) : null,
    link: String(r.link),
    match: String(r.match),
    league: String(r.league ?? ''),
    market: String(r.market ?? ''),
    oldOdd: numOrNull(r.old_odd),
    newOdd: numOrNull(r.new_odd),
    kickoff: String(r.kickoff ?? ''),
    limit: String(r.limit_text ?? ''),
    openedAt: new Date(String(r.opened_at)).toISOString(),
    filledAt: r.filled_at ? new Date(String(r.filled_at)).toISOString() : null,
    status,
    result,
  }
}

export async function listOddsByDay(day: string) {
  try {
    await expireStaleOdds()
    const r = await rows(sql`SELECT * FROM special_odds WHERE (opened_at AT TIME ZONE 'Europe/Istanbul')::date = ${day}::date
      ORDER BY opened_at DESC LIMIT 300`)
    return r.map(mapOdd)
  } catch (error) {
    console.error('[special-odds] gün listesi okunamadı', error)
    return []
  }
}

export function dayStats(odds: SpecialOdd[]): OddsDayStats {
  const fills = odds.filter((o) => o.filledAt).map((o) => (Date.parse(o.filledAt!) - Date.parse(o.openedAt)) / 60000)
  return {
    total: odds.length,
    open: odds.filter((o) => o.status === 'open').length,
    won: odds.filter((o) => o.result === 'won').length,
    lost: odds.filter((o) => o.result === 'lost').length,
    avgFillMinutes: fills.length ? Math.max(1, Math.round(fills.reduce((a, b) => a + b, 0) / fills.length)) : null,
  }
}

export async function listAdminOdds(limit = 60) {
  await expireStaleOdds()
  const r = await rows(sql`SELECT * FROM special_odds ORDER BY opened_at DESC LIMIT ${limit}`)
  return r.map(mapOdd)
}

export async function setOddsStatus(ids: number[], action: 'filled' | 'open' | OddResult | 'clear') {
  await ensureOddsTables()
  if (!ids.length) return
  if (action === 'filled') await rows(sql`UPDATE special_odds SET status = 'filled', filled_at = COALESCE(filled_at, now()) WHERE id IN ${ids}`)
  else if (action === 'open') await rows(sql`UPDATE special_odds SET status = 'open', filled_at = NULL, opened_at = now() WHERE id IN ${ids}`)
  else if (action === 'clear') await rows(sql`UPDATE special_odds SET result = NULL, result_at = NULL WHERE id IN ${ids}`)
  else await rows(sql`UPDATE special_odds SET result = ${action}, result_at = now(), status = CASE WHEN status = 'open' THEN 'expired' ELSE status END WHERE id IN ${ids}`)
}

export async function deleteOdds(ids: number[]) {
  await ensureOddsTables()
  if (ids.length) await rows(sql`DELETE FROM special_odds WHERE id IN ${ids}`)
}
