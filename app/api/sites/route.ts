import { db } from "@/db";
import { sites } from "@/db/schema";
import { and, asc, eq, ilike, or, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { toPublicSite } from "@/lib/public-site";
import { verifyListToken } from "@/lib/list-token";
import { clientIp } from "@/lib/request";
import { rateLimit } from "@/lib/rate-limit";
import { restSitesShuffleOrder } from "@/lib/data";

export const dynamic = "force-dynamic";

// Bir ziyaretçinin saat başına alabileceği kart sayısı. Yaklaşık 25 "daha
// fazla yükle" tıklamasına denk gelir; normal gezinme için fazlasıyla yeterli
// ama katalogun tamamının tek oturumda kopyalanmasına izin vermez.
const HOURLY_ROW_BUDGET = 600;

export async function GET(req: NextRequest) {
  const ip = clientIp(req.headers);

  if (!verifyListToken(req.headers.get("x-list-token"), ip)) {
    return NextResponse.json(
      { error: "Geçersiz oturum", code: "token" },
      { status: 403 },
    );
  }

  const sp = req.nextUrl.searchParams;
  const offset = Math.max(0, Number(sp.get("offset") ?? 0) || 0);
  const limit = Math.min(30, Math.max(1, Number(sp.get("limit") ?? 24) || 24));
  const q = (sp.get("q") ?? "").trim().slice(0, 60);
  const scope = sp.get("scope") === "featured" ? "featured" : "all";
  const seedRaw = Number(sp.get("seed"));
  const seed =
    Number.isInteger(seedRaw) && seedRaw > 0 ? seedRaw : Date.now() % 2_147_483_646;

  const budget = rateLimit(`${ip}:rows`, HOURLY_ROW_BUDGET, 3_600_000, limit);
  if (!budget.allowed) {
    return NextResponse.json(
      { error: "Çok fazla istek gönderildi" },
      { status: 429, headers: { "Retry-After": String(budget.retryAfter) } },
    );
  }

  const filters = [eq(sites.active, true)];

  // Arama yapılırken öne çıkan siteler de sonuçlara girmeli; aksi halde
  // listede görünen bir sponsor aratıldığında sonuç boş dönüyor.
  if (scope === "featured") filters.push(eq(sites.featured, true));
  else if (!q) filters.push(eq(sites.featured, false));

  if (q) {
    const like = `%${q}%`;
    filters.push(or(ilike(sites.name, like), ilike(sites.bonusText, like))!);
  }

  const where = and(...filters);

  const [rows, countRows] = await Promise.all([
    db
      .select()
      .from(sites)
      .where(where)
      .orderBy(
        ...(q ? [asc(sites.sortOrder)] : restSitesShuffleOrder(seed)),
        asc(sites.id),
      )
      .limit(limit)
      .offset(offset),
    db.select({ c: sql<number>`count(*)::int` }).from(sites).where(where),
  ]);

  const res = NextResponse.json({
    items: rows.map(toPublicSite),
    total: countRows[0]?.c ?? 0,
    offset,
    limit,
  });
  res.headers.set("Cache-Control", "no-store");
  return res;
}
