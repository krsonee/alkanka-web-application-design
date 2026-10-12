import { NextRequest, NextResponse } from "next/server";
import {
  attachVisitorCookie,
  isTrackTarget,
  recordAnalyticsEvent,
  visitorFromRequest,
} from "@/lib/analytics";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const kind = body.kind === "pageview" ? "pageview" : body.kind === "click" ? "click" : "";
  const target = String(body.target ?? "").trim();
  if (!kind || !isTrackTarget(target)) {
    return NextResponse.json({ error: "Geçersiz istek" }, { status: 400 });
  }

  const visitorId = visitorFromRequest(req);
  const targetId = Number(body.targetId);
  await recordAnalyticsEvent({
    kind,
    target,
    targetId: Number.isInteger(targetId) && targetId > 0 ? targetId : null,
    label: String(body.label ?? ""),
    visitorId,
  });

  const res = NextResponse.json({ ok: true });
  attachVisitorCookie(res, visitorId);
  return res;
}
