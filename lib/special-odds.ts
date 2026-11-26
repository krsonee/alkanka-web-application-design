import 'server-only'
import { randomBytes, timingSafeEqual } from 'node:crypto'
import type { SQL } from 'drizzle-orm'
import { rows, sql } from '@/lib/db'
import {
  MediaError,
  botToken,
  callBot,
  checkedRules,
  deliver,
  ensureTables,
  entitiesToPostText,
  fetchChannel,
  normalizeChat,
  postButtons,
  scrapedHtmlToCleanText,
  sharedRules,
  withSharedRules,
  type ScrapedPost,
} from '@/lib/telegram-mirror'
import { MAX_SENT_BUTTONS, parseReplacements, rewritePlain } from '@/lib/text-replace'
import { readOddsPost, type OddsImage, type OddsReading } from '@/lib/odds-parse'
import { carriedPost, isBareNote, namesMatch, oddsPost, resultNotice, type OddsPostText, type SettledOdd } from '@/lib/odds-post'
import { assertPublicUrl } from '@/lib/public-address'
import type { ParsedOdd } from '@/lib/deal-types'
import { decodeEntities } from '@/lib/html-entities'
import { isOddsText } from '@/lib/telegram-bots'
import type { TgMessage } from '@/lib/telegram-chat'
import { buttonError, buttonMarkup, cleanButtons, type PostButton } from '@/lib/tg-buttons'
import {
  DEFAULT_ODDS_BOT,
  NO_MAIN_CHANNEL,
  NO_SPONSOR_LINK,
  campaignLink,
  ODDS_MAX,
  ODDS_PAGE,
  hasOddNumber,
  istanbulDay,
  oddsTagLine,
  splitWords,
  sponsorLinkError,
  toMediaFallback,
  toOddsPassMode,
  toOddsTag,
  type OddResult,
  type OddsBotConfig,
  type OddsBotStatus,
  type OddsDayStats,
  type OddsFilter,
  type OddsPage,
  type OddsPreview,
  type OddsQueueItem,
  type OddsQueueState,
  type OddsSource,
  type SpecialOdd,
} from '@/lib/special-odds-shared'

type OddsUpdate = { update_id: number; message?: TgMessage; channel_post?: TgMessage; edited_channel_post?: TgMessage; edited_message?: TgMessage }

const CONFIG_KEY = 'odds_bot'
const SECRET_KEY = 'odds_bot_secret'
const LAST_UPDATE_KEY = 'odds_bot_last_update'
const OFFSET_KEY = 'odds_bot_offset'
const PUBLISH_ERROR_KEY = 'odds_bot_publish_error'
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
    await rows(sql`ALTER TABLE odds_sources ADD COLUMN IF NOT EXISTS replacements text NOT NULL DEFAULT ''`)
    await rows(sql`ALTER TABLE odds_sources ADD COLUMN IF NOT EXISTS footer text NOT NULL DEFAULT ''`)
    await rows(sql`ALTER TABLE odds_sources ADD COLUMN IF NOT EXISTS tag text NOT NULL DEFAULT 'none'`)
    await rows(sql`ALTER TABLE odds_sources ADD COLUMN IF NOT EXISTS tag_text text NOT NULL DEFAULT ''`)
    await rows(sql`ALTER TABLE special_odds ADD COLUMN IF NOT EXISTS tag text NOT NULL DEFAULT 'none'`)
    await rows(sql`ALTER TABLE special_odds ADD COLUMN IF NOT EXISTS tag_text text NOT NULL DEFAULT ''`)
    await rows(sql`ALTER TABLE odds_sources ADD COLUMN IF NOT EXISTS pass_mode text NOT NULL DEFAULT 'odds'`)
    await rows(sql`ALTER TABLE odds_sources ADD COLUMN IF NOT EXISTS pass_words text NOT NULL DEFAULT ''`)
    await rows(sql`ALTER TABLE odds_sources ADD COLUMN IF NOT EXISTS buttons text NOT NULL DEFAULT '[]'`)
    await rows(sql`ALTER TABLE odds_sources ADD COLUMN IF NOT EXISTS carry_buttons boolean NOT NULL DEFAULT false`)
    await rows(sql`ALTER TABLE odds_sources ADD COLUMN IF NOT EXISTS sponsor_link text NOT NULL DEFAULT ''`)
    // Posts that were not shared as an odd: skipped by the source's rule, waiting for their media, or shared without odds.
    await rows(sql`CREATE TABLE IF NOT EXISTS odds_queue (
      id serial PRIMARY KEY, source_id int REFERENCES odds_sources(id) ON DELETE CASCADE, source_chat text NOT NULL, source_msg bigint NOT NULL,
      state text NOT NULL, reason text NOT NULL DEFAULT '', body text NOT NULL DEFAULT '', payload text NOT NULL DEFAULT '{}',
      created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (source_chat, source_msg))`)
    // Telegram delivers an album as separate messages; the parts are kept until the one with the caption is handled.
    await rows(sql`CREATE TABLE IF NOT EXISTS odds_album (
      chat_id text NOT NULL, msg_id bigint NOT NULL, group_id text NOT NULL, kind text NOT NULL, file_id text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (chat_id, msg_id))`)
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
    mediaFallback: toMediaFallback(data.mediaFallback),
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
    mediaFallback: toMediaFallback(input.mediaFallback),
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
  let channelError: string | null = null
  let mainChannelError: string | null = null
  const main = await mainChannel()
  if (config.botId) {
    try {
      const token = await botToken(config.botId)
      const info = await callBot<{ url: string; pending_update_count: number; last_error_message?: string }>(token, 'getWebhookInfo')
      webhookUrl = info.url || null
      pending = info.pending_update_count
      lastError = info.last_error_message ?? null
      if (config.channelId) {
        channelError = await channelAccessError(token, { chatId: config.channelId, title: config.channelTitle || 'özel oran kanalımız' }, 'oranlar kanala düşmez')
      }
      if (main) mainChannelError = await channelAccessError(token, main, 'kampanya ve bonus postları ana kanala düşmez')
    } catch (error) {
      lastError = String((error as Error).message)
    }
  }
  const [[today], [sources], lastUpdateAt, publishError] = await Promise.all([
    rows<{ c: string; held: string }>(sql`SELECT count(*) AS c, (SELECT count(*) FROM odds_queue WHERE state = 'held') AS held FROM special_odds
      WHERE (opened_at AT TIME ZONE 'Europe/Istanbul')::date = ${istanbulDay()}::date`),
    rows<{ c: string }>(sql`SELECT count(*) AS c FROM odds_sources WHERE active`),
    getSetting(LAST_UPDATE_KEY),
    readPublishError(),
  ])
  return {
    held: Number(today?.held ?? 0),
    webhookUrl,
    pending,
    lastError,
    lastUpdateAt: lastUpdateAt || null,
    todayTotal: Number(today?.c ?? 0),
    channelError,
    mainChannel: main?.title ?? null,
    mainChannelError,
    publishError,
    activeSources: Number(sources?.c ?? 0),
  }
}

/** A channel of ours the bot posts into. */
type Outlet = { chatId: string; title: string }

/**
 * Our main (announcement) channel, as registered in the Telegram section. Posts without an odd go
 * here instead of the odds channel. The keys are the ones lib/telegram-channels.ts keeps for `duyuru`.
 */
async function mainChannel(): Promise<Outlet | null> {
  const r = await rows<{ key: string; value: string }>(sql`SELECT key, value FROM tg_settings WHERE key IN ('channel_duyuru', 'channel_duyuru_id')`)
  const username = r.find((s) => s.key === 'channel_duyuru')?.value?.replace(/^@/, '').trim()
  const id = r.find((s) => s.key === 'channel_duyuru_id')?.value?.trim()
  if (!username && !id) return null
  return { chatId: id || `@${username}`, title: username ? `@${username}` : String(id) }
}

/** The bot is checked when the channel is saved, but it can be demoted or removed afterwards. */
async function channelAccessError(token: string, outlet: Outlet, effect: string) {
  const name = outlet.title
  try {
    const member = await callBot<{ status: string; can_post_messages?: boolean }>(token, 'getChatMember', {
      chat_id: outlet.chatId,
      user_id: Number(token.split(':')[0]),
    })
    if (member.status !== 'administrator' && member.status !== 'creator') {
      return `Bot “${name}” kanalında yönetici değil, ${effect}. Kanal ayarlarından botu yönetici yap ve “Mesaj gönder” yetkisini aç`
    }
    if (member.can_post_messages === false) return `Botun “${name}” kanalında “Mesaj gönder” yetkisi kapalı. Yönetici ayarından aç`
    return null
  } catch (error) {
    return `“${name}” kanalına ulaşılamadı: ${String((error as Error).message)}`
  }
}

async function readPublishError(): Promise<OddsBotStatus['publishError']> {
  try {
    const data = JSON.parse((await getSetting(PUBLISH_ERROR_KEY)) || 'null') as { at?: unknown; message?: unknown } | null
    return data && typeof data.at === 'string' && typeof data.message === 'string' ? { at: data.at, message: data.message } : null
  } catch {
    return null
  }
}

// --- Sources ---------------------------------------------------------------

/** Letters and digits only, so "Makro Bet", "MAKROBET" and "makrobet" are one name. */
const siteKey = (name: string) =>
  name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/[^a-z0-9]/g, '')

function webLink(value: unknown) {
  try {
    const target = new URL(String(value ?? '').trim())
    return target.protocol === 'https:' || target.protocol === 'http:' ? target.toString() : ''
  } catch {
    return ''
  }
}

const SPONSOR_LINKS_FRESH_MS = 60_000
let sponsorLinkCache: { at: number; links: Map<string, string> } | null = null

/**
 * The entry links of the active sponsors on the site's own list, by name. A source of the same sponsor
 * needs no link typed twice, and follows the list when the sponsor's address changes.
 */
async function sponsorLinks(): Promise<Map<string, string>> {
  if (sponsorLinkCache && Date.now() - sponsorLinkCache.at < SPONSOR_LINKS_FRESH_MS) return sponsorLinkCache.links
  const sites = await rows<{ name: string; url: string; entry_url: string }>(
    sql`SELECT name, url, entry_url FROM sites WHERE active ORDER BY sort_order DESC, id DESC`,
  ).catch(() => null)
  // A list that could not be read is not remembered as empty.
  if (!sites) return sponsorLinkCache?.links ?? new Map()
  const links = new Map<string, string>()
  for (const site of sites) {
    const link = webLink(site.entry_url) || webLink(site.url)
    if (link && siteKey(site.name)) links.set(siteKey(site.name), link)
  }
  sponsorLinkCache = { at: Date.now(), links }
  return links
}

const RULES_RESTORED_KEY = 'odds_sponsor_rules_restored'
let rulesRestored = false

/**
 * Sources that were here before a source had a rule of its own were handed "odds only" by the column
 * default, which silently stopped the campaign posts they used to share. Once, the sources of
 * sponsors on the site's list go back to sharing everything; sites that are not sponsors keep "odds only".
 */
async function restoreSponsorRules() {
  if (rulesRestored) return
  const done = await rows(sql`SELECT 1 FROM tg_settings WHERE key = ${RULES_RESTORED_KEY}`)
  if (!done.length) {
    const [list] = await rows<{ found: string | null }>(sql`SELECT to_regclass('sites')::text AS found`)
    if (list?.found) {
      // Read here, not through the cache: a list that cannot be read throws, and the fix is tried again next round.
      const sites = await rows<{ name: string }>(sql`SELECT name FROM sites WHERE active`)
      const sponsors = new Set(sites.map((site) => siteKey(String(site.name))))
      const narrow = await rows<{ id: number; site_name: string }>(sql`SELECT id, site_name FROM odds_sources WHERE pass_mode = 'odds'`)
      const ids = narrow.filter((s) => sponsors.has(siteKey(String(s.site_name)))).map((s) => Number(s.id))
      if (ids.length) await rows(sql`UPDATE odds_sources SET pass_mode = 'all' WHERE id IN ${ids}`)
      await rows(sql`INSERT INTO tg_settings (key, value) VALUES (${RULES_RESTORED_KEY}, ${new Date().toISOString()}) ON CONFLICT (key) DO NOTHING`)
    }
  }
  rulesRestored = true
}

function mapSource(r: Record<string, unknown>, sponsors?: Map<string, string>): OddsSource {
  return {
    id: Number(r.id),
    chatId: String(r.chat_id),
    title: String(r.title),
    siteName: String(r.site_name),
    siteLink: String(r.site_link),
    sponsorLink: String(r.sponsor_link ?? ''),
    sponsorLinkAuto: sponsors?.get(siteKey(String(r.site_name))) ?? '',
    siteLogo: r.site_logo ? String(r.site_logo) : null,
    replacements: String(r.replacements ?? ''),
    footer: String(r.footer ?? ''),
    tag: toOddsTag(r.tag),
    tagText: String(r.tag_text ?? ''),
    passMode: toOddsPassMode(r.pass_mode),
    passWords: String(r.pass_words ?? ''),
    buttons: cleanButtons(r.buttons),
    carryButtons: Boolean(r.carry_buttons),
    active: Boolean(r.active),
    lastAt: r.last_at ? new Date(String(r.last_at)).toISOString() : null,
    total: Number(r.total ?? 0),
    webError: r.web_error ? String(r.web_error) : null,
  }
}

export async function listOddsSources(): Promise<OddsSource[]> {
  await ensureOddsTables()
  const [r, sponsors] = await Promise.all([
    rows(sql`SELECT s.*, (SELECT count(*) FROM special_odds o WHERE o.source_id = s.id) AS total FROM odds_sources s ORDER BY s.id`),
    sponsorLinks(),
  ])
  return r.map((row) => mapSource(row, sponsors))
}

export async function updateOddsSourceText(id: number, input: { siteLink: string; replacements: string; footer: string }) {
  await ensureOddsTables()
  const siteLink = input.siteLink.trim()
  if (!/^https?:\/\/\S+$/i.test(siteLink)) throw new Error('Site linki http(s):// ile başlamalı')
  await rows(sql`UPDATE odds_sources SET site_link = ${siteLink.slice(0, 400)}, replacements = ${checkedRules(input.replacements)},
    footer = ${input.footer.trim().slice(0, 300)} WHERE id = ${id}`)
}

function checkedSponsorLink(link: string) {
  const invalid = sponsorLinkError(link)
  if (invalid) throw new Error(invalid)
  return link.trim().slice(0, 400)
}

/** Where the source's campaign posts lead. Empty clears it, and campaign posts of the source wait until it is set again. */
export async function updateOddsSourceSponsorLink(id: number, link: string) {
  await ensureOddsTables()
  await rows(sql`UPDATE odds_sources SET sponsor_link = ${checkedSponsorLink(link)} WHERE id = ${id}`)
}

function sourceRule(input: { passMode: string; passWords: string; buttons: unknown; carryButtons?: boolean }) {
  const passMode = toOddsPassMode(input.passMode)
  const passWords = splitWords(input.passWords).join(', ').slice(0, 400)
  if (passMode === 'keyword' && !passWords) throw new Error('“Anahtar kelime geçenler” için en az bir kelime yaz')
  const invalid = buttonError(input.buttons)
  if (invalid) throw new Error(invalid)
  return { passMode, passWords, buttons: JSON.stringify(cleanButtons(input.buttons)), carryButtons: Boolean(input.carryButtons) }
}

/** Which posts of the source are shared, and the buttons placed under each shared post. */
export async function updateOddsSourceRule(id: number, input: { passMode: string; passWords: string; buttons: unknown; carryButtons?: boolean }) {
  await ensureOddsTables()
  const rule = sourceRule(input)
  await rows(sql`UPDATE odds_sources SET pass_mode = ${rule.passMode}, pass_words = ${rule.passWords}, buttons = ${rule.buttons},
    carry_buttons = ${rule.carryButtons} WHERE id = ${id}`)
}

/** Re-tags the source and its odds still on the site, so a corrected label shows everywhere at once. */
export async function updateOddsSourceTag(id: number, input: { tag: string; tagText: string }) {
  await ensureOddsTables()
  const tag = toOddsTag(input.tag)
  const tagText = tag === 'none' ? '' : input.tagText.trim().slice(0, 60)
  await rows(sql`UPDATE odds_sources SET tag = ${tag}, tag_text = ${tagText} WHERE id = ${id}`)
  await rows(sql`UPDATE special_odds SET tag = ${tag}, tag_text = ${tagText} WHERE source_id = ${id}`)
}

export async function addOddsSource(input: {
  chat: string
  siteName: string
  siteLink: string
  sponsorLink?: string
  siteLogo: string
  replacements: string
  footer: string
  tag: string
  tagText: string
  passMode?: string
  passWords?: string
  buttons?: unknown
  carryButtons?: boolean
}) {
  await ensureOddsTables()
  const config = await getOddsBotConfig()
  const rule = sourceRule({ passMode: input.passMode ?? 'odds', passWords: input.passWords ?? '', buttons: input.buttons ?? [], carryButtons: input.carryButtons })
  const replacements = checkedRules(input.replacements)
  const siteName = input.siteName.trim().slice(0, 40)
  const siteLink = input.siteLink.trim()
  if (!siteName) throw new Error('Site adını yaz')
  if (!/^https?:\/\/\S+$/i.test(siteLink)) throw new Error('Site linki http(s):// ile başlamalı')
  const sponsorLink = checkedSponsorLink(input.sponsorLink ?? '')
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
  const tag = toOddsTag(input.tag)
  const tagText = tag === 'none' ? '' : input.tagText.trim().slice(0, 60)
  await rows(sql`INSERT INTO odds_sources (chat_id, title, site_name, site_link, sponsor_link, site_logo, replacements, footer, tag, tag_text, pass_mode, pass_words, buttons, carry_buttons)
    VALUES (${chatId}, ${title.slice(0, 80)}, ${siteName}, ${siteLink.slice(0, 400)}, ${sponsorLink}, ${/^https?:\/\/|^\//.test(logo) ? logo.slice(0, 400) : null},
      ${replacements}, ${input.footer.trim().slice(0, 300)}, ${tag}, ${tagText}, ${rule.passMode}, ${rule.passWords}, ${rule.buttons}, ${rule.carryButtons})
    ON CONFLICT (chat_id) DO UPDATE SET site_name = EXCLUDED.site_name, site_link = EXCLUDED.site_link, site_logo = EXCLUDED.site_logo,
      sponsor_link = CASE WHEN EXCLUDED.sponsor_link = '' THEN odds_sources.sponsor_link ELSE EXCLUDED.sponsor_link END,
      replacements = EXCLUDED.replacements, footer = EXCLUDED.footer, tag = EXCLUDED.tag, tag_text = EXCLUDED.tag_text,
      pass_mode = EXCLUDED.pass_mode, pass_words = EXCLUDED.pass_words, buttons = EXCLUDED.buttons, carry_buttons = EXCLUDED.carry_buttons, active = true`)
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
  const source = mapSource(r[0], await sponsorLinks())
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
  // Only a candidate: the source's rule decides whether the post is really shared.
  return candidateKind(text)
}

const candidateKind = (text: string): OddsPreview['kind'] => (isOddsText(text) || hasOddNumber(text) ? 'odds' : 'ignore')

type Read = Pick<OddsReading, 'odds' | 'note' | 'coupon'>
/** `unread`: the post is an odd whose odd could not be read. It stays an odds channel post and is never taken for a campaign. */
type Verdict = Read & { pass: boolean; reason: string; unread?: boolean }

const READER_SILENT = 'Oran okunamadı (okuyucu yanıt vermedi)'

const NO_READ: Read = { odds: [], note: '', coupon: null }
const skip = (reason: string): Verdict => ({ ...NO_READ, pass: false, reason })

/** Applies the source's rule. `kind` is `odds` (candidate) or `ignore` here; closing and result posts never reach it. */
async function passRule(
  source: Pick<OddsSource, 'passMode' | 'passWords'>,
  text: string,
  kind: OddsPreview['kind'],
  picture?: () => Promise<OddsImage | null>,
): Promise<Verdict> {
  if (source.passMode === 'keyword') {
    const lower = text.toLocaleLowerCase('tr')
    if (!splitWords(source.passWords).some((w) => lower.includes(w))) return skip('Anahtar kelime geçmiyor')
  }
  if (source.passMode !== 'odds') {
    if (kind !== 'odds') return { ...NO_READ, pass: true, reason: 'Oran yok, kaynağın kuralı gereği paylaşıldı' }
    const read = await readOddsPost(text, picture)
    if (read.odds.length) return { ...read, pass: true, reason: '' }
    // An odd and a campaign go to different channels of ours, so a post the reader gave no answer for waits in the panel.
    if (read.failed) return skip(READER_SILENT)
    return read.claimed
      ? { ...read, pass: true, unread: true, reason: 'Oranı okunamadı, kaynağın kuralı gereği paylaşıldı' }
      : { ...read, pass: true, reason: 'Oran yok, kaynağın kuralı gereği paylaşıldı' }
  }
  if (kind !== 'odds') return skip('Oran yok')
  const read = await readOddsPost(text, picture)
  if (read.odds.length) return { ...read, pass: true, reason: '' }
  // Without the reader a post it could not read by rule waits in the panel; nothing goes out on a guess.
  if (read.failed) return skip(READER_SILENT)
  return skip(read.kind === 'sonuc' ? 'Sonuç postu (ilgili oran bulunamadı)' : 'Oran yok')
}

/**
 * The post as it goes out: an odd in our own layout for the odds channel, anything else as a campaign
 * for the main channel. A campaign's links lead to the sponsor's own site, and the odds channel's
 * footer has no place under it. `kind: 'odds'` is an odd without a read: one already listed being
 * sent again, or one whose match is only on its video.
 */
export function composeOddsPost(
  text: string,
  source: Pick<OddsSource, 'siteName' | 'siteLink'> & Partial<Pick<OddsSource, 'replacements' | 'footer' | 'tag' | 'tagText' | 'sponsorLink' | 'sponsorLinkAuto'>>,
  config: Pick<OddsBotConfig, 'footer'>,
  read: Read = NO_READ,
  kind: 'auto' | 'odds' = 'auto',
): OddsPostText {
  const rules = parseReplacements(source.replacements ?? '')
  const ownFooter = source.footer?.trim() ?? ''
  const head = {
    siteName: source.siteName,
    tagLine: oddsTagLine(source.tag ?? 'none', source.tagText ?? ''),
    footer: ownFooter || config.footer,
  }
  if (!read.odds.length && kind === 'auto') {
    return carriedPost({ ...head, footer: ownFooter, body: rewritePlain(text, rules, campaignLink(source), 'odds') })
  }
  if (!read.odds.length) return carriedPost({ ...head, body: rewritePlain(text, rules, source.siteLink, 'odds') })
  const note = read.note ? rewritePlain(read.note, rules, source.siteLink, 'odds') : ''
  return oddsPost({ ...head, odds: read.odds, coupon: read.coupon, note })
}

const fit = (text: string, limit: number) => (text.length > limit ? `${text.slice(0, limit - 1).trimEnd()}…` : text)

/** Message fields for a post: marked up while it fits, plain and cut short when it does not (a cut can break a tag). */
const textFields = (post: OddsPostText) =>
  post.plain.length <= MESSAGE_LIMIT ? { text: post.html, parse_mode: 'HTML' } : { text: fit(post.plain, MESSAGE_LIMIT) }

export async function previewOddsPost(text: string, sourceId: number | null): Promise<OddsPreview> {
  const config = await getOddsBotConfig()
  const sources = await listOddsSources()
  const found = sources.find((s) => s.id === sourceId) ?? {
    siteName: 'Site',
    siteLink: 'https://site.com',
    sponsorLink: 'https://site.com',
    passMode: 'odds' as const,
    passWords: '',
    replacements: '',
  }
  const source = { ...found, replacements: withSharedRules(found.replacements, await sharedRules()) }
  const signal = classify(text, config)
  // A result word alone settles nothing: only a bare note ("Kazandı ✅") is taken as a result here, as in the live flow.
  if (signal !== 'odds' && signal !== 'ignore' && isBareNote(text)) return { kind: signal, odds: [], rewritten: '', verdict: null, reason: '' }
  const kind = candidateKind(text)
  const rule = await passRule(source, text, kind)
  const campaign = rule.pass && !rule.odds.length && !rule.unread
  const blocked = campaign ? (!campaignLink(source) ? NO_SPONSOR_LINK : (await mainChannel()) ? '' : NO_MAIN_CHANNEL) : ''
  return {
    kind: rule.odds.length ? 'odds' : kind,
    odds: rule.odds.map((o) => ({ match: o.match, market: o.market, oldOdd: o.oldOdd, newOdd: o.newOdd })),
    rewritten: rule.pass ? composeOddsPost(text, source, config, rule, rule.unread ? 'odds' : 'auto').plain : '',
    verdict: rule.pass && !blocked ? 'send' : 'skip',
    reason: blocked || (campaign ? `${rule.reason} · ana kanala gider` : rule.reason),
  }
}

// --- Ingest ----------------------------------------------------------------

type AlbumPart = { type: 'photo' | 'video' | 'document'; fileId: string }

type Incoming = {
  chatId: string
  messageId: number
  replyTo: number | null
  text: string
  /** First photo, kept for the card on the site. */
  photo: string | null
  edited: boolean
  /** The bot received the message itself and it carries media, so Telegram can copy it as is. */
  hasMedia: boolean
  album: AlbumPart[]
  /** Set when the post was read from the channel's public web page. */
  post: ScrapedPost | null
  /** Link buttons under the source post. */
  buttons?: PostButton[]
}

type Sent = { message_id: number }

/** Which of our channels a post goes into, and the buttons under it. */
type Route = { dest: Outlet; buttons: PostButton[] }

const oddsRoute = (config: OddsBotConfig, source: OddsSource, incoming: Incoming): Route => ({
  dest: { chatId: config.channelId, title: config.channelTitle },
  buttons: postButtons({ link: source.siteLink, buttons: source.buttons, carryButtons: source.carryButtons }, incoming.buttons, parseReplacements(source.replacements)),
})

/** Under a campaign the first button always opens the sponsor's own site; the source's and our own buttons follow. */
function campaignButtons(source: OddsSource, own: PostButton[] | undefined) {
  const link = campaignLink(source)
  const rest = postButtons({ link, buttons: source.buttons, carryButtons: source.carryButtons }, own, parseReplacements(source.replacements))
  const lead = { text: `${source.siteName} giriş`.slice(0, 40), url: link }
  return [lead, ...rest.filter((b) => b.url !== lead.url)].slice(0, MAX_SENT_BUTTONS)
}

/** A campaign never falls back to the odds channel or to a link of ours: without its channel or the sponsor's link it waits in the panel. */
async function campaignRoute(source: OddsSource, incoming: Incoming): Promise<Route | { blocked: string }> {
  if (!campaignLink(source)) return { blocked: NO_SPONSOR_LINK }
  const dest = await mainChannel()
  if (!dest) return { blocked: NO_MAIN_CHANNEL }
  return { dest, buttons: campaignButtons(source, incoming.buttons) }
}

/** Shares the post with its own photo, video, GIF or album. Throws MediaError when the media can't be carried over. */
async function publishToChannel(config: OddsBotConfig, route: Route, incoming: Incoming, post: OddsPostText, fromChat: string | null, withMedia = true) {
  if (!config.enabled || !config.botId || !route.dest.chatId) return null
  const token = await botToken(config.botId)
  const chat_id = route.dest.chatId
  const buttons = route.buttons
  const markup = buttonMarkup(buttons)
  const sendText = async () =>
    (await callBot<Sent>(token, 'sendMessage', { chat_id, ...textFields(post), link_preview_options: { is_disabled: true }, ...markup })).message_id
  const mediaFailed = (error: unknown) => new MediaError(String((error as Error).message).slice(0, 200))
  if (!withMedia) return sendText()
  const fitsCaption = post.plain.length <= CAPTION_LIMIT
  const caption = { caption: post.html, parse_mode: 'HTML' }

  if (fromChat && incoming.album.length > 1) {
    // Telegram albums can't carry buttons, so with buttons the text follows the album as its own message.
    const inCaption = fitsCaption && !buttons.length
    const media = incoming.album.slice(0, 10).map((part, i) => ({ type: part.type, media: part.fileId, ...(i === 0 && inCaption ? caption : {}) }))
    const sent = await callBot<Sent[]>(token, 'sendMediaGroup', { chat_id, media }).catch((error) => {
      throw mediaFailed(error)
    })
    return inCaption ? sent[0].message_id : sendText()
  }
  if (fromChat && incoming.hasMedia) {
    const copied = await callBot<Sent>(token, 'copyMessage', {
      chat_id,
      from_chat_id: fromChat,
      message_id: incoming.messageId,
      ...(fitsCaption ? { ...caption, ...markup } : { caption: '' }),
    }).catch((error) => {
      throw mediaFailed(error)
    })
    return fitsCaption ? copied.message_id : sendText()
  }
  if (incoming.post) {
    const fields = textFields(post)
    const delivered = await deliver({ token, chatId: chat_id, title: route.dest.title }, incoming.post, fields.text, fields.parse_mode ? 'HTML' : undefined, {
      buttons,
      mediaFail: 'throw',
    })
    return delivered.mainId
  }
  return sendText()
}

// --- Skipped and waiting posts ---------------------------------------------

type QueuePayload = Pick<Incoming, 'replyTo' | 'photo' | 'hasMedia' | 'album' | 'post' | 'buttons'> & { fromChat: string | null }

async function queuePost(source: OddsSource, incoming: Incoming, fromChat: string | null, state: OddsQueueState, reason: string) {
  const payload: QueuePayload = {
    replyTo: incoming.replyTo,
    photo: incoming.photo,
    hasMedia: incoming.hasMedia,
    album: incoming.album,
    post: incoming.post,
    buttons: incoming.buttons,
    fromChat,
  }
  await rows(sql`INSERT INTO odds_queue (source_id, source_chat, source_msg, state, reason, body, payload)
    VALUES (${source.id}, ${source.chatId}, ${incoming.messageId}, ${state}, ${reason.slice(0, 300)}, ${incoming.text.slice(0, 4000)}, ${JSON.stringify(payload)})
    ON CONFLICT (source_chat, source_msg) DO UPDATE SET state = EXCLUDED.state, reason = EXCLUDED.reason, created_at = now()`)
}

async function alreadySeen(chatId: string, messageId: number) {
  const r = await rows(sql`SELECT 1 FROM special_odds WHERE source_chat = ${chatId} AND source_msg = ${messageId}
    UNION ALL SELECT 1 FROM odds_queue WHERE source_chat = ${chatId} AND source_msg = ${messageId} LIMIT 1`)
  return r.length > 0
}

async function notePublishError(error: unknown, mainChannelName = '') {
  console.error('[odds-bot] publish failed', error)
  const message = String((error as Error).message)
  const failure = { at: new Date().toISOString(), message: (mainChannelName ? `Ana kanal (${mainChannelName}): ${message}` : message).slice(0, 300) }
  await setSetting(PUBLISH_ERROR_KEY, JSON.stringify(failure)).catch(() => null)
}

/**
 * Shares a post that passed the source's rule and records it. An odd goes to the odds channel; a post
 * without one is a campaign and goes to the main channel. `media` forces one path; by default the
 * bot's setting decides. `listed` is an odd already on the site being sent again.
 */
async function publishAndStore(
  own: OddsSource,
  incoming: Incoming,
  fromChat: string | null,
  verdict: Verdict,
  media: 'auto' | 'media' | 'text' = 'auto',
  listed = false,
) {
  const config = await getOddsBotConfig()
  const source: OddsSource = { ...own, replacements: withSharedRules(own.replacements, await sharedRules()) }
  const asOdd = listed || Boolean(verdict.unread)
  const campaign = !verdict.odds.length && !asOdd
  const route = campaign ? await campaignRoute(source, incoming) : oddsRoute(config, source, incoming)
  if ('blocked' in route) {
    await queuePost(source, incoming, fromChat, 'skipped', route.blocked)
    return { count: 0, ourMsg: null, held: false, blocked: route.blocked, outlet: null }
  }
  const outlet = campaign ? route.dest.title : ''
  const post = composeOddsPost(incoming.text, source, config, verdict, asOdd ? 'odds' : 'auto')
  const rewritten = post.plain
  let ourMsg: number | null = null
  let held: string | null = null
  try {
    ourMsg = await publishToChannel(config, route, incoming, post, fromChat, media !== 'text')
  } catch (error) {
    if (!(error instanceof MediaError)) await notePublishError(error, outlet)
    else if (media === 'media') throw error
    else if (config.mediaFallback === 'hold') held = error.message || 'Medya alınamadı'
    else ourMsg = await publishToChannel(config, route, incoming, post, fromChat, false).catch(async (again) => {
      await notePublishError(again, outlet)
      return null
    })
  }
  if (ourMsg) await setSetting(PUBLISH_ERROR_KEY, '')

  // Only a post whose odd was read is listed on the site; anything else is shared and noted in the queue.
  const items: ParsedOdd[] = verdict.odds
  for (const [idx, o] of items.entries()) {
    await rows(sql`INSERT INTO special_odds (source_id, source_chat, source_msg, idx, our_msg, site_name, site_logo, link, match, league, market,
        old_odd, new_odd, kickoff, limit_text, body, photo, tag, tag_text)
      VALUES (${source.id}, ${source.chatId}, ${incoming.messageId}, ${idx}, ${ourMsg}, ${source.siteName}, ${source.siteLogo}, ${source.siteLink},
        ${o.match}, ${o.league}, ${o.market}, ${o.oldOdd}, ${o.newOdd}, ${o.kickoff}, ${o.limit}, ${rewritten.slice(0, 4000)}, ${incoming.photo},
        ${source.tag}, ${source.tagText})
      ON CONFLICT (source_chat, source_msg, idx) DO UPDATE SET our_msg = COALESCE(special_odds.our_msg, EXCLUDED.our_msg)`)
  }
  if (held) await queuePost(source, incoming, fromChat, 'held', held)
  else if (!items.length) {
    const sentNote = [verdict.reason, outlet ? `ana kanala (${outlet}) gitti` : ''].filter(Boolean).join(' · ')
    await queuePost(source, incoming, fromChat, ourMsg ? 'sent' : 'skipped', ourMsg ? sentNote : 'Kanala gönderilemedi (bot kapalı ya da hata verdi)')
  }
  return { count: items.length, ourMsg, held: Boolean(held), blocked: null, outlet: outlet || null }
}

async function replyInChannel(config: OddsBotConfig, ourMsg: number | null, note: OddsPostText) {
  if (!config.enabled || !config.botId || !config.channelId || !note.plain.trim()) return
  await callBot(await botToken(config.botId), 'sendMessage', {
    chat_id: config.channelId,
    ...textFields(note),
    link_preview_options: { is_disabled: true },
    ...(ourMsg ? { reply_parameters: { message_id: Number(ourMsg), allow_sending_without_reply: true } } : {}),
  }).catch((error) => console.error('[odds-bot] channel reply failed', error))
}

type Target = { id: number; our_msg: number | null; match: string; market: string; new_odd: string | number | null; source_msg: number }

const settled = (targets: Target[]): SettledOdd[] =>
  targets.map((t) => ({ match: t.match, market: t.market, newOdd: t.new_odd === null ? null : Number(t.new_odd) }))

/**
 * Picks the odds a "limit doldu" or result post refers to. A reply (or an edit of the odd's own post)
 * points at exactly one post; otherwise the post has to name a team of an open odd. Only a bare note
 * with nothing else in it is taken to mean the source's latest odd. Posts shared without a read odd
 * are never a target, so a campaign post can not be congratulated.
 */
async function targetRows(source: OddsSource, incoming: Incoming, where: 'open' | 'unsettled') {
  const filter = where === 'open'
    ? sql`status = 'open'`
    : sql`result IS NULL AND opened_at > now() - make_interval(hours => ${RESULT_LOOKBACK_HOURS})`
  if (incoming.replyTo) {
    return rows<Target>(
      sql`SELECT id, our_msg, match, market, new_odd, source_msg FROM special_odds
        WHERE source_chat = ${source.chatId} AND source_msg = ${incoming.replyTo} AND new_odd IS NOT NULL AND ${filter} ORDER BY idx`,
    )
  }
  const candidates = await rows<Target>(
    sql`SELECT id, our_msg, match, market, new_odd, source_msg FROM special_odds
      WHERE source_id = ${source.id} AND new_odd IS NOT NULL AND ${filter} ORDER BY opened_at DESC, idx LIMIT 30`,
  )
  const named = candidates.filter((c) => namesMatch(incoming.text, c.match))
  if (named.length) {
    // A coupon wins or loses as a whole; matches with their own odds are settled one by one.
    const post = candidates.filter((c) => c.source_msg === named[0].source_msg)
    const coupon = post.length > 1 && post.every((c) => Number(c.new_odd) === Number(post[0].new_odd))
    return coupon ? post : named.filter((c) => c.source_msg === named[0].source_msg)
  }
  if (!candidates.length || !isBareNote(incoming.text)) return []
  const latest = candidates[0].source_msg
  return candidates.filter((c) => c.source_msg === latest)
}

/** A result post about a match this source already announced must not be listed as a new odd. */
async function announcedBefore(source: OddsSource, odds: ParsedOdd[]) {
  const recent = await rows<{ match: string }>(
    sql`SELECT DISTINCT match FROM special_odds WHERE source_id = ${source.id} AND new_odd IS NOT NULL AND opened_at > now() - interval '7 days'`,
  )
  const known = new Set(recent.map((r) => r.match.toLocaleLowerCase('tr')))
  return odds.some((o) => known.has(o.match.toLocaleLowerCase('tr')))
}

const PHOTO_LIMIT_BYTES = 5_000_000

/** The post's first picture for the reader. Read only when the text says "oran" but names no match. */
function pictureOf(config: OddsBotConfig, incoming: Incoming) {
  const ref = incoming.photo
  if (!ref) return undefined
  return async (): Promise<OddsImage | null> => {
    let url = ref
    if (!/^https?:\/\//i.test(ref)) {
      if (!config.botId) return null
      const token = await botToken(config.botId)
      const file = await callBot<{ file_path?: string }>(token, 'getFile', { file_id: ref })
      if (!file.file_path) return null
      url = `https://api.telegram.org/file/bot${token}/${file.file_path}`
    } else {
      await assertPublicUrl(ref)
    }
    const res = await fetch(url, { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(8_000) })
    if (!res.ok) return null
    const data = new Uint8Array(await res.arrayBuffer())
    if (!data.length || data.length > PHOTO_LIMIT_BYTES) return null
    const type = res.headers.get('content-type') ?? ''
    return { data, mediaType: type.startsWith('image/') ? type.split(';')[0] : 'image/jpeg' }
  }
}

async function ingest(source: OddsSource, incoming: Incoming, fromChat: string | null) {
  const config = await getOddsBotConfig()
  await rows(sql`UPDATE odds_sources SET last_at = now() WHERE id = ${source.id}`)

  const signal = classify(incoming.text, config)
  const closing = signal === 'filled' || signal === 'won' || signal === 'lost' || signal === 'void'
  // An edited post only matters when it now says "limit doldu" or carries a result for the odd it announced.
  if (incoming.edited && !closing) return { kind: 'ignore' as const, count: 0 }
  const effective: Incoming = incoming.edited ? { ...incoming, replyTo: incoming.messageId } : incoming

  if (signal === 'filled') {
    const targets = await targetRows(source, effective, 'open')
    if (targets.length) {
      await rows(sql`UPDATE special_odds SET status = 'filled', filled_at = now() WHERE id IN ${targets.map((t) => t.id)}`)
      await replyInChannel(config, targets[0].our_msg, resultNotice('filled', config.filledText, source.siteName, settled(targets)))
      return { kind: signal, count: targets.length }
    }
  }

  if (signal === 'won' || signal === 'lost' || signal === 'void') {
    const targets = await targetRows(source, effective, 'unsettled')
    if (targets.length) {
      await rows(sql`UPDATE special_odds SET result = ${signal}, result_at = now(),
        status = CASE WHEN status = 'open' THEN 'expired' ELSE status END WHERE id IN ${targets.map((t) => t.id)}`)
      if (config.postResults && signal !== 'void') {
        const text = signal === 'won' ? config.wonText : config.lostText
        await replyInChannel(config, targets[0].our_msg, resultNotice(signal, text, source.siteName, settled(targets)))
      }
      return { kind: signal, count: targets.length }
    }
  }

  if (closing && incoming.edited) return { kind: signal, count: 0 }
  // A result word with no odd behind it ("kazanan", a tick in a campaign post) decides nothing: the post is judged like any other.
  const kind = closing ? candidateKind(incoming.text) : signal

  if (await alreadySeen(source.chatId, incoming.messageId)) return { kind, count: 0 }

  let verdict = await passRule(source, incoming.text, kind, pictureOf(config, incoming))
  if (closing && verdict.pass && verdict.odds.length && (await announcedBefore(source, verdict.odds))) {
    verdict = skip('Sonuç postu (oran daha önce paylaşıldı)')
  }
  if (!verdict.pass) {
    await queuePost(source, incoming, fromChat, 'skipped', verdict.reason)
    return { kind: 'ignore' as const, count: 0, skipped: verdict.reason }
  }
  const stored = await publishAndStore(source, incoming, fromChat, verdict)
  if (stored.blocked) return { kind: 'ignore' as const, count: 0, skipped: stored.blocked }
  return { kind: 'odds' as const, count: stored.count, held: stored.held }
}

type MediaMessage = TgMessage & { document?: { file_id: string }; reply_markup?: { inline_keyboard?: { text?: string; url?: string }[][] } }

/** Link buttons under the source message. Buttons without a web link (callbacks, games) can't be carried over. */
const messageButtons = (m: MediaMessage) => cleanButtons((m.reply_markup?.inline_keyboard ?? []).flat().filter((b) => b.url))

function albumPart(m: MediaMessage): AlbumPart | null {
  if (m.photo?.length) return { type: 'photo', fileId: m.photo[m.photo.length - 1].file_id }
  if (m.video) return { type: 'video', fileId: m.video.file_id }
  if (m.document) return { type: 'document', fileId: m.document.file_id }
  return null
}

async function rememberAlbumPart(m: MediaMessage) {
  const part = albumPart(m)
  if (!m.media_group_id || !part) return
  await rows(sql`INSERT INTO odds_album (chat_id, msg_id, group_id, kind, file_id)
    VALUES (${String(m.chat.id)}, ${m.message_id}, ${m.media_group_id}, ${part.type}, ${part.fileId}) ON CONFLICT (chat_id, msg_id) DO NOTHING`)
}

async function albumParts(m: MediaMessage): Promise<AlbumPart[]> {
  if (!m.media_group_id) return []
  const r = await rows<{ kind: string; file_id: string }>(
    sql`SELECT kind, file_id FROM odds_album WHERE chat_id = ${String(m.chat.id)} AND group_id = ${m.media_group_id} ORDER BY msg_id LIMIT 10`,
  )
  return r.map((p) => ({ type: p.kind === 'video' || p.kind === 'document' ? p.kind : 'photo', fileId: p.file_id }))
}

function toIncoming(m: MediaMessage, edited: boolean, album: AlbumPart[]): Incoming {
  const entities = m.entities ?? m.caption_entities ?? []
  const raw = m.text ?? m.caption ?? ''
  return {
    chatId: String(m.chat.id),
    messageId: m.message_id,
    replyTo: m.reply_to_message?.message_id ?? null,
    text: entitiesToPostText(raw, entities),
    photo: m.photo?.length ? m.photo[m.photo.length - 1].file_id : null,
    edited,
    hasMedia: Boolean(m.photo?.length || m.video || m.animation || m.document),
    album,
    post: null,
    buttons: messageButtons(m),
  }
}

// An album's other parts arrive as separate updates right after the captioned one.
const ALBUM_WAIT_MS = 1200

export async function handleOddsUpdate(update: OddsUpdate, albumWaitMs = ALBUM_WAIT_MS) {
  await ensureOddsTables()
  await setSetting(LAST_UPDATE_KEY, new Date().toISOString())
  const edited = update.edited_channel_post ?? update.edited_message
  const m: MediaMessage | undefined = update.channel_post ?? update.message ?? edited
  if (!m) return
  const hasText = Boolean(m.text ?? m.caption)
  if (!hasText && !m.media_group_id) return
  const source = await findSource(m.chat)
  if (!source) return
  if (!edited) await rememberAlbumPart(m)
  if (!hasText) return
  if (m.media_group_id && !edited && albumWaitMs > 0) await new Promise((resolve) => setTimeout(resolve, albumWaitMs))
  await ingest(source, toIncoming(m, Boolean(edited), edited ? [] : await albumParts(m)), String(m.chat.id))
}

/** Panel fallback: paste a source post by hand while bots are not connected yet. */
export async function ingestManual(sourceId: number, text: string) {
  await ensureOddsTables()
  const r = await rows(sql`SELECT *, 0 AS total FROM odds_sources WHERE id = ${sourceId}`)
  if (!r.length) throw new Error('Kaynak bulunamadı')
  if (text.trim().length < 10) throw new Error('Post metni çok kısa')
  const source = mapSource(r[0], await sponsorLinks())
  const messageId = -Date.now()
  return ingest(
    source,
    { chatId: source.chatId, messageId, replyTo: null, text: text.trim(), photo: null, edited: false, hasMedia: false, album: [], post: null },
    null,
  )
}

function mapQueue(r: Record<string, unknown>): OddsQueueItem {
  let hasMedia = false
  try {
    const p = JSON.parse(String(r.payload ?? '{}')) as Partial<QueuePayload>
    hasMedia = Boolean(p.hasMedia || p.album?.length || p.post?.items?.length || p.post?.photos?.length || p.post?.video)
  } catch {
    hasMedia = false
  }
  return {
    id: Number(r.id),
    sourceId: r.source_id == null ? null : Number(r.source_id),
    siteName: String(r.site_name ?? 'Silinmiş kaynak'),
    state: r.state === 'held' || r.state === 'sent' ? r.state : 'skipped',
    reason: String(r.reason ?? ''),
    text: String(r.body ?? ''),
    hasMedia,
    at: new Date(String(r.created_at)).toISOString(),
  }
}

/** Waiting posts first, then the latest skipped and rule-shared ones. */
export async function listOddsQueue(limit = 40): Promise<OddsQueueItem[]> {
  await ensureOddsTables()
  const r = await rows(sql`SELECT q.*, s.site_name FROM odds_queue q LEFT JOIN odds_sources s ON s.id = q.source_id
    ORDER BY (q.state = 'held') DESC, q.created_at DESC LIMIT ${Math.min(Math.max(Math.trunc(limit) || 40, 1), 100)}`)
  return r.map(mapQueue)
}

export type QueueAction = 'media' | 'text' | 'send' | 'dismiss'

/** Panel decision on a waiting or skipped post: retry with its media, share as text, share anyway, or drop it. */
export async function resolveOddsQueue(id: number, action: QueueAction) {
  await ensureOddsTables()
  const [row] = await rows(sql`SELECT * FROM odds_queue WHERE id = ${id}`)
  if (!row) throw new Error('Kayıt bulunamadı; başka biri işlemiş olabilir')
  if (action === 'dismiss') {
    await rows(sql`DELETE FROM odds_queue WHERE id = ${id}`)
    return 'Kayıt silindi.'
  }
  if (row.state === 'sent') throw new Error('Bu post zaten paylaşıldı')
  const [sourceRow] = await rows(sql`SELECT *, 0 AS total FROM odds_sources WHERE id = ${Number(row.source_id)}`)
  if (!sourceRow) throw new Error('Bu postun kaynağı silinmiş')
  const source = mapSource(sourceRow, await sponsorLinks())
  const config = await getOddsBotConfig()
  if (!config.enabled || !config.botId || !config.channelId) throw new Error('Bot kapalı ya da özel oran kanalımız seçili değil')

  let payload: Partial<QueuePayload> = {}
  try {
    payload = JSON.parse(String(row.payload ?? '{}')) as Partial<QueuePayload>
  } catch {
    payload = {}
  }
  const incoming: Incoming = {
    chatId: source.chatId,
    messageId: Number(row.source_msg),
    replyTo: payload.replyTo ?? null,
    text: String(row.body ?? ''),
    photo: payload.photo ?? null,
    edited: false,
    hasMedia: Boolean(payload.hasMedia),
    album: Array.isArray(payload.album) ? payload.album : [],
    post: payload.post ?? null,
    buttons: cleanButtons(payload.buttons),
  }
  const listed = (await rows(sql`SELECT 1 FROM special_odds WHERE source_chat = ${source.chatId} AND source_msg = ${incoming.messageId} LIMIT 1`)).length > 0
  const read = listed ? null : await readOddsPost(incoming.text, pictureOf(config, incoming))
  // An odd goes to the odds channel and a campaign to the main one; with no answer from the reader the post could be either.
  if (read?.failed && candidateKind(incoming.text) === 'odds') {
    throw new Error('Okuyucu yanıt vermedi: postun oran mı kampanya mı olduğu anlaşılamadı, bu yüzden hangi kanala gideceği belli değil. Biraz sonra tekrar dene.')
  }
  const verdict: Verdict = {
    odds: read?.odds ?? [],
    note: read?.note ?? '',
    coupon: read?.coupon ?? null,
    pass: true,
    reason: 'Panelden paylaşıldı',
    unread: Boolean(read && !read.odds.length && read.claimed),
  }
  const media = action === 'text' ? 'text' : action === 'media' ? 'media' : 'auto'
  const stored = await publishAndStore(source, incoming, payload.fromChat ?? null, verdict, media, listed).catch((error) => {
    if (error instanceof MediaError) throw new Error(`Medya yine alınamadı (${error.message}). “Yazıyla gönder” ile medyasız paylaşabilirsin.`)
    throw error
  })
  if (stored.blocked) throw new Error(stored.blocked)
  if (stored.held) return 'Medya yine alınamadı, post beklemede kaldı. “Yazıyla gönder” ile medyasız paylaşabilirsin.'
  if (!stored.ourMsg) throw new Error('Kanala gönderilemedi. Sebebi yukarıdaki durum kutusunda yazar.')
  if (listed) await rows(sql`UPDATE special_odds SET our_msg = COALESCE(our_msg, ${stored.ourMsg}) WHERE source_chat = ${source.chatId} AND source_msg = ${incoming.messageId}`)
  if (listed || stored.count) await rows(sql`DELETE FROM odds_queue WHERE id = ${id}`)
  const where = stored.outlet ? `ana kanala (${stored.outlet}) ` : ''
  return action === 'text' ? `Post ${where}yazıyla paylaşıldı.` : `Post ${where}paylaşıldı.`
}

const WEB_BATCH = 10

/**
 * Telegram only pushes channel posts to bots that are admins of that channel. Sponsor channels
 * are usually run by someone else, so public sources are read from their t.me/s web page instead.
 * Message ids match the real ones, so a post arriving via both paths is stored once.
 */
const PIN_NOTE = /tgme_widget_message_author_name[\s\S]*?<\/a>\s*pinned\b/

export async function scrapeOddsSources(config?: OddsBotConfig) {
  await ensureOddsTables()
  const cfg = config ?? (await getOddsBotConfig())
  const token = cfg.botId ? await botToken(cfg.botId).catch(() => null) : null
  const sources = await rows(sql`SELECT *, 0 AS total FROM odds_sources WHERE active ORDER BY id`)
  const sponsors = await sponsorLinks()
  let handled = 0
  for (const r of sources) {
    const source = mapSource(r, sponsors)
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
        // "Kanal pinned a photo" is Telegram's own note about a pin, not a post of the source.
        if (PIN_NOTE.test(post.html)) continue
        const text = scrapedHtmlToCleanText(post.html, { dropEmojiRuns: true })
        if (!text) continue
        const incoming: Incoming = {
          chatId: source.chatId,
          messageId: post.id,
          replyTo: post.replyTo ?? null,
          text,
          photo: post.photos[0] ?? null,
          edited: false,
          hasMedia: false,
          album: [],
          post,
          buttons: post.buttons,
        }
        await ingest(source, incoming, null).catch((error) => console.error('[odds-bot] web ingest failed', error))
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
  await restoreSponsorRules().catch((error) => console.error('[odds-bot] sponsor rules', error))
  await expireStaleOdds()
  await pruneOddsQueue().catch((error) => console.error('[odds-bot] prune', error))
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
  // A batch already holds every part of an album, so they are stored up front instead of waited for.
  for (const update of updates) {
    const m: MediaMessage | undefined = update.channel_post ?? update.message
    if (m?.media_group_id && (await findSource(m.chat).catch(() => null))) await rememberAlbumPart(m).catch(() => null)
  }
  for (const update of updates) {
    await handleOddsUpdate(update, 0).catch((error) => console.error('[odds-bot] poll update failed', error))
    await setSetting(OFFSET_KEY, String(update.update_id + 1))
  }
  return { handled: updates.length }
}

/** Skipped and rule-shared records are a short-lived log; waiting posts stay until someone decides. */
async function pruneOddsQueue() {
  await rows(sql`DELETE FROM odds_queue WHERE state <> 'held' AND created_at < now() - interval '7 days'`)
  await rows(sql`DELETE FROM odds_album WHERE created_at < now() - interval '1 day'`)
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
    tag: toOddsTag(r.tag),
    tagText: String(r.tag_text ?? ''),
    link: String(r.link),
    // Rows saved before the scraper decoded entities still hold text like "&#33;".
    match: decodeEntities(String(r.match)),
    league: decodeEntities(String(r.league ?? '')),
    market: decodeEntities(String(r.market ?? '')),
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

/**
 * The day's odds as members see them. Posts stored without a read odd (campaign posts an earlier
 * version shared by their first line) are left out; the panel list still shows them so they can be removed.
 */
export async function listOddsByDay(day: string) {
  try {
    await expireStaleOdds()
    const r = await rows(sql`SELECT * FROM special_odds WHERE (opened_at AT TIME ZONE 'Europe/Istanbul')::date = ${day}::date
      AND new_odd IS NOT NULL ORDER BY opened_at DESC LIMIT 300`)
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

export async function searchAdminOdds(filter: OddsFilter, limit = ODDS_PAGE): Promise<OddsPage> {
  await expireStaleOdds()
  const size = Math.min(Math.max(Math.trunc(Number(limit)) || ODDS_PAGE, 1), ODDS_MAX)
  const parts: SQL[] = []
  const q = String(filter.q ?? '').trim().slice(0, 80)
  if (q) {
    const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`
    parts.push(sql`(match ILIKE ${like} OR site_name ILIKE ${like} OR league ILIKE ${like} OR market ILIKE ${like})`)
  }
  if (filter.pending) parts.push(sql`result IS NULL AND status <> 'open'`)
  const where = parts.length ? sql`WHERE ${sql.join(parts, sql` AND `)}` : sql``
  const r = await rows(sql`SELECT * FROM special_odds ${where} ORDER BY opened_at DESC, id DESC LIMIT ${size + 1}`)
  return { rows: r.slice(0, size).map(mapOdd), hasMore: r.length > size }
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
