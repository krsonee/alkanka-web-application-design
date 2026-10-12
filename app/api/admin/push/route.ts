import { isAuthenticated } from "@/lib/admin-gate";
import { pushStats } from "@/lib/push";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  }
  return NextResponse.json(await pushStats());
}
