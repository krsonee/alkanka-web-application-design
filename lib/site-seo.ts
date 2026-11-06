import 'server-only'
import { rows, sql } from '@/lib/db'
import { PAGE_SEO } from '@/lib/seo'

export type SiteSeo = { title: string; description: string; keywords: string }

const KEYS = { title: 'site_title', description: 'site_description', keywords: 'site_keywords' } as const

let ready: Promise<unknown> | null = null
function ensureTable() {
  ready ??= rows(sql`CREATE TABLE IF NOT EXISTS seo_settings (key text PRIMARY KEY, value text NOT NULL)`).catch((error) => {
    ready = null
    throw error
  })
  return ready
}

export async function getSiteSeo(): Promise<SiteSeo> {
  const empty: SiteSeo = { title: '', description: '', keywords: '' }
  try {
    await ensureTable()
    const data = await rows<{ key: string; value: string }>(
      sql`SELECT key, value FROM seo_settings WHERE key IN (${KEYS.title}, ${KEYS.description}, ${KEYS.keywords})`,
    )
    for (const r of data) {
      if (r.key === KEYS.title) empty.title = r.value
      if (r.key === KEYS.description) empty.description = r.value
      if (r.key === KEYS.keywords) empty.keywords = r.value
    }
    return empty
  } catch {
    return empty
  }
}

export async function setSiteSeo(v: SiteSeo) {
  await ensureTable()
  for (const k of Object.keys(KEYS) as (keyof SiteSeo)[]) {
    await rows(sql`INSERT INTO seo_settings (key, value) VALUES (${KEYS[k]}, ${v[k]})
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`)
  }
}

export function parseKeywords(raw: string) {
  const seen = new Set<string>()
  return raw
    .split(/[,\n]/)
    .map((k) => k.trim().replace(/\s+/g, ' '))
    .filter((k) => {
      const key = k.toLocaleLowerCase('tr')
      if (!k || seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, 20)
}

/** Panelde girilen değerler; boş alanlarda koddaki varsayılan ana sayfa değerleri kullanılır. */
export async function resolvedHomeSeo() {
  const site = await getSiteSeo()
  const home = PAGE_SEO.anasayfa
  const keywords = parseKeywords(site.keywords)
  return {
    title: site.title || home.title,
    description: site.description || home.description,
    keywords: keywords.length ? keywords : home.keywords,
  }
}
