import { requireAuth } from "@/lib/admin-gate";
import {
  clearPendingLogin,
  getPendingLogin,
  waitFor,
} from "@/lib/telegram-login-session";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const unauth = await requireAuth();
  if (unauth) return unauth;

  const pending = getPendingLogin();
  if (!pending) {
    return NextResponse.json(
      { error: "Giriş oturumu bulunamadı, telefon adımından yeniden başlatın" },
      { status: 400 },
    );
  }
  const initialPhase: string = pending.phase;
  if (initialPhase !== "awaiting_password") {
    return NextResponse.json(
      { error: "Bu adımda şifre beklenmiyor" },
      { status: 409 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const password = String(body.password ?? "");
  if (!password) {
    return NextResponse.json({ error: "Şifre gerekli" }, { status: 400 });
  }

  const ready = await waitFor(() => Boolean(pending.resolvePassword), 5_000);
  if (!ready || !pending.resolvePassword) {
    return NextResponse.json(
      { error: "Şifre isteği henüz hazır değil, birkaç saniye sonra tekrar deneyin" },
      { status: 409 },
    );
  }

  pending.resolvePassword(password);
  pending.resolvePassword = undefined;
  pending.lastError = undefined;

  const settled = await waitFor(
    () =>
      pending.phase === "done" ||
      pending.phase === "failed" ||
      Boolean(pending.lastError) ||
      Boolean(pending.resolvePassword),
    15_000,
  );
  if (!settled) {
    return NextResponse.json(
      { error: "Zaman aşımı, tekrar deneyin" },
      { status: 504 },
    );
  }

  if (pending.lastError) {
    const error = pending.lastError;
    pending.lastError = undefined;
    return NextResponse.json({ error }, { status: 401 });
  }
  if (pending.phase === "done") {
    const label = pending.accountLabel ?? "";
    clearPendingLogin();
    return NextResponse.json({ ok: true, connected: true, accountLabel: label });
  }

  const error = pending.error ?? "Giriş başarısız";
  clearPendingLogin();
  return NextResponse.json({ error }, { status: 401 });
}
