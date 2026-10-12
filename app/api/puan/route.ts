import {
  buyReward,
  buyTicket,
  claimTask,
  openChest,
  pickMatch,
  playDice,
  spinWheel,
} from "@/lib/engage";
import { getCurrentMember } from "@/lib/member-auth";
import { pointsFailure } from "@/lib/points";
import { rateLimit } from "@/lib/rate-limit";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const member = await getCurrentMember();
  if (!member) return NextResponse.json({ error: "Giriş yapın." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const action = String(body.action ?? "");
  const gate = rateLimit(`play:${member.id}:${action}`, action === "dice" ? 20 : 12, 60_000);
  if (!gate.allowed) {
    return NextResponse.json(
      { error: `Çok fazla deneme. ${gate.retryAfter} saniye sonra tekrar deneyin.` },
      { status: 429, headers: { "Retry-After": String(gate.retryAfter) } },
    );
  }

  try {
    if (action === "task") {
      return NextResponse.json(await claimTask(member.id, Number(body.taskId), String(body.code ?? "")));
    }
    if (action === "market") {
      return NextResponse.json(await buyReward(member.id, Number(body.rewardId)));
    }
    if (action === "ticket") {
      return NextResponse.json(await buyTicket(member.id, Number(body.eventId)));
    }
    if (action === "wheel") {
      return NextResponse.json(await spinWheel(member.id));
    }
    if (action === "chest") {
      const chest = String(body.chest ?? "");
      return NextResponse.json(await openChest(member.id, chest));
    }
    if (action === "dice") {
      const side = body.side === "under" ? "under" : body.side === "over" ? "over" : null;
      if (!side) return NextResponse.json({ error: "Üst veya alt seçin." }, { status: 400 });
      return NextResponse.json(await playDice(member.id, Number(body.stake), side));
    }
    if (action === "match") {
      const option = body.option === "a" || body.option === "b" || body.option === "c" ? body.option : null;
      if (!option) return NextResponse.json({ error: "Seçenek eksik." }, { status: 400 });
      return NextResponse.json(await pickMatch(member.id, Number(body.matchId), option));
    }
    return NextResponse.json({ error: "İşlem bulunamadı." }, { status: 404 });
  } catch (err) {
    return pointsFailure(err);
  }
}
