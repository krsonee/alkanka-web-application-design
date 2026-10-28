import 'server-only'
import { randomInt } from 'node:crypto'
import { rows, sql } from '@/lib/db'
import { ARENA_META, type ArenaGame } from '@/lib/arena'
import { runSim, mulberry, STEP } from '@/lib/cember-sim'
import { runKD, KD_STEP } from '@/lib/karadelik-sim'
import { runSV, SV_STEP } from '@/lib/survival-sim'
import {
  asGame,
  DEFAULT_SURVIVAL,
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
  EVERY_OPTIONS,
  MAX_EVENTS,
  MIN_SLOT_GAP_MIN,
  NOTICE_MINUTES,
  slotMinutes,
} from '@/lib/cember-shared'

const TR_OFFSET_MS = 3 * 3600_000
const SETTINGS_KEY = 'cember'
/** Matches the client's live window: once a round's window passes, the countdown moves on to the next slot. */
const liveWindowMs = (ev: Pick<CemberConfig, 'game' | 'duration'>) => liveSeconds(ev) * 1000

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
    await rows(sql`CREATE TABLE IF NOT EXISTS cember_notices (slot timestamptz PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now())`)
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
    survival: normalizeSurvival(c.survival),
    bots: {
      enabled: rawBots.enabled !== false,
      target: clampInt(rawBots.target, 2, MAX_BOTS + MAX_PLAYERS, DEFAULT_BOTS.target),
      max: clampInt(rawBots.max, 0, MAX_BOTS, DEFAULT_BOTS.max),
    },
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
  paid: boolean
  game: CemberGame | null
  duration: number | null
  winner_indexes: number[] | null
  prize_split: 'each' | 'split' | null
  survival: SurvivalOpts | null
  winning_team: number | null
}

function normalizeSurvival(raw: unknown): SurvivalOpts {
  const s = (raw ?? {}) as Partial<SurvivalOpts>
  return {
    teams: Number(s.teams) === 2 ? 2 : 0,
    rule: s.rule === 'most' ? 'most' : DEFAULT_SURVIVAL.rule,
    shield: s.shield === undefined ? DEFAULT_SURVIVAL.shield : s.shield !== false,
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
})

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
  if (existing) {
    if (!existing.paid) await payRound(existing).catch(() => {})
    return existing
  }
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
      participants.push({ id: `${BOT_PREFIX}${i}`, name: i < names.length ? base : `${base}${i}`, image: null })
    }
  }

  const prizePlaces = resolveWinners(cfg, realCount)
  let winnerSlots: number[] = []
  let steps = 0
  let winningTeam = -1
  const sv = cfg.survival
  const teamRound = cfg.game === 'survival' && sv.teams === 2
  if (participants.length && cfg.game === 'karadelik') {
    const kd = runKD(participants.length, seed, cfg.duration, prizePlaces)
    winnerSlots = kd.survivors
    steps = kd.steps
  } else if (participants.length && cfg.game === 'survival') {
    const res = runSV({ n: participants.length, seed, duration: cfg.duration, winners: prizePlaces, teams: sv.teams, rule: sv.rule, shield: sv.shield })
    winnerSlots = res.winners
    steps = res.steps
    winningTeam = res.winningTeam
  } else if (participants.length) {
    const sim = runSim(participants.length, seed)
    winnerSlots = sim.winner !== null ? [sim.winner] : []
    steps = sim.steps
  }

  // The physics outcome depends only on the ball count and seed, so the winning slots are fixed before identities are assigned.
  // Seat random real players there and shuffle everyone else across the remaining slots: bots can never win.
  // Survival team rounds pay the whole winning team, so only one seat is reserved for a real player and teammates stay random.
  if (winnerSlots.length && participants.length > realCount) {
    const real = participants.slice(0, realCount)
    const bots = participants.slice(realCount)
    const seatSlots = teamRound ? [winnerSlots[Math.floor(pick() * winnerSlots.length)]] : winnerSlots
    const champs = seatSlots.map(() => real.splice(Math.floor(pick() * real.length), 1)[0]).filter(Boolean)
    const rest = [...real, ...bots]
    for (let i = rest.length - 1; i > 0; i--) {
      const j = Math.floor(pick() * (i + 1))
      ;[rest[i], rest[j]] = [rest[j], rest[i]]
    }
    const out: Participant[] = []
    const bySlot = new Map(seatSlots.map((s, i) => [s, champs[i]]))
    for (let i = 0; i < participants.length; i++) out.push(bySlot.get(i) ?? rest.shift()!)
    participants.splice(0, participants.length, ...out)
  }
  const winners = winnerSlots.map((i) => participants[i]).filter((p) => p && !isBot(p.id))
  const first = winners[0] ?? null
  const { names } = await labelMaps(cfg)
  const text = prizeText(cfg.prizes, names)
  const winnerName = winners.length ? winners.map((w) => w.name).join(', ').slice(0, 200) : null

  const inserted = await rows<RoundRow>(sql`INSERT INTO cember_rounds
      (slot, title, seed, participants, winner_index, winner_id, winner_name, steps, prizes, prize_text, paid, event_id, game, duration, winner_indexes, prize_split, survival, winning_team)
    VALUES (${new Date(slot).toISOString()}, ${cfg.title}, ${seed}, ${JSON.stringify(participants)}::jsonb, ${winnerSlots[0] ?? null}, ${first?.id ?? null},
      ${winnerName}, ${steps}, ${JSON.stringify(cfg.prizes)}::jsonb, ${text}, ${!first}, ${cfg.id}, ${cfg.game}, ${cfg.game === 'cember' ? 0 : cfg.duration},
      ${JSON.stringify(winnerSlots)}::jsonb, ${cfg.prizeSplit}, ${cfg.game === 'survival' ? JSON.stringify(sv) : null}::jsonb, ${winningTeam})
    ON CONFLICT (slot) DO NOTHING RETURNING *`)
  const row = inserted[0] ?? (await loadRound(slot))
  if (inserted[0] && first) await payRound(inserted[0]).catch((e) => console.error('[cember] pay failed', e))
  return row
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
  if (!winners.length) return
  const split = row.prize_split === 'split'
  const slotKey = new Date(row.slot).toISOString().slice(0, 16)
  const coins = c.prizes.filter((p) => p.type === 'coin').reduce((s, p) => s + shareOf(p, split, winners.length), 0)
  const kp = c.prizes.filter((p) => p.type === 'kp').reduce((s, p) => s + shareOf(p, split, winners.length), 0)
  const players = Array.isArray(row.participants) ? row.participants.length : 0
  const isKd = row.game === 'karadelik'
  const isSv = row.game === 'survival'
  const svTeam = isSv && Number(row.winning_team) >= 0 && row.survival && Number(row.survival.teams) === 2
  const teamName = Number(row.winning_team) === 1 ? 'Mavi' : 'Altın'
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
      ? `${players} kankalık Survival Arena'yı ${teamName} Takım kazandı, sen de o takımdaydın. Ödülün: ${shareText(row.prize_text)}.`
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

export async function getRound(slotIso: string): Promise<{ state: 'wait' | 'none' | 'ready'; round?: CemberRound }> {
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

  const last = await rows<RoundRow>(sql`SELECT * FROM cember_rounds WHERE winner_name IS NOT NULL ORDER BY slot DESC LIMIT 1`).catch(() => [])
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
    await Promise.allSettled([
      import('@/lib/telegram-chat').then(({ announceToChat }) =>
        announceToChat(
          `${s.ev.title} ${mins} dakika sonra (${trClock(s.at)}) başlıyor! Ödül: ${prize}. Şartlar: ${conditions}. ` +
            `Şu an ${ids.length} kanka çemberde, siteye gir canlı izle.`,
        ),
      ),
      ids.length
        ? import('@/lib/push').then(({ sendToUsers }) =>
            sendToUsers(ids, { title: `${s.ev.title} ${mins} dk sonra!`, body: `Çemberdesin kanka, ${trClock(s.at)} itibarıyla izlemeye gel. Ödül: ${prize}`, url: '/' }, 'cember'),
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
  }))
}
