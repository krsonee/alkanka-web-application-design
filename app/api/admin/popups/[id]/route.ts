import { db } from "@/db";
import { popups } from "@/db/schema";
import { requireAuth } from "@/lib/admin-gate";
import { presentPopup } from "@/lib/data";
import { serializePopupButtons } from "@/lib/popup-buttons";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauth = await requireAuth();
  if (unauth) return unauth;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const values: Record<string, unknown> = {};

  if (body.title !== undefined) values.title = String(body.title).trim();
  if (body.body !== undefined) values.body = String(body.body).trim();
  if (body.imageUrl !== undefined) values.imageUrl = String(body.imageUrl).trim();
  if (body.buttons !== undefined) {
    values.buttons = serializePopupButtons(body.buttons);
  }
  if (body.delaySeconds !== undefined) {
    const delaySeconds = Number(body.delaySeconds);
    values.delaySeconds = Number.isFinite(delaySeconds)
      ? Math.min(120, Math.max(0, Math.trunc(delaySeconds)))
      : 0;
  }
  if (body.oncePerVisitor !== undefined) {
    values.oncePerVisitor = Boolean(body.oncePerVisitor);
  }
  if (body.active !== undefined) values.active = Boolean(body.active);
  if (body.sortOrder !== undefined) values.sortOrder = Number(body.sortOrder);

  if (Object.keys(values).length === 0) {
    return NextResponse.json({ error: "Güncellenecek alan yok" }, { status: 400 });
  }

  const [row] = await db
    .update(popups)
    .set(values)
    .where(eq(popups.id, Number(id)))
    .returning();
  return NextResponse.json(row ? presentPopup(row) : null);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauth = await requireAuth();
  if (unauth) return unauth;
  const { id } = await params;
  await db.delete(popups).where(eq(popups.id, Number(id)));
  return NextResponse.json({ ok: true });
}
