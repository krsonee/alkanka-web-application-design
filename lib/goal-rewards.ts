import 'server-only'
import { rows, sql } from '@/lib/db'
import { credit } from '@/lib/member'
import {
  checkGoalEvent,
  checkGoalScore,
  goalAmount,
  isGoalApproval,
  isGoalSide,
  type GoalApproval,
  type GoalCategory,
  type GoalEvent,
  type GoalEventView,
  type GoalMatch,
  type GoalPickRow,
  type GoalSide,
  type GoalStatus,
} from '@/lib/goal-rewards-shared'

let ready: Promise<unknown> | null = null

/** Its own three tables: nothing here reads or writes the prediction league's. */
export function ensureGoal() {
  ready ??= (async () => {
    await rows(sql`CREATE TABLE IF NOT EXISTS goal_events (
      id serial PRIMARY KEY, title text NOT NULL, category text NOT NULL, per_goal int NOT NULL, unit text NOT NULL DEFAULT 'KC',
      site_id int, site_name text, via_link boolean NOT NULL DEFAULT false, min_bet text NOT NULL DEFAULT '', terms text NOT NULL DEFAULT '',
      active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now())`)
    await rows(sql`CREATE TABLE IF NOT EXISTS goal_matches (
      id serial PRIMARY KEY, event_id int NOT NULL, league text NOT NULL DEFAULT '', home text NOT NULL, away text NOT NULL,
      home_logo text, away_logo text, ext_id bigint, kickoff timestamptz NOT NULL, status text NOT NULL DEFAULT 'open',
      home_goals int, away_goals int, per_goal int NOT NULL, settled_at timestamptz, created_at timestamptz NOT NULL DEFAULT now())`)
    await rows(sql`CREATE UNIQUE INDEX IF NOT EXISTS goal_matches_ext ON goal_matches (event_id, ext_id) WHERE ext_id IS NOT NULL`)
    await rows(sql`CREATE INDEX IF NOT EXISTS goal_matches_event ON goal_matches (event_id, kickoff)`)
    await rows(sql`CREATE TABLE IF NOT EXISTS goal_picks (
      match_id int NOT NULL, user_id text NOT NULL, user_name text NOT NULL, side text NOT NULL, site_username text,
      approval text NOT NULL DEFAULT 'approved', goals int, reward int, paid boolean NOT NULL DEFAULT false, paid_at timestamptz,
      pay_error text, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (match_id, user_id))`)
  })().catch((error) => {
    ready = null
    throw error
  })
  return ready
}

const iso = (v: unknown) => new Date(String(v)).toISOString()
const int = (v: unknown) => (v === null || v === undefined ? null : Number(v))
const id = (v: unknown, what: string) => {
  const n = Number(v)
  if (!Number.isSafeInteger(n) || n <= 0) throw new Error(`${what} bulunamadı.`)
  return n
}

function eventOf(x: Record<string, unknown>): GoalEvent {
  return {
    id: Number(x.id),
    title: String(x.title),
    category: x.category === 'sponsor' ? 'sponsor' : 'alkanka',
    perGoal: Number(x.per_goal),
    unit: String(x.unit),
    siteId: int(x.site_id),
    siteName: x.site_name ? String(x.site_name) : null,
    viaLink: Boolean(x.via_link),
    minBet: String(x.min_bet ?? ''),
    terms: String(x.terms ?? ''),
    active: Boolean(x.active),
    createdAt: iso(x.created_at),
  }
}

function matchOf(x: Record<string, unknown>): GoalMatch {
  const status: GoalStatus = x.status === 'settled' ? 'settled' : x.status === 'void' ? 'void' : 'open'
  return {
    id: Number(x.id),
    eventId: Number(x.event_id),
    league: String(x.league ?? ''),
    home: String(x.home),
    away: String(x.away),
    homeLogo: x.home_logo ? String(x.home_logo) : null,
    awayLogo: x.away_logo ? String(x.away_logo) : null,
    extId: int(x.ext_id),
    kickoff: iso(x.kickoff),
    status,
    homeGoals: int(x.home_goals),
    awayGoals: int(x.away_goals),
    perGoal: Number(x.per_goal),
    homePicks: Number(x.home_picks ?? 0),
    awayPicks: Number(x.away_picks ?? 0),
    myPick: x.my_side
      ? {
          side: x.my_side === 'away' ? 'away' : 'home',
          siteUsername: x.my_site_username ? String(x.my_site_username) : null,
          approval: isGoalApproval(x.my_approval) ? x.my_approval : 'pending',
          goals: int(x.my_goals),
          reward: int(x.my_reward),
          paid: Boolean(x.my_paid),
        }
      : null,
  }
}

/**
 * Events with their matches. The site sees running events and the last week's matches;
 * the panel (`admin`) sees everything, closed events included.
 */
export async function goalBoard(userId: string | null, opts: { admin?: boolean; category?: GoalCategory } = {}): Promise<GoalEventView[]> {
  await ensureGoal()
  const admin = opts.admin ?? false
  const category = opts.category ?? ''
  const [events, matches] = await Promise.all([
    rows(sql`SELECT * FROM goal_events e WHERE (${admin}::boolean OR e.active) AND (${category} = '' OR e.category = ${category}) ORDER BY e.active DESC, e.id DESC LIMIT 60`),
    rows(sql`SELECT m.*,
        (SELECT count(*) FROM goal_picks p WHERE p.match_id = m.id AND p.side = 'home') AS home_picks,
        (SELECT count(*) FROM goal_picks p WHERE p.match_id = m.id AND p.side = 'away') AS away_picks,
        mp.side AS my_side, mp.site_username AS my_site_username, mp.approval AS my_approval, mp.goals AS my_goals, mp.reward AS my_reward,
        (mp.paid AND mp.pay_error IS NULL) AS my_paid
      FROM goal_matches m JOIN goal_events e ON e.id = m.event_id
      LEFT JOIN goal_picks mp ON mp.match_id = m.id AND mp.user_id = ${userId ?? ''}
      WHERE (${admin}::boolean OR (e.active AND m.kickoff > now() - interval '7 days')) AND (${category} = '' OR e.category = ${category})
      ORDER BY m.kickoff ASC, m.id ASC LIMIT 400`),
  ])
  const byEvent = new Map<number, GoalMatch[]>()
  for (const m of matches.map(matchOf)) byEvent.set(m.eventId, [...(byEvent.get(m.eventId) ?? []), m])
  const list = events.map((e) => ({ ...eventOf(e), matches: byEvent.get(Number(e.id)) ?? [] }))
  // An event with nothing to show is noise on the site; the panel still needs it to add matches.
  return admin ? list : list.filter((e) => e.matches.length > 0)
}

// --- Managing events -----------------------------------------------------

export async function saveGoalEvent(input: unknown): Promise<GoalEvent> {
  await ensureGoal()
  const checked = checkGoalEvent(input)
  if (!checked.ok) throw new Error(checked.error)
  const e = checked.value
  let siteName: string | null = null
  if (e.category === 'sponsor') {
    const { siteOptions } = await import('@/lib/sites')
    const site = (await siteOptions()).find((s) => String(s.id) === String(e.siteId))
    if (!site) throw new Error('Seçilen sponsor bulunamadı.')
    siteName = site.name
  }
  if (e.id) {
    const [before] = await rows(sql`SELECT category FROM goal_events WHERE id = ${e.id}`)
    if (!before) throw new Error('Etkinlik bulunamadı.')
    if (before.category !== e.category) throw new Error('Etkinliğin türü sonradan değişmez. Yeni bir etkinlik aç.')
    const [saved] = await rows(sql`UPDATE goal_events SET title = ${e.title}, per_goal = ${e.perGoal}, unit = ${e.unit}, site_id = ${e.siteId}, site_name = ${siteName},
        via_link = ${e.viaLink}, min_bet = ${e.minBet}, terms = ${e.terms}, active = ${e.active} WHERE id = ${e.id} RETURNING *`)
    // A match nobody has picked yet follows the new figure; a match with picks keeps what members were promised.
    await rows(sql`UPDATE goal_matches m SET per_goal = ${e.perGoal}
      WHERE m.event_id = ${e.id} AND m.status = 'open' AND NOT EXISTS (SELECT 1 FROM goal_picks p WHERE p.match_id = m.id)`)
    return eventOf(saved)
  }
  const [saved] = await rows(sql`INSERT INTO goal_events (title, category, per_goal, unit, site_id, site_name, via_link, min_bet, terms, active)
    VALUES (${e.title}, ${e.category}, ${e.perGoal}, ${e.unit}, ${e.siteId}, ${siteName}, ${e.viaLink}, ${e.minBet}, ${e.terms}, ${e.active}) RETURNING *`)
  return eventOf(saved)
}

/** Only an event nobody joined can be removed; one with picks is closed instead, so its record stays. */
export async function deleteGoalEvent(eventId: number) {
  await ensureGoal()
  const key = id(eventId, 'Etkinlik')
  const gone = await rows(sql`DELETE FROM goal_events e WHERE e.id = ${key}
    AND NOT EXISTS (SELECT 1 FROM goal_picks p JOIN goal_matches m ON m.id = p.match_id WHERE m.event_id = e.id) RETURNING e.id`)
  if (!gone.length) throw new Error('Bu etkinliğe katılan üye var, silinemez. Kapatabilirsin: siteden kalkar, kayıtları durur.')
  await rows(sql`DELETE FROM goal_matches WHERE event_id = ${key}`)
}

// --- Managing matches ----------------------------------------------------

const safeLogo = (url: unknown) => (typeof url === 'string' && /^https:\/\/imagecache\.365scores\.com\//.test(url) ? url : null)

async function eventFor(eventId: number) {
  const [e] = await rows(sql`SELECT id, per_goal FROM goal_events WHERE id = ${id(eventId, 'Etkinlik')}`)
  if (!e) throw new Error('Etkinlik bulunamadı.')
  return { id: Number(e.id), perGoal: Number(e.per_goal) }
}

export async function addGoalMatch(eventId: number, input: { league?: string; home: string; away: string; kickoff: string }) {
  await ensureGoal()
  const e = await eventFor(eventId)
  const home = String(input.home ?? '').trim().slice(0, 80)
  const away = String(input.away ?? '').trim().slice(0, 80)
  const when = new Date(input.kickoff)
  if (!home || !away) throw new Error('Takım adlarını gir.')
  if (home.toLocaleLowerCase('tr') === away.toLocaleLowerCase('tr')) throw new Error('İki takım aynı olamaz.')
  if (Number.isNaN(when.getTime())) throw new Error('Geçerli bir tarih gir.')
  if (when.getTime() < Date.now()) throw new Error('Maç saati geçmişte olamaz. Tarihi kontrol et.')
  await rows(sql`INSERT INTO goal_matches (event_id, league, home, away, kickoff, per_goal)
    VALUES (${e.id}, ${String(input.league ?? '').trim().slice(0, 80)}, ${home}, ${away}, ${when.toISOString()}, ${e.perGoal})`)
}

export type GoalFixture = { extId: number; league: string; home: string; away: string; homeLogo: string; awayLogo: string; kickoff: string }

/** Adds fixtures picked from the calendar; one already in this event is skipped. */
export async function importGoalFixtures(eventId: number, list: GoalFixture[]) {
  await ensureGoal()
  const e = await eventFor(eventId)
  let added = 0
  for (const f of (Array.isArray(list) ? list : []).slice(0, 60)) {
    const when = new Date(f.kickoff)
    if (!Number.isSafeInteger(f.extId) || Number.isNaN(when.getTime()) || when.getTime() <= Date.now()) continue
    const r = await rows(sql`INSERT INTO goal_matches (event_id, league, home, away, home_logo, away_logo, ext_id, kickoff, per_goal)
      VALUES (${e.id}, ${String(f.league ?? '').slice(0, 80)}, ${String(f.home ?? '').slice(0, 80)}, ${String(f.away ?? '').slice(0, 80)},
        ${safeLogo(f.homeLogo)}, ${safeLogo(f.awayLogo)}, ${f.extId}, ${when.toISOString()}, ${e.perGoal})
      ON CONFLICT (event_id, ext_id) WHERE ext_id IS NOT NULL DO NOTHING RETURNING id`)
    added += r.length
  }
  return added
}

/** A match nobody picked simply goes; one with picks has to be cancelled so members see why it paid nothing. */
export async function deleteGoalMatch(matchId: number) {
  await ensureGoal()
  const gone = await rows(sql`DELETE FROM goal_matches m WHERE m.id = ${id(matchId, 'Maç')} AND m.status <> 'settled'
    AND NOT EXISTS (SELECT 1 FROM goal_picks p WHERE p.match_id = m.id) RETURNING m.id`)
  if (!gone.length) throw new Error('Bu maça seçim yapılmış ya da maç sonuçlanmış; silinemez. Oynanmadıysa iptal et.')
}

/** A cancelled match pays nothing and can no longer be scored. */
export async function voidGoalMatch(matchId: number) {
  await ensureGoal()
  const done = await rows(sql`UPDATE goal_matches SET status = 'void', settled_at = now() WHERE id = ${id(matchId, 'Maç')} AND status = 'open' RETURNING id`)
  if (!done.length) throw new Error('Maç zaten sonuçlanmış ya da iptal edilmiş.')
}

// --- Joining -------------------------------------------------------------

/** Whether a match belongs to a sponsor event; null when there is no such match. */
export async function goalMatchCategory(matchId: number): Promise<GoalCategory | null> {
  await ensureGoal()
  const key = Number(matchId)
  if (!Number.isSafeInteger(key) || key <= 0) return null
  const [m] = await rows(sql`SELECT e.category FROM goal_matches m JOIN goal_events e ON e.id = m.event_id WHERE m.id = ${key}`)
  return m ? (m.category === 'sponsor' ? 'sponsor' : 'alkanka') : null
}

export async function pickGoalSide(user: { id: string; name: string }, matchId: number, side: unknown, siteUsername?: unknown) {
  await ensureGoal()
  const key = id(matchId, 'Maç')
  if (!isGoalSide(side)) throw new Error('Bir takım seç.')
  const [m] = await rows(sql`SELECT e.category, e.site_name FROM goal_matches m JOIN goal_events e ON e.id = m.event_id
    WHERE m.id = ${key} AND m.status = 'open' AND m.kickoff > now() AND e.active`)
  if (!m) throw new Error('Bu maç için seçimler kapandı.')
  const sponsor = m.category === 'sponsor'
  const username = sponsor ? String(siteUsername ?? '').trim().slice(0, 60) : null
  if (sponsor && (username as string).length < 2) throw new Error(`${m.site_name ?? 'Sponsor'} sitesindeki kullanıcı adını yaz; ödül o hesaba tanımlanır.`)
  const { roleBlocks } = await import('@/lib/kanka-puan')
  if (await roleBlocks(user.id, 'events').catch(() => false)) throw new Error('Bu hesap etkinliklere katılamaz.')
  // The open-and-not-started check is repeated inside the insert: a pick must never land after kickoff.
  const saved = await rows(sql`INSERT INTO goal_picks (match_id, user_id, user_name, side, site_username, approval)
    SELECT m.id, ${user.id}, ${user.name.slice(0, 40)}, ${side}, ${username}, ${sponsor ? 'pending' : 'approved'}
    FROM goal_matches m JOIN goal_events e ON e.id = m.event_id
    WHERE m.id = ${key} AND m.status = 'open' AND m.kickoff > now() AND e.active
    ON CONFLICT (match_id, user_id) DO NOTHING RETURNING match_id`)
  if (!saved.length) throw new Error('Bu maç için zaten bir takım seçtin.')
}

// --- Scoring and paying --------------------------------------------------

/** `failed`: KC payments of this match that could not be written; they wait in the participant list. */
export type GoalSettleSummary = { picks: number; winners: number; total: number; unit: string; sponsor: boolean; failed: number }

/**
 * Records the score once and works out every pick's reward. The status flips in a single statement,
 * so a second attempt (another staff member, the result feed) finds nothing left to score.
 */
export async function settleGoalMatch(matchId: number, homeGoals: unknown, awayGoals: unknown): Promise<GoalSettleSummary> {
  await ensureGoal()
  const key = id(matchId, 'Maç')
  const score = checkGoalScore(homeGoals, awayGoals)
  if (!score.ok) throw new Error(score.error)
  const [m] = await rows(sql`SELECT m.status, m.kickoff <= now() AS started, e.category, e.unit FROM goal_matches m JOIN goal_events e ON e.id = m.event_id WHERE m.id = ${key}`)
  if (!m) throw new Error('Maç bulunamadı.')
  if (m.status === 'void') throw new Error('Maç iptal edilmiş, sonuç girilemez.')
  if (m.status === 'settled') throw new Error('Maç zaten sonuçlandırılmış.')
  if (!m.started) throw new Error('Maç henüz başlamadı; sonuç maç bittikten sonra girilir.')
  const done = await rows(sql`UPDATE goal_matches SET status = 'settled', home_goals = ${score.home}, away_goals = ${score.away}, settled_at = now()
    WHERE id = ${key} AND status = 'open' RETURNING per_goal`)
  if (!done.length) throw new Error('Maç zaten sonuçlandırılmış.')
  const scored = await rows(sql`UPDATE goal_picks p SET
      goals = CASE WHEN p.side = 'home' THEN ${score.home}::int ELSE ${score.away}::int END,
      reward = ${Number(done[0].per_goal)}::int * CASE WHEN p.side = 'home' THEN ${score.home}::int ELSE ${score.away}::int END
    WHERE p.match_id = ${key} RETURNING p.reward`)
  const sponsor = m.category === 'sponsor'
  let failed = 0
  if (!sponsor) {
    // The score is recorded either way; whatever could not be paid is counted, never reported as paid.
    await payGoalRewards().catch((e) => console.error('[goal] ödeme', e))
    const [left] = await rows<{ n: string }>(sql`SELECT count(*) AS n FROM goal_picks WHERE match_id = ${key} AND reward > 0 AND (NOT paid OR pay_error IS NOT NULL)`)
    failed = Number(left.n)
  }
  return {
    picks: scored.length,
    winners: scored.filter((p) => Number(p.reward) > 0).length,
    total: scored.reduce((sum, p) => sum + Number(p.reward), 0),
    unit: String(m.unit),
    sponsor,
    failed,
  }
}

export const GOAL_PAY_INTERRUPTED = 'Ödeme yarıda kaldı. Üyenin coin dökümüne bak: ödül yazılmadıysa yeniden dene.'

/**
 * Pays every KC reward still owed. Each pick is claimed before it is paid, so no pick is paid twice and a
 * run that stops halfway is finished by the next one. The claim carries a "yarıda kaldı" mark that is only
 * cleared once the coins are written: a payment cut off mid-way stays visible in the panel instead of
 * silently counting as paid.
 */
export async function payGoalRewards() {
  await ensureGoal()
  const owed = await rows(sql`SELECT p.match_id, p.user_id, p.reward, m.home, m.away
    FROM goal_picks p JOIN goal_matches m ON m.id = p.match_id JOIN goal_events e ON e.id = m.event_id
    WHERE NOT p.paid AND p.reward > 0 AND m.status = 'settled' AND e.category = 'alkanka' ORDER BY p.match_id LIMIT 2000`)
  let paid = 0
  for (const p of owed) {
    const claimed = await rows(sql`UPDATE goal_picks SET paid = true, paid_at = now(), pay_error = ${GOAL_PAY_INTERRUPTED}
      WHERE match_id = ${p.match_id} AND user_id = ${p.user_id} AND NOT paid RETURNING user_id`)
    if (!claimed.length) continue
    try {
      await credit(String(p.user_id), Number(p.reward), `Gol başı ödül (${p.home} - ${p.away})`.slice(0, 120))
      await rows(sql`UPDATE goal_picks SET pay_error = NULL WHERE match_id = ${p.match_id} AND user_id = ${p.user_id}`)
      paid++
    } catch (error) {
      console.error('[goal] ödül yazılamadı', p.match_id, p.user_id, error)
      await rows(sql`UPDATE goal_picks SET pay_error = ${String((error as Error)?.message ?? 'bilinmeyen hata').slice(0, 200)}
        WHERE match_id = ${p.match_id} AND user_id = ${p.user_id}`).catch(() => {})
    }
  }
  return paid
}

/** Staff asks for a failed payment again. Only a pick marked as failed is released, so a paid one cannot be paid twice. */
export async function retryGoalPayment(matchId: number, userId: string) {
  await ensureGoal()
  const released = await rows(sql`UPDATE goal_picks SET paid = false, pay_error = NULL
    WHERE match_id = ${id(matchId, 'Maç')} AND user_id = ${String(userId)} AND paid AND pay_error IS NOT NULL RETURNING user_id`)
  if (!released.length) throw new Error('Bu ödülde yarım kalan bir ödeme yok.')
  return payGoalRewards()
}

// --- Participants (panel) ------------------------------------------------

export async function goalPicks(matchId: number, limit = 2000): Promise<{ event: GoalEvent; match: GoalMatch; picks: GoalPickRow[] }> {
  await ensureGoal()
  const key = id(matchId, 'Maç')
  const [m] = await rows(sql`SELECT m.*, 0 AS home_picks, 0 AS away_picks FROM goal_matches m WHERE m.id = ${key}`)
  if (!m) throw new Error('Maç bulunamadı.')
  const [[e], picks] = await Promise.all([
    rows(sql`SELECT * FROM goal_events WHERE id = ${Number(m.event_id)}`),
    rows(sql`SELECT * FROM goal_picks WHERE match_id = ${key} ORDER BY created_at ASC LIMIT ${limit}`),
  ])
  if (!e) throw new Error('Etkinlik bulunamadı.')
  return {
    event: eventOf(e),
    match: matchOf(m),
    picks: picks.map((p) => ({
      userId: String(p.user_id),
      userName: String(p.user_name),
      side: p.side === 'away' ? 'away' : 'home',
      siteUsername: p.site_username ? String(p.site_username) : null,
      approval: isGoalApproval(p.approval) ? p.approval : 'pending',
      goals: int(p.goals),
      reward: int(p.reward),
      paid: Boolean(p.paid),
      payError: p.pay_error ? String(p.pay_error) : null,
      at: iso(p.created_at),
    })),
  }
}

/** Member ids as one JSON parameter: the query builder spreads a plain array into separate parameters. */
function idList(userIds: unknown) {
  const list = [...new Set((Array.isArray(userIds) ? userIds : []).map(String))].slice(0, 2000)
  return list.length ? JSON.stringify(list) : null
}

async function sponsorMatch(matchId: number) {
  const key = id(matchId, 'Maç')
  const [m] = await rows(sql`SELECT e.category FROM goal_matches m JOIN goal_events e ON e.id = m.event_id WHERE m.id = ${key}`)
  if (!m) throw new Error('Maç bulunamadı.')
  if (m.category !== 'sponsor') throw new Error('Şart onayı ve teslim sadece sponsor etkinliklerinde var; Alkanka ödülleri kendiliğinden yatar.')
  return key
}

/** Staff confirms (or refuses) that members met the sponsor's condition. A delivered reward is not reopened. */
export async function setGoalApproval(matchId: number, userIds: string[], approval: GoalApproval) {
  await ensureGoal()
  const key = await sponsorMatch(matchId)
  if (!isGoalApproval(approval)) throw new Error('Geçersiz onay durumu.')
  const list = idList(userIds)
  if (!list) return 0
  const r = await rows(sql`UPDATE goal_picks SET approval = ${approval} WHERE match_id = ${key} AND NOT paid AND user_id IN (SELECT jsonb_array_elements_text(${list}::jsonb)) RETURNING user_id`)
  return r.length
}

/** Marks sponsor rewards as handed over. Only a scored, approved pick with something to give counts. */
export async function setGoalDelivered(matchId: number, userIds: string[], delivered: boolean) {
  await ensureGoal()
  const key = await sponsorMatch(matchId)
  const list = idList(userIds)
  if (!list) return 0
  const r = delivered
    ? await rows(sql`UPDATE goal_picks p SET paid = true, paid_at = now()
        WHERE p.match_id = ${key} AND NOT p.paid AND p.approval = 'approved' AND p.reward > 0 AND p.user_id IN (SELECT jsonb_array_elements_text(${list}::jsonb)) RETURNING p.user_id`)
    : await rows(sql`UPDATE goal_picks p SET paid = false, paid_at = NULL WHERE p.match_id = ${key} AND p.paid AND p.user_id IN (SELECT jsonb_array_elements_text(${list}::jsonb)) RETURNING p.user_id`)
  return r.length
}

// --- Background ----------------------------------------------------------

type FeedScore = { home: number; away: number }

/** Scores finished calendar matches from the result feed; a match added by hand waits for the panel. */
export async function autoSettleGoals(fetchResult: (extId: number) => Promise<FeedScore | null>, opts: { limit?: number } = {}) {
  await ensureGoal()
  const due = await rows(sql`SELECT id, ext_id FROM goal_matches
    WHERE status = 'open' AND ext_id IS NOT NULL AND kickoff < now() - interval '100 minutes' AND kickoff > now() - interval '2 days'
    ORDER BY kickoff LIMIT ${opts.limit ?? 8}`)
  let settled = 0
  for (const m of due) {
    const r = await fetchResult(Number(m.ext_id)).catch(() => null)
    if (!r) continue
    const ok = await settleGoalMatch(Number(m.id), r.home, r.away).then(
      () => true,
      () => false,
    )
    if (ok) settled++
  }
  return { checked: due.length, settled }
}

const LOOK_EVERY_MS = 10 * 60_000
let nextLook = 0

/**
 * Rides on the visitor-driven background slot: one cheap look per instance every ten minutes.
 * The result feed is only asked when a calendar match is actually due.
 */
export async function goalTick() {
  const now = Date.now()
  if (now < nextLook) return
  nextLook = now + LOOK_EVERY_MS
  const { getFinalResult } = await import('@/lib/kankatv')
  await autoSettleGoals(getFinalResult).catch((e) => console.error('[goal] otomatik sonuç', e))
  await payGoalRewards().catch((e) => console.error('[goal] ödeme', e))
}

export const goalSummaryText = (s: GoalSettleSummary) =>
  s.picks === 0
    ? 'Maç sonuçlandı; seçim yapan üye yoktu.'
    : s.sponsor
      ? `${s.picks} seçim hesaplandı, ${s.winners} üye toplam ${goalAmount(s.total, s.unit)} hak etti. Şartı onayla, sonra teslim et.`
      : s.failed > 0
        ? `${s.picks} seçim hesaplandı, ${s.winners} üye toplam ${goalAmount(s.total, s.unit)} kazandı. ${s.failed} ödeme YAZILAMADI: maçın katılımcı listesini aç ve yeniden dene.`
        : `${s.picks} seçim hesaplandı, ${s.winners} üyeye toplam ${goalAmount(s.total, s.unit)} yatırıldı.`

export type { GoalSide }
