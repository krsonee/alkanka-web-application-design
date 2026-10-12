import { getCurrentMember } from "@/lib/member-auth";
import { getBalance } from "@/lib/points";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const member = await getCurrentMember();
  if (!member) return NextResponse.json({ member: null, balance: 0 });
  return NextResponse.json({
    member: { id: String(member.id), name: member.username },
    balance: await getBalance(member.id),
  });
}
