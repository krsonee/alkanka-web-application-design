import 'server-only'
import { get, put } from '@vercel/blob'
import { rows, sql } from '@/lib/db'
import { toRole, type AssetLabel, type AssetRole } from '@/lib/studio-refs'
import { cleanTexts, STUDIO_PAGE, type StudioAreaTotal, type StudioAsset, type StudioBrand, type StudioJob, type StudioTexts } from '@/lib/studio-types'

let ready: Promise<unknown> | null = null
export function ensureTables() {
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
    // What the picture is and how useful it is, so a job can start from a game's best pictures.
    await rows(sql`ALTER TABLE studio_assets ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT ''`)
    await rows(sql`ALTER TABLE studio_assets ADD COLUMN IF NOT EXISTS score int NOT NULL DEFAULT 0`)
    await rows(sql`ALTER TABLE studio_assets ADD COLUMN IF NOT EXISTS note text NOT NULL DEFAULT ''`)
    await rows(sql`ALTER TABLE studio_assets ADD COLUMN IF NOT EXISTS pinned boolean NOT NULL DEFAULT false`)
    await rows(sql`ALTER TABLE studio_brands ADD COLUMN IF NOT EXISTS mascot text NOT NULL DEFAULT ''`)
    await rows(sql`ALTER TABLE studio_jobs ADD COLUMN IF NOT EXISTS texts text NOT NULL DEFAULT ''`)
    // Cost set aside while a paid job runs; `kept` rows are jobs the model was paid for that failed afterwards.
    await rows(sql`CREATE TABLE IF NOT EXISTS studio_holds (
      id bigserial PRIMARY KEY, cost numeric NOT NULL, kept boolean NOT NULL DEFAULT false, note text NOT NULL DEFAULT '',
      created_at timestamptz NOT NULL DEFAULT now())`)
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

const ASSET_LIST_LIMIT = 2000

export async function listAssets() {
  await ensureTables()
  // One game's press kit is some fifty files. Past the limit it is the oldest pictures that drop out.
  const r = await rows(sql`SELECT * FROM (SELECT * FROM studio_assets ORDER BY id DESC LIMIT ${ASSET_LIST_LIMIT}) newest
    ORDER BY provider, game, pinned DESC, score DESC, id DESC`)
  return r.map(
    (a): StudioAsset => ({
      id: Number(a.id),
      provider: String(a.provider),
      game: String(a.game),
      pathname: String(a.pathname),
      url: fileUrl(String(a.pathname)),
      role: toRole(a.role),
      score: Number(a.score) || 0,
      note: String(a.note ?? ''),
      pinned: a.pinned === true,
    }),
  )
}

export async function addAsset(provider: string, game: string, pathname: string, label: AssetLabel | null = null) {
  await ensureTables()
  await rows(sql`INSERT INTO studio_assets (provider, game, pathname, role, score, note)
    VALUES (${provider}, ${game}, ${pathname}, ${label?.role ?? ''}, ${label?.score ?? 0}, ${label?.note ?? ''})`)
}

export async function labelAsset(id: number, label: AssetLabel) {
  await ensureTables()
  await rows(sql`UPDATE studio_assets SET role = ${label.role}, score = ${label.score}, note = ${label.note} WHERE id = ${id}`)
}

/** A role set by hand. A picture the model never scored gets a middling score so it can be chosen. */
export async function setAssetRole(id: number, role: AssetRole) {
  await ensureTables()
  await rows(sql`UPDATE studio_assets SET role = ${role}, score = CASE WHEN score = 0 THEN 6 ELSE score END WHERE id = ${id}`)
}

export async function pinAsset(id: number, pinned: boolean) {
  await ensureTables()
  await rows(sql`UPDATE studio_assets SET pinned = ${pinned} WHERE id = ${id}`)
}

/** Of the given pictures, the ones nobody has labelled yet. */
export async function unlabelledAssets(ids: number[]) {
  if (!ids.length) return []
  await ensureTables()
  const r = await rows(sql`SELECT id, pathname FROM studio_assets WHERE id IN ${ids} AND role = ''`)
  return r.map((a) => ({ id: Number(a.id), pathname: String(a.pathname) }))
}

export async function deleteAsset(id: number) {
  await ensureTables()
  await rows(sql`DELETE FROM studio_assets WHERE id = ${id}`)
}

export async function assetsByIds(ids: number[]) {
  if (!ids.length) return []
  await ensureTables()
  const r = await rows(sql`SELECT id, pathname, role FROM studio_assets WHERE id IN ${ids}`)
  // In the order asked for: the prompt tells the model what each picture is by its position.
  return ids.flatMap((id) => {
    const a = r.find((row) => Number(row.id) === id)
    return a ? [{ pathname: String(a.pathname), role: toRole(a.role) }] : []
  })
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
  texts: parseTexts(r.texts),
  retextable: String(r.kind) === 'banner' && Boolean(r.clean),
  hdUrl: String(r.kind) === 'sticker' && r.clean ? fileUrl(String(r.clean)) : '',
})

function parseTexts(value: unknown) {
  try {
    return value ? cleanTexts(JSON.parse(String(value))) : null
  } catch {
    return null
  }
}

export async function listJobs(limit = 60) {
  await ensureTables()
  const r = await rows(sql`SELECT j.*, b.name AS brand_name FROM studio_jobs j LEFT JOIN studio_brands b ON b.id = j.brand_id
    ORDER BY j.id DESC LIMIT ${limit}`)
  return r.map(mapJob)
}

/**
 * The newest jobs of every brand in one query, so each brand's area is full on its own instead of
 * sharing one mixed list. A job whose brand kit was deleted counts as brandless.
 */
export async function listJobsByBrand(perBrand = STUDIO_PAGE) {
  await ensureTables()
  const r = await rows(sql`SELECT * FROM (
      SELECT j.*, b.name AS brand_name, b.id AS area,
        ROW_NUMBER() OVER (PARTITION BY b.id ORDER BY j.id DESC) AS rn,
        COUNT(*) OVER (PARTITION BY b.id) AS area_count,
        SUM(j.cost) OVER (PARTITION BY b.id) AS area_cost
      FROM studio_jobs j LEFT JOIN studio_brands b ON b.id = j.brand_id) t
    WHERE rn <= ${perBrand} ORDER BY id DESC`)
  const totals = new Map<number | null, StudioAreaTotal>()
  for (const row of r) {
    const brandId = row.area == null ? null : Number(row.area)
    if (!totals.has(brandId)) totals.set(brandId, { brandId, count: Number(row.area_count), cost: Number(row.area_cost) })
  }
  return { jobs: r.map(mapJob), totals: [...totals.values()] }
}

/** Older jobs of one brand, below the ones already on screen. */
export async function listBrandJobs(brandId: number | null, beforeId: number, limit = STUDIO_PAGE) {
  await ensureTables()
  const r =
    brandId == null
      ? await rows(sql`SELECT j.*, b.name AS brand_name FROM studio_jobs j LEFT JOIN studio_brands b ON b.id = j.brand_id
          WHERE b.id IS NULL AND j.id < ${beforeId} ORDER BY j.id DESC LIMIT ${limit}`)
      : await rows(sql`SELECT j.*, b.name AS brand_name FROM studio_jobs j JOIN studio_brands b ON b.id = j.brand_id
          WHERE b.id = ${brandId} AND j.id < ${beforeId} ORDER BY j.id DESC LIMIT ${limit}`)
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
  texts?: StudioTexts | null
}) {
  await ensureTables()
  const texts = j.texts ? JSON.stringify(j.texts) : ''
  const r = await rows(sql`INSERT INTO studio_jobs (brand_id, kind, format, prompt, pathname, clean, parent_id, cost, texts)
    VALUES (${j.brandId}, ${j.kind}, ${j.format}, ${j.prompt}, ${j.pathname}, ${j.clean}, ${j.parentId}, ${j.cost}, ${texts}) RETURNING *`)
  return mapJob(r[0])
}

export async function deleteJob(id: number) {
  await ensureTables()
  await rows(sql`DELETE FROM studio_jobs WHERE id = ${id}`)
}

/** Money paid for finished jobs, plus jobs the model was paid for but that failed before they could be saved. */
export async function studioSpend() {
  await ensureTables()
  const r = await rows<{ total: string; month: string; count: string }>(sql`SELECT
    j.total + h.total AS total, j.month + h.month AS month, j.count
    FROM (SELECT COALESCE(SUM(cost), 0) AS total, COALESCE(SUM(cost) FILTER (WHERE created_at > (date_trunc('month', now() AT TIME ZONE 'Europe/Istanbul') AT TIME ZONE 'Europe/Istanbul')), 0) AS month,
            COUNT(*) AS count FROM studio_jobs) j,
         (SELECT COALESCE(SUM(cost), 0) AS total, COALESCE(SUM(cost) FILTER (WHERE created_at > (date_trunc('month', now() AT TIME ZONE 'Europe/Istanbul') AT TIME ZONE 'Europe/Istanbul')), 0) AS month
            FROM studio_holds WHERE kept) h`)
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
