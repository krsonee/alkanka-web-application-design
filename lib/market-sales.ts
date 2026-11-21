import 'server-only'
import { rows, sql } from '@/lib/db'
import { trInputToIso } from '@/lib/tr-time'
import { SALE_MAX_ITEMS, SALE_MAX_PCT, SALE_MIN_PCT, SALE_SCOPES, type MarketSale, type SaleInput, type SaleScope } from '@/lib/market-shared'

let ready: Promise<unknown> | null = null

function ensure() {
  ready ??= rows(sql`CREATE TABLE IF NOT EXISTS market_sales (
      id serial PRIMARY KEY,
      name text NOT NULL,
      pct int NOT NULL,
      starts_at timestamptz NOT NULL,
      ends_at timestamptz NOT NULL,
      scope text NOT NULL DEFAULT 'all',
      item_ids jsonb NOT NULL DEFAULT '[]',
      active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now())`).catch((e) => {
    ready = null
    throw e
  })
  return ready
}

type SaleRow = {
  id: number; name: string; pct: number; starts_at: string; ends_at: string; scope: string; item_ids: unknown; active: boolean
}

const isScope = (v: unknown): v is SaleScope => SALE_SCOPES.some((s) => s.id === v)

const toSale = (r: SaleRow): MarketSale => ({
  id: Number(r.id),
  name: r.name,
  pct: Number(r.pct),
  startsAt: new Date(r.starts_at).toISOString(),
  endsAt: new Date(r.ends_at).toISOString(),
  scope: isScope(r.scope) ? r.scope : 'all',
  itemIds: Array.isArray(r.item_ids) ? r.item_ids.map(String) : [],
  active: Boolean(r.active),
})

/** Every campaign, for the panel: running and waiting ones first, finished ones after. */
export async function listSales(): Promise<MarketSale[]> {
  await ensure()
  const r = await rows<SaleRow>(sql`SELECT * FROM market_sales ORDER BY (ends_at > now()) DESC, starts_at, id LIMIT 200`)
  return r.map(toSale)
}

/**
 * Campaigns running at this moment. Nothing switches a campaign on or off: the dates are compared
 * every time prices are read, so it starts and ends by itself.
 */
export async function liveSales(): Promise<MarketSale[]> {
  await ensure()
  const r = await rows<SaleRow>(sql`SELECT * FROM market_sales WHERE active AND starts_at <= now() AND ends_at > now()`)
  return r.map(toSale)
}

export async function saveSale(input: SaleInput): Promise<number> {
  await ensure()
  const name = String(input.name ?? '').trim().slice(0, 80)
  if (!name) throw new Error('Kampanyaya bir ad yaz; üye bu adı markette görür.')
  const pct = Math.floor(Number(input.pct) || 0)
  if (pct < SALE_MIN_PCT || pct > SALE_MAX_PCT) throw new Error(`İndirim yüzde ${SALE_MIN_PCT} ile ${SALE_MAX_PCT} arasında olmalı.`)
  const startsAt = trInputToIso(input.startsAt)
  const endsAt = trInputToIso(input.endsAt)
  if (!startsAt) throw new Error('Başlangıç tarihini seç.')
  if (!endsAt) throw new Error('Bitiş tarihini seç.')
  if (Date.parse(endsAt) <= Date.parse(startsAt)) throw new Error('Bitiş tarihi başlangıçtan sonra olmalı.')
  const scope: SaleScope = isScope(input.scope) ? input.scope : 'all'
  const itemIds = scope === 'items' ? Array.from(new Set((input.itemIds ?? []).map(String).filter(Boolean))).slice(0, SALE_MAX_ITEMS) : []
  if (scope === 'items' && !itemIds.length) throw new Error('İndirime girecek en az bir ürün işaretle.')
  const active = input.active !== false
  const ids = JSON.stringify(itemIds)
  if (input.id == null) {
    const [row] = await rows<{ id: number }>(sql`INSERT INTO market_sales (name, pct, starts_at, ends_at, scope, item_ids, active)
      VALUES (${name}, ${pct}, ${startsAt}, ${endsAt}, ${scope}, ${ids}::jsonb, ${active}) RETURNING id`)
    return Number(row.id)
  }
  const id = Math.floor(Number(input.id))
  const r = await rows(sql`UPDATE market_sales SET name = ${name}, pct = ${pct}, starts_at = ${startsAt}, ends_at = ${endsAt},
      scope = ${scope}, item_ids = ${ids}::jsonb, active = ${active} WHERE id = ${id} RETURNING id`)
  if (!r.length) throw new Error('Kampanya bulunamadı.')
  return id
}

export async function setSaleActive(id: number, active: boolean) {
  await ensure()
  const r = await rows(sql`UPDATE market_sales SET active = ${active} WHERE id = ${Math.floor(Number(id))} RETURNING id`)
  if (!r.length) throw new Error('Kampanya bulunamadı.')
}

export async function deleteSale(id: number) {
  await ensure()
  await rows(sql`DELETE FROM market_sales WHERE id = ${Math.floor(Number(id))}`)
}
