import { db } from "@/db";
import { telegramForwardLog } from "@/db/schema";
import { requireAuth } from "@/lib/admin-gate";
import { desc } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const unauth = await requireAuth();
  if (unauth) return unauth;

  const rows = await db
    .select()
    .from(telegramForwardLog)
    .orderBy(desc(telegramForwardLog.createdAt))
    .limit(50);
  return NextResponse.json(rows);
}
