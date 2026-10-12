import { getCurrentMember } from "@/lib/member-auth";
import { unlinkTelegram } from "@/lib/telegram-member";
import { NextResponse } from "next/server";

export async function POST() {
  const member = await getCurrentMember();
  if (!member) return NextResponse.json({ error: "Giriş yapın." }, { status: 401 });
  await unlinkTelegram(member.id);
  return NextResponse.json({ ok: true });
}
