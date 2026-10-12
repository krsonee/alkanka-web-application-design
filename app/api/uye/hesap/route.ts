import { getCurrentMember } from "@/lib/member-auth";
import { changeMemberPassword, pointsFailure, updateMemberEmail } from "@/lib/points";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const member = await getCurrentMember();
  if (!member) return NextResponse.json({ error: "Giriş yapın." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const action = String(body.action ?? "");

  try {
    if (action === "email") {
      return NextResponse.json(await updateMemberEmail(member.id, String(body.email ?? "")));
    }
    if (action === "password") {
      return NextResponse.json(
        await changeMemberPassword(member.id, String(body.currentPassword ?? ""), String(body.newPassword ?? "")),
      );
    }
    return NextResponse.json({ error: "İşlem bulunamadı." }, { status: 404 });
  } catch (err) {
    return pointsFailure(err);
  }
}
