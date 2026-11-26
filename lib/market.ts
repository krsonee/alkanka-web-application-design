import 'server-only'
import type { PoolClient } from 'pg'
import { pool, rows, sql } from '@/lib/db'
import { credit, creditClaimed, debit, recordHistory, type Member } from '@/lib/member'
import { shownError } from '@/lib/shown-error'
import { MARKET_ITEMS } from '@/components/alkanka/data'
import { assertCanBuy } from '@/lib/member-limits'
import { noteCoins } from '@/lib/wallet-ledger'
import { stockWarning } from '@/lib/market-stock'
import type { SponsorReminder } from '@/lib/sponsor-reminders'
import { isAllowedImage } from '@/lib/site-registry'
import { afterPct, bestSale, dealWins, isRewardKind, rewardMeta, type DeliveryMode, type Reward } from '@/lib/market-shared'

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
  /** A member who finished this task pays `dealPrice` instead of the list price. Null means the product has no task price. */
  dealTaskId: number | null
  dealPrice: number
  /** How many units one completion of the task buys at the task price; the next unit costs the usual price again. */
  dealUses: number
  /** The linked task as it stands now; null when it was deleted, which switches the task price off. `repeats` is false for a one-off task. */
  dealTask: { title: string; live: boolean; repeats: boolean } | null
  /** The discount campaign the product is sold under right now. */
  sale: { id: number; name: string; pct: number; endsAt: string } | null
  /** The list price with the campaign taken off; equal to `price` when no campaign covers the product. */
  salePrice: number
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
      ADD COLUMN IF NOT EXISTS featured boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS deal_task_id int,
      ADD COLUMN IF NOT EXISTS deal_price int NOT NULL DEFAULT 0`)
    // The live table already had reward_kind as NOT NULL DEFAULT 'none' from an earlier version, so the line above
    // left it alone and every product without an automatic reward (all sponsor bonuses) failed to save.
    await rows(sql`ALTER TABLE market_items ALTER COLUMN reward_kind DROP NOT NULL, ALTER COLUMN reward_kind DROP DEFAULT`)
    await rows(sql`ALTER TABLE market_requests ADD COLUMN IF NOT EXISTS needs_delivery boolean NOT NULL DEFAULT false`)
    // A task price is spent per completion: each discounted purchase names the completion it was charged to.
    await rows(sql`ALTER TABLE market_items ADD COLUMN IF NOT EXISTS deal_uses int NOT NULL DEFAULT 1`)
    await rows(sql`ALTER TABLE market_requests ADD COLUMN IF NOT EXISTS deal_ref text`)
    // Products from before the delivery setting: the three the site already delivered keep doing so,
    // every other one goes to the staff queue instead of being marked delivered with nothing handed over.
    await rows(sql`UPDATE market_items SET
        delivery_mode = CASE WHEN id IN ('cark-hakki', 'zar-hakki', 'seri-kalkani') THEN 'auto' ELSE 'manual' END,
        reward_kind = CASE id WHEN 'cark-hakki' THEN 'cark' WHEN 'zar-hakki' THEN 'zar' WHEN 'seri-kalkani' THEN 'kalkan' END,
        reward_amount = CASE id WHEN 'cark-hakki' THEN 3 WHEN 'zar-hakki' THEN 5 WHEN 'seri-kalkani' THEN 1 ELSE 0 END
      WHERE delivery_mode IS NULL`)
    // The gold badge and the profile frame were sold with nothing behind them. Each now hands over its own badge
    // the moment it is bought. Only the untouched rows are converted, so a reward set in the panel is left alone.
    await rows(sql`UPDATE market_items SET
        delivery_mode = 'auto', reward_kind = 'rozet', reward_amount = 1,
        reward_ref = CASE id WHEN 'altin-rozet' THEN 'altin-kanka' ELSE 'ozel-cerceve' END,
        delivery = 'Satın alır almaz hesabına işlenir.',
        description = CASE id
          WHEN 'altin-rozet' THEN 'Avatarına altın çerçeve, sohbette ve sıralamada adının yanında Altın Kanka rozeti, markette Alkanka ürünlerinde kalıcı %10 indirim.'
          ELSE 'Avatarının etrafında ışığı dönen altın çerçeve. Profilinde, sohbette, sıralamada ve menüde görünür.' END
      WHERE id IN ('altin-rozet', 'profil-cercevesi') AND delivery_mode = 'manual' AND (reward_kind IS NULL OR reward_kind = 'none')`)
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
  deal_task_id: number | null; deal_price: number; deal_uses: number
}

function toProduct(r: ItemRow): MarketProduct {
  // A sponsor bonus is paid out on the sponsor's own site, so it can never deliver by itself.
  const reward: Reward | null =
    r.kind !== 'sponsor' && isRewardKind(r.reward_kind) && Number(r.reward_amount) > 0
      ? { kind: r.reward_kind, amount: Number(r.reward_amount), ref: r.reward_ref }
      : null
  const hasDeal = Number(r.deal_task_id) > 0 && Number(r.deal_price) > 0 && Number(r.deal_price) < Number(r.price)
  return {
    id: r.id, kind: r.kind, sponsorId: r.sponsor_id, sponsorName: r.sponsor_name, sponsorSlug: null, type: r.type, name: r.name,
    description: r.description, delivery: r.delivery, rules: Array.isArray(r.rules) ? r.rules : [], image: r.image,
    price: r.price, stock: r.stock, total: r.total, perUser: r.per_user, needsUsername: r.needs_username || r.kind === 'sponsor',
    active: r.active, sort: r.sort,
    deliveryMode: reward && r.delivery_mode === 'auto' ? 'auto' : 'manual',
    reward,
    featured: Boolean(r.featured),
    dealTaskId: hasDeal ? Number(r.deal_task_id) : null,
    dealPrice: hasDeal ? Number(r.deal_price) : 0,
    dealUses: Math.max(1, Math.floor(Number(r.deal_uses) || 1)),
    dealTask: null,
    sale: null,
    salePrice: r.price,
  }
}

/**
 * Fills in what a product costs right now: the running campaign and the state of its linked task.
 * `strict` is for a purchase, where a price that cannot be read must stop the sale instead of
 * quietly charging the list price.
 */
async function priced(items: MarketProduct[], strict = false): Promise<MarketProduct[]> {
  if (!items.length) return items
  const quiet = <T,>(fallback: T) => (e: unknown): T => {
    if (strict) throw e
    console.error('[market] fiyat bilgisi okunamadı', e)
    return fallback
  }
  const { liveSales } = await import('@/lib/market-sales')
  const sales = await liveSales().catch(quiet([] as Awaited<ReturnType<typeof liveSales>>))
  const linked = items.some((i) => i.dealTaskId)
  const tasks = new Map<number, { title: string; live: boolean; repeats: boolean }>()
  if (linked) {
    const { listTasks, isLiveTask } = await import('@/lib/tasks')
    for (const t of await listTasks().catch(quiet([] as Awaited<ReturnType<typeof listTasks>>))) tasks.set(t.id, { title: t.title, live: isLiveTask(t), repeats: t.period !== 'once' })
  }
  return items.map((item) => {
    const sale = bestSale(sales, item)
    return {
      ...item,
      sale: sale ? { id: sale.id, name: sale.name, pct: sale.pct, endsAt: sale.endsAt } : null,
      salePrice: afterPct(item.price, sale?.pct ?? 0),
      dealTask: item.dealTaskId ? (tasks.get(item.dealTaskId) ?? null) : null,
    }
  })
}

export type DealRights = {
  /** Linked tasks the member has finished in the current period. */
  done: number[]
  /** By product: how many more units the finished task still buys at the task price. */
  left: Record<string, number>
}

/** What the member's finished tasks are still worth in the market, so the site shows the price they will actually pay. */
export async function dealRights(userId: string): Promise<DealRights> {
  await ensure()
  const linked = await rows<{ id: string; task: number; uses: number }>(sql`SELECT id, deal_task_id AS task, deal_uses AS uses FROM market_items
    WHERE active AND deal_task_id IS NOT NULL AND deal_price > 0`)
  if (!linked.length) return { done: [], left: {} }
  const { completedTaskRefs } = await import('@/lib/tasks')
  const refs = await completedTaskRefs(userId)
  if (!refs.size) return { done: [], left: {} }
  const spent = await rows<{ item_id: string; deal_ref: string; c: string }>(sql`SELECT item_id, deal_ref, count(*) AS c FROM market_requests
    WHERE user_id = ${userId} AND deal_ref IS NOT NULL AND status <> 'reddedildi' GROUP BY item_id, deal_ref`)
  const left: Record<string, number> = {}
  for (const row of linked) {
    const ref = refs.get(Number(row.task))
    if (!ref) continue
    const used = Number(spent.find((s) => String(s.item_id) === String(row.id) && String(s.deal_ref) === ref)?.c ?? 0)
    left[String(row.id)] = Math.max(0, Math.max(1, Number(row.uses) || 1) - used)
  }
  return { done: [...new Set(linked.map((r) => Number(r.task)).filter((id) => refs.has(id)))], left }
}

/**
 * The task completion a discounted purchase is charged to, or null when the member has not finished the
 * task or has already bought every unit that completion covers.
 */
async function openDealRef(userId: string, item: MarketProduct): Promise<string | null> {
  if (!dealWins(item) || !item.dealTaskId) return null
  const { completedTaskRefs } = await import('@/lib/tasks')
  const ref = (await completedTaskRefs(userId)).get(item.dealTaskId)
  if (!ref) return null
  const used = await rows<{ c: string }>(sql`SELECT count(*) AS c FROM market_requests
    WHERE user_id = ${userId} AND item_id = ${item.id} AND deal_ref = ${ref} AND status <> 'reddedildi'`)
  return Number(used[0]?.c ?? 0) < item.dealUses ? ref : null
}

export type LinkedSponsorAccount = { username: string; status: 'pending' | 'approved' }

/**
 * The sponsor accounts this member has linked (waiting for staff or approved), by sponsor slug. An
 * account staff turned down is not linked. Before any member has linked one the table does not exist
 * yet, which simply means nobody has an account; any other failure stops the purchase.
 */
export async function linkedSponsorAccounts(userId: string): Promise<Record<string, LinkedSponsorAccount>> {
  const found = await rows<{ site_id: string; username: string; status: string }>(
    sql`SELECT site_id, username, status FROM sponsor_accounts WHERE user_id = ${userId} AND status <> 'rejected'`,
  ).catch((error) => {
    const e = error as { code?: string; cause?: { code?: string } }
    if ((e?.code ?? e?.cause?.code) === '42P01') return []
    throw error
  })
  return Object.fromEntries(
    found.filter((r) => String(r.username).trim()).map((r) => [String(r.site_id), { username: String(r.username), status: r.status === 'approved' ? 'approved' : 'pending' }]),
  )
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
  const items = await priced(await withSponsorSlugs(r.map(toProduct)))
  if (opts.includeInactive) return items
  return items.filter((item) => item.kind !== 'sponsor' || item.sponsorSlug)
}

export type ProductInput = Omit<MarketProduct, 'id' | 'needsUsername' | 'sponsorSlug' | 'dealTask' | 'sale' | 'salePrice'> & { id: string | null; needsUsername: boolean }

const MAX_PRICE = 10_000_000
const MAX_STOCK = 100_000
const MAX_DEAL_USES = 100
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
  const deal = await cleanDeal(input, price, reward)
  // A new product goes to the end of the list; an edited one keeps the place it was dragged to.
  const sort = input.id ? int(input.sort, 0, 99_999) : null
  await rows(sql`INSERT INTO market_items (id, kind, sponsor_id, sponsor_name, type, name, description, delivery, rules, image, price, stock, total, per_user, needs_username, active, sort,
      delivery_mode, reward_kind, reward_amount, reward_ref, featured, deal_task_id, deal_price, deal_uses)
    VALUES (${id}, ${kind}, ${kind === 'sponsor' ? clean(input.sponsorId, 80) || null : null}, ${sponsorName}, ${clean(input.type, 30) || 'HEDİYE'}, ${name},
      ${clean(input.description, 600)}, ${clean(input.delivery, 300)}, ${JSON.stringify(rules)}::jsonb, ${image},
      ${price}, ${stock}, ${total}, ${int(input.perUser, 1, 100)}, ${Boolean(input.needsUsername) || kind === 'sponsor'},
      ${input.active !== false}, COALESCE(${sort}::int, (SELECT COALESCE(max(sort), -1) + 1 FROM market_items)),
      ${reward ? 'auto' : 'manual'}, ${reward?.kind ?? null}, ${reward?.amount ?? 0}, ${reward?.ref ?? null}, ${Boolean(input.featured)},
      ${deal.taskId}, ${deal.price}, ${deal.uses})
    ON CONFLICT (id) DO UPDATE SET kind = EXCLUDED.kind, sponsor_id = EXCLUDED.sponsor_id, sponsor_name = EXCLUDED.sponsor_name,
      type = EXCLUDED.type, name = EXCLUDED.name, description = EXCLUDED.description, delivery = EXCLUDED.delivery, rules = EXCLUDED.rules,
      image = EXCLUDED.image, price = EXCLUDED.price, stock = EXCLUDED.stock, total = EXCLUDED.total, per_user = EXCLUDED.per_user,
      needs_username = EXCLUDED.needs_username, active = EXCLUDED.active, sort = EXCLUDED.sort,
      delivery_mode = EXCLUDED.delivery_mode, reward_kind = EXCLUDED.reward_kind, reward_amount = EXCLUDED.reward_amount,
      reward_ref = EXCLUDED.reward_ref, featured = EXCLUDED.featured,
      deal_task_id = EXCLUDED.deal_task_id, deal_price = EXCLUDED.deal_price, deal_uses = EXCLUDED.deal_uses`)
  // The task list shows this price on the task itself; it reads a shared copy, which is stale the moment a product changes.
  await import('@/lib/shared-read').then((m) => m.forgetSharedRead('tasks:market-deals'))
  return id
}

/** The task price of a product, checked so it is always a real discount tied to a task members can find. */
async function cleanDeal(input: ProductInput, price: number, reward: Reward | null): Promise<{ taskId: number | null; price: number; uses: number }> {
  const taskId = Math.floor(Number(input.dealTaskId) || 0)
  if (taskId < 1) return { taskId: null, price: 0, uses: 1 }
  const { listTasks } = await import('@/lib/tasks')
  const task = (await listTasks()).find((t) => t.id === taskId)
  if (!task) throw new Error('Seçilen görev bulunamadı. Görevler ekranından kontrol et.')
  if (task.archived) throw new Error(`"${task.title}" arşivde. Üyenin tamamlayabileceği bir görev seç.`)
  const dealPrice = Math.floor(Number(input.dealPrice) || 0)
  if (dealPrice < 1) throw new Error('Görevi tamamlayanın ödeyeceği fiyatı yaz.')
  if (dealPrice >= price) throw new Error(`Görev fiyatı (${dealPrice.toLocaleString('tr-TR')} KC) normal fiyattan (${price.toLocaleString('tr-TR')} KC) düşük olmalı.`)
  if (reward?.kind === 'kc' && dealPrice <= reward.amount) {
    throw new Error(`Görev fiyatı (${dealPrice.toLocaleString('tr-TR')} KC) ürünün verdiği coinden (${reward.amount.toLocaleString('tr-TR')} KC) fazla olmalı; yoksa ürün bedava coin dağıtır.`)
  }
  const uses = Math.floor(Number(input.dealUses) || 1)
  if (uses < 1 || uses > MAX_DEAL_USES) throw new Error(`Görev başına indirimli adet 1 ile ${MAX_DEAL_USES} arasında olmalı.`)
  return { taskId, price: dealPrice, uses }
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

/**
 * `expected` is the price the member was shown. A campaign can end while the page is open; the purchase
 * is refused rather than charging more than the screen said.
 */
export async function requestProduct(member: Member, itemId: string, siteUsername: string | null, expected: number | null = null) {
  const { withUserLock } = await import('@/lib/user-lock')
  return withUserLock(`market:${member.id}`, () => requestProductLocked(member, itemId, siteUsername, expected))
}

async function requestProductLocked(member: Member, itemId: string, siteUsername: string | null, expected: number | null) {
  await ensure()
  const found = await rows<ItemRow>(sql`SELECT * FROM market_items WHERE id = ${itemId} AND active`)
  if (!found[0]) throw new Error('Ürün bulunamadı.')
  // The sponsor's slug is what a linked account is filed under; a stored product row does not carry it.
  const [item] = await withSponsorSlugs(await priced([toProduct(found[0])], true))
  // A sponsor reward goes to the account the member linked at that sponsor. The form's own field is read
  // only when there is none, so a typo cannot send the reward to somebody else's account.
  const linked = item.kind === 'sponsor' && item.sponsorSlug ? (await linkedSponsorAccounts(member.id))[item.sponsorSlug] : undefined
  const username = linked?.username ?? clean(siteUsername, 60)
  if (item.needsUsername && username.length < 2) throw new Error('Site kullanıcı adını yazmalısın.')

  const used = await rows<{ c: string }>(sql`SELECT count(*) AS c FROM market_requests
    WHERE user_id = ${member.id} AND item_id = ${item.id} AND status <> 'reddedildi'`)
  if (Number(used[0]?.c ?? 0) >= item.perUser) throw new Error(`Bu üründen en fazla ${item.perUser} adet alabilirsin.`)
  const { marketDiscountPct, discounted } = await import('@/lib/boosts')
  const pct = item.kind === 'sponsor' ? 0 : await marketDiscountPct(member.id).catch(() => 0)
  const dealRef = await openDealRef(member.id, item)
  const viaTask = dealRef != null
  let price = discounted(viaTask ? item.dealPrice : item.salePrice, pct)
  // Whatever discounts stack up, a product that hands out coins always costs more than it gives.
  if (item.deliveryMode === 'auto' && item.reward?.kind === 'kc') price = Math.min(item.price, Math.max(price, item.reward.amount + 1))
  if (expected != null && Number.isFinite(expected) && price > expected) {
    throw new Error(`Fiyat değişti: bu ürün şu an ${price.toLocaleString('tr-TR')} KC. Sayfayı yenileyip tekrar dene.`)
  }
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
  const [request] = await rows<{ id: number }>(sql`INSERT INTO market_requests (item_id, item_name, sponsor_name, user_id, user_name, site_username, price, status, needs_delivery, deal_ref)
    VALUES (${item.id}, ${item.name}, ${item.sponsorName}, ${member.id}, ${member.name}, ${username || null}, ${price}, 'beklemede', ${Boolean(reward)}, ${dealRef})
    RETURNING id`)
  await recordHistory({ userId: member.id, userName: member.name, game: 'market', mode: 'harcama', opponent: item.name, stake: price, result: 'loss', delta: -price })

  let delivered: Delivered = null
  // True when the staff settled the request while the purchase was still running: nothing is left for them to do.
  let settled = false
  if (reward) {
    try {
      delivered = await deliverReward(member.id, reward, { request: request.id, label: item.name, note: AUTO_NOTE })
      settled = delivered === null
    } catch (e) {
      console.error('[market] otomatik teslim olmadı', item.id, e)
      // Only a request still waiting for its reward is flagged for the staff.
      await rows(sql`UPDATE market_requests SET note = ${AUTO_FAILED_NOTE} WHERE id = ${request.id} AND needs_delivery`).catch(() => {})
    }
  }
  if (delivered || settled) return { ...item, price, delivered }
  const { notifyApproval } = await import('@/lib/telegram-bots')
  await notifyApproval('market', {
    uye: member.name,
    detay: `${item.name} (${price} KC${viaTask ? ', görev fiyatı' : item.sale ? `, ${item.sale.name} %${item.sale.pct}` : ''}${pct ? `, %${pct} indirimli` : ''})${username ? ` · Site kullanıcı adı: ${username}${linked ? ` (bağlı hesap, ${linked.status === 'approved' ? 'onaylı' : 'onay bekliyor'})` : ''}` : ''}`,
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

type Db = Pick<PoolClient, 'query'>

/** What a reward settles: `request` is the purchase it closes (null for a prize, which has none) and `note` what that request then says. */
type Handover = { request: number | null; label: string; note: string | null }

/**
 * Closes a request as delivered, on the connection that also writes its reward. False when the request is
 * not waiting for one any more: it was already delivered, or it was rejected and refunded.
 */
async function claimDelivery(db: Db, from: Handover): Promise<boolean> {
  if (from.request == null) return true
  const closed = await db.query(
    `UPDATE market_requests SET needs_delivery = false, status = 'onaylandi', note = $2, resolved_at = now()
     WHERE id = $1 AND needs_delivery AND status = 'beklemede' RETURNING id`,
    [from.request, from.note],
  )
  return (closed.rowCount ?? 0) > 0
}

/** Runs `give` in the transaction that closes the request: both are saved or neither is. Null when the request was already closed. */
async function handOver<T>(from: Handover, give: (db: Db) => Promise<T>): Promise<T | null> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    if (!(await claimDelivery(client, from))) {
      await client.query('ROLLBACK')
      return null
    }
    const given = await give(client)
    await client.query('COMMIT')
    return given
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    client.release()
  }
}

/**
 * Puts a reward on the account and closes the request it belongs to in the same step, so a purchase is
 * paid exactly once however often delivery is tried. Null means that request had already been closed and
 * nothing was written; a throw means nothing was written and the request is still waiting.
 */
async function deliverReward(userId: string, reward: Reward, from: Handover): Promise<Delivered> {
  const amount = Math.floor(Number(reward.amount) || 0)
  if (reward.kind === 'cark' || reward.kind === 'zar' || reward.kind === 'sandik') {
    const game = reward.kind
    const { grantExtraPlays } = await import('@/lib/mini-extras')
    return handOver(from, async (db) => ({ kind: 'plays' as const, game, amount, total: await grantExtraPlays(userId, game, amount, db) }))
  }
  if (reward.kind === 'kalkan') {
    await rows(sql`CREATE TABLE IF NOT EXISTS streak_shields (user_id text PRIMARY KEY, count int NOT NULL DEFAULT 0, used int NOT NULL DEFAULT 0, updated_at timestamptz NOT NULL DEFAULT now())`)
    return handOver(from, async (db) => {
      const r = await db.query<{ count: number }>(
        `INSERT INTO streak_shields (user_id, count) VALUES ($1, $2)
         ON CONFLICT (user_id) DO UPDATE SET count = streak_shields.count + EXCLUDED.count, updated_at = now() RETURNING count`,
        [userId, amount],
      )
      return { kind: 'shield' as const, amount, total: Number(r.rows[0]?.count ?? amount) }
    })
  }
  if (reward.kind === 'kc') {
    const paid = await creditClaimed(userId, amount, 'Market ödülü', (db) => claimDelivery(db, from))
    return paid ? { kind: 'kc', amount } : null
  }
  if (reward.kind === 'kp') {
    const { ensureKp } = await import('@/lib/kanka-puan')
    await ensureKp()
    const ref = from.request == null ? null : `market:${from.request}`
    return handOver(from, async (db) => {
      await db.query(
        `INSERT INTO kp_events (user_id, source, points, ref, note) VALUES ($1, 'market', $2, $3, $4) ON CONFLICT DO NOTHING`,
        [userId, amount, ref, from.label.slice(0, 120)],
      )
      return { kind: 'kp' as const, amount }
    })
  }
  const { awardBadge } = await import('@/lib/kanka-puan')
  const badgeId = reward.ref
  if (!badgeId) throw new Error('Ürüne rozet bağlanmamış.')
  // The badge is saved on its own connection while this one holds the request. If it fails the request
  // stays open; if only the closing fails, the next try finds the badge already there and changes nothing.
  return handOver(from, async () => {
    await awardBadge(badgeId, userId, 'market', from.label)
    const [badge] = await rows<{ name: string }>(sql`SELECT name FROM kp_badges WHERE id = ${badgeId}`)
    return { kind: 'badge' as const, name: badge?.name ?? 'Rozet' }
  })
}

/** Hands over a product won as a prize. Null means the site cannot deliver this product by itself. */
export async function deliverInSiteItem(userId: string, itemId: string): Promise<Delivered> {
  await ensure()
  const [row] = await rows<ItemRow>(sql`SELECT * FROM market_items WHERE id = ${itemId}`)
  const item = row ? toProduct(row) : null
  if (!item || item.deliveryMode !== 'auto' || !item.reward) return null
  return deliverReward(userId, item.reward, { request: null, label: item.name, note: null })
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
    const gone = 'Talep bulunamadı ya da zaten sonuçlandı.'
    const staffNote = clean(note, 300) || null
    const [req] = await rows<ReqRow>(sql`SELECT * FROM market_requests WHERE id = ${id} AND status = 'beklemede'`)
    if (!req) throw new Error(gone)
    if (!req.needs_delivery) {
      const closed = await rows(sql`UPDATE market_requests SET status = 'onaylandi', note = ${staffNote}, resolved_at = now()
        WHERE id = ${id} AND status = 'beklemede' AND needs_delivery IS NOT TRUE RETURNING id`)
      if (!closed.length) throw new Error(gone)
      return
    }
    // An automatic product whose delivery failed at purchase: approving is what hands it over. The request
    // is closed in the same step as the reward, so it is still waiting when that fails.
    let given: Delivered
    try {
      const [row] = await rows<ItemRow>(sql`SELECT * FROM market_items WHERE id = ${req.item_id}`)
      const reward = row ? toProduct(row).reward : null
      if (!reward) throw new Error('Ürünün otomatik ödülü kaldırılmış. Ödülü elle verip ürünü "elle teslim" yap, sonra tekrar onayla.')
      given = await deliverReward(req.user_id, reward, { request: req.id, label: req.item_name, note: staffNote })
    } catch (e) {
      throw new Error(`Ödül hesaba eklenemedi, talep beklemede kaldı. ${shownError(e, '', '[market] onayda teslim olmadı')}`.trim())
    }
    if (!given) throw new Error(gone)
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
