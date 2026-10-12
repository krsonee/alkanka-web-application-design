import { requireAuth } from "@/lib/admin-gate";
import {
  createShortLink,
  deleteShortLink,
  listShortLinks,
  ShortLinkError,
  updateShortLink,
} from "@/lib/short-links";
import { NextRequest, NextResponse } from "next/server";

function fail(err: unknown) {
  if (err instanceof ShortLinkError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  console.error("[kisa-link]", err);
  return NextResponse.json({ error: "Kısa link kaydedilemedi." }, { status: 500 });
}

export async function GET() {
  const unauth = await requireAuth();
  if (unauth) return unauth;
  try {
    return NextResponse.json({ links: await listShortLinks() });
  } catch (err) {
    return fail(err);
  }
}

export async function POST(req: NextRequest) {
  const unauth = await requireAuth();
  if (unauth) return unauth;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const action = String(body.action ?? "create");
  try {
    if (action === "update") return NextResponse.json(await updateShortLink(body));
    if (action === "delete") return NextResponse.json(await deleteShortLink(body.id));
    return NextResponse.json(await createShortLink(body));
  } catch (err) {
    return fail(err);
  }
}
