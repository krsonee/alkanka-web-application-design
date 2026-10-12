import { db } from "@/db";
import { announcements } from "@/db/schema";
import { requireAuth } from "@/lib/admin-gate";
import { eq } from "drizzle-orm";
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
  if (body.text !== undefined) values.text = String(body.text);
  if (body.active !== undefined) values.active = Boolean(body.active);
  if (body.sortOrder !== undefined) values.sortOrder = Number(body.sortOrder);
  if (Object.keys(values).length === 0) {
    return NextResponse.json({ error: "Güncellenecek alan yok" }, { status: 400 });
  }
  const [row] = await db
    .update(announcements)
    .set(values)
    .where(eq(announcements.id, Number(id)))
    .returning();
  return NextResponse.json(row ?? null);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauth = await requireAuth();
  if (unauth) return unauth;
  const { id } = await params;
  await db.delete(announcements).where(eq(announcements.id, Number(id)));
  return NextResponse.json({ ok: true });
}
