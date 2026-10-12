import { playDesignChest, playDesignDice, playDesignWheel, miniStatus } from "@/lib/mini-plays";
import { getCurrentMember } from "@/lib/member-auth";
import { pointsFailure } from "@/lib/points";
import { rateLimit } from "@/lib/rate-limit";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const member = await getCurrentMember();
  if (!member) return NextResponse.json({ error: "Giriş yapın." }, { status: 401 });
  try {
    return NextResponse.json(await miniStatus(member.id));
  } catch (err) {
    return pointsFailure(err);
  }
}

export async function POST(req: NextRequest) {
  const member = await getCurrentMember();
  if (!member) return NextResponse.json({ error: "Giriş yapın." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { game?: string; chest?: string };
  const game = body.game === "cark" || body.game === "zar" || body.game === "sandik" ? body.game : null;
  if (!game) return NextResponse.json({ error: "Oyun seçin." }, { status: 400 });

  const gate = rateLimit(`mini:${member.id}:${game}`, 30, 60_000);
  if (!gate.allowed) {
    return NextResponse.json(
      { error: `Çok fazla deneme. ${gate.retryAfter} saniye sonra tekrar deneyin.` },
      { status: 429, headers: { "Retry-After": String(gate.retryAfter) } },
    );
  }

  try {
    if (game === "cark") return NextResponse.json(await playDesignWheel(member.id));
    if (game === "zar") return NextResponse.json(await playDesignDice(member.id));
    return NextResponse.json(await playDesignChest(member.id, String(body.chest ?? "")));
  } catch (err) {
    return pointsFailure(err);
  }
}
