import { db } from "@/db";
import { telegramConfig } from "@/db/schema";
import { requireAuth } from "@/lib/admin-gate";
import { formatTelegramBotAdmins } from "@/lib/telegram-bot-admin";
import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const unauth = await requireAuth();
  if (unauth) return unauth;

  const [row] = await db.select().from(telegramConfig).limit(1);

  // Şifreli alanlar (apiHash, oturum, bot token) bilerek dönülmez.
  return NextResponse.json({
    connected: row?.connected ?? false,
    accountLabel: row?.accountLabel ?? "",
    hasApiCredentials: Boolean(row?.apiId),
    hasBotToken: Boolean(row?.botTokenEncrypted),
    botUsername: row?.botUsername ?? "",
    botAdmin: formatTelegramBotAdmins(),
  });
}

export async function DELETE() {
  const unauth = await requireAuth();
  if (unauth) return unauth;

  // Yalnızca kullanıcı oturumu koparılır; bot tokeni durur.
  await db.update(telegramConfig).set({
    apiId: "",
    apiHashEncrypted: "",
    sessionEncrypted: "",
    accountLabel: "",
    connected: false,
    updatedAt: sql`now()`,
  });
  return NextResponse.json({ ok: true });
}
