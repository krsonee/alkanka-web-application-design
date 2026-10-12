import { requireAuth } from "@/lib/admin-gate";
import { deskGet, deskPost } from "@/lib/desk";
import { pointsFailure } from "@/lib/points";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const unauth = await requireAuth();
  if (unauth) return unauth;
  try {
    const section = new URL(req.url).searchParams.get("section") ?? "";
    return NextResponse.json(await deskGet(section));
  } catch (err) {
    return pointsFailure(err);
  }
}

export async function POST(req: NextRequest) {
  const unauth = await requireAuth();
  if (unauth) return unauth;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    return NextResponse.json(await deskPost(body));
  } catch (err) {
    return pointsFailure(err);
  }
}
