import { isAuthenticated } from "@/lib/admin-gate";
import { getArenaSettings } from "@/lib/arena-server";
import { listTournaments } from "@/lib/tournaments";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  }
  const [settings, tournaments] = await Promise.all([getArenaSettings(), listTournaments()]);
  return NextResponse.json({ settings, tournaments });
}
