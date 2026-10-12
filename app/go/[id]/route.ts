import { db } from "@/db";
import { recordVisit } from "@/lib/engage";
import { getCurrentMember } from "@/lib/member-auth";
import { sites } from "@/db/schema";
import {
  attachVisitorCookie,
  recordAnalyticsEvent,
  visitorFromRequest,
} from "@/lib/analytics";
import { eq, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const siteId = Number(id);
  const home = new URL("/", req.url);

  if (!Number.isInteger(siteId) || siteId <= 0) {
    return NextResponse.redirect(home);
  }

  const [site] = await db
    .select({
      name: sites.name,
      url: sites.url,
      entryUrl: sites.entryUrl,
      active: sites.active,
    })
    .from(sites)
    .where(eq(sites.id, siteId))
    .limit(1);

  if (!site || !site.active) return NextResponse.redirect(home);

  const wantsDirect = req.nextUrl.searchParams.get("d") === "1";
  const primary = site.url && site.url !== "#" ? site.url : "";
  const target = wantsDirect ? site.entryUrl || primary : primary || site.entryUrl;

  if (!target) return NextResponse.redirect(home);

  let destination: URL;
  try {
    destination = new URL(target);
  } catch {
    return NextResponse.redirect(home);
  }
  if (destination.protocol !== "https:" && destination.protocol !== "http:") {
    return NextResponse.redirect(home);
  }

  const visitorId = visitorFromRequest(req);
  const member = await getCurrentMember().catch(() => null);
  if (member) {
    try {
      await recordVisit(member.id, siteId);
    } catch {
      // Ziyaret kaydı yönlendirmeyi bozmasın.
    }
  }
  await Promise.all([
    db
      .update(sites)
      .set({ clicks: sql`${sites.clicks} + 1` })
      .where(eq(sites.id, siteId)),
    recordAnalyticsEvent({
      kind: "click",
      target: wantsDirect ? "site_direct" : "site",
      targetId: siteId,
      label: site.name,
      visitorId,
    }),
  ]);

  const res = NextResponse.redirect(destination.toString(), 302);
  attachVisitorCookie(res, visitorId);
  // Yönlendirme adresleri önbelleğe alınmasın; hedef her an değişebilir.
  res.headers.set("Cache-Control", "no-store, max-age=0");
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}
