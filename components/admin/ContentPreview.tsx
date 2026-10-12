"use client";

import type { ReactNode } from "react";
import { BadgePercent, Eye, Gift, Megaphone, Send, ShieldCheck, Star, Ticket, UserPlus, type LucideIcon } from "lucide-react";
import type { DesignContent } from "@/lib/design-content";

export type PreviewSection = keyof DesignContent;

const TASK_ICONS: Record<string, LucideIcon> = {
  send: Send,
  eye: Eye,
  "user-plus": UserPlus,
  shield: ShieldCheck,
  gift: Gift,
  ticket: Ticket,
  megaphone: Megaphone,
  star: Star,
  percent: BadgePercent,
};

const PAGE: Partial<Record<PreviewSection, string>> = {
  slides: "/",
  tiles: "/",
  ticker: "/",
  sponsors: "/sponsorlar",
  bonuses: "/bonuslar",
  campaigns: "/kampanyalar",
  odds: "/ozel-oranlar",
  tasks: "/gorevler",
  market: "/market",
  events: "/biletler",
  predictions: "/tahminler",
  leaderboard: "/siralama",
  wins: "/siralama",
  faqs: "/sss",
  teams: "/tahminler",
};

export function previewHref(section: PreviewSection, item: Record<string, unknown>) {
  if (section === "heroes") return String(item.path || "/");
  return PAGE[section] || "/";
}

function text(item: Record<string, unknown>, key: string) {
  return String(item[key] ?? "").trim();
}

function num(item: Record<string, unknown>, key: string) {
  const value = Number(item[key]);
  return Number.isFinite(value) ? value : 0;
}

function lines(item: Record<string, unknown>, key: string) {
  const value = item[key];
  if (!Array.isArray(value)) return [];
  return value.map((line) => String(line).trim()).filter(Boolean);
}

function Art({ src, className }: { src: string; className?: string }) {
  if (!src) return <div className={className} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className={className} />
  );
}

function Frame({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`overflow-hidden rounded-xl border border-primary/25 bg-card text-foreground ${className}`}>{children}</div>;
}

export function ContentPreview({
  section,
  item,
  sponsors,
  compact = false,
}: {
  section: PreviewSection;
  item: Record<string, unknown>;
  sponsors: DesignContent["sponsors"];
  compact?: boolean;
}) {
  const sponsor = sponsors.find((entry) => entry.id === text(item, "sponsorId"));
  if (section === "slides") {
    return (
      <Frame className={compact ? "h-24" : ""}>
        <div className={`relative bg-background ${compact ? "h-24" : "aspect-[1584/672]"}`}>
          <Art src={text(item, "image")} className="absolute inset-0 size-full max-w-none object-cover object-center" />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/75 to-transparent" />
          <div className="relative flex h-full max-w-[70%] flex-col justify-end gap-1 p-3">
            <span className="w-fit rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold uppercase text-primary-foreground">{text(item, "eyebrow") || "Etiket"}</span>
            <p className={`font-display font-bold leading-tight ${compact ? "line-clamp-2 text-sm" : "text-xl"}`}>{text(item, "title") || "Başlık"}</p>
            {compact ? null : <p className="line-clamp-2 text-xs text-muted-foreground">{text(item, "description")}</p>}
            <span className="mt-1 w-fit rounded-md bg-primary px-2 py-1 text-[10px] font-bold uppercase text-primary-foreground">{text(item, "cta") || "İncele"}</span>
          </div>
        </div>
      </Frame>
    );
  }

  if (section === "tiles") {
    return (
      <Frame className="p-2">
        <div className={`relative overflow-hidden rounded-lg bg-background ${compact ? "h-16" : "aspect-[1312/816]"}`}>
          <Art src={text(item, "image")} className="absolute inset-0 size-full max-w-none object-cover" />
        </div>
        <p className="mt-2 text-center font-display text-sm font-bold">{text(item, "label") || "Kutu"}</p>
        {compact ? null : <p className="mt-1 rounded-md bg-primary py-1.5 text-center text-[10px] font-bold uppercase text-primary-foreground">{text(item, "cta") || "Aç"}</p>}
      </Frame>
    );
  }

  if (section === "ticker") {
    const kind = text(item, "kind");
    const tone = kind === "telegram" ? "text-accent" : kind === "drop" ? "text-live" : "text-primary";
    return (
      <Frame className="flex items-center gap-2 px-3 py-2">
        <span className={`text-[10px] font-bold uppercase ${tone}`}>{kind === "telegram" ? "Telegram" : kind === "drop" ? "Duyuru" : "Kazanç"}</span>
        <span className="min-w-0 flex-1 truncate text-sm">{text(item, "text") || "Metin"}</span>
        <span className="text-xs text-muted-foreground">{text(item, "time")}</span>
      </Frame>
    );
  }

  if (section === "sponsors" || section === "teams") {
    const logo = text(item, "logo");
    const name = text(item, section === "teams" ? "name" : "name") || "İsim";
    const tier = text(item, "tier");
    return (
      <Frame className="flex items-center gap-3 p-3">
        <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-primary/30 bg-background font-display text-sm font-bold text-primary">
          {logo ? <Art src={logo} className="size-full object-contain p-1" /> : text(item, "initials") || name.slice(0, 2).toUpperCase()}
        </span>
        <span className="min-w-0">
          <span className="block truncate font-semibold">{name}</span>
          {section === "sponsors" ? (
            <span className="block truncate text-xs text-primary">{text(item, "welcome") || text(item, "tagline")}</span>
          ) : (
            <span className="block text-xs text-muted-foreground">Takım logosu</span>
          )}
          {compact || section !== "sponsors" ? null : (
            <span className="mt-1 flex gap-2 text-[10px] uppercase text-muted-foreground">
              <span>{tier === "ana" ? "Ana sponsor" : tier === "vip" ? "VIP" : "Güvenilir"}</span>
              <span>{num(item, "rating").toFixed(1)}</span>
              <span>{text(item, "payout")}</span>
            </span>
          )}
        </span>
      </Frame>
    );
  }

  if (section === "bonuses") {
    return (
      <Frame className="flex">
        <div className="flex w-20 shrink-0 flex-col items-center justify-center gap-1 bg-primary/10 p-2 text-center">
          <span className="text-[10px] font-bold uppercase text-primary">{text(item, "type") || "Bonus"}</span>
        </div>
        <div className="min-w-0 flex-1 p-3">
          <p className="truncate text-[11px] text-muted-foreground">{sponsor?.name || "Sponsor seçilmedi"}</p>
          <p className="truncate font-display font-bold">{text(item, "title") || "Bonus"}</p>
          {compact ? null : (
            <p className="mt-1 text-xs text-muted-foreground">
              {text(item, "amount")} · {text(item, "wager")}
              {text(item, "code") ? ` · ${text(item, "code")}` : ""}
            </p>
          )}
        </div>
      </Frame>
    );
  }

  if (section === "campaigns" || section === "events" || section === "market") {
    const image = text(item, "image");
    const title = text(item, section === "market" ? "name" : "title") || "Başlık";
    return (
      <Frame>
        <div className={`relative bg-background ${compact ? "h-20" : "aspect-[1584/672]"}`}>
          <Art src={image} className="absolute inset-0 size-full max-w-none object-cover" />
          <span className="absolute top-2 left-2 rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold uppercase text-primary-foreground">
            {text(item, section === "market" ? "type" : section === "events" ? "kind" : "tag") || "Etiket"}
          </span>
        </div>
        <div className="p-3">
          <p className="truncate font-semibold">{title}</p>
          {compact ? null : (
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
              {section === "market"
                ? `${num(item, "price")} KC · stok ${num(item, "stock")}`
                : section === "events"
                  ? `${text(item, "subtitle")} · ${num(item, "entry") === 0 ? "Ücretsiz" : `${num(item, "entry")} KC`}`
                  : `${text(item, "ends")} · ${sponsor?.name || ""}`}
            </p>
          )}
        </div>
      </Frame>
    );
  }

  if (section === "odds") {
    return (
      <Frame className="p-3">
        <p className="text-[10px] font-bold uppercase text-primary">{text(item, "league") || "Lig"}</p>
        <p className="mt-1 font-display font-bold">{text(item, "match") || "Maç"}</p>
        <p className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <span>{text(item, "market")}</span>
          <span className="text-muted-foreground line-through">{num(item, "oldOdd").toFixed(2)}</span>
          <span className="rounded bg-primary px-2 py-0.5 font-display font-bold text-primary-foreground">{num(item, "newOdd").toFixed(2)}</span>
        </p>
        {compact ? null : <p className="mt-1 text-xs text-muted-foreground">{[text(item, "kickoff"), text(item, "limit"), sponsor?.name].filter(Boolean).join(" · ")}</p>}
      </Frame>
    );
  }

  if (section === "tasks") {
    const Icon = TASK_ICONS[text(item, "icon")] ?? Gift;
    return (
      <Frame className="flex items-center gap-3 p-3">
        <span className="flex size-9 items-center justify-center rounded-lg bg-background text-primary">
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{text(item, "title") || "Görev"}</span>
          <span className="block truncate text-xs text-muted-foreground">{text(item, "detail")}</span>
        </span>
        <span className="text-xs font-bold text-primary">+{num(item, "reward")}</span>
      </Frame>
    );
  }

  if (section === "predictions") {
    const options = Array.isArray(item.options) ? (item.options as { label?: string; votes?: number }[]) : [];
    return (
      <Frame className="p-3">
        <p className="text-[10px] font-bold uppercase text-primary">{text(item, "league") || "Lig"}</p>
        <p className="mt-1 font-display font-bold">
          {text(item, "home") || "Ev"} - {text(item, "away") || "Deplasman"}
        </p>
        <p className="mt-2 flex flex-wrap gap-1">
          {(options.length ? options : [{ label: "Ev" }, { label: "Beraberlik" }, { label: "Deplasman" }]).map((option, index) => (
            <span key={index} className="rounded border border-border px-2 py-1 text-[11px]">
              {option.label || "Seçenek"}
            </span>
          ))}
        </p>
        {compact ? null : <p className="mt-1 text-xs text-muted-foreground">{text(item, "kickoff")} · +{num(item, "reward")} KC</p>}
      </Frame>
    );
  }

  if (section === "leaderboard") {
    return (
      <Frame className="flex items-center gap-3 px-3 py-2">
        <span className="flex size-7 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">{num(item, "rank") || "•"}</span>
        <span className="min-w-0 flex-1 truncate font-semibold">{text(item, "name") || "Kullanıcı"}</span>
        <span className="text-xs text-muted-foreground">{num(item, "streak")} gün</span>
        <span className="font-display text-sm font-bold">{num(item, "points").toLocaleString("tr-TR")}</span>
      </Frame>
    );
  }

  if (section === "wins") {
    return (
      <Frame className="flex items-center gap-3 px-3 py-2 text-sm">
        <span className="rounded bg-background px-1.5 py-0.5 text-[11px] text-muted-foreground">{text(item, "game") || "Oyun"}</span>
        <span className="min-w-0 flex-1 truncate">{text(item, "user") || "Kullanıcı"}</span>
        <span className="text-xs text-muted-foreground">{text(item, "time")}</span>
        <span className="font-semibold text-live">{text(item, "reward")}</span>
      </Frame>
    );
  }

  if (section === "faqs") {
    return (
      <Frame className="p-3">
        <p className="text-[10px] font-bold uppercase text-primary">{text(item, "group") || "Genel"}</p>
        <p className="mt-1 font-semibold">{text(item, "question") || "Soru"}</p>
        {compact ? null : <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-muted-foreground">{text(item, "answer")}</p>}
      </Frame>
    );
  }

  const perks = lines(item, "perks");
  return (
    <Frame>
      <div className={`relative bg-background ${compact ? "h-24" : "aspect-[1584/672]"}`}>
        <Art src={text(item, "image")} className="absolute inset-0 size-full max-w-none object-cover object-right" />
        <div className="absolute inset-0 bg-gradient-to-r from-card via-card/40 to-transparent" />
        <div className="relative flex h-full max-w-[68%] flex-col justify-end gap-1 p-3">
          <p className="text-[10px] font-bold uppercase text-primary">{text(item, "eyebrow") || text(item, "path")}</p>
          <p className={`font-display font-bold ${compact ? "line-clamp-2 text-sm" : "text-xl"}`}>{text(item, "title") || "Sayfa"}</p>
          {compact ? null : <p className="line-clamp-2 text-xs text-muted-foreground">{text(item, "description")}</p>}
          {perks.length && !compact ? <p className="text-[11px] text-muted-foreground">{perks.slice(0, 2).join(" · ")}</p> : null}
        </div>
      </div>
    </Frame>
  );
}
