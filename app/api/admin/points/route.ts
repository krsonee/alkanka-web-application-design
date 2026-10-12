import { requireAuth } from "@/lib/admin-gate";
import { getPointsConfig, pointsFailure, savePointsSettings } from "@/lib/points";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const unauth = await requireAuth();
  if (unauth) return unauth;
  try {
    return NextResponse.json(await getPointsConfig());
  } catch (err) {
    return pointsFailure(err);
  }
}

export async function PUT(req: NextRequest) {
  const unauth = await requireAuth();
  if (unauth) return unauth;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    return NextResponse.json(await savePointsSettings(body));
  } catch (err) {
    return pointsFailure(err);
  }
}
