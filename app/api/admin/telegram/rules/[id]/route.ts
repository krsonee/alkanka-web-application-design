import { db } from "@/db";
import { telegramForwardRules } from "@/db/schema";
import { requireAuth } from "@/lib/admin-gate";
import {
  normalizeFooterButtonLayout,
  normalizeFooterButtons,
  serializeFooterButtons,
} from "@/lib/telegram-footer-buttons";
import { eq, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function presentRule(row: typeof telegramForwardRules.$inferSelect | undefined) {
  if (!row) return null;
  return {
    ...row,
    footerButtons: normalizeFooterButtons(row.footerButtons),
    footerButtonLayout: normalizeFooterButtonLayout(row.footerButtonLayout),
  };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauth = await requireAuth();
  if (unauth) return unauth;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const values: Record<string, unknown> = { updatedAt: sql`now()` };

  if (body.sourceChannel !== undefined) {
    values.sourceChannel = String(body.sourceChannel).trim();
  }
  if (body.targetChannel !== undefined) {
    values.targetChannel = String(body.targetChannel).trim();
  }
  if (body.footerText !== undefined) {
    values.footerText = String(body.footerText);
    values.footerEntities = "[]";
  }
  if (body.footerButtons !== undefined) {
    values.footerButtons = serializeFooterButtons(body.footerButtons);
  }
  if (body.footerButtonLayout !== undefined) {
    values.footerButtonLayout = normalizeFooterButtonLayout(body.footerButtonLayout);
  }
  if (body.active !== undefined) values.active = Boolean(body.active);
  if (body.sortOrder !== undefined) values.sortOrder = Number(body.sortOrder);

  const [row] = await db
    .update(telegramForwardRules)
    .set(values)
    .where(eq(telegramForwardRules.id, Number(id)))
    .returning();
  return NextResponse.json(presentRule(row));
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauth = await requireAuth();
  if (unauth) return unauth;

  const { id } = await params;
  await db.delete(telegramForwardRules).where(eq(telegramForwardRules.id, Number(id)));
  return NextResponse.json({ ok: true });
}
