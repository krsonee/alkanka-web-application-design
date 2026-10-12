import { db } from "@/db";
import { telegramConfig } from "@/db/schema";
import { requireAuth } from "@/lib/admin-gate";
import { formatTelegramBotAdmins } from "@/lib/telegram-bot-admin";
import { encryptSecret } from "@/lib/telegram-crypto";
import { eq, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 20;

function looksLikeBotToken(token: string) {
  return /^\d{6,}:[A-Za-z0-9_-]{20,}$/.test(token);
}

async function telegramGetMe(token: string) {
  const res = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    result?: { username?: string; first_name?: string };
    description?: string;
  };
  if (!data.ok || !data.result) {
    throw new Error(data.description || "Token geçersiz");
  }
  return data.result;
}

export async function POST(req: NextRequest) {
  const unauth = await requireAuth();
  if (unauth) return unauth;

  const body = await req.json().catch(() => ({}));
  const token = String(body.token ?? "").trim();
  if (!looksLikeBotToken(token)) {
    return NextResponse.json(
      { error: "Bot token formatı geçersiz. BotFather'dan aldığınız tokeni yapıştırın." },
      { status: 400 },
    );
  }

  let me: { username?: string };
  try {
    me = await telegramGetMe(token);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Telegram tokeni doğrulanamadı" },
      { status: 400 },
    );
  }

  const username = me.username ?? "";
  const values = {
    botTokenEncrypted: encryptSecret(token),
    botUsername: username,
    updatedAt: sql`now()`,
  };

  const [existing] = await db.select().from(telegramConfig).limit(1);
  if (existing) {
    await db.update(telegramConfig).set(values).where(eq(telegramConfig.id, existing.id));
  } else {
    await db.insert(telegramConfig).values({
      botTokenEncrypted: encryptSecret(token),
      botUsername: username,
    });
  }

  return NextResponse.json({
    ok: true,
    botUsername: username,
    botAdmin: formatTelegramBotAdmins(),
  });
}

export async function DELETE() {
  const unauth = await requireAuth();
  if (unauth) return unauth;

  await db.update(telegramConfig).set({
    botTokenEncrypted: "",
    botUsername: "",
    updatedAt: sql`now()`,
  });
  return NextResponse.json({ ok: true });
}
