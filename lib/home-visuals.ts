import { pool } from "@/db";
import type { PosterName } from "@/components/PosterMark";

const ARTS = new Set<PosterName>(["wheel", "bag", "check", "ticket", "flag", "dice"]);

export type HomeSlide = {
  id: number;
  imageUrl: string;
  title: string;
  line: string;
  buttonLabel: string;
  href: string;
  sortOrder: number;
  active: boolean;
  art: PosterName;
};

export type HomeCard = {
  id: number;
  slot: string;
  imageUrl: string;
  title: string;
  buttonLabel: string;
  href: string;
  sortOrder: number;
  art: PosterName;
};

export class HomeVisualError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

const STOCK_SLIDES: Record<string, string> = {
  "/cark": "/home/altin-slide-cark.jpg",
  "/market": "/home/altin-slide-market.jpg",
  "/gorevler": "/home/altin-slide-gorev.jpg",
  "/biletler": "/home/altin-slide-bilet.jpg",
  "/tahminler": "/home/altin-slide-tahmin.jpg",
};

const STOCK_CARDS: Record<string, string> = {
  cark: "/home/altin-card-cark.jpg",
  market: "/home/altin-card-market.jpg",
  gorevler: "/home/altin-card-gorev.jpg",
  zar: "/home/altin-card-zar.jpg",
  biletler: "/home/altin-card-bilet.jpg",
  tahminler: "/home/altin-card-tahmin.jpg",
};

function stockSlide(href: string) {
  return STOCK_SLIDES[href] ?? "/home/altin-slide-cark.jpg";
}

function stockCard(slot: string, href: string) {
  if (STOCK_CARDS[slot]) return STOCK_CARDS[slot];
  const key = Object.keys(STOCK_CARDS).find((item) => href.includes(item));
  return (key && STOCK_CARDS[key]) || "/home/altin-card-cark.jpg";
}

function dressSlide(slide: HomeSlide): HomeSlide {
  return slide.imageUrl ? slide : { ...slide, imageUrl: stockSlide(slide.href) };
}

function dressCard(card: HomeCard): HomeCard {
  return card.imageUrl ? card : { ...card, imageUrl: stockCard(card.slot, card.href) };
}

const FALLBACK_SLIDES: HomeSlide[] = [
  { id: 0, imageUrl: "", title: "Çark", line: "Günde bir ücretsiz çevirme. Sonuç sunucuda yazılır.", buttonLabel: "Çarkı aç", href: "/cark", sortOrder: 1, active: true, art: "wheel" },
  { id: 0, imageUrl: "", title: "Puan marketi", line: "Rozet, ekstra hak ve hediyelik. Nakit yok.", buttonLabel: "Marketi aç", href: "/market", sortOrder: 2, active: true, art: "bag" },
  { id: 0, imageUrl: "", title: "Görevler", line: "Giriş, site ve kod. Puanı sunucu yazar.", buttonLabel: "Görevlere git", href: "/gorevler", sortOrder: 3, active: true, art: "check" },
  { id: 0, imageUrl: "", title: "Biletler", line: "Numaralı çekiliş. Ödül yine puan.", buttonLabel: "Bilet al", href: "/biletler", sortOrder: 4, active: true, art: "ticket" },
  { id: 0, imageUrl: "", title: "Tahminler", line: "Maç kilidi, küçük bahis. Kazanan puan alır.", buttonLabel: "Tahmin et", href: "/tahminler", sortOrder: 5, active: true, art: "flag" },
];

const FALLBACK_CARDS: HomeCard[] = [
  { id: 0, slot: "cark", imageUrl: "", title: "Çark", buttonLabel: "Çarkı aç", href: "/cark", sortOrder: 1, art: "wheel" },
  { id: 0, slot: "market", imageUrl: "", title: "Market", buttonLabel: "Marketi aç", href: "/market", sortOrder: 2, art: "bag" },
  { id: 0, slot: "gorevler", imageUrl: "", title: "Görevler", buttonLabel: "Görevlere git", href: "/gorevler", sortOrder: 3, art: "check" },
  { id: 0, slot: "zar", imageUrl: "", title: "Zar", buttonLabel: "Zar at", href: "/zar", sortOrder: 4, art: "dice" },
  { id: 0, slot: "biletler", imageUrl: "", title: "Biletler", buttonLabel: "Bilet al", href: "/biletler", sortOrder: 5, art: "ticket" },
  { id: 0, slot: "tahminler", imageUrl: "", title: "Tahminler", buttonLabel: "Tahmin et", href: "/tahminler", sortOrder: 6, art: "flag" },
];

function artOf(value: unknown, href: string): PosterName {
  const raw = String(value ?? "");
  if (ARTS.has(raw as PosterName)) return raw as PosterName;
  if (href.includes("market")) return "bag";
  if (href.includes("gorev")) return "check";
  if (href.includes("bilet")) return "ticket";
  if (href.includes("tahmin")) return "flag";
  if (href.includes("zar")) return "dice";
  return "wheel";
}

function text(value: unknown, max: number, min = 1) {
  const clean = String(value ?? "").trim().replace(/\s+/g, " ");
  if (clean.length < min || clean.length > max) return null;
  return clean;
}

function hrefOf(value: unknown) {
  const href = String(value ?? "").trim();
  if (!href || href.length > 500) return null;
  if (href.startsWith("/") && !href.startsWith("//")) return href;
  try {
    const url = new URL(href);
    if (url.protocol === "http:" || url.protocol === "https:") return href;
  } catch {
    return null;
  }
  return null;
}

function imageOf(value: unknown) {
  const image = String(value ?? "").trim();
  if (!image) return "";
  if (
    image.startsWith("/uploads/") ||
    image.startsWith("/images/") ||
    image.startsWith("/api/logo/") ||
    /^https:\/\/[^\s"'<>]+$/.test(image)
  ) {
    return image.slice(0, 500);
  }
  return null;
}

function orderOf(value: unknown) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 1000) return null;
  return parsed;
}

function mapSlide(row: Record<string, unknown>): HomeSlide {
  const href = String(row.href ?? "/");
  return {
    id: Number(row.id),
    imageUrl: String(row.image_url ?? ""),
    title: String(row.title ?? ""),
    line: String(row.line ?? ""),
    buttonLabel: String(row.button_label ?? ""),
    href,
    sortOrder: Number(row.sort_order ?? 0),
    active: row.active === true,
    art: artOf(row.art, href),
  };
}

function mapCard(row: Record<string, unknown>): HomeCard {
  const href = String(row.href ?? "/");
  return {
    id: Number(row.id),
    slot: String(row.slot ?? ""),
    imageUrl: String(row.image_url ?? ""),
    title: String(row.title ?? ""),
    buttonLabel: String(row.button_label ?? ""),
    href,
    sortOrder: Number(row.sort_order ?? 0),
    art: artOf(row.art, href),
  };
}

export async function listPublicHome() {
  try {
    const [slides, cards] = await Promise.all([
      pool.query(
        `SELECT id, image_url, title, line, button_label, href, sort_order, active, art
         FROM home_slides WHERE active ORDER BY sort_order, id`,
      ),
      pool.query(
        `SELECT id, slot, image_url, title, button_label, href, sort_order, art
         FROM home_cards ORDER BY sort_order, id`,
      ),
    ]);
    const mappedSlides = slides.rows.length ? slides.rows.map(mapSlide) : FALLBACK_SLIDES;
    const mappedCards = cards.rows.length ? cards.rows.map(mapCard) : FALLBACK_CARDS;
    return {
      slides: mappedSlides.map(dressSlide),
      cards: mappedCards.map(dressCard),
    };
  } catch {
    return { slides: FALLBACK_SLIDES.map(dressSlide), cards: FALLBACK_CARDS.map(dressCard) };
  }
}

export async function listAdminHome() {
  const [slides, cards] = await Promise.all([
    pool.query(
      `SELECT id, image_url, title, line, button_label, href, sort_order, active, art
       FROM home_slides ORDER BY sort_order, id`,
    ),
    pool.query(
      `SELECT id, slot, image_url, title, button_label, href, sort_order, art
       FROM home_cards ORDER BY sort_order, id`,
    ),
  ]);
  return { slides: slides.rows.map(mapSlide), cards: cards.rows.map(mapCard) };
}

function slideFields(body: Record<string, unknown>) {
  const title = text(body.title, 60);
  const line = text(body.line, 160, 0) ?? "";
  const buttonLabel = text(body.buttonLabel, 40);
  const href = hrefOf(body.href);
  const sortOrder = orderOf(body.sortOrder);
  const imageUrl = imageOf(body.imageUrl);
  const active = body.active !== false && body.active !== "false";
  if (!title) throw new HomeVisualError("Slayt başlığı yazın.");
  if (!buttonLabel) throw new HomeVisualError("Düğme yazısı yazın.");
  if (!href) throw new HomeVisualError("Bağlantı / ile ya da http adresi olmalı.");
  if (sortOrder == null) throw new HomeVisualError("Sıra 0 ile 1000 arasında olmalı.");
  if (imageUrl == null) throw new HomeVisualError("Görsel /uploads/, /images/ veya https:// olmalı.");
  return { title, line, buttonLabel, href, sortOrder, imageUrl, active, art: artOf(body.art, href) };
}

export async function saveSlide(body: Record<string, unknown>) {
  const fields = slideFields(body);
  const id = Number(body.id);
  if (Number.isInteger(id) && id > 0) {
    const updated = await pool.query(
      `UPDATE home_slides
       SET image_url = $2, title = $3, line = $4, button_label = $5, href = $6,
           sort_order = $7, active = $8, art = $9
       WHERE id = $1
       RETURNING id`,
      [id, fields.imageUrl, fields.title, fields.line, fields.buttonLabel, fields.href, fields.sortOrder, fields.active, fields.art],
    );
    if ((updated.rowCount ?? 0) === 0) throw new HomeVisualError("Slayt bulunamadı.", 404);
    return { ok: true };
  }
  await pool.query(
    `INSERT INTO home_slides (image_url, title, line, button_label, href, sort_order, active, art)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [fields.imageUrl, fields.title, fields.line, fields.buttonLabel, fields.href, fields.sortOrder, fields.active, fields.art],
  );
  return { ok: true };
}

export async function deleteSlide(idValue: unknown) {
  const id = Number(idValue);
  if (!Number.isInteger(id) || id < 1) throw new HomeVisualError("Slayt bulunamadı.", 404);
  await pool.query(`DELETE FROM home_slides WHERE id = $1`, [id]);
  return { ok: true };
}

export async function saveCard(body: Record<string, unknown>) {
  const id = Number(body.id);
  if (!Number.isInteger(id) || id < 1) throw new HomeVisualError("Kart bulunamadı.", 404);
  const title = text(body.title, 40);
  const buttonLabel = text(body.buttonLabel, 40);
  const href = hrefOf(body.href);
  const imageUrl = imageOf(body.imageUrl);
  if (!title) throw new HomeVisualError("Kart başlığı yazın.");
  if (!buttonLabel) throw new HomeVisualError("Düğme yazısı yazın.");
  if (!href) throw new HomeVisualError("Bağlantı / ile ya da http adresi olmalı.");
  if (imageUrl == null) throw new HomeVisualError("Görsel /uploads/, /images/ veya https:// olmalı.");
  const updated = await pool.query(
    `UPDATE home_cards
     SET image_url = $2, title = $3, button_label = $4, href = $5
     WHERE id = $1
     RETURNING id`,
    [id, imageUrl, title, buttonLabel, href],
  );
  if ((updated.rowCount ?? 0) === 0) throw new HomeVisualError("Kart bulunamadı.", 404);
  return { ok: true };
}
