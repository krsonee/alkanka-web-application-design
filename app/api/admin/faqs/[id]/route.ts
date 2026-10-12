import { db } from "@/db";
import { faqs } from "@/db/schema";
import { requireAuth } from "@/lib/admin-gate";
import { slugify } from "@/lib/slug";
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

  if (body.question !== undefined) {
    values.question = String(body.question).trim();
    values.slug = slugify(String(body.question));
  }
  if (body.answer !== undefined) values.answer = String(body.answer).trim();
  if (body.category !== undefined) {
    values.category = String(body.category).trim() || "Genel";
  }
  // Boş gönderilen bağlantı adı mevcut değeri silmemeli; sorudan üretilen
  // değer yukarıda zaten atanıyor.
  if (body.slug !== undefined && String(body.slug).trim()) {
    values.slug = slugify(String(body.slug));
  }
  if (body.active !== undefined) values.active = Boolean(body.active);
  if (body.sortOrder !== undefined) values.sortOrder = Number(body.sortOrder);

  if (Object.keys(values).length === 0) {
    return NextResponse.json(
      { error: "Güncellenecek alan yok" },
      { status: 400 },
    );
  }

  const [row] = await db
    .update(faqs)
    .set(values)
    .where(eq(faqs.id, Number(id)))
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
  await db.delete(faqs).where(eq(faqs.id, Number(id)));
  return NextResponse.json({ ok: true });
}
