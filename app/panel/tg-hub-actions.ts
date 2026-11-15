'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { after } from 'next/server'
import { canPanel } from '@/lib/admin-auth'
import {
  CONTENT_KINDS,
  DEFAULT_HUB,
  GUARD_TUNABLES,
  SHIELD_TUNABLES,
  generalRules,
  rulesDiff,
  type ContentRule,
  type GroupRules,
  type HubConfig,
  type ShieldConfig,
  type SuspectRow,
} from '@/lib/tg-hub-shared'
import { setShareBot } from '@/lib/telegram-bots'
import {
  cancelBroadcast,
  getHub,
  processBroadcasts,
  queueBroadcast,
  registerHook,
  removeGlobalBan,
  resolveChatFor,
  saveHub,
  setTrusted,
  syncGuardHook,
} from '@/lib/tg-hub'

type Result = { ok: boolean; message: string }
const EXPIRED: Result = { ok: false, message: 'Oturum süresi doldu, tekrar giriş yap.' }
const fail = (error: unknown): Result => ({ ok: false, message: String((error as Error)?.message ?? error) })
const done = (message: string): Result => {
  revalidatePath('/panel')
  return { ok: true, message }
}

export async function repairTelegramAction(): Promise<Result> {
  if (!(await canPanel('telegram'))) return EXPIRED
  try {
    const { repairTelegram } = await import('@/lib/tg-health')
    const fixes = await repairTelegram()
    return done(fixes.length ? `Düzeltildi: ${fixes.join(' · ')}` : 'Her şey yolunda, düzeltilecek bir şey bulunmadı.')
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
  return {
    enabled: Boolean(r.enabled),
    cooldownSeconds: clampInt(r.cooldownSeconds, 10, 3600, 120),
    siteUrl,
    siteText: String(r.siteText ?? '').slice(0, 400) || DEFAULT_HUB.autoReply.siteText,
    sponsorText: String(r.sponsorText ?? '').slice(0, 400) || DEFAULT_HUB.autoReply.sponsorText,
    sponsorLimit: clampInt(r.sponsorLimit, 1, 20, 8),
  }
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
    },
    report: { enabled: Boolean(input.report?.enabled) },
    autoReply: sanitizeAutoReply(input.autoReply ?? DEFAULT_HUB.autoReply),
  }
}

export async function saveHubSettings(input: HubConfig): Promise<Result> {
  if (!(await canPanel('telegram'))) return EXPIRED
  try {
    const current = await getHub()
    await saveHub(sanitize(input, current))
    return done(`Ayarlar kaydedildi.${await hookNote()}`)
  } catch (error) {
    return fail(error)
  }
}

export async function saveShieldSettings(input: ShieldConfig): Promise<Result> {
  if (!(await canPanel('telegram'))) return EXPIRED
  try {
    const current = await getHub()
    const shield: ShieldConfig = {
      ...shieldTunables(input ?? {}),
      channelJoinAlert: limitOrOff(input?.channelJoinAlert, 5, 100000),
      adminAlerts: Boolean(input?.adminAlerts),
    }
    await saveHub({ ...current, shield })
    return done(`Koruma ayarları kaydedildi.${await hookNote()}`)
  } catch (error) {
    return fail(error)
  }
}

/** `null` puts the group back on the general settings. */
export async function saveGroupRules(chatId: string, input: GroupRules | null): Promise<Result> {
  if (!(await canPanel('telegram'))) return EXPIRED
  try {
    const hub = await getHub()
    const group = hub.groups.find((g) => g.chatId === String(chatId))
    if (!group) return { ok: false, message: 'Bu grup korunan listede değil.' }
    if (group.type === 'channel') return { ok: false, message: 'Kanalda mesaj kuralları çalışmaz; ayrı ayar sadece gruplar için.' }
    const own = input ? rulesDiff(generalRules(hub), { ...guardTunables(input), ...shieldTunables(input) }) : {}
    const count = Object.keys(own).length
    const groups = hub.groups.map((g) => (g.chatId === group.chatId ? { ...g, rules: count ? own : undefined } : g))
    await saveHub({ ...hub, groups })
    if (!input) return done(`"${group.title}" genel ayarlara döndü.`)
    return done(count ? `"${group.title}" için ${count} ayar genelden farklı kaydedildi.` : `"${group.title}" ayarları genel ayarlarla aynı, ayrı kayıt tutulmadı.`)
  } catch (error) {
    return fail(error)
  }
}

export async function unlockChatAction(chatId: string): Promise<Result> {
  if (!(await canPanel('telegram'))) return EXPIRED
  try {
    const { panelUnlock } = await import('@/lib/tg-guard')
    const res = await panelUnlock(String(chatId))
    return res.ok ? done(res.message) : res
  } catch (error) {
    return fail(error)
  }
}

export async function sweepWaveAction(chatId: string): Promise<Result> {
  if (!(await canPanel('telegram'))) return EXPIRED
  try {
    const { panelSweepWave } = await import('@/lib/tg-guard')
    const res = await panelSweepWave(String(chatId))
    if (!res.removed && !res.left) return { ok: true, message: 'Son 30 dakikada girip hâlâ içeride olan kimse kayıtlı değil.' }
    return done(`${res.removed} kişi 10 dakikalığına çıkarıldı.${res.left ? ` ${res.left} kişi kaldı, tekrar bas.` : ''}`)
  } catch (error) {
    return fail(error)
  }
}

/** Loaded on request: the query reads the whole message and join history, so it does not run on every panel visit. */
export async function loadSuspects(): Promise<SuspectRow[]> {
  if (!(await canPanel('telegram'))) return []
  const { listSuspects } = await import('@/lib/tg-shield')
  return listSuspects()
}

export async function suspectAction(ids: number[], action: 'ban' | 'mute' | 'wipe' | 'clear'): Promise<Result> {
  if (!(await canPanel('telegram'))) return EXPIRED
  if (!['ban', 'mute', 'wipe', 'clear'].includes(action)) return { ok: false, message: 'Geçersiz işlem.' }
  try {
    const { suspectAct } = await import('@/lib/tg-guard')
    return done(await suspectAct(Array.isArray(ids) ? ids : [], action))
  } catch (error) {
    return fail(error)
  }
}

export async function undoLogAction(logId: number): Promise<Result> {
  if (!(await canPanel('telegram'))) return EXPIRED
  try {
    const { undoLog } = await import('@/lib/tg-guard')
    const res = await undoLog(Number(logId), 'Panel')
    return res.ok ? done(res.message) : res
  } catch (error) {
    return fail(error)
  }
}

export async function setRoleBot(role: 'guard' | 'support' | 'share', botId: number | null): Promise<Result> {
  if (!(await canPanel('telegram'))) return EXPIRED
  try {
    if (role === 'share') {
  if (!botId) return { ok: false, message: 'Bot seç.' }
  await setShareBot(botId)
  } else {
      const hub = await getHub()
      await saveHub(role === 'guard' ? { ...hub, guardBotId: botId } : { ...hub, supportBotId: botId })
      if (!botId) return done('Rol kaldırıldı.')
    }
    const origin = await siteOrigin()
    if (!origin) return { ok: false, message: 'Bot bağlantısı yalnızca yayındaki sitede kurulabilir. Siteyi yayınla, paneli canlı adresten aç.' }
    await registerHook(botId!, origin)
    return done('Bot bağlandı ve anında haber alacak şekilde ayarlandı.')
  } catch (error) {
    return fail(error)
  }
}

export async function addHubChat(kind: 'group' | 'log' | 'staff' | 'sponsor' | 'leader', input: string, sponsorName = ''): Promise<Result> {
  if (!(await canPanel('telegram'))) return EXPIRED
  try {
    const hub = await getHub()
    const botId = kind === 'staff' || kind === 'sponsor' ? hub.supportBotId : hub.guardBotId
    if (!botId) return { ok: false, message: kind === 'staff' || kind === 'sponsor' ? 'Önce Destek botunu seç.' : 'Önce Bekçi botunu seç.' }
    if (!input.trim()) return { ok: false, message: 'Grup adresi ya da ID gir.' }
    const chat = await resolveChatFor(botId, input)
    if (!chat.isAdmin) return { ok: false, message: `Bot "${chat.title}" içinde yönetici değil. Önce botu yönetici yap.` }
    let next: HubConfig = hub
    if (kind === 'group') {
      if (hub.groups.some((g) => g.chatId === chat.id)) return { ok: false, message: 'Bu grup zaten ekli.' }
      next = { ...hub, groups: [...hub.groups, { chatId: chat.id, title: chat.title, type: chat.type, linkedChatId: chat.linkedChatId }].slice(0, 30) }
    } else if (kind === 'log') next = { ...hub, logChatId: chat.id, logChatTitle: chat.title }
    else if (kind === 'leader') next = { ...hub, counter: { ...hub.counter, postToChatId: chat.id } }
    else if (kind === 'staff') next = { ...hub, support: { ...hub.support, staffChatId: chat.id, staffChatTitle: chat.title } }
    else {
      const name = sponsorName.trim().slice(0, 60)
      if (!name) return { ok: false, message: 'Sponsor adını yaz.' }
      const sponsors = hub.support.sponsors.filter((s) => s.name.toLocaleLowerCase('tr') !== name.toLocaleLowerCase('tr'))
      next = { ...hub, support: { ...hub.support, sponsors: [...sponsors, { name, chatId: chat.id, title: chat.title }].slice(0, 40) } }
    }
    await saveHub(next)
    return done(`"${chat.title}" eklendi.`)
  } catch (error) {
    return fail(error)
  }
}

export async function removeHubChat(kind: 'group' | 'log' | 'staff' | 'sponsor' | 'leader', key: string): Promise<Result> {
  if (!(await canPanel('telegram'))) return EXPIRED
  const hub = await getHub()
  let next: HubConfig = hub
  if (kind === 'group') next = { ...hub, groups: hub.groups.filter((g) => g.chatId !== key) }
  else if (kind === 'log') next = { ...hub, logChatId: '', logChatTitle: '' }
  else if (kind === 'leader') next = { ...hub, counter: { ...hub.counter, postToChatId: '' } }
  else if (kind === 'staff') next = { ...hub, support: { ...hub.support, staffChatId: '', staffChatTitle: '' } }
  else next = { ...hub, support: { ...hub.support, sponsors: hub.support.sponsors.filter((s) => s.name !== key) } }
  await saveHub(next)
  return done('Kaldırıldı.')
}

export async function sweepGhosts(chatInput: string): Promise<Result> {
  if (!(await canPanel('telegram'))) return EXPIRED
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
      return { ok: true, message: `"${chat.title}" için kontrol edilecek üye yok. Bot sadece grupta yazmış üyeleri tanıyabilir; bot gruba girdikten sonra mesaj atanlar taranır.` }
    }
    return done(`"${chat.title}": ${r.checked} hesap kontrol edildi, ${r.removed} silinmiş hesap çıkarıldı.`)
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
  if (!(await canPanel('telegram'))) return []
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
  if (!(await canPanel('telegram'))) return EXPIRED
  const { cancelWipe } = await import('@/lib/tg-guard')
  return (await cancelWipe(chatId)) ? done('Temizlik durduruldu.') : { ok: false, message: 'Bu sohbet için çalışan temizlik yok.' }
}

export async function wipeWholeChat(chatInput: string): Promise<Result> {
  if (!(await canPanel('telegram'))) return EXPIRED
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
    return done(`"${chat.title}" temizliği başladı. Arka planda kendi kendine devam eder, paneli kapatsan da durmaz.`)
  } catch (error) {
    return fail(error)
  }
}

export async function wipeUserMessages(tgIdInput: string): Promise<Result> {
  if (!(await canPanel('telegram'))) return EXPIRED
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
    return done(`${n} mesaj silindi (Telegram sadece son 48 saati sildirir).`)
  } catch (error) {
    return fail(error)
  }
}

export async function unbanEverywhere(tgId: number): Promise<Result> {
  if (!(await canPanel('telegram'))) return EXPIRED
  try {
    await removeGlobalBan(Number(tgId))
    return done('Yasak kaldırıldı.')
  } catch (error) {
    return fail(error)
  }
}

export async function markTrusted(tgId: number, trusted: boolean): Promise<Result> {
  if (!(await canPanel('telegram'))) return EXPIRED
  await setTrusted(Number(tgId), trusted)
  return done(trusted ? 'Güvenilir olarak işaretlendi.' : 'İşaret kaldırıldı.')
}

export async function closeTicketAction(ticketId: number, status: 'resolved' | 'rejected', answer: string): Promise<Result> {
  if (!(await canPanel('telegram'))) return EXPIRED
  const text = String(answer ?? '').trim().slice(0, 1000)
  if (!text) return { ok: false, message: 'Üyeye gidecek cevabı yaz.' }
  try {
    const { panelCloseTicket } = await import('@/lib/tg-support')
    await panelCloseTicket(Number(ticketId), status, text)
    return done(status === 'resolved' ? 'Bilet çözüldü, üyeye bildirildi.' : 'Bilet reddedildi, üyeye nedeni bildirildi.')
  } catch (error) {
    return fail(error)
  }
}

export async function deleteTicketAction(ticketId: number): Promise<Result> {
  if (!(await canPanel('telegram'))) return EXPIRED
  const id = Number(ticketId)
  if (!Number.isSafeInteger(id) || id <= 0) return { ok: false, message: 'Geçersiz bilet.' }
  try {
    const { deleteClosedTicket } = await import('@/lib/tg-support')
    const removed = await deleteClosedTicket(id)
    if (!removed) return { ok: false, message: 'Sadece kapanmış bilet silinir. Açık bileti önce çöz ya da reddet.' }
    const { modLog } = await import('@/lib/tg-hub')
    await modLog({ action: 'Bilet silindi', reason: `#${id} · ${removed.sponsor} · ${removed.name} (panelden)`, notify: false })
    return done(`#${id} silindi, sponsor karnesinden de düştü.`)
  } catch (error) {
    return fail(error)
  }
}

export async function sendBroadcast(text: string, buttonText: string, buttonUrl: string): Promise<Result> {
  if (!(await canPanel('telegram'))) return EXPIRED
  const body = String(text ?? '').trim().slice(0, 3500)
  if (body.length < 5) return { ok: false, message: 'Mesaj çok kısa.' }
  const url = String(buttonUrl ?? '').trim()
  if (url && !/^https:\/\//.test(url)) return { ok: false, message: 'Buton linki https:// ile başlamalı.' }
  try {
    const { getChatConfig } = await import('@/lib/telegram-chat')
    if (!(await getChatConfig())) return { ok: false, message: 'Canlı Sohbet botu bağlı değil. Önce Canlı Sohbet sekmesinden botu bağla.' }
    const n = await queueBroadcast(body, String(buttonText ?? '').trim().slice(0, 40), url.slice(0, 300))
    if (!n) return done('Duyuru kaydedildi ama Telegram hesabını bağlamış üye yok, kimseye gitmeyecek.')
    after(() => processBroadcasts().catch((e) => console.error('[broadcast] immediate send failed', e)))
    return done(`Duyuru gönderilmeye başladı, ${n} kişiye gidiyor. Liste kendini yeniler.`)
  } catch (error) {
    return fail(error)
  }
}

export async function stopBroadcast(id: number): Promise<Result> {
  if (!(await canPanel('telegram'))) return EXPIRED
  await cancelBroadcast(Number(id))
  return done('Duyuru durduruldu.')
}

export async function sendWeeklyNow(): Promise<Result> {
  if (!(await canPanel('telegram'))) return EXPIRED
  try {
    const { runWeeklyHub } = await import('@/lib/tg-hub-jobs')
    await runWeeklyHub(true)
    return done('Haftalık rapor gönderildi.')
  } catch (error) {
    return fail(error)
  }
}
