import 'server-only'
import { randomInt } from 'node:crypto'
import { rows, sql } from '@/lib/db'
import { ARENA_META, type ArenaGame } from '@/lib/arena'
import { runSim, mulberry, STEP } from '@/lib/cember-sim'
import {
  CONDITION_KINDS,
  DEFAULT_CEMBER,
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
} from '@/lib/cember-shared'

const TR_OFFSET_MS = 3 * 3600_000
const SETTINGS_KEY = 'cember'
/** A slot stays "current" this long so late visitors can still join the live round. */
const LIVE_WINDOW_MS = 5 * 60_000

let ready: Promise<void> | null = null
function ensure() {
  ready ??= (async () => {
    const { ensureKp } = await import('@/lib/kanka-puan')
    await ensureKp()
    await rows(sql`CREATE TABLE IF NOT EXISTS cember_rounds (
      slot timestamptz PRIMARY KEY, title text NOT NULL, seed bigint NOT NULL, participants jsonb NOT NULL,
      winner_index int, winner_id text, winner_name text, steps int NOT NULL DEFAULT 0, prizes jsonb NOT NULL DEFAULT '[]'::jsonb,
      prize_text text NOT NULL DEFAULT '', paid boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now())`)
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

export function normalizeConfig(raw: Partial<CemberConfig> | null | undefined): CemberConfig {
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
  return {
    enabled: c.enabled !== false,
    title: String(c.title || DEFAULT_CEMBER.title).slice(0, 40),
    hours,
    minute: clampInt(c.minute, 0, 59, 0),
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

let configCache: { at: number; value: CemberConfig } | null = null

export async function getCemberConfig(): Promise<CemberConfig> {
  if (configCache && Date.now() - configCache.at < 20_000) return configCache.value
  await ensure()
  const r = await rows<{ value: Partial<CemberConfig> }>(sql`SELECT value FROM kp_settings WHERE key = ${SETTINGS_KEY}`)
  const value = normalizeConfig(r[0]?.value)
  configCache = { at: Date.now(), value }
  return value
}

export async function saveCemberConfig(input: Partial<CemberConfig>) {
  await ensure()
  const value = normalizeConfig(input)
  if (!value.conditions.length) throw new Error('En az bir katılım şartı ekle.')
  if (!value.prizes.length) throw new Error('En az bir ödül ekle.')
  await rows(sql`INSERT INTO kp_settings (key, value) VALUES (${SETTINGS_KEY}, ${JSON.stringify(value)}::jsonb)
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`)
  configCache = null
  return value
}

export async function scheduleTestRound(delaySeconds: number) {
  const cfg = await getCemberConfig()
  const at = new Date(Math.ceil((Date.now() + delaySeconds * 1000) / 1000) * 1000).toISOString()
  await saveCemberConfig({ ...cfg, extraSlots: [...cfg.extraSlots, at] })
  return at
}

// --- Slots ---------------------------------------------------------------

function trDayStart(at: number) {
  const tr = at + TR_OFFSET_MS
  return tr - (tr % 86400_000) - TR_OFFSET_MS
}

function slotsAround(cfg: CemberConfig, now: number): number[] {
  const out = new Set<number>()
  const today = trDayStart(now)
  for (const day of [today - 86400_000, today, today + 86400_000]) {
    for (const h of cfg.hours) out.add(day + h * 3600_000 + cfg.minute * 60_000)
  }
  for (const s of cfg.extraSlots) out.add(Date.parse(s))
  return [...out].sort((a, b) => a - b)
}

function isScheduled(cfg: CemberConfig, slot: number) {
  return slotsAround(cfg, slot).includes(slot)
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
  const cfg = await getCemberConfig()
  if (!userId) return { signedIn: false, userId: null, eligible: false, progress: [] }
  const { describe } = await labelMaps(cfg)
  const now = Date.now()
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
}

const toRound = (r: RoundRow): CemberRound => ({
  slot: new Date(r.slot).toISOString(),
  title: r.title,
  seed: Number(r.seed),
  participants: r.participants,
  winner: r.winner_index,
  steps: Number(r.steps),
  prizeText: r.prize_text,
})

async function loadRound(slot: number) {
  const r = await rows<RoundRow>(sql`SELECT * FROM cember_rounds WHERE slot = ${new Date(slot).toISOString()}`)
  return r[0] ?? null
}

const pending = new Map<number, Promise<RoundRow | null>>()

/** Settles a due slot exactly once: snapshot the qualifiers, pick a seed, simulate, store, pay. */
async function finalize(slot: number): Promise<RoundRow | null> {
  const existing = await loadRound(slot)
  if (existing) {
    if (!existing.paid) await payRound(existing).catch(() => {})
    return existing
  }
  const cfg = await getCemberConfig()
  if (!cfg.enabled || !isScheduled(cfg, slot)) return null

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

  const sim = participants.length ? runSim(participants.length, seed) : { winner: null, steps: 0 }
  const winner = sim.winner !== null ? participants[sim.winner] : null
  const { names } = await labelMaps(cfg)
  const text = prizeText(cfg.prizes, names)

  const inserted = await rows<RoundRow>(sql`INSERT INTO cember_rounds (slot, title, seed, participants, winner_index, winner_id, winner_name, steps, prizes, prize_text, paid)
    VALUES (${new Date(slot).toISOString()}, ${cfg.title}, ${seed}, ${JSON.stringify(participants)}::jsonb, ${sim.winner}, ${winner?.id ?? null},
      ${winner?.name ?? null}, ${sim.steps}, ${JSON.stringify(cfg.prizes)}::jsonb, ${text}, ${!winner})
    ON CONFLICT (slot) DO NOTHING RETURNING *`)
  const row = inserted[0] ?? (await loadRound(slot))
  if (inserted[0] && winner) await payRound(inserted[0]).catch((e) => console.error('[cember] pay failed', e))
  return row
}

async function payRound(row: RoundRow) {
  const claimed = await rows<{ winner_id: string | null; prizes: CemberPrize[] }>(sql`UPDATE cember_rounds SET paid = true
    WHERE slot = ${row.slot} AND paid = false RETURNING winner_id, prizes`)
  const c = claimed[0]
  if (!c?.winner_id) return
  const userId = c.winner_id
  const name = row.winner_name ?? 'Kanka'
  const slotKey = new Date(row.slot).toISOString().slice(0, 16)
  const coins = c.prizes.filter((p) => p.type === 'coin').reduce((s, p) => s + p.amount, 0)
  const kp = c.prizes.filter((p) => p.type === 'kp').reduce((s, p) => s + p.amount, 0)

  const marker = await rows(sql`INSERT INTO kp_events (user_id, source, points, coins, ref, note)
    VALUES (${userId}, 'cember', ${kp}, ${coins}, ${slotKey}, ${row.title}) ON CONFLICT DO NOTHING RETURNING id`)
  if (!marker.length) return

  const { credit, recordHistory } = await import('@/lib/member')
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

  const players = Array.isArray(row.participants) ? row.participants.length : 0
  const headline = `${row.title}: ${name} kazandı!`
  const body = `${players} kanka arasından son kalan sen oldun. Ödülün: ${row.prize_text}.`
  await Promise.allSettled([
    import('@/lib/inbox').then(({ sendMessage }) => sendMessage({ userId, targetLabel: name, title: headline, body, url: '/', sentBy: row.title })),
    import('@/lib/push').then(({ sendToUsers }) => sendToUsers([userId], { title: headline, body, url: '/' })),
    import('@/lib/telegram-chat').then(({ announceToChat }) =>
      announceToChat(`${row.title} bitti! ${players} kanka çembere girdi, son kalan ${name} oldu. Ödül: ${row.prize_text}`),
    ),
  ])
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
  const cfg = await getCemberConfig()
  const now = Date.now()
  const slots = slotsAround(cfg, now)
  const next = cfg.enabled ? slots.find((s) => s > now - LIVE_WINDOW_MS) ?? null : null
  const { names, describe } = await labelMaps(cfg)

  // Settle the most recent due slot even if nobody had the page open at that minute.
  const due = [...slots].reverse().find((s) => s <= now)
  if (cfg.enabled && due && now - due < 26 * 3600_000) await getRound(new Date(due).toISOString()).catch(() => null)

  const last = await rows<RoundRow>(sql`SELECT * FROM cember_rounds WHERE winner_name IS NOT NULL ORDER BY slot DESC LIMIT 1`).catch(() => [])
  return {
    enabled: cfg.enabled,
    now: new Date(now).toISOString(),
    title: cfg.title,
    nextSlot: next ? new Date(next).toISOString() : null,
    prizeText: prizeText(cfg.prizes, names),
    conditions: cfg.conditions.map(describe),
    last: last[0]
      ? { slot: new Date(last[0].slot).toISOString(), winnerName: last[0].winner_name ?? '', prizeText: last[0].prize_text, players: last[0].participants.length }
      : null,
  }
}

/** Daily cron safety net: settle any round in the past day that nobody triggered. */
export async function settleMissedRounds() {
  const cfg = await getCemberConfig()
  if (!cfg.enabled) return 0
  const now = Date.now()
  let settled = 0
  for (const s of slotsAround(cfg, now)) {
    if (s > now || now - s > 26 * 3600_000) continue
    const r = await getRound(new Date(s).toISOString()).catch(() => null)
    if (r?.state === 'ready') settled++
  }
  return settled
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
    const r = await rows<{ slot: string | Date; steps: number; n: number }>(
      sql`SELECT slot, steps, jsonb_array_length(participants) AS n FROM cember_rounds WHERE slot > now() - interval '6 hours'`,
    )
    for (const x of r) {
      if (Number(x.n) <= 0) continue
      const s = new Date(x.slot).getTime()
      windows.push([s, s + (INTRO_SECONDS + Number(x.steps) * STEP + RESULT_SECONDS) * 1000 + 3000])
    }
    const cfg = await getCemberConfig()
    if (cfg.enabled) {
      for (const s of slotsAround(cfg, now)) {
        if (s <= now && now - s < 90_000 && !windows.some((w) => w[0] === s)) windows.push([s, now + 5000])
      }
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
  return r.map((x) => ({ slot: new Date(x.slot).toISOString(), players: x.participants.length, winner: x.winner_name, prize: x.prize_text, paid: x.paid }))
}
