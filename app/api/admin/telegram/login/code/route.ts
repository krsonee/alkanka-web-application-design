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
  // Ayrı bir yerel değişkende okunur: pending.phase, arka planda çalışan
  // signInUser zinciri tarafından bu fonksiyonun dışında değiştiriliyor,
  // doğrudan daralan karşılaştırma TypeScript'i yanlış yönlendirir.
  const initialPhase: string = pending.phase;
  if (initialPhase !== "awaiting_code") {
    return NextResponse.json(
      { error: "Bu adımda kod beklenmiyor" },
      { status: 409 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const code = String(body.code ?? "").trim();
  if (!code) {
    return NextResponse.json({ error: "Kod gerekli" }, { status: 400 });
  }

  // signInUser'ın phoneCode geri çağırması, sendCode tamamlanınca çalışır;
  // teoride çok hızlı gönderilen bir istek onu henüz atanmamış bulabilir.
  const ready = await waitFor(() => Boolean(pending.resolveCode), 5_000);
  if (!ready || !pending.resolveCode) {
    return NextResponse.json(
      { error: "Kod isteği henüz hazır değil, birkaç saniye sonra tekrar deneyin" },
      { status: 409 },
    );
  }

  pending.resolveCode(code);
  pending.resolveCode = undefined;
  pending.lastError = undefined;

  const settled = await waitFor(
    () =>
      pending.phase !== "awaiting_code" ||
      Boolean(pending.lastError) ||
      Boolean(pending.resolveCode),
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
  if (pending.phase === "awaiting_password") {
    return NextResponse.json({ ok: true, needsPassword: true });
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
