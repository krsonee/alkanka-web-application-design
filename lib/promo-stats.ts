import { rows, sql } from '@/lib/db'

export type PromoKind = 'slide' | 'ad'
export type PromoEvent = 'view' | 'click'
export type PromoTotals = Record<string, { views: number; clicks: number }>

let ready: Promise<unknown> | null = null

function ensureTable() {
  ready ??= rows(sql`
    create table if not exists promo_stats (
      kind text not null,
      ref text not null,
      day date not null,
      views integer not null default 0,
      clicks integer not null default 0,
      primary key (kind, ref, day)
    )
  `).catch((e) => {
    ready = null
    throw e
  })
  return ready
}

export async function recordPromo(kind: PromoKind, ref: string, event: PromoEvent) {
  await ensureTable()
  const views = event === 'view' ? 1 : 0
  const clicks = event === 'click' ? 1 : 0
  await rows(sql`
    insert into promo_stats (kind, ref, day, views, clicks)
    values (${kind}, ${ref}, (now() at time zone 'Europe/Istanbul')::date, ${views}, ${clicks})
    on conflict (kind, ref, day) do update
      set views = promo_stats.views + excluded.views,
          clicks = promo_stats.clicks + excluded.clicks
  `)
}

export async function readPromoTotals(kind: PromoKind, days = 30): Promise<PromoTotals> {
  try {
    await ensureTable()
    const list = await rows<{ ref: string; views: number; clicks: number }>(sql`
      select ref, sum(views)::int as views, sum(clicks)::int as clicks
      from promo_stats
      where kind = ${kind}
        and day > (now() at time zone 'Europe/Istanbul')::date - ${days}::int
      group by ref
    `)
    return Object.fromEntries(list.map((r) => [r.ref, { views: Number(r.views), clicks: Number(r.clicks) }]))
  } catch {
    return {}
  }
}
