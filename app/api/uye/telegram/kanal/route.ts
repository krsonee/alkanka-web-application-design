import { getCurrentMember } from "@/lib/member-auth";
import { getAccount } from "@/lib/points";
import { checkChannelMembership, telegramStatus } from "@/lib/telegram-member";
import { NextResponse } from "next/server";

export async function POST() {
  const member = await getCurrentMember();
  if (!member) return NextResponse.json({ error: "Giriş yapın." }, { status: 401 });
  const status = await telegramStatus();
  if (!status.connected) {
    return NextResponse.json({ connected: false, message: "Telegram henüz bağlanmadı." });
  }
  const account = await getAccount(member.id);
  if (!account?.telegram_id) {
    return NextResponse.json({ connected: true, inChannel: false, message: "Önce Telegram hesabını bağla." });
  }
  return NextResponse.json(await checkChannelMembership(account.telegram_id));
}
