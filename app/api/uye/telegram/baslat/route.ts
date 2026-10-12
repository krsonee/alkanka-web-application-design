import { getCurrentMember } from "@/lib/member-auth";
import { pointsFailure } from "@/lib/points";
import { startTelegramLink, TG_STATE_COOKIE } from "@/lib/telegram-member";
import { NextResponse } from "next/server";

export async function POST() {
  const member = await getCurrentMember();
  if (!member) return NextResponse.json({ error: "Giriş yapın." }, { status: 401 });
  try {
    const started = await startTelegramLink(member.id);
    if (!started.connected) return NextResponse.json(started);
    const res = NextResponse.json({ ok: true, url: started.url });
    res.cookies.set(TG_STATE_COOKIE, started.state, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 600,
      secure: process.env.NODE_ENV === "production",
    });
    return res;
  } catch (err) {
    return pointsFailure(err);
  }
}
