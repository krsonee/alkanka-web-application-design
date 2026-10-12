import { db } from "@/db";
import { analyticsEvents } from "@/db/schema";
import { NextRequest, NextResponse } from "next/server";

export const ANALYTICS_COOKIE = "alkanka_vid";

export const TRACK_TARGETS = [
  "home",
  "site",
  "site_direct",
  "telegram",
  "footer_telegram",
  "faq_telegram",
  "banner",
  "popup",
  "footer_email",
  "nav",
] as const;

export type TrackTarget = (typeof TRACK_TARGETS)[number];

export const TARGET_LABELS: Record<string, string> = {
  home: "Ana sayfa",
  site: "Site girişi",
  site_direct: "Doğrudan giriş",
  telegram: "Telegram (üst menü)",
  footer_telegram: "Telegram (alt)",
  faq_telegram: "Telegram (S.S.S.)",
  banner: "Alt banner",
  popup: "Pop-up",
  footer_email: "E-posta",
  nav: "Sayfa içi menü",
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isTrackTarget(value: string): value is TrackTarget {
  return TRACK_TARGETS.includes(value as TrackTarget);
}

export function displayTargetLabel(target: string, label?: string) {
  const trimmed = (label ?? "").trim();
  if (target === "site" || target === "site_direct" || target === "popup" || target === "nav") {
    return trimmed || TARGET_LABELS[target] || target;
  }
  return TARGET_LABELS[target] || trimmed || target;
}

export function visitorFromRequest(req: NextRequest) {
  const raw = req.cookies.get(ANALYTICS_COOKIE)?.value ?? "";
  if (UUID_RE.test(raw)) return raw;
  return crypto.randomUUID();
}

export function attachVisitorCookie(res: NextResponse, visitorId: string) {
  res.cookies.set(ANALYTICS_COOKIE, visitorId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    secure: process.env.NODE_ENV === "production",
  });
}

export async function recordAnalyticsEvent(input: {
  kind: "pageview" | "click";
  target: string;
  targetId?: number | null;
  label?: string;
  visitorId?: string;
}) {
  if (!isTrackTarget(input.target)) return;
  try {
    await db.insert(analyticsEvents).values({
      kind: input.kind,
      target: input.target,
      targetId: input.targetId ?? null,
      label: String(input.label ?? "").trim().slice(0, 80),
      visitorId: String(input.visitorId ?? "").slice(0, 36),
    });
  } catch (error) {
    console.error("analytics insert failed", error);
  }
}

export function istanbulDayStart(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return new Date(`${parts}T00:00:00+03:00`);
}
