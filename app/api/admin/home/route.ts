import { requireAuth } from "@/lib/admin-gate";
import {
  deleteSlide,
  HomeVisualError,
  listAdminHome,
  saveCard,
  saveSlide,
} from "@/lib/home-visuals";
import { NextRequest, NextResponse } from "next/server";

function fail(err: unknown) {
  if (err instanceof HomeVisualError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  console.error("[anasayfa]", err);
  return NextResponse.json({ error: "Kayıt tamamlanamadı." }, { status: 500 });
}

export async function GET() {
  const unauth = await requireAuth();
  if (unauth) return unauth;
  try {
    return NextResponse.json(await listAdminHome());
  } catch (err) {
    return fail(err);
  }
}

export async function POST(req: NextRequest) {
  const unauth = await requireAuth();
  if (unauth) return unauth;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const action = String(body.action ?? "");
  try {
    if (action === "save-slide") return NextResponse.json(await saveSlide(body));
    if (action === "delete-slide") return NextResponse.json(await deleteSlide(body.id));
    if (action === "save-card") return NextResponse.json(await saveCard(body));
    return NextResponse.json({ error: "İşlem bulunamadı." }, { status: 404 });
  } catch (err) {
    return fail(err);
  }
}
