import 'server-only'
import { rows, sql } from '@/lib/db'
import { ensureKp, isRoleHolder } from '@/lib/kanka-puan'
import { credit } from '@/lib/member'
import { trDay } from '@/lib/task-period'
import { getGameSnapshot, getLiveFootball, type LiveGame } from '@/lib/kankatv'
import {
  cleanTvConfig,
  DEFAULT_TV,
  REACTIONS,
  type PredictPick,
  type Reaction,
  type TvBotStatus,
  type TvConfig,
  type TvEngage,
  type TvOdd,
  type TvPrediction,
  type TvPublic,
  type TvStats,
  type TvWatchStatus,
} from '@/lib/kankatv-shared'

const CONFIG_KEY = 'kankatv'
const SCAN_KEY = 'kankatv_scan'
const BOT_STATUS_KEY = 'kankatv_bot_status'
const SCAN_EVERY_SECONDS = 60
const MAX_FOLLOWS = 20

let ready: Promise<unknown> | null = null
export function ensureTv() {
  ready ??= (async () => {
    await ensureKp()
    await rows(sql`ALTER TABLE kp_events ADD COLUMN IF NOT EXISTS coins int NOT NULL DEFAULT 0`)
    await rows(sql`CREATE TABLE IF NOT EXISTS tv_watch_ticks (user_id text NOT NULL, minute timestamptz NOT NULL, PRIMARY KEY (user_id, minute))`)
    await rows(sql`CREATE TABLE IF NOT EXISTS tv_presence (viewer text PRIMARY KEY, last_seen timestamptz NOT NULL DEFAULT now())`)
    await rows(sql`CREATE TABLE IF NOT EXISTS tv_reactions (id serial PRIMARY KEY, user_id text NOT NULL, kind text NOT NULL, created_at timestamptz NOT NULL DEFAULT now())`)
    await rows(sql`CREATE TABLE IF NOT EXISTS tv_predictions (
      id serial PRIMARY KEY, user_id text NOT NULL, game_id bigint NOT NULL, home text NOT NULL, away text NOT NULL,
      base_goals int NOT NULL, base_home int NOT NULL, base_away int NOT NULL, pick text NOT NULL,
      status text NOT NULL DEFAULT 'open', coin int NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(), settled_at timestamptz, UNIQUE (user_id, game_id, base_goals))`)
    await rows(sql`CREATE INDEX IF NOT EXISTS tv_predictions_open ON tv_predictions (status, created_at) WHERE status = 'open'`)
    await rows(sql`CREATE TABLE IF NOT EXISTS tv_follows (user_id text NOT NULL, team_id bigint NOT NULL, team_name text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (user_id, team_id))`)
    await rows(sql`CREATE INDEX IF NOT EXISTS tv_follows_team ON tv_follows (team_id)`)
    await rows(sql`CREATE TABLE IF NOT EXISTS tv_goal_state (game_id bigint PRIMARY KEY, home int NOT NULL, away int NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())`)
  })().catch((error) => {
    ready = null
    throw error
  })
  return ready
}

async function readSetting<T>(key: string): Promise<T | null> {
  const [row] = await rows<{ value: T }>(sql`SELECT value FROM kp_settings WHERE key = ${key}`)
  return row?.value ?? null
}

async function writeSetting(key: string, value: unknown) {
  await rows(sql`INSERT INTO kp_settings (key, value) VALUES (${key}, ${JSON.stringify(value)}::jsonb)
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`)
}

export async function getTvConfig(): Promise<TvConfig> {
  await ensureTv()
  const raw = await readSetting<unknown>(CONFIG_KEY)
  return raw ? cleanTvConfig(raw) : DEFAULT_TV
}

export async function saveTvConfig(input: unknown) {
  await ensureTv()
  await writeSetting(CONFIG_KEY, cleanTvConfig(input))
}

function publicConfig(cfg: TvConfig): TvPublic {
  const { goalBot, ...rest } = cfg
  return { ...rest, goalAlerts: goalBot.push }
}

// --- Watch & earn ----------------------------------------------------------

async function watchStatus(userId: string, cfg: TvConfig): Promise<TvWatchStatus> {
  const today = trDay()
  const [m] = await rows<{ n: string }>(sql`SELECT count(*) AS n FROM tv_watch_ticks
    WHERE user_id = ${userId} AND (minute AT TIME ZONE 'Europe/Istanbul')::date = ${today}::date`)
  const [e] = await rows<{ n: string }>(sql`SELECT coalesce(sum(coins), 0) AS n FROM kp_events
    WHERE user_id = ${userId} AND source = 'kankatv' AND ref LIKE ${`${today}:%`}`)
  const minutes = Number(m?.n ?? 0)
  const earned = Number(e?.n ?? 0)
  const capped = cfg.watch.dailyCap > 0 && earned >= cfg.watch.dailyCap
  const nextIn = !cfg.watch.enabled || cfg.watch.coin <= 0 || capped ? null : cfg.watch.minutes - (minutes % cfg.watch.minutes)
  return { minutes, earned, cap: cfg.watch.dailyCap, nextIn }
}

/** One tick per minute at most; every full interval of watching pays once, up to the daily cap. */
export async function tickWatch(userId: string): Promise<TvWatchStatus> {
  const cfg = await getTvConfig()
  if (!cfg.watch.enabled) return watchStatus(userId, cfg)
  await rows(sql`INSERT INTO tv_watch_ticks (user_id, minute) VALUES (${userId}, date_trunc('minute', now())) ON CONFLICT DO NOTHING`)
  const status = await watchStatus(userId, cfg)
  if (cfg.watch.coin <= 0 || (await isRoleHolder(userId))) return status
  const today = trDay()
  const steps = Math.floor(status.minutes / cfg.watch.minutes)
  const maxSteps = cfg.watch.dailyCap > 0 ? Math.floor(cfg.watch.dailyCap / cfg.watch.coin) : steps
  let paid = 0
  for (let step = 1; step <= Math.min(steps, maxSteps); step++) {
    const inserted = await rows(sql`INSERT INTO kp_events (user_id, source, points, coins, ref, note)
      VALUES (${userId}, 'kankatv', 0, ${cfg.watch.coin}, ${`${today}:${step}`}, ${`KankaTV ${step * cfg.watch.minutes} dk izleme`})
      ON CONFLICT DO NOTHING RETURNING id`)
    if (!inserted.length) continue
    await credit(userId, cfg.watch.coin)
    paid += cfg.watch.coin
  }
  return paid ? watchStatus(userId, cfg) : status
}

// --- Presence & reactions -------------------------------------------------

export async function touchPresence(viewer: string) {
  if (!/^[\w-]{8,64}$/.test(viewer)) return
  await rows(sql`INSERT INTO tv_presence (viewer, last_seen) VALUES (${viewer}, now()) ON CONFLICT (viewer) DO UPDATE SET last_seen = now()`)
}

async function viewerCount() {
  const [r] = await rows<{ n: string }>(sql`SELECT count(*) AS n FROM tv_presence WHERE last_seen > now() - interval '2 minutes'`)
  return Number(r?.n ?? 0)
}

export async function addReaction(userId: string, kind: string) {
  if (!REACTIONS.includes(kind as Reaction)) throw new Error('Geçersiz tepki')
  const [recent] = await rows<{ n: string }>(sql`SELECT count(*) AS n FROM tv_reactions WHERE user_id = ${userId} AND created_at > now() - interval '10 seconds'`)
  if (Number(recent?.n ?? 0) >= 5) throw new Error('Biraz yavaş kanka')
  await rows(sql`INSERT INTO tv_reactions (user_id, kind) VALUES (${userId}, ${kind})`)
}

async function recentReactions(since: number) {
  return rows<{ id: number; kind: Reaction }>(sql`SELECT id, kind FROM tv_reactions
    WHERE id > ${since} AND created_at > now() - interval '30 seconds' ORDER BY id DESC LIMIT 30`)
}

// --- Next-goal predictions -------------------------------------------------

const toPrediction = (r: Record<string, unknown>): TvPrediction => ({
  id: Number(r.id),
  gameId: Number(r.game_id),
  home: String(r.home),
  away: String(r.away),
  pick: r.pick as PredictPick,
  status: r.status as TvPrediction['status'],
  coin: Number(r.coin),
  createdAt: new Date(String(r.created_at)).toISOString(),
})

export async function placePrediction(userId: string, gameId: number, pick: PredictPick) {
  const cfg = await getTvConfig()
  if (!cfg.predict.enabled) throw new Error('Tahminler şu an kapalı')
  if (!Number.isSafeInteger(gameId) || !['home', 'away', 'none'].includes(pick)) throw new Error('Geçersiz tahmin')
  const [today] = await rows<{ n: string }>(sql`SELECT count(*) AS n FROM tv_predictions
    WHERE user_id = ${userId} AND (created_at AT TIME ZONE 'Europe/Istanbul')::date = ${trDay()}::date`)
  if (Number(today?.n ?? 0) >= cfg.predict.dailyLimit) throw new Error(`Günlük ${cfg.predict.dailyLimit} tahmin hakkın doldu`)
  const [open] = await rows(sql`SELECT id FROM tv_predictions WHERE user_id = ${userId} AND game_id = ${gameId} AND status = 'open'`)
  if (open) throw new Error('Bu maçta açık tahminin var, sonuçlanınca yenisini yapabilirsin')
  const snap = await getGameSnapshot(gameId)
  if (!snap || snap.state === 'post') throw new Error('Bu maç için tahmin kapalı')
  const goals = snap.home.score + snap.away.score
  const inserted = await rows(sql`INSERT INTO tv_predictions (user_id, game_id, home, away, base_goals, base_home, base_away, pick, coin)
    VALUES (${userId}, ${gameId}, ${snap.home.name}, ${snap.away.name}, ${goals}, ${snap.home.score}, ${snap.away.score}, ${pick}, ${cfg.predict.coin})
    ON CONFLICT DO NOTHING RETURNING *`)
  if (!inserted.length) throw new Error('Bu skor için zaten tahmin yaptın')
  return toPrediction(inserted[0])
}

type OpenRow = { id: number; user_id: string; game_id: string; base_goals: number; base_home: number; base_away: number; pick: PredictPick; coin: number }

function outcome(row: OpenRow, snap: NonNullable<Awaited<ReturnType<typeof getGameSnapshot>>>): PredictPick | null {
  const total = snap.home.score + snap.away.score
  if (total > row.base_goals) {
    const fromEvents = snap.goals[row.base_goals]
    if (fromEvents) return fromEvents
    const homeUp = snap.home.score > row.base_home
    const awayUp = snap.away.score > row.base_away
    if (homeUp !== awayUp) return homeUp ? 'home' : 'away'
    return null
  }
  return snap.state === 'post' ? 'none' : null
}

/** Settles open predictions against the live game; safe to call repeatedly. */
export async function settlePredictions(opts: { userId?: string; limit?: number } = {}) {
  await ensureTv()
  const open = await rows<OpenRow>(sql`SELECT id, user_id, game_id, base_goals, base_home, base_away, pick, coin FROM tv_predictions
    WHERE status = 'open' AND (${opts.userId ?? null}::text IS NULL OR user_id = ${opts.userId ?? null})
    ORDER BY created_at LIMIT ${opts.limit ?? 50}`)
  const snaps = new Map<string, Awaited<ReturnType<typeof getGameSnapshot>>>()
  let settled = 0
  for (const row of open) {
    if (!snaps.has(row.game_id)) snaps.set(row.game_id, await getGameSnapshot(Number(row.game_id)))
    const snap = snaps.get(row.game_id)
    if (!snap) continue
    const result = outcome(row, snap)
    if (!result) continue
    const won = result === row.pick
    const updated = await rows(sql`UPDATE tv_predictions SET status = ${won ? 'won' : 'lost'}, settled_at = now()
      WHERE id = ${row.id} AND status = 'open' RETURNING id`)
    if (!updated.length) continue
    settled++
    if (won && row.coin > 0) {
      const inserted = await rows(sql`INSERT INTO kp_events (user_id, source, points, coins, ref, note)
        VALUES (${row.user_id}, 'kankatv-tahmin', 0, ${row.coin}, ${`p:${row.id}`}, 'KankaTV sıradaki gol tahmini')
        ON CONFLICT DO NOTHING RETURNING id`)
      if (inserted.length) await credit(row.user_id, row.coin)
    }
  }
  return settled
}

async function myPredictions(userId: string) {
  const r = await rows(sql`SELECT * FROM tv_predictions WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT 10`)
  return r.map(toPrediction)
}

// --- Follows ---------------------------------------------------------------

export async function toggleFollow(userId: string, teamId: number, teamName: string) {
  await ensureTv()
  if (!Number.isSafeInteger(teamId) || !teamName.trim()) throw new Error('Geçersiz takım')
  const removed = await rows(sql`DELETE FROM tv_follows WHERE user_id = ${userId} AND team_id = ${teamId} RETURNING team_id`)
  if (removed.length) return false
  const [c] = await rows<{ n: string }>(sql`SELECT count(*) AS n FROM tv_follows WHERE user_id = ${userId}`)
  if (Number(c?.n ?? 0) >= MAX_FOLLOWS) throw new Error(`En fazla ${MAX_FOLLOWS} takım takip edebilirsin`)
  await rows(sql`INSERT INTO tv_follows (user_id, team_id, team_name) VALUES (${userId}, ${teamId}, ${teamName.trim().slice(0, 80)}) ON CONFLICT DO NOTHING`)
  return true
}

// --- Odds bridge -----------------------------------------------------------

async function todaysOdds(): Promise<TvOdd[]> {
  const { listOddsByDay } = await import('@/lib/special-odds')
  const list = await listOddsByDay(trDay()).catch(() => [])
  return list
    .filter((o) => o.status === 'open' && o.match)
    .slice(0, 60)
    .map((o) => ({ match: o.match, siteName: o.siteName, market: o.market, newOdd: o.newOdd, oldOdd: o.oldOdd, link: o.link }))
}

// --- Public payload ------------------------------------------------------

export async function engageState(userId: string | null, opts: { viewer?: string; since?: number }): Promise<TvEngage> {
  const cfg = await getTvConfig()
  if (opts.viewer && cfg.presence) await touchPresence(opts.viewer).catch(() => {})
  if (userId && cfg.predict.enabled) await settlePredictions({ userId, limit: 10 }).catch(() => 0)
  const [watch, viewers, reactions, predictions, follows, odds] = await Promise.all([
    userId ? watchStatus(userId, cfg) : null,
    cfg.presence ? viewerCount() : 0,
    cfg.reactions ? recentReactions(opts.since ?? 0) : [],
    userId && cfg.predict.enabled ? myPredictions(userId) : [],
    userId ? rows<{ team_id: string }>(sql`SELECT team_id FROM tv_follows WHERE user_id = ${userId}`).then((r) => r.map((x) => Number(x.team_id))) : [],
    cfg.oddsBridge ? todaysOdds() : [],
  ])
  return { config: publicConfig(cfg), member: Boolean(userId), watch, viewers, reactions, predictions, follows, odds }
}

// --- Goal alerts (bot + push) ---------------------------------------------

function fill(template: string, vars: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m)
}

async function siteOrigin() {
  const { SITE_URL } = await import('@/lib/seo')
  return SITE_URL.replace(/\/$/, '')
}

export async function sendToTargets(targetIds: number[], text: string) {
  const { botToken, listTargets } = await import('@/lib/telegram-mirror')
  const targets = (await listTargets()).filter((t) => t.active && targetIds.includes(t.id))
  if (!targets.length) throw new Error('Seçili aktif hedef grup yok')
  let sent = 0
  const errors: string[] = []
  for (const t of targets) {
    try {
      const token = await botToken(t.botId)
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chat_id: t.chatId, text: text.slice(0, 4096), link_preview_options: { is_disabled: true } }),
        signal: AbortSignal.timeout(6000),
      })
      if (!res.ok) throw new Error(`${res.status} ${(await res.text().catch(() => '')).slice(0, 120)}`)
      sent++
    } catch (error) {
      errors.push(`${t.title}: ${(error as Error).message}`)
    }
  }
  if (!sent) throw new Error(errors.join(' | '))
  return { sent, errors }
}

async function writeBotStatus(patch: Partial<TvBotStatus>) {
  const prev = (await readSetting<TvBotStatus>(BOT_STATUS_KEY)) ?? { lastRunAt: null, lastError: null, sent: 0, tracked: 0 }
  await writeSetting(BOT_STATUS_KEY, { ...prev, ...patch })
}

export async function tvBotStatus(): Promise<TvBotStatus> {
  await ensureTv()
  return (await readSetting<TvBotStatus>(BOT_STATUS_KEY)) ?? { lastRunAt: null, lastError: null, sent: 0, tracked: 0 }
}

async function announceGoal(cfg: TvConfig, g: LiveGame, side: 'home' | 'away', origin: string) {
  const team = g[side].name
  const vars = {
    takim: team,
    ev: g.home.name,
    dep: g.away.name,
    skor: `${g.home.score} - ${g.away.score}`,
    lig: g.league,
    dakika: g.clock ? `${g.clock}'` : 'Canlı',
    link: `${origin}/kankatv`,
  }
  let sent = 0
  let error: string | null = null
  if (cfg.goalBot.enabled && cfg.goalBot.targetIds.length && (!cfg.goalBot.topOnly || g.top)) {
    try {
      sent += (await sendToTargets(cfg.goalBot.targetIds, fill(cfg.goalBot.template, vars))).sent
    } catch (e) {
      error = (e as Error).message
    }
  }
  if (cfg.goalBot.push) {
    const fans = await rows<{ user_id: string }>(sql`SELECT DISTINCT user_id FROM tv_follows WHERE team_id IN (${g.home.id}, ${g.away.id})`)
    if (fans.length) {
      const { sendToUsers } = await import('@/lib/push')
      await sendToUsers(
        fans.map((f) => f.user_id),
        { title: `GOL! ${team}`, body: `${g.home.name} ${vars.skor} ${g.away.name} · ${vars.dakika}`, url: '/kankatv' },
      ).catch(() => {})
    }
  }
  return { sent, error }
}

/** Compares live scores to the last seen ones and announces new goals. Throttled so viewer traffic can trigger it safely. */
export async function scanGoals(force = false): Promise<{ ran: boolean; goals: number; sent: number; error: string | null }> {
  const cfg = await getTvConfig()
  if (!cfg.goalBot.enabled && !cfg.goalBot.push) return { ran: false, goals: 0, sent: 0, error: null }
  await rows(sql`INSERT INTO kp_settings (key, value) VALUES (${SCAN_KEY}, '{"at":"1970-01-01T00:00:00Z"}'::jsonb) ON CONFLICT DO NOTHING`)
  const claimed = await rows(sql`UPDATE kp_settings SET value = jsonb_build_object('at', now())
    WHERE key = ${SCAN_KEY} AND (${force}::boolean OR (value->>'at')::timestamptz < now() - make_interval(secs => ${SCAN_EVERY_SECONDS}))
    RETURNING key`)
  if (!claimed.length) return { ran: false, goals: 0, sent: 0, error: null }

  const games = await getLiveFootball()
  const origin = await siteOrigin()
  let goals = 0
  let sent = 0
  let error: string | null = null
  for (const g of games) {
    const [prev] = await rows<{ home: number; away: number }>(sql`SELECT home, away FROM tv_goal_state WHERE game_id = ${g.id}`)
    await rows(sql`INSERT INTO tv_goal_state (game_id, home, away) VALUES (${g.id}, ${g.home.score}, ${g.away.score})
      ON CONFLICT (game_id) DO UPDATE SET home = EXCLUDED.home, away = EXCLUDED.away, updated_at = now()`)
    if (!prev) continue
    const sides: ('home' | 'away')[] = [
      ...Array(Math.max(0, g.home.score - prev.home)).fill('home'),
      ...Array(Math.max(0, g.away.score - prev.away)).fill('away'),
    ]
    for (const side of sides.slice(0, 3)) {
      goals++
      const r = await announceGoal(cfg, g, side, origin)
      sent += r.sent
      error = r.error ?? error
    }
  }
  await rows(sql`DELETE FROM tv_goal_state WHERE updated_at < now() - interval '1 day'`)
  await rows(sql`DELETE FROM tv_presence WHERE last_seen < now() - interval '1 hour'`)
  await rows(sql`DELETE FROM tv_reactions WHERE created_at < now() - interval '10 minutes'`)
  await rows(sql`DELETE FROM tv_watch_ticks WHERE minute < now() - interval '40 days'`)
  const prevStatus = await tvBotStatus()
  await writeBotStatus({
    lastRunAt: new Date().toISOString(),
    lastError: error ?? (goals && !sent && cfg.goalBot.enabled ? prevStatus.lastError : null),
    sent: prevStatus.sent + sent,
    tracked: games.length,
  })
  return { ran: true, goals, sent, error }
}

export async function testGoalBot() {
  const cfg = await getTvConfig()
  if (!cfg.goalBot.targetIds.length) throw new Error('Önce en az bir hedef grup seçip kaydet')
  const origin = await siteOrigin()
  const text = fill(cfg.goalBot.template, {
    takim: 'Test FK',
    ev: 'Test FK',
    dep: 'Deneme SK',
    skor: '1 - 0',
    lig: 'Test Ligi',
    dakika: "23'",
    link: `${origin}/kankatv`,
  })
  try {
    const r = await sendToTargets(cfg.goalBot.targetIds, `[TEST] ${text}`)
    await writeBotStatus({ lastError: r.errors.length ? r.errors.join(' | ') : null })
    return r.sent
  } catch (error) {
    await writeBotStatus({ lastError: (error as Error).message })
    throw error
  }
}

export async function tvStats(): Promise<TvStats> {
  await ensureTv()
  const today = trDay()
  const [w] = await rows<{ users: string; minutes: string }>(sql`SELECT count(DISTINCT user_id) AS users, count(*) AS minutes FROM tv_watch_ticks
    WHERE (minute AT TIME ZONE 'Europe/Istanbul')::date = ${today}::date`)
  const [c] = await rows<{ n: string }>(sql`SELECT coalesce(sum(coins), 0) AS n FROM kp_events
    WHERE source IN ('kankatv', 'kankatv-tahmin') AND (created_at AT TIME ZONE 'Europe/Istanbul')::date = ${today}::date`)
  const [p] = await rows<{ today: string; open: string }>(sql`SELECT
    count(*) FILTER (WHERE (created_at AT TIME ZONE 'Europe/Istanbul')::date = ${today}::date) AS today,
    count(*) FILTER (WHERE status = 'open') AS open FROM tv_predictions`)
  const [f] = await rows<{ n: string }>(sql`SELECT count(*) AS n FROM tv_follows`)
  return {
    watchersToday: Number(w?.users ?? 0),
    minutesToday: Number(w?.minutes ?? 0),
    coinsToday: Number(c?.n ?? 0),
    predictionsToday: Number(p?.today ?? 0),
    openPredictions: Number(p?.open ?? 0),
    follows: Number(f?.n ?? 0),
  }
}
