"use client";

import { useEffect, type AnchorHTMLAttributes, type MouseEvent } from "react";

export type TrackPayload = {
  kind?: "pageview" | "click";
  target: string;
  targetId?: number;
  label: string;
};

export function trackEvent(payload: TrackPayload) {
  const body = JSON.stringify({
    kind: payload.kind ?? "click",
    target: payload.target,
    targetId: payload.targetId,
    label: payload.label,
  });
  try {
    void fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
      credentials: "same-origin",
    });
  } catch {
    /* izleme sayfayı kesmesin */
  }
}

export function SiteAnalytics() {
  useEffect(() => {
    try {
      if (sessionStorage.getItem("alkanka-session-pv") === "1") return;
      sessionStorage.setItem("alkanka-session-pv", "1");
    } catch {
      /* gizli mod */
    }
    trackEvent({ kind: "pageview", target: "home", label: "Ana sayfa" });
  }, []);
  return null;
}

export function TrackedLink({
  track,
  onClick,
  ...rest
}: AnchorHTMLAttributes<HTMLAnchorElement> & { track: TrackPayload }) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    trackEvent(track);
    onClick?.(event);
  }

  return <a {...rest} onClick={handleClick} />;
}
