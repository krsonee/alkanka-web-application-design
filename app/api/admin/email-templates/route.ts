import { db } from "@/db";
import { emailTemplates } from "@/db/schema";
import { requireAuth } from "@/lib/admin-gate";
import { getAllEmailTemplates } from "@/lib/data";
import {
  compileEmailHtml,
  normalizeEmailFields,
  normalizeTemplateName,
} from "@/lib/email-template";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const unauth = await requireAuth();
  if (unauth) return unauth;
  return NextResponse.json(await getAllEmailTemplates());
}

export async function POST(req: NextRequest) {
  const unauth = await requireAuth();
  if (unauth) return unauth;

  const body = await req.json().catch(() => ({}));
  const name = normalizeTemplateName(body.name);
  if (!name) {
    return NextResponse.json({ error: "Şablon adı zorunlu" }, { status: 400 });
  }

  const fields = normalizeEmailFields(body);
  const [row] = await db
    .insert(emailTemplates)
    .values({
      name,
      ...fields,
      html: compileEmailHtml(fields),
    })
    .returning();

  if (!row) {
    return NextResponse.json({ error: "Kayıt oluşturulamadı" }, { status: 500 });
  }
  return NextResponse.json(row, { status: 201 });
}
