import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!)

let ready: Promise<unknown> | null = null
function ensureTable() {
  ready ??= sql`CREATE TABLE IF NOT EXISTS site_content (
    key text PRIMARY KEY,
    value jsonb NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
  )`
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

export async function setContent(key: string, value: unknown) {
  await ensureTable()
  await sql`INSERT INTO site_content (key, value, updated_at)
    VALUES (${key}, ${JSON.stringify(value)}::jsonb, now())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`
}

export async function deleteContent(key: string) {
  await ensureTable()
  await sql`DELETE FROM site_content WHERE key = ${key}`
}

export function withoutEmpty<T extends Record<string, unknown>>(obj: T | null | undefined): Partial<T> {
  if (!obj) return {}
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => typeof v === 'string' && v.trim() !== '')) as Partial<T>
}
