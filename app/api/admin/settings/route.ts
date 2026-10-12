import { db } from "@/db";
import { settings } from "@/db/schema";
import { requireAuth } from "@/lib/admin-gate";
import { getSettings } from "@/lib/data";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const unauth = await requireAuth();
  if (unauth) return unauth;
  return NextResponse.json(await getSettings());
}

export async function PUT(req: NextRequest) {
  const unauth = await requireAuth();
  if (unauth) return unauth;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  for (const [key, value] of Object.entries(body)) {
    await db
      .insert(settings)
      .values({ key, value: String(value ?? "") })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value: String(value ?? "") },
      });
  }

  return NextResponse.json(await getSettings());
}
