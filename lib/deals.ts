import 'server-only'
import { rows, sql } from '@/lib/db'
import { slugify } from '@/lib/seo'
import { decodeEntities } from '@/lib/html-entities'
import { FILTER_PRESETS } from '@/lib/telegram-filters'

import { parseOddsPost } from '@/lib/odds-parse'
import { DEAL_LABELS, type Deal, type DealKind, type ParsedOdd, type Verification } from '@/lib/deal-types'

export { DEAL_LABELS, type Deal, type DealKind, type ParsedOdd, type Verification }

let ready: Promise<unknown> | null = null
function ensureTable() {
  ready ??= (async () => {
    await rows(sql`CREATE TABLE IF NOT EXISTS deals (
      id serial PRIMARY KEY, source_id int, post_id int, brand text NOT NULL, kind text NOT NULL, title text NOT NULL,
      body text NOT NULL, photo text, link text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (source_id, post_id))`)
    await rows(sql`ALTER TABLE deals ADD COLUMN IF NOT EXISTS odds jsonb`)
    await rows(sql`CREATE TABLE IF NOT EXISTS seo_settings (key text PRIMARY KEY, value text NOT NULL)`)
  })().catch((error) => {
    ready = null
    throw error
  })
  return ready
}

function detectKind(text: string): DealKind {
  const lower = text.toLocaleLowerCase('tr')
  const hit = FILTER_PRESETS.find((p) => p.words.some((w) => lower.includes(w)))
  return (hit?.id as DealKind | undefined) ?? 'genel'
}

function map(r: Record<string, unknown>): Deal {
  const title = decodeEntities(String(r.title))
  return {
    id: Number(r.id),
    slug: `${r.id}-${slugify(`${r.brand} ${title}`)}`,
    brand: String(r.brand),
    kind: String(r.kind) as DealKind,
    title,
    body: String(r.body),
    photo: r.photo ? String(r.photo) : null,
    link: String(r.link),
    createdAt: new Date(String(r.created_at)).toISOString(),
    odds: Array.isArray(r.odds) ? (r.odds as ParsedOdd[]) : null,
  }
}

export async function dealsPublishing() {
  try {
    await ensureTable()
    const r = await rows(sql`SELECT value FROM seo_settings WHERE key = 'publish_deals'`)
    return r.length ? r[0].value === '1' : true
  } catch {
    return false
  }
}

export async function setDealsPublishing(on: boolean) {
  await ensureTable()
  await rows(sql`INSERT INTO seo_settings (key, value) VALUES ('publish_deals', ${on ? '1' : '0'})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`)
}

export async function recordDeal(input: { sourceId: number; postId: number; brand: string; text: string; photo: string | null; link: string }) {
  const text = input.text.replace(/\s+\n/g, '\n').trim()
  if (text.length < 15) return
  if (!(await dealsPublishing())) return
  const firstLine = text.split('\n').find((l) => l.trim().length > 3) ?? text
  const title = firstLine.trim().slice(0, 90)
  const kind = detectKind(text)
  const odds = kind === 'oran' ? await parseOddsPost(text) : null
  const inserted = await rows(sql`INSERT INTO deals (source_id, post_id, brand, kind, title, body, photo, link, odds)
    VALUES (${input.sourceId}, ${input.postId}, ${input.brand}, ${kind}, ${title}, ${text.slice(0, 4000)}, ${input.photo}, ${input.link},
      ${odds ? JSON.stringify(odds) : null}::jsonb)
    ON CONFLICT (source_id, post_id) DO NOTHING RETURNING id`)
  if (inserted.length && odds?.length) {
    const { notifyOddsAlerts } = await import('@/lib/community')
    await notifyOddsAlerts(input.brand, input.link, odds)
  }
}

const LIVE_ODDS_HOURS = 72
const BACKFILL_PER_REQUEST = 3

export async function listLiveOdds(limit = 40) {
  try {
    await ensureTable()
    const r = await rows(sql`SELECT * FROM deals WHERE kind = 'oran' AND created_at > now() - make_interval(hours => ${LIVE_ODDS_HOURS})
      ORDER BY created_at DESC LIMIT ${limit}`)
    const deals = r.map(map)
    const missing = deals.filter((d) => d.odds === null).slice(0, BACKFILL_PER_REQUEST)
    for (const deal of missing) {
      deal.odds = await parseOddsPost(deal.body)
      await rows(sql`UPDATE deals SET odds = ${JSON.stringify(deal.odds)}::jsonb WHERE id = ${deal.id}`)
    }
    return deals
  } catch (error) {
    console.error('[deals] canlı oranlar okunamadı', error)
    return []
  }
}

export async function listDeals(limit = 60, kind?: DealKind) {
  try {
    await ensureTable()
    const r = kind
      ? await rows(sql`SELECT * FROM deals WHERE kind = ${kind} ORDER BY created_at DESC LIMIT ${limit}`)
      : await rows(sql`SELECT * FROM deals ORDER BY created_at DESC LIMIT ${limit}`)
    return r.map(map)
  } catch (error) {
    console.error('[deals] liste okunamadı', error)
    return []
  }
}

export const DEAL_FRESH_DAYS = 7

export async function listDealsByBrand(brand: string, limit = 30) {
  try {
    await ensureTable()
    const r = await rows(sql`SELECT * FROM deals WHERE lower(brand) = lower(${brand.trim()})
      ORDER BY created_at DESC LIMIT ${limit}`)
    return r.map(map)
  } catch (error) {
    console.error('[deals] marka fırsatları okunamadı', error)
    return []
  }
}

export async function latestDealByBrand() {
  try {
    await ensureTable()
    const r = await rows(sql`SELECT lower(brand) AS brand, max(created_at) AS at FROM deals GROUP BY 1`)
    return new Map(r.map((x) => [String(x.brand), new Date(String(x.at))]))
  } catch {
    return new Map<string, Date>()
  }
}

export async function getDeal(slug: string) {
  const id = Number.parseInt(slug, 10)
  if (!Number.isFinite(id)) return null
  try {
    await ensureTable()
    const r = await rows(sql`SELECT * FROM deals WHERE id = ${id}`)
    return r.length ? map(r[0]) : null
  } catch {
    return null
  }
}

export async function deleteDeal(id: number) {
  await ensureTable()
  await rows(sql`DELETE FROM deals WHERE id = ${id}`)
}


export async function getVerification(): Promise<Verification> {
  try {
    await ensureTable()
    const r = await rows(sql`SELECT key, value FROM seo_settings WHERE key IN ('verify_google', 'verify_bing', 'verify_yandex', 'verify_meta')`)
    const get = (k: string) => String(r.find((x) => x.key === k)?.value ?? '')
    return { google: get('verify_google'), bing: get('verify_bing'), yandex: get('verify_yandex'), meta: get('verify_meta') }
  } catch {
    return { google: '', bing: '', yandex: '', meta: '' }
  }
}

export async function setVerification(v: Verification) {
  await ensureTable()
  for (const [k, value] of Object.entries(v)) {
    await rows(sql`INSERT INTO seo_settings (key, value) VALUES (${`verify_${k}`}, ${value})
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`)
  }
}

export function extractVerificationCode(input: string) {
  const trimmed = input.trim()
  const fromMeta = trimmed.match(/content=["']([^"']+)["']/i)
  const raw = fromMeta ? fromMeta[1] : trimmed
  // DNS TXT formatı da yapıştırılabiliyor: "google-site-verification=KOD", "yandex-verification: KOD"
  const withoutPrefix = raw.replace(/^\s*(google-site-verification|yandex-verification|msvalidate\.01|facebook-domain-verification)\s*[=:]\s*/i, '')
  return withoutPrefix.replace(/[^A-Za-z0-9_\-]/g, '').slice(0, 120)
}
