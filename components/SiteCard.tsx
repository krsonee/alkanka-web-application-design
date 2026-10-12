"use client";

import { useState } from "react";
import type { PublicSite } from "@/lib/public-site";
import { ArrowUpRightIcon } from "@/components/icons";

export function SiteCard({
  site,
  big = false,
  elite = false,
  compact = false,
  eager = false,
}: {
  site: PublicSite;
  big?: boolean;
  // Güvenilir siteler bölümünün kartları. Affiliate adresi burada
  // gösterilmez, çünkü takip alan adları listeyi ucuz gösteriyor.
  elite?: boolean;
  compact?: boolean;
  eager?: boolean;
}) {
  const [logoFailed, setLogoFailed] = useState(false);

  // Gerçek hedef sunucuda tutulur; tarayıcı yalnızca kendi yönlendirme
  // ucumuzu görür, böylece affiliate bağlantıları kaynak kodundan okunamaz.
  const href = `/go/${site.id}`;
  const directHref = `/go/${site.id}?d=1`;

  return (
    <div
      className={
        elite
          ? "elite-card group relative flex flex-col overflow-hidden rounded-xl"
          : "card-surface group relative flex flex-col overflow-hidden rounded-xl"
      }
    >
      {elite && site.badge ? (
        <span className="absolute right-2 top-2 z-10 rounded-full gold-gradient px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-black">
          {site.badge}
        </span>
      ) : null}

      <a
        href={href}
        target="_blank"
        rel="nofollow noopener noreferrer"
        className={`flex items-center justify-center ${
          elite ? "elite-logo" : "bg-[#0d1220]"
        } ${big ? "h-32" : compact ? "h-16" : "h-24"}`}
      >
        {site.logoUrl && !logoFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={site.logoUrl}
            alt={site.name}
            loading={eager ? "eager" : "lazy"}
            onError={() => setLogoFailed(true)}
            className={`w-[78%] object-contain ${big ? "h-20" : compact ? "h-10" : "h-14"}`}
          />
        ) : (
          <span
            className={`gold-text px-2 text-center font-black leading-tight ${
              big ? "text-2xl" : "text-lg"
            }`}
          >
            {site.name}
          </span>
        )}
      </a>

      <div className={`flex flex-1 flex-col gap-1.5 ${elite ? "p-4" : compact ? "p-2.5" : "p-3"}`}>
        <div
          className={`text-center font-extrabold text-white ${
            elite ? "text-[15px] tracking-wide" : "text-sm"
          }`}
        >
          {site.name}
        </div>

        {elite ? <div className="elite-divider" /> : null}

        {site.bonusText ? (
          <p
            className={`gold-text text-center font-black leading-snug ${
              elite ? "text-[13px]" : "text-xs"
            }`}
          >
            {site.bonusText}
          </p>
        ) : null}

        <div className="mt-auto flex gap-1.5 pt-1">
          <a
            href={href}
            target="_blank"
            rel="nofollow noopener noreferrer"
            className={`btn btn-gold flex-1 ${elite ? "" : "btn-sm"}`}
          >
            Giriş Yap
          </a>
          {site.hasDirectEntry ? (
            <a
              href={directHref}
              target="_blank"
              rel="nofollow noopener noreferrer"
              title="Doğrudan giriş adresi"
              className="btn btn-line btn-sm px-2.5"
            >
              <ArrowUpRightIcon className="h-4 w-4" />
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}
