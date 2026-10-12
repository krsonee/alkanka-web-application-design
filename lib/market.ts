import 'server-only'
import { rows, sql } from '@/lib/db'
import { credit, debit, recordHistory, type Member } from '@/lib/member'
import { MARKET_ITEMS } from '@/components/alkanka/data'
import { listCatalog } from '@/lib/sponsor-catalog'

export type MarketKind = 'alkanka' | 'sponsor'
export type RequestStatus = 'beklemede' | 'onaylandi' | 'reddedildi'

export type MarketProduct = {
  id: string
  kind: MarketKind
  sponsorId: string | null
  sponsorName: string | null
  type: string
  name: string
  description: string
  delivery: string
  rules: string[]
  image: string
  price: number
  stock: number
  total: number
  perUser: number
  needsUsername: boolean
  active: boolean
  sort: number
}

export type MarketRequest = {
  id: number
  itemId: string
  itemName: string
  sponsorName: string | null
  userId: string
  userName: string
  siteUsername: string | null
  price: number
  status: RequestStatus
  note: string | null
  createdAt: string
  resolvedAt: string | null
}

let ready: Promise<unknown> | null = null

function ensure() {
  ready ??= (async () => {
    await rows(sql`CREATE TABLE IF NOT EXISTS market_items (
      id text PRIMARY KEY,
      kind text NOT NULL DEFAULT 'alkanka',
      sponsor_id text,
      sponsor_name text,
      type text NOT NULL DEFAULT 'HEDİYE',
      name text NOT NULL,
      description text NOT NULL DEFAULT '',
      delivery text NOT NULL DEFAULT '',
      rules jsonb NOT NULL DEFAULT '[]',
      image text NOT NULL DEFAULT '',
      price int NOT NULL,
      stock int NOT NULL DEFAULT 0,
      total int NOT NULL DEFAULT 0,
      per_user int NOT NULL DEFAULT 1,
      needs_username boolean NOT NULL DEFAULT false,
      active boolean NOT NULL DEFAULT true,
      sort int NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now())`)
    await rows(sql`CREATE TABLE IF NOT EXISTS market_requests (
      id serial PRIMARY KEY,
      item_id text NOT NULL,
      item_name text NOT NULL,
      sponsor_name text,
      user_id text NOT NULL,
      user_name text NOT NULL,
      site_username text,
      price int NOT NULL,
      status text NOT NULL DEFAULT 'beklemede',
      note text,
      created_at timestamptz NOT NULL DEFAULT now(),
      resolved_at timestamptz)`)
    await rows(sql`CREATE INDEX IF NOT EXISTS market_requests_status_idx ON market_requests (status, created_at DESC)`)
    const count = await rows<{ c: string }>(sql`SELECT count(*) AS c FROM market_items`)
    if (Number(count[0]?.c ?? 0) === 0) {
      let sort = 0
      for (const i of MARKET_ITEMS) {
        await rows(sql`INSERT INTO market_items (id, kind, type, name, description, delivery, rules, image, price, stock, total, per_user, needs_username, sort)
          VALUES (${i.id}, 'alkanka', ${i.type}, ${i.name}, ${i.description}, ${i.delivery}, ${JSON.stringify(i.rules)}::jsonb, ${i.image},
            ${i.price}, ${i.stock}, ${i.total}, ${i.limit}, ${Boolean(i.refOnly)}, ${sort++}) ON CONFLICT DO NOTHING`)
      }
      const seeds = (await listCatalog().catch(() => [])).slice(0, 3)
      for (const s of seeds) {
        await rows(sql`INSERT INTO market_items (id, kind, sponsor_id, sponsor_name, type, name, description, delivery, rules, image, price, stock, total, per_user, needs_username, sort)
          VALUES (${`sp-${s.id}`}, 'sponsor', ${s.id}, ${s.name}, 'SPONSOR BONUSU', ${`${s.name} ${s.welcome}`},
            ${`${s.name} hesabına tanımlanan özel bonus. ${s.tagline}.`},
            'Talebin onaylandığında bonus sponsor site hesabına eklenir.',
            ${JSON.stringify(['Sponsor sitede kayıtlı ve doğrulanmış hesabın olmalı.', 'Bonus çevrim kuralları sponsor siteye aittir.'])}::jsonb,
            '/images/tile-market.png', 4000, 10, 10, 1, true, ${sort++}) ON CONFLICT DO NOTHING`)
      }
    }
  })().catch((e) => {
    ready = null
    throw e
  })
  return ready
}

type ItemRow = {
  id: string; kind: MarketKind; sponsor_id: string | null; sponsor_name: string | null; type: string; name: string
  description: string; delivery: string; rules: string[]; image: string; price: number; stock: number; total: number
  per_user: number; needs_username: boolean; active: boolean; sort: number
}

const toProduct = (r: ItemRow): MarketProduct => ({
  id: r.id, kind: r.kind, sponsorId: r.sponsor_id, sponsorName: r.sponsor_name, type: r.type, name: r.name,
  description: r.description, delivery: r.delivery, rules: Array.isArray(r.rules) ? r.rules : [], image: r.image,
  price: r.price, stock: r.stock, total: r.total, perUser: r.per_user, needsUsername: r.needs_username || r.kind === 'sponsor',
  active: r.active, sort: r.sort,
})

export async function listProducts(opts: { includeInactive?: boolean } = {}): Promise<MarketProduct[]> {
  await ensure()
  const r = opts.includeInactive
    ? await rows<ItemRow>(sql`SELECT * FROM market_items ORDER BY kind DESC, sort, created_at`)
    : await rows<ItemRow>(sql`SELECT * FROM market_items WHERE active ORDER BY kind DESC, sort, created_at`)
  return r.map(toProduct)
}

export type ProductInput = Omit<MarketProduct, 'id' | 'needsUsername'> & { id: string | null; needsUsername: boolean }

const clean = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max)
const int = (v: unknown, min: number, max: number) => Math.min(max, Math.max(min, Math.floor(Number(v) || 0)))

export async function saveProduct(input: ProductInput) {
  await ensure()
  const name = clean(input.name, 120)
  if (!name) throw new Error('Ürün adı zorunlu.')
  const kind: MarketKind = input.kind === 'sponsor' ? 'sponsor' : 'alkanka'
  const catalog = kind === 'sponsor' ? await listCatalog().catch(() => []) : []
  const sponsor = catalog.find((s) => s.id === input.sponsorId)
  const sponsorName = kind === 'sponsor' ? clean(input.sponsorName || sponsor?.name, 80) || null : null
  if (kind === 'sponsor' && !sponsorName) throw new Error('Sponsor site seçmelisin.')
  const id = input.id || `${kind === 'sponsor' ? 'sp' : 'ak'}-${Date.now().toString(36)}`
  const rules = (input.rules ?? []).map((x) => clean(x, 200)).filter(Boolean).slice(0, 12)
  const total = int(input.total, 0, 100000)
  const stock = Math.min(int(input.stock, 0, 100000), total || 100000)
  await rows(sql`INSERT INTO market_items (id, kind, sponsor_id, sponsor_name, type, name, description, delivery, rules, image, price, stock, total, per_user, needs_username, active, sort)
    VALUES (${id}, ${kind}, ${kind === 'sponsor' ? clean(input.sponsorId, 80) || null : null}, ${sponsorName}, ${clean(input.type, 30) || 'HEDİYE'}, ${name},
      ${clean(input.description, 600)}, ${clean(input.delivery, 300)}, ${JSON.stringify(rules)}::jsonb, ${clean(input.image, 500)},
      ${int(input.price, 1, 10_000_000)}, ${stock}, ${total}, ${int(input.perUser, 1, 100)}, ${Boolean(input.needsUsername) || kind === 'sponsor'},
      ${input.active !== false}, ${int(input.sort, 0, 9999)})
    ON CONFLICT (id) DO UPDATE SET kind = EXCLUDED.kind, sponsor_id = EXCLUDED.sponsor_id, sponsor_name = EXCLUDED.sponsor_name,
      type = EXCLUDED.type, name = EXCLUDED.name, description = EXCLUDED.description, delivery = EXCLUDED.delivery, rules = EXCLUDED.rules,
      image = EXCLUDED.image, price = EXCLUDED.price, stock = EXCLUDED.stock, total = EXCLUDED.total, per_user = EXCLUDED.per_user,
      needs_username = EXCLUDED.needs_username, active = EXCLUDED.active, sort = EXCLUDED.sort`)
  return id
}

export async function deleteProduct(id: string) {
  await ensure()
  await rows(sql`DELETE FROM market_items WHERE id = ${id}`)
}

export async function requestProduct(member: Member, itemId: string, siteUsername: string | null) {
  await ensure()
  const found = await rows<ItemRow>(sql`SELECT * FROM market_items WHERE id = ${itemId} AND active`)
  if (!found[0]) throw new Error('Ürün bulunamadı.')
  const item = toProduct(found[0])
  const username = clean(siteUsername, 60)
  if (item.needsUsername && username.length < 2) throw new Error('Site kullanıcı adını yazmalısın.')

  const used = await rows<{ c: string }>(sql`SELECT count(*) AS c FROM market_requests
    WHERE user_id = ${member.id} AND item_id = ${item.id} AND status <> 'reddedildi'`)
  if (Number(used[0]?.c ?? 0) >= item.perUser) throw new Error(`Bu üründen en fazla ${item.perUser} adet alabilirsin.`)

  const reserved = await rows(sql`UPDATE market_items SET stock = stock - 1 WHERE id = ${item.id} AND stock > 0 RETURNING stock`)
  if (!reserved.length) throw new Error('Stok tükendi.')
  if (!(await debit(member.id, item.price))) {
    await rows(sql`UPDATE market_items SET stock = stock + 1 WHERE id = ${item.id}`)
    throw new Error('Kanka Coin bakiyen yetersiz.')
  }

  await rows(sql`INSERT INTO market_requests (item_id, item_name, sponsor_name, user_id, user_name, site_username, price)
    VALUES (${item.id}, ${item.name}, ${item.sponsorName}, ${member.id}, ${member.name}, ${username || null}, ${item.price})`)
  await recordHistory({ userId: member.id, userName: member.name, game: 'market', mode: 'harcama', opponent: item.name, stake: item.price, result: 'loss', delta: -item.price })
  return item
}

type ReqRow = {
  id: number; item_id: string; item_name: string; sponsor_name: string | null; user_id: string; user_name: string
  site_username: string | null; price: number; status: RequestStatus; note: string | null; created_at: string; resolved_at: string | null
}

const toRequest = (r: ReqRow): MarketRequest => ({
  id: r.id, itemId: r.item_id, itemName: r.item_name, sponsorName: r.sponsor_name, userId: r.user_id, userName: r.user_name,
  siteUsername: r.site_username, price: r.price, status: r.status, note: r.note,
  createdAt: new Date(r.created_at).toISOString(), resolvedAt: r.resolved_at ? new Date(r.resolved_at).toISOString() : null,
})

export async function listRequests(limit = 100): Promise<MarketRequest[]> {
  await ensure()
  const r = await rows<ReqRow>(sql`SELECT * FROM market_requests
    ORDER BY (status = 'beklemede') DESC, created_at DESC LIMIT ${limit}`)
  return r.map(toRequest)
}

export async function myRequests(userId: string): Promise<MarketRequest[]> {
  await ensure()
  const r = await rows<ReqRow>(sql`SELECT * FROM market_requests WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT 20`)
  return r.map(toRequest)
}

export async function pendingCount(): Promise<number> {
  await ensure()
  const r = await rows<{ c: string }>(sql`SELECT count(*) AS c FROM market_requests WHERE status = 'beklemede'`)
  return Number(r[0]?.c ?? 0)
}

export async function resolveRequest(id: number, approve: boolean, note: string) {
  await ensure()
  const r = await rows<ReqRow>(sql`UPDATE market_requests SET status = ${approve ? 'onaylandi' : 'reddedildi'},
    note = ${clean(note, 300) || null}, resolved_at = now() WHERE id = ${id} AND status = 'beklemede' RETURNING *`)
  const req = r[0]
  if (!req) throw new Error('Talep bulunamadı ya da zaten sonuçlandı.')
  if (!approve) {
    await credit(req.user_id, req.price)
    await rows(sql`UPDATE market_items SET stock = stock + 1 WHERE id = ${req.item_id}`)
  }
}
