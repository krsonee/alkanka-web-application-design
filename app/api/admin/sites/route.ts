import { db } from "@/db";
import { sites } from "@/db/schema";
import { requireAuth } from "@/lib/admin-gate";
import { getAllSites } from "@/lib/data";
import { ensureSiteColumns } from "@/lib/sponsor-catalog";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

function siteFields(body: Record<string, unknown>) {
  const rating = Number(body.rating ?? 0);
  return {
    name: String(body.name),
    logoUrl: String(body.logoUrl ?? ""),
    bonusText: String(body.bonusText ?? ""),
    url: String(body.url ?? "#"),
    entryUrl: String(body.entryUrl ?? ""),
    domain: String(body.domain ?? ""),
    badge: String(body.badge ?? ""),
    tagline: String(body.tagline ?? ""),
    perks: String(body.perks ?? ""),
    rating: Number.isFinite(rating) ? Math.min(5, Math.max(0, rating)) : 0,
    payout: String(body.payout ?? ""),
    bonusType: String(body.bonusType ?? ""),
    wagerText: String(body.wagerText ?? ""),
    bonusCode: String(body.bonusCode ?? ""),
    featured: Boolean(body.featured),
    active: body.active === undefined ? true : Boolean(body.active),
    sortOrder: Number(body.sortOrder ?? 0),
    clicks: Math.max(0, Number(body.clicks ?? 0) || 0),
  };
}

function refreshSitePages() {
  revalidatePath("/");
  revalidatePath("/sponsorlar");
  revalidatePath("/kampanyalar");
  revalidatePath("/sitemap.xml");
}

export async function GET() {
  const unauth = await requireAuth();
  if (unauth) return unauth;
  return NextResponse.json(await getAllSites());
}

export async function POST(req: NextRequest) {
  const unauth = await requireAuth();
  if (unauth) return unauth;

  const body = await req.json().catch(() => ({}));
  if (!body?.name) {
    return NextResponse.json({ error: "İsim zorunlu" }, { status: 400 });
  }

  await ensureSiteColumns();
  const [row] = await db.insert(sites).values(siteFields(body)).returning();
  refreshSitePages();
  return NextResponse.json(row, { status: 201 });
}
