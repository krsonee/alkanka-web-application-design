import 'server-only'
import { rows, sql } from '@/lib/db'

export type DashRange = 1 | 7 | 30
export const DASH_RANGES: { value: DashRange; label: string }[] = [
  { value: 1, label: 'Bugün' },
  { value: 7, label: '7 gün' },
  { value: 30, label: '30 gün' },
]

export function parseRange(v: string | undefined): DashRange {
  const n = Number(v)
  return n === 7 || n === 30 ? n : 1
}

type Pair = { cur: number; prev: number }
export type HealthItem = { label: string; state: 'ok' | 'warn' | 'off'; note: string }
export type DashStats = {
  range: DashRange
  online: number
  newUsers: Pair
  activeMembers: Pair
  sponsorClicks: Pair
  kcOut: Pair
  games: Pair
  series: { day: string; users: number; clicks: number; games: number }[]
  topSponsors: { name: string; clicks: number }[]
  kcSources: { label: string; amount: number }[]
  kcSpent: number
  houseNet: number
  topEarners: { name: string; amount: number }[]
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

export async function dashStats(range: DashRange): Promise<DashStats> {
  const d = range
  const from = sql`now() - make_interval(days => ${d}::int)`
  const prevFrom = sql`now() - make_interval(days => ${d * 2}::int)`
  const seriesDays = Math.max(d, 14)

  const [online, newUsers, activeMembers, sponsorClicks, kcOut, games] = await Promise.all([
    safe(async () => num((await rows<{ c: string }>(sql`SELECT count(*) AS c FROM online_sessions WHERE last_seen > now() - interval '5 minutes'`))[0]?.c), 0),
    pair(
      sql`SELECT count(*) AS c FROM "user" WHERE "createdAt" > ${from}`,
      sql`SELECT count(*) AS c FROM "user" WHERE "createdAt" > ${prevFrom} AND "createdAt" <= ${from}`,
    ),
    pair(
      sql`SELECT count(DISTINCT user_id) AS c FROM kp_events WHERE created_at > ${from}`,
      sql`SELECT count(DISTINCT user_id) AS c FROM kp_events WHERE created_at > ${prevFrom} AND created_at <= ${from}`,
    ),
    pair(
      sql`SELECT (SELECT count(*) FROM link_clicks WHERE created_at > ${from}) + (SELECT count(*) FROM aff_clicks WHERE created_at > ${from}) AS c`,
      sql`SELECT (SELECT count(*) FROM link_clicks WHERE created_at > ${prevFrom} AND created_at <= ${from}) + (SELECT count(*) FROM aff_clicks WHERE created_at > ${prevFrom} AND created_at <= ${from}) AS c`,
    ),
    pair(
      sql`SELECT coalesce((SELECT sum(coins) FROM kp_events WHERE coins > 0 AND created_at > ${from}), 0) + coalesce((SELECT sum(delta) FROM game_history WHERE mode = 'odul' AND delta > 0 AND created_at > ${from}), 0) AS c`,
      sql`SELECT coalesce((SELECT sum(coins) FROM kp_events WHERE coins > 0 AND created_at > ${prevFrom} AND created_at <= ${from}), 0) + coalesce((SELECT sum(delta) FROM game_history WHERE mode = 'odul' AND delta > 0 AND created_at > ${prevFrom} AND created_at <= ${from}), 0) AS c`,
    ),
    pair(
      sql`SELECT count(*) AS c FROM game_history WHERE mode IN ('bot','pvp','masa') AND created_at > ${from}`,
      sql`SELECT count(*) AS c FROM game_history WHERE mode IN ('bot','pvp','masa') AND created_at > ${prevFrom} AND created_at <= ${from}`,
    ),
  ])

  const [series, topSponsors, kcSources, kcSpent, houseNet, topEarners, anomalies, gameModes, topGames, health] = await Promise.all([
    safe(async () => {
      const r = await rows<{ day: string; users: string; clicks: string; games: string }>(sql`
        WITH days AS (
          SELECT generate_series((now() AT TIME ZONE 'Europe/Istanbul')::date - (${seriesDays - 1}::int), (now() AT TIME ZONE 'Europe/Istanbul')::date, interval '1 day')::date AS day
        )
        SELECT to_char(days.day, 'YYYY-MM-DD') AS day,
          (SELECT count(*) FROM "user" u WHERE (u."createdAt" AT TIME ZONE 'Europe/Istanbul')::date = days.day) AS users,
          (SELECT count(*) FROM link_clicks l WHERE (l.created_at AT TIME ZONE 'Europe/Istanbul')::date = days.day)
            + (SELECT count(*) FROM aff_clicks a WHERE (a.created_at AT TIME ZONE 'Europe/Istanbul')::date = days.day) AS clicks,
          (SELECT count(*) FROM game_history g WHERE g.mode IN ('bot','pvp','masa') AND (g.created_at AT TIME ZONE 'Europe/Istanbul')::date = days.day) AS games
        FROM days ORDER BY days.day`)
      return r.map((x) => ({ day: x.day, users: num(x.users), clicks: num(x.clicks), games: num(x.games) }))
    }, []),
    safe(async () => {
      const r = await rows<{ name: string; clicks: string }>(sql`
        SELECT name, sum(n) AS clicks FROM (
          SELECT coalesce(s.name, l.site_id) AS name, count(*) AS n
          FROM link_clicks l LEFT JOIN sites s ON s.id::text = l.site_id OR s.slug = l.site_id
          WHERE l.created_at > ${from} GROUP BY 1
          UNION ALL
          SELECT coalesce(s.name, al.label, al.code) AS name, count(*) AS n
          FROM aff_clicks c JOIN aff_links al ON al.id = c.link_id LEFT JOIN sites s ON s.id = al.site_id
          WHERE c.created_at > ${from} GROUP BY 1
        ) t GROUP BY name ORDER BY clicks DESC LIMIT 5`)
      return r.map((x) => ({ name: x.name, clicks: num(x.clicks) }))
    }, []),
    safe(async () => {
      const r = await rows<{ src: string; amount: string }>(sql`
        SELECT src, sum(amount) AS amount FROM (
          SELECT source AS src, coins AS amount FROM kp_events WHERE coins > 0 AND created_at > ${from}
          UNION ALL
          SELECT 'odul' AS src, delta AS amount FROM game_history WHERE mode = 'odul' AND delta > 0 AND created_at > ${from}
        ) t GROUP BY src ORDER BY amount DESC LIMIT 6`)
      return r.map((x) => ({ label: SOURCE_LABELS[x.src] ?? x.src, amount: num(x.amount) }))
    }, []),
    safe(async () => num((await rows<{ c: string }>(sql`SELECT coalesce(-sum(delta), 0) AS c FROM game_history WHERE mode = 'harcama' AND created_at > ${from}`))[0]?.c), 0),
    safe(async () => num((await rows<{ c: string }>(sql`SELECT coalesce(-sum(delta), 0) AS c FROM game_history WHERE mode IN ('bot','pvp','masa') AND created_at > ${from}`))[0]?.c), 0),
    safe(async () => {
      const r = await rows<{ name: string; amount: string }>(sql`
        SELECT coalesce(u.name, u.email, t.user_id) AS name, sum(t.amount) AS amount FROM (
          SELECT user_id, coins AS amount FROM kp_events WHERE coins > 0 AND created_at > ${from}
          UNION ALL
          SELECT user_id, delta AS amount FROM game_history WHERE delta > 0 AND created_at > ${from}
        ) t LEFT JOIN "user" u ON u.id = t.user_id
        GROUP BY 1 ORDER BY amount DESC LIMIT 5`)
      return r.map((x) => ({ name: x.name, amount: num(x.amount) }))
    }, []),
    safe(async () => {
      const r = await rows<{ name: string; amount: string; at: string }>(sql`
        SELECT coalesce(u.name, u.email, t.user_id) AS name, sum(t.amount) AS amount, date_trunc('hour', t.created_at) AS at FROM (
          SELECT user_id, coins AS amount, created_at FROM kp_events WHERE coins > 0 AND created_at > ${from}
          UNION ALL
          SELECT user_id, delta AS amount, created_at FROM game_history WHERE delta > 0 AND created_at > ${from}
        ) t LEFT JOIN "user" u ON u.id = t.user_id
        GROUP BY 1, 3 HAVING sum(t.amount) >= 2000 ORDER BY amount DESC LIMIT 5`)
      return r.map((x) => ({ name: x.name, amount: num(x.amount), at: new Date(x.at).toISOString() }))
    }, []),
    safe(async () => {
      const r = await rows<{ mode: string; count: string; stake: string }>(sql`
        SELECT mode, count(*) AS count, coalesce(sum(stake), 0) AS stake FROM game_history
        WHERE mode IN ('bot','pvp','masa') AND created_at > ${from} GROUP BY mode`)
      return GAME_MODES.map((m) => {
        const x = r.find((y) => y.mode === m)
        return { mode: MODE_LABELS[m], count: num(x?.count), stake: num(x?.stake) }
      })
    }, GAME_MODES.map((m) => ({ mode: MODE_LABELS[m], count: 0, stake: 0 }))),
    safe(async () => {
      const r = await rows<{ game: string; count: string }>(sql`
        SELECT game, count(*) AS count FROM game_history WHERE mode IN ('bot','pvp','masa') AND created_at > ${from}
        GROUP BY game ORDER BY count DESC LIMIT 4`)
      return r.map((x) => ({ game: x.game, count: num(x.count) }))
    }, []),
    systemHealth(),
  ])

  return { range, online, newUsers, activeMembers, sponsorClicks, kcOut, games, series, topSponsors, kcSources, kcSpent, houseNet, topEarners, anomalies, gameModes, topGames, health }
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
