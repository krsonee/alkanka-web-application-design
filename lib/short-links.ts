import { pool } from "@/db";

export class ShortLinkError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

// Sayfa klasörleri ve kullanıcının ayırdığı adlar. Kısa link bunları ezemez.
const RESERVED = new Set([
  "admin",
  "api",
  "bilet",
  "biletler",
  "cark",
  "cuzdan",
  "favicon",
  "giris",
  "go",
  "gorevler",
  "kampanya",
  "kampanyalar",
  "kayit",
  "liderlik",
  "logos",
  "market",
  "oranlar",
  "profil",
  "puan",
  "robots",
  "siralama",
  "siteler",
  "sitemap",
  "tahmin",
  "tahminler",
  "uploads",
  "uye",
  "zar",
]);

export function reservedSlugs() {
  return [...RESERVED].sort();
}

export function normalizeSlug(value: unknown): string | null {
  const folded = String(value ?? "")
    .trim()
    .replace(/İ/g, "i")
    .replace(/I/g, "ı")
    .toLocaleLowerCase("tr")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(folded)) return null;
  if (folded.length < 2 || folded.length > 40) return null;
  return folded;
}

export function slugIssue(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return "Kısa ad yazın.";
  const slug = normalizeSlug(raw);
  if (!slug) return "Kısa ad 2-40 karakter olmalı; yalnızca harf, rakam ve tire kullanılabilir.";
  if (RESERVED.has(slug)) return "Bu kısa ad site sayfası olarak ayrılmış. Başka bir ad seçin.";
  return null;
}

export function cleanDestination(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  if (!raw || raw.length > 2000) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  return url.toString();
}

export type ShortLinkRow = {
  id: number;
  slug: string;
  url: string;
  active: boolean;
  clicks: number;
  createdAt: string;
};

function mapRow(row: {
  id: number;
  slug: string;
  url: string;
  active: boolean;
  clicks: number;
  created_at: Date | string;
}): ShortLinkRow {
  const created = row.created_at instanceof Date ? row.created_at : new Date(row.created_at);
  return {
    id: row.id,
    slug: row.slug,
    url: row.url,
    active: row.active,
    clicks: row.clicks,
    createdAt: created.toISOString(),
  };
}

export async function listShortLinks(): Promise<ShortLinkRow[]> {
  const { rows } = await pool.query<{
    id: number;
    slug: string;
    url: string;
    active: boolean;
    clicks: number;
    created_at: Date;
  }>(`SELECT id, slug, url, active, clicks, created_at FROM short_links ORDER BY id DESC`);
  return rows.map(mapRow);
}

function readFields(body: Record<string, unknown>) {
  const issue = slugIssue(body.slug);
  if (issue) throw new ShortLinkError(issue);
  const slug = normalizeSlug(body.slug);
  if (!slug) throw new ShortLinkError("Kısa ad yazın.");
  const url = cleanDestination(body.url);
  if (!url) throw new ShortLinkError("Hedef adres http:// veya https:// ile başlamalı.");
  const active = body.active === false || body.active === "0" || body.active === "false" ? false : true;
  return { slug, url, active };
}

function uniqueMessage(err: unknown) {
  return typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "23505";
}

export async function createShortLink(body: Record<string, unknown>) {
  const fields = readFields(body);
  try {
    const { rows } = await pool.query(
      `INSERT INTO short_links (slug, url, active) VALUES ($1, $2, $3) RETURNING id`,
      [fields.slug, fields.url, fields.active],
    );
    return { ok: true, id: rows[0]?.id };
  } catch (err) {
    if (uniqueMessage(err)) throw new ShortLinkError("Bu kısa ad zaten var.", 409);
    throw err;
  }
}

export async function updateShortLink(body: Record<string, unknown>) {
  const id = Number(body.id);
  if (!Number.isInteger(id) || id <= 0) throw new ShortLinkError("Link bulunamadı.", 404);
  const fields = readFields(body);
  try {
    const { rowCount } = await pool.query(
      `UPDATE short_links SET slug = $2, url = $3, active = $4 WHERE id = $1`,
      [id, fields.slug, fields.url, fields.active],
    );
    if (!rowCount) throw new ShortLinkError("Link bulunamadı.", 404);
    return { ok: true };
  } catch (err) {
    if (err instanceof ShortLinkError) throw err;
    if (uniqueMessage(err)) throw new ShortLinkError("Bu kısa ad zaten var.", 409);
    throw err;
  }
}

export async function deleteShortLink(idRaw: unknown) {
  const id = Number(idRaw);
  if (!Number.isInteger(id) || id <= 0) throw new ShortLinkError("Link bulunamadı.", 404);
  const { rowCount } = await pool.query(`DELETE FROM short_links WHERE id = $1`, [id]);
  if (!rowCount) throw new ShortLinkError("Link bulunamadı.", 404);
  return { ok: true };
}

export async function hitShortLink(slugRaw: string): Promise<string | null> {
  const slug = normalizeSlug(slugRaw);
  if (!slug || RESERVED.has(slug)) return null;
  const { rows } = await pool.query<{ url: string }>(
    `UPDATE short_links SET clicks = clicks + 1
     WHERE slug = $1 AND active
     RETURNING url`,
    [slug],
  );
  return rows[0]?.url ?? null;
}
