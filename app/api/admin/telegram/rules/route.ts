import { db } from "@/db";
import { telegramForwardRules } from "@/db/schema";
import { requireAuth } from "@/lib/admin-gate";
import {
  normalizeFooterButtonLayout,
  normalizeFooterButtons,
  serializeFooterButtons,
} from "@/lib/telegram-footer-buttons";
import { asc } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function presentRule(row: typeof telegramForwardRules.$inferSelect) {
  return {
    ...row,
    footerButtons: normalizeFooterButtons(row.footerButtons),
    footerButtonLayout: normalizeFooterButtonLayout(row.footerButtonLayout),
  };
}

export async function GET() {
  const unauth = await requireAuth();
  if (unauth) return unauth;

  const rows = await db
    .select()
    .from(telegramForwardRules)
    .orderBy(asc(telegramForwardRules.sortOrder), asc(telegramForwardRules.id));
  return NextResponse.json(rows.map(presentRule));
}

function normalizeChannel(value: unknown): string {
  return String(value ?? "").trim();
}

export async function POST(req: NextRequest) {
  const unauth = await requireAuth();
  if (unauth) return unauth;

  const body = await req.json().catch(() => ({}));
  const sourceChannel = normalizeChannel(body.sourceChannel);
  const targetChannel = normalizeChannel(body.targetChannel);

  if (!sourceChannel || !targetChannel) {
    return NextResponse.json(
      { error: "Kaynak ve hedef kanal zorunlu" },
      { status: 400 },
    );
  }

  const [row] = await db
    .insert(telegramForwardRules)
    .values({
      sourceChannel,
      targetChannel,
      footerText: String(body.footerText ?? ""),
      footerButtons: serializeFooterButtons(body.footerButtons),
      footerButtonLayout: normalizeFooterButtonLayout(body.footerButtonLayout),
      active: body.active === undefined ? true : Boolean(body.active),
      sortOrder: Number(body.sortOrder ?? 0),
    })
    .returning();
  return NextResponse.json(presentRule(row), { status: 201 });
}
