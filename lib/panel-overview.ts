import 'server-only'
import { CATALOG_KEYS, mergeCatalog, predictionClosesAt } from '@/lib/catalog-shared'
import { rows, sql } from '@/lib/db'
import { HIDDEN_KEY, readHidden, withoutHidden } from '@/lib/hidden-shared'

type Fragment = ReturnType<typeof sql>

export type TelegramLane = { label: string; sent: number; failed: number }

export type DashExtras = {
  /** Support tickets nobody has closed yet. */
  tickets: number
  sponsor: {
    /** Members who linked a sponsor account in the range, and how many of those were approved. */
    accounts: number
    approved: number
    bestSource: { label: string; clicks: number } | null
  }
  agenda: {
    tournaments: { open: number; live: number; endingToday: number }
    events: { live: number; endingToday: number }
    predictions: { open: number; closingToday: number; waiting: number }
  }
  /** Always today (Istanbul), whatever range is selected. */
  telegram: { lanes: TelegramLane[]; scheduled: number; lastError: string | null }
  studio: { month: number; cap: number | null } | null
  shortLinks: { clicks: number; unique: number; links: number; top: { label: string; clicks: number } | null }
}

export const EMPTY_EXTRAS: DashExtras = {
  tickets: 0,
  sponsor: { accounts: 0, approved: 0, bestSource: null },
  agenda: { tournaments: { open: 0, live: 0, endingToday: 0 }, events: { live: 0, endingToday: 0 }, predictions: { open: 0, closingToday: 0, waiting: 0 } },
  telegram: { lanes: [], scheduled: 0, lastError: null },
  studio: null,
  shortLinks: { clicks: 0, unique: 0, links: 0, top: null },
}

const IST_OFFSET = 3 * 3_600_000
const istDay = (ms: number) => new Date(ms + IST_OFFSET).toISOString().slice(0, 10)
const num = (v: unknown) => Number(v ?? 0) || 0

/** A table that was never created (its module never opened) reads as "nothing there", not as an error. */
async function quiet<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn()
  } catch {
    return fallback
  }
}

type Dated = { startsAt?: string; endsAt?: string; hoursLeft?: number }
type Closing = { closesAt?: string; kickoffAt?: string }

/** Events and catalog predictions counted from the stored catalog; `now` is passed in so it can be tested. */
export function catalogAgenda(events: Dated[], predictions: Closing[], now: number) {
  const today = istDay(now)
  let live = 0
  let endingToday = 0
  for (const e of events) {
    const start = e.startsAt ? Date.parse(e.startsAt) : NaN
    const end = e.endsAt ? Date.parse(e.endsAt) : NaN
    if (Number.isFinite(start) && start > now) continue
    // An event without an end date counts by its stored hours, as the site does.
    if (Number.isFinite(end) ? end <= now : !(Number(e.hoursLeft) > 0)) continue
    live++
    if (Number.isFinite(end) && istDay(end) === today) endingToday++
  }
  let open = 0
  let closingToday = 0
  for (const p of predictions) {
    const closes = predictionClosesAt({ closesAt: p.closesAt ?? '', kickoffAt: p.kickoffAt ?? '' })
    if (closes !== null && closes <= now) continue
    open++
    if (closes !== null && istDay(closes) === today) closingToday++
  }
  return { events: { live, endingToday }, predictions: { open, closingToday } }
}

export async function dashExtras(range: { from: Fragment; to: Fragment }, now = Date.now()): Promise<DashExtras> {
  const inRange = (col: Fragment) => sql`${col} >= ${range.from} AND ${col} < ${range.to}`
  const dayStart = sql`(date_trunc('day', now() AT TIME ZONE 'Europe/Istanbul') AT TIME ZONE 'Europe/Istanbul')`
  const today = (col: Fragment) => sql`${col} >= ${dayStart} AND ${col} < ${dayStart} + interval '1 day'`

  const [tickets, accounts, sources, tournaments, catalog, league, posts, mirror, share, dms, scheduled, lastError, studio, shortLinks, topLink] = await Promise.all([
    quiet(async () => num((await rows<{ c: string }>(sql`SELECT count(*) AS c FROM tg_tickets WHERE status IN ('open','claimed')`))[0]?.c), 0),
    quiet(
      async () =>
        (await rows<{ n: string; ok: string }>(sql`SELECT count(*) AS n, count(*) FILTER (WHERE status = 'approved') AS ok FROM sponsor_accounts WHERE ${inRange(sql`created_at`)}`))[0],
      undefined,
    ),
    quiet(
      () =>
        rows<{ src: string; c: string }>(sql`
          SELECT src, sum(n) AS c FROM (
            SELECT src, count(*) AS n FROM link_clicks WHERE ${inRange(sql`created_at`)} GROUP BY src
            UNION ALL
            SELECT src, count(*) AS n FROM aff_clicks WHERE ${inRange(sql`created_at`)} GROUP BY src
          ) t GROUP BY src ORDER BY c DESC LIMIT 1`),
      [],
    ),
    quiet(
      async () =>
        (
          await rows<{ open: string; live: string; ending: string }>(sql`
            SELECT count(*) FILTER (WHERE status = 'kayit') AS open,
              count(*) FILTER (WHERE status = 'basladi') AS live,
              count(*) FILTER (WHERE status IN ('kayit','basladi') AND ${today(sql`ends_at`)}) AS ending
            FROM tournaments`)
        )[0],
      undefined,
    ),
    quiet(async () => {
      const res = await rows<{ key: string; value: unknown }>(
        sql`SELECT key, value FROM site_content WHERE key IN (${CATALOG_KEYS.events}, ${CATALOG_KEYS.predictions}, ${HIDDEN_KEY})`,
      )
      const all = Object.fromEntries(res.map((x) => [x.key, x.value]))
      const merged = mergeCatalog(all)
      const hidden = readHidden(all[HIDDEN_KEY])
      return catalogAgenda(withoutHidden(merged.events, hidden, 'event'), withoutHidden(merged.predictions, hidden, 'prediction'), now)
    }, catalogAgenda([], [], now)),
    quiet(
      async () =>
        (
          await rows<{ open: string; closing: string; waiting: string }>(sql`
            SELECT count(*) FILTER (WHERE NOT settled AND coalesce(closes_at, kickoff) > now()) AS open,
              count(*) FILTER (WHERE NOT settled AND coalesce(closes_at, kickoff) > now() AND ${today(sql`coalesce(closes_at, kickoff)`)}) AS closing,
              count(*) FILTER (WHERE NOT settled AND kickoff <= now()) AS waiting
            FROM league_matches`)
        )[0],
      undefined,
    ),
    quiet(
      async () =>
        (
          await rows<{ ok: string; bad: string }>(sql`
            SELECT count(*) FILTER (WHERE s.status <> 'failed') AS ok, count(*) FILTER (WHERE s.status = 'failed') AS bad
            FROM tg_post_sends s JOIN tg_posts p ON p.id = s.post_id
            WHERE p.origin = 'panel' AND ${today(sql`s.sent_at`)}`)
        )[0],
      undefined,
    ),
    quiet(
      async () =>
        (
          await rows<{ ok: string; bad: string }>(
            sql`SELECT count(*) FILTER (WHERE status = 'sent') AS ok, count(*) FILTER (WHERE status = 'failed') AS bad FROM tg_log WHERE ${today(sql`created_at`)}`,
          )
        )[0],
      undefined,
    ),
    quiet(
      async () =>
        (
          await rows<{ ok: string; bad: string }>(
            sql`SELECT count(*) FILTER (WHERE status = 'sent') AS ok, count(*) FILTER (WHERE status = 'failed') AS bad FROM tg_share_log WHERE ${today(sql`created_at`)}`,
          )
        )[0],
      undefined,
    ),
    quiet(
      async () =>
        (await rows<{ ok: string; bad: string }>(sql`SELECT coalesce(sum(sent), 0) AS ok, coalesce(sum(failed), 0) AS bad FROM tg_broadcasts WHERE ${today(sql`created_at`)}`))[0],
      undefined,
    ),
    quiet(async () => num((await rows<{ c: string }>(sql`SELECT count(*) AS c FROM tg_post_plans WHERE status = 'waiting' AND ${today(sql`send_at`)} AND send_at > now()`))[0]?.c), 0),
    quiet(
      async () =>
        (
          await rows<{ detail: string | null }>(sql`
            SELECT detail FROM (
              SELECT error AS detail, sent_at AS at FROM tg_post_sends WHERE status = 'failed' AND ${today(sql`sent_at`)}
              UNION ALL SELECT detail, created_at FROM tg_log WHERE status = 'failed' AND ${today(sql`created_at`)}
              UNION ALL SELECT detail, created_at FROM tg_share_log WHERE status = 'failed' AND ${today(sql`created_at`)}
            ) e WHERE detail IS NOT NULL AND detail <> '' ORDER BY at DESC LIMIT 1`)
        )[0]?.detail ?? null,
      null,
    ),
    quiet(async () => {
      const spend = (await rows<{ month: string }>(sql`SELECT coalesce(sum(cost) FILTER (WHERE created_at > (date_trunc('month', now() AT TIME ZONE 'Europe/Istanbul') AT TIME ZONE 'Europe/Istanbul')), 0) AS month FROM studio_jobs`))[0]
      const cap = Number((await rows<{ value: { monthlyCap?: unknown } | null }>(sql`SELECT value FROM site_content WHERE key = 'studio:budget'`))[0]?.value?.monthlyCap)
      return { month: num(spend?.month), cap: Number.isFinite(cap) && cap > 0 ? cap : null }
    }, null),
    quiet(
      async () =>
        (
          await rows<{ clicks: string; uniq: string; links: string }>(
            sql`SELECT count(*) AS clicks, count(DISTINCT coalesce(ip_hash, user_id, id::text)) AS uniq, count(DISTINCT link_id) AS links FROM aff_clicks WHERE ${inRange(sql`created_at`)}`,
          )
        )[0],
      undefined,
    ),
    quiet(
      async () =>
        (
          await rows<{ label: string; c: string }>(sql`
            SELECT coalesce(nullif(l.label, ''), l.code) AS label, count(*) AS c
            FROM aff_clicks c JOIN aff_links l ON l.id = c.link_id
            WHERE ${inRange(sql`c.created_at`)} GROUP BY 1 ORDER BY c DESC LIMIT 1`)
        )[0],
      undefined,
    ),
  ])

  const lane = (label: string, x: { ok: string; bad: string } | undefined): TelegramLane => ({ label, sent: num(x?.ok), failed: num(x?.bad) })
  const lanes = [lane('Panelden gönderilen post', posts), lane('Kanal aktarma', mirror), lane('Post paylaşım', share), lane('DM duyuru', dms)].filter((l) => l.sent + l.failed > 0)

  return {
    tickets,
    sponsor: {
      accounts: num(accounts?.n),
      approved: num(accounts?.ok),
      bestSource: sources[0] ? { label: sources[0].src, clicks: num(sources[0].c) } : null,
    },
    agenda: {
      tournaments: { open: num(tournaments?.open), live: num(tournaments?.live), endingToday: num(tournaments?.ending) },
      events: catalog.events,
      predictions: {
        open: catalog.predictions.open + num(league?.open),
        closingToday: catalog.predictions.closingToday + num(league?.closing),
        waiting: num(league?.waiting),
      },
    },
    telegram: { lanes, scheduled, lastError: lastError ? String(lastError).slice(0, 160) : null },
    studio,
    shortLinks: {
      clicks: num(shortLinks?.clicks),
      unique: num(shortLinks?.uniq),
      links: num(shortLinks?.links),
      top: topLink ? { label: topLink.label, clicks: num(topLink.c) } : null,
    },
  }
}
