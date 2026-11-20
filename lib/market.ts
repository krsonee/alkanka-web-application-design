import 'server-only'
import { rows, sql } from '@/lib/db'
import { credit, debit, recordHistory, type Member } from '@/lib/member'
import { MARKET_ITEMS } from '@/components/alkanka/data'
import { assertCanBuy } from '@/lib/member-limits'
import { noteCoins } from '@/lib/wallet-ledger'
import { stockWarning } from '@/lib/market-stock'
import type { SponsorReminder } from '@/lib/sponsor-reminders'
import { isAllowedImage } from '@/lib/site-registry'
import { isRewardKind, rewardMeta, type DeliveryMode, type Reward } from '@/lib/market-shared'

export type MarketKind = 'alkanka' | 'sponsor'
export type RequestStatus = 'beklemede' | 'onaylandi' | 'reddedildi'

export type MarketProduct = {
  id: string
  kind: MarketKind
  sponsorId: string | null
  sponsorName: string | null
  sponsorSlug: string | null
  sponsorLogo?: string | null
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
  /** 'auto' puts `reward` on the account at purchase; 'manual' sends the request to the staff queue. */
  deliveryMode: DeliveryMode
  reward: Reward | null
  featured: boolean
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
  /** The product delivers by itself but that failed at purchase; approving the request delivers it. */
  needsDelivery: boolean
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
    // In-site rewards are defined in code and synced automatically; staff only add sponsor bonuses by hand.
    let sort = 0
    for (const i of MARKET_ITEMS) {
      await rows(sql`INSERT INTO market_items (id, kind, type, name, description, delivery, rules, image, price, stock, total, per_user, needs_username, sort)
        VALUES (${i.id}, 'alkanka', ${i.type}, ${i.name}, ${i.description}, ${i.delivery}, ${JSON.stringify(i.rules)}::jsonb, ${i.image},
          ${i.price}, ${i.stock}, ${i.total}, ${i.limit}, ${Boolean(i.refOnly)}, ${sort++}) ON CONFLICT (id) DO NOTHING`)
    }
    await rows(sql`ALTER TABLE market_items
      ADD COLUMN IF NOT EXISTS delivery_mode text,
      ADD COLUMN IF NOT EXISTS reward_kind text,
      ADD COLUMN IF NOT EXISTS reward_amount int NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS reward_ref text,
      ADD COLUMN IF NOT EXISTS featured boolean NOT NULL DEFAULT false`)
    await rows(sql`ALTER TABLE market_requests ADD COLUMN IF NOT EXISTS needs_delivery boolean NOT NULL DEFAULT false`)
    // Products from before the delivery setting: the three the site already delivered keep doing so,
    // every other one goes to the staff queue instead of being marked delivered with nothing handed over.
    await rows(sql`UPDATE market_items SET
        delivery_mode = CASE WHEN id IN ('cark-hakki', 'zar-hakki', 'seri-kalkani') THEN 'auto' ELSE 'manual' END,
        reward_kind = CASE id WHEN 'cark-hakki' THEN 'cark' WHEN 'zar-hakki' THEN 'zar' WHEN 'seri-kalkani' THEN 'kalkan' END,
        reward_amount = CASE id WHEN 'cark-hakki' THEN 3 WHEN 'zar-hakki' THEN 5 WHEN 'seri-kalkani' THEN 1 ELSE 0 END
      WHERE delivery_mode IS NULL`)
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
  delivery_mode: string | null; reward_kind: string | null; reward_amount: number; reward_ref: string | null; featured: boolean
}

function toProduct(r: ItemRow): MarketProduct {
  // A sponsor bonus is paid out on the sponsor's own site, so it can never deliver by itself.
  const reward: Reward | null =
    r.kind !== 'sponsor' && isRewardKind(r.reward_kind) && Number(r.reward_amount) > 0
      ? { kind: r.reward_kind, amount: Number(r.reward_amount), ref: r.reward_ref }
      : null
  return {
    id: r.id, kind: r.kind, sponsorId: r.sponsor_id, sponsorName: r.sponsor_name, sponsorSlug: null, type: r.type, name: r.name,
    description: r.description, delivery: r.delivery, rules: Array.isArray(r.rules) ? r.rules : [], image: r.image,
    price: r.price, stock: r.stock, total: r.total, perUser: r.per_user, needsUsername: r.needs_username || r.kind === 'sponsor',
    active: r.active, sort: r.sort,
    deliveryMode: reward && r.delivery_mode === 'auto' ? 'auto' : 'manual',
    reward,
    featured: Boolean(r.featured),
  }
}

async function withSponsorSlugs(items: MarketProduct[]) {
  const { listSites } = await import('@/lib/sites')
  const sites = await listSites()
  return items.map((item) => {
    if (item.kind !== 'sponsor' || !item.sponsorId) return item
    const site = sites.find((row) => String(row.id) === item.sponsorId || row.slug === item.sponsorId)
    if (!site?.active || !site.slug) return item
    return { ...item, sponsorName: site.name, sponsorSlug: site.slug, sponsorLogo: site.logoUrl?.trim() || null }
  })
}

export async function listProducts(opts: { includeInactive?: boolean } = {}): Promise<MarketProduct[]> {
  await ensure()
  const r = opts.includeInactive
    ? await rows<ItemRow>(sql`SELECT * FROM market_items ORDER BY sort, created_at`)
    : await rows<ItemRow>(sql`SELECT * FROM market_items WHERE active ORDER BY sort, created_at`)
  const items = await withSponsorSlugs(r.map(toProduct))
  if (opts.includeInactive) return items
  return items.filter((item) => item.kind !== 'sponsor' || item.sponsorSlug)
}

export type ProductInput = Omit<MarketProduct, 'id' | 'needsUsername' | 'sponsorSlug'> & { id: string | null; needsUsername: boolean }

const MAX_PRICE = 10_000_000
const MAX_STOCK = 100_000
const clean = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max)
const int = (v: unknown, min: number, max: number) => Math.min(max, Math.max(min, Math.floor(Number(v) || 0)))

/** Products on sale that are sold out or about to be, for the panel's overview. Read when the screen opens. */
export async function stockReminders(): Promise<SponsorReminder[]> {
  const out: SponsorReminder[] = []
  for (const p of await listProducts()) {
    const warning = p.active ? stockWarning(p.stock, p.total) : null
    if (!warning) continue
    const empty = p.stock <= 0
    out.push({
      id: `stock-${p.id}`,
      kind: 'stock',
      urgent: empty,
      title: p.name,
      text: empty
        ? `Stok bitti (${p.total} üzerinden 0). Üyeler bu ürünü alamıyor; stok ekle ya da ürünü gizle.`
        : `Stok azaldı: ${p.total} üzerinden ${p.stock} kaldı. Bitmeden stok ekle.`,
      href: '/panel?b=market&s=products',
    })
  }
  return out.sort((a, b) => Number(b.urgent) - Number(a.urgent))
}

export async function saveProduct(input: ProductInput) {
  await ensure()
  const name = clean(input.name, 120)
  if (!name) throw new Error('Ürün adı zorunlu.')
  const kind: MarketKind = input.kind === 'sponsor' ? 'sponsor' : 'alkanka'
  const { listSites } = await import('@/lib/sites')
  const sponsor = kind === 'sponsor' ? (await listSites()).find((site) => String(site.id) === String(input.sponsorId) && site.slug) : undefined
  if (kind === 'sponsor' && !sponsor) throw new Error('Sponsor site seçmelisin.')
  const sponsorName = sponsor ? clean(sponsor.name, 80) || null : null
  const id = input.id || `${kind === 'sponsor' ? 'sp' : 'ak'}-${Date.now().toString(36)}`
  const rules = (input.rules ?? []).map((x) => clean(x, 200)).filter(Boolean).slice(0, 12)
  const image = clean(input.image, 500)
  if (image && !isAllowedImage(image)) throw new Error('Görsel linki /images/ ile ya da https:// ile başlamalı.')
  if (Number(input.price) > MAX_PRICE) throw new Error(`Fiyat en fazla ${MAX_PRICE.toLocaleString('tr-TR')} KC olabilir.`)
  if (Number(input.total) > MAX_STOCK || Number(input.stock) > MAX_STOCK) throw new Error(`Stok en fazla ${MAX_STOCK.toLocaleString('tr-TR')} olabilir.`)
  const total = int(input.total, 0, MAX_STOCK)
  if (total > 0 && Number(input.stock) > total) throw new Error(`Kalan stok (${Number(input.stock)}) toplam stoktan (${total}) fazla olamaz.`)
  const stock = Math.min(int(input.stock, 0, MAX_STOCK), total || MAX_STOCK)
  const price = int(input.price, 1, MAX_PRICE)
  const reward = kind === 'sponsor' || input.deliveryMode !== 'auto' ? null : await cleanReward(input.reward, price)
  // A new product goes to the end of the list; an edited one keeps the place it was dragged to.
  const sort = input.id ? int(input.sort, 0, 99_999) : null
  await rows(sql`INSERT INTO market_items (id, kind, sponsor_id, sponsor_name, type, name, description, delivery, rules, image, price, stock, total, per_user, needs_username, active, sort,
      delivery_mode, reward_kind, reward_amount, reward_ref, featured)
    VALUES (${id}, ${kind}, ${kind === 'sponsor' ? clean(input.sponsorId, 80) || null : null}, ${sponsorName}, ${clean(input.type, 30) || 'HEDİYE'}, ${name},
      ${clean(input.description, 600)}, ${clean(input.delivery, 300)}, ${JSON.stringify(rules)}::jsonb, ${image},
      ${price}, ${stock}, ${total}, ${int(input.perUser, 1, 100)}, ${Boolean(input.needsUsername) || kind === 'sponsor'},
      ${input.active !== false}, COALESCE(${sort}::int, (SELECT COALESCE(max(sort), -1) + 1 FROM market_items)),
      ${reward ? 'auto' : 'manual'}, ${reward?.kind ?? null}, ${reward?.amount ?? 0}, ${reward?.ref ?? null}, ${Boolean(input.featured)})
    ON CONFLICT (id) DO UPDATE SET kind = EXCLUDED.kind, sponsor_id = EXCLUDED.sponsor_id, sponsor_name = EXCLUDED.sponsor_name,
      type = EXCLUDED.type, name = EXCLUDED.name, description = EXCLUDED.description, delivery = EXCLUDED.delivery, rules = EXCLUDED.rules,
      image = EXCLUDED.image, price = EXCLUDED.price, stock = EXCLUDED.stock, total = EXCLUDED.total, per_user = EXCLUDED.per_user,
      needs_username = EXCLUDED.needs_username, active = EXCLUDED.active, sort = EXCLUDED.sort,
      delivery_mode = EXCLUDED.delivery_mode, reward_kind = EXCLUDED.reward_kind, reward_amount = EXCLUDED.reward_amount,
      reward_ref = EXCLUDED.reward_ref, featured = EXCLUDED.featured`)
  return id
}

/** What an automatic product hands over, checked so a product can never be saved as automatic with nothing to give. */
async function cleanReward(input: Reward | null, price: number): Promise<Reward> {
  if (!input || !isRewardKind(input.kind)) throw new Error('Otomatik teslimde hesaba ne ekleneceğini seçmelisin.')
  const meta = rewardMeta(input.kind)
  if (input.kind === 'rozet') {
    const ref = clean(input.ref, 80)
    if (!ref) throw new Error('Verilecek rozeti seçmelisin.')
    const found = await rows(sql`SELECT 1 FROM kp_badges WHERE id = ${ref}`).catch(() => [])
    if (!found.length) throw new Error('Seçilen rozet bulunamadı. Rozetler ekranından kontrol et.')
    return { kind: 'rozet', amount: 1, ref }
  }
  const amount = Math.floor(Number(input.amount) || 0)
  if (amount < 1) throw new Error(`${meta.label} miktarı en az 1 olmalı.`)
  if (amount > meta.max) throw new Error(`${meta.label} miktarı en fazla ${meta.max.toLocaleString('tr-TR')} olabilir.`)
  if (input.kind === 'kc' && amount >= price) throw new Error(`Verilen Kanka Coin (${amount.toLocaleString('tr-TR')}) fiyattan (${price.toLocaleString('tr-TR')}) az olmalı; yoksa ürün bedava coin dağıtır.`)
  return { kind: input.kind, amount, ref: null }
}

export async function deleteProduct(id: string) {
  await ensure()
  await rows(sql`DELETE FROM market_items WHERE id = ${id}`)
}

/** Saves the order the list was dragged into; the site shows products in the same order. */
export async function reorderProducts(ids: string[]) {
  await ensure()
  const list = ids.map((id) => String(id)).slice(0, 2000)
  if (!list.length) return
  await rows(sql`UPDATE market_items m SET sort = o.ord
    FROM (SELECT value AS id, (ordinality - 1)::int AS ord FROM jsonb_array_elements_text(${JSON.stringify(list)}::jsonb) WITH ORDINALITY) o
    WHERE m.id = o.id`)
}

export async function featureProduct(id: string, featured: boolean) {
  await ensure()
  const r = await rows(sql`UPDATE market_items SET featured = ${featured} WHERE id = ${id} RETURNING id`)
  if (!r.length) throw new Error('Ürün bulunamadı.')
}

export async function requestProduct(member: Member, itemId: string, siteUsername: string | null) {
  const { withUserLock } = await import('@/lib/user-lock')
  return withUserLock(`market:${member.id}`, () => requestProductLocked(member, itemId, siteUsername))
}

async function requestProductLocked(member: Member, itemId: string, siteUsername: string | null) {
  await ensure()
  const found = await rows<ItemRow>(sql`SELECT * FROM market_items WHERE id = ${itemId} AND active`)
  if (!found[0]) throw new Error('Ürün bulunamadı.')
  const item = toProduct(found[0])
  const username = clean(siteUsername, 60)
  if (item.needsUsername && username.length < 2) throw new Error('Site kullanıcı adını yazmalısın.')

  const used = await rows<{ c: string }>(sql`SELECT count(*) AS c FROM market_requests
    WHERE user_id = ${member.id} AND item_id = ${item.id} AND status <> 'reddedildi'`)
  if (Number(used[0]?.c ?? 0) >= item.perUser) throw new Error(`Bu üründen en fazla ${item.perUser} adet alabilirsin.`)
  const { marketDiscountPct, discounted } = await import('@/lib/boosts')
  const pct = item.kind === 'sponsor' ? 0 : await marketDiscountPct(member.id).catch(() => 0)
  const price = discounted(item.price, pct)
  await assertCanBuy(member.id, price)
  const { roleBlocks, badgeCount } = await import('@/lib/kanka-puan')
  if (await roleBlocks(member.id, 'market')) throw new Error('Bu rolle marketten alışveriş yapılamıyor.')
  const reward = item.deliveryMode === 'auto' ? item.reward : null
  if (reward?.kind === 'rozet' && reward.ref && (await badgeCount(member.id, reward.ref)) > 0) throw new Error('Bu rozet zaten sende.')

  const reserved = await rows(sql`UPDATE market_items SET stock = stock - 1 WHERE id = ${item.id} AND stock > 0 RETURNING stock`)
  if (!reserved.length) throw new Error('Stok tükendi.')
  if (!(await debit(member.id, price, 'Market alışverişi'))) {
    await rows(sql`UPDATE market_items SET stock = stock + 1 WHERE id = ${item.id}`)
    throw new Error('Kanka Coin bakiyen yetersiz.')
  }

  // The request is written before anything is handed over: if delivery fails the paid request is already
  // waiting in the staff queue, so a member can never be left with the coins gone and nothing to show for it.
  const [request] = await rows<{ id: number }>(sql`INSERT INTO market_requests (item_id, item_name, sponsor_name, user_id, user_name, site_username, price, status, needs_delivery)
    VALUES (${item.id}, ${item.name}, ${item.sponsorName}, ${member.id}, ${member.name}, ${username || null}, ${price}, 'beklemede', ${Boolean(reward)})
    RETURNING id`)
  await recordHistory({ userId: member.id, userName: member.name, game: 'market', mode: 'harcama', opponent: item.name, stake: price, result: 'loss', delta: -price })

  let delivered: Delivered = null
  if (reward) {
    try {
      delivered = await deliverReward(member.id, reward, { ref: `market:${request.id}`, label: item.name })
      await rows(sql`UPDATE market_requests SET status = 'onaylandi', needs_delivery = false, note = ${AUTO_NOTE}, resolved_at = now() WHERE id = ${request.id}`)
    } catch (e) {
      console.error('[market] otomatik teslim olmadı', item.id, e)
      await rows(sql`UPDATE market_requests SET note = ${AUTO_FAILED_NOTE} WHERE id = ${request.id}`).catch(() => {})
    }
  }
  if (delivered) return { ...item, price, delivered }
  const { notifyApproval } = await import('@/lib/telegram-bots')
  await notifyApproval('market', {
    uye: member.name,
    detay: `${item.name} (${price} KC${pct ? `, %${pct} indirimli` : ''})${username ? ` · Site kullanıcı adı: ${username}` : ''}`,
  }).catch(() => {})
  return { ...item, price, delivered }
}

const AUTO_NOTE = 'Otomatik teslim edildi.'
const AUTO_FAILED_NOTE = 'Otomatik teslim olmadı, ekip tamamlayacak.'

/** What a purchase put on the account, so the buyer can be told the exact new total. */
export type Delivered =
  | { kind: 'plays'; game: 'cark' | 'zar' | 'sandik'; amount: number; total: number }
  | { kind: 'shield'; amount: number; total: number }
  | { kind: 'kc'; amount: number }
  | { kind: 'kp'; amount: number }
  | { kind: 'badge'; name: string }
  | null

/**
 * Puts a reward on the account. `ref` names the purchase it belongs to, so Kanka Puan for one purchase
 * is never written twice even when delivery is tried again.
 */
async function deliverReward(userId: string, reward: Reward, from: { ref: string | null; label: string }): Promise<Exclude<Delivered, null>> {
  const amount = Math.floor(Number(reward.amount) || 0)
  if (reward.kind === 'cark' || reward.kind === 'zar' || reward.kind === 'sandik') {
    const { grantExtraPlays } = await import('@/lib/mini-extras')
    return { kind: 'plays', game: reward.kind, amount, total: await grantExtraPlays(userId, reward.kind, amount) }
  }
  if (reward.kind === 'kalkan') {
    await rows(sql`CREATE TABLE IF NOT EXISTS streak_shields (user_id text PRIMARY KEY, count int NOT NULL DEFAULT 0, used int NOT NULL DEFAULT 0, updated_at timestamptz NOT NULL DEFAULT now())`)
    const [r] = await rows<{ count: number }>(sql`INSERT INTO streak_shields (user_id, count) VALUES (${userId}, ${amount})
      ON CONFLICT (user_id) DO UPDATE SET count = streak_shields.count + ${amount}, updated_at = now() RETURNING count`)
    return { kind: 'shield', amount, total: Number(r?.count ?? amount) }
  }
  if (reward.kind === 'kc') {
    await credit(userId, amount, 'Market ödülü')
    return { kind: 'kc', amount }
  }
  if (reward.kind === 'kp') {
    const { ensureKp } = await import('@/lib/kanka-puan')
    await ensureKp()
    await rows(sql`INSERT INTO kp_events (user_id, source, points, ref, note)
      VALUES (${userId}, 'market', ${amount}, ${from.ref}, ${from.label.slice(0, 120)}) ON CONFLICT DO NOTHING`)
    return { kind: 'kp', amount }
  }
  const { awardBadge } = await import('@/lib/kanka-puan')
  if (!reward.ref) throw new Error('Ürüne rozet bağlanmamış.')
  // False means the member already holds it, which is the state this delivery is after.
  await awardBadge(reward.ref, userId, 'market', from.label)
  const [badge] = await rows<{ name: string }>(sql`SELECT name FROM kp_badges WHERE id = ${reward.ref}`)
  return { kind: 'badge', name: badge?.name ?? 'Rozet' }
}

/** Hands over a product won as a prize. Null means the site cannot deliver this product by itself. */
export async function deliverInSiteItem(userId: string, itemId: string): Promise<Delivered> {
  await ensure()
  const [row] = await rows<ItemRow>(sql`SELECT * FROM market_items WHERE id = ${itemId}`)
  const item = row ? toProduct(row) : null
  if (!item || item.deliveryMode !== 'auto' || !item.reward) return null
  return deliverReward(userId, item.reward, { ref: null, label: item.name })
}

type ReqRow = {
  id: number; item_id: string; item_name: string; sponsor_name: string | null; user_id: string; user_name: string
  site_username: string | null; price: number; status: RequestStatus; note: string | null; created_at: string; resolved_at: string | null
  needs_delivery: boolean
}

const toRequest = (r: ReqRow): MarketRequest => ({
  id: r.id, itemId: r.item_id, itemName: r.item_name, sponsorName: r.sponsor_name, userId: r.user_id, userName: r.user_name,
  siteUsername: r.site_username, price: r.price, status: r.status, note: r.note,
  createdAt: new Date(r.created_at).toISOString(), resolvedAt: r.resolved_at ? new Date(r.resolved_at).toISOString() : null,
  needsDelivery: Boolean(r.needs_delivery) && r.status === 'beklemede',
})

export async function listRequests(limit = 200): Promise<MarketRequest[]> {
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
  if (note.trim().length > 300) throw new Error(`Not en fazla 300 karakter olabilir (şu an ${note.trim().length}). Üyeye yarım not gitmesin diye kaydedilmedi.`)
  await ensure()
  if (approve) {
    const r = await rows<ReqRow>(sql`UPDATE market_requests SET status = 'onaylandi',
      note = ${clean(note, 300) || null}, resolved_at = now() WHERE id = ${id} AND status = 'beklemede' RETURNING *`)
    const req = r[0]
    if (!req) throw new Error('Talep bulunamadı ya da zaten sonuçlandı.')
    if (!req.needs_delivery) return
    // An automatic product whose delivery failed at purchase: approving is what hands it over, so the
    // request only stays approved when that worked.
    try {
      const [row] = await rows<ItemRow>(sql`SELECT * FROM market_items WHERE id = ${req.item_id}`)
      const reward = row ? toProduct(row).reward : null
      if (!reward) throw new Error('Ürünün otomatik ödülü kaldırılmış. Ödülü elle verip ürünü "elle teslim" yap, sonra tekrar onayla.')
      await deliverReward(req.user_id, reward, { ref: `market:${req.id}`, label: req.item_name })
      await rows(sql`UPDATE market_requests SET needs_delivery = false WHERE id = ${req.id}`)
    } catch (e) {
      await rows(sql`UPDATE market_requests SET status = 'beklemede', note = ${AUTO_FAILED_NOTE}, resolved_at = NULL WHERE id = ${req.id}`)
      throw new Error(`Ödül hesaba eklenemedi, talep beklemede kaldı. ${e instanceof Error ? e.message : ''}`.trim())
    }
    return
  }
  // One statement, so a rejected request can never be left without its refund and its stock.
  const r = await rows<ReqRow & { refunded: string }>(sql`WITH req AS (
      UPDATE market_requests SET status = 'reddedildi', note = ${clean(note, 300) || null}, resolved_at = now()
      WHERE id = ${id} AND status = 'beklemede' RETURNING *
    ), refund AS (
      UPDATE wallets w SET balance = w.balance + req.price, updated_at = now() FROM req WHERE w.user_id = req.user_id RETURNING w.user_id
    ), restock AS (
      UPDATE market_items i SET stock = i.stock + 1 FROM req WHERE i.id = req.item_id RETURNING i.id
    )
    SELECT req.*, (SELECT count(*) FROM refund) AS refunded, (SELECT count(*) FROM restock) AS restocked FROM req`)
  const req = r[0]
  if (!req) throw new Error('Talep bulunamadı ya da zaten sonuçlandı.')
  // A member who paid always has a wallet row; this only covers one that was removed since.
  if (Number(req.refunded) === 0) await credit(req.user_id, req.price, 'Market iadesi')
  else await noteCoins(req.user_id, Number(req.price), 'Market iadesi')
}
