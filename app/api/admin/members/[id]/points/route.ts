import { requireAuth } from "@/lib/admin-gate";
import { adjustPoints, listLedger, pointsFailure } from "@/lib/points";
import { parseSignedAmount } from "@/lib/points-rules";
import { NextRequest, NextResponse } from "next/server";

async function memberId(params: Promise<{ id: string }>) {
  const { id } = await params;
  const parsed = Number(id);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauth = await requireAuth();
  if (unauth) return unauth;
  const id = await memberId(params);
  if (!id) return NextResponse.json({ error: "Üye bulunamadı." }, { status: 404 });

  try {
    return NextResponse.json({ ledger: await listLedger(id, 20) });
  } catch (err) {
    return pointsFailure(err);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauth = await requireAuth();
  if (unauth) return unauth;
  const id = await memberId(params);
  if (!id) return NextResponse.json({ error: "Üye bulunamadı." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const amount = parseSignedAmount(body?.amount);
  if (amount == null) {
    return NextResponse.json(
      { error: "Tutar -1.000.000 ile 1.000.000 arasında, sıfırdan farklı bir tam sayı olmalı." },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(await adjustPoints(id, amount, String(body?.reason ?? "")));
  } catch (err) {
    return pointsFailure(err);
  }
}
