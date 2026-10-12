import { db } from "@/db";
import { sites } from "@/db/schema";
import { requireAuth } from "@/lib/admin-gate";
import { ensureSiteColumns } from "@/lib/sponsor-catalog";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauth = await requireAuth();
  if (unauth) return unauth;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const values: Record<string, unknown> = {};
  if (body.name !== undefined) values.name = String(body.name);
  if (body.logoUrl !== undefined) values.logoUrl = String(body.logoUrl);
  if (body.bonusText !== undefined) values.bonusText = String(body.bonusText);
  if (body.url !== undefined) values.url = String(body.url);
  if (body.entryUrl !== undefined) values.entryUrl = String(body.entryUrl);
  if (body.domain !== undefined) values.domain = String(body.domain);
  if (body.badge !== undefined) values.badge = String(body.badge);
  if (body.tagline !== undefined) values.tagline = String(body.tagline);
  if (body.perks !== undefined) values.perks = String(body.perks);
  if (body.rating !== undefined) {
    const rating = Number(body.rating);
    values.rating = Number.isFinite(rating) ? Math.min(5, Math.max(0, rating)) : 0;
  }
  if (body.payout !== undefined) values.payout = String(body.payout);
  if (body.bonusType !== undefined) values.bonusType = String(body.bonusType);
  if (body.wagerText !== undefined) values.wagerText = String(body.wagerText);
  if (body.bonusCode !== undefined) values.bonusCode = String(body.bonusCode);
  if (body.featured !== undefined) values.featured = Boolean(body.featured);
  if (body.active !== undefined) values.active = Boolean(body.active);
  if (body.sortOrder !== undefined) values.sortOrder = Number(body.sortOrder);
  if (body.clicks !== undefined) {
    values.clicks = Math.max(0, Number(body.clicks) || 0);
  }

  if (Object.keys(values).length === 0) {
    return NextResponse.json({ error: "Güncellenecek alan yok" }, { status: 400 });
  }

  await ensureSiteColumns();
  const [row] = await db
    .update(sites)
    .set(values)
    .where(eq(sites.id, Number(id)))
    .returning();

  revalidatePath("/");
  revalidatePath("/sponsorlar");
  revalidatePath("/kampanyalar");
  revalidatePath(`/siteler/${id}`);
  return NextResponse.json(row ?? null);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauth = await requireAuth();
  if (unauth) return unauth;
  const { id } = await params;
  await db.delete(sites).where(eq(sites.id, Number(id)));
  return NextResponse.json({ ok: true });
}
