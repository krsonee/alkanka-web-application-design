"use client";

import { useCallback, useEffect, useState } from "react";
import { trackEvent } from "@/components/SiteAnalytics";

export type SitePopupItem = {
  id: number;
  title: string;
  body: string;
  imageUrl: string;
  buttons: { text: string; url: string }[];
  delaySeconds: number;
  oncePerVisitor: boolean;
};

const STORAGE_PREFIX = "alkanka-popup-";

function wasSeen(id: number) {
  try {
    return window.localStorage.getItem(`${STORAGE_PREFIX}${id}`) === "1";
  } catch {
    return false;
  }
}

function markSeen(id: number) {
  try {
    window.localStorage.setItem(`${STORAGE_PREFIX}${id}`, "1");
  } catch {
    /* private mode */
  }
}

export function SitePopups({ items }: { items: SitePopupItem[] }) {
  const [queue, setQueue] = useState<SitePopupItem[]>([]);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setQueue(items.filter((item) => !item.oncePerVisitor || !wasSeen(item.id)));
  }, [items]);

  const current = queue[0] ?? null;

  const dismiss = useCallback(() => {
    if (!current) return;
    if (current.oncePerVisitor) markSeen(current.id);
    setVisible(false);
    setQueue((prev) => prev.filter((item) => item.id !== current.id));
  }, [current]);

  useEffect(() => {
    if (!current) {
      setVisible(false);
      return;
    }
    setVisible(false);
    const wait = Math.max(0, current.delaySeconds) * 1000;
    const timer = window.setTimeout(() => setVisible(true), wait);
    return () => window.clearTimeout(timer);
  }, [current]);

  useEffect(() => {
    if (!visible) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss();
    };
    document.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [visible, dismiss]);

  if (!visible || !current) return null;

  const buttons = current.buttons.length
    ? current.buttons
    : [{ text: "Kapat", url: "" }];

  const hasCopy = Boolean(current.title || current.body);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-3 sm:p-6"
      style={{
        paddingTop: "max(0.75rem, env(safe-area-inset-top))",
        paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))",
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={current.title ? "site-popup-title" : undefined}
      onClick={dismiss}
    >
      <div
        className="relative flex w-[min(calc(100vw-1.5rem),26rem)] flex-col overflow-hidden rounded-2xl bg-[#0d1220] shadow-[0_20px_60px_rgba(0,0,0,0.55)] sm:w-[min(calc(100vw-3rem),32rem)]"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={dismiss}
          aria-label="Kapat"
          className="absolute right-2 top-2 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-lg text-white hover:bg-black/75"
        >
          ×
        </button>

        {hasCopy ? (
          <div className="px-4 pb-3 pt-5 pr-12">
            {current.title ? (
              <h2
                id="site-popup-title"
                className="text-center text-xl font-black uppercase tracking-wide gold-text sm:text-2xl"
              >
                {current.title}
              </h2>
            ) : null}
            {current.body ? (
              <p className="mt-2 whitespace-pre-line text-center text-sm leading-relaxed text-[#b8c0d4] sm:text-[15px]">
                {current.body}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="flex w-full flex-col">
          {current.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={current.imageUrl}
              alt=""
              className="block h-auto w-full"
            />
          ) : null}

          <div
            className={`flex w-full flex-col ${
              current.imageUrl ? "" : "min-w-0 p-4 pt-12"
            }`}
          >
            {buttons.map((button, index) => {
              const className =
                index === 0 && button.url
                  ? "inline-flex min-h-12 w-full items-center justify-center gold-gradient px-4 py-3 text-center text-sm font-extrabold uppercase tracking-wide text-black sm:min-h-14 sm:text-base"
                  : "inline-flex min-h-12 w-full items-center justify-center border-t border-[#d4af37]/50 bg-[#1a2338] px-4 py-3 text-center text-sm font-bold uppercase tracking-wide text-[#f2c94c] sm:min-h-14 sm:text-base";

              if (button.url) {
                return (
                  <a
                    key={`${button.text}-${index}`}
                    href={button.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={className}
                    onClick={() => {
                      trackEvent({
                        target: "popup",
                        targetId: current.id,
                        label: button.text || current.title || "Pop-up",
                      });
                      dismiss();
                    }}
                  >
                    {button.text}
                  </a>
                );
              }

              return (
                <button
                  key={`${button.text}-${index}`}
                  type="button"
                  className={className}
                  onClick={dismiss}
                >
                  {button.text}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
