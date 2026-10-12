import { db } from "@/db";
import { announcements } from "@/db/schema";
import { requireAuth } from "@/lib/admin-gate";
import { getAllAnnouncements } from "@/lib/data";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const unauth = await requireAuth();
  if (unauth) return unauth;
  return NextResponse.json(await getAllAnnouncements());
}

export async function POST(req: NextRequest) {
  const unauth = await requireAuth();
  if (unauth) return unauth;
  const body = await req.json().catch(() => ({}));
  if (!body?.text) {
    return NextResponse.json({ error: "Metin zorunlu" }, { status: 400 });
  }
  const [row] = await db
    .insert(announcements)
    .values({
      text: String(body.text),
      active: body.active === undefined ? true : Boolean(body.active),
      sortOrder: Number(body.sortOrder ?? 0),
    })
    .returning();
  return NextResponse.json(row, { status: 201 });
}
