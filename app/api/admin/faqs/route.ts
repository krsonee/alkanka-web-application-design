import { db } from "@/db";
import { faqs } from "@/db/schema";
import { requireAuth } from "@/lib/admin-gate";
import { getAllFaqs } from "@/lib/data";
import { slugify } from "@/lib/slug";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const unauth = await requireAuth();
  if (unauth) return unauth;
  return NextResponse.json(await getAllFaqs());
}

export async function POST(req: NextRequest) {
  const unauth = await requireAuth();
  if (unauth) return unauth;

  const body = await req.json().catch(() => ({}));
  const question = String(body?.question ?? "").trim();
  const answer = String(body?.answer ?? "").trim();

  if (!question || !answer) {
    return NextResponse.json(
      { error: "Soru ve cevap zorunlu" },
      { status: 400 },
    );
  }

  const [row] = await db
    .insert(faqs)
    .values({
      question,
      answer,
      category: String(body.category ?? "Genel").trim() || "Genel",
      slug: slugify(body.slug ? String(body.slug) : question),
      active: body.active === undefined ? true : Boolean(body.active),
      sortOrder: Number(body.sortOrder ?? 0),
    })
    .returning();

  return NextResponse.json(row, { status: 201 });
}
