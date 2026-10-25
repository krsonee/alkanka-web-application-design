import 'server-only'
import { rows, sql } from '@/lib/db'
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
  createdAt: string
  updatedAt: string
}

let ready: Promise<unknown> | null = null
function ensureTable() {
  ready ??= rows(sql`CREATE TABLE IF NOT EXISTS blog_posts (
    id serial PRIMARY KEY, slug text NOT NULL UNIQUE, title text NOT NULL, excerpt text NOT NULL DEFAULT '',
    body text NOT NULL DEFAULT '', cover text NOT NULL DEFAULT '', keywords text NOT NULL DEFAULT '',
    published boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now())`).catch((error) => {
    ready = null
    throw error
  })
  return ready
}

function map(r: Record<string, unknown>): BlogPost {
  return {
    id: Number(r.id),
    slug: String(r.slug),
    title: String(r.title),
    excerpt: String(r.excerpt),
    body: String(r.body),
    cover: String(r.cover),
    keywords: String(r.keywords),
    published: Boolean(r.published),
    createdAt: new Date(String(r.created_at)).toISOString(),
    updatedAt: new Date(String(r.updated_at)).toISOString(),
  }
}

export async function listPosts({ includeDrafts = false } = {}) {
  try {
    await ensureTable()
    const r = includeDrafts
      ? await rows(sql`SELECT * FROM blog_posts ORDER BY created_at DESC`)
      : await rows(sql`SELECT * FROM blog_posts WHERE published ORDER BY created_at DESC`)
    return r.map(map)
  } catch (error) {
    console.error('[blog] liste okunamadı', error)
    return []
  }
}

export async function getPost(slug: string) {
  try {
    await ensureTable()
    const r = await rows(sql`SELECT * FROM blog_posts WHERE slug = ${slug} AND published`)
    return r.length ? map(r[0]) : null
  } catch (error) {
    console.error('[blog] yazı okunamadı', error)
    return null
  }
}

export type BlogInput = { id: number | null; slug: string; title: string; excerpt: string; body: string; cover: string; keywords: string; published: boolean }

export async function savePost(input: BlogInput) {
  await ensureTable()
  const slug = slugify(input.slug || input.title)
  if (!slug) throw new Error('Başlık ya da adres boş olamaz')
  if (input.id) {
    await rows(sql`UPDATE blog_posts SET slug = ${slug}, title = ${input.title}, excerpt = ${input.excerpt}, body = ${input.body},
      cover = ${input.cover}, keywords = ${input.keywords}, published = ${input.published}, updated_at = now() WHERE id = ${input.id}`)
  } else {
    await rows(sql`INSERT INTO blog_posts (slug, title, excerpt, body, cover, keywords, published)
      VALUES (${slug}, ${input.title}, ${input.excerpt}, ${input.body}, ${input.cover}, ${input.keywords}, ${input.published})`)
  }
  return slug
}

export async function deletePost(id: number) {
  await ensureTable()
  await rows(sql`DELETE FROM blog_posts WHERE id = ${id}`)
}
