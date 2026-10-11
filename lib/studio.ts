import 'server-only'
import { get, put } from '@vercel/blob'
import { rows, sql } from '@/lib/db'
import type { StudioAsset, StudioBrand, StudioJob } from '@/lib/studio-types'

let ready: Promise<unknown> | null = null
function ensureTables() {
  ready ??= (async () => {
    await rows(sql`CREATE TABLE IF NOT EXISTS studio_brands (
      id serial PRIMARY KEY, name text NOT NULL, domain text NOT NULL DEFAULT '', logo text NOT NULL DEFAULT '',
      colors text NOT NULL DEFAULT '[]', font text NOT NULL DEFAULT '', notes text NOT NULL DEFAULT '',
      created_at timestamptz NOT NULL DEFAULT now())`)
    await rows(sql`CREATE TABLE IF NOT EXISTS studio_assets (
      id serial PRIMARY KEY, provider text NOT NULL, game text NOT NULL DEFAULT '', pathname text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now())`)
    await rows(sql`CREATE TABLE IF NOT EXISTS studio_jobs (
      id serial PRIMARY KEY, brand_id int, kind text NOT NULL, format text NOT NULL, prompt text NOT NULL,
      pathname text NOT NULL, parent_id int, cost numeric NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now())`)
    await rows(sql`ALTER TABLE studio_jobs ADD COLUMN IF NOT EXISTS clean text NOT NULL DEFAULT ''`)
    await rows(sql`ALTER TABLE studio_brands ADD COLUMN IF NOT EXISTS mascot text NOT NULL DEFAULT ''`)
  })().catch((error) => {
    ready = null
    throw error
  })
  return ready
}

export const fileUrl = (pathname: string) => (pathname ? `/api/studio/file/${pathname.replace(/^studio\//, '')}` : '')

function parseColors(value: unknown): string[] {
  try {
    const list = JSON.parse(String(value))
    return Array.isArray(list) ? list.filter((c) => /^#[0-9a-f]{6}$/i.test(c)).slice(0, 6) : []
  } catch {
    return []
  }
}

const mapBrand = (r: Record<string, unknown>): StudioBrand => ({
  id: Number(r.id),
  name: String(r.name),
  domain: String(r.domain),
  logo: String(r.logo),
  logoUrl: fileUrl(String(r.logo)),
  mascot: String(r.mascot ?? ''),
  mascotUrl: fileUrl(String(r.mascot ?? '')),
  colors: parseColors(r.colors),
  font: String(r.font),
  notes: String(r.notes),
})

export async function listBrands() {
  await ensureTables()
  return (await rows(sql`SELECT * FROM studio_brands ORDER BY name`)).map(mapBrand)
}

export async function getBrand(id: number) {
  await ensureTables()
  const r = await rows(sql`SELECT * FROM studio_brands WHERE id = ${id}`)
  return r.length ? mapBrand(r[0]) : null
}

export async function saveBrand(b: Omit<StudioBrand, 'id' | 'logoUrl' | 'mascotUrl'> & { id: number | null }) {
  await ensureTables()
  const colors = JSON.stringify(b.colors)
  if (b.id) {
    await rows(sql`UPDATE studio_brands SET name = ${b.name}, domain = ${b.domain}, logo = ${b.logo}, mascot = ${b.mascot},
      colors = ${colors}, font = ${b.font}, notes = ${b.notes} WHERE id = ${b.id}`)
    return b.id
  }
  const r = await rows<{ id: number }>(sql`INSERT INTO studio_brands (name, domain, logo, mascot, colors, font, notes)
    VALUES (${b.name}, ${b.domain}, ${b.logo}, ${b.mascot}, ${colors}, ${b.font}, ${b.notes}) RETURNING id`)
  return Number(r[0].id)
}

export async function deleteBrand(id: number) {
  await ensureTables()
  await rows(sql`DELETE FROM studio_brands WHERE id = ${id}`)
}

export async function listAssets() {
  await ensureTables()
  const r = await rows(sql`SELECT * FROM studio_assets ORDER BY provider, game, id DESC LIMIT 500`)
  return r.map(
    (a): StudioAsset => ({
      id: Number(a.id),
      provider: String(a.provider),
      game: String(a.game),
      pathname: String(a.pathname),
      url: fileUrl(String(a.pathname)),
    }),
  )
}

export async function addAsset(provider: string, game: string, pathname: string) {
  await ensureTables()
  await rows(sql`INSERT INTO studio_assets (provider, game, pathname) VALUES (${provider}, ${game}, ${pathname})`)
}

export async function deleteAsset(id: number) {
  await ensureTables()
  await rows(sql`DELETE FROM studio_assets WHERE id = ${id}`)
}

export async function assetsByIds(ids: number[]) {
  if (!ids.length) return []
  await ensureTables()
  const r = await rows(sql`SELECT id, pathname FROM studio_assets WHERE id = ANY(${ids})`)
  return r.map((a) => String(a.pathname))
}

const mapJob = (r: Record<string, unknown>): StudioJob => ({
  id: Number(r.id),
  brandId: r.brand_id == null ? null : Number(r.brand_id),
  brandName: r.brand_name ? String(r.brand_name) : '',
  kind: String(r.kind) as StudioJob['kind'],
  format: String(r.format),
  prompt: String(r.prompt),
  url: fileUrl(String(r.pathname)),
  parentId: r.parent_id == null ? null : Number(r.parent_id),
  cost: Number(r.cost),
  createdAt: new Date(String(r.created_at)).toISOString(),
})

export async function listJobs(limit = 60) {
  await ensureTables()
  const r = await rows(sql`SELECT j.*, b.name AS brand_name FROM studio_jobs j LEFT JOIN studio_brands b ON b.id = j.brand_id
    ORDER BY j.id DESC LIMIT ${limit}`)
  return r.map(mapJob)
}

export async function getJob(id: number) {
  await ensureTables()
  const r = await rows(sql`SELECT * FROM studio_jobs WHERE id = ${id}`)
  return r.length ? { ...mapJob(r[0]), pathname: String(r[0].pathname), cleanPathname: String(r[0].clean) } : null
}

export async function addJob(j: {
  brandId: number | null
  kind: string
  format: string
  prompt: string
  pathname: string
  clean: string
  parentId: number | null
  cost: number
}) {
  await ensureTables()
  const r = await rows(sql`INSERT INTO studio_jobs (brand_id, kind, format, prompt, pathname, clean, parent_id, cost)
    VALUES (${j.brandId}, ${j.kind}, ${j.format}, ${j.prompt}, ${j.pathname}, ${j.clean}, ${j.parentId}, ${j.cost}) RETURNING *`)
  return mapJob(r[0])
}

export async function deleteJob(id: number) {
  await ensureTables()
  await rows(sql`DELETE FROM studio_jobs WHERE id = ${id}`)
}

export async function studioSpend() {
  await ensureTables()
  const r = await rows<{ total: string; month: string; count: string }>(sql`SELECT
    COALESCE(SUM(cost), 0) AS total, COALESCE(SUM(cost) FILTER (WHERE created_at > date_trunc('month', now())), 0) AS month,
    COUNT(*) AS count FROM studio_jobs`)
  return { total: Number(r[0].total), month: Number(r[0].month), count: Number(r[0].count) }
}

export async function storeFile(folder: string, data: Buffer | Uint8Array, contentType: string, ext: string) {
  const blob = await put(`studio/${folder}/file.${ext}`, Buffer.from(data), {
    access: 'private',
    addRandomSuffix: true,
    contentType,
  })
  return blob.pathname
}

export async function readFile(pathname: string) {
  const result = await get(pathname, { access: 'private' })
  if (!result || result.statusCode !== 200) throw new Error(`Missing file ${pathname}`)
  return Buffer.from(await new Response(result.stream).arrayBuffer())
}
