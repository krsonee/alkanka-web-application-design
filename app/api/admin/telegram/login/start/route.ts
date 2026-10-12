import { db } from "@/db";
import { telegramConfig } from "@/db/schema";
import { requireAuth } from "@/lib/admin-gate";
import { encryptSecret } from "@/lib/telegram-crypto";
import { describeTelegramError, PasswordHashInvalidError, PhoneCodeInvalidError } from "@/lib/telegram-errors";
import {
  getPendingLogin,
  setPendingLogin,
  waitFor,
  type PendingLogin,
} from "@/lib/telegram-login-session";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { TelegramClient, sessions } from "teleproto";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function accountLabel(user: { username?: string; phone?: string }) {
  if (user.username) return `@${user.username}`;
  if (user.phone) return `+${user.phone}`;
  return "Telegram hesabı";
}

export async function POST(req: NextRequest) {
  const unauth = await requireAuth();
  if (unauth) return unauth;

  const body = await req.json().catch(() => ({}));
  const apiId = Number(body.apiId);
  const apiHash = String(body.apiHash ?? "").trim();
  const phoneNumber = String(body.phoneNumber ?? "").trim();

  if (!Number.isInteger(apiId) || apiId <= 0) {
    return NextResponse.json({ error: "API ID geçersiz" }, { status: 400 });
  }
  if (!apiHash) {
    return NextResponse.json({ error: "API Hash gerekli" }, { status: 400 });
  }
  if (!phoneNumber.startsWith("+") || phoneNumber.length < 8) {
    return NextResponse.json(
      { error: "Telefon numarası ülke koduyla girilmeli (örn. +905551112233)" },
      { status: 400 },
    );
  }

  // Önceki yarım kalmış bir giriş denemesi varsa bağlantısını kapatıp
  // üzerine yazılır; aksi halde eski istemci sızıntısı birikir.
  const existing = getPendingLogin();
  if (existing) {
    await existing.client.disconnect().catch(() => {});
  }

  const client = new TelegramClient(new sessions.StringSession(""), apiId, apiHash, {
    connectionRetries: 3,
  });

  try {
    await client.connect();
  } catch (err) {
    return NextResponse.json(
      { error: `Telegram'a bağlanılamadı: ${describeTelegramError(err)}` },
      { status: 502 },
    );
  }

  const pending: PendingLogin = {
    client,
    apiId,
    apiHash,
    phoneNumber,
    phase: "awaiting_code",
    createdAt: Date.now(),
  };
  setPendingLogin(pending);

  // signInUser burada başlatılır ama beklenmez: kod ve gerekiyorsa şifre,
  // sonraki isteklerde admin panelden geldiğinde çözümlenecek. Bu sayede
  // istek/yanıt döngüsü tek bir uzun HTTP isteğine hapsolmaz.
  client
    .signInUser(
      { apiId, apiHash },
      {
        phoneNumber,
        phoneCode: () =>
          new Promise<string>((resolve) => {
            pending.resolveCode = resolve;
          }),
        password: () => {
          pending.phase = "awaiting_password";
          return new Promise<string>((resolve) => {
            pending.resolvePassword = resolve;
          });
        },
        onError: async (err) => {
          const message = describeTelegramError(err);
          // Yanlış kod veya 2FA şifresi fatal değildir: aynı oturumda
          // yeniden denenebilir. Diğer hatalarda giriş durdurulur.
          if (
            err instanceof PhoneCodeInvalidError ||
            err instanceof PasswordHashInvalidError
          ) {
            pending.lastError = message;
            return false;
          }
          pending.phase = "failed";
          pending.error = message;
          return true;
        },
      },
    )
    .then(async (user) => {
      const label = accountLabel(user as { username?: string; phone?: string });
      const sessionString = String(client.session.save() ?? "");

      const values = {
        apiId: String(apiId),
        apiHashEncrypted: encryptSecret(apiHash),
        sessionEncrypted: encryptSecret(sessionString),
        accountLabel: label,
        connected: true,
      };
      const [existing] = await db.select().from(telegramConfig).limit(1);
      if (existing) {
        await db.update(telegramConfig).set(values).where(eq(telegramConfig.id, existing.id));
      } else {
        await db.insert(telegramConfig).values(values);
      }

      pending.phase = "done";
      pending.accountLabel = label;
      await client.disconnect().catch(() => {});
    })
    .catch((err) => {
      if (pending.phase !== "failed") {
        pending.phase = "failed";
        pending.error = describeTelegramError(err);
      }
    });

  // sendCode tamamlanmadan (yani resolveCode atanmadan) yanıt dönülürse
  // panel "kod gönderildi" sanır ama Telegram henüz SMS/uygulama kodu
  // yollamamış olabilir. En fazla 25 saniye beklenir.
  const ready = await waitFor(
    () => Boolean(pending.resolveCode) || pending.phase === "failed",
    25_000,
  );
  if (!ready) {
    pending.phase = "failed";
    pending.error = "Telegram kod gönderimini zamanında tamamlamadı";
    await client.disconnect().catch(() => {});
    return NextResponse.json({ error: pending.error }, { status: 504 });
  }
  if (pending.phase === "failed") {
    const error = pending.error ?? "Giriş başlatılamadı";
    await client.disconnect().catch(() => {});
    return NextResponse.json({ error }, { status: 401 });
  }

  return NextResponse.json({ ok: true, phase: "awaiting_code" });
}
