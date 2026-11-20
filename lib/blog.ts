import 'server-only'
import { rows, sql } from '@/lib/db'
import { parseLocal } from '@/lib/schedule'
import { slugify } from '@/lib/seo'

export type BlogPost = {
  id: number
  slug: string
  title: string
  excerpt: string
  body: string
  cover: string
  keywords: string
  published: boolean
  /** Istanbul time as YYYY-MM-DDTHH:mm, or empty when the post goes out as soon as it is published. */
  publishAt: string
  /** Marked published but its time has not come yet, so the site does not show it. */
  scheduled: boolean
  /** The day readers see: the scheduled time when there is one, otherwise when the post was written. */
  createdAt: string
  updatedAt: string
}

let ready: Promise<unknown> | null = null
function ensureTable() {
  ready ??= rows(sql`CREATE TABLE IF NOT EXISTS blog_posts (
    id serial PRIMARY KEY, slug text NOT NULL UNIQUE, title text NOT NULL, excerpt text NOT NULL DEFAULT '',
    body text NOT NULL DEFAULT '', cover text NOT NULL DEFAULT '', keywords text NOT NULL DEFAULT '',
    published boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now())`)
    .then(() => rows(sql`ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS publish_at timestamptz`))
    .catch((error) => {
      ready = null
      throw error
    })
  return ready
}

function map(r: Record<string, unknown>): BlogPost {
  const publishAt = r.publish_at ? new Date(String(r.publish_at)) : null
  return {
    id: Number(r.id),
    slug: String(r.slug),
    title: String(r.title),
    excerpt: String(r.excerpt),
    body: String(r.body),
    cover: String(r.cover),
    keywords: String(r.keywords),
    published: Boolean(r.published),
    publishAt: String(r.publish_local ?? ''),
    scheduled: Boolean(r.published) && !!publishAt && publishAt.getTime() > Date.now(),
    createdAt: (publishAt ?? new Date(String(r.created_at))).toISOString(),
    updatedAt: new Date(String(r.updated_at)).toISOString(),
  }
}

export async function listPosts({ includeDrafts = false } = {}) {
  try {
    await ensureTable()
    const r = includeDrafts
      ? await rows(sql`SELECT *, to_char(publish_at AT TIME ZONE 'Europe/Istanbul', 'YYYY-MM-DD"T"HH24:MI') AS publish_local
          FROM blog_posts ORDER BY COALESCE(publish_at, created_at) DESC`)
      : await rows(sql`SELECT *, to_char(publish_at AT TIME ZONE 'Europe/Istanbul', 'YYYY-MM-DD"T"HH24:MI') AS publish_local
          FROM blog_posts WHERE published AND (publish_at IS NULL OR publish_at <= now()) ORDER BY COALESCE(publish_at, created_at) DESC`)
    return r.map(map)
  } catch (error) {
    console.error('[blog] liste okunamadı', error)
    return []
  }
}

export async function getPost(slug: string) {
  try {
    await ensureTable()
    const r = await rows(sql`SELECT *, to_char(publish_at AT TIME ZONE 'Europe/Istanbul', 'YYYY-MM-DD"T"HH24:MI') AS publish_local
      FROM blog_posts WHERE slug = ${slug} AND published AND (publish_at IS NULL OR publish_at <= now())`)
    return r.length ? map(r[0]) : null
  } catch (error) {
    console.error('[blog] yazı okunamadı', error)
    return null
  }
}

export type BlogInput = {
  id: number | null
  slug: string
  title: string
  excerpt: string
  body: string
  cover: string
  keywords: string
  published: boolean
  /** Istanbul time as YYYY-MM-DDTHH:mm; empty clears the schedule. */
  publishAt: string
}

export async function savePost(input: BlogInput) {
  await ensureTable()
  const slug = slugify(input.slug || input.title)
  if (!slug) throw new Error('Başlık ya da adres boş olamaz')
  const at = parseLocal(input.publishAt)
  const publishAt = Number.isFinite(at) ? new Date(at).toISOString() : null
  if (input.id) {
    await rows(sql`UPDATE blog_posts SET slug = ${slug}, title = ${input.title}, excerpt = ${input.excerpt}, body = ${input.body},
      cover = ${input.cover}, keywords = ${input.keywords}, published = ${input.published}, publish_at = ${publishAt}, updated_at = now() WHERE id = ${input.id}`)
  } else {
    await rows(sql`INSERT INTO blog_posts (slug, title, excerpt, body, cover, keywords, published, publish_at)
      VALUES (${slug}, ${input.title}, ${input.excerpt}, ${input.body}, ${input.cover}, ${input.keywords}, ${input.published}, ${publishAt})`)
  }
  return slug
}

/** Adds a guide written ahead of time (lib/blog-drafts): a new one as a draft, an update into the existing text. */
export async function applyPrepared(slug: string): Promise<'taslak' | 'guncellendi' | 'zaten' | 'yok'> {
  const { PREPARED_POSTS, withSections } = await import('@/lib/blog-drafts')
  const prepared = PREPARED_POSTS.find((p) => p.slug === slug)
  if (!prepared) return 'yok'
  await ensureTable()
  const found = await rows<{ id: number; body: string }>(sql`SELECT id, body FROM blog_posts WHERE slug = ${slug}`)
  if (prepared.kind === 'new') {
    if (found.length) return 'zaten'
    await rows(sql`INSERT INTO blog_posts (slug, title, excerpt, body, cover, keywords, published)
      VALUES (${prepared.slug}, ${prepared.title}, ${prepared.excerpt}, ${prepared.body}, ${prepared.cover}, ${prepared.keywords}, false)`)
    return 'taslak'
  }
  if (!found.length) return 'yok'
  if (found[0].body.includes(prepared.marker)) return 'zaten'
  await rows(sql`UPDATE blog_posts SET body = ${withSections(found[0].body, prepared)}, updated_at = now() WHERE id = ${found[0].id}`)
  return 'guncellendi'
}

export async function deletePost(id: number) {
  await ensureTable()
  await rows(sql`DELETE FROM blog_posts WHERE id = ${id}`)
}
