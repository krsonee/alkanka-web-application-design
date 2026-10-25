import 'server-only'
import { rows, sql } from '@/lib/db'

export type DashPreset = 'today' | 'yesterday' | '7' | '30' | 'month' | 'lastmonth' | 'custom'
export type DashQuery = { preset: DashPreset; from?: string; to?: string }

const PRESETS: DashPreset[] = ['today', 'yesterday', '7', '30', 'month', 'lastmonth', 'custom']
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const DAY = 86_400_000
const IST_OFFSET = 3 * 3_600_000

const istDate = (ms: number) => new Date(ms + IST_OFFSET).toISOString().slice(0, 10)
const dayStart = (d: string) => new Date(`${d}T00:00:00+03:00`).getTime()
const addDays = (d: string, n: number) => istDate(dayStart(d) + n * DAY)
const trDate = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}`

export function parseQuery(p: { r?: string; from?: string; to?: string }): DashQuery {
  const legacy: Record<string, DashPreset> = { '1': 'today', '7': '7', '30': '30' }
  const preset = (PRESETS as string[]).includes(p.r ?? '') ? (p.r as DashPreset) : (legacy[p.r ?? ''] ?? 'today')
  if (preset === 'custom') {
    if (p.from && DATE_RE.test(p.from) && (!p.to || DATE_RE.test(p.to))) return { preset, from: p.from, to: p.to ?? p.from }
    return { preset: 'today' }
  }
  return { preset }
}

function resolve(q: DashQuery, now: number) {
  const today = istDate(now)
  const monthStart = `${today.slice(0, 8)}01`
  let from = today
  let to = today
  switch (q.preset) {
    case 'yesterday':
      from = to = addDays(today, -1)
      break
    case '7':
      from = addDays(today, -6)
      break
    case '30':
      from = addDays(today, -29)
      break
    case 'month':
      from = monthStart
      break
    case 'lastmonth': {
      to = addDays(monthStart, -1)
      from = `${to.slice(0, 8)}01`
      break
    }
    case 'custom': {
      from = q.from ?? today
      to = q.to ?? from
      if (from > to) [from, to] = [to, from]
      if (to > today) to = today
      if (from > to) from = to
      if (dayStart(to) - dayStart(from) > 365 * DAY) from = addDays(to, -365)
      break
    }
  }
  const days = Math.round((dayStart(to) - dayStart(from)) / DAY) + 1
  const fromMs = dayStart(from)
  const toMs = Math.min(dayStart(to) + DAY, now)
  const span = toMs - fromMs

  const titles: Record<DashPreset, string> = {
    today: 'Bugünün özeti',
    yesterday: 'Dünün özeti',
    '7': 'Son 7 günün özeti',
    '30': 'Son 30 günün özeti',
    month: 'Bu ayın özeti',
    lastmonth: 'Geçen ayın özeti',
    custom: from === to ? `${trDate(from)} özeti` : `${trDate(from)} – ${trDate(to)}`,
  }
  return {
    today,
    from,
    to,
    days,
    fromMs,
    toMs,
    prevFromMs: fromMs - span,
    prevToMs: fromMs,
    live: to === today,
    title: titles[q.preset],
    compare: q.preset === 'today' ? 'dün bu saate kadar' : days === 1 ? 'bir önceki gün' : `önceki ${days} gün`,
  }
}

type Pair = { cur: number; prev: number }
export type HealthItem = { label: string; state: 'ok' | 'warn' | 'off'; note: string }
export type SeriesPoint = {
  key: string
  date: string
  label: string
  users: number
  clicks: number
  games: number
  pUsers: number
  pClicks: number
  pGames: number
  future: boolean
}
export type DashStats = {
  query: DashQuery
  from: string
  to: string
  today: string
  dataStart: string
  days: number
  title: string
  compare: string
  hasPrev: boolean
  live: boolean
  generatedAt: string
  online: number
  onlineHour: number
  newUsers: Pair
  activeMembers: Pair
  sponsorClicks: Pair
  kcOut: Pair
  games: Pair
  series: SeriesPoint[]
  seriesUnit: 'hour' | 'day' | 'week'
  topSponsors: { name: string; clicks: number }[]
  origins: { label: string; count: number }[]
  heatmap: { grid: number[][]; label: string }
  retention: { cohort: number; d1Eligible: number; d1: number; d7Eligible: number; d7: number }
  signups: { name: string; src: string; at: string; earned: number }[]
  kcSources: { label: string; amount: number }[]
  kcSpent: number
  houseNet: number
  circulation: { total: number; holders: number }
  rewardEarners: { name: string; amount: number }[]
  gameWinners: { name: string; amount: number }[]
  anomalies: { name: string; amount: number; at: string }[]
  gameModes: { mode: string; count: number; stake: number }[]
  topGames: { game: string; count: number }[]
  health: HealthItem[]
}

const GAME_MODES = ['bot', 'pvp', 'masa']
const SOURCE_LABELS: Record<string, string> = {
  odul: 'Mini oyun ödülleri',
  cember: 'Jako Çemberi',
  online: 'Çevrimiçi ödülü',
  kankatv: 'Kanka TV',
  gorev: 'Görevler',
  giris: 'Günlük giriş',
  rozet: 'Rozetler',
}
const MODE_LABELS: Record<string, string> = { bot: 'Bota karşı', pvp: 'Rakibe karşı', masa: 'Canlı masa' }
export const ORIGIN_LABELS: Record<string, string> = {
  direkt: 'Direkt giriş',
  'eski-uye': 'Eski üye',
  davet: 'Davet linki',
  ref: 'Davet linki',
  telegram: 'Telegram',
  tg: 'Telegram',
  sponsor: 'Sponsor',
  instagram: 'Instagram',
  twitter: 'X / Twitter',
  x: 'X / Twitter',
  youtube: 'YouTube',
  tiktok: 'TikTok',
  google: 'Google',
  bilinmiyor: 'Bilinmiyor',
}
export const originLabel = (src: string) => ORIGIN_LABELS[src] ?? src.charAt(0).toLocaleUpperCase('tr-TR') + src.slice(1)

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn()
  } catch (error) {
    console.error('[panel:stats]', error)
    return fallback
  }
}

const num = (v: unknown) => Number(v ?? 0) || 0

async function pair(cur: ReturnType<typeof sql>, prev: ReturnType<typeof sql>): Promise<Pair> {
  return safe(async () => {
    const [a, b] = await Promise.all([rows<{ c: string }>(cur), rows<{ c: string }>(prev)])
    return { cur: num(a[0]?.c), prev: num(b[0]?.c) }
  }, { cur: 0, prev: 0 })
}

export async function dashStats(query: DashQuery): Promise<DashStats> {
  const now = Date.now()
  const r = resolve(query, now)
  const ts = (ms: number) => sql`${new Date(ms).toISOString()}::timestamptz`
  const from = ts(r.fromMs)
  const to = ts(r.toMs)
  const pFrom = ts(r.prevFromMs)
  const pTo = ts(r.prevToMs)
  const inRange = (col: ReturnType<typeof sql>) => sql`${col} >= ${from} AND ${col} < ${to}`
  const inPrev = (col: ReturnType<typeof sql>) => sql`${col} >= ${pFrom} AND ${col} < ${pTo}`

  const dataStartMs = await safe(async () => {
    const x = (await rows<{ m: string | null }>(sql`SELECT min("createdAt") AS m FROM "user"`))[0]?.m
    return x ? new Date(x).getTime() : now
  }, now)
  const dataStart = istDate(dataStartMs)
  const hasPrev = r.prevToMs > dataStartMs

  const [online, onlineHour, newUsers, activeMembers, sponsorClicks, kcOut, games] = await Promise.all([
    safe(async () => num((await rows<{ c: string }>(sql`SELECT count(*) AS c FROM online_sessions WHERE last_seen > now() - interval '5 minutes'`))[0]?.c), 0),
    safe(async () => num((await rows<{ c: string }>(sql`SELECT count(*) AS c FROM online_sessions WHERE last_seen > now() - interval '1 hour'`))[0]?.c), 0),
    pair(sql`SELECT count(*) AS c FROM "user" WHERE ${inRange(sql`"createdAt"`)}`, sql`SELECT count(*) AS c FROM "user" WHERE ${inPrev(sql`"createdAt"`)}`),
    pair(
      sql`SELECT count(DISTINCT user_id) AS c FROM kp_events WHERE ${inRange(sql`created_at`)}`,
      sql`SELECT count(DISTINCT user_id) AS c FROM kp_events WHERE ${inPrev(sql`created_at`)}`,
    ),
    pair(
      sql`SELECT (SELECT count(*) FROM link_clicks WHERE ${inRange(sql`created_at`)}) + (SELECT count(*) FROM aff_clicks WHERE ${inRange(sql`created_at`)}) AS c`,
      sql`SELECT (SELECT count(*) FROM link_clicks WHERE ${inPrev(sql`created_at`)}) + (SELECT count(*) FROM aff_clicks WHERE ${inPrev(sql`created_at`)}) AS c`,
    ),
    pair(
      sql`SELECT coalesce((SELECT sum(coins) FROM kp_events WHERE coins > 0 AND ${inRange(sql`created_at`)}), 0) + coalesce((SELECT sum(delta) FROM game_history WHERE mode = 'odul' AND delta > 0 AND ${inRange(sql`created_at`)}), 0) AS c`,
      sql`SELECT coalesce((SELECT sum(coins) FROM kp_events WHERE coins > 0 AND ${inPrev(sql`created_at`)}), 0) + coalesce((SELECT sum(delta) FROM game_history WHERE mode = 'odul' AND delta > 0 AND ${inPrev(sql`created_at`)}), 0) AS c`,
    ),
    pair(
      sql`SELECT count(*) AS c FROM game_history WHERE mode IN ('bot','pvp','masa') AND ${inRange(sql`created_at`)}`,
      sql`SELECT count(*) AS c FROM game_history WHERE mode IN ('bot','pvp','masa') AND ${inPrev(sql`created_at`)}`,
    ),
  ])

  const seriesUnit: DashStats['seriesUnit'] = r.days === 1 ? 'hour' : r.days <= 62 ? 'day' : 'week'
  // The chart starts on the first day the site has data, so a fresh site doesn't show a long flat zero line.
  const seriesFrom = r.days > 1 && dataStart > r.from && dataStart <= r.to ? dataStart : r.from
  const heatFromMs = r.days < 7 ? r.toMs - 28 * DAY : r.fromMs

  const [
    series,
    topSponsors,
    origins,
    heatmap,
    retention,
    signups,
    kcSources,
    kcSpent,
    houseNet,
    circulation,
    rewardEarners,
    gameWinners,
    anomalies,
    gameModes,
    topGames,
    health,
  ] = await Promise.all([
    safe(async () => {
      const unit = seriesUnit
      const step = `1 ${unit}`
      const startLocal = `${seriesFrom} 00:00:00`
      const endLocal = unit === 'hour' ? `${r.to} 23:00:00` : `${r.to} 00:00:00`
      const endExclusive = `${addDays(r.to, 1)} 00:00:00`
      const shift = sql`make_interval(days => ${r.days}::int)`
      const tz = sql`'Europe/Istanbul'`
      const res = await rows<Record<string, string> & { future: boolean }>(sql`
        WITH g AS (
          SELECT t FROM generate_series(date_trunc(${unit}, ${startLocal}::timestamp), date_trunc(${unit}, ${endLocal}::timestamp), ${step}::interval) t
        ), b AS (
          SELECT g.t,
            (greatest(g.t, ${startLocal}::timestamp) AT TIME ZONE ${tz}) AS s,
            (least(g.t + ${step}::interval, ${endExclusive}::timestamp) AT TIME ZONE ${tz}) AS e
          FROM g
        )
        SELECT to_char(b.t, 'YYYY-MM-DD"T"HH24') AS key,
          b.s > now() AS future,
          (SELECT count(*) FROM "user" u WHERE u."createdAt" >= b.s AND u."createdAt" < b.e) AS users,
          (SELECT count(*) FROM link_clicks l WHERE l.created_at >= b.s AND l.created_at < b.e)
            + (SELECT count(*) FROM aff_clicks a WHERE a.created_at >= b.s AND a.created_at < b.e) AS clicks,
          (SELECT count(*) FROM game_history x WHERE x.mode IN ('bot','pvp','masa') AND x.created_at >= b.s AND x.created_at < b.e) AS games,
          (SELECT count(*) FROM "user" u WHERE u."createdAt" >= b.s - ${shift} AND u."createdAt" < b.e - ${shift}) AS p_users,
          (SELECT count(*) FROM link_clicks l WHERE l.created_at >= b.s - ${shift} AND l.created_at < b.e - ${shift})
            + (SELECT count(*) FROM aff_clicks a WHERE a.created_at >= b.s - ${shift} AND a.created_at < b.e - ${shift}) AS p_clicks,
          (SELECT count(*) FROM game_history x WHERE x.mode IN ('bot','pvp','masa') AND x.created_at >= b.s - ${shift} AND x.created_at < b.e - ${shift}) AS p_games
        FROM b ORDER BY b.t`)
      return res.map((x) => {
        const date = x.key.slice(0, 10)
        const label = unit === 'hour' ? `${x.key.slice(11, 13)}:00` : `${date.slice(8, 10)}.${date.slice(5, 7)}`
        return {
          key: x.key,
          date,
          label,
          users: num(x.users),
          clicks: num(x.clicks),
          games: num(x.games),
          pUsers: num(x.p_users),
          pClicks: num(x.p_clicks),
          pGames: num(x.p_games),
          future: Boolean(x.future),
        }
      })
    }, [] as SeriesPoint[]),
    safe(async () => {
      const res = await rows<{ name: string; clicks: string }>(sql`
        SELECT name, sum(n) AS clicks FROM (
          SELECT coalesce(s.name, 'Silinmiş sponsor #' || l.site_id) AS name, count(*) AS n
          FROM link_clicks l LEFT JOIN sites s ON s.id::text = l.site_id OR s.slug = l.site_id
          WHERE ${inRange(sql`l.created_at`)} GROUP BY 1
          UNION ALL
          SELECT coalesce(s.name, al.label, al.code) AS name, count(*) AS n
          FROM aff_clicks c JOIN aff_links al ON al.id = c.link_id LEFT JOIN sites s ON s.id = al.site_id
          WHERE ${inRange(sql`c.created_at`)} GROUP BY 1
        ) t GROUP BY name ORDER BY clicks DESC LIMIT 6`)
      return res.map((x) => ({ name: x.name, clicks: num(x.clicks) }))
    }, []),
    safe(async () => {
      const res = await rows<{ src: string; c: string }>(sql`
        SELECT coalesce(mo.src, 'bilinmiyor') AS src, count(*) AS c
        FROM "user" u LEFT JOIN member_origin mo ON mo.user_id = u.id
        WHERE ${inRange(sql`u."createdAt"`)} GROUP BY 1 ORDER BY c DESC`)
      const merged = new Map<string, number>()
      for (const x of res) merged.set(originLabel(x.src), (merged.get(originLabel(x.src)) ?? 0) + num(x.c))
      return [...merged].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count)
    }, []),
    safe(async () => {
      const a = ts(heatFromMs)
      const res = await rows<{ d: number; h: number; c: string }>(sql`
        SELECT extract(isodow FROM t AT TIME ZONE 'Europe/Istanbul')::int AS d,
               extract(hour FROM t AT TIME ZONE 'Europe/Istanbul')::int AS h, count(*) AS c
        FROM (
          SELECT created_at AS t FROM kp_events WHERE created_at >= ${a} AND created_at < ${to}
          UNION ALL SELECT created_at FROM game_history WHERE created_at >= ${a} AND created_at < ${to}
          UNION ALL SELECT created_at FROM link_clicks WHERE created_at >= ${a} AND created_at < ${to}
          UNION ALL SELECT created_at FROM aff_clicks WHERE created_at >= ${a} AND created_at < ${to}
        ) x GROUP BY 1, 2`)
      const grid = Array.from({ length: 7 }, () => Array<number>(24).fill(0))
      for (const x of res) grid[num(x.d) - 1][num(x.h)] = num(x.c)
      return { grid, label: r.days < 7 ? 'Son 28 gün' : 'Seçili aralık' }
    }, { grid: Array.from({ length: 7 }, () => Array<number>(24).fill(0)), label: '' }),
    safe(async () => {
      const x = (
        await rows<Record<string, string>>(sql`
          WITH c AS (SELECT id, "createdAt" AS ca FROM "user" WHERE ${inRange(sql`"createdAt"`)})
          SELECT count(*) AS cohort,
            count(*) FILTER (WHERE ca <= now() - interval '1 day') AS e1,
            count(*) FILTER (WHERE ca <= now() - interval '1 day' AND (
              EXISTS (SELECT 1 FROM kp_events k WHERE k.user_id = c.id AND k.created_at >= c.ca + interval '1 day')
              OR EXISTS (SELECT 1 FROM game_history g WHERE g.user_id = c.id AND g.created_at >= c.ca + interval '1 day'))) AS r1,
            count(*) FILTER (WHERE ca <= now() - interval '7 days') AS e7,
            count(*) FILTER (WHERE ca <= now() - interval '7 days' AND (
              EXISTS (SELECT 1 FROM kp_events k WHERE k.user_id = c.id AND k.created_at >= c.ca + interval '7 days')
              OR EXISTS (SELECT 1 FROM game_history g WHERE g.user_id = c.id AND g.created_at >= c.ca + interval '7 days'))) AS r7
          FROM c`)
      )[0]
      return { cohort: num(x?.cohort), d1Eligible: num(x?.e1), d1: num(x?.r1), d7Eligible: num(x?.e7), d7: num(x?.r7) }
    }, { cohort: 0, d1Eligible: 0, d1: 0, d7Eligible: 0, d7: 0 }),
    safe(async () => {
      const res = await rows<{ name: string; src: string | null; at: string; earned: string }>(sql`
        SELECT coalesce(u.name, u.email) AS name, mo.src, u."createdAt" AS at,
          coalesce((SELECT sum(coins) FROM kp_events k WHERE k.user_id = u.id AND k.coins > 0), 0)
            + coalesce((SELECT sum(delta) FROM game_history g WHERE g.user_id = u.id AND g.mode = 'odul' AND g.delta > 0), 0) AS earned
        FROM "user" u LEFT JOIN member_origin mo ON mo.user_id = u.id
        WHERE ${inRange(sql`u."createdAt"`)} ORDER BY u."createdAt" DESC LIMIT 8`)
      return res.map((x) => ({ name: x.name, src: originLabel(x.src ?? 'bilinmiyor'), at: new Date(x.at).toISOString(), earned: num(x.earned) }))
    }, []),
    safe(async () => {
      const res = await rows<{ src: string; amount: string }>(sql`
        SELECT src, sum(amount) AS amount FROM (
          SELECT source AS src, coins AS amount FROM kp_events WHERE coins > 0 AND ${inRange(sql`created_at`)}
          UNION ALL
          SELECT 'odul' AS src, delta AS amount FROM game_history WHERE mode = 'odul' AND delta > 0 AND ${inRange(sql`created_at`)}
        ) t GROUP BY src ORDER BY amount DESC LIMIT 6`)
      return res.map((x) => ({ label: SOURCE_LABELS[x.src] ?? x.src, amount: num(x.amount) }))
    }, []),
    safe(async () => num((await rows<{ c: string }>(sql`SELECT coalesce(-sum(delta), 0) AS c FROM game_history WHERE mode = 'harcama' AND ${inRange(sql`created_at`)}`))[0]?.c), 0),
    safe(async () => num((await rows<{ c: string }>(sql`SELECT coalesce(-sum(delta), 0) AS c FROM game_history WHERE mode IN ('bot','pvp','masa') AND ${inRange(sql`created_at`)}`))[0]?.c), 0),
    safe(async () => {
      const x = (await rows<{ t: string; h: string }>(sql`SELECT coalesce(sum(balance), 0) AS t, count(*) FILTER (WHERE balance > 0) AS h FROM wallets`))[0]
      return { total: num(x?.t), holders: num(x?.h) }
    }, { total: 0, holders: 0 }),
    safe(async () => {
      const res = await rows<{ name: string; amount: string }>(sql`
        SELECT coalesce(u.name, u.email, t.user_id) AS name, sum(t.amount) AS amount FROM (
          SELECT user_id, coins AS amount FROM kp_events WHERE coins > 0 AND ${inRange(sql`created_at`)}
          UNION ALL
          SELECT user_id, delta AS amount FROM game_history WHERE mode = 'odul' AND delta > 0 AND ${inRange(sql`created_at`)}
        ) t LEFT JOIN "user" u ON u.id = t.user_id
        GROUP BY 1 ORDER BY amount DESC LIMIT 5`)
      return res.map((x) => ({ name: x.name, amount: num(x.amount) }))
    }, []),
    safe(async () => {
      const res = await rows<{ name: string; amount: string }>(sql`
        SELECT coalesce(u.name, u.email, g.user_id) AS name, sum(g.delta) AS amount
        FROM game_history g LEFT JOIN "user" u ON u.id = g.user_id
        WHERE g.mode IN ('bot','pvp','masa') AND ${inRange(sql`g.created_at`)}
        GROUP BY 1 HAVING sum(g.delta) > 0 ORDER BY amount DESC LIMIT 5`)
      return res.map((x) => ({ name: x.name, amount: num(x.amount) }))
    }, []),
    safe(async () => {
      const res = await rows<{ name: string; amount: string; at: string }>(sql`
        SELECT coalesce(u.name, u.email, t.user_id) AS name, sum(t.amount) AS amount, date_trunc('hour', t.created_at) AS at FROM (
          SELECT user_id, coins AS amount, created_at FROM kp_events WHERE coins > 0 AND ${inRange(sql`created_at`)}
          UNION ALL
          SELECT user_id, delta AS amount, created_at FROM game_history WHERE delta > 0 AND ${inRange(sql`created_at`)}
        ) t LEFT JOIN "user" u ON u.id = t.user_id
        GROUP BY 1, 3 HAVING sum(t.amount) >= 2000 ORDER BY amount DESC LIMIT 5`)
      return res.map((x) => ({ name: x.name, amount: num(x.amount), at: new Date(x.at).toISOString() }))
    }, []),
    safe(async () => {
      const res = await rows<{ mode: string; count: string; stake: string }>(sql`
        SELECT mode, count(*) AS count, coalesce(sum(stake), 0) AS stake FROM game_history
        WHERE mode IN ('bot','pvp','masa') AND ${inRange(sql`created_at`)} GROUP BY mode`)
      return GAME_MODES.map((m) => {
        const x = res.find((y) => y.mode === m)
        return { mode: MODE_LABELS[m], count: num(x?.count), stake: num(x?.stake) }
      })
    }, GAME_MODES.map((m) => ({ mode: MODE_LABELS[m], count: 0, stake: 0 }))),
    safe(async () => {
      const res = await rows<{ game: string; count: string }>(sql`
        SELECT game, count(*) AS count FROM game_history WHERE mode IN ('bot','pvp','masa') AND ${inRange(sql`created_at`)}
        GROUP BY game ORDER BY count DESC LIMIT 4`)
      return res.map((x) => ({ game: x.game, count: num(x.count) }))
    }, []),
    systemHealth(),
  ])

  return {
    query,
    from: r.from,
    to: r.to,
    today: r.today,
    dataStart,
    days: r.days,
    title: r.title,
    compare: r.compare,
    hasPrev,
    live: r.live,
    generatedAt: new Date(now).toISOString(),
    online,
    onlineHour,
    newUsers,
    activeMembers,
    sponsorClicks,
    kcOut,
    games,
    series,
    seriesUnit,
    topSponsors,
    origins,
    heatmap,
    retention,
    signups,
    kcSources,
    kcSpent,
    houseNet,
    circulation,
    rewardEarners,
    gameWinners,
    anomalies,
    gameModes,
    topGames,
    health,
  }
}

async function systemHealth(): Promise<HealthItem[]> {
  const db = await safe(async () => (await rows(sql`SELECT 1`), true), false)
  if (!db) return [{ label: 'Veritabanı', state: 'warn', note: 'Bağlantı kurulamadı' }]

  const [bots, sources, odds, push, share] = await Promise.all([
    safe(async () => num((await rows<{ c: string }>(sql`SELECT count(*) AS c FROM tg_bots`))[0]?.c), 0),
    safe(async () => (await rows<{ n: string; e: string }>(sql`SELECT count(*) AS n, count(last_error) AS e FROM tg_sources WHERE active`))[0], undefined),
    safe(async () => (await rows<{ n: string; e: string }>(sql`SELECT count(*) AS n, count(nullif(web_error, '')) AS e FROM odds_sources WHERE active`))[0], undefined),
    safe(async () => (await rows<{ sent: number; failed: number; created_at: string }>(sql`SELECT sent, failed, created_at FROM push_log ORDER BY id DESC LIMIT 1`))[0], undefined),
    safe(async () => (await rows<{ n: string; e: string }>(sql`SELECT count(*) AS n, count(*) FILTER (WHERE status <> 'ok' AND status <> 'sent') AS e FROM tg_share_log WHERE created_at > now() - interval '1 day'`))[0], undefined),
  ])

  const items: HealthItem[] = [{ label: 'Veritabanı', state: 'ok', note: 'Bağlı' }]
  items.push(bots > 0 ? { label: 'Telegram botları', state: 'ok', note: `${bots} bot bağlı` } : { label: 'Telegram botları', state: 'off', note: 'Bot eklenmemiş' })

  const sN = num(sources?.n)
  const sE = num(sources?.e)
  items.push(
    sN === 0
      ? { label: 'Kanal aynalama', state: 'off', note: 'Aktif kaynak yok' }
      : sE > 0
        ? { label: 'Kanal aynalama', state: 'warn', note: `${sE}/${sN} kaynakta hata` }
        : { label: 'Kanal aynalama', state: 'ok', note: `${sN} kaynak çalışıyor` },
  )

  const oN = num(odds?.n)
  const oE = num(odds?.e)
  items.push(
    oN === 0
      ? { label: 'Oran botu', state: 'off', note: 'Aktif kaynak yok' }
      : oE > 0
        ? { label: 'Oran botu', state: 'warn', note: `${oE}/${oN} kaynakta hata` }
        : { label: 'Oran botu', state: 'ok', note: `${oN} kaynak çalışıyor` },
  )

  if (!push) items.push({ label: 'Bildirimler', state: 'off', note: 'Henüz gönderim yok' })
  else {
    const total = num(push.sent) + num(push.failed)
    const ratio = total ? num(push.failed) / total : 0
    items.push({
      label: 'Bildirimler',
      state: ratio > 0.3 ? 'warn' : 'ok',
      note: `Son gönderim: ${num(push.sent)} ulaştı, ${num(push.failed)} hata`,
    })
  }

  const shN = num(share?.n)
  const shE = num(share?.e)
  if (shN > 0) items.push({ label: 'Telegram paylaşımları', state: shE > 0 ? 'warn' : 'ok', note: shE > 0 ? `24 saatte ${shE} hata` : `24 saatte ${shN} paylaşım` })

  return items
}
