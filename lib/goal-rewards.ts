import 'server-only'
import { pool, rows, sql } from '@/lib/db'
import { ruleDoneFor } from '@/lib/goal-play'
import { creditClaimed, debitClaimed } from '@/lib/member'
import { trDay, trDayBounds } from '@/lib/tr-time'
import {
  GOAL_NAME,
  GOAL_NO_RULE,
  GOAL_RULE_MISSED,
  checkCoupon,
  checkGoalEvent,
  checkGoalScore,
  cleanGoalRules,
  goalAmount,
  goalRulesMet,
  isGoalApproval,
  type GoalApproval,
  type GoalCategory,
  type GoalEvent,
  type GoalEventView,
  type GoalFlagAction,
  type GoalFlagRow,
  type GoalFlagState,
  type GoalMatch,
  type GoalMe,
  type GoalPickRow,
  type GoalPickSide,
  type GoalRule,
  type GoalRuleMode,
  type GoalSide,
  type GoalStatus,
} from '@/lib/goal-rewards-shared'

let ready: Promise<unknown> | null = null

/** Its own tables: nothing here reads or writes the prediction league's. */
export function ensureGoal() {
  ready ??= (async () => {
    await rows(sql`CREATE TABLE IF NOT EXISTS goal_events (
      id serial PRIMARY KEY, title text NOT NULL, category text NOT NULL, per_goal int NOT NULL, unit text NOT NULL DEFAULT 'KC',
      site_id int, site_name text, via_link boolean NOT NULL DEFAULT false, min_bet text NOT NULL DEFAULT '', terms text NOT NULL DEFAULT '',
      active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now())`)
    await rows(sql`ALTER TABLE goal_events ADD COLUMN IF NOT EXISTS site_slug text`)
    await rows(sql`ALTER TABLE goal_events ADD COLUMN IF NOT EXISTS need_deposit boolean NOT NULL DEFAULT false`)
    await rows(sql`ALTER TABLE goal_events ADD COLUMN IF NOT EXISTS min_odds numeric NOT NULL DEFAULT 0`)
    await rows(sql`ALTER TABLE goal_events ADD COLUMN IF NOT EXISTS entry_fee int NOT NULL DEFAULT 0`)
    await rows(sql`ALTER TABLE goal_events ADD COLUMN IF NOT EXISTS rules jsonb NOT NULL DEFAULT '[]'::jsonb`)
    await rows(sql`ALTER TABLE goal_events ADD COLUMN IF NOT EXISTS rule_mode text NOT NULL DEFAULT 'all'`)
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
    await rows(sql`ALTER TABLE goal_picks ADD COLUMN IF NOT EXISTS coupon text`)
    await rows(sql`ALTER TABLE goal_picks ADD COLUMN IF NOT EXISTS reject_reason text`)
    await rows(sql`ALTER TABLE goal_picks ADD COLUMN IF NOT EXISTS fee int NOT NULL DEFAULT 0`)
    await rows(sql`ALTER TABLE goal_picks ADD COLUMN IF NOT EXISTS fee_refunded boolean NOT NULL DEFAULT false`)
    // One coupon cannot be entered twice for the same match.
    await rows(sql`CREATE UNIQUE INDEX IF NOT EXISTS goal_picks_coupon ON goal_picks (match_id, lower(coupon)) WHERE coupon IS NOT NULL`)
    await rows(sql`CREATE INDEX IF NOT EXISTS goal_picks_user ON goal_picks (user_id)`)
    // 'warned' and 'blocked' are the tags staff puts on a member; 'open' is a member whose block was lifted and whose warnings are kept.
    await rows(sql`CREATE TABLE IF NOT EXISTS goal_flags (
      user_id text PRIMARY KEY, user_name text NOT NULL DEFAULT '', state text NOT NULL, warns int NOT NULL DEFAULT 0,
      note text NOT NULL DEFAULT '', updated_by text, updated_at timestamptz NOT NULL DEFAULT now())`)
  })().catch((error) => {
    ready = null
    throw error
  })
  return ready
}

const iso = (v: unknown) => new Date(String(v)).toISOString()
const int = (v: unknown) => (v === null || v === undefined ? null : Number(v))
const str = (v: unknown) => (v === null || v === undefined || v === '' ? null : String(v))
const id = (v: unknown, what: string) => {
  const n = Number(v)
  if (!Number.isSafeInteger(n) || n <= 0) throw new Error(`${what} bulunamadı.`)
  return n
}

/** A jsonb column arrives parsed from one driver and as text from another. */
function rulesOf(v: unknown): GoalRule[] {
  if (typeof v !== 'string') return cleanGoalRules(v)
  try {
    return cleanGoalRules(JSON.parse(v))
  } catch {
    return []
  }
}

const modeOf = (v: unknown): GoalRuleMode => (v === 'any' ? 'any' : 'all')
const flagOf = (v: unknown): GoalFlagState | null => (v === 'warned' || v === 'blocked' ? v : null)
const sideOf = (v: unknown): GoalPickSide => (v === 'home' || v === 'away' ? v : 'all')

function eventOf(x: Record<string, unknown>): GoalEvent {
  return {
    id: Number(x.id),
    title: String(x.title),
    category: x.category === 'sponsor' ? 'sponsor' : 'alkanka',
    perGoal: Number(x.per_goal),
    unit: String(x.unit),
    siteId: int(x.site_id),
    siteName: str(x.site_name),
    siteSlug: str(x.site_slug),
    viaLink: Boolean(x.via_link),
    minBet: String(x.min_bet ?? ''),
    needDeposit: Boolean(x.need_deposit),
    minOdds: Number(x.min_odds ?? 0) || 0,
    entryFee: Number(x.entry_fee ?? 0) || 0,
    rules: rulesOf(x.rules),
    ruleMode: modeOf(x.rule_mode),
    terms: String(x.terms ?? ''),
    active: Boolean(x.active),
    createdAt: iso(x.created_at),
  }
}

function matchOf(x: Record<string, unknown>): GoalMatch {
  const status: GoalStatus = x.status === 'settled' ? 'settled' : x.status === 'void' ? 'void' : 'open'
  const homePicks = Number(x.home_picks ?? 0)
  const awayPicks = Number(x.away_picks ?? 0)
  return {
    id: Number(x.id),
    eventId: Number(x.event_id),
    league: String(x.league ?? ''),
    home: String(x.home),
    away: String(x.away),
    homeLogo: str(x.home_logo),
    awayLogo: str(x.away_logo),
    extId: int(x.ext_id),
    kickoff: iso(x.kickoff),
    status,
    homeGoals: int(x.home_goals),
    awayGoals: int(x.away_goals),
    perGoal: Number(x.per_goal),
    homePicks,
    awayPicks,
    picks: Number(x.picks ?? homePicks + awayPicks),
    myPick: x.my_side
      ? {
          side: sideOf(x.my_side),
          siteUsername: str(x.my_site_username),
          coupon: str(x.my_coupon),
          approval: isGoalApproval(x.my_approval) ? x.my_approval : 'pending',
          rejectReason: str(x.my_reject_reason),
          goals: int(x.my_goals),
          reward: int(x.my_reward),
          paid: Boolean(x.my_paid),
          fee: Number(x.my_fee ?? 0),
          feeRefunded: Boolean(x.my_fee_refunded),
          progress: null,
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
        (SELECT count(*) FROM goal_picks p WHERE p.match_id = m.id) AS picks,
        mp.side AS my_side, mp.site_username AS my_site_username, mp.coupon AS my_coupon, mp.approval AS my_approval,
        mp.reject_reason AS my_reject_reason, mp.goals AS my_goals, mp.reward AS my_reward, mp.fee AS my_fee, mp.fee_refunded AS my_fee_refunded,
        (mp.paid AND mp.pay_error IS NULL) AS my_paid
      FROM goal_matches m JOIN goal_events e ON e.id = m.event_id
      LEFT JOIN goal_picks mp ON mp.match_id = m.id AND mp.user_id = ${userId ?? ''}
      WHERE (${admin}::boolean OR (e.active AND m.kickoff > now() - interval '7 days')) AND (${category} = '' OR e.category = ${category})
      ORDER BY m.kickoff ASC, m.id ASC LIMIT 400`),
  ])
  const byEvent = new Map<number, GoalMatch[]>()
  for (const m of matches.map(matchOf)) byEvent.set(m.eventId, [...(byEvent.get(m.eventId) ?? []), m])
  const list = events.map((e) => ({ ...eventOf(e), matches: byEvent.get(Number(e.id)) ?? [] }))
  await fillSlugs(list).catch((error) => console.error('[goal] sponsor adresi', (error as Error).message))
  if (admin) return list
  // An event with nothing to show is noise on the site; the panel still needs it to add matches.
  const shown = list.filter((e) => e.matches.length > 0)
  if (userId) await attachProgress(userId, shown).catch((error) => console.error('[goal] şart ilerlemesi', (error as Error).message))
  return shown
}

/** Sponsor events opened before members linked their accounts here carry no slug yet; it is looked up once and kept. */
async function fillSlugs(events: GoalEventView[]) {
  const missing = events.filter((e) => e.category === 'sponsor' && !e.siteSlug && e.siteId)
  if (missing.length === 0) return
  const { listSites } = await import('@/lib/sites')
  const sites = await listSites()
  for (const e of missing) {
    const slug = sites.find((s) => Number(s.id) === e.siteId)?.slug
    if (!slug) continue
    e.siteSlug = slug
    await rows(sql`UPDATE goal_events SET site_slug = ${slug} WHERE id = ${e.id} AND site_slug IS NULL`)
  }
}

/** How many match days of one event are looked at for the member's progress; the nearest ones come first. */
const PROGRESS_DAYS = 4

/** Fills in how far the member is on the conditions of the matches they joined and are not yet paid for. */
async function attachProgress(userId: string, events: GoalEventView[]) {
  for (const e of events) {
    if (e.category !== 'alkanka' || e.rules.length === 0) continue
    const days = new Map<string, GoalMatch[]>()
    for (const m of e.matches) {
      if (!m.myPick || m.status === 'void' || m.myPick.paid || m.myPick.approval === 'rejected') continue
      const day = trDay(m.kickoff)
      days.set(day, [...(days.get(day) ?? []), m])
    }
    for (const [day, list] of [...days].slice(0, PROGRESS_DAYS)) {
      const done = (await ruleDoneFor([userId], e.rules, day)).get(userId) ?? e.rules.map(() => 0)
      for (const m of list) if (m.myPick) m.myPick.progress = done
    }
  }
}

/** The member's linked sponsor accounts and the tag staff put on them, if any. */
export async function goalMe(userId: string): Promise<GoalMe> {
  await ensureGoal()
  const { mySponsorAccounts } = await import('@/lib/growth')
  const [accounts, [flag]] = await Promise.all([mySponsorAccounts(userId).catch(() => []), rows(sql`SELECT state, note FROM goal_flags WHERE user_id = ${userId}`)])
  const state = flagOf(flag?.state)
  return {
    accounts: Object.fromEntries(accounts.map((a) => [a.siteId, { username: a.username, status: a.status }])),
    flag: state ? { state, note: String(flag.note ?? '') } : null,
  }
}

// --- Managing events -----------------------------------------------------

export async function saveGoalEvent(input: unknown): Promise<GoalEvent> {
  await ensureGoal()
  const checked = checkGoalEvent(input)
  if (!checked.ok) throw new Error(checked.error)
  const e = checked.value
  let siteName: string | null = null
  let siteSlug: string | null = null
  if (e.category === 'sponsor') {
    // The event keeps the sponsor's numeric id; `siteOptions` hands out slugs, which never match it.
    const { listSites } = await import('@/lib/sites')
    const site = (await listSites()).find((s) => Number(s.id) === e.siteId)
    if (!site) throw new Error('Seçilen sponsor bulunamadı.')
    // Members link their sponsor account by the sponsor's public address; without one nobody could join.
    if (!site.slug) throw new Error('Bu sponsorun sitede bir adresi yok. Önce sponsoru yayına al, sonra etkinliği aç.')
    siteName = site.name
    siteSlug = site.slug
  }
  const rules = JSON.stringify(e.rules)
  if (e.id) {
    const [before] = await rows(sql`SELECT category FROM goal_events WHERE id = ${e.id}`)
    if (!before) throw new Error('Etkinlik bulunamadı.')
    if (before.category !== e.category) throw new Error('Etkinliğin türü sonradan değişmez. Yeni bir etkinlik aç.')
    const [saved] = await rows(sql`UPDATE goal_events SET title = ${e.title}, per_goal = ${e.perGoal}, unit = ${e.unit}, site_id = ${e.siteId}, site_name = ${siteName},
        site_slug = ${siteSlug}, via_link = ${e.viaLink}, min_bet = ${e.minBet}, need_deposit = ${e.needDeposit}, min_odds = ${e.minOdds},
        entry_fee = ${e.entryFee}, rules = ${rules}::jsonb, rule_mode = ${e.ruleMode}, terms = ${e.terms}, active = ${e.active} WHERE id = ${e.id} RETURNING *`)
    // A match nobody has picked yet follows the new figure; a match with picks keeps what members were promised.
    await rows(sql`UPDATE goal_matches m SET per_goal = ${e.perGoal}
      WHERE m.event_id = ${e.id} AND m.status = 'open' AND NOT EXISTS (SELECT 1 FROM goal_picks p WHERE p.match_id = m.id)`)
    return eventOf(saved)
  }
  const [saved] = await rows(sql`INSERT INTO goal_events (title, category, per_goal, unit, site_id, site_name, site_slug, via_link, min_bet, need_deposit, min_odds, entry_fee, rules, rule_mode, terms, active)
    VALUES (${e.title}, ${e.category}, ${e.perGoal}, ${e.unit}, ${e.siteId}, ${siteName}, ${siteSlug}, ${e.viaLink}, ${e.minBet}, ${e.needDeposit}, ${e.minOdds},
      ${e.entryFee}, ${rules}::jsonb, ${e.ruleMode}, ${e.terms}, ${e.active}) RETURNING *`)
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
    const home = String(f?.home ?? '').trim().slice(0, 80)
    const away = String(f?.away ?? '').trim().slice(0, 80)
    if (!home || !away || !Number.isSafeInteger(f.extId) || f.extId <= 0 || Number.isNaN(when.getTime()) || when.getTime() <= Date.now()) continue
    const r = await rows(sql`INSERT INTO goal_matches (event_id, league, home, away, home_logo, away_logo, ext_id, kickoff, per_goal)
      VALUES (${e.id}, ${String(f.league ?? '').trim().slice(0, 80)}, ${home}, ${away},
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
  if (!gone.length) throw new Error('Bu maça katılan var ya da maç sonuçlanmış; silinemez. Oynanmadıysa iptal et.')
}

/** A cancelled match pays nothing and can no longer be scored. Whoever paid to join gets the fee back. */
export async function voidGoalMatch(matchId: number) {
  await ensureGoal()
  const done = await rows(sql`UPDATE goal_matches SET status = 'void', settled_at = now() WHERE id = ${id(matchId, 'Maç')} AND status = 'open' RETURNING id`)
  if (!done.length) throw new Error('Maç zaten sonuçlanmış ya da iptal edilmiş.')
  const [fees] = await rows<{ n: string; total: string | null }>(sql`SELECT count(*) AS n, sum(fee) AS total FROM goal_picks WHERE match_id = ${Number(done[0].id)} AND fee > 0`)
  const refunded = await refundVoidFees().catch((error) => {
    console.error('[goal] katılım iadesi', error)
    return 0
  })
  return { feePicks: Number(fees?.n ?? 0), feeTotal: Number(fees?.total ?? 0), refunded }
}

/** Gives back the joining fee of every cancelled match, once. A refund that fails is tried again on the next run. */
export async function refundVoidFees() {
  await ensureGoal()
  const due = await rows(sql`SELECT p.match_id, p.user_id, p.fee, m.home, m.away FROM goal_picks p JOIN goal_matches m ON m.id = p.match_id
    WHERE m.status = 'void' AND p.fee > 0 AND NOT p.fee_refunded ORDER BY p.match_id LIMIT 1000`)
  let refunded = 0
  for (const p of due) {
    const userId = String(p.user_id)
    try {
      const won = await creditClaimed(userId, Number(p.fee), `${GOAL_NAME} katılım iadesi (${p.home} - ${p.away})`.slice(0, 120), async (client) => {
        const claimed = await client.query(`UPDATE goal_picks SET fee_refunded = true WHERE match_id = $1 AND user_id = $2 AND fee > 0 AND NOT fee_refunded RETURNING user_id`, [p.match_id, userId])
        return Boolean(claimed.rowCount)
      })
      if (won) refunded++
    } catch (error) {
      console.error('[goal] katılım iadesi yazılamadı', p.match_id, userId, error)
    }
  }
  return refunded
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

const CLOSED = 'Bu maç için katılım kapandı.'

async function mayJoin(userId: string) {
  const { roleBlocks } = await import('@/lib/kanka-puan')
  if (await roleBlocks(userId, 'events').catch(() => false)) throw new Error('Bu hesap etkinliklere katılamaz.')
}

/**
 * Alkanka events: the member joins the match and every goal of it counts; nobody picks a team. The reward
 * waits until the member has met the event's condition on the match day, which the site counts by itself.
 * A joining fee, when the event has one, leaves the wallet in the same transaction that writes the entry,
 * so nobody joins without paying and nobody pays without joining.
 */
export async function joinGoalMatch(user: { id: string; name: string }, matchId: number) {
  await ensureGoal()
  const key = id(matchId, 'Maç')
  const [m] = await rows(sql`SELECT e.category, e.entry_fee, e.rules, m.home, m.away FROM goal_matches m JOIN goal_events e ON e.id = m.event_id
    WHERE m.id = ${key} AND m.status = 'open' AND m.kickoff > now() AND e.active`)
  if (!m) throw new Error(CLOSED)
  if (m.category === 'sponsor') throw new Error('Sponsor etkinliğine kuponla katılırsın: bahsini al ve kupon numaranı gir.')
  // An event saved before conditions became required: paying every goal for a button press is not the deal.
  if (rulesOf(m.rules).length === 0) throw new Error(GOAL_NO_RULE)
  await mayJoin(user.id)
  const fee = Number(m.entry_fee) || 0
  const approval: GoalApproval = 'pending'
  // The open-and-not-started check is repeated inside the insert: an entry must never land after kickoff,
  // and the fee taken is the one the member was shown.
  const outcome = await debitClaimed(user.id, fee, `${GOAL_NAME} katılımı (${m.home} - ${m.away})`.slice(0, 120), async (client) => {
    const saved = await client.query(
      `INSERT INTO goal_picks (match_id, user_id, user_name, side, approval, fee)
       SELECT m.id, $2::text, $3::text, 'all', $4::text, $5::int FROM goal_matches m JOIN goal_events e ON e.id = m.event_id
       WHERE m.id = $1::int AND m.status = 'open' AND m.kickoff > now() AND e.active AND e.category = 'alkanka' AND e.entry_fee = $5::int
       ON CONFLICT (match_id, user_id) DO NOTHING RETURNING match_id`,
      [key, user.id, user.name.slice(0, 40), approval, fee],
    )
    return Boolean(saved.rowCount)
  })
  if (outcome === 'short') throw new Error(`Katılım için ${goalAmount(fee, 'KC')} gerekiyor, bakiyen yetmiyor.`)
  if (outcome === 'taken') throw new Error('Katılım kaydedilemedi: bu maça zaten katıldın ya da katılım az önce kapandı. Sayfayı yenile.')
  return { fee }
}

/**
 * Sponsor events: the member has bet at the sponsor and hands in the coupon number. The sponsor account
 * linked to Alkanka is written onto the request; nobody types a username here. While the request is still
 * unchecked the member may correct the number; once staff looked at it, it stays as it is.
 */
export async function submitGoalCoupon(user: { id: string; name: string }, matchId: number, rawCoupon: unknown): Promise<'saved' | 'updated'> {
  await ensureGoal()
  const key = id(matchId, 'Maç')
  const [m] = await rows(sql`SELECT e.category, e.site_id, e.site_name, e.site_slug FROM goal_matches m JOIN goal_events e ON e.id = m.event_id
    WHERE m.id = ${key} AND m.status = 'open' AND m.kickoff > now() AND e.active`)
  if (!m) throw new Error(`${CLOSED} Kupon numarası maç başlayana kadar girilir.`)
  if (m.category !== 'sponsor') throw new Error('Bu etkinlikte kupon girilmez; maça "Maça katıl" düğmesiyle katılırsın.')
  const coupon = checkCoupon(rawCoupon)
  if (!coupon.ok) throw new Error(coupon.error)
  await mayJoin(user.id)
  const site = String(m.site_name ?? 'Sponsor')
  const [flag] = await rows(sql`SELECT state FROM goal_flags WHERE user_id = ${user.id}`)
  if (flag?.state === 'blocked') throw new Error('Geçersiz talepler nedeniyle sponsor etkinliklerine katılımın kapatıldı. Bir hata olduğunu düşünüyorsan destekle iletişime geç.')
  const { mySponsorAccounts } = await import('@/lib/growth')
  const account = (await mySponsorAccounts(user.id)).find((a) => a.siteId === m.site_slug)
  if (!account) throw new Error(`Önce ${site} hesabını Alkanka'ya bağla.`)
  if (account.status === 'rejected') throw new Error(`${site} hesabın onaylanmadı. Doğru kullanıcı adıyla yeniden bağla.`)

  const siteId = Number(m.site_id)
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    // One coupon belongs to one member at a sponsor, but the unique index only covers a single match.
    // Without this lock two members entering the same number for different matches at the same moment both pass the check.
    await client.query(`SELECT pg_advisory_xact_lock(hashtextextended('goal-coupon:' || $1::text || ':' || lower($2::text), 0))`, [siteId, coupon.value])
    const mine = await client.query(`SELECT approval FROM goal_picks WHERE match_id = $1::int AND user_id = $2::text`, [key, user.id])
    if (mine.rows[0] && mine.rows[0].approval !== 'pending') throw new Error('Bu maçtaki talebin kontrol edildi; kupon numarası artık değiştirilemez.')
    const used = await client.query(
      `SELECT 1 FROM goal_picks p JOIN goal_matches mm ON mm.id = p.match_id JOIN goal_events ee ON ee.id = mm.event_id
       WHERE ee.site_id = $1::int AND lower(p.coupon) = lower($2::text) AND p.user_id <> $3::text LIMIT 1`,
      [siteId, coupon.value, user.id],
    )
    if (used.rowCount) throw new Error('Bu kupon numarası başka bir üye tarafından girilmiş. Numarayı kontrol et.')
    const saved = await client.query(
      `INSERT INTO goal_picks (match_id, user_id, user_name, side, site_username, coupon, approval)
       SELECT m.id, $2::text, $3::text, 'all', $4::text, $5::text, 'pending'
       FROM goal_matches m JOIN goal_events e ON e.id = m.event_id
       WHERE m.id = $1::int AND m.status = 'open' AND m.kickoff > now() AND e.active AND e.category = 'sponsor'
       ON CONFLICT (match_id, user_id) DO UPDATE SET coupon = EXCLUDED.coupon, site_username = EXCLUDED.site_username, created_at = now()
         WHERE goal_picks.approval = 'pending'
       RETURNING match_id`,
      [key, user.id, user.name.slice(0, 40), account.username, coupon.value],
    )
    if (!saved.rowCount) throw new Error(`${CLOSED} Kupon numarası maç başlayana kadar girilir.`)
    await client.query('COMMIT')
    return mine.rows[0] ? 'updated' : 'saved'
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    if ((error as { code?: string })?.code === '23505') throw new Error('Bu kupon numarası bu maç için zaten girilmiş.')
    throw error
  } finally {
    client.release()
  }
}

/**
 * A member has one account at a sponsor. When they correct it, the requests staff has not looked at yet
 * follow the new username, so one member never shows up under several names; a checked request keeps the
 * username staff judged it with.
 */
export async function followSponsorAccount(userId: string, siteSlug: string, username: string) {
  await ensureGoal()
  await rows(sql`UPDATE goal_picks p SET site_username = ${username}
    FROM goal_matches m JOIN goal_events e ON e.id = m.event_id
    WHERE m.id = p.match_id AND p.user_id = ${userId} AND p.approval = 'pending' AND p.coupon IS NOT NULL
      AND e.category = 'sponsor' AND e.site_slug = ${siteSlug} AND p.site_username IS DISTINCT FROM ${username}`)
}

/** How many coupon requests of the member at this sponsor staff has not checked yet. */
export async function openSponsorRequests(userId: string, siteSlug: string) {
  await ensureGoal()
  const [r] = await rows(sql`SELECT count(*) AS n FROM goal_picks p JOIN goal_matches m ON m.id = p.match_id JOIN goal_events e ON e.id = m.event_id
    WHERE p.user_id = ${userId} AND p.approval = 'pending' AND p.coupon IS NOT NULL AND m.status <> 'void'
      AND e.category = 'sponsor' AND e.site_slug = ${siteSlug}`)
  return Number(r?.n ?? 0)
}

// --- Scoring and paying --------------------------------------------------

/**
 * `failed`: KC payments of this match that could not be written; they wait in the participant list.
 * `waiting`: members who earned a reward but have not met the event's condition yet.
 */
export type GoalSettleSummary = { picks: number; winners: number; total: number; unit: string; sponsor: boolean; failed: number; waiting: number }

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
  // Every entry counts all goals of the match. Only entries from before sides were dropped still carry a team,
  // and those are paid for that team's goals, as the member was promised.
  const scored = await rows(sql`UPDATE goal_picks p SET
      goals = CASE p.side WHEN 'home' THEN ${score.home}::int WHEN 'away' THEN ${score.away}::int ELSE ${score.home + score.away}::int END,
      reward = ${Number(done[0].per_goal)}::int * CASE p.side WHEN 'home' THEN ${score.home}::int WHEN 'away' THEN ${score.away}::int ELSE ${score.home + score.away}::int END
    WHERE p.match_id = ${key} RETURNING p.reward, p.approval`)
  const sponsor = m.category === 'sponsor'
  let failed = 0
  let waiting = 0
  if (!sponsor) {
    // The score is recorded either way; whatever could not be paid is counted, never reported as paid.
    await payGoalRewards().catch((e) => console.error('[goal] ödeme', e))
    const [left] = await rows<{ failed: string; waiting: string }>(sql`SELECT count(*) FILTER (WHERE pay_error IS NOT NULL) AS failed,
        count(*) FILTER (WHERE pay_error IS NULL AND NOT paid AND approval <> 'rejected') AS waiting
      FROM goal_picks WHERE match_id = ${key} AND reward > 0`)
    failed = Number(left.failed)
    waiting = Number(left.waiting)
  }
  // A refused sponsor request earns nothing, whatever the score.
  const counted = sponsor ? scored.filter((p) => p.approval !== 'rejected') : scored
  return {
    picks: scored.length,
    winners: counted.filter((p) => Number(p.reward) > 0).length,
    total: counted.reduce((sum, p) => sum + Number(p.reward), 0),
    unit: String(m.unit),
    sponsor,
    failed,
    waiting,
  }
}

/** The last games of a day are written a moment after midnight; a condition is only called missed once they are in. */
const RULE_GRACE_MS = 3 * 60_000

/**
 * Pays every KC reward still owed. The "paid" mark and the coins are written in one transaction, so a pick
 * is never marked without being paid and two runs at once cannot pay it twice. A payment that fails stays
 * unpaid with its reason, where the panel shows it, and the next run tries it again.
 *
 * In an event with conditions a reward is paid once the member has met them on the match day (Turkey time).
 * Until that day is over the pick waits; after it, an unmet condition forfeits the reward. If the count
 * cannot be read, nothing is decided: the pick waits for the next run.
 */
export async function payGoalRewards() {
  await ensureGoal()
  await refundVoidFees().catch((e) => console.error('[goal] katılım iadesi', e))
  const owed = await rows(sql`SELECT p.match_id, p.user_id, p.reward, p.approval, m.home, m.away, m.kickoff, e.id AS event_id, e.rules, e.rule_mode
    FROM goal_picks p JOIN goal_matches m ON m.id = p.match_id JOIN goal_events e ON e.id = m.event_id
    WHERE NOT p.paid AND p.reward > 0 AND m.status = 'settled' AND e.category = 'alkanka' AND p.approval <> 'rejected' ORDER BY p.match_id LIMIT 2000`)

  type Group = { rules: GoalRule[]; mode: GoalRuleMode; day: string; users: Set<string> }
  const groups = new Map<string, Group>()
  const groupOf = (p: Record<string, unknown>) => {
    const rules = rulesOf(p.rules)
    if (rules.length === 0) return null
    const day = trDay(String(p.kickoff))
    const key = `${p.event_id}|${day}`
    const group = groups.get(key) ?? { rules, mode: modeOf(p.rule_mode), day, users: new Set<string>() }
    groups.set(key, group)
    return { key, group }
  }
  for (const p of owed) groupOf(p)?.group.users.add(String(p.user_id))
  const doneBy = new Map<string, Map<string, number[]>>()
  for (const [key, g] of groups) {
    try {
      doneBy.set(key, await ruleDoneFor([...g.users], g.rules, g.day))
    } catch (error) {
      console.error('[goal] şart sayımı okunamadı', key, error)
    }
  }

  let paid = 0
  for (const p of owed) {
    const userId = String(p.user_id)
    const found = groupOf(p)
    if (found) {
      const done = doneBy.get(found.key)
      if (!done) continue
      const { rules, mode, day } = found.group
      if (!goalRulesMet(rules, mode, done.get(userId) ?? [])) {
        const over = Date.now() >= Date.parse(trDayBounds(day).end) + RULE_GRACE_MS
        if (over) {
          await rows(sql`UPDATE goal_picks SET approval = 'rejected', reject_reason = ${GOAL_RULE_MISSED} WHERE match_id = ${p.match_id} AND user_id = ${userId} AND NOT paid`).catch(() => {})
        } else if (p.approval !== 'pending') {
          await rows(sql`UPDATE goal_picks SET approval = 'pending' WHERE match_id = ${p.match_id} AND user_id = ${userId} AND NOT paid AND approval = 'approved'`).catch(() => {})
        }
        continue
      }
    }
    try {
      const won = await creditClaimed(userId, Number(p.reward), `${GOAL_NAME} ödülü (${p.home} - ${p.away})`.slice(0, 120), async (client) => {
        const claimed = await client.query(
          `UPDATE goal_picks SET paid = true, paid_at = now(), pay_error = NULL, approval = 'approved', reject_reason = NULL
           WHERE match_id = $1 AND user_id = $2 AND NOT paid AND approval <> 'rejected' RETURNING user_id`,
          [p.match_id, userId],
        )
        return Boolean(claimed.rowCount)
      })
      if (won) paid++
    } catch (error) {
      console.error('[goal] ödül yazılamadı', p.match_id, userId, error)
      await rows(sql`UPDATE goal_picks SET pay_error = ${String((error as Error)?.message ?? 'bilinmeyen hata').slice(0, 200)}
        WHERE match_id = ${p.match_id} AND user_id = ${userId} AND NOT paid`).catch(() => {})
    }
  }
  return paid
}

/**
 * Staff asks for a payment that did not go through. Only a pick carrying a failure reason is touched: a pick
 * left half-done by the earlier payment code (marked paid, with a reason) is released, a failed one is tried
 * again. A pick being paid at this very moment has no reason on it, so it cannot be released from under that payment.
 */
export async function retryGoalPayment(matchId: number, userId: string) {
  await ensureGoal()
  const waiting = await rows(sql`UPDATE goal_picks SET paid = false, pay_error = NULL
    WHERE match_id = ${id(matchId, 'Maç')} AND user_id = ${String(userId)} AND reward > 0 AND pay_error IS NOT NULL RETURNING user_id`)
  if (!waiting.length) throw new Error('Bu ödülde yarım kalan bir ödeme yok.')
  return payGoalRewards()
}

// --- Participants (panel) ------------------------------------------------

export async function goalPicks(matchId: number, limit = 2000): Promise<{ event: GoalEvent; match: GoalMatch; picks: GoalPickRow[] }> {
  await ensureGoal()
  const key = id(matchId, 'Maç')
  const [m] = await rows(sql`SELECT m.*, 0 AS home_picks, 0 AS away_picks FROM goal_matches m WHERE m.id = ${key}`)
  if (!m) throw new Error('Maç bulunamadı.')
  const [e] = await rows(sql`SELECT * FROM goal_events WHERE id = ${Number(m.event_id)}`)
  if (!e) throw new Error('Etkinlik bulunamadı.')
  const sponsor = e.category === 'sponsor'
  // The tag columns only matter where staff judges requests; an Alkanka list skips the extra counting.
  const picks = sponsor
    ? await rows(sql`SELECT p.*, f.state AS flag_state, f.warns AS flag_warns,
          (SELECT count(*) FROM goal_picks p2 JOIN goal_matches m2 ON m2.id = p2.match_id JOIN goal_events e2 ON e2.id = m2.event_id
            WHERE p2.user_id = p.user_id AND e2.category = 'sponsor' AND p2.approval = 'rejected') AS invalid
        FROM goal_picks p LEFT JOIN goal_flags f ON f.user_id = p.user_id WHERE p.match_id = ${key} ORDER BY p.created_at ASC LIMIT ${limit}`)
    : await rows(sql`SELECT p.* FROM goal_picks p WHERE p.match_id = ${key} ORDER BY p.created_at ASC LIMIT ${limit}`)
  // Staff sees next to each request which account the member has linked right now and whether it is approved.
  const linked = new Map<string, { username: string; status: GoalApproval }>()
  if (sponsor && e.site_slug && picks.length > 0) {
    const { sponsorAccountsOf } = await import('@/lib/growth')
    const found = await sponsorAccountsOf(String(e.site_slug), picks.map((p) => String(p.user_id))).catch(() => [])
    for (const a of found) linked.set(a.userId, { username: a.username, status: a.status })
  }
  return {
    event: eventOf(e),
    match: { ...matchOf(m), picks: picks.length },
    picks: picks.map((p) => ({
      userId: String(p.user_id),
      userName: String(p.user_name),
      side: sideOf(p.side),
      siteUsername: str(p.site_username),
      accountNow: linked.get(String(p.user_id)) ?? null,
      coupon: str(p.coupon),
      approval: isGoalApproval(p.approval) ? p.approval : 'pending',
      rejectReason: str(p.reject_reason),
      goals: int(p.goals),
      reward: int(p.reward),
      paid: Boolean(p.paid),
      payError: str(p.pay_error),
      fee: Number(p.fee ?? 0),
      feeRefunded: Boolean(p.fee_refunded),
      at: iso(p.created_at),
      invalid: Number(p.invalid ?? 0),
      flag: flagOf(p.flag_state),
      warns: Number(p.flag_warns ?? 0),
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
  if (m.category !== 'sponsor') throw new Error('Kupon kontrolü ve teslim sadece sponsor etkinliklerinde var; Alkanka ödülleri kendiliğinden yatar.')
  return key
}

/**
 * Staff finds members' coupons valid or invalid. An invalid request keeps its reason, which the member sees
 * and which counts towards the member's tag. A delivered reward is not reopened.
 */
export async function setGoalApproval(matchId: number, userIds: string[], approval: GoalApproval, reason?: unknown) {
  await ensureGoal()
  const key = await sponsorMatch(matchId)
  if (!isGoalApproval(approval)) throw new Error('Geçersiz onay durumu.')
  const list = idList(userIds)
  if (!list) return 0
  const why = approval === 'rejected' ? String(reason ?? '').replace(/\s+/g, ' ').trim().slice(0, 160) || 'Şartlara uymuyor' : null
  const r = await rows(sql`UPDATE goal_picks SET approval = ${approval}, reject_reason = ${why}
    WHERE match_id = ${key} AND NOT paid AND user_id IN (SELECT jsonb_array_elements_text(${list}::jsonb)) RETURNING user_id`)
  return r.length
}

/** Marks sponsor rewards as handed over. Only a scored, valid request with something to give counts. */
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

// --- Tags for invalid requests (panel) -----------------------------------

/** Everyone who sent an invalid sponsor request or carries a tag, the heaviest cases first. */
export async function goalFlagList(): Promise<GoalFlagRow[]> {
  await ensureGoal()
  const found = await rows(sql`WITH s AS (
      SELECT p.user_id, max(p.user_name) AS user_name, count(*) AS total,
        count(*) FILTER (WHERE p.approval = 'rejected') AS invalid,
        max(p.created_at) FILTER (WHERE p.approval = 'rejected') AS last_at
      FROM goal_picks p JOIN goal_matches m ON m.id = p.match_id JOIN goal_events e ON e.id = m.event_id
      WHERE e.category = 'sponsor' GROUP BY p.user_id)
    SELECT coalesce(s.user_id, f.user_id) AS user_id, coalesce(s.user_name, nullif(f.user_name, ''), 'Üye') AS user_name,
      coalesce(s.total, 0) AS total, coalesce(s.invalid, 0) AS invalid, s.last_at,
      (SELECT p.reject_reason FROM goal_picks p JOIN goal_matches m ON m.id = p.match_id JOIN goal_events e ON e.id = m.event_id
        WHERE p.user_id = coalesce(s.user_id, f.user_id) AND e.category = 'sponsor' AND p.approval = 'rejected' ORDER BY p.created_at DESC LIMIT 1) AS last_reason,
      f.state, coalesce(f.warns, 0) AS warns, coalesce(f.note, '') AS note, f.updated_by, f.updated_at
    FROM s FULL JOIN goal_flags f ON f.user_id = s.user_id
    WHERE coalesce(s.invalid, 0) > 0 OR f.user_id IS NOT NULL
    ORDER BY (f.state = 'blocked') DESC NULLS LAST, coalesce(s.invalid, 0) DESC, s.last_at DESC NULLS LAST LIMIT 300`)
  return found.map((x) => ({
    userId: String(x.user_id),
    userName: String(x.user_name),
    state: flagOf(x.state),
    warns: Number(x.warns),
    note: String(x.note ?? ''),
    invalid: Number(x.invalid),
    total: Number(x.total),
    lastReason: str(x.last_reason),
    lastAt: x.last_at ? iso(x.last_at) : null,
    updatedBy: str(x.updated_by),
    updatedAt: x.updated_at ? iso(x.updated_at) : null,
  }))
}

/**
 * Warns a member, closes their participation in sponsor events, or opens it again. Warnings add up and
 * are kept when a block is lifted; warning a blocked member does not unblock them.
 */
export async function setGoalFlag(userId: string, action: GoalFlagAction, note: unknown, by: string): Promise<{ userName: string; warns: number; state: GoalFlagState | null }> {
  await ensureGoal()
  const key = String(userId ?? '').slice(0, 80)
  if (!key) throw new Error('Üye bulunamadı.')
  const [known] = await rows(sql`SELECT user_name FROM goal_picks WHERE user_id = ${key} ORDER BY created_at DESC LIMIT 1`)
  const [flagged] = await rows(sql`SELECT user_name FROM goal_flags WHERE user_id = ${key}`)
  if (!known && !flagged) throw new Error('Bu üyenin Gol Yağmuru kaydı yok.')
  const name = String(known?.user_name ?? flagged?.user_name ?? 'Üye')
  const text = String(note ?? '').replace(/\s+/g, ' ').trim().slice(0, 300)
  const state = action === 'warn' ? 'warned' : action === 'block' ? 'blocked' : 'open'
  const [saved] = await rows(sql`INSERT INTO goal_flags (user_id, user_name, state, warns, note, updated_by)
    VALUES (${key}, ${name}, ${state}, ${action === 'warn' ? 1 : 0}, ${text}, ${by.slice(0, 60)})
    ON CONFLICT (user_id) DO UPDATE SET user_name = EXCLUDED.user_name,
      state = CASE WHEN ${action} = 'warn' AND goal_flags.state = 'blocked' THEN 'blocked' ELSE EXCLUDED.state END,
      warns = goal_flags.warns + EXCLUDED.warns,
      note = CASE WHEN EXCLUDED.note = '' THEN goal_flags.note ELSE EXCLUDED.note END,
      updated_by = EXCLUDED.updated_by, updated_at = now()
    RETURNING state, warns`)
  return { userName: name, warns: Number(saved.warns), state: flagOf(saved.state) }
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

export function goalSummaryText(s: GoalSettleSummary) {
  if (s.picks === 0) return 'Maç sonuçlandı; katılan üye yoktu.'
  const head = `${s.picks} katılım hesaplandı, ${s.winners} üye toplam ${goalAmount(s.total, s.unit)}`
  if (s.sponsor) return `${head} hak etti. Kuponları kontrol et, geçerli olanları teslim et.`
  if (s.failed > 0) return `${head} kazandı. ${s.failed} ödeme YAZILAMADI: maçın katılımcı listesini aç ve yeniden dene.`
  if (s.waiting > 0) return `${head} kazandı. ${s.waiting} üyenin ödülü, etkinliğin şartını maç günü tamamlayınca yatacak; tamamlamayanınki verilmez.`
  return `${head} kazandı ve ödüller yatırıldı.`
}

export type { GoalSide }
