import { MEMBER_COOKIE, createMemberSessionToken, memberCookieOptions } from "@/lib/member-auth";
import { pointsFailure, registerMember } from "@/lib/points";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const ip = clientIp(req.headers);
  const gate = rateLimit(`member-register:${ip}`, 5, 60 * 60 * 1000);
  if (!gate.allowed) {
    return NextResponse.json(
      { error: `Çok fazla kayıt denemesi. ${gate.retryAfter} saniye sonra tekrar deneyin.` },
      { status: 429, headers: { "Retry-After": String(gate.retryAfter) } },
    );
  }

  const body = await req.json().catch(() => ({}));
  const username = String(body?.username ?? "");
  const password = String(body?.password ?? "");
  const email = String(body?.email ?? "");

  try {
    const member = await registerMember(username, password, email, body?.adult === true);
    const res = NextResponse.json({
      ok: true,
      username: member.username,
      balance: member.balance,
    });
    res.cookies.set(MEMBER_COOKIE, createMemberSessionToken(member.id), memberCookieOptions());
    return res;
  } catch (err) {
    return pointsFailure(err);
  }
}
