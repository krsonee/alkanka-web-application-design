import { MEMBER_COOKIE, createMemberSessionToken, memberCookieOptions } from "@/lib/member-auth";
import { authenticateMember, grantDailyLogin, pointsFailure } from "@/lib/points";
import { rateLimit, resetRateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";
import { normalizeEmail, normalizeUsername } from "@/lib/points-rules";
import { NextRequest, NextResponse } from "next/server";

const WINDOW_MS = 15 * 60 * 1000;

export async function POST(req: NextRequest) {
  const ip = clientIp(req.headers);
  const body = await req.json().catch(() => ({}));
  const username = String(body?.username ?? "");
  const password = String(body?.password ?? "");
  const nameKey = normalizeEmail(username) ?? normalizeUsername(username) ?? "gecersiz";
  const ipKey = `member-login:${ip}`;
  const userKey = `member-login-name:${nameKey}`;
  const ipGate = rateLimit(ipKey, 8, WINDOW_MS);
  const userGate = rateLimit(userKey, 8, WINDOW_MS);
  if (!ipGate.allowed || !userGate.allowed) {
    const retryAfter = Math.max(ipGate.retryAfter, userGate.retryAfter);
    return NextResponse.json(
      { error: `Çok fazla deneme. ${retryAfter} saniye sonra tekrar deneyin.` },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }

  try {
    const member = await authenticateMember(username, password);
    if (!member) {
      return NextResponse.json({ error: "E-posta veya şifre hatalı." }, { status: 401 });
    }
    const daily = await grantDailyLogin(member.id);
    resetRateLimit(ipKey);
    resetRateLimit(userKey);
    const res = NextResponse.json({
      ok: true,
      username: member.username,
      dailyGranted: daily.granted,
      balance: daily.balance,
    });
    res.cookies.set(MEMBER_COOKIE, createMemberSessionToken(member.id), memberCookieOptions());
    return res;
  } catch (err) {
    return pointsFailure(err);
  }
}
