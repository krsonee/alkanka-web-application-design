import { neon, neonConfig } from '@neondatabase/serverless'
import { trackedSetting } from '@/lib/panel-log-shared'

/** Longest a settings query may wait for its answer. */
const READ_LIMIT_MS = 20_000

// These queries travel over HTTP and `fetch` has no time limit of its own: a request the database never
// answered kept the page waiting until the platform killed it five minutes later.
neonConfig.fetchFunction = (input: RequestInfo | URL, init?: RequestInit) => {
  const limit = AbortSignal.timeout(READ_LIMIT_MS)
  return fetch(input, { ...init, signal: init?.signal ? AbortSignal.any([init.signal, limit]) : limit })
}

const sql = neon(process.env.DATABASE_URL!)

const HISTORY_PER_KEY = 40

// Client components reach this file through the settings modules they take constants from, so it
// must not import anything server-only. The panel session code registers itself here instead.
let actorResolver: (() => Promise<string | null>) | null = null
export function setContentActorResolver(resolve: () => Promise<string | null>) {
  actorResolver = resolve
}

let historyReady: Promise<unknown> | null = null
export function ensureContentHistory() {
  historyReady ??= (async () => {
    await sql`CREATE TABLE IF NOT EXISTS site_content_history (
      id bigserial PRIMARY KEY, key text NOT NULL, before jsonb, after jsonb, actor text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now())`
    await sql`CREATE INDEX IF NOT EXISTS site_content_history_key ON site_content_history (key, created_at DESC)`
  })().catch((error) => {
    historyReady = null
    throw error
  })
  return historyReady
}

/** Keeps the state a tracked setting had before a save. Never throws: history must not be the reason a save fails. */
async function recordContentChange(key: string, before: unknown, after: unknown) {
  try {
    if (!trackedSetting(key)) return
    const prev = before === undefined || before === null ? null : JSON.stringify(before)
    const next = after === undefined || after === null ? null : JSON.stringify(after)
    if (prev === next) return
    await ensureContentHistory()
    const actor = (await actorResolver?.().catch(() => null)) || 'sistem'
    await sql`INSERT INTO site_content_history (key, before, after, actor) VALUES (${key}, ${prev}::jsonb, ${next}::jsonb, ${actor})`
    await sql`DELETE FROM site_content_history WHERE key = ${key} AND id NOT IN (
      SELECT id FROM site_content_history WHERE key = ${key} ORDER BY created_at DESC, id DESC LIMIT ${HISTORY_PER_KEY})`
  } catch (error) {
    console.error('[content-history]', key, error)
  }
}

// A Neon HTTP query is sent again every time it is awaited, so the stored value has to be a real
// promise: keeping the query itself made every read send the table setup first.
let ready: Promise<unknown> | null = null
function ensureTable() {
  ready ??= (async () => {
    await sql`CREATE TABLE IF NOT EXISTS site_content (
      key text PRIMARY KEY,
      value jsonb NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )`
  })().catch((error) => {
    ready = null
    throw error
  })
  return ready
}

export type HeroOverride = {
  eyebrow?: string
  title?: string
  description?: string
  speech?: string
  image?: string
  pose?: string
}

export type SlideOverride = {
  eyebrow?: string
  title?: string
  description?: string
  cta?: string
  image?: string
  mobileImage?: string
  startAt?: string
  endAt?: string
}

export type LogoKind = 'sponsors' | 'teams'

export async function getLogos() {
  const all = await getAllContent()
  return {
    sponsors: (all['logos:sponsors'] as Record<string, string> | undefined) ?? {},
    teams: (all['logos:teams'] as Record<string, string> | undefined) ?? {},
    brand: (() => {
      const b = all['site:branding'] as { logoUrl?: string; logoHeight?: number } | undefined
      return b?.logoUrl ? { logoUrl: b.logoUrl, logoHeight: b.logoHeight } : undefined
    })(),
  }
}

export async function getContent<T>(key: string): Promise<T | null> {
  try {
    await ensureTable()
    const rows = await sql`SELECT value FROM site_content WHERE key = ${key}`
    return (rows[0]?.value as T) ?? null
  } catch (error) {
    console.error('[content] okunamadı', key, error)
    return null
  }
}

export async function getAllContent(): Promise<Record<string, unknown>> {
  try {
    await ensureTable()
    const rows = await sql`SELECT key, value FROM site_content`
    return Object.fromEntries(rows.map((r) => [r.key as string, r.value]))
  } catch (error) {
    console.error('[content] liste okunamadı', error)
    return {}
  }
}

async function currentValue(key: string): Promise<unknown> {
  const rows = await sql`SELECT value FROM site_content WHERE key = ${key}`
  return rows[0]?.value ?? null
}

export async function setContent(key: string, value: unknown) {
  await ensureTable()
  const before = trackedSetting(key) ? await currentValue(key) : null
  await sql`INSERT INTO site_content (key, value, updated_at)
    VALUES (${key}, ${JSON.stringify(value)}::jsonb, now())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`
  await recordContentChange(key, before, value)
}

export async function deleteContent(key: string) {
  await ensureTable()
  const before = trackedSetting(key) ? await currentValue(key) : null
  await sql`DELETE FROM site_content WHERE key = ${key}`
  await recordContentChange(key, before, null)
}

export function withoutEmpty<T extends Record<string, unknown>>(obj: T | null | undefined): Partial<T> {
  if (!obj) return {}
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => typeof v === 'string' && v.trim() !== '')) as Partial<T>
}
