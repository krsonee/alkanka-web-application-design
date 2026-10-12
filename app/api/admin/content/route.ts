import { db } from "@/db";
import { settings } from "@/db/schema";
import { requireAuth } from "@/lib/admin-gate";
import { DESIGN_CONTENT_KEY, parseDesignContent } from "@/lib/design-content";
import { getSettings } from "@/lib/data";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const unauth = await requireAuth();
  if (unauth) return unauth;
  const stored = await getSettings();
  return NextResponse.json(parseDesignContent(stored[DESIGN_CONTENT_KEY]));
}

export async function PUT(req: NextRequest) {
  const unauth = await requireAuth();
  if (unauth) return unauth;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || !("slides" in body) || !("sponsors" in body)) {
    return NextResponse.json({ error: "İçerik eksik" }, { status: 400 });
  }
  const content = parseDesignContent(JSON.stringify(body));
  await db
    .insert(settings)
    .values({ key: DESIGN_CONTENT_KEY, value: JSON.stringify(content) })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: JSON.stringify(content) },
    });
  return NextResponse.json(content);
}
