import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  createSessionToken,
  verifyPassword,
} from "@/lib/admin-gate";
import { rateLimit, resetRateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";
import { NextRequest, NextResponse } from "next/server";

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

export async function POST(req: NextRequest) {
  const ip = clientIp(req.headers);
  const key = `login-attempts:${ip}`;
  const attempt = rateLimit(key, MAX_ATTEMPTS, WINDOW_MS);

  if (!attempt.allowed) {
    return NextResponse.json(
      { error: `Çok fazla deneme. ${attempt.retryAfter} saniye sonra tekrar deneyin.` },
      { status: 429, headers: { "Retry-After": String(attempt.retryAfter) } },
    );
  }

  const body = await req.json().catch(() => ({}));
  const password = String(body?.password ?? "");

  if (!verifyPassword(password)) {
    return NextResponse.json({ error: "Hatalı şifre" }, { status: 401 });
  }

  resetRateLimit(key);

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, createSessionToken(), {
    httpOnly: true,
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_MAX_AGE,
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
