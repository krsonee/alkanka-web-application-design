import { db } from "@/db";
import {
  announcements,
  emailTemplates,
  faqs,
  popups,
  settings,
  sites,
  type Popup,
} from "@/db/schema";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { normalizePopupButtons } from "@/lib/popup-buttons";
import { toPublicSite } from "@/lib/public-site";
import { ensureSiteColumns } from "@/lib/sponsor-catalog";

export const DEFAULT_SETTINGS: Record<string, string> = {
  hero_title: "Türkiye'deki Bütün Bahis ve Casino Siteleri",
  hero_subtitle:
    "Güncel giriş adresleri, bonus kampanyaları ve ödeme performansı tek listede. Her adres yayına alınmadan önce elle kontrol edilir.",
  featured_title: "Güvenilir Siteler",
  featured_subtitle:
    "Ödeme hızı ve kullanıcı geri bildirimiyle öne çıkan sponsorlar",
  all_title: "Tüm Siteler",
  all_subtitle: "Güncel giriş adresleri ve bonuslar",
  all_page_size: "24",
  featured_big_count: "4",
  bottom_banner:
    "100 FREESPIN DENEME BONUSUNU ALMAYI UNUTMA │ SINIRSIZ VE LİMİTSİZ ÇEKİM İMKANI İLE KESİNTİSİZ OYUN DENEYİMİ",
  bottom_banner_cta: "100 FREESPIN DENEME",
  bottom_banner_url: "#",
  telegram_url: "https://t.me/",
  contact_email: "info@alkanka.com",
  home_hero_image: "",
  home_campaign_image: "",
  telegram_announce_url: "",
  promo_code: "",
  partner_brand: "",
  partner_url: "",
  partner_bonus: "",
};

export async function getSettings() {
  const rows = await db.select().from(settings);
  const map: Record<string, string> = { ...DEFAULT_SETTINGS };
  for (const row of rows) {
    if (row.value) map[row.key] = row.value;
    else map[row.key] = map[row.key] ?? "";
  }
  return map;
}

export async function getFeaturedSites() {
  const rows = await db
    .select()
    .from(sites)
    .where(and(eq(sites.active, true), eq(sites.featured, true)))
    .orderBy(asc(sites.sortOrder), asc(sites.id));
  return rows.map(toPublicSite);
}

export async function getSponsorSites(limit = 10) {
  const sponsored = await db
    .select()
    .from(sites)
    .where(
      and(
        eq(sites.active, true),
        sql`btrim(${sites.logoUrl}) <> ''`,
        sql`(${sites.featured} OR ${sites.badge} ILIKE '%sponsor%')`,
      ),
    )
    .orderBy(desc(sites.featured), asc(sites.sortOrder), asc(sites.id))
    .limit(limit);
  if (sponsored.length >= 4) return sponsored.map(toPublicSite);

  const rows = await db
    .select()
    .from(sites)
    .where(and(eq(sites.active, true), sql`btrim(${sites.logoUrl}) <> ''`))
    .orderBy(asc(sites.sortOrder), asc(sites.id))
    .limit(limit);
  return rows.map(toPublicSite);
}

export function createShuffleSeed() {
  return Math.floor(Math.random() * 2_147_483_646) + 1;
}

export function restSitesShuffleOrder(seed: number) {
  return [
    sql`(btrim(coalesce(${sites.bonusText}, '')) = '')`,
    sql`md5(${sites.id}::text || '-' || ${seed}::text)`,
  ] as const;
}

export async function getRestSites(limit = 24, seed = createShuffleSeed()) {
  const rows = await db
    .select()
    .from(sites)
    .where(and(eq(sites.active, true), eq(sites.featured, false)))
    .orderBy(...restSitesShuffleOrder(seed), asc(sites.id))
    .limit(limit);

  const [{ c }] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(sites)
    .where(and(eq(sites.active, true), eq(sites.featured, false)));

  return { rows: rows.map(toPublicSite), total: c ?? 0, seed };
}

export async function getSiteCount() {
  const [{ c }] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(sites)
    .where(eq(sites.active, true));
  return c ?? 0;
}

export async function getAllSites() {
  await ensureSiteColumns();
  return db.select().from(sites).orderBy(asc(sites.sortOrder), asc(sites.id));
}

export async function getAnnouncements() {
  return db
    .select()
    .from(announcements)
    .where(eq(announcements.active, true))
    .orderBy(asc(announcements.sortOrder), asc(announcements.id));
}

export async function getAllAnnouncements() {
  return db
    .select()
    .from(announcements)
    .orderBy(asc(announcements.sortOrder), asc(announcements.id));
}

export function presentPopup(row: Popup) {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    imageUrl: row.imageUrl,
    buttons: normalizePopupButtons(row.buttons),
    delaySeconds: row.delaySeconds,
    oncePerVisitor: row.oncePerVisitor,
    active: row.active,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt,
  };
}

export async function getActivePopups() {
  const rows = await db
    .select()
    .from(popups)
    .where(eq(popups.active, true))
    .orderBy(asc(popups.sortOrder), asc(popups.id));
  return rows.map((row) => {
    const presented = presentPopup(row);
    return {
      id: presented.id,
      title: presented.title,
      body: presented.body,
      imageUrl: presented.imageUrl,
      buttons: presented.buttons,
      delaySeconds: presented.delaySeconds,
      oncePerVisitor: presented.oncePerVisitor,
    };
  });
}

export async function getAllPopups() {
  const rows = await db
    .select()
    .from(popups)
    .orderBy(asc(popups.sortOrder), asc(popups.id));
  return rows.map(presentPopup);
}

export async function getFaqs() {
  return db
    .select()
    .from(faqs)
    .where(eq(faqs.active, true))
    .orderBy(asc(faqs.sortOrder), asc(faqs.id));
}

export async function getAllFaqs() {
  return db.select().from(faqs).orderBy(asc(faqs.sortOrder), asc(faqs.id));
}

export async function getAllEmailTemplates() {
  return db
    .select()
    .from(emailTemplates)
    .orderBy(desc(emailTemplates.updatedAt), desc(emailTemplates.id));
}
