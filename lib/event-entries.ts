import 'server-only'
import { randomInt } from 'node:crypto'
import { rows, sql } from '@/lib/db'
import type { EventItem } from '@/components/alkanka/data'
import {
  EVENT_GAMES,
  EVENT_MODES,
  cleanPayouts,
  eventPhase,
  isScored,
  lastPrizePlace,
  prizeForPlace,
  type EventBoard,
  type EventPhase,
  type EventRank,
} from '@/lib/event-rules'

let ready: Promise<void> | null = null

function ensure() {
  ready ??= (async () => {
    await rows(sql`CREATE TABLE IF NOT EXISTS event_entries (
      user_id text NOT NULL,
      event_id text NOT NULL,
      paid int NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, event_id)
    )`)
    // An event can be run again with new dates; each run is a round with its own entrants.
    await rows(sql`ALTER TABLE event_entries ADD COLUMN IF NOT EXISTS round int NOT NULL DEFAULT 1`)
    await rows(sql`DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_index i JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
        WHERE i.indrelid = 'event_entries'::regclass AND i.indisprimary AND a.attname = 'round'
      ) THEN
        ALTER TABLE event_entries DROP CONSTRAINT IF EXISTS event_entries_pkey;
        ALTER TABLE event_entries ADD PRIMARY KEY (user_id, event_id, round);
      END IF;
    END $$`)
    await rows(sql`CREATE INDEX IF NOT EXISTS event_entries_round_idx ON event_entries (event_id, round)`)
    await rows(sql`CREATE TABLE IF NOT EXISTS event_rounds (
      event_id text NOT NULL,
      round int NOT NULL,
      ends_at timestamptz NOT NULL,
      rank text NOT NULL,
      entrants int NOT NULL DEFAULT 0,
      settled_at timestamptz NOT NULL DEFAULT now(),
      settled_by text NOT NULL DEFAULT 'otomatik',
      done boolean NOT NULL DEFAULT false,
      PRIMARY KEY (event_id, round)
    )`)
    await rows(sql`CREATE TABLE IF NOT EXISTS event_results (
      event_id text NOT NULL,
      round int NOT NULL,
      user_id text NOT NULL,
      user_name text NOT NULL,
      place int NOT NULL,
      score int NOT NULL DEFAULT 0,
      prize int NOT NULL DEFAULT 0,
      paid_at timestamptz,
      PRIMARY KEY (event_id, round, user_id)
    )`)
  })().catch((e) => {
    ready = null
    throw e
  })
  return ready
}

type Dated = Pick<EventItem, 'id' | 'startsAt' | 'endsAt'>
type LastRound = { round: number; endsAt: number; done: boolean }

const rankOf = (e: Pick<EventItem, 'rank'>): EventRank => e.rank ?? 'none'

async function latestRounds(): Promise<Map<string, LastRound>> {
  const r = await rows<{ event_id: string; round: number; ends_at: string; done: boolean }>(
    sql`SELECT DISTINCT ON (event_id) event_id, round, ends_at, done FROM event_rounds ORDER BY event_id, round DESC`,
  )
  return new Map(r.map((x) => [x.event_id, { round: Number(x.round), endsAt: new Date(x.ends_at).getTime(), done: Boolean(x.done) }]))
}

/**
 * The run members are joining now. A settled run stays current until staff gives the event a new
 * end date; from then on entries go to the next round and the old results are history.
 */
function roundOf(event: Dated, last: LastRound | undefined) {
  if (last && last.endsAt === Date.parse(event.endsAt ?? '')) return { round: last.round, settled: true, done: last.done }
  return { round: (last?.round ?? 0) + 1, settled: false, done: false }
}

const SHARED_TTL_MS = 30_000
const BOARD_TTL_MS = 60_000
let shared: { at: number; rounds: Map<string, LastRound>; counts: Map<string, number> } | null = null
const boards = new Map<string, { at: number; rows: Standing[] }>()

function forget() {
  shared = null
  boards.clear()
}

async function sharedState() {
  if (shared && Date.now() - shared.at < SHARED_TTL_MS) return shared
  await ensure()
  const [rounds, counts] = await Promise.all([
    latestRounds(),
    rows<{ event_id: string; round: number; n: string }>(sql`SELECT event_id, round, count(*) AS n FROM event_entries GROUP BY event_id, round`),
  ])
  shared = { at: Date.now(), rounds, counts: new Map(counts.map((c) => [`${c.event_id}:${c.round}`, Number(c.n)])) }
  return shared
}

/** What the event cards need: who is in, how many joined, which events are already paid out. */
export async function eventOverview(userId: string | null): Promise<{ joined: string[]; counts: Record<string, number>; settled: string[] }> {
  const { getCatalog } = await import('@/lib/catalog')
  const [{ events }, state, mine] = await Promise.all([
    getCatalog(),
    sharedState(),
    userId ? ensure().then(() => rows<{ event_id: string; round: number }>(sql`SELECT event_id, round FROM event_entries WHERE user_id = ${userId}`)) : [],
  ])
  const counts: Record<string, number> = {}
  const settled: string[] = []
  const joined: string[] = []
  for (const e of events) {
    const at = roundOf(e, state.rounds.get(e.id))
    counts[e.id] = state.counts.get(`${e.id}:${at.round}`) ?? 0
    if (at.settled) settled.push(e.id)
    if (mine.some((m) => m.event_id === e.id && Number(m.round) === at.round)) joined.push(e.id)
  }
  return { joined, counts, settled }
}

export async function joinEvent(userId: string, userName: string, eventId: string) {
  const { withUserLock } = await import('@/lib/user-lock')
  return withUserLock(`event:${userId}`, async () => {
    await ensure()
    const { getCatalog } = await import('@/lib/catalog')
    const event = (await getCatalog()).events.find((e) => e.id === eventId)
    if (!event) throw new Error('Etkinlik bulunamadı.')
    const at = roundOf(event, (await latestRounds()).get(eventId))
    const phase = eventPhase(event, Date.now())
    if (at.settled) throw new Error('Bu etkinlik sonuçlandı.')
    if (phase === 'ended') throw new Error('Bu etkinlik sona erdi.')
    if (phase === 'upcoming') throw new Error('Bu etkinlik henüz başlamadı.')
    const [existing] = await rows<{ event_id: string }>(
      sql`SELECT event_id FROM event_entries WHERE user_id = ${userId} AND event_id = ${eventId} AND round = ${at.round}`,
    )
    if (existing) throw new Error('Bu etkinliğe zaten katıldın.')

    const { debit, credit, recordHistory } = await import('@/lib/member')
    const price = Math.max(0, Math.floor(Number(event.entry) || 0))
    if (price > 0 && !(await debit(userId, price, 'Etkinlik katılımı'))) throw new Error('Kanka Coin bakiyen yetersiz.')

    const inserted = await rows<{ event_id: string }>(sql`INSERT INTO event_entries (user_id, event_id, round, paid)
      VALUES (${userId}, ${eventId}, ${at.round}, ${price}) ON CONFLICT DO NOTHING RETURNING event_id`)
    if (!inserted.length) {
      if (price > 0) await credit(userId, price, 'Etkinlik katılım iadesi')
      throw new Error('Bu etkinliğe zaten katıldın.')
    }
    forget()
    if (price > 0) {
      await recordHistory({ userId, userName, game: 'etkinlik', mode: 'harcama', opponent: event.title, stake: price, result: 'loss', delta: -price }).catch(() => {})
    }
  })
}

type Standing = { userId: string; name: string; score: number; place: number; joinedAt: string }

const NAME = sql`coalesce(nullif(trim(u.name), ''), 'Üye')`
const inList = (values: string[]) => sql.join(values.map((v) => sql`${v}`), sql`, `)

/** Entrants in finishing order. Only plays made after joining and inside the event dates count; a tie goes to whoever got there first. */
async function scoredStandings(event: EventItem, round: number): Promise<Standing[]> {
  const rank = rankOf(event)
  const points = rank === 'coins' ? sql`coalesce(sum(GREATEST(g.delta, 0)), 0)` : sql`count(g.id)`
  const onlyWins = rank === 'wins' ? sql`AND g.result = 'win'` : sql``
  const r = await rows<{ user_id: string; name: string; pts: number; joined: string }>(sql`
    SELECT e.user_id, ${NAME} AS name, ${points}::int AS pts, e.created_at AS joined
    FROM event_entries e
    LEFT JOIN "user" u ON u.id = e.user_id
    LEFT JOIN game_history g ON g.user_id = e.user_id
      AND g.created_at >= GREATEST(e.created_at, ${event.startsAt ?? null}::timestamptz)
      AND g.created_at < coalesce(${event.endsAt ?? null}::timestamptz, 'infinity')
      AND g.game IN (${inList(event.game ? [event.game] : EVENT_GAMES)})
      AND g.mode IN (${inList(EVENT_MODES)})
      AND g.result <> 'refund' ${onlyWins}
    WHERE e.event_id = ${event.id} AND e.round = ${round}
    GROUP BY e.user_id, u.name, e.created_at
    ORDER BY pts DESC, max(g.created_at) ASC NULLS LAST, e.created_at ASC, e.user_id ASC`)
  return r.map((x, i) => ({ userId: x.user_id, name: x.name, score: Number(x.pts), place: i + 1, joinedAt: new Date(x.joined).toISOString() }))
}

async function entrants(eventId: string, round: number): Promise<Standing[]> {
  const r = await rows<{ user_id: string; name: string; joined: string }>(sql`
    SELECT e.user_id, ${NAME} AS name, e.created_at AS joined FROM event_entries e LEFT JOIN "user" u ON u.id = e.user_id
    WHERE e.event_id = ${eventId} AND e.round = ${round} ORDER BY e.created_at ASC, e.user_id ASC`)
  return r.map((x) => ({ userId: x.user_id, name: x.name, score: 0, place: 0, joinedAt: new Date(x.joined).toISOString() }))
}

async function standings(event: EventItem, round: number, fresh = false): Promise<Standing[]> {
  const key = `${event.id}:${round}`
  const hit = boards.get(key)
  if (!fresh && hit && Date.now() - hit.at < BOARD_TTL_MS) return hit.rows
  const list = isScored(rankOf(event)) ? await scoredStandings(event, round) : await entrants(event.id, round)
  boards.set(key, { at: Date.now(), rows: list })
  return list
}

type ResultRow = { userId: string; name: string; place: number; score: number; prize: number; paidAt: string | null; joinedAt: string | null }

async function results(eventId: string, round: number): Promise<ResultRow[]> {
  const r = await rows<{ user_id: string; user_name: string; place: number; score: number; prize: number; paid_at: string | null; joined: string | null }>(sql`
    SELECT r.user_id, r.user_name, r.place, r.score, r.prize, r.paid_at, e.created_at AS joined
    FROM event_results r LEFT JOIN event_entries e ON e.user_id = r.user_id AND e.event_id = r.event_id AND e.round = r.round
    WHERE r.event_id = ${eventId} AND r.round = ${round} ORDER BY r.place ASC`)
  return r.map((x) => ({
    userId: x.user_id,
    name: x.user_name,
    place: Number(x.place),
    score: Number(x.score),
    prize: Number(x.prize),
    paidAt: x.paid_at ? new Date(x.paid_at).toISOString() : null,
    joinedAt: x.joined ? new Date(x.joined).toISOString() : null,
  }))
}

/** A scored event pays a place only to someone who actually scored; a draw pays every drawn place. */
const prizeFor = (event: EventItem, place: number, score: number) =>
  isScored(rankOf(event)) && score <= 0 ? 0 : prizeForPlace(cleanPayouts(event.payouts), place)

const BOARD_ROWS = 20

/** The public leaderboard: live standings while the event runs, the paid results once it is settled. */
export async function eventBoard(eventId: string, userId: string | null): Promise<EventBoard | null> {
  const { getCatalog } = await import('@/lib/catalog')
  const event = (await getCatalog()).events.find((e) => e.id === eventId)
  if (!event) return null
  const state = await sharedState()
  const at = roundOf(event, state.rounds.get(event.id))
  const rank = rankOf(event)
  const count = state.counts.get(`${event.id}:${at.round}`) ?? 0
  if (at.settled) {
    const list = (await results(event.id, at.round)).filter((r) => isScored(rank) || r.prize > 0)
    const mine = list.find((r) => r.userId === userId)
    return {
      rank,
      settled: true,
      entrants: count,
      top: list.slice(0, BOARD_ROWS).map((r) => ({ place: r.place, name: r.name, score: r.score, prize: r.prize, me: r.userId === userId })),
      me: mine ? { place: mine.place, score: mine.score, prize: mine.prize } : null,
    }
  }
  if (!isScored(rank)) return { rank, settled: false, entrants: count, top: [], me: null }
  const list = await standings(event, at.round)
  const mine = list.find((r) => r.userId === userId)
  return {
    rank,
    settled: false,
    entrants: list.length,
    top: list.slice(0, BOARD_ROWS).map((r) => ({ place: r.place, name: r.name, score: r.score, prize: prizeFor(event, r.place, r.score), me: r.userId === userId })),
    me: mine ? { place: mine.place, score: mine.score, prize: prizeFor(event, mine.place, mine.score) } : null,
  }
}

export type EventAdminRow = { userId: string; name: string; place: number | null; score: number; prize: number; paid: boolean; joinedAt: string | null }
export type EventAdminBoard = {
  rank: EventRank
  phase: EventPhase
  round: number
  settled: boolean
  /** Prizes of a settled round that are still waiting to be credited. */
  unpaid: number
  entrants: number
  rows: EventAdminRow[]
}

const ADMIN_ROWS = 500

/** Everything staff sees for one event: who joined, where they stand and what was paid. Never cached. */
export async function eventAdminBoard(eventId: string): Promise<EventAdminBoard | null> {
  await ensure()
  const { getCatalog } = await import('@/lib/catalog')
  const event = (await getCatalog({ includeHidden: true })).events.find((e) => e.id === eventId)
  if (!event) return null
  const at = roundOf(event, (await latestRounds()).get(event.id))
  const rank = rankOf(event)
  const phase = eventPhase(event, Date.now())
  if (at.settled) {
    const [list, total] = await Promise.all([
      results(event.id, at.round),
      rows<{ n: string }>(sql`SELECT entrants AS n FROM event_rounds WHERE event_id = ${event.id} AND round = ${at.round}`),
    ])
    return {
      rank,
      phase,
      round: at.round,
      settled: true,
      unpaid: list.filter((r) => r.prize > 0 && !r.paidAt).length,
      entrants: Number(total[0]?.n ?? list.length),
      rows: list.slice(0, ADMIN_ROWS).map((r) => ({ userId: r.userId, name: r.name, place: r.place, score: r.score, prize: r.prize, paid: Boolean(r.paidAt), joinedAt: r.joinedAt })),
    }
  }
  const list = await standings(event, at.round, true)
  return {
    rank,
    phase,
    round: at.round,
    settled: false,
    unpaid: 0,
    entrants: list.length,
    rows: list.slice(0, ADMIN_ROWS).map((r) => ({
      userId: r.userId,
      name: r.name,
      place: isScored(rank) ? r.place : null,
      score: r.score,
      prize: isScored(rank) ? prizeFor(event, r.place, r.score) : 0,
      paid: false,
      joinedAt: r.joinedAt,
    })),
  }
}

function shuffled<T>(list: T[]) {
  const out = [...list]
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

const PAY_BATCH = 150

/**
 * Credits the prizes of a settled round. Each prize is claimed by stamping its row first, so a
 * second run (a retry, another instance, the next tick) can never pay the same place twice.
 */
async function payRound(event: Pick<EventItem, 'id' | 'title'>, round: number) {
  const { credit, recordHistory } = await import('@/lib/member')
  const { sendMessage } = await import('@/lib/inbox')
  const due = await rows<{ user_id: string; user_name: string; place: number; prize: number }>(sql`
    SELECT user_id, user_name, place, prize FROM event_results
    WHERE event_id = ${event.id} AND round = ${round} AND prize > 0 AND paid_at IS NULL ORDER BY place ASC LIMIT ${PAY_BATCH}`)
  let paid = 0
  for (const w of due) {
    const claim = await rows(sql`UPDATE event_results SET paid_at = now()
      WHERE event_id = ${event.id} AND round = ${round} AND user_id = ${w.user_id} AND paid_at IS NULL RETURNING user_id`)
    if (!claim.length) continue
    const prize = Number(w.prize)
    try {
      await credit(w.user_id, prize, 'Etkinlik ödülü')
    } catch (error) {
      await rows(sql`UPDATE event_results SET paid_at = NULL WHERE event_id = ${event.id} AND round = ${round} AND user_id = ${w.user_id}`)
      throw error
    }
    paid += 1
    await recordHistory({ userId: w.user_id, userName: w.user_name, game: 'etkinlik', mode: 'odul', opponent: `${w.place}. sıra: ${event.title}`, stake: 0, result: 'win', delta: prize }).catch((error) =>
      console.error('[events] ödül geçmişi yazılamadı', (error as Error).message),
    )
    await sendMessage({
      userId: w.user_id,
      targetLabel: 'Etkinlik ödülü',
      title: 'Etkinlik ödülün hesabında',
      body: `${event.title} etkinliğini ${w.place}. sırada bitirdin. ${prize.toLocaleString('tr-TR')} KC hesabına eklendi.`,
      url: '/kampanyalar',
      sentBy: 'Sistem',
    }).catch((error) => console.error('[events] ödül mesajı gönderilemedi', (error as Error).message))
  }
  const left = await rows<{ n: string }>(sql`SELECT count(*) AS n FROM event_results WHERE event_id = ${event.id} AND round = ${round} AND prize > 0 AND paid_at IS NULL`)
  const unpaid = Number(left[0]?.n ?? 0)
  if (!unpaid) await rows(sql`UPDATE event_rounds SET done = true WHERE event_id = ${event.id} AND round = ${round} AND NOT done`)
  return { paid, unpaid }
}

export type SettleResult = { ok: true; already: boolean; entrants: number; winners: number; paid: number; unpaid: number } | { ok: false; error: string }

/**
 * Closes an ended event: freezes the final order, then pays the prize places. Freezing and claiming
 * the round are one statement, so two callers cannot both draw or both rank.
 */
export async function settleEvent(eventId: string, by = 'otomatik'): Promise<SettleResult> {
  await ensure()
  const { getCatalog } = await import('@/lib/catalog')
  const event = (await getCatalog({ includeHidden: true })).events.find((e) => e.id === eventId)
  if (!event) return { ok: false, error: 'Etkinlik bulunamadı. Listeyi kaydettiysen sayfayı yenile.' }
  const rank = rankOf(event)
  if (rank === 'none') return { ok: false, error: 'Bu etkinlikte otomatik sıralama seçilmemiş; ödüller elle verilir.' }
  if (eventPhase(event, Date.now()) !== 'ended') return { ok: false, error: 'Etkinlik henüz bitmedi. Ödüller bitiş tarihinde dağıtılır.' }
  const payouts = cleanPayouts(event.payouts)
  if (!payouts.length) return { ok: false, error: 'Bu etkinlikte otomatik ödül satırı yok.' }

  const at = roundOf(event, (await latestRounds()).get(event.id))
  if (at.settled) {
    const { paid, unpaid } = at.done ? { paid: 0, unpaid: 0 } : await payRound(event, at.round)
    const [list, total] = await Promise.all([
      results(event.id, at.round),
      rows<{ entrants: number }>(sql`SELECT entrants FROM event_rounds WHERE event_id = ${event.id} AND round = ${at.round}`),
    ])
    return { ok: true, already: true, entrants: Number(total[0]?.entrants ?? list.length), winners: list.filter((r) => r.prize > 0).length, paid, unpaid }
  }

  const order = rank === 'draw' ? shuffled(await entrants(event.id, at.round)) : await standings(event, at.round, true)
  const final = order
    .map((s, i) => ({ user_id: s.userId, user_name: s.name, place: i + 1, score: s.score, prize: prizeFor(event, i + 1, s.score) }))
    // A draw only has winners; a scored event keeps the whole table as its record.
    .filter((r) => rank !== 'draw' || r.prize > 0)
    .slice(0, Math.max(ADMIN_ROWS, lastPrizePlace(payouts)))
  const [claim] = await rows<{ claimed: string }>(sql`
    WITH claim AS (
      INSERT INTO event_rounds (event_id, round, ends_at, rank, entrants, settled_by)
      VALUES (${event.id}, ${at.round}, ${event.endsAt}::timestamptz, ${rank}, ${order.length}, ${by})
      ON CONFLICT DO NOTHING RETURNING round
    ), written AS (
      INSERT INTO event_results (event_id, round, user_id, user_name, place, score, prize)
      SELECT ${event.id}, ${at.round}, x.user_id, x.user_name, x.place, x.score, x.prize
      FROM jsonb_to_recordset(${JSON.stringify(final)}::jsonb) AS x(user_id text, user_name text, place int, score int, prize int)
      WHERE EXISTS (SELECT 1 FROM claim)
      RETURNING 1
    )
    SELECT (SELECT count(*) FROM claim) AS claimed, (SELECT count(*) FROM written) AS written`)
  forget()
  if (!Number(claim?.claimed)) return { ok: false, error: 'Bu etkinlik şu an başka bir işlemde sonuçlandırılıyor. Birazdan tekrar bak.' }
  const { paid, unpaid } = await payRound(event, at.round)
  return { ok: true, already: false, entrants: order.length, winners: final.filter((r) => r.prize > 0).length, paid, unpaid }
}

const finished = new Set<string>()

/**
 * Settles every event whose end date has passed. Rides the traffic-driven tick and reads one
 * content row; an instance remembers what it has already seen finished and asks nothing more.
 * Hidden events are settled too, so hiding one never strands the entrants' fees.
 */
export async function settleDueEvents() {
  const [{ getContent }, { CATALOG_KEYS, cleanEvents }] = await Promise.all([import('@/lib/content'), import('@/lib/catalog-shared')])
  const saved = await getContent<unknown>(CATALOG_KEYS.events)
  if (!Array.isArray(saved)) return
  const now = Date.now()
  const key = (e: EventItem) => `${e.id}:${e.endsAt}`
  const due = cleanEvents(saved).filter(
    (e) => rankOf(e) !== 'none' && eventPhase(e, now) === 'ended' && cleanPayouts(e.payouts).length > 0 && !finished.has(key(e)),
  )
  if (!due.length) return
  await ensure()
  const last = await latestRounds()
  for (const e of due) {
    const at = roundOf(e, last.get(e.id))
    if (at.settled && at.done) {
      finished.add(key(e))
      continue
    }
    const r = await settleEvent(e.id).catch((error) => ({ ok: false as const, error: (error as Error).message }))
    if (!r.ok) console.error('[events] sonuçlandırılamadı', e.id, r.error)
    else if (!r.unpaid) finished.add(key(e))
  }
}
