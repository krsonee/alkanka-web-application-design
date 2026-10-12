import { db } from "@/db";
import { popups } from "@/db/schema";
import { requireAuth } from "@/lib/admin-gate";
import { getAllPopups, presentPopup } from "@/lib/data";
import { serializePopupButtons } from "@/lib/popup-buttons";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const unauth = await requireAuth();
  if (unauth) return unauth;
  return NextResponse.json(await getAllPopups());
}

export async function POST(req: NextRequest) {
  const unauth = await requireAuth();
  if (unauth) return unauth;

  const body = await req.json().catch(() => ({}));
  const title = String(body.title ?? "").trim();
  const message = String(body.body ?? "").trim();
  const imageUrl = String(body.imageUrl ?? "").trim();

  if (!title && !message && !imageUrl) {
    return NextResponse.json(
      { error: "Başlık, metin veya görsel zorunlu" },
      { status: 400 },
    );
  }

  const delaySeconds = Number(body.delaySeconds ?? 0);
  const [row] = await db
    .insert(popups)
    .values({
      title,
      body: message,
      imageUrl,
      buttons: serializePopupButtons(body.buttons),
      delaySeconds: Number.isFinite(delaySeconds)
        ? Math.min(120, Math.max(0, Math.trunc(delaySeconds)))
        : 0,
      oncePerVisitor:
        body.oncePerVisitor === undefined ? false : Boolean(body.oncePerVisitor),
      active: body.active === undefined ? true : Boolean(body.active),
      sortOrder: Number(body.sortOrder ?? 0),
    })
    .returning();

  if (!row) {
    return NextResponse.json({ error: "Kayıt oluşturulamadı" }, { status: 500 });
  }

  return NextResponse.json(presentPopup(row), { status: 201 });
}
