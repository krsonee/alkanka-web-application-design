"use client";

import { useEffect, useMemo, useState } from "react";
import { ContentPreview, previewHref } from "@/components/admin/ContentPreview";
import {
  IMAGE_LIBRARY,
  TASK_ICON_OPTIONS,
  defaultDesignContent,
  type DesignContent,
} from "@/lib/design-content";

type Field =
  | { key: string; label: string; type: "text" | "textarea" | "number" | "lines" | "sponsor" }
  | { key: string; label: string; type: "image"; size: string }
  | { key: string; label: string; type: "select"; options: { value: string; label: string }[] }
  | { key: string; label: string; type: "check" }
  | { key: string; label: string; type: "prizes" | "options" };

type SectionKey = Exclude<keyof DesignContent, "heroes"> | "heroes";

type Section = {
  key: SectionKey;
  title: string;
  where: string;
  locked?: boolean;
  fields: Field[];
  blank: () => Record<string, unknown>;
  label: (item: Record<string, unknown>, index: number) => string;
};

const field =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary";

function nid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

const SECTIONS: Section[] = [
  {
    key: "slides",
    title: "Slider",
    where: "Ana sayfanın en üstündeki kayan banner. Sıra, soldan sağa döner.",
    fields: [
      { key: "eyebrow", label: "Üst etiket", type: "text" },
      { key: "title", label: "Başlık", type: "text" },
      { key: "description", label: "Açıklama", type: "textarea" },
      { key: "cta", label: "Buton yazısı", type: "text" },
      { key: "href", label: "Buton linki", type: "text" },
      { key: "image", label: "Görsel", type: "image", size: "1584×672 px" },
    ],
    blank: () => ({
      id: nid("slide"),
      eyebrow: "Yeni",
      title: "Yeni slayt",
      description: "",
      cta: "İncele",
      href: "/",
      image: "/images/banner-wheel.png",
    }),
    label: (item) => String(item.title || "Slayt"),
  },
  {
    key: "tiles",
    title: "Hızlı kutular",
    where: "Ana sayfada sliderın hemen altındaki 6 kutu.",
    fields: [
      { key: "label", label: "Ad", type: "text" },
      { key: "cta", label: "Alt yazı", type: "text" },
      { key: "href", label: "Link", type: "text" },
      { key: "image", label: "Görsel", type: "image", size: "1312×816 px" },
    ],
    blank: () => ({ id: nid("tile"), label: "Yeni kutu", cta: "Aç", href: "/", image: "/images/tile-wheel.png" }),
    label: (item) => String(item.label || "Kutu"),
  },
  {
    key: "ticker",
    title: "Kayan yazı",
    where: "Ana sayfa şeridi artık Duyurular menüsünden okunur. Bu liste sitede görünmez.",
    locked: true,
    fields: [
      {
        key: "kind",
        label: "Tür",
        type: "select",
        options: [
          { value: "telegram", label: "Telegram" },
          { value: "claim", label: "Kazanç" },
          { value: "drop", label: "Duyuru" },
        ],
      },
      { key: "text", label: "Metin", type: "text" },
      { key: "time", label: "Süre yazısı", type: "text" },
    ],
    blank: () => ({ id: nid("tick"), kind: "claim", text: "Yeni hareket", time: "az önce" }),
    label: (item) => String(item.text || "Satır"),
  },
  {
    key: "sponsors",
    title: "Sponsorlar",
    where: "Sponsorlar menüsünden düzenlenir: ana sponsor, VIP, öne çıkan, sıra, logo ve bonus. Bu liste sitede görünmez.",
    locked: true,
    fields: [
      { key: "name", label: "Site adı", type: "text" },
      { key: "initials", label: "Kısaltma", type: "text" },
      {
        key: "tier",
        label: "Katman",
        type: "select",
        options: [
          { value: "ana", label: "Ana sponsor" },
          { value: "vip", label: "VIP" },
          { value: "guvenilir", label: "Güvenilir" },
        ],
      },
      { key: "welcome", label: "Bonus satırı", type: "text" },
      { key: "tagline", label: "Kısa tanım", type: "text" },
      { key: "perks", label: "Ayrıcalıklar (her satır bir madde)", type: "lines" },
      { key: "rating", label: "Puan (5 üzerinden)", type: "number" },
      { key: "payout", label: "Çekim süresi", type: "text" },
      { key: "url", label: "Site linki", type: "text" },
      { key: "logo", label: "Logo", type: "image", size: "256×256 px · kare" },
    ],
    blank: () => ({
      id: nid("sponsor"),
      name: "Yeni sponsor",
      initials: "YS",
      tier: "guvenilir",
      welcome: "",
      tagline: "",
      perks: [],
      rating: 4.5,
      payout: "15 dk",
      url: "",
      logo: "",
    }),
    label: (item) => String(item.name || "Sponsor"),
  },
  {
    key: "bonuses",
    title: "Bonuslar",
    where: "Bonus metni Sponsorlar menüsündeki bonus alanından gelir. Bu liste sitede görünmez.",
    locked: true,
    fields: [
      { key: "sponsorId", label: "Sponsor", type: "sponsor" },
      {
        key: "type",
        label: "Tür",
        type: "select",
        options: ["Hoş geldin", "Yatırım", "Kayıp", "Freespin", "Deneme"].map((value) => ({ value, label: value })),
      },
      { key: "title", label: "Başlık", type: "text" },
      { key: "amount", label: "Tutar", type: "text" },
      { key: "wager", label: "Çevrim", type: "text" },
      { key: "code", label: "Kod (boş olabilir)", type: "text" },
    ],
    blank: () => ({ id: nid("bonus"), sponsorId: "", type: "Yatırım", title: "Yeni bonus", amount: "", wager: "", code: "" }),
    label: (item) => String(item.title || "Bonus"),
  },
  {
    key: "campaigns",
    title: "Kampanyalar",
    where: "Kampanyalar Puan menüsünün Kampanya bölümünden siteye bağlanır. Bu liste sitede görünmez.",
    locked: true,
    fields: [
      { key: "sponsorId", label: "Sponsor", type: "sponsor" },
      { key: "title", label: "Başlık", type: "text" },
      { key: "description", label: "Açıklama", type: "textarea" },
      { key: "tag", label: "Etiket", type: "text" },
      { key: "ends", label: "Bitiş yazısı", type: "text" },
      { key: "hoursLeft", label: "Kalan saat", type: "number" },
      { key: "image", label: "Görsel", type: "image", size: "1584×672 px" },
    ],
    blank: () => ({
      id: nid("campaign"),
      sponsorId: "",
      title: "Yeni kampanya",
      description: "",
      tag: "Genel",
      ends: "3 gün kaldı",
      hoursLeft: 72,
      image: "/images/banner-events.png",
    }),
    label: (item) => String(item.title || "Kampanya"),
  },
  {
    key: "odds",
    title: "Özel oranlar",
    where: "Özel oran kartları Puan menüsünün Oran bölümünden gelir. Canlı oran varsa o öne çıkar. Bu liste sitede görünmez.",
    locked: true,
    fields: [
      { key: "sponsorId", label: "Sponsor", type: "sponsor" },
      { key: "league", label: "Lig", type: "text" },
      { key: "match", label: "Maç", type: "text" },
      { key: "market", label: "Market", type: "text" },
      { key: "oldOdd", label: "Eski oran", type: "number" },
      { key: "newOdd", label: "Yeni oran", type: "number" },
      { key: "kickoff", label: "Başlama", type: "text" },
      { key: "limit", label: "Limit", type: "text" },
    ],
    blank: () => ({
      id: nid("odd"),
      sponsorId: "",
      league: "Süper Lig",
      match: "Ev sahibi - Deplasman",
      market: "Maç sonucu",
      oldOdd: 1.8,
      newOdd: 2.4,
      kickoff: "",
      limit: "",
    }),
    label: (item) => String(item.match || "Oran"),
  },
  {
    key: "tasks",
    title: "Görevler",
    where: "Görevler Puan menüsünün Görev bölümünden gelir. Bu liste sitede görünmez.",
    locked: true,
    fields: [
      { key: "title", label: "Başlık", type: "text" },
      { key: "detail", label: "Alt satır", type: "text" },
      { key: "icon", label: "İkon", type: "select", options: TASK_ICON_OPTIONS.map((item) => ({ ...item })) },
      { key: "reward", label: "Ödül (KC)", type: "number" },
      { key: "href", label: "Link", type: "text" },
      { key: "description", label: "Detay", type: "textarea" },
      { key: "steps", label: "Adımlar (her satır bir adım)", type: "lines" },
      { key: "rules", label: "Kurallar (her satır bir kural)", type: "lines" },
      { key: "verification", label: "Nasıl doğrulanır", type: "text" },
    ],
    blank: () => ({
      id: nid("task"),
      title: "Yeni görev",
      detail: "",
      icon: "gift",
      reward: 50,
      href: "",
      description: "",
      steps: [],
      rules: [],
      verification: "",
    }),
    label: (item) => String(item.title || "Görev"),
  },
  {
    key: "market",
    title: "Puan marketi",
    where: "/market. Stok 0 ise ürün tükendi görünür.",
    fields: [
      { key: "name", label: "Ürün", type: "text" },
      {
        key: "type",
        label: "Tür",
        type: "select",
        options: ["ROZET", "EKSTRA HAK", "HEDİYE", "VIP"].map((value) => ({ value, label: value })),
      },
      { key: "price", label: "Fiyat (KC)", type: "number" },
      { key: "stock", label: "Stok", type: "number" },
      { key: "total", label: "Toplam kontenjan", type: "number" },
      { key: "limit", label: "Hesap limiti", type: "number" },
      { key: "image", label: "Görsel", type: "image", size: "1584×672 px" },
      { key: "refOnly", label: "Sadece davetliler", type: "check" },
      { key: "description", label: "Açıklama", type: "textarea" },
      { key: "delivery", label: "Teslim", type: "text" },
      { key: "rules", label: "Kurallar", type: "lines" },
    ],
    blank: () => ({
      id: nid("market"),
      name: "Yeni ürün",
      type: "HEDİYE",
      price: 500,
      stock: 10,
      total: 10,
      limit: 1,
      image: "/images/tile-market.png",
      refOnly: false,
      description: "",
      delivery: "",
      rules: [],
    }),
    label: (item) => String(item.name || "Ürün"),
  },
  {
    key: "events",
    title: "Biletler",
    where: "Bilet çekilişleri Puan menüsünün Bilet bölümünden gelir. Bu liste sitede görünmez.",
    locked: true,
    fields: [
      {
        key: "kind",
        label: "Sıklık",
        type: "select",
        options: ["Haftalık", "Günlük", "Aylık"].map((value) => ({ value, label: value })),
      },
      { key: "title", label: "Başlık", type: "text" },
      { key: "subtitle", label: "Alt başlık", type: "text" },
      { key: "hoursLeft", label: "Kalan saat", type: "number" },
      { key: "participants", label: "Katılımcı", type: "number" },
      { key: "entry", label: "Katılım (KC)", type: "number" },
      { key: "prize", label: "Ödül özeti", type: "text" },
      { key: "image", label: "Görsel", type: "image", size: "1584×672 px" },
      { key: "description", label: "Açıklama", type: "textarea" },
      { key: "steps", label: "Adımlar", type: "lines" },
      { key: "rules", label: "Kurallar", type: "lines" },
      { key: "prizes", label: "Ödül tablosu (sıra | ödül)", type: "prizes" },
    ],
    blank: () => ({
      id: nid("event"),
      kind: "Haftalık",
      title: "Yeni çekiliş",
      subtitle: "",
      hoursLeft: 48,
      participants: 0,
      entry: 0,
      prize: "",
      image: "/images/banner-events.png",
      description: "",
      steps: [],
      rules: [],
      prizes: [],
    }),
    label: (item) => String(item.title || "Bilet"),
  },
  {
    key: "predictions",
    title: "Tahminler",
    where: "Tahmin maçları Topluluk menüsünden gelir. Bu liste sitede görünmez.",
    locked: true,
    fields: [
      { key: "league", label: "Lig", type: "text" },
      { key: "home", label: "Ev sahibi", type: "text" },
      { key: "away", label: "Deplasman", type: "text" },
      { key: "kickoff", label: "Başlama", type: "text" },
      { key: "reward", label: "Ödül (KC)", type: "number" },
      { key: "options", label: "Seçenekler", type: "options" },
    ],
    blank: () => ({
      id: nid("prediction"),
      league: "Süper Lig",
      home: "Ev sahibi",
      away: "Deplasman",
      kickoff: "",
      reward: 100,
      options: [
        { id: "1", label: "Ev", votes: 0 },
        { id: "x", label: "Beraberlik", votes: 0 },
        { id: "2", label: "Deplasman", votes: 0 },
      ],
    }),
    label: (item) => `${item.home ?? ""} - ${item.away ?? ""}`,
  },
  {
    key: "leaderboard",
    title: "Sıralama",
    where: "Sıralama Kanka Puan tablosundan gelir. Bu liste sitede görünmez.",
    locked: true,
    fields: [
      { key: "name", label: "Kullanıcı", type: "text" },
      { key: "points", label: "Kanka Coin", type: "number" },
      { key: "streak", label: "Seri (gün)", type: "number" },
    ],
    blank: () => ({ rank: 0, name: "yeni_kanka", points: 1000, streak: 1 }),
    label: (item, index) => `${index + 1}. ${item.name ?? ""}`,
  },
  {
    key: "wins",
    title: "Son kazananlar",
    where: "/siralama sayfasının sağ kolonu.",
    fields: [
      { key: "game", label: "Oyun", type: "text" },
      { key: "user", label: "Kullanıcı", type: "text" },
      { key: "time", label: "Saat", type: "text" },
      { key: "reward", label: "Ödül", type: "text" },
    ],
    blank: () => ({ id: nid("win"), game: "Çark", user: "kanka", time: "00:00", reward: "100 KC" }),
    label: (item) => `${item.user ?? ""} · ${item.reward ?? ""}`,
  },
  {
    key: "faqs",
    title: "SSS",
    where: "Sorular SSS menüsünden gelir. Bu liste sitede görünmez.",
    locked: true,
    fields: [
      { key: "group", label: "Grup", type: "text" },
      { key: "question", label: "Soru", type: "text" },
      { key: "answer", label: "Cevap", type: "textarea" },
    ],
    blank: () => ({ id: nid("faq"), group: "Genel", question: "Yeni soru", answer: "" }),
    label: (item) => String(item.question || "Soru"),
  },
  {
    key: "heroes",
    title: "Sayfa başlıkları",
    where: "Her sayfanın üstündeki görsel, kaş, başlık ve açıklama. Sayfa eklenmez; yazı ve görsel değişir.",
    locked: true,
    fields: [
      { key: "eyebrow", label: "Üst etiket", type: "text" },
      { key: "title", label: "Başlık", type: "text" },
      { key: "description", label: "Açıklama", type: "textarea" },
      { key: "image", label: "Görsel", type: "image", size: "1584×672 px" },
    ],
    blank: () => ({}),
    label: (item) => `${item.title ?? "Sayfa"} · ${item.path ?? ""}`,
  },
  {
    key: "teams",
    title: "Takım logoları",
    where: "Tahmin kartlarında takım adının yanındaki logo. Ad, maçtaki yazıyla aynı olmalı.",
    fields: [
      { key: "name", label: "Takım adı", type: "text" },
      { key: "logo", label: "Logo", type: "image", size: "128×128 px · kare" },
    ],
    blank: () => ({ name: "Takım", logo: "" }),
    label: (item) => String(item.name || "Takım"),
  },
];

function linesToText(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item)).join("\n") : "";
}

function prizesToText(value: unknown) {
  if (!Array.isArray(value)) return "";
  return value
    .map((item) => {
      const row = item as { place?: string; prize?: string };
      return `${row.place ?? ""} | ${row.prize ?? ""}`;
    })
    .join("\n");
}

function optionsToText(value: unknown) {
  if (!Array.isArray(value)) return "";
  return value
    .map((item) => {
      const row = item as { id?: string; label?: string; votes?: number };
      return `${row.id ?? ""} | ${row.label ?? ""} | ${row.votes ?? 0}`;
    })
    .join("\n");
}

function ImageField({
  value,
  size,
  onChange,
}: {
  value: string;
  size: string;
  onChange: (value: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function upload(file: File) {
    setBusy(true);
    setError("");
    const body = new FormData();
    body.set("file", file);
    body.set("name", "gorsel");
    const res = await fetch("/api/admin/upload-logo", { method: "POST", body });
    const data = (await res.json().catch(() => null)) as { url?: string; error?: string } | null;
    setBusy(false);
    if (!res.ok || !data?.url) {
      setError(data?.error || "Yüklenemedi");
      return;
    }
    onChange(data.url);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="h-14 w-24 rounded-lg border border-border bg-background object-contain" />
        ) : (
          <span className="flex h-14 w-24 items-center justify-center rounded-lg border border-dashed border-border text-[10px] text-muted-foreground">
            Görsel yok
          </span>
        )}
        <label className="cursor-pointer rounded-lg border border-primary/40 px-3 py-2 text-xs font-bold text-primary">
          {busy ? "Yükleniyor" : "Dosya yükle"}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="sr-only"
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void upload(file);
              event.target.value = "";
            }}
          />
        </label>
        <span className="text-xs font-bold text-primary">{size}</span>
      </div>
      <select className={field} value={IMAGE_LIBRARY.includes(value as (typeof IMAGE_LIBRARY)[number]) ? value : ""} onChange={(event) => onChange(event.target.value)}>
        <option value="">Hazır görseller</option>
        {IMAGE_LIBRARY.map((src) => (
          <option key={src} value={src}>
            {src.replace("/images/", "")}
          </option>
        ))}
      </select>
      <input className={field} value={value} placeholder="/images/... veya https://..." onChange={(event) => onChange(event.target.value)} />
      {error ? <p className="text-xs text-red-400">{error}</p> : null}
    </div>
  );
}

export function DesignContentPanel() {
  const [content, setContent] = useState<DesignContent | null>(null);
  const [sectionId, setSectionId] = useState<SectionKey>("slides");
  const [open, setOpen] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/content", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data && typeof data === "object" && Array.isArray(data.slides)) setContent(data as DesignContent);
        else if (!cancelled) setError("İçerik okunamadı.");
      })
      .catch(() => {
        if (!cancelled) setError("İçerik okunamadı.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const section = SECTIONS.find((item) => item.key === sectionId) ?? SECTIONS[0];
  const rows = useMemo(() => {
    if (!content) return [];
    return content[section.key] as unknown as Record<string, unknown>[];
  }, [content, section.key]);

  const visible = rows
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => {
      const q = query.trim().toLocaleLowerCase("tr");
      if (!q) return true;
      return JSON.stringify(item).toLocaleLowerCase("tr").includes(q);
    });

  function patch(index: number, next: Record<string, unknown>) {
    setContent((current) => {
      if (!current) return current;
      const list = [...(current[section.key] as unknown as Record<string, unknown>[])];
      list[index] = next;
      return { ...current, [section.key]: list };
    });
    setStatus("Değişti, henüz kaydedilmedi.");
  }

  function move(index: number, direction: -1 | 1) {
    setContent((current) => {
      if (!current) return current;
      const list = [...(current[section.key] as unknown as Record<string, unknown>[])];
      const target = index + direction;
      if (target < 0 || target >= list.length) return current;
      const [row] = list.splice(index, 1);
      list.splice(target, 0, row);
      return { ...current, [section.key]: list };
    });
    setOpen(index + direction);
    setStatus("Değişti, henüz kaydedilmedi.");
  }

  function remove(index: number) {
    setContent((current) => {
      if (!current) return current;
      const list = (current[section.key] as unknown as Record<string, unknown>[]).filter((_, itemIndex) => itemIndex !== index);
      return { ...current, [section.key]: list };
    });
    setOpen(null);
    setStatus("Değişti, henüz kaydedilmedi.");
  }

  function add() {
    setContent((current) => {
      if (!current) return current;
      const list = [...(current[section.key] as unknown as Record<string, unknown>[]), section.blank()];
      return { ...current, [section.key]: list };
    });
    setOpen(rows.length);
    setStatus("Değişti, henüz kaydedilmedi.");
  }

  function resetSection() {
    const fresh = defaultDesignContent();
    setContent((current) => (current ? { ...current, [section.key]: fresh[section.key] } : current));
    setOpen(null);
    setStatus("Bu bölüm taslağa döndü, henüz kaydedilmedi.");
  }

  async function save() {
    if (!content) return;
    setBusy(true);
    setError("");
    const res = await fetch("/api/admin/content", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(content),
    });
    const data = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) {
      setError(data?.error || "Kayıt tamamlanamadı.");
      return;
    }
    setContent(data as DesignContent);
    setStatus("Kaydedildi. Siteyi yenilediğinde görünür.");
  }

  if (!content) {
    return <p className="rounded-2xl border border-border bg-card px-4 py-8 text-sm text-muted-foreground">{error || "İçerik yükleniyor…"}</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-primary/30 bg-card p-4">
        <h2 className="font-display text-xl font-bold text-primary">Site içeriği</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          alkanka.com’da gördüğün slider, sponsor, bonus, kampanya, oran, görev, market, bilet, tahmin ve sayfa başlıkları buradan eklenir ve çıkarılır. Üyeler, puan, Telegram ve pop-up soldaki diğer sekmelerde durur.
        </p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {SECTIONS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => {
              setSectionId(item.key);
              setOpen(null);
              setQuery("");
            }}
            className={`shrink-0 rounded-lg border px-3 py-2 text-xs font-bold ${
              item.key === section.key ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground"
            }`}
          >
            {item.title}
            <span className="ml-1 tabular-nums opacity-70">{content[item.key].length}</span>
          </button>
        ))}
      </div>

      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-lg font-bold text-foreground">{section.title}</h3>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">{section.where}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {section.locked ? null : (
              <button type="button" onClick={add} className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground">
                Yeni ekle
              </button>
            )}
            <button type="button" onClick={resetSection} className="rounded-lg border border-border px-3 py-2 text-xs font-bold text-muted-foreground">
              Bölümü taslağa döndür
            </button>
            <button type="button" onClick={() => void save()} disabled={busy} className="rounded-lg bg-accent px-3 py-2 text-xs font-bold text-accent-foreground disabled:opacity-60">
              {busy ? "Kaydediliyor" : "Kaydet"}
            </button>
          </div>
        </div>
        {status ? <p className="mt-3 text-sm text-primary">{status}</p> : null}
        {error ? <p className="mt-2 text-sm text-red-400">{error}</p> : null}

        <input
          className={`${field} mt-4`}
          value={query}
          placeholder="Bu bölümde ara"
          onChange={(event) => setQuery(event.target.value)}
        />

        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Ön izleme</p>
            <a href={previewHref(section.key, rows[0] ?? {})} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-primary">
              Sitede aç
            </a>
          </div>
          {visible.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-3 py-6 text-sm text-muted-foreground">Bu bölüm boş. Ekleyince kart burada görünür.</p>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {visible.map(({ item, index }) => (
                <button
                  key={`preview-${section.key}-${index}`}
                  type="button"
                  onClick={() => setOpen(index)}
                  className={`w-64 shrink-0 text-left ${open === index ? "rounded-xl ring-2 ring-primary" : ""}`}
                >
                  <ContentPreview section={section.key} item={item} sponsors={content.sponsors} compact />
                </button>
              ))}
            </div>
          )}
        </div>

        <ul className="mt-4 flex flex-col gap-2">
          {visible.length === 0 ? <li className="text-sm text-muted-foreground">Bu bölüm boş. Yeni ekle ile bir kayıt aç.</li> : null}
          {visible.map(({ item, index }) => {
            const expanded = open === index;
            return (
              <li key={`${section.key}-${index}-${String(item.id ?? item.name ?? index)}`} className="rounded-xl border border-border bg-background">
                <div className="flex items-center gap-2 px-3 py-2">
                  <button type="button" onClick={() => setOpen(expanded ? null : index)} className="min-w-0 flex-1 truncate text-left text-sm font-semibold text-foreground">
                    {section.label(item, index)}
                  </button>
                  {section.locked ? null : (
                    <>
                  <button type="button" onClick={() => move(index, -1)} className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground" aria-label="Yukarı">
                    ↑
                  </button>
                  <button type="button" onClick={() => move(index, 1)} className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground" aria-label="Aşağı">
                    ↓
                  </button>
                    </>
                  )}
                  {section.locked ? null : (
                    <button type="button" onClick={() => remove(index)} className="rounded-md border border-red-500/40 px-2 py-1 text-xs text-red-300">
                      Sil
                    </button>
                  )}
                </div>
                {expanded ? (
                  <div className="grid gap-3 border-t border-border p-3 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Bu kaydın ön izlemesi</p>
                      <ContentPreview section={section.key} item={item} sponsors={content.sponsors} />
                    </div>
                    {section.fields.map((spec) => (
                      <label key={spec.key} className={spec.type === "textarea" || spec.type === "lines" || spec.type === "image" || spec.type === "prizes" || spec.type === "options" ? "sm:col-span-2" : ""}>
                        <span className="mb-1 flex flex-wrap items-baseline gap-2 text-xs font-semibold text-muted-foreground">
                          {spec.label}
                          {spec.type === "image" ? <span className="font-bold text-primary">{spec.size}</span> : null}
                        </span>
                        <FieldControl
                          spec={spec}
                          item={item}
                          sponsors={content.sponsors}
                          onChange={(next) => patch(index, next)}
                        />
                      </label>
                    ))}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

function FieldControl({
  spec,
  item,
  sponsors,
  onChange,
}: {
  spec: Field;
  item: Record<string, unknown>;
  sponsors: DesignContent["sponsors"];
  onChange: (next: Record<string, unknown>) => void;
}) {
  const value = item[spec.key];
  function set(next: unknown) {
    onChange({ ...item, [spec.key]: next });
  }

  if (spec.type === "textarea" || spec.type === "lines" || spec.type === "prizes" || spec.type === "options") {
    const text =
      spec.type === "lines" ? linesToText(value) : spec.type === "prizes" ? prizesToText(value) : spec.type === "options" ? optionsToText(value) : String(value ?? "");
    return (
      <textarea
        className={`${field} min-h-24`}
        value={text}
        onChange={(event) => {
          const raw = event.target.value;
          if (spec.type === "textarea") set(raw);
          else if (spec.type === "lines") set(raw.split("\n"));
          else if (spec.type === "prizes") {
            set(
              raw.split("\n").map((line) => {
                const [place, prize] = line.split("|").map((part) => part.trim());
                return { place: place || "", prize: prize || "" };
              }),
            );
          } else {
            set(
              raw.split("\n").map((line, index) => {
                const [id, label, votes] = line.split("|").map((part) => part.trim());
                return { id: id || String(index + 1), label: label || "", votes: Number(votes) || 0 };
              }),
            );
          }
        }}
      />
    );
  }

  if (spec.type === "image") return <ImageField value={String(value ?? "")} size={spec.size} onChange={set} />;

  if (spec.type === "select") {
    return (
      <select className={field} value={String(value ?? "")} onChange={(event) => set(event.target.value)}>
        {spec.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  if (spec.type === "sponsor") {
    return (
      <select className={field} value={String(value ?? "")} onChange={(event) => set(event.target.value)}>
        <option value="">Sponsor seç</option>
        {sponsors.map((sponsor) => (
          <option key={sponsor.id} value={sponsor.id}>
            {sponsor.name}
          </option>
        ))}
      </select>
    );
  }

  if (spec.type === "check") {
    return (
      <input
        type="checkbox"
        checked={Boolean(value)}
        onChange={(event) => set(event.target.checked)}
        className="size-4 accent-[var(--primary)]"
      />
    );
  }

  if (spec.type === "number") {
    return <input className={field} inputMode="decimal" value={String(value ?? "")} onChange={(event) => set(event.target.value)} />;
  }

  return <input className={field} value={String(value ?? "")} onChange={(event) => set(event.target.value)} />;
}
