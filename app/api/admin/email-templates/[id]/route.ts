import { db } from "@/db";
import { emailTemplates } from "@/db/schema";
import { requireAuth } from "@/lib/admin-gate";
import {
  compileEmailHtml,
  normalizeEmailFields,
  normalizeTemplateName,
} from "@/lib/email-template";
import { eq, sql } from "drizzle-orm";
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

  const existing = await db
    .select()
    .from(emailTemplates)
    .where(eq(emailTemplates.id, Number(id)))
    .then((rows) => rows[0]);
  if (!existing) {
    return NextResponse.json({ error: "Şablon bulunamadı" }, { status: 404 });
  }

  const fields = normalizeEmailFields({
    subject: body.subject ?? existing.subject,
    preheader: body.preheader ?? existing.preheader,
    layout: body.layout ?? existing.layout,
    headline: body.headline ?? existing.headline,
    bodyText: body.bodyText ?? existing.bodyText,
    bodyStyle: body.bodyStyle ?? existing.bodyStyle,
    imageUrl: body.imageUrl ?? existing.imageUrl,
    ctaText: body.ctaText ?? existing.ctaText,
    ctaUrl: body.ctaUrl ?? existing.ctaUrl,
    footerNote: body.footerNote ?? existing.footerNote,
  });

  const values: Record<string, unknown> = {
    ...fields,
    html: compileEmailHtml(fields),
    updatedAt: sql`now()`,
  };
  if (body.name !== undefined) {
    const name = normalizeTemplateName(body.name);
    if (!name) {
      return NextResponse.json({ error: "Şablon adı zorunlu" }, { status: 400 });
    }
    values.name = name;
  }

  const [row] = await db
    .update(emailTemplates)
    .set(values)
    .where(eq(emailTemplates.id, Number(id)))
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
  await db.delete(emailTemplates).where(eq(emailTemplates.id, Number(id)));
  return NextResponse.json({ ok: true });
}
