import 'server-only'
import { rows, sql } from '@/lib/db'

let ready: Promise<unknown> | null = null
function ensureTable() {
  ready ??= rows(sql`CREATE TABLE IF NOT EXISTS site_content (
    key text PRIMARY KEY,
    value jsonb NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
  )`).catch((error) => {
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
  href?: string
  hidden?: boolean
}

export const EXTRA_SLIDES_KEY = 'slides:extra'
export const EXTRA_HEROES_KEY = 'heroes:extra'

export type ExtraHero = { slug: string; label: string; path: string }

const SAFE_ID = /^[a-z0-9-]{1,40}$/

export function extraSlideIds(content: Record<string, unknown>) {
  const raw = content[EXTRA_SLIDES_KEY]
  return Array.isArray(raw) ? raw.filter((id): id is string => typeof id === 'string' && SAFE_ID.test(id)) : []
}

export function extraHeroes(content: Record<string, unknown>): ExtraHero[] {
  const raw = content[EXTRA_HEROES_KEY]
  if (!Array.isArray(raw)) return []
  return raw.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const row = item as ExtraHero
    if (!SAFE_ID.test(row.slug) || typeof row.label !== 'string') return []
    return [{ slug: row.slug, label: row.label.slice(0, 60), path: typeof row.path === 'string' ? row.path : `/sayfa/${row.slug}` }]
  })
}

export type LogoKind = 'sponsors' | 'teams'

export async function getLogos() {
  const all = await getAllContent()
  return {
    sponsors: (all['logos:sponsors'] as Record<string, string> | undefined) ?? {},
    teams: (all['logos:teams'] as Record<string, string> | undefined) ?? {},
  }
}

export async function getContent<T>(key: string): Promise<T | null> {
  try {
    await ensureTable()
    const found = await rows<{ value: T }>(sql`SELECT value FROM site_content WHERE key = ${key}`)
    return found[0]?.value ?? null
  } catch (error) {
    console.error('[content] okunamadı', key, error)
    return null
  }
}

export async function getAllContent(): Promise<Record<string, unknown>> {
  try {
    await ensureTable()
    const found = await rows<{ key: string; value: unknown }>(sql`SELECT key, value FROM site_content`)
    return Object.fromEntries(found.map((row) => [row.key, row.value]))
  } catch (error) {
    console.error('[content] liste okunamadı', error)
    return {}
  }
}

export async function setContent(key: string, value: unknown) {
  await ensureTable()
  await rows(sql`INSERT INTO site_content (key, value, updated_at)
    VALUES (${key}, ${JSON.stringify(value)}::jsonb, now())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`)
}

export async function deleteContent(key: string) {
  await ensureTable()
  await rows(sql`DELETE FROM site_content WHERE key = ${key}`)
}

export function withoutEmpty<T extends Record<string, unknown>>(obj: T | null | undefined): Partial<T> {
  if (!obj) return {}
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => typeof v === 'string' && v.trim() !== '')) as Partial<T>
}
