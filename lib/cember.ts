import 'server-only'
import { randomInt } from 'node:crypto'
import { rows, sql } from '@/lib/db'
import { ARENA_META, type ArenaGame } from '@/lib/arena'
import { runSim, mulberry, STEP } from '@/lib/cember-sim'
import { runKD, KD_STEP } from '@/lib/karadelik-sim'
import { runSV, SV_STEP, SV_TEAM_NAMES } from '@/lib/survival-sim'
import {
  asGame,
  DEFAULT_SURVIVAL,
  DEFAULT_POWERS,
  POWER_REVIVE,
  POWER_SHIELD,
  type SurvivalOpts,
  CONDITION_KINDS,
  DEFAULT_CEMBER,
  DEFAULT_BOTS,
  DEFAULT_TIERS,
  GAME_META,
  KD_DURATIONS,
  MAX_BOTS,
  MAX_WINNERS,
  liveSeconds,
  resolveWinners,
  type CemberGame,
  INTRO_SECONDS,
  PREDICT_GRACE_SECONDS,
  PREDICT_PERFECT_MULT,
  PREDICT_PICKS,
  type CemberPreview,
  RESULT_SECONDS,
  MAX_PLAYERS,
  conditionText,
  prizeText,
  type CemberCondition,
  type CemberConfig,
  type CemberMe,
  type CemberPrize,
  type CemberRound,
  type CemberStatus,
  type Participant,
  type PrizeType,
  BOT_TAG,
  EVERY_OPTIONS,
  MAX_EVENTS,
  MIN_SLOT_GAP_MIN,
  NOTICE_MINUTES,
  slotMinutes,
} from '@/lib/cember-shared'

const TR_OFFSET_MS = 3 * 3600_000
const SETTINGS_KEY = 'cember'
/** Matches the client's live window: once a round's window passes, the countdown moves on to the next slot. */
const liveWindowMs = (ev: Pick<CemberConfig, 'game' | 'duration'> & { maxPlayers?: number }) => liveSeconds(ev) * 1000

let ready: Promise<void> | null = null
function ensure() {
  ready ??= (async () => {
    const { ensureKp } = await import('@/lib/kanka-puan')
    await ensureKp()
    await rows(sql`CREATE TABLE IF NOT EXISTS cember_rounds (
      slot timestamptz PRIMARY KEY, title text NOT NULL, seed bigint NOT NULL, participants jsonb NOT NULL,
      winner_index int, winner_id text, winner_name text, steps int NOT NULL DEFAULT 0, prizes jsonb NOT NULL DEFAULT '[]'::jsonb,
      prize_text text NOT NULL DEFAULT '', paid boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now())`)
    await rows(sql`ALTER TABLE cember_rounds ADD COLUMN IF NOT EXISTS event_id text`)
    await rows(sql`ALTER TABLE cember_rounds ADD COLUMN IF NOT EXISTS game text NOT NULL DEFAULT 'cember'`)
    await rows(sql`ALTER TABLE cember_rounds ADD COLUMN IF NOT EXISTS duration int NOT NULL DEFAULT 0`)
    await rows(sql`ALTER TABLE cember_rounds ADD COLUMN IF NOT EXISTS winner_indexes jsonb NOT NULL DEFAULT '[]'::jsonb`)
    await rows(sql`ALTER TABLE cember_rounds ADD COLUMN IF NOT EXISTS prize_split text NOT NULL DEFAULT 'each'`)
    await rows(sql`ALTER TABLE cember_rounds ADD COLUMN IF NOT EXISTS survival jsonb`)
    await rows(sql`ALTER TABLE cember_rounds ADD COLUMN IF NOT EXISTS winning_team int NOT NULL DEFAULT -1`)
    await rows(sql`ALTER TABLE cember_rounds ADD COLUMN IF NOT EXISTS instant boolean NOT NULL DEFAULT false`)
    await rows(sql`ALTER TABLE cember_rounds ADD COLUMN IF NOT EXISTS powers jsonb NOT NULL DEFAULT '[]'::jsonb`)
    await rows(sql`ALTER TABLE cember_rounds ADD COLUMN IF NOT EXISTS podium jsonb NOT NULL DEFAULT '[]'::jsonb`)
    await rows(sql`ALTER TABLE cember_rounds ADD COLUMN IF NOT EXISTS predict_kp int NOT NULL DEFAULT 0`)
    await rows(sql`CREATE TABLE IF NOT EXISTS cember_predictions (
      slot timestamptz NOT NULL, user_id text NOT NULL, picks jsonb NOT NULL, paid boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (slot, user_id))`)
    await rows(sql`CREATE TABLE IF NOT EXISTS cember_notices (slot timestamptz PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now())`)
    await rows(sql`CREATE TABLE IF NOT EXISTS cember_carry (event_id text PRIMARY KEY, coins int NOT NULL DEFAULT 0, kp int NOT NULL DEFAULT 0)`)
  })().catch((error) => {
    ready = null
    throw error
  })
  return ready
}

// --- Config --------------------------------------------------------------

const clampInt = (v: unknown, min: number, max: number, fallback: number) => {
  const n = Math.round(Number(v))
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback
}

export function normalizeConfig(raw: Partial<CemberConfig> | null | undefined, fallbackId = 'e1'): CemberConfig {
  const c = { ...DEFAULT_CEMBER, ...(raw ?? {}) }
  const hours = [...new Set((Array.isArray(c.hours) ? c.hours : []).map((h) => clampInt(h, 0, 23, 0)))].sort((a, b) => a - b)
  const conditions: CemberCondition[] = (Array.isArray(c.conditions) ? c.conditions : [])
    .filter((x) => x && x.kind in CONDITION_KINDS)
    .slice(0, 12)
    .map((x, i) => ({
      id: String(x.id || `c${i}`).slice(0, 20),
      kind: x.kind,
      target: CONDITION_KINDS[x.kind].counted ? clampInt(x.target, 1, 100_000, 1) : 1,
      window: (['gun', 'hafta', 'tum'] as const).includes(x.window) ? x.window : 'gun',
      param: CONDITION_KINDS[x.kind].param && x.param ? String(x.param).slice(0, 60) : null,
      label: String(x.label ?? '').slice(0, 80),
    }))
  const prizes: CemberPrize[] = (Array.isArray(c.prizes) ? c.prizes : [])
    .filter((p) => p && ['coin', 'kp', 'badge', 'market'].includes(p.type))
    .slice(0, 8)
    .map((p, i) => ({
      id: String(p.id || `p${i}`).slice(0, 20),
      type: p.type,
      amount: p.type === 'coin' || p.type === 'kp' ? clampInt(p.amount, 1, 1_000_000, 1) : 0,
      ref: p.type === 'badge' || p.type === 'market' ? (p.ref ? String(p.ref).slice(0, 60) : null) : null,
      label: String(p.label ?? '').slice(0, 60),
    }))
    .filter((p) => (p.type === 'badge' || p.type === 'market' ? !!p.ref : true))
  const now = Date.now()
  const game: CemberGame = c.game && c.game in GAME_META ? c.game : 'cember'
  const rawBots = (c.bots ?? DEFAULT_BOTS) as Partial<typeof DEFAULT_BOTS>
  const rawTiers = Array.isArray(c.tiers) && c.tiers.length ? c.tiers : DEFAULT_TIERS
  const tiers = rawTiers
    .slice(0, 8)
    .map((t) => ({ min: clampInt(t?.min, 1, 100_000, 1), winners: clampInt(t?.winners, 1, MAX_WINNERS, 1) }))
    .sort((a, b) => a.min - b.min)
    .filter((t, i, all) => i === 0 || t.min !== all[i - 1].min)
  return {
    id: String(raw?.id || fallbackId).replace(/[^\w-]/g, '').slice(0, 20) || fallbackId,
    enabled: c.enabled !== false,
    title: String(c.title || GAME_META[game].label).slice(0, 40),
    game,
    duration: (KD_DURATIONS as readonly number[]).includes(Number(c.duration)) ? Number(c.duration) : 90,
    winnerMode: c.winnerMode === 'tiers' ? 'tiers' : 'fixed',
    winners: clampInt(c.winners, 1, MAX_WINNERS, 1),
    tiers,
    prizeSplit: c.prizeSplit === 'split' ? 'split' : 'each',
    leftover: c.leftover === 'carry' ? 'carry' : 'pool',
    survival: normalizeSurvival(c.survival),
    powers: {
      shield: (c.powers ?? DEFAULT_POWERS).shield !== false,
      revive: (c.powers ?? DEFAULT_POWERS).revive !== false,
    },
    bots: {
      enabled: rawBots.enabled !== false,
      target: clampInt(rawBots.target, 2, MAX_BOTS + MAX_PLAYERS, DEFAULT_BOTS.target),
      max: clampInt(rawBots.max, 0, MAX_BOTS, DEFAULT_BOTS.max),
      tag: rawBots.tag === true,
    },
    predictKp: clampInt(c.predictKp, 0, 10_000, DEFAULT_CEMBER.predictKp),
    hours,
    days: [...new Set((Array.isArray(c.days) ? c.days : []).map((d) => clampInt(d, 0, 6, 0)))].sort((a, b) => a - b),
    minute: clampInt(c.minute, 0, 59, 0),
    every: (EVERY_OPTIONS as readonly number[]).includes(Number(c.every)) ? Number(c.every) : 0,
    maxPlayers: clampInt(c.maxPlayers, 2, MAX_PLAYERS, MAX_PLAYERS),
    conditions,
    prizes,
    extraSlots: (Array.isArray(c.extraSlots) ? c.extraSlots : [])
      .map((s) => new Date(String(s)))
      .filter((d) => Number.isFinite(d.getTime()) && d.getTime() > now - 2 * 86400_000)
      .map((d) => new Date(Math.floor(d.getTime() / 1000) * 1000).toISOString())
      .slice(-10),
  }
}

/** Stored value is `{ events: [...] }`; older saves held a single event object and are read as a one-item list. */
export function normalizeEvents(raw: unknown): CemberConfig[] {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null
  const list: Partial<CemberConfig>[] = Array.isArray(obj?.events)
    ? (obj.events as Partial<CemberConfig>[])
    : obj && Object.keys(obj).length
      ? [obj as Partial<CemberConfig>]
      : [DEFAULT_CEMBER]
  const seen = new Set<string>()
  return list.slice(0, MAX_EVENTS).map((e, i) => {
    let ev = normalizeConfig(e, `e${i + 1}`)
    if (seen.has(ev.id)) ev = { ...ev, id: `${ev.id.slice(0, 14)}${i}${Math.floor(Math.random() * 1e4)}` }
    seen.add(ev.id)
    return ev
  })
}

let configCache: { at: number; value: CemberConfig[] } | null = null

export async function getCemberEvents(): Promise<CemberConfig[]> {
  if (configCache && Date.now() - configCache.at < 5_000) return configCache.value
  await ensure()
  const r = await rows<{ value: unknown }>(sql`SELECT value FROM kp_settings WHERE key = ${SETTINGS_KEY}`)
  const value = normalizeEvents(r[0]?.value)
  configCache = { at: Date.now(), value }
  return value
}

const hhmm = (min: number) => `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`

/** Two enabled events must never start within MIN_SLOT_GAP_MIN of each other, or their windows would collide on screen. */
function findClash(events: CemberConfig[]): string | null {
  const points: { m: number; ev: CemberConfig }[] = []
  for (const ev of events) {
    if (!ev.enabled) continue
    const mins = slotMinutes(ev)
    for (const h of ev.hours) for (const m of mins) points.push({ m: h * 60 + m, ev })
  }
  points.sort((a, b) => a.m - b.m)
  for (let i = 0; i < points.length; i++) {
    const a = points[i]
    const b = points[(i + 1) % points.length]
    if (a.ev.id === b.ev.id) continue
    const gap = (b.m - a.m + 1440) % 1440
    if (gap < MIN_SLOT_GAP_MIN) {
      return `"${a.ev.title}" (${hhmm(a.m)}) ile "${b.ev.title}" (${hhmm(b.m)}) çakışıyor. İki etkinlik arasında en az ${MIN_SLOT_GAP_MIN} dakika olmalı.`
    }
  }
  return null
}

export async function saveCemberEvents(input: Partial<CemberConfig>[]) {
  await ensure()
  const events = normalizeEvents({ events: Array.isArray(input) ? input : [] })
  for (const ev of events) {
    if (!ev.conditions.length) throw new Error(`"${ev.title}" için en az bir katılım şartı ekle.`)
    if (!ev.prizes.length) throw new Error(`"${ev.title}" için en az bir ödül ekle.`)
  }
  const clash = findClash(events)
  if (clash) throw new Error(clash)
  await rows(sql`INSERT INTO kp_settings (key, value) VALUES (${SETTINGS_KEY}, ${JSON.stringify({ events })}::jsonb)
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`)
  configCache = null
  return events
}

export async function scheduleTestRound(eventId: string, delaySeconds: number) {
  const events = await getCemberEvents()
  const ev = events.find((e) => e.id === eventId)
  if (!ev) throw new Error('Etkinlik bulunamadı, önce kaydet.')
  const at = new Date(Math.ceil((Date.now() + delaySeconds * 1000) / 1000) * 1000).toISOString()
  await saveCemberEvents(events.map((e) => (e.id === eventId ? { ...e, enabled: true, extraSlots: [...e.extraSlots, at] } : e)))
  return at
}

// --- Instant events --------------------------------------------------------

const GAP_MS = MIN_SLOT_GAP_MIN * 60_000
const ceilSecond = (t: number) => Math.ceil(t / 1000) * 1000

function slotNear(events: CemberConfig[], at: number) {
  return slotsAround(events, at).find((s) => Math.abs(s.at - at) < GAP_MS) ?? null
}

/** Earliest instant at or after `at` that keeps MIN_SLOT_GAP_MIN from every other round. */
function firstFreeSlot(events: CemberConfig[], at: number) {
  let t = at
  for (let i = 0; i < 48; i++) {
    const hit = slotNear(events, t)
    if (!hit) return t
    t = ceilSecond(hit.at + GAP_MS)
  }
  throw new Error('Yakında boş bir saat bulunamadı, takvimi kontrol et.')
}

export type InstantOutcome =
  | { kind: 'scheduled'; at: string; events: CemberConfig[] }
  | { kind: 'clash'; clashTitle: string; clashAt: string; suggestAt: string }

export async function scheduleInstantRound(eventId: string, delaySeconds: number, placeAfterClash: boolean): Promise<InstantOutcome> {
  const events = await getCemberEvents()
  if (!events.some((e) => e.id === eventId)) throw new Error('Etkinlik bulunamadı, önce kaydet.')
  const wanted = ceilSecond(Date.now() + delaySeconds * 1000)
  const hit = slotNear(events, wanted)
  if (hit && !placeAfterClash) {
    return { kind: 'clash', clashTitle: hit.ev.title, clashAt: new Date(hit.at).toISOString(), suggestAt: new Date(firstFreeSlot(events, wanted)).toISOString() }
  }
  const at = new Date(hit ? firstFreeSlot(events, wanted) : wanted).toISOString()
  const ev = events.find((e) => e.id === eventId)!
  const { dailyKc } = await getInstantBudget(events)
  if (dailyKc > 0) {
    const used = instantKcOnDay(events, Date.parse(at))
    const cost = roundKcCost(ev)
    if (used + cost > dailyKc) {
      throw new Error(
        `Günlük anlık etkinlik bütçesi yetmiyor: bugün ${used.toLocaleString('tr-TR')} KC ayrıldı, bu tur en fazla ${cost.toLocaleString('tr-TR')} KC dağıtabilir, limit ${dailyKc.toLocaleString('tr-TR')} KC.`,
      )
    }
  }
  const saved = await saveCemberEvents(events.map((e) => (e.id === eventId ? { ...e, enabled: true, extraSlots: [...e.extraSlots, at] } : e)))
  return { kind: 'scheduled', at, events: saved }
}

export async function cancelInstantRound(eventId: string, slotIso: string) {
  const events = await getCemberEvents()
  const ev = events.find((e) => e.id === eventId)
  const at = Date.parse(slotIso)
  if (!ev || !ev.extraSlots.some((s) => Date.parse(s) === at)) throw new Error('Bu anlık tur bulunamadı.')
  if (at <= Date.now() + 15_000) throw new Error('Tur başlamak üzere ya da başladı, artık iptal edilemez.')
  const started = await rows(sql`SELECT 1 FROM cember_rounds WHERE slot = ${new Date(at).toISOString()} LIMIT 1`)
  if (started.length) throw new Error('Bu tur kurulmuş, artık iptal edilemez.')
  return saveCemberEvents(events.map((e) => (e.id === eventId ? { ...e, extraSlots: e.extraSlots.filter((s) => Date.parse(s) !== at) } : e)))
}

// --- Instant budget ------------------------------------------------------

const INSTANT_KEY = 'cember_instant'

/** chatAlert = messages per hour in the Telegram groups that make the panel suggest an instant round (0 = off). */
export type InstantBudget = { dailyKc: number; usedKc: number; chatAlert: number; chatLastHour: number }

type InstantSettings = { dailyKc?: number; chatAlert?: number }

async function readInstantSettings(): Promise<InstantSettings> {
  const r = await rows<{ value: InstantSettings }>(sql`SELECT value FROM kp_settings WHERE key = ${INSTANT_KEY}`).catch(() => [])
  return r[0]?.value ?? {}
}

async function writeInstantSettings(patch: InstantSettings) {
  const value = { ...(await readInstantSettings()), ...patch }
  await rows(sql`INSERT INTO kp_settings (key, value) VALUES (${INSTANT_KEY}, ${JSON.stringify(value)}::jsonb)
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`)
}

async function chatMessagesLastHour() {
  const r = await rows<{ n: number }>(sql`SELECT count(*)::int AS n FROM tg_guard_msgs WHERE created_at > now() - interval '1 hour'`).catch(() => [])
  return Number(r[0]?.n ?? 0)
}

/** Upper bound on winners: team Survival pays the whole winning side, so it is capped at MAX_WINNERS. */
function maxWinnersOf(ev: CemberConfig) {
  if (ev.game === 'survival' && ev.survival.teams > 0) return MAX_WINNERS
  return ev.winnerMode === 'tiers' ? Math.max(1, ...ev.tiers.map((t) => t.winners)) : ev.winners
}

/** Most KC a single round of this event can pay out. */
export function roundKcCost(ev: CemberConfig) {
  const coins = ev.prizes.filter((p) => p.type === 'coin').reduce((s, p) => s + p.amount, 0)
  return ev.prizeSplit === 'split' ? coins : coins * maxWinnersOf(ev)
}

/** KC reserved by instant (off-schedule) rounds on the Turkish calendar day containing `at`. */
function instantKcOnDay(events: CemberConfig[], at: number) {
  const day = trDayStart(at)
  return events.reduce(
    (sum, ev) => sum + ev.extraSlots.filter((s) => Date.parse(s) >= day && Date.parse(s) < day + 86400_000).length * roundKcCost(ev),
    0,
  )
}

export async function getInstantBudget(events?: CemberConfig[]): Promise<InstantBudget> {
  const [s, chatLastHour] = await Promise.all([readInstantSettings(), chatMessagesLastHour()])
  return {
    dailyKc: clampInt(s.dailyKc, 0, 100_000_000, 0),
    usedKc: instantKcOnDay(events ?? (await getCemberEvents()), Date.now()),
    chatAlert: clampInt(s.chatAlert, 0, 1_000_000, 0),
    chatLastHour,
  }
}

export async function saveInstantBudget(dailyKc: number) {
  await writeInstantSettings({ dailyKc: clampInt(dailyKc, 0, 100_000_000, 0) })
  return getInstantBudget()
}

export async function saveChatAlert(perHour: number) {
  await writeInstantSettings({ chatAlert: clampInt(perHour, 0, 1_000_000, 0) })
  return getInstantBudget()
}

export type UpcomingSlot = { at: string; eventId: string; title: string; game: CemberConfig['game']; instant: boolean }

/** Every round in the next `hours`, soonest first, with instant (off-schedule) rounds flagged. */
export function upcomingSlots(events: CemberConfig[], hours = 24, now = Date.now()): UpcomingSlot[] {
  return slotsAround(events, now)
    .filter((s) => s.at > now - liveWindowMs(s.ev) && s.at <= now + hours * 3600_000)
    .map((s) => ({
      at: new Date(s.at).toISOString(),
      eventId: s.ev.id,
      title: s.ev.title,
      game: s.ev.game,
      instant: s.ev.extraSlots.some((x) => Date.parse(x) === s.at),
    }))
}

// --- Slots ---------------------------------------------------------------

function trDayStart(at: number) {
  const tr = at + TR_OFFSET_MS
  return tr - (tr % 86400_000) - TR_OFFSET_MS
}

type Slot = { at: number; ev: CemberConfig }

/** Every enabled event's rounds from yesterday to tomorrow, soonest first; one event per instant. */
function slotsAround(events: CemberConfig[], now: number): Slot[] {
  const out = new Map<number, CemberConfig>()
  const today = trDayStart(now)
  for (const ev of events) {
    if (!ev.enabled) continue
    const minutes = slotMinutes(ev)
    for (const day of [today - 86400_000, today, today + 86400_000]) {
      if (ev.days.length && !ev.days.includes((new Date(day + TR_OFFSET_MS).getUTCDay() + 6) % 7)) continue
      for (const h of ev.hours) for (const m of minutes) {
        const at = day + h * 3600_000 + m * 60_000
        if (!out.has(at)) out.set(at, ev)
      }
    }
    for (const s of ev.extraSlots) {
      const at = Date.parse(s)
      if (!out.has(at)) out.set(at, ev)
    }
  }
  return [...out].map(([at, ev]) => ({ at, ev })).sort((a, b) => a.at - b.at)
}

function eventForSlot(events: CemberConfig[], slot: number) {
  return slotsAround(events, slot).find((s) => s.at === slot)?.ev ?? null
}

/** Start time of the event's next round within the coming week, or null when it has no upcoming slot. */
export function nextRoundAt(ev: CemberConfig, now: number = Date.now()): number | null {
  const minutes = slotMinutes(ev)
  const today = trDayStart(now)
  let best: number | null = null
  for (let d = 0; d < 8 && best === null; d++) {
    const day = today + d * 86400_000
    if (ev.days.length && !ev.days.includes((new Date(day + TR_OFFSET_MS).getUTCDay() + 6) % 7)) continue
    for (const h of ev.hours) for (const m of minutes) {
      const at = day + h * 3600_000 + m * 60_000
      if (at > now && (best === null || at < best)) best = at
    }
  }
  for (const s of ev.extraSlots) {
    const at = Date.parse(s)
    if (at > now && (best === null || at < best)) best = at
  }
  return best
}

function nextEntry(events: CemberConfig[], now: number) {
  return slotsAround(events, now).find((s) => s.at > now - liveWindowMs(s.ev)) ?? null
}

// --- Conditions ----------------------------------------------------------

function windowStart(c: CemberCondition, at: number) {
  if (c.window === 'tum') return new Date(0).toISOString()
  const day = trDayStart(at)
  if (c.window === 'gun') return new Date(day).toISOString()
  const weekday = (new Date(day + TR_OFFSET_MS).getUTCDay() + 6) % 7
  return new Date(day - weekday * 86400_000).toISOString()
}

/** Per-user value for one condition as of `at`; `userId` narrows it to one member. */
async function conditionValues(c: CemberCondition, at: number, userId: string | null): Promise<Map<string, number>> {
  const since = windowStart(c, at)
  const until = new Date(at).toISOString()
  const p = c.param
  const u = userId
  let q
  switch (c.kind) {
    case 'gorev':
      q = sql`SELECT user_id, count(*) AS n FROM kp_events WHERE source = 'gorev' AND created_at >= ${since} AND created_at < ${until}
        AND (${u}::text IS NULL OR user_id = ${u}) AND (${p}::text IS NULL OR split_part(ref, ':', 1) = ${p}) GROUP BY user_id`
      break
    case 'oyun':
    case 'galibiyet': {
      const win = c.kind === 'galibiyet'
      q = sql`SELECT user_id, count(*) AS n FROM game_history WHERE created_at >= ${since} AND created_at < ${until}
        AND mode NOT IN ('odul', 'harcama', 'admin') AND result <> 'refund'
        AND (${win}::boolean IS FALSE OR result IN ('win', 'won', 'blackjack'))
        AND (${u}::text IS NULL OR user_id = ${u}) AND (${p}::text IS NULL OR game = ${p}) GROUP BY user_id`
      break
    }
    case 'kp':
      q = sql`SELECT user_id, coalesce(sum(points), 0) AS n FROM kp_events WHERE created_at >= ${since} AND created_at < ${until}
        AND source <> 'cember' AND (${u}::text IS NULL OR user_id = ${u}) GROUP BY user_id`
      break
    case 'online':
      q = sql`SELECT user_id, count(*) AS n FROM kp_events WHERE source = 'online' AND created_at >= ${since} AND created_at < ${until}
        AND (${u}::text IS NULL OR user_id = ${u}) GROUP BY user_id`
      break
    case 'davet':
      q = sql`SELECT referrer_id AS user_id, count(*) AS n FROM referrals WHERE created_at >= ${since} AND created_at < ${until}
        AND (${u}::text IS NULL OR referrer_id = ${u}) GROUP BY referrer_id`
      break
    case 'giris': {
      const day = new Date(trDayStart(at) + TR_OFFSET_MS).toISOString().slice(0, 10)
      q = sql`SELECT user_id, 1 AS n FROM daily_checkins WHERE last_day = ${day}::date AND (${u}::text IS NULL OR user_id = ${u})`
      break
    }
    case 'telegram':
      q = sql`SELECT user_id, 1 AS n FROM tg_links WHERE (${u}::text IS NULL OR user_id = ${u})`
      break
    case 'tahmin':
      q = sql`SELECT user_id, count(*) AS n FROM league_picks WHERE created_at >= ${since} AND created_at < ${until}
        AND (${u}::text IS NULL OR user_id = ${u}) GROUP BY user_id`
      break
    case 'tv':
      q = sql`SELECT user_id, count(*) AS n FROM tv_watch_ticks WHERE minute >= ${since} AND minute < ${until}
        AND (${u}::text IS NULL OR user_id = ${u}) GROUP BY user_id`
      break
    case 'tgkod':
      q = sql`SELECT e.user_id, count(*) AS n FROM kp_events e JOIN tasks t ON split_part(e.ref, ':', 1) = t.id::text
        WHERE e.source = 'gorev' AND t.kind = 'secret_code' AND e.created_at >= ${since} AND e.created_at < ${until}
        AND (${u}::text IS NULL OR e.user_id = ${u}) GROUP BY e.user_id`
      break
    case 'sponsor':
      q = sql`SELECT user_id, 1 AS n FROM sponsor_accounts WHERE status = 'approved'
        AND (${p}::text IS NULL OR site_id = ${p}) AND (${u}::text IS NULL OR user_id = ${u}) GROUP BY user_id`
      break
    case 'haftalik': {
      const week = windowStart({ ...c, window: 'hafta' }, at)
      q = sql`SELECT e.user_id, count(*) AS n FROM kp_events e JOIN tasks t ON split_part(e.ref, ':', 1) = t.id::text
        WHERE e.source = 'gorev' AND t.period = 'weekly' AND e.created_at >= ${week} AND e.created_at < ${until}
        AND (${u}::text IS NULL OR e.user_id = ${u}) GROUP BY e.user_id`
      break
    }
  }
  // Optional modules (Telegram, check-in…) may not have created their table yet; that simply means nobody qualifies.
  const r = await rows<{ user_id: string; n: string }>(q).catch(() => [])
  return new Map(r.map((x) => [String(x.user_id), Number(x.n)]))
}

async function eligibleIds(cfg: CemberConfig, at: number): Promise<string[]> {
  if (!cfg.conditions.length) return []
  let current: string[] = []
  for (let i = 0; i < cfg.conditions.length; i++) {
    const c = cfg.conditions[i]
    const values = await conditionValues(c, at, null)
    const ok: string[] = []
    values.forEach((n, id) => {
      if (n >= c.target) ok.push(String(id))
    })
    if (i === 0) current = ok
    else {
      const okSet = new Set(ok)
      current = current.filter((id) => okSet.has(id))
    }
    if (!current.length) return []
  }
  return current.sort()
}

async function labelMaps(cfg: CemberConfig) {
  const taskIds = cfg.conditions.filter((c) => c.kind === 'gorev' && c.param).map((c) => Number(c.param)).filter(Number.isInteger)
  const badgeIds = cfg.prizes.filter((p) => p.type === 'badge' && p.ref).map((p) => p.ref as string)
  const itemIds = cfg.prizes.filter((p) => p.type === 'market' && p.ref).map((p) => p.ref as string)
  const [tasks, badges, items] = await Promise.all([
    taskIds.length ? rows<{ id: number; title: string }>(sql`SELECT id, title FROM tasks WHERE id IN ${taskIds}`).catch(() => []) : [],
    badgeIds.length ? rows<{ id: string; name: string }>(sql`SELECT id, name FROM kp_badges WHERE id IN ${badgeIds}`).catch(() => []) : [],
    itemIds.length ? rows<{ id: string; name: string }>(sql`SELECT id, name FROM market_items WHERE id IN ${itemIds}`).catch(() => []) : [],
  ])
  const names: Record<string, string> = {}
  for (const b of badges) names[`b:${b.id}`] = b.name
  for (const m of items) names[`m:${m.id}`] = m.name
  const taskTitle = new Map(tasks.map((t) => [String(t.id), t.title]))
  const describe = (c: CemberCondition) =>
    conditionText(c, c.kind === 'gorev' && c.param ? taskTitle.get(c.param) : null, c.param && c.param in ARENA_META ? ARENA_META[c.param as ArenaGame].title : null)
  return { names, describe }
}

export async function myCemberStatus(userId: string | null): Promise<CemberMe> {
  if (!userId) return { signedIn: false, userId: null, eligible: false, progress: [] }
  const now = Date.now()
  // Progress is shown for whichever event runs next, since each event can have its own conditions.
  const cfg = nextEntry(await getCemberEvents(), now)?.ev
  if (!cfg) return { signedIn: true, userId, eligible: false, progress: [] }
  const { describe } = await labelMaps(cfg)
  const progress = await Promise.all(
    cfg.conditions.map(async (c) => {
      const value = (await conditionValues(c, now, userId)).get(userId) ?? 0
      return { label: describe(c), done: value >= c.target, value: Math.min(value, c.target), target: c.target }
    }),
  )
  return { signedIn: true, userId, eligible: progress.length > 0 && progress.every((p) => p.done), progress }
}

// --- Rounds --------------------------------------------------------------

type RoundRow = {
  slot: string
  title: string
  seed: string
  participants: Participant[]
  winner_index: number | null
  winner_name: string | null
  steps: number
  prize_text: string
  prizes?: CemberPrize[] | null
  paid: boolean
  event_id?: string | null
  game: CemberGame | null
  duration: number | null
  winner_indexes: number[] | null
  prize_split: 'each' | 'split' | null
  survival: SurvivalOpts | null
  winning_team: number | null
  instant: boolean | null
  powers: number[] | null
  podium: string[] | null
  predict_kp: number | null
}

function normalizeSurvival(raw: unknown): SurvivalOpts {
  const s = (raw ?? {}) as Partial<SurvivalOpts>
  return {
    teams: Number(s.teams) === 5 ? 5 : Number(s.teams) === 2 ? 2 : 0,
    rule: s.rule === 'most' ? 'most' : DEFAULT_SURVIVAL.rule,
    shield: s.shield === undefined ? DEFAULT_SURVIVAL.shield : s.shield !== false,
    captain: Number(s.teams) > 0 && s.captain === true,
  }
}

const winnerIndexes = (r: RoundRow) =>
  Array.isArray(r.winner_indexes) && r.winner_indexes.length ? r.winner_indexes : r.winner_index !== null ? [r.winner_index] : []

const toRound = (r: RoundRow): CemberRound => ({
  slot: new Date(r.slot).toISOString(),
  title: r.title,
  game: asGame(r.game),
  duration: Number(r.duration ?? 0),
  seed: Number(r.seed),
  participants: r.participants,
  winner: r.winner_index,
  winners: winnerIndexes(r),
  steps: Number(r.steps),
  prizeText: r.prize_text,
  survival: r.game === 'survival' ? normalizeSurvival(r.survival) : null,
  winningTeam: Number(r.winning_team ?? -1),
  powers: Array.isArray(r.powers) ? r.powers.map((p) => (p === POWER_SHIELD || p === POWER_REVIVE ? p : 0)) : [],
  podium: Array.isArray(r.podium) ? r.podium.map(String) : [],
  predictKp: Number(r.predict_kp ?? 0),
})

/** Seed and results stay server-side until the intro (prediction window) is over. */
const revealAt = (slot: number) => slot + INTRO_SECONDS * 1000
const predictClosesAt = (slot: number) => revealAt(slot) - PREDICT_GRACE_SECONDS * 1000

/** Top 3 by slot: winners first, then whoever went out last. Revived players can appear in `order` twice. */
function podiumSlots(winners: number[], order: number[]) {
  const out = [...winners]
  for (let k = order.length - 1; k >= 0 && out.length < PREDICT_PICKS; k--) if (!out.includes(order[k])) out.push(order[k])
  return out
}

/**
 * Who enters the round holding a power. Revive wins when someone qualifies for both, since a single power fires per round.
 * Shield: more `gorev` completions today than the event's own task condition asks for.
 * Revive: linked Telegram account that wrote in the group today or yesterday.
 */
async function roundPowers(cfg: CemberConfig, ids: string[], at: number): Promise<Map<string, 1 | 2>> {
  const out = new Map<string, 1 | 2>()
  if (!ids.length || (cfg.game !== 'survival' && cfg.game !== 'karadelik')) return out
  const day = trDayStart(at)
  if (cfg.powers.shield) {
    const base = Math.max(0, ...cfg.conditions.filter((c) => c.kind === 'gorev').map((c) => c.target))
    const r = await rows<{ user_id: string; n: string }>(sql`SELECT user_id, count(*) AS n FROM kp_events
      WHERE source = 'gorev' AND created_at >= ${new Date(day).toISOString()} AND created_at < ${new Date(at).toISOString()}
      AND user_id IN ${ids} GROUP BY user_id`).catch(() => [])
    for (const x of r) if (Number(x.n) > base) out.set(String(x.user_id), POWER_SHIELD)
  }
  if (cfg.powers.revive) {
    const since = new Date(day + TR_OFFSET_MS - 86400_000).toISOString().slice(0, 10)
    const r = await rows<{ user_id: string }>(sql`SELECT l.user_id FROM tg_links l JOIN tg_trust t ON t.tg_id = l.tg_id
      WHERE t.last_day >= ${since}::date AND l.user_id IN ${ids}`).catch(() => [])
    for (const x of r) out.set(String(x.user_id), POWER_REVIVE)
  }
  return out
}

async function loadRound(slot: number) {
  const r = await rows<RoundRow>(sql`SELECT * FROM cember_rounds WHERE slot = ${new Date(slot).toISOString()}`)
  return r[0] ?? null
}

const pending = new Map<number, Promise<RoundRow | null>>()

const BOT_PREFIX = 'bot:'
const BOT_NAMES = [
  'kartal34', 'sessizjako', 'gececi', 'mavisimsek', 'efe_07', 'kanka_burak', 'zeyno', 'denizkizi', 'baronn', 'tilki55',
  'yigit.tr', 'melisa_', 'karabela', 'pasa16', 'aslanpenc', 'mertoo', 'cansu35', 'gokhan61', 'serseri', 'lodos',
  'ecrin', 'kral_umut', 'jakosever', 'nehir', 'turbo06', 'emircan', 'sila.k', 'bozkurt', 'ayaz', 'kanarya',
  'harun42', 'duman', 'elif_jk', 'reis01', 'kuzgun', 'ozan27', 'irmak', 'sahin', 'tosun', 'berk_',
  'selin.aa', 'kaptan', 'volkan', 'yaren', 'cakal', 'onur09', 'ruzgar', 'asli', 'kemal33', 'pars',
]
const isBot = (id: string | null | undefined) => !!id && id.startsWith(BOT_PREFIX)

/** Settles a due slot exactly once: snapshot the qualifiers, pick a seed, simulate, store, pay. */
async function finalize(slot: number): Promise<RoundRow | null> {
  const existing = await loadRound(slot)
  if (existing) return existing
  const cfg = eventForSlot(await getCemberEvents(), slot)
  if (!cfg) return null

  const ids = await eligibleIds(cfg, slot)
  const seed = randomInt(1, 2 ** 31 - 1)
  const pick = mulberry(seed ^ 0x5bd1e995)
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(pick() * (i + 1))
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
  }
  const chosen = ids.slice(0, cfg.maxPlayers)
  const users = chosen.length
    ? await rows<{ id: string; name: string | null; image: string | null }>(sql`SELECT id, name, image FROM public."user" WHERE id IN ${chosen}`)
    : []
  const byId = new Map(users.map((u) => [u.id, u]))
  const participants: Participant[] = chosen
    .filter((id) => byId.has(id))
    .map((id) => {
      const u = byId.get(id)!
      const image = u.image && (u.image.startsWith('/') || u.image.startsWith('https://')) ? u.image : null
      return { id, name: (u.name ?? 'Kanka').slice(0, 24), image }
    })

  const realCount = participants.length
  const wantBots = cfg.bots.enabled && realCount > 0 ? Math.min(cfg.bots.max, Math.max(0, cfg.bots.target - realCount)) : 0
  if (wantBots > 0) {
    const names = [...BOT_NAMES]
    for (let i = names.length - 1; i > 0; i--) {
      const j = Math.floor(pick() * (i + 1))
      ;[names[i], names[j]] = [names[j], names[i]]
    }
    for (let i = 0; i < wantBots; i++) {
      const base = names[i % names.length]
      const name = i < names.length ? base : `${base}${i}`
      participants.push({ id: `${BOT_PREFIX}${i}`, name: cfg.bots.tag ? `${name}${BOT_TAG}` : name, image: null })
    }
  }

  const prizePlaces = resolveWinners(cfg, realCount)
  let winnerSlots: number[] = []
  let steps = 0
  let winningTeam = -1
  const sv = cfg.survival
  const teamRound = cfg.game === 'survival' && sv.teams > 0
  const n = participants.length
  const simulate = (s: number, powers: number[]) => {
    if (cfg.game === 'karadelik') {
      const kd = runKD(n, s, cfg.duration, prizePlaces, powers)
      return { winners: kd.survivors, steps: kd.steps, team: -1, order: kd.order }
    }
    if (cfg.game === 'survival') {
      const res = runSV({ n, seed: s, duration: cfg.duration, winners: prizePlaces, teams: sv.teams, rule: sv.rule, shield: sv.shield, captain: sv.captain, powers })
      return { winners: res.winners, steps: res.steps, team: res.winningTeam, order: (res as { order?: number[] }).order ?? [] }
    }
    const sim = runSim(n, s)
    return { winners: sim.winner !== null ? [sim.winner] : [], steps: sim.steps, team: -1, order: sim.order }
  }
  let order: number[] = []

  // Powers change the physics, so they are pinned to slots before simulating: each power holder gets a random slot up front.
  // The remaining slots are filled after the run, as before: plain real players on the winning slots, everyone else shuffled,
  // so bots still can never win. Team rounds only need one real winner. If a run would need more plain real players on
  // winning slots than exist (almost everyone holds a power), reroll the seed a few times, then fall back to no powers.
  const real = participants.slice(0, realCount)
  const bots = participants.slice(realCount)
  const powerOf = n ? await roundPowers(cfg, real.map((p) => p.id), slot) : new Map<string, 1 | 2>()
  let roundSeed = seed
  let slotPowers: number[] = []
  if (n) {
    const holders = real.filter((p) => powerOf.has(p.id))
    const plain = real.filter((p) => !powerOf.has(p.id))
    const shuffled = Array.from({ length: n }, (_, i) => i)
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(pick() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    const pinned = new Map(holders.map((p, k) => [shuffled[k], p]))
    const powered = Array.from({ length: n }, (_, i) => (pinned.has(i) ? powerOf.get(pinned.get(i)!.id)! : 0))

    const attempt = (s: number, powers: number[], held: Map<number, Participant>, free: Participant[]) => {
      const res = simulate(s, powers)
      const open = res.winners.filter((w) => !held.has(w))
      let need: number[]
      if (!res.winners.length) need = []
      else if (teamRound) need = open.length < res.winners.length ? [] : [open[Math.floor(pick() * open.length)]]
      else need = open
      return need.length <= free.length ? { res, need } : null
    }

    let found = holders.length ? null : attempt(seed, powered, pinned, plain)
    for (let k = 0; holders.length && !found && k < 6; k++) {
      const s = k === 0 ? seed : randomInt(1, 2 ** 31 - 1)
      found = attempt(s, powered, pinned, plain)
      if (found) {
        roundSeed = s
        slotPowers = powered
      }
    }
    const held = slotPowers.length ? pinned : new Map<number, Participant>()
    const free = slotPowers.length ? plain : [...real]
    if (!found) {
      roundSeed = seed
      found = attempt(seed, [], held, free) ?? { res: simulate(seed, []), need: [] }
    }
    winnerSlots = found.res.winners
    order = found.res.order
    steps = found.res.steps
    winningTeam = found.res.team

    if (bots.length || slotPowers.length) {
      const champs = found.need.map(() => free.splice(Math.floor(pick() * free.length), 1)[0]).filter(Boolean)
      const bySlot = new Map<number, Participant>(held)
      found.need.forEach((s, i) => champs[i] && bySlot.set(s, champs[i]))
      const rest = [...free, ...bots]
      for (let i = rest.length - 1; i > 0; i--) {
        const j = Math.floor(pick() * (i + 1))
        ;[rest[i], rest[j]] = [rest[j], rest[i]]
      }
      const out: Participant[] = []
      for (let i = 0; i < n; i++) out.push(bySlot.get(i) ?? rest.shift()!)
      participants.splice(0, n, ...out)
    }
  }
  const winners = winnerSlots.map((i) => participants[i]).filter((p) => p && !isBot(p.id))
  const first = winners[0] ?? null
  const { names } = await labelMaps(cfg)
  const text = prizeText(cfg.prizes, names)
  const winnerName = winners.length ? winners.map((w) => w.name).join(', ').slice(0, 200) : null
  // Team rounds have no individual top 3, so predictions stay off there.
  const predictKp = teamRound ? 0 : cfg.predictKp
  const podium = podiumSlots(winnerSlots, order)
    .map((i) => participants[i]?.id)
    .filter((id): id is string => !!id)

  const inserted = await rows<RoundRow>(sql`INSERT INTO cember_rounds
      (slot, title, seed, participants, winner_index, winner_id, winner_name, steps, prizes, prize_text, paid, event_id, game, duration, winner_indexes, prize_split, survival, winning_team, instant, powers, podium, predict_kp)
    VALUES (${new Date(slot).toISOString()}, ${cfg.title}, ${roundSeed}, ${JSON.stringify(participants)}::jsonb, ${winnerSlots[0] ?? null}, ${first?.id ?? null},
      ${winnerName}, ${steps}, ${JSON.stringify(cfg.prizes)}::jsonb, ${text}, ${!first && cfg.leftover !== 'carry'}, ${cfg.id}, ${cfg.game}, ${cfg.game === 'cember' ? 0 : cfg.duration},
      ${JSON.stringify(winnerSlots)}::jsonb, ${cfg.prizeSplit}, ${cfg.game === 'survival' ? JSON.stringify(sv) : null}::jsonb, ${winningTeam},
      ${cfg.extraSlots.some((x) => Date.parse(x) === slot)}, ${JSON.stringify(slotPowers)}::jsonb, ${JSON.stringify(podium)}::jsonb, ${predictKp})
    ON CONFLICT (slot) DO NOTHING RETURNING *`)
  // Payouts and announcements wait for the reveal (see getRound) so nobody learns the result during predictions.
  if (inserted[0] && first && cfg.leftover === 'carry') return applyCarry(inserted[0], names)
  return inserted[0] ?? (await loadRound(slot))
}

const CARRY_PREFIX = 'carry-'

/** Moves this event's carried-over KC/KP onto a freshly stored round that has a real winner. */
async function applyCarry(row: RoundRow, names: Record<string, string>): Promise<RoundRow> {
  if (!row.event_id) return row
  const c = await rows<{ coins: number; kp: number }>(sql`DELETE FROM cember_carry WHERE event_id = ${row.event_id} RETURNING coins, kp`)
  const coins = Number(c[0]?.coins ?? 0)
  const kp = Number(c[0]?.kp ?? 0)
  if (!coins && !kp) return row
  const prizes: CemberPrize[] = [...(Array.isArray(row.prizes) ? row.prizes : [])]
  if (coins > 0) prizes.push({ id: `${CARRY_PREFIX}kc`, type: 'coin', amount: coins, ref: null, label: 'Devreden KC' })
  if (kp > 0) prizes.push({ id: `${CARRY_PREFIX}kp`, type: 'kp', amount: kp, ref: null, label: 'Devreden KP' })
  const updated = await rows<RoundRow>(sql`UPDATE cember_rounds SET prizes = ${JSON.stringify(prizes)}::jsonb, prize_text = ${prizeText(prizes, names)}
    WHERE slot = ${row.slot} RETURNING *`)
  return updated[0] ?? row
}

/** A round nobody real won: park its KC/KP for the event's next round, capped at 5 rounds' worth. */
async function carryOver(row: RoundRow, prizes: CemberPrize[]) {
  if (!row.event_id) return
  const ev = (await getCemberEvents()).find((e) => e.id === row.event_id)
  if (ev?.leftover !== 'carry') return
  const sum = (type: PrizeType, list: CemberPrize[]) => list.filter((p) => p.type === type).reduce((s, p) => s + p.amount, 0)
  const coins = sum('coin', prizes)
  const kp = sum('kp', prizes)
  if (!coins && !kp) return
  const capKc = sum('coin', ev.prizes) * 5
  const capKp = sum('kp', ev.prizes) * 5
  await rows(sql`INSERT INTO cember_carry (event_id, coins, kp) VALUES (${row.event_id}, ${Math.min(coins, capKc)}, ${Math.min(kp, capKp)})
    ON CONFLICT (event_id) DO UPDATE SET coins = LEAST(${capKc}, cember_carry.coins + EXCLUDED.coins), kp = LEAST(${capKp}, cember_carry.kp + EXCLUDED.kp)`)
}

const settled = new Set<string>()

/** Pays prizes and predictions once the reveal has passed; both steps are idempotent. */
async function settleRound(row: RoundRow) {
  const key = new Date(row.slot).toISOString()
  if (settled.has(key)) return
  if (!row.paid) await payRound(row).catch((e) => console.error('[cember] pay failed', e))
  await settlePredictions(row).catch((e) => console.error('[cember] predictions failed', e))
  settled.add(key)
}

async function settlePredictions(row: RoundRow) {
  const kp = Number(row.predict_kp ?? 0)
  const claimed = await rows<{ user_id: string; picks: string[] }>(sql`UPDATE cember_predictions SET paid = true
    WHERE slot = ${row.slot} AND paid = false RETURNING user_id, picks`)
  if (!claimed.length || kp <= 0) return
  const podium = new Set(Array.isArray(row.podium) ? row.podium : [])
  const slotKey = new Date(row.slot).toISOString().slice(0, 16)
  for (const p of claimed) {
    const picks = Array.isArray(p.picks) ? p.picks : []
    const hits = picks.filter((id) => podium.has(id)).length
    if (!hits) continue
    const points = hits * kp * (hits === PREDICT_PICKS ? PREDICT_PERFECT_MULT : 1)
    const marker = await rows(sql`INSERT INTO kp_events (user_id, source, points, coins, ref, note)
      VALUES (${p.user_id}, 'cember_tahmin', ${points}, 0, ${slotKey}, ${`${row.title} tahmini`}) ON CONFLICT DO NOTHING RETURNING id`)
    if (!marker.length) continue
    await import('@/lib/inbox')
      .then(({ sendMessage }) =>
        sendMessage({
          userId: p.user_id,
          targetLabel: 'Kanka',
          title: `${row.title}: tahminin tuttu!`,
          body: `İlk 3 tahmininden ${hits}/${PREDICT_PICKS} doğru çıktı. Hesabına ${points.toLocaleString('tr-TR')} KP eklendi.`,
          url: '/profil',
          sentBy: row.title,
        }),
      )
      .catch(() => {})
  }
}

export type PredictResult = { ok: true; picks: string[] } | { ok: false; error: string }

export async function submitPrediction(userId: string, slotIso: string, rawPicks: unknown): Promise<PredictResult> {
  const slot = Date.parse(slotIso)
  const now = Date.now()
  if (!Number.isFinite(slot) || now < slot || now >= predictClosesAt(slot)) return { ok: false, error: 'Tahmin süresi doldu.' }
  await ensure()
  const row = await loadRound(slot)
  if (!row || Number(row.predict_kp ?? 0) <= 0) return { ok: false, error: 'Bu turda tahmin kapalı.' }
  const ids = new Set(row.participants.map((p) => p.id))
  const picks = [...new Set((Array.isArray(rawPicks) ? rawPicks : []).map(String))]
  if (!picks.length || picks.length > PREDICT_PICKS || picks.some((id) => !ids.has(id) || id === userId)) {
    return { ok: false, error: `Turdaki oyunculardan en fazla ${PREDICT_PICKS} kişi seç, kendini seçemezsin.` }
  }
  const saved = await rows(sql`INSERT INTO cember_predictions (slot, user_id, picks) VALUES (${row.slot}, ${userId}, ${JSON.stringify(picks)}::jsonb)
    ON CONFLICT (slot, user_id) DO UPDATE SET picks = EXCLUDED.picks, created_at = now() WHERE cember_predictions.paid = false RETURNING user_id`)
  return saved.length ? { ok: true, picks } : { ok: false, error: 'Tahmin süresi doldu.' }
}

export async function myPrediction(userId: string, slotIso: string): Promise<string[]> {
  const slot = Date.parse(slotIso)
  if (!Number.isFinite(slot)) return []
  await ensure()
  const r = await rows<{ picks: string[] }>(sql`SELECT picks FROM cember_predictions WHERE slot = ${new Date(slot).toISOString()} AND user_id = ${userId}`)
  return Array.isArray(r[0]?.picks) ? r[0].picks : []
}

/** Per-winner share of a prize: badges and market items go to everyone; KC/KP are divided when the event splits its pool. */
function shareOf(p: CemberPrize, split: boolean, count: number) {
  return split && count > 1 ? Math.max(1, Math.floor(p.amount / count)) : p.amount
}

async function payRound(row: RoundRow) {
  const claimed = await rows<{ prizes: CemberPrize[] }>(sql`UPDATE cember_rounds SET paid = true
    WHERE slot = ${row.slot} AND paid = false RETURNING prizes`)
  const c = claimed[0]
  if (!c) return
  const winners = winnerIndexes(row)
    .map((i) => row.participants[i])
    .filter((p): p is Participant => !!p && !isBot(p.id))
  if (!winners.length) return carryOver(row, c.prizes)
  const split = row.prize_split === 'split'
  const slotKey = new Date(row.slot).toISOString().slice(0, 16)
  // Carried-over amounts are one shared pot, so they are always split between winners.
  const share = (p: CemberPrize) => shareOf(p, split || p.id.startsWith(CARRY_PREFIX), winners.length)
  const coins = c.prizes.filter((p) => p.type === 'coin').reduce((s, p) => s + share(p), 0)
  const kp = c.prizes.filter((p) => p.type === 'kp').reduce((s, p) => s + share(p), 0)
  const players = Array.isArray(row.participants) ? row.participants.length : 0
  const isKd = row.game === 'karadelik'
  const isSv = row.game === 'survival'
  const svTeam = isSv && Number(row.winning_team) >= 0 && row.survival && Number(row.survival.teams) > 0
  const teamName = SV_TEAM_NAMES[Number(row.winning_team)] ?? 'Altın'
  const shareText = (fallback: string) =>
    split && winners.length > 1
      ? `${coins ? `${coins.toLocaleString('tr-TR')} KC` : ''}${coins && kp ? ' + ' : ''}${kp ? `${kp.toLocaleString('tr-TR')} KP` : ''}` || fallback
      : fallback
  const { credit, recordHistory } = await import('@/lib/member')

  for (const w of winners) {
    const userId = w.id
    const name = w.name || 'Kanka'
    // One kp_events row per winner per slot is the idempotency guard against a double payout.
    const marker = await rows(sql`INSERT INTO kp_events (user_id, source, points, coins, ref, note)
      VALUES (${userId}, 'cember', ${kp}, ${coins}, ${slotKey}, ${row.title}) ON CONFLICT DO NOTHING RETURNING id`)
    if (!marker.length) continue
    if (coins > 0) {
      await credit(userId, coins)
      await recordHistory({ userId, userName: name, game: 'cember', mode: 'odul', opponent: row.title, stake: 0, result: 'win', delta: coins })
    }
    for (const p of c.prizes) {
      if (p.type === 'badge' && p.ref) {
        const { awardBadge } = await import('@/lib/kanka-puan')
        await awardBadge(p.ref, userId, `cember-${slotKey}`, `${row.title} kazananı`).catch(() => {})
      }
      if (p.type === 'market' && p.ref) {
        const item = await rows<{ id: string; name: string; sponsor_name: string | null }>(sql`SELECT id, name, sponsor_name FROM market_items WHERE id = ${p.ref}`).catch(() => [])
        if (item[0]) {
          await rows(sql`INSERT INTO market_requests (item_id, item_name, sponsor_name, user_id, user_name, price, note)
            VALUES (${item[0].id}, ${item[0].name}, ${item[0].sponsor_name}, ${userId}, ${name}, 0, ${`${row.title} ödülü`})`).catch(() => {})
        }
      }
    }
    const headline = `${row.title}: ${name} kazandı!`
    const body = svTeam
      ? `${players} kankalık Survival Arena'yı ${teamName} Tak��m kazandı, sen de o takımdaydın. Ödülün: ${shareText(row.prize_text)}.`
      : isSv
        ? `${players} kanka arasından sahada ayakta kalan ${winners.length} kişiden biri sensin. Ödülün: ${shareText(row.prize_text)}.`
        : isKd
          ? `${players} kanka arasından kara delikten sağ çıkan ${winners.length} kişiden biri sensin. Ödülün: ${shareText(row.prize_text)}.`
          : `${players} kanka arasından son kalan sen oldun. Ödülün: ${row.prize_text}.`
    await Promise.allSettled([
      import('@/lib/inbox').then(({ sendMessage }) => sendMessage({ userId, targetLabel: name, title: headline, body, url: '/market', sentBy: row.title })),
      import('@/lib/push').then(({ sendToUsers }) => sendToUsers([userId], { title: headline, body, url: '/' })),
    ])
  }

  const list = winners.map((w) => w.name).join(', ')
  await import('@/lib/telegram-chat')
    .then(({ announceToChat }) =>
      announceToChat(
        svTeam
          ? `${row.title} bitti! ${players} kanka sahaya çıktı, ${teamName} Takım kazandı: ${list}. Ödül: ${row.prize_text}${split && winners.length > 1 ? ' (takım arasında bölüşüldü)' : ' (kişi başı)'}`
          : isKd || isSv
            ? `${row.title} bitti! ${players} kanka arenaya girdi, ${isSv ? 'ayakta kalanlar' : 'kara delikten sağ çıkanlar'}: ${list}. Ödül: ${row.prize_text}${split && winners.length > 1 ? ' (kazananlar arasında bölüşüldü)' : ' (kişi başı)'}`
            : `${row.title} bitti! ${players} kanka çembere girdi, son kalan ${list} oldu. Ödül: ${row.prize_text}`,
      ),
    )
    .catch(() => {})
}

export async function getRound(
  slotIso: string,
): Promise<{ state: 'wait' | 'none' | 'ready' | 'predict'; round?: CemberRound; preview?: CemberPreview }> {
  const slot = Date.parse(slotIso)
  if (!Number.isFinite(slot)) return { state: 'none' }
  if (slot > Date.now() + 1500) return { state: 'wait' }
  await ensure()
  let job = pending.get(slot)
  if (!job) {
    job = finalize(slot).finally(() => setTimeout(() => pending.delete(slot), 60_000))
    pending.set(slot, job)
  }
  const row = await job
  if (!row || !row.participants.length) return { state: 'none' }
  if (Date.now() < revealAt(slot)) {
    return {
      state: 'predict',
      preview: {
        slot: new Date(row.slot).toISOString(),
        title: row.title,
        game: asGame(row.game),
        participants: row.participants,
        predictKp: Number(row.predict_kp ?? 0),
        closesAt: new Date(predictClosesAt(slot)).toISOString(),
      },
    }
  }
  await settleRound(row)
  return { state: 'ready', round: toRound(row) }
}

export async function getCemberStatus(): Promise<CemberStatus> {
  const events = await getCemberEvents()
  const now = Date.now()
  const slots = slotsAround(events, now)
  const nextIdx = slots.findIndex((s) => s.at > now - liveWindowMs(s.ev))
  const next = nextIdx >= 0 ? slots[nextIdx] : null
  const cfg = next?.ev ?? events[0] ?? DEFAULT_CEMBER
  const { names, describe } = await labelMaps(cfg)

  // Settle the most recent due slot even if nobody had the page open at that minute.
  const due = [...slots].reverse().find((s) => s.at <= now)
  if (due && now - due.at < 26 * 3600_000) await getRound(new Date(due.at).toISOString()).catch(() => null)

  const upcoming =
    nextIdx >= 0
      ? await Promise.all(
          slots.slice(nextIdx, nextIdx + 6).map(async (s) => ({
            slot: new Date(s.at).toISOString(),
            title: s.ev.title,
            prizeText: s.ev === cfg ? prizeText(s.ev.prizes, names) : prizeText(s.ev.prizes, (await labelMaps(s.ev)).names),
          })),
        )
      : []

  const last = await rows<RoundRow>(sql`SELECT * FROM cember_rounds WHERE winner_name IS NOT NULL
    AND slot <= ${new Date(now - INTRO_SECONDS * 1000).toISOString()} ORDER BY slot DESC LIMIT 1`).catch(() => [])
  return {
    enabled: !!next,
    now: new Date(now).toISOString(),
    title: cfg.title,
    game: cfg.game,
    liveSeconds: liveSeconds(cfg),
    nextSlot: next ? new Date(next.at).toISOString() : null,
    eventId: next?.ev.id ?? null,
    prizeText: prizeText(cfg.prizes, names),
    conditions: cfg.conditions.map(describe),
    upcoming,
    last: last[0]
      ? { slot: new Date(last[0].slot).toISOString(), winnerName: last[0].winner_name ?? '', prizeText: last[0].prize_text, players: last[0].participants.length }
      : null,
  }
}

/** Daily cron safety net: settle any round in the past day that nobody triggered. */
export async function settleMissedRounds() {
  const events = await getCemberEvents()
  const now = Date.now()
  let settled = 0
  for (const s of slotsAround(events, now)) {
    if (s.at > now || now - s.at > 26 * 3600_000) continue
    const r = await getRound(new Date(s.at).toISOString()).catch(() => null)
    if (r?.state === 'ready') settled++
  }
  return settled
}

const trClock = (at: number) => new Date(at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' })

/**
 * Heads-up NOTICE_MINUTES before each round: Telegram group announcement + push to members already in the ring.
 * Runs off the public status poll; the notices table makes it fire once per slot no matter how many instances call it.
 */
export async function sendUpcomingNotices() {
  const events = await getCemberEvents()
  const now = Date.now()
  const due = slotsAround(events, now).filter((s) => s.at > now && s.at - now <= NOTICE_MINUTES * 60_000 + 15_000)
  for (const s of due) {
    const claimed = await rows(sql`INSERT INTO cember_notices (slot) VALUES (${new Date(s.at).toISOString()}) ON CONFLICT DO NOTHING RETURNING slot`)
    if (!claimed.length) continue
    const { names, describe } = await labelMaps(s.ev)
    const prize = prizeText(s.ev.prizes, names)
    const mins = Math.max(1, Math.round((s.at - now) / 60_000))
    const conditions = s.ev.conditions.map(describe).join(', ')
    const ids = (await eligibleIds(s.ev, now).catch(() => [] as string[])).slice(0, 2000)
    const instant = s.ev.extraSlots.some((x) => Date.parse(x) === s.at)
    const lead = instant ? 'Anlık etkinlik! ' : ''
    const where = s.ev.game === 'cember' ? 'çemberde' : 'arenada'
    const conditionPart = conditions ? ` Şartlar: ${conditions}.` : ''
    await Promise.allSettled([
      import('@/lib/telegram-chat').then(({ announceToChat }) =>
        announceToChat(
          `${lead}${s.ev.title} (${GAME_META[s.ev.game].label}) ${mins} dakika sonra (${trClock(s.at)}) başlıyor! Ödül: ${prize}.${conditionPart} ` +
            `Şu an ${ids.length} kanka ${where}, siteye gir canlı izle.`,
        ),
      ),
      ids.length
        ? import('@/lib/push').then(({ sendToUsers }) =>
            sendToUsers(
              ids,
              { title: `${lead}${s.ev.title} ${mins} dk sonra!`, body: `Kanka ${where}sın, ${trClock(s.at)} itibarıyla izlemeye gel. Ödül: ${prize}`, url: '/' },
              'cember',
            ),
          )
        : null,
    ])
  }
}

// --- Table pause ---------------------------------------------------------

type PauseWindow = [start: number, end: number]
let pauseCache: { at: number; windows: PauseWindow[] } | null = null

/** Time ranges in which a Çember round is on everyone's screen; table clocks must not run during these. */
export async function cemberPauseWindows(): Promise<PauseWindow[]> {
  const now = Date.now()
  if (pauseCache && now - pauseCache.at < 5000) return pauseCache.windows
  const windows: PauseWindow[] = []
  try {
    await ensure()
    const r = await rows<{ slot: string | Date; steps: number; n: number; game: string | null }>(
      sql`SELECT slot, steps, game, jsonb_array_length(participants) AS n FROM cember_rounds WHERE slot > now() - interval '6 hours'`,
    )
    for (const x of r) {
      if (Number(x.n) <= 0) continue
      const s = new Date(x.slot).getTime()
    const step = x.game === 'karadelik' ? KD_STEP : x.game === 'survival' ? SV_STEP : STEP
    windows.push([s, s + (INTRO_SECONDS + Number(x.steps) * step + RESULT_SECONDS + (x.game === 'cember' || !x.game ? 0 : 6)) * 1000 + 3000])
    }
    // A slot that started but has not been settled yet (first viewer still loading) is paused until it is.
    for (const s of slotsAround(await getCemberEvents(), now)) {
      if (s.at <= now && now - s.at < 90_000 && !windows.some((w) => w[0] === s.at)) windows.push([s.at, now + 5000])
    }
  } catch (e) {
    console.error('[cember] pause windows failed', e)
  }
  pauseCache = { at: now, windows }
  return windows
}

/** Milliseconds of [from, to] that fall inside a pause window. */
export function pausedMs(from: number, to: number, windows: PauseWindow[]) {
  let total = 0
  for (const [s, e] of windows) total += Math.max(0, Math.min(to, e) - Math.max(from, s))
  return total
}

export function isPausedAt(t: number, windows: PauseWindow[]) {
  return windows.some(([s, e]) => t >= s && t < e)
}

export async function recentRounds(limit = 12) {
  await ensure()
  const r = await rows<RoundRow>(sql`SELECT * FROM cember_rounds ORDER BY slot DESC LIMIT ${limit}`)
  return r.map((x) => ({
    slot: new Date(x.slot).toISOString(),
    title: x.title,
      game: asGame(x.game),
    players: x.participants.length,
    bots: x.participants.filter((p) => isBot(p.id)).length,
    winner: x.winner_name,
    prize: x.prize_text,
    paid: x.paid,
    instant: !!x.instant,
  }))
}

export type CemberCareer = {
  played: number
  wins: number
  podiums: number
  bestStreak: number
  byGame: Record<CemberGame, { played: number; wins: number }>
  recent: { slot: string; title: string; game: CemberGame; place: 1 | 2 | 3 | null; won: boolean; players: number }[]
  predictions: { made: number; hits: number; perfect: number }
}

/** Lifetime arena stats; only rounds whose result is already public are counted. */
export async function cemberCareer(userId: string): Promise<CemberCareer> {
  await ensure()
  const empty = (): CemberCareer['byGame'] => ({ cember: { played: 0, wins: 0 }, karadelik: { played: 0, wins: 0 }, survival: { played: 0, wins: 0 } })
  const career: CemberCareer = { played: 0, wins: 0, podiums: 0, bestStreak: 0, byGame: empty(), recent: [], predictions: { made: 0, hits: 0, perfect: 0 } }
  const me = JSON.stringify([{ id: userId }])
  const [list, preds] = await Promise.all([
    rows<RoundRow>(sql`SELECT * FROM cember_rounds WHERE participants @> ${me}::jsonb AND steps > 0 ORDER BY slot ASC LIMIT 2000`).catch(() => [] as RoundRow[]),
    rows<{ picks: string[]; podium: string[] | null; slot: string; game: CemberGame | null; duration: number | null }>(
      sql`SELECT p.picks, r.podium, r.slot, r.game, r.duration FROM cember_predictions p JOIN cember_rounds r ON r.slot = p.slot WHERE p.user_id = ${userId} AND r.steps > 0`,
    ).catch(() => []),
  ])
  const now = Date.now()
  const finished = (slot: string, game: CemberGame | null, duration: number | null, players: number) =>
    new Date(slot).getTime() + liveWindowMs({ game: asGame(game), duration: Number(duration ?? 0), maxPlayers: players }) < now

  let streak = 0
  for (const r of list) {
    if (!finished(r.slot, r.game, r.duration, r.participants.length)) continue
    const game = asGame(r.game)
    const idx = r.participants.findIndex((p) => p.id === userId)
    const won = winnerIndexes(r).includes(idx)
    const pos = (Array.isArray(r.podium) ? r.podium.map(String) : []).indexOf(userId)
    const place = pos >= 0 && pos < 3 ? ((pos + 1) as 1 | 2 | 3) : null
    career.played++
    career.byGame[game].played++
    if (won) {
      career.wins++
      career.byGame[game].wins++
      streak++
      career.bestStreak = Math.max(career.bestStreak, streak)
    } else streak = 0
    if (place) career.podiums++
    career.recent.unshift({ slot: new Date(r.slot).toISOString(), title: r.title, game, place, won, players: r.participants.length })
  }
  career.recent = career.recent.slice(0, 8)

  for (const p of preds) {
    if (!finished(p.slot, p.game, p.duration, 0)) continue
    const podium = new Set(Array.isArray(p.podium) ? p.podium.map(String) : [])
    const hits = (Array.isArray(p.picks) ? p.picks : []).filter((id) => podium.has(String(id))).length
    career.predictions.made++
    career.predictions.hits += hits
    if (hits >= PREDICT_PICKS) career.predictions.perfect++
  }
  return career
}
