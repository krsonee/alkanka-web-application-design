import { requireAuth } from "@/lib/admin-gate";
import {
  getMemberDossier,
  setMemberClosed,
  setMemberEmail,
  setMemberPassword,
  unlinkMemberTelegram,
} from "@/lib/member-admin";
import { pointsFailure } from "@/lib/points";
import { NextRequest, NextResponse } from "next/server";

async function memberId(params: Promise<{ id: string }>) {
  const { id } = await params;
  const parsed = Number(id);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauth = await requireAuth();
  if (unauth) return unauth;
  const id = await memberId(params);
  if (!id) return NextResponse.json({ error: "Üye bulunamadı." }, { status: 404 });
  try {
    return NextResponse.json(await getMemberDossier(id));
  } catch (err) {
    return pointsFailure(err);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauth = await requireAuth();
  if (unauth) return unauth;
  const id = await memberId(params);
  if (!id) return NextResponse.json({ error: "Üye bulunamadı." }, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as {
    email?: unknown;
    password?: unknown;
    closed?: unknown;
    unlinkTelegram?: unknown;
  };

  try {
    if (typeof body.email === "string") await setMemberEmail(id, body.email);
    if (typeof body.password === "string" && body.password.length > 0) await setMemberPassword(id, body.password);
    if (typeof body.closed === "boolean") await setMemberClosed(id, body.closed);
    if (body.unlinkTelegram === true) await unlinkMemberTelegram(id);
    return NextResponse.json(await getMemberDossier(id));
  } catch (err) {
    return pointsFailure(err);
  }
}
