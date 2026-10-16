import 'server-only'
import { rows, sql } from '@/lib/db'
import { cleanSrc, getSiteLink, hashNetwork } from '@/lib/growth'
import { listSites } from '@/lib/sites'

/**
 * Sponsor-issued affiliate links behind our own short URL (/r/{code}).
 * "fixed" sends the visitor to the exact link the sponsor gave.
 * "follow" keeps the link's path + query (the affiliate code) but swaps the host
 * to the sponsor's current entry address, so a domain change never breaks the referral.
 */
export type AffMode = 'fixed' | 'follow'

export type AffLink = {
  id: number
  code: string
  siteId: number | null
  label: string
  affUrl: string
  mode: AffMode
  primary: boolean
  active: boolean
  prevUrl: string | null
  createdAt: string
  updatedAt: string
}

export type AffStats = { total: number; day: number; week: number; uniques: number; members: number; daily: number[]; sources: { src: string; n: number }[] }
export type AffLinkView = AffLink & { target: string | null; siteName: string | null; currentHost: string | null; stats: AffStats }

const RESERVED = new Set(['panel', 'api', 'git', 'r', 'admin', 'giris', 'kayit'])

let ready: Promise<unknown> | null = null
function ensureAff() {
  ready ??= (async () => {
    await rows(sql`CREATE TABLE IF NOT EXISTS aff_links (
      id serial PRIMARY KEY, code text NOT NULL UNIQUE, site_id integer, label text NOT NULL DEFAULT '',
      aff_url text NOT NULL, mode text NOT NULL DEFAULT 'fixed', is_primary boolean NOT NULL DEFAULT false,
      active boolean NOT NULL DEFAULT true, prev_url text,
      created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())`)
    await rows(sql`CREATE TABLE IF NOT EXISTS aff_clicks (
      id bigserial PRIMARY KEY, link_id integer NOT NULL, src text NOT NULL, user_id text, ip_hash text,
      created_at timestamptz NOT NULL DEFAULT now())`)
    await rows(sql`CREATE INDEX IF NOT EXISTS aff_clicks_link_time ON aff_clicks (link_id, created_at)`)
  })().catch((error) => {
    ready = null
    throw error
  })
  return ready
}

const iso = (v: unknown) => new Date(String(v)).toISOString()

function mapLink(x: Record<string, unknown>): AffLink {
  return {
    id: Number(x.id),
    code: String(x.code),
    siteId: x.site_id === null || x.site_id === undefined ? null : Number(x.site_id),
    label: String(x.label ?? ''),
    affUrl: String(x.aff_url),
    mode: x.mode === 'follow' ? 'follow' : 'fixed',
    primary: Boolean(x.is_primary),
    active: Boolean(x.active),
    prevUrl: x.prev_url ? String(x.prev_url) : null,
    createdAt: iso(x.created_at),
    updatedAt: iso(x.updated_at),
  }
}

export function cleanCode(value: string) {
  return value
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

function parseHttps(value: string, label: string) {
  const raw = value.trim()
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error()
    return url
  } catch {
    throw new Error(`${label} geçerli bir https:// adresi olmalı.`)
  }
}

/** The address the sponsor is currently reachable at: growth entry address, then site entry, then site url. */
async function currentAddress(siteId: number | null) {
  if (siteId === null) return null
  const site = (await listSites()).find((s) => s.id === siteId)
  if (!site) return null
  const link = site.slug ? await getSiteLink(site.slug).catch(() => null) : null
  const pick = [link?.url, site.entryUrl, site.url].map((v) => (v ?? '').trim()).find((v) => v && v !== '#')
  if (!pick) return null
  try {
    return new URL(pick)
  } catch {
    return null
  }
}

export function buildTarget(link: Pick<AffLink, 'affUrl' | 'mode'>, current: URL | null) {
  let aff: URL
  try {
    aff = new URL(link.affUrl)
  } catch {
    return null
  }
  if (link.mode !== 'follow' || !current) return aff.toString()
  const next = new URL(aff.toString())
  next.protocol = current.protocol
  next.host = current.host
  return next.toString()
}

export async function listAffLinks(): Promise<AffLink[]> {
  await ensureAff()
  const r = await rows(sql`SELECT * FROM aff_links ORDER BY is_primary DESC, active DESC, updated_at DESC`)
  return r.map(mapLink)
}

async function statsFor(ids: number[]): Promise<Map<number, AffStats>> {
  const out = new Map<number, AffStats>()
  for (const id of ids) out.set(id, { total: 0, day: 0, week: 0, uniques: 0, members: 0, daily: Array(14).fill(0), sources: [] })
  if (!ids.length) return out
  const list = sql.join(ids.map((id) => sql`${id}`), sql`, `)
  const [totals, daily, sources] = await Promise.all([
    rows(sql`SELECT link_id, count(*) AS total,
        count(*) FILTER (WHERE created_at > now() - interval '24 hours') AS day,
        count(*) FILTER (WHERE created_at > now() - interval '7 days') AS week,
        count(DISTINCT coalesce(user_id, ip_hash)) AS uniques,
        count(DISTINCT user_id) AS members
      FROM aff_clicks WHERE link_id IN (${list}) GROUP BY link_id`),
    rows(sql`SELECT link_id, (now()::date - (created_at AT TIME ZONE 'Europe/Istanbul')::date) AS ago, count(*) AS n
      FROM aff_clicks WHERE link_id IN (${list}) AND created_at > now() - interval '14 days' GROUP BY link_id, ago`),
    rows(sql`SELECT link_id, src, count(*) AS n FROM aff_clicks
      WHERE link_id IN (${list}) AND created_at > now() - interval '30 days' GROUP BY link_id, src ORDER BY n DESC`),
  ])
  for (const t of totals) {
    const s = out.get(Number(t.link_id))
    if (!s) continue
    s.total = Number(t.total)
    s.day = Number(t.day)
    s.week = Number(t.week)
    s.uniques = Number(t.uniques)
    s.members = Number(t.members)
  }
  for (const d of daily) {
    const s = out.get(Number(d.link_id))
    const ago = Number(d.ago)
    if (s && ago >= 0 && ago < 14) s.daily[13 - ago] += Number(d.n)
  }
  for (const src of sources) {
    const s = out.get(Number(src.link_id))
    if (s && s.sources.length < 5) s.sources.push({ src: String(src.src), n: Number(src.n) })
  }
  return out
}

export async function affLinkViews(): Promise<AffLinkView[]> {
  const [links, sites] = await Promise.all([listAffLinks(), listSites()])
  const stats = await statsFor(links.map((l) => l.id))
  const names = new Map(sites.map((s) => [s.id, s.name]))
  return Promise.all(
    links.map(async (link) => {
      const current = await currentAddress(link.siteId)
      return {
        ...link,
        target: buildTarget(link, current),
        siteName: link.siteId === null ? null : names.get(link.siteId) ?? null,
        currentHost: current?.host ?? null,
        stats: stats.get(link.id)!,
      }
    }),
  )
}

export type AffInput = { id?: number; code: string; siteId: number | null; label: string; affUrl: string; mode: AffMode; primary: boolean; active: boolean }

export async function saveAffLink(input: AffInput) {
  await ensureAff()
  const code = cleanCode(input.code)
  if (code.length < 2) throw new Error('Kısa kod en az 2 karakter olmalı (harf, rakam, -).')
  if (RESERVED.has(code)) throw new Error('Bu kısa kod sistem tarafından kullanılıyor, başka bir kod seç.')
  const affUrl = parseHttps(input.affUrl, 'Affiliate linki').toString()
  const mode: AffMode = input.mode === 'follow' ? 'follow' : 'fixed'
  let siteId: number | null = null
  if (input.siteId !== null && input.siteId !== undefined && String(input.siteId) !== '') {
    siteId = Number(input.siteId)
    if (!(await listSites()).some((s) => s.id === siteId)) throw new Error('Sponsor bulunamadı.')
  }
  if (mode === 'follow' && siteId === null) throw new Error('"Güncel adrese yönlendir" için bir sponsor seçmelisin.')
  const primary = Boolean(input.primary) && siteId !== null
  const label = input.label.trim().slice(0, 80)

  const taken = await rows(sql`SELECT id FROM aff_links WHERE code = ${code}`)
  if (taken.some((t) => Number(t.id) !== input.id)) throw new Error('Bu kısa kod başka bir linkte kullanılıyor.')

  let id = input.id ?? 0
  if (input.id) {
    const r = await rows(sql`UPDATE aff_links SET code = ${code}, site_id = ${siteId}, label = ${label},
        prev_url = CASE WHEN aff_url <> ${affUrl} THEN aff_url ELSE prev_url END,
        aff_url = ${affUrl}, mode = ${mode}, is_primary = ${primary}, active = ${Boolean(input.active)}, updated_at = now()
      WHERE id = ${input.id} RETURNING id`)
    if (!r.length) throw new Error('Link bulunamadı.')
  } else {
    const r = await rows(sql`INSERT INTO aff_links (code, site_id, label, aff_url, mode, is_primary, active)
      VALUES (${code}, ${siteId}, ${label}, ${affUrl}, ${mode}, ${primary}, ${Boolean(input.active)}) RETURNING id`)
    id = Number(r[0].id)
  }
  if (primary) await rows(sql`UPDATE aff_links SET is_primary = false WHERE site_id = ${siteId} AND id <> ${id}`)
  return { id, code }
}

export async function deleteAffLink(id: number) {
  await ensureAff()
  await rows(sql`DELETE FROM aff_links WHERE id = ${id}`)
  await rows(sql`DELETE FROM aff_clicks WHERE link_id = ${id}`)
}

export async function setAffActive(id: number, active: boolean) {
  await ensureAff()
  await rows(sql`UPDATE aff_links SET active = ${active}, updated_at = now() WHERE id = ${id}`)
}

async function logAffClick(linkId: number, src: string, userId: string | null, ip: string | null) {
  await rows(sql`INSERT INTO aff_clicks (link_id, src, user_id, ip_hash) VALUES (${linkId}, ${cleanSrc(src)}, ${userId}, ${hashNetwork(ip)})`)
}

/** Resolves a short code, records the click and returns where to send the visitor. */
export async function hitByCode(code: string, ctx: { src: string; userId: string | null; ip: string | null }) {
  await ensureAff()
  const r = await rows(sql`SELECT * FROM aff_links WHERE code = ${cleanCode(code)} AND active LIMIT 1`)
  if (!r[0]) return null
  const link = mapLink(r[0])
  const target = buildTarget(link, await currentAddress(link.siteId))
  if (!target) return null
  await logAffClick(link.id, ctx.src, ctx.userId, ctx.ip).catch((error) => console.error('[aff] tıklama kaydedilemedi', error))
  return { link, target }
}

/** The site's primary affiliate link (used by every "Git" button for that sponsor). */
export async function hitPrimaryForSite(siteId: number, ctx: { src: string; userId: string | null; ip: string | null }) {
  await ensureAff()
  const r = await rows(sql`SELECT * FROM aff_links WHERE site_id = ${siteId} AND is_primary AND active LIMIT 1`)
  if (!r[0]) return null
  const link = mapLink(r[0])
  const target = buildTarget(link, await currentAddress(link.siteId))
  if (!target) return null
  await logAffClick(link.id, ctx.src, ctx.userId, ctx.ip).catch((error) => console.error('[aff] tıklama kaydedilemedi', error))
  return { link, target }
}

/** Server-side reachability check of where the short link currently points. */
export async function checkAffTarget(id: number) {
  await ensureAff()
  const r = await rows(sql`SELECT * FROM aff_links WHERE id = ${id}`)
  if (!r[0]) throw new Error('Link bulunamadı.')
  const link = mapLink(r[0])
  const target = buildTarget(link, await currentAddress(link.siteId))
  if (!target) throw new Error('Hedef adres oluşturulamadı.')
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 6000)
  try {
    const res = await fetch(target, { method: 'GET', redirect: 'manual', signal: controller.signal, headers: { 'User-Agent': 'Mozilla/5.0 AlkankaLinkCheck' } })
    const location = res.headers.get('location')
    return { target, status: res.status, location }
  } catch {
    return { target, status: 0, location: null }
  } finally {
    clearTimeout(timer)
  }
}
