'use server'

import { logged } from '@/lib/panel-log'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { after } from 'next/server'
import { getPanelSession } from '@/lib/admin-auth'
import { telegramAccess, type TelegramArea } from '@/lib/panel-modules'
import {
  CANNED_MAX,
  CAPTCHA_MODES,
  CONTENT_KINDS,
  DEFAULT_HUB,
  GUARD_TUNABLES,
  MAX_SPONSOR_GROUPS,
  REPLY_BUTTON_MAX,
  REPLY_RULE_MAX,
  REPLY_WORD_MAX,
  SHIELD_TUNABLES,
  clockMinutes,
  generalRules,
  readReplyButtons,
  rulesDiff,
  withSponsorGroup,
  type ContentRule,
  type DmDraft,
  type GroupRules,
  type HubConfig,
  type LogFilter,
  type LogPage,
  type MemberAction,
  type MemberCard,
  type QuietConfig,
  type ReplyRule,
  type ShieldConfig,
  type SuspectRow,
  type TicketPage,
} from '@/lib/tg-hub-shared'
import { CHANGE_IMPORT, CHANGE_RESTORE, type ConfigChange } from '@/lib/tg-resilience-shared'
import type { TgStatus } from '@/lib/tg-status-shared'
import { setShareBot } from '@/lib/telegram-bots'
import { getHub, registerHook, removeGlobalBan, resolveChatFor, saveHub, setTrusted, syncGuardHook } from '@/lib/tg-hub'

type Result = { ok: boolean; message: string }
const EXPIRED: Result = { ok: false, message: 'Oturum süresi doldu, tekrar giriş yap.' }
const DENIED: Record<TelegramArea | 'owner', string> = {
  posts: 'Bu işlem için "Telegram postları" izni gerekli.',
  mod: 'Bu işlem için "Telegram moderasyon" izni gerekli.',
  setup: 'Bu işlem için "Telegram kurulum" izni gerekli.',
  owner: 'Bu işlemi sadece ana yönetici yapabilir.',
}
const fail = (error: unknown): Result => ({ ok: false, message: String((error as Error)?.message ?? error) })

/** Null when the signed-in account may go on; otherwise the reason to show it. */
async function blocked(area: TelegramArea | 'owner'): Promise<Result | null> {
  const session = await getPanelSession()
  if (!session) return EXPIRED
  const access = telegramAccess(session)
  return (area === 'owner' ? access.owner : access[area]) ? null : { ok: false, message: DENIED[area] }
}

/** Written into the log so an action taken from the panel can be traced to a person. */
async function actor() {
  const session = await getPanelSession()
  return session?.displayName || session?.username || 'Panel'
}
const done = (message: string): Result => {
  revalidatePath('/panel')
  return { ok: true, message }
}

/** Saves the settings and keeps what they were, so a change can be traced to a person and reversed. Returns the lines that changed. */
async function commit(before: HubConfig, after: HubConfig, what: string) {
  await saveHub(after)
  const { recordHubChange } = await import('@/lib/tg-history')
  return recordHubChange(before, after, await actor(), what).catch((error) => {
    console.error('[panel] settings history', error)
    return null
  })
}

export async function repairTelegramAction(): Promise<Result> {
  const no = await blocked('setup')
  if (no) return no
  try {
    const { repairTelegram } = await import('@/lib/tg-health')
    const fixes = await repairTelegram()
    return logged('telegram', done(fixes.length ? `Düzeltildi: ${fixes.join(' · ')}` : 'Her şey yolunda, düzeltilecek bir şey bulunmadı.'))
  } catch (error) {
    return fail(error)
  }
}

async function siteOrigin() {
  const h = await headers()
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? h.get('x-forwarded-host') ?? h.get('host') ?? ''
  return host && !/localhost|127\.0\.0\.1/.test(host) ? `https://${host}` : ''
}

const clampInt = (v: unknown, min: number, max: number, fallback: number) => {
  const n = Math.round(Number(v))
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback
}
const list = (v: unknown, max = 200) =>
  (Array.isArray(v) ? v : [])
    .map((x) => String(x).trim())
    .filter(Boolean)
    .slice(0, max)

/** Keeps only known fields with safe bounds; chat ids and bot ids are never taken from here. */
function sanitizeAutoReply(r: HubConfig['autoReply']): HubConfig['autoReply'] {
  let siteUrl = String(r.siteUrl ?? '').trim()
  if (siteUrl && !/^https?:\/\//i.test(siteUrl)) siteUrl = `https://${siteUrl}`
  try {
    if (siteUrl) siteUrl = new URL(siteUrl).toString()
  } catch {
    siteUrl = ''
  }
  const w = r.welcome ?? DEFAULT_HUB.autoReply.welcome
  return {
    enabled: Boolean(r.enabled),
    cooldownSeconds: clampInt(r.cooldownSeconds, 10, 3600, 120),
    siteUrl,
    siteText: String(r.siteText ?? '').slice(0, 400) || DEFAULT_HUB.autoReply.siteText,
    sponsorText: String(r.sponsorText ?? '').slice(0, 400) || DEFAULT_HUB.autoReply.sponsorText,
    sponsorLimit: clampInt(r.sponsorLimit, 1, 20, 8),
    rules: replyRules(r.rules),
    welcome: {
      enabled: Boolean(w.enabled),
      text: String(w.text ?? '').trim().slice(0, 1000) || DEFAULT_HUB.autoReply.welcome.text,
      buttons: readReplyButtons(w.buttons, REPLY_BUTTON_MAX).buttons,
      deleteMinutes: clampInt(w.deleteMinutes, 0, 1440, 5),
    },
  }
}

const RULE_ID = /^[a-z0-9]{4,16}$/i

function replyRules(raw: unknown): ReplyRule[] {
  const seen = new Set<string>()
  return (Array.isArray(raw) ? (raw as Partial<ReplyRule>[]) : []).slice(0, REPLY_RULE_MAX).map((rule) => {
    // The id names the rule's cooldown slot, so two rules must never share one.
    let id = RULE_ID.test(String(rule?.id ?? '')) ? String(rule.id) : ''
    if (!id || seen.has(id)) id = crypto.randomUUID().replace(/-/g, '').slice(0, 10)
    seen.add(id)
    return {
      id,
      enabled: Boolean(rule?.enabled),
      words: list(rule?.words, REPLY_WORD_MAX).map((word) => word.slice(0, 40)),
      text: String(rule?.text ?? '').trim().slice(0, 1000),
      buttons: readReplyButtons(rule?.buttons, REPLY_BUTTON_MAX).buttons,
    }
  })
}

/** What would be lost or left unusable on save, in words; null when the form can be stored as it is. */
function autoReplyProblem(r: HubConfig['autoReply'] | undefined): string | null {
  const rules = Array.isArray(r?.rules) ? r.rules : []
  if (rules.length > REPLY_RULE_MAX) return `En fazla ${REPLY_RULE_MAX} oto cevap kuralı olabilir.`
  for (const [i, rule] of rules.entries()) {
    const label = `${i + 1}. oto cevap kuralı`
    if (!list(rule?.words, REPLY_WORD_MAX + 1).length) return `${label}: en az bir tetikleyici kelime yaz.`
    if (list(rule?.words, REPLY_WORD_MAX + 1).length > REPLY_WORD_MAX) return `${label}: en fazla ${REPLY_WORD_MAX} tetikleyici kelime olabilir.`
    if (!String(rule?.text ?? '').trim()) return `${label}: cevap yazısı boş.`
    const { problem } = readReplyButtons(rule?.buttons, REPLY_BUTTON_MAX)
    if (problem) return `${label}: ${problem}`
  }
  const welcome = readReplyButtons(r?.welcome?.buttons, REPLY_BUTTON_MAX).problem
  return welcome ? `Karşılama mesajı: ${welcome}` : null
}

function quietConfig(q: Partial<QuietConfig> | undefined): QuietConfig {
  const base = DEFAULT_HUB.shield.quiet
  const clock = (value: unknown, fallback: string) => (clockMinutes(String(value ?? '')) == null ? fallback : String(value).trim())
  return {
    enabled: Boolean(q?.enabled),
    from: clock(q?.from, base.from),
    to: clock(q?.to, base.to),
    mode: q?.mode === 'text' ? 'text' : 'lock',
    announce: q?.announce !== false,
  }
}

function quietProblem(q: Partial<QuietConfig> | undefined): string | null {
  if (!q?.enabled) return null
  if (clockMinutes(String(q.from ?? '')) == null || clockMinutes(String(q.to ?? '')) == null) return 'Sessiz saatler: başlangıç ve bitiş saatini SS:DD biçiminde yaz (örnek 01:00).'
  return q.from === q.to ? 'Sessiz saatler: başlangıç ile bitiş aynı olamaz.' : null
}

/** A changed window should take hold now, not at the next visitor. */
function applyQuietHours() {
  after(async () => {
    const { runQuietHours } = await import('@/lib/tg-quiet')
    await runQuietHours().catch((error) => console.error('[panel] quiet hours', error))
  })
}

type GuardTunables = Pick<HubConfig['guard'], (typeof GUARD_TUNABLES)[number]>
type ShieldTunables = Pick<ShieldConfig, (typeof SHIELD_TUNABLES)[number]>

/** The guard settings a single group may override; the same bounds apply to the general values. */
function guardTunables(g: Partial<GuardTunables>): GuardTunables {
  return {
    warnLimit: clampInt(g.warnLimit, 1, 10, 3),
    muteMinutes: list(g.muteMinutes, 5).map((m) => clampInt(m, 1, 43200, 60)),
    floodCount: clampInt(g.floodCount, 3, 30, 5),
    floodSeconds: clampInt(g.floodSeconds, 3, 120, 10),
    floodMuteMinutes: clampInt(g.floodMuteMinutes, 1, 1440, 30),
    repeatLimit: clampInt(g.repeatLimit, 2, 20, 3),
    linkAction: g.linkAction === 'warn' ? 'warn' : 'ban',
    blockForwards: Boolean(g.blockForwards),
    cleanService: Boolean(g.cleanService),
    captcha: Boolean(g.captcha),
    captchaMode: CAPTCHA_MODES.find((m) => m.value === g.captchaMode)?.value ?? 'button',
    raidJoins: clampInt(g.raidJoins, 0, 500, 20),
  }
}

/** Zero switches a limit off; anything between zero and `floor` would fire on ordinary activity, so it is raised to `floor`. */
const limitOrOff = (v: unknown, floor: number, max: number) => {
  const n = clampInt(v, 0, max, 0)
  return n > 0 && n < floor ? floor : n
}

function shieldTunables(s: Partial<ShieldTunables>): ShieldTunables {
  const content = { ...DEFAULT_HUB.shield.content }
  for (const { key } of CONTENT_KINDS) {
    const rule = s.content?.[key] as ContentRule | undefined
    content[key] = rule === 'new' || rule === 'block' ? rule : 'allow'
  }
  return {
    raidMode: Boolean(s.raidMode),
    raidMinutes: clampInt(s.raidMinutes, 1, 240, 15),
    raidLock: Boolean(s.raidLock),
    inviteLimit: clampInt(s.inviteLimit, 0, 100, 0),
    inviteLock: Boolean(s.inviteLock),
    commentShield: Boolean(s.commentShield),
    commentRate: limitOrOff(s.commentRate, 5, 500),
    commentLockMinutes: clampInt(s.commentLockMinutes, 1, 240, 10),
    quarantineHours: clampInt(s.quarantineHours, 0, 168, 0),
    content,
    swarmAccounts: limitOrOff(s.swarmAccounts, 2, 20),
    hiddenAds: Boolean(s.hiddenAds),
    nameWatch: Boolean(s.nameWatch),
    quiet: quietConfig(s.quiet),
  }
}

/** The whole protection form: the per-group tunables plus the switches that only exist once for all chats. */
function shieldConfig(input: Partial<ShieldConfig> | undefined): ShieldConfig {
  return {
    ...shieldTunables(input ?? {}),
    channelJoinAlert: limitOrOff(input?.channelJoinAlert, 5, 100000),
    adminAlerts: Boolean(input?.adminAlerts),
    reactionLimit: limitOrOff(input?.reactionLimit, 5, 120),
    healthAlert: Boolean(input?.healthAlert),
    memberDropPercent: clampInt(input?.memberDropPercent, 1, 90, 10),
  }
}

/** Telegram is told which update types to send; a changed setting may need a different list. */
async function hookNote() {
  try {
    await syncGuardHook()
    return ''
  } catch (error) {
    return ` Ancak Bekçi botunun bağlantısı güncellenemedi (${String((error as Error).message)}). Kurulum sekmesinden Bekçi'yi tekrar "Bağla".`
  }
}

function sanitize(input: HubConfig, current: HubConfig): HubConfig {
  const g = input.guard ?? DEFAULT_HUB.guard
  const c = input.counter ?? DEFAULT_HUB.counter
  const s = input.support ?? DEFAULT_HUB.support
  return {
    ...current,
    guard: {
      ...guardTunables(g),
      enabled: Boolean(g.enabled),
      words: list(g.words, 500).map((w) => w.toLocaleLowerCase('tr').slice(0, 40)),
      allowDomains: list(g.allowDomains, 50).map((d) => d.toLowerCase().replace(/^https?:\/\//, '').slice(0, 80)),
      casCheck: Boolean(g.casCheck),
      impersonation: Boolean(g.impersonation),
      aiModeration: Boolean(g.aiModeration),
      rules: String(g.rules ?? '').slice(0, 1500),
    },
    counter: {
      enabled: Boolean(c.enabled),
      rewards: list(c.rewards, 10).map((r) => clampInt(r, 0, 100000, 0)),
      minLength: clampInt(c.minLength, 1, 50, 3),
      postToChatId: current.counter.postToChatId,
    },
    support: {
      ...current.support,
      enabled: Boolean(s.enabled),
      categories: list(s.categories, 12).map((x) => x.slice(0, 30)),
      aiFaq: Boolean(s.aiFaq),
      welcome: String(s.welcome ?? '').slice(0, 600),
      canned: (Array.isArray(s.canned) ? s.canned : [])
        .map((c) => ({ title: String(c?.title ?? '').trim().slice(0, 40), text: String(c?.text ?? '').trim().slice(0, 1000) }))
        .filter((c) => c.title && c.text)
        .slice(0, CANNED_MAX),
      alertMinutes: limitOrOff(s.alertMinutes, 5, 1440),
    },
    report: { enabled: Boolean(input.report?.enabled) },
    autoReply: sanitizeAutoReply(input.autoReply ?? DEFAULT_HUB.autoReply),
  }
}

export async function saveHubSettings(input: HubConfig): Promise<Result> {
  const no = await blocked('setup')
  if (no) return no
  try {
    const problem = autoReplyProblem(input?.autoReply)
    if (problem) return { ok: false, message: problem }
    const half = (Array.isArray(input?.support?.canned) ? input.support.canned : []).findIndex((c) => Boolean(String(c?.title ?? '').trim()) !== Boolean(String(c?.text ?? '').trim()))
    if (half >= 0) return { ok: false, message: `${half + 1}. hazır cevap: hem başlık hem cevap yazısı dolu olmalı.` }
    const current = await getHub()
    await commit(current, sanitize(input, current), 'Genel ayarlar')
    return logged('telegram', done(`Ayarlar kaydedildi.${await hookNote()}`))
  } catch (error) {
    return fail(error)
  }
}

export async function saveShieldSettings(input: ShieldConfig): Promise<Result> {
  const no = await blocked('setup')
  if (no) return no
  try {
    const problem = quietProblem(input?.quiet)
    if (problem) return { ok: false, message: problem }
    const current = await getHub()
    await commit(current, { ...current, shield: shieldConfig(input) }, 'Koruma ayarları')
    applyQuietHours()
    return logged('telegram', done(`Koruma ayarları kaydedildi.${await hookNote()}`))
  } catch (error) {
    return fail(error)
  }
}

/** `null` puts the group back on the general settings. */
export async function saveGroupRules(chatId: string, input: GroupRules | null): Promise<Result> {
  const no = await blocked('setup')
  if (no) return no
  try {
    const hub = await getHub()
    const group = hub.groups.find((g) => g.chatId === String(chatId))
    if (!group) return { ok: false, message: 'Bu grup korunan listede değil.' }
    if (group.type === 'channel') return { ok: false, message: 'Kanalda mesaj kuralları çalışmaz; ayrı ayar sadece gruplar için.' }
    const problem = quietProblem(input?.quiet)
    if (problem) return { ok: false, message: problem }
    const own = input ? rulesDiff(generalRules(hub), { ...guardTunables(input), ...shieldTunables(input) }) : {}
    const count = Object.keys(own).length
    const groups = hub.groups.map((g) => (g.chatId === group.chatId ? { ...g, rules: count ? own : undefined } : g))
    await commit(hub, { ...hub, groups }, 'Gruba özel ayar')
    applyQuietHours()
    if (!input) return logged('telegram', done(`"${group.title}" genel ayarlara döndü.`))
    return logged('telegram', done(count ? `"${group.title}" için ${count} ayar genelden farklı kaydedildi.` : `"${group.title}" ayarları genel ayarlarla aynı, ayrı kayıt tutulmadı.`))
  } catch (error) {
    return fail(error)
  }
}

export async function unlockChatAction(chatId: string): Promise<Result> {
  const no = await blocked('mod')
  if (no) return no
  try {
    const { panelUnlock } = await import('@/lib/tg-guard')
    const res = await panelUnlock(String(chatId))
    return logged('tg_mod', res.ok ? done(res.message) : res)
  } catch (error) {
    return fail(error)
  }
}

export async function sweepWaveAction(chatId: string): Promise<Result> {
  const no = await blocked('mod')
  if (no) return no
  try {
    const { panelSweepWave } = await import('@/lib/tg-guard')
    const res = await panelSweepWave(String(chatId))
    if (!res.removed && !res.left) return logged('tg_mod', { ok: true, message: 'Son 30 dakikada girip hâlâ içeride olan kimse kayıtlı değil.' })
    return logged('tg_mod', done(`${res.removed} kişi 10 dakikalığına çıkarıldı.${res.left ? ` ${res.left} kişi kaldı, tekrar bas.` : ''}`))
  } catch (error) {
    return fail(error)
  }
}

/** Loaded on request: the query reads the whole message and join history, so it does not run on every panel visit. */
export async function loadSuspects(): Promise<SuspectRow[]> {
  if (await blocked('mod')) return []
  const { listSuspects } = await import('@/lib/tg-shield')
  return listSuspects()
}

export async function suspectAction(ids: number[], action: 'ban' | 'mute' | 'wipe' | 'clear'): Promise<Result> {
  const no = await blocked('mod')
  if (no) return no
  if (!['ban', 'mute', 'wipe', 'clear'].includes(action)) return { ok: false, message: 'Geçersiz işlem.' }
  try {
    const { suspectAct } = await import('@/lib/tg-guard')
    return logged('tg_mod', done(await suspectAct(Array.isArray(ids) ? ids : [], action)))
  } catch (error) {
    return fail(error)
  }
}

export async function undoLogAction(logId: number): Promise<Result> {
  const no = await blocked('mod')
  if (no) return no
  try {
    const { undoLog } = await import('@/lib/tg-guard')
    const res = await undoLog(Number(logId), await actor())
    return logged('tg_mod', res.ok ? done(res.message) : res)
  } catch (error) {
    return fail(error)
  }
}

export async function setRoleBot(role: 'guard' | 'support' | 'share', botId: number | null): Promise<Result> {
  const no = await blocked('setup')
  if (no) return no
  try {
    if (role === 'share') {
  if (!botId) return { ok: false, message: 'Bot seç.' }
  await setShareBot(botId)
  } else {
      const hub = await getHub()
      await commit(hub, role === 'guard' ? { ...hub, guardBotId: botId } : { ...hub, supportBotId: botId }, 'Bot görevi')
      if (!botId) return logged('telegram', done('Rol kaldırıldı.'))
    }
    const origin = await siteOrigin()
    if (!origin) return { ok: false, message: 'Bot bağlantısı yalnızca yayındaki sitede kurulabilir. Siteyi yayınla, paneli canlı adresten aç.' }
    await registerHook(botId!, origin)
    return logged('telegram', done('Bot bağlandı ve anında haber alacak şekilde ayarlandı.'))
  } catch (error) {
    return fail(error)
  }
}

export async function addHubChat(kind: 'group' | 'log' | 'staff' | 'sponsor' | 'leader', input: string, sponsorName = ''): Promise<Result> {
  const no = await blocked('setup')
  if (no) return no
  try {
    const hub = await getHub()
    const botId = kind === 'staff' || kind === 'sponsor' ? hub.supportBotId : hub.guardBotId
    if (!botId) return { ok: false, message: kind === 'staff' || kind === 'sponsor' ? 'Önce Destek botunu seç.' : 'Önce Bekçi botunu seç.' }
    const botName = kind === 'staff' || kind === 'sponsor' ? 'Destek botu' : 'Bekçi botu'
    const sponsor = sponsorName.replace(/\s+/g, ' ').trim().slice(0, 60)
    if (kind === 'sponsor') {
      if (!sponsor) return { ok: false, message: 'Sponsor adını yaz.' }
      if (/^-?\d{5,}$/.test(sponsor) || /^@\w+$/.test(sponsor) || /t\.me\//i.test(sponsor)) {
        return { ok: false, message: 'Sponsor adı kutusuna grup adresi yazılmış. Sponsorun adını ilk kutuya, grubu ikinci kutuya yaz.' }
      }
    }
    if (!input.trim()) return { ok: false, message: kind === 'sponsor' ? 'Sponsorun destek grubunu seç ya da grup numarasını yaz.' : 'Grup adresi ya da ID gir.' }
    let chat: Awaited<ReturnType<typeof resolveChatFor>>
    try {
      chat = await resolveChatFor(botId, input)
    } catch (error) {
      const text = String((error as Error)?.message ?? error)
      if (/chat not found|not a member|was kicked|PEER_ID_INVALID|chat_id is empty/i.test(text)) {
        return { ok: false, message: `${botName} bu grubu göremiyor. Önce ${botName}nu gruba ekleyip yönetici yap, grup numarasının -100 ile başladığına bak, sonra yeniden dene.` }
      }
      return fail(error)
    }
    if (!chat.isAdmin) return { ok: false, message: `${botName} "${chat.title}" içinde yönetici değil. Önce botu yönetici yap.` }
    let next: HubConfig = hub
    if (kind === 'group') {
      if (hub.groups.some((g) => g.chatId === chat.id)) return { ok: false, message: 'Bu grup zaten ekli.' }
      next = { ...hub, groups: [...hub.groups, { chatId: chat.id, title: chat.title, type: chat.type, linkedChatId: chat.linkedChatId }].slice(0, 30) }
    } else if (kind === 'log') next = { ...hub, logChatId: chat.id, logChatTitle: chat.title }
    else if (kind === 'leader') next = { ...hub, counter: { ...hub.counter, postToChatId: chat.id } }
    else if (kind === 'staff') next = { ...hub, support: { ...hub.support, staffChatId: chat.id, staffChatTitle: chat.title } }
    else {
      if (chat.id === hub.support.staffChatId) return { ok: false, message: 'Bu grup yetkili grubu. Sponsor için ayrı bir grup aç.' }
      const sponsors = withSponsorGroup(hub.support.sponsors, { name: sponsor, chatId: chat.id, title: chat.title })
      if (!sponsors) return { ok: false, message: `En fazla ${MAX_SPONSOR_GROUPS} sponsor grubu bağlanabilir. Önce kullanılmayan bir grubu kaldır.` }
      next = { ...hub, support: { ...hub.support, sponsors } }
    }
    await commit(hub, next, 'Sohbet bağlantısı')
    return logged('telegram', done(kind === 'sponsor' ? `${sponsor} sponsoru "${chat.title}" grubuna bağlandı.` : `"${chat.title}" eklendi.`))
  } catch (error) {
    return fail(error)
  }
}

export async function removeHubChat(kind: 'group' | 'log' | 'staff' | 'sponsor' | 'leader', key: string): Promise<Result> {
  const no = await blocked('setup')
  if (no) return no
  const hub = await getHub()
  let next: HubConfig = hub
  if (kind === 'group') next = { ...hub, groups: hub.groups.filter((g) => g.chatId !== key) }
  else if (kind === 'log') next = { ...hub, logChatId: '', logChatTitle: '' }
  else if (kind === 'leader') next = { ...hub, counter: { ...hub.counter, postToChatId: '' } }
  else if (kind === 'staff') next = { ...hub, support: { ...hub.support, staffChatId: '', staffChatTitle: '' } }
  else next = { ...hub, support: { ...hub.support, sponsors: hub.support.sponsors.filter((s) => s.name !== key) } }
  await commit(hub, next, 'Sohbet bağlantısı')
  return logged('telegram', done('Kaldırıldı.'))
}

// --- Settings history and backup -----------------------------------------------------

const BACKUP_KIND = 'alkanka-telegram-ayar'
const BACKUP_MAX_CHARS = 400_000

/**
 * Rebuilds the settings from a saved copy, with the same bounds a form save gets. Which bot does which job
 * and which chats are connected is wiring, not a setting: that always stays as it is now, so an old copy
 * can never point the panel at a bot or a group that no longer exists.
 */
function settingsFrom(raw: unknown, current: HubConfig): HubConfig {
  const saved = (raw && typeof raw === 'object' ? raw : {}) as Partial<HubConfig>
  const part = <K extends 'guard' | 'counter' | 'support' | 'report' | 'autoReply' | 'shield'>(key: K): HubConfig[K] => ({
    ...DEFAULT_HUB[key],
    ...((saved[key] && typeof saved[key] === 'object' ? saved[key] : {}) as HubConfig[K]),
  })
  const input = { ...current, guard: part('guard'), counter: part('counter'), support: part('support'), report: part('report'), autoReply: part('autoReply') }
  const next: HubConfig = { ...sanitize(input, current), shield: shieldConfig(part('shield')) }
  const general = generalRules(next)
  const savedGroups = new Map((Array.isArray(saved.groups) ? saved.groups : []).map((g) => [String(g?.chatId ?? ''), g]))
  const groups = current.groups.map((g) => {
    const old = savedGroups.get(g.chatId)
    // A group the copy has never heard of keeps the rules it has today.
    if (!old) return g
    if (g.type === 'channel' || !old.rules || typeof old.rules !== 'object') return { ...g, rules: undefined }
    const full = { ...general, ...old.rules }
    const own = rulesDiff(general, { ...guardTunables(full), ...shieldTunables(full) })
    return { ...g, rules: Object.keys(own).length ? own : undefined }
  })
  return { ...next, groups }
}

async function applySettings(raw: unknown, what: string): Promise<string[] | null> {
  const current = await getHub()
  const changes = await commit(current, settingsFrom(raw, current), what)
  applyQuietHours()
  return changes
}

export async function loadConfigHistoryAction(): Promise<ConfigChange[]> {
  if (await blocked('setup')) return []
  const { listHubChanges } = await import('@/lib/tg-history')
  return listHubChanges()
}

export async function restoreConfigAction(id: number): Promise<Result> {
  const no = await blocked('setup')
  if (no) return no
  try {
    const { snapshotBefore } = await import('@/lib/tg-history')
    const snap = await snapshotBefore(Number(id))
    if (!snap) return { ok: false, message: 'Bu kayıt bulunamadı ya da okunamıyor.' }
    const changes = await applySettings(snap.config, CHANGE_RESTORE)
    if (changes && !changes.length) return logged('telegram', { ok: true, message: 'Ayarlar zaten o kayıttaki hâlinde; değişen bir şey olmadı.' })
    return logged('telegram', done(`Ayarlar seçtiğin değişiklikten önceki hâline döndü. Bot ve sohbet bağlantılarına dokunulmadı.${await hookNote()}`))
  } catch (error) {
    return fail(error)
  }
}

export async function exportConfigAction(): Promise<Result & { json?: string }> {
  const no = await blocked('setup')
  if (no) return no
  try {
    const config = await getHub()
    return logged('telegram', { ok: true, message: 'Yedek indirildi.', json: JSON.stringify({ kind: BACKUP_KIND, savedAt: new Date().toISOString(), config }, null, 2) })
  } catch (error) {
    return fail(error)
  }
}

export async function importConfigAction(json: string): Promise<Result> {
  const no = await blocked('setup')
  if (no) return no
  try {
    if (typeof json !== 'string' || json.length > BACKUP_MAX_CHARS) return { ok: false, message: 'Dosya çok büyük ya da boş; bu bir ayar yedeği değil.' }
    let parsed: unknown
    try {
      parsed = JSON.parse(json)
    } catch {
      return { ok: false, message: 'Dosya okunamadı. Panelden indirdiğin .json yedeğini seç.' }
    }
    const wrapper = parsed as { kind?: unknown; config?: unknown } | null
    const config = (wrapper?.kind === BACKUP_KIND ? wrapper.config : parsed) as Partial<HubConfig> | null
    if (!config || typeof config !== 'object' || typeof config.guard !== 'object' || typeof config.shield !== 'object') {
      return { ok: false, message: 'Bu dosya bir Telegram ayar yedeği değil.' }
    }
    const changes = await applySettings(config, CHANGE_IMPORT)
    if (changes && !changes.length) return logged('telegram', { ok: true, message: 'Yedekteki ayarlar şu ankiyle aynı; değişen bir şey olmadı.' })
    return logged('telegram', done(`Yedekteki ayarlar yüklendi${changes ? ` (${changes.length} ayar değişti)` : ''}. Bot ve sohbet bağlantılarına dokunulmadı.${await hookNote()}`))
  } catch (error) {
    return fail(error)
  }
}

export async function sweepGhosts(chatInput: string): Promise<Result> {
  const no = await blocked('mod')
  if (no) return no
  try {
    const hub = await getHub()
    if (!hub.guardBotId) return { ok: false, message: 'Önce Bekçi botunu seç (Kurulum sekmesi).' }
    if (!chatInput.trim()) return { ok: false, message: 'Grup seç ya da @kullaniciadi / -100… ID yaz.' }
    const chat = await resolveChatFor(hub.guardBotId, chatInput)
    if (chat.type === 'channel') {
      return {
        ok: false,
        message: `"${chat.title}" bir kanal. Telegram, kanal abone listesini hiçbir bota vermez, bu yüzden silinmiş aboneler bot ile çıkarılamaz. Kanal > Yöneticiler > Aboneler ekranından elle çıkarman gerekir. Kanala bağlı bir tartışma grubu varsa onun ID'sini yazarak orayı tarayabilirsin.`,
      }
    }
    if (!chat.isAdmin) return { ok: false, message: `Bot "${chat.title}" içinde yönetici değil. 'Kullanıcıları yasakla' yetkisiyle yönetici yap.` }
    const { sweepDeletedAccounts } = await import('@/lib/tg-guard')
    const r = await sweepDeletedAccounts(chat.id, chat.title)
    if (r.checked === 0) {
      return logged('tg_mod', { ok: true, message: `"${chat.title}" için kontrol edilecek üye yok. Bot sadece grupta yazmış üyeleri tanıyabilir; bot gruba girdikten sonra mesaj atanlar taranır.` })
    }
    return logged('tg_mod', done(`"${chat.title}": ${r.checked} hesap kontrol edildi, ${r.removed} silinmiş hesap çıkarıldı.`))
  } catch (error) {
    return fail(error)
  }
}

export type WipeJob = {
  chatId: string
  title: string
  left: number
  total: number
  deleted: number
  note: string | null
  startedBy: string
  startedAt: string
}

/** Pushes running wipes forward while the panel is open, then reports where each one stands. */
export async function pumpWipes(): Promise<WipeJob[]> {
  if (await blocked('mod')) return []
  const { processWipes, listWipes } = await import('@/lib/tg-guard')
  await processWipes(12_000).catch((e) => console.error('[tg-hub] wipe pump', e))
  const jobs = await listWipes()
  // Revives the background chain if it ever stopped (e.g. a deploy cut it off).
  if (jobs.length) await kickWipeRunner()
  return jobs
}

/** Starts the self-chaining /api/telegram/wipe runner without waiting for it to finish. */
async function kickWipeRunner() {
  try {
    const h = await headers()
    const host = h.get('x-forwarded-host') ?? h.get('host')
    if (!host) return
    const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
    const { getCronKey } = await import('@/lib/telegram-mirror')
    const url = `${proto}://${host}/api/telegram/wipe`
    await fetch(url, {
      cache: 'no-store',
      headers: { authorization: `Bearer ${await getCronKey()}` },
      signal: AbortSignal.timeout(1500),
    }).catch(() => null)
  } catch (error) {
    console.error('[tg-hub] wipe kick', error)
  }
}

export async function stopWipe(chatId: string): Promise<Result> {
  const no = await blocked('mod')
  if (no) return no
  const { cancelWipe } = await import('@/lib/tg-guard')
  return logged('tg_mod', (await cancelWipe(chatId)) ? done('Temizlik durduruldu.') : { ok: false, message: 'Bu sohbet için çalışan temizlik yok.' })
}

export async function wipeWholeChat(chatInput: string): Promise<Result> {
  const no = await blocked('owner')
  if (no) return no
  try {
    const hub = await getHub()
    if (!hub.guardBotId) return { ok: false, message: 'Önce Bekçi botunu seç.' }
    if (!chatInput.trim()) return { ok: false, message: 'Grup ya da kanal seç.' }
    const chat = await resolveChatFor(hub.guardBotId, chatInput)
    if (!chat.isAdmin) return { ok: false, message: `Bot "${chat.title}" içinde yönetici değil.` }
    const { callBot, botToken } = await import('@/lib/telegram-mirror')
    const token = await botToken(hub.guardBotId)
    // The newest message id is unknown from the panel, so a marker message gives the starting point.
    const marker = await callBot<{ message_id: number }>(token, 'sendMessage', { chat_id: chat.id, text: 'Sohbet temizliği başlıyor…' })
    const { startWipe } = await import('@/lib/tg-guard')
    await startWipe(hub.guardBotId, chat.id, chat.title, marker.message_id, 'Panel')
    await kickWipeRunner()
    return logged('telegram', done(`"${chat.title}" temizliği başladı. Arka planda kendi kendine devam eder, paneli kapatsan da durmaz.`))
  } catch (error) {
    return fail(error)
  }
}

export async function wipeUserMessages(tgIdInput: string): Promise<Result> {
  const no = await blocked('mod')
  if (no) return no
  const raw = String(tgIdInput ?? '').trim().slice(0, 80)
  if (!raw) return { ok: false, message: 'Telegram ID ya da @kullaniciadi yaz.' }
  try {
    const { deleteUserMessages, findWriterIds } = await import('@/lib/tg-guard')
    let tgId = Number(raw)
    if (!/^\d+$/.test(raw)) {
      const ids = await findWriterIds(raw)
      if (!ids.length) return { ok: false, message: `"${raw}" son 35 günde korunan gruplarda yazmamış, bulamadım. Telegram ID'sini yaz (log grubundaki kayıtta yazar).` }
      if (ids.length > 1) return { ok: false, message: `"${raw}" adıyla birden çok hesap var. Yanlış kişiyi silmemek için Telegram ID'sini yaz.` }
      tgId = ids[0]
    }
    if (!Number.isSafeInteger(tgId) || tgId <= 0) return { ok: false, message: 'Geçerli bir Telegram ID ya da @kullaniciadi yaz.' }
    const n = await deleteUserMessages(tgId)
    return logged('tg_mod', done(`${n} mesaj silindi (Telegram sadece son 48 saati sildirir).`))
  } catch (error) {
    return fail(error)
  }
}

export async function unbanEverywhere(tgId: number): Promise<Result> {
  const no = await blocked('owner')
  if (no) return no
  const id = Number(tgId)
  if (!Number.isSafeInteger(id) || id <= 0) return { ok: false, message: 'Geçersiz Telegram ID.' }
  try {
    await removeGlobalBan(id)
    const { modLog } = await import('@/lib/tg-hub')
    await modLog({ user: { id }, action: 'Yasak kaldırıldı', reason: `Genel yasak listesinden çıkarıldı (panelden, ${await actor()})`, notify: false })
    return logged('telegram', done('Yasak kaldırıldı. Kişi gruplara kendisi tekrar girmeli.'))
  } catch (error) {
    return fail(error)
  }
}

// --- Status, log browser, member card ------------------------------------------------

/** Calls Telegram for every bot and chat, so the panel asks for it instead of loading it with the page. */
export async function loadTgStatusAction(): Promise<TgStatus | null> {
  const session = await getPanelSession()
  const access = telegramAccess(session)
  if (!access.mod && !access.setup) return null
  const { loadTgStatus } = await import('@/lib/tg-status')
  return loadTgStatus()
}

export async function searchLogAction(filter: LogFilter, beforeId?: number): Promise<LogPage> {
  if (await blocked('mod')) return { rows: [], hasMore: false }
  const { searchModLog } = await import('@/lib/tg-log')
  return searchModLog(filter ?? {}, beforeId)
}

export async function exportLogAction(filter: LogFilter): Promise<Result & { csv?: string }> {
  const no = await blocked('mod')
  if (no) return no
  try {
    const { exportModLog } = await import('@/lib/tg-log')
    const r = await exportModLog(filter ?? {})
    if (!r.count) return { ok: false, message: 'Bu filtreyle kayıt yok.' }
    return logged('tg_mod', { ok: true, csv: r.csv, message: r.capped ? `İlk ${r.count} kayıt indirildi; daha fazlası için tarih aralığını daralt.` : `${r.count} kayıt indirildi.` })
  } catch (error) {
    return fail(error)
  }
}

export async function loadMemberCardAction(tgId: number): Promise<MemberCard | null> {
  if (await blocked('mod')) return null
  const session = await getPanelSession()
  const { memberCard } = await import('@/lib/tg-member')
  // The e-mail address is member data; it is shown only to accounts that may open the members list anyway.
  return memberCard(Number(tgId), { withEmail: Boolean(session && (session.isOwner || session.permissions.includes('users'))) })
}

/** Turns what was typed into the lookup box into Telegram ids; more than one means the name is shared. */
export async function findMemberAction(query: string): Promise<number[]> {
  if (await blocked('mod')) return []
  const { findMemberIds } = await import('@/lib/tg-member')
  return findMemberIds(String(query ?? ''))
}

export async function memberAction(tgId: number, action: MemberAction): Promise<Result> {
  const no = await blocked('mod')
  if (no) return no
  if (!['ban', 'mute', 'unmute', 'wipe', 'clearWarns'].includes(action)) return { ok: false, message: 'Geçersiz işlem.' }
  try {
    const { memberAct } = await import('@/lib/tg-guard')
    return logged('tg_mod', done(await memberAct(Number(tgId), action, await actor())))
  } catch (error) {
    return fail(error)
  }
}

/** Cuts the tie between a Telegram account and the site membership it was connected to. */
export async function unlinkSiteAccount(tgId: number): Promise<Result> {
  const no = await blocked('mod')
  if (no) return no
  try {
    const { unlinkByTelegram } = await import('@/lib/tg-member')
    const name = await unlinkByTelegram(Number(tgId))
    if (!name) return { ok: false, message: 'Bu Telegram hesabı bir üyeliğe bağlı değil.' }
    return logged('tg_mod', done(`${name} üyeliğinin Telegram bağlantısı kaldırıldı. Üye doğru hesabı siteden yeniden bağlayabilir.`))
  } catch (error) {
    return fail(error)
  }
}

export async function markTrusted(tgId: number, trusted: boolean): Promise<Result> {
  const no = await blocked('mod')
  if (no) return no
  await setTrusted(Number(tgId), trusted)
  return logged('tg_mod', done(trusted ? 'Güvenilir olarak işaretlendi.' : 'İşaret kaldırıldı.'))
}

export async function closeTicketAction(ticketId: number, status: 'resolved' | 'rejected', answer: string): Promise<Result> {
  const no = await blocked('mod')
  if (no) return no
  const text = String(answer ?? '').trim().slice(0, 1000)
  if (!text) return { ok: false, message: 'Üyeye gidecek cevabı yaz.' }
  try {
    const { panelCloseTicket } = await import('@/lib/tg-support')
    await panelCloseTicket(Number(ticketId), status, text)
    return logged('tg_mod', done(status === 'resolved' ? 'Bilet çözüldü, üyeye bildirildi.' : 'Bilet reddedildi, üyeye nedeni bildirildi.'))
  } catch (error) {
    return fail(error)
  }
}

export async function deleteTicketAction(ticketId: number): Promise<Result> {
  const no = await blocked('mod')
  if (no) return no
  const id = Number(ticketId)
  if (!Number.isSafeInteger(id) || id <= 0) return { ok: false, message: 'Geçersiz bilet.' }
  try {
    const { deleteClosedTicket } = await import('@/lib/tg-support')
    const removed = await deleteClosedTicket(id)
    if (!removed) return { ok: false, message: 'Sadece kapanmış bilet silinir. Açık bileti önce çöz ya da reddet.' }
    const { modLog } = await import('@/lib/tg-hub')
    await modLog({ action: 'Bilet silindi', reason: `#${id} · ${removed.sponsor} · ${removed.name} (panelden)`, notify: false })
    return logged('tg_mod', done(`#${id} silindi, sponsor karnesinden de düştü.`))
  } catch (error) {
    return fail(error)
  }
}

export async function searchTicketsAction(filter: 'open' | 'closed', q: string, beforeId?: number): Promise<TicketPage> {
  if (await blocked('mod')) return { rows: [], hasMore: false }
  const { searchTickets } = await import('@/lib/tg-support')
  return searchTickets({ filter: filter === 'closed' ? 'closed' : 'open', q: String(q ?? ''), beforeId: Number(beforeId) || undefined }).catch(() => ({ rows: [], hasMore: false }))
}

export async function sendBroadcast(input: DmDraft): Promise<Result> {
  const no = await blocked('posts')
  if (no) return no
  try {
    const { getChatConfig } = await import('@/lib/telegram-chat')
    if (!(await getChatConfig())) return { ok: false, message: 'Canlı Sohbet botu bağlı değil. Önce Canlı Sohbet sekmesinden botu bağla.' }
    const { processBroadcasts, queueBroadcast } = await import('@/lib/tg-broadcast')
    const { total, sendAt, queued } = await queueBroadcast(input, await actor())
    if (!queued) return { ok: false, message: 'Bu kitlede şu an kimse yok, duyuru gönderilmedi. Başka bir kitle seç ya da ileri bir saate zamanla.' }
    if (sendAt) {
      const when = new Date(sendAt).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
      return logged('tg_posts', done(`Duyuru ${when} için zamanlandı. O saatten sonraki ilk site ziyaretinde ya da Telegram bildiriminde çıkar; kime gideceği o an yeniden sayılır (şu an ${total} kişi).`))
    }
    after(() => processBroadcasts().catch((e) => console.error('[broadcast] immediate send failed', e)))
    return logged('tg_posts', done(`Duyuru gönderilmeye başladı, ${total} kişiye gidiyor. Liste kendini yeniler.`))
  } catch (error) {
    return fail(error)
  }
}

export async function testBroadcastAction(input: DmDraft, chat: string): Promise<Result> {
  const no = await blocked('posts')
  if (no) return no
  try {
    const { testBroadcast } = await import('@/lib/tg-broadcast')
    return await testBroadcast(input, String(chat ?? ''))
  } catch (error) {
    return fail(error)
  }
}

export async function stopBroadcast(id: number): Promise<Result> {
  const no = await blocked('posts')
  if (no) return no
  const { cancelBroadcast } = await import('@/lib/tg-broadcast')
  const stopped = await cancelBroadcast(Number(id))
  return logged('tg_posts', stopped ? done('Duyuru durduruldu. O ana kadar gidenler geri alınamaz.') : { ok: false, message: 'Bu duyuru zaten bitmiş ya da durdurulmuş.' })
}

export async function sendWeeklyNow(): Promise<Result> {
  const no = await blocked('mod')
  if (no) return no
  try {
    const { runWeeklyHub } = await import('@/lib/tg-hub-jobs')
    await runWeeklyHub(true)
    return logged('tg_mod', done('Haftalık rapor gönderildi.'))
  } catch (error) {
    return fail(error)
  }
}
