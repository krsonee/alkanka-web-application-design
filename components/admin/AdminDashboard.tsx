"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { EmailTemplatesPanel } from "@/components/admin/EmailTemplatesPanel";
import { ArenaDesk } from "@/components/admin/ArenaDesk";
import { PushDesk } from "@/components/admin/PushDesk";
import { DesignContentPanel } from "@/components/admin/DesignContentPanel";
import { HomeVisualsPanel } from "@/components/admin/HomeVisualsPanel";
import { MembersPanel } from "@/components/admin/MembersPanel";
import { PointsDesk } from "@/components/admin/PointsDesk";
import { ShortLinksPanel } from "@/components/admin/ShortLinksPanel";
import { StatisticsPanel } from "@/components/admin/StatisticsPanel";

type Site = {
  id: number;
  name: string;
  logoUrl: string;
  bonusText: string;
  url: string;
  entryUrl: string;
  domain: string;
  badge: string;
  tagline: string;
  perks: string;
  rating: number;
  payout: string;
  bonusType: string;
  wagerText: string;
  bonusCode: string;
  featured: boolean;
  active: boolean;
  sortOrder: number;
  clicks: number;
};

type Announcement = {
  id: number;
  text: string;
  active: boolean;
  sortOrder: number;
};

type PopupButton = {
  text: string;
  url: string;
};

type Popup = {
  id: number;
  title: string;
  body: string;
  imageUrl: string;
  buttons: PopupButton[];
  delaySeconds: number;
  oncePerVisitor: boolean;
  active: boolean;
  sortOrder: number;
};

type Faq = {
  id: number;
  question: string;
  answer: string;
  category: string;
  slug: string;
  active: boolean;
  sortOrder: number;
};

type TelegramFooterButton = {
  text: string;
  url: string;
  style: "primary" | "success" | "danger";
};

type TelegramRule = {
  id: number;
  sourceChannel: string;
  targetChannel: string;
  footerText: string;
  footerButtons: TelegramFooterButton[];
  footerButtonLayout: "stack" | "row";
  active: boolean;
  sortOrder: number;
};

type TelegramLog = {
  id: number;
  ruleId: number | null;
  sourceChannel: string;
  targetChannel: string;
  status: "forwarded" | "skipped_media" | "error" | string;
  detail: string;
  preview: string;
  createdAt: string;
};

type TelegramStatus = {
  connected: boolean;
  accountLabel: string;
  hasApiCredentials: boolean;
  hasBotToken: boolean;
  botUsername: string;
  botAdmin: string;
};

type TelegramLoginPhase = "idle" | "awaiting_code" | "awaiting_password";

const emptyTelegramRule = {
  sourceChannel: "",
  targetChannel: "",
  footerText: "",
  footerButtons: [] as TelegramFooterButton[],
  footerButtonLayout: "stack" as "stack" | "row",
  active: true,
  sortOrder: 0,
};

const emptyTelegramLoginForm = { apiId: "", apiHash: "", phoneNumber: "+" };

const FAQ_CATEGORIES = ["Genel", "Bonuslar", "Ödeme", "Giriş ve Güvenlik"];

const emptyFaq = {
  question: "",
  answer: "",
  category: "Genel",
  slug: "",
  active: true,
  sortOrder: 0,
};

function SiteThumb({ logoUrl, name }: { logoUrl: string; name: string }) {
  const [failed, setFailed] = useState(false);

  if (!logoUrl || failed) {
    return <span className="text-xs font-bold gold-text">{name.slice(0, 8)}</span>;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={logoUrl}
      alt=""
      onError={() => setFailed(true)}
      className="max-h-9 max-w-16 object-contain"
    />
  );
}

const SPONSOR_BADGES = ["Ana Sponsor", "VIP Sponsor", "Sponsor"] as const;

const emptySite = {
  name: "",
  logoUrl: "",
  bonusText: "",
  url: "https://",
  entryUrl: "",
  domain: "",
  badge: "Sponsor",
  tagline: "",
  perks: "",
  rating: 0,
  payout: "",
  bonusType: "",
  wagerText: "",
  bonusCode: "",
  featured: false,
  active: true,
  sortOrder: 0,
  clicks: 0,
};

const emptyNews = { text: "", active: true, sortOrder: 0 };

const emptyPopup = {
  title: "",
  body: "",
  imageUrl: "",
  buttons: [{ text: "Kapat", url: "" }] as PopupButton[],
  delaySeconds: 0,
  oncePerVisitor: false,
  active: true,
  sortOrder: 0,
};

const inputCls =
  "w-full rounded-lg border border-[#d4af37]/25 bg-[#0d1220] px-3 py-2 text-sm text-white outline-none focus:border-[#d4af37]";

const ADMIN_TABS = [
  ["content", "Site içeriği"],
  ["arena", "Oyunlar"],
  ["app", "Uygulama"],
  ["stats", "İstatistikler"],
  ["members", "Puan"],
  ["players", "Üyeler"],
  ["links", "Kısa Link"],
  ["news", "Duyurular"],
  ["popups", "Pop-up"],
  ["email", "E-posta"],
  ["telegram", "Telegram"],
  ["seo", "SEO & Rehber"],
  ["studio", "Stüdyo"],
  ["community", "Topluluk"],
  ["badges", "Rozetler"],
  ["settings", "Ayarlar"],
  ["sites", "Eski site listesi"],
  ["faq", "Eski SSS"],
  ["home", "Eski ana sayfa"],
] as const;

type AdminTab = (typeof ADMIN_TABS)[number][0];

export function AdminDashboard({
  seo,
  mirror,
  studio,
  community,
  badges,
  embedded = false,
  bare = false,
  initialTab = "content",
}: {
  seo?: ReactNode;
  mirror?: ReactNode;
  studio?: ReactNode;
  community?: ReactNode;
  badges?: ReactNode;
  /** Yeni panelin içinde: boş kalan sekmeler zaten orada, tekrar gösterme. */
  embedded?: boolean;
  /** Kabuk yok: yalnız seçilen bölümün içeriği. */
  bare?: boolean;
  initialTab?: AdminTab;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<AdminTab>(initialTab);
  const [sites, setSites] = useState<Site[]>([]);
  const [news, setNews] = useState<Announcement[]>([]);
  const [popupRows, setPopupRows] = useState<Popup[]>([]);
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [form, setForm] = useState<typeof emptySite & { id?: number }>(emptySite);
  const [faqForm, setFaqForm] = useState<typeof emptyFaq & { id?: number }>(emptyFaq);
  const [newsForm, setNewsForm] = useState<typeof emptyNews & { id?: number }>(emptyNews);
  const [popupForm, setPopupForm] = useState<typeof emptyPopup & { id?: number }>(emptyPopup);
  const [search, setSearch] = useState("");
  const [section, setSection] = useState<"all" | "featured" | "rest">("all");
  const [visible, setVisible] = useState(40);
  const [msg, setMsg] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const [telegramStatus, setTelegramStatus] = useState<TelegramStatus>({
    connected: false,
    accountLabel: "",
    hasApiCredentials: false,
    hasBotToken: false,
    botUsername: "",
    botAdmin: "",
  });
  const [telegramRules, setTelegramRules] = useState<TelegramRule[]>([]);
  const [telegramLogs, setTelegramLogs] = useState<TelegramLog[]>([]);
  const [telegramRuleForm, setTelegramRuleForm] = useState<
    typeof emptyTelegramRule & { id?: number }
  >(emptyTelegramRule);
  const [telegramLoginForm, setTelegramLoginForm] = useState(emptyTelegramLoginForm);
  const [telegramLoginPhase, setTelegramLoginPhase] = useState<TelegramLoginPhase>("idle");
  const [telegramCode, setTelegramCode] = useState("");
  const [telegramPassword, setTelegramPassword] = useState("");
  const [telegramLoginError, setTelegramLoginError] = useState("");
  const [telegramLoginBusy, setTelegramLoginBusy] = useState(false);
  const [botTokenInput, setBotTokenInput] = useState("");
  const [botTokenBusy, setBotTokenBusy] = useState(false);
  const [botTokenError, setBotTokenError] = useState("");

  const load = useCallback(async () => {
    const [s, n, p, f, st] = await Promise.all([
      fetch("/api/admin/sites").then((r) => r.json()),
      fetch("/api/admin/announcements").then((r) => r.json()),
      fetch("/api/admin/popups").then((r) => r.json()),
      fetch("/api/admin/faqs").then((r) => r.json()),
      fetch("/api/admin/settings").then((r) => r.json()),
    ]);
    setSites(Array.isArray(s) ? s : []);
    setNews(Array.isArray(n) ? n : []);
    setPopupRows(
      Array.isArray(p)
        ? p.map((item: Popup) => ({
            ...item,
            buttons: Array.isArray(item.buttons) ? item.buttons : [],
          }))
        : [],
    );
    setFaqs(Array.isArray(f) ? f : []);
    setSettings(st && typeof st === "object" ? st : {});
  }, []);

  const loadTelegram = useCallback(async () => {
    const [status, rules, logs] = await Promise.all([
      fetch("/api/admin/telegram/status").then((r) => r.json()),
      fetch("/api/admin/telegram/rules").then((r) => r.json()),
      fetch("/api/admin/telegram/logs").then((r) => r.json()),
    ]);
    if (status && typeof status === "object") setTelegramStatus(status);
    setTelegramRules(
      Array.isArray(rules)
        ? rules.map((rule: TelegramRule) => ({
            ...rule,
            footerButtons: Array.isArray(rule.footerButtons) ? rule.footerButtons : [],
            footerButtonLayout: rule.footerButtonLayout === "row" ? "row" : "stack",
          }))
        : [],
    );
    setTelegramLogs(Array.isArray(logs) ? logs : []);
  }, []);

  useEffect(() => {
    // load() only sets state after its fetches resolve, so no cascading render here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    void loadTelegram();
  }, [load, loadTelegram]);

  // Telegram sekmesi açıkken bağlantı durumu ve son aktivite kendiliğinden
  // tazelenir; böylece giriş adımları ve yeni iletilen postlar anlık görünür.
  useEffect(() => {
    if (tab !== "telegram") return;
    const interval = setInterval(() => {
      void loadTelegram();
    }, 5000);
    return () => clearInterval(interval);
  }, [tab, loadTelegram]);

  function flash(text: string) {
    setMsg(text);
    setTimeout(() => setMsg(""), 2500);
  }

  // Yeni kayıt formu listenin sonuna denk gelen sırayla açılır; yönetici
  // isterse bu değeri değiştirebilir.
  const blankNews = () => ({ ...emptyNews, sortOrder: news.length + 1 });
  const blankPopup = () => ({ ...emptyPopup, sortOrder: popupRows.length + 1 });
  const blankFaq = () => ({ ...emptyFaq, sortOrder: faqs.length + 1 });
  const blankTelegramRule = () => ({
    ...emptyTelegramRule,
    sortOrder: telegramRules.length + 1,
  });

  async function uploadLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Aynı dosya tekrar seçilebilsin diye alan hemen sıfırlanır.
    e.target.value = "";
    if (!file) return;

    setUploading(true);
    setUploadError("");

    const body = new FormData();
    body.append("file", file);
    body.append("name", form.name);

    const res = await fetch("/api/admin/upload-logo", { method: "POST", body });
    const data = await res.json().catch(() => ({}));
    setUploading(false);

    if (!res.ok) {
      setUploadError(data.error ?? "Logo yüklenemedi");
      return;
    }

    setForm((prev) => ({ ...prev, logoUrl: data.url }));
    flash("Logo yüklendi");
  }

  async function saveSite(e: React.FormEvent) {
    e.preventDefault();
    const isEdit = Boolean(form.id);
    const res = await fetch(isEdit ? `/api/admin/sites/${form.id}` : "/api/admin/sites", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setForm(emptySite);
      flash(isEdit ? "Site güncellendi" : "Site eklendi");
      load();
    } else flash("İşlem başarısız");
  }

  async function toggleSite(site: Site, field: "active" | "featured") {
    await fetch(`/api/admin/sites/${site.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: !site[field] }),
    });
    load();
  }

  async function deleteSite(id: number) {
    if (!confirm("Bu site silinsin mi?")) return;
    await fetch(`/api/admin/sites/${id}`, { method: "DELETE" });
    if (form.id === id) setForm(emptySite);
    flash("Site silindi");
    load();
  }

  async function saveNews(e: React.FormEvent) {
    e.preventDefault();
    if (!newsForm.text.trim()) {
      flash("Duyuru metni zorunlu");
      return;
    }
    const isEdit = Boolean(newsForm.id);
    const res = await fetch(
      isEdit
        ? `/api/admin/announcements/${newsForm.id}`
        : "/api/admin/announcements",
      {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newsForm),
      },
    );
    if (res.ok) {
      setNewsForm(blankNews());
      flash(isEdit ? "Duyuru güncellendi" : "Duyuru eklendi");
      load();
    } else flash("İşlem başarısız");
  }

  async function toggleNews(item: Announcement) {
    await fetch(`/api/admin/announcements/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !item.active }),
    });
    load();
  }

  async function deleteNews(id: number) {
    if (!confirm("Bu duyuru silinsin mi?")) return;
    await fetch(`/api/admin/announcements/${id}`, { method: "DELETE" });
    if (newsForm.id === id) setNewsForm(blankNews());
    flash("Duyuru silindi");
    load();
  }

  async function uploadPopupImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setUploading(true);
    setUploadError("");
    const body = new FormData();
    body.append("file", file);
    body.append("name", popupForm.title || "popup");
    const res = await fetch("/api/admin/upload-logo", { method: "POST", body });
    const data = await res.json().catch(() => ({}));
    setUploading(false);
    if (!res.ok) {
      setUploadError(data.error ?? "Görsel yüklenemedi");
      return;
    }
    setPopupForm((prev) => ({ ...prev, imageUrl: data.url }));
    flash("Görsel yüklendi");
  }

  async function savePopup(e: React.FormEvent) {
    e.preventDefault();
    if (!popupForm.title.trim() && !popupForm.body.trim() && !popupForm.imageUrl.trim()) {
      flash("Başlık, metin veya görsel zorunlu");
      return;
    }
    const isEdit = Boolean(popupForm.id);
    const res = await fetch(
      isEdit ? `/api/admin/popups/${popupForm.id}` : "/api/admin/popups",
      {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(popupForm),
      },
    );
    if (res.ok) {
      setPopupForm(blankPopup());
      flash(isEdit ? "Pop-up güncellendi" : "Pop-up eklendi");
      load();
    } else {
      const data = await res.json().catch(() => ({}));
      flash(data.error ?? "İşlem başarısız");
    }
  }

  async function togglePopup(item: Popup) {
    await fetch(`/api/admin/popups/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !item.active }),
    });
    load();
  }

  async function deletePopup(id: number) {
    if (!confirm("Bu pop-up silinsin mi?")) return;
    await fetch(`/api/admin/popups/${id}`, { method: "DELETE" });
    if (popupForm.id === id) setPopupForm(blankPopup());
    flash("Pop-up silindi");
    load();
  }

  async function saveFaq(e: React.FormEvent) {
    e.preventDefault();
    if (!faqForm.question.trim() || !faqForm.answer.trim()) {
      flash("Soru ve cevap zorunlu");
      return;
    }
    const isEdit = Boolean(faqForm.id);
    const res = await fetch(
      isEdit ? `/api/admin/faqs/${faqForm.id}` : "/api/admin/faqs",
      {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(faqForm),
      },
    );
    if (res.ok) {
      setFaqForm(blankFaq());
      flash(isEdit ? "Soru güncellendi" : "Soru eklendi");
      load();
    } else flash("İşlem başarısız");
  }

  async function toggleFaq(item: Faq) {
    await fetch(`/api/admin/faqs/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !item.active }),
    });
    load();
  }

  async function deleteFaq(id: number) {
    if (!confirm("Bu soru silinsin mi?")) return;
    await fetch(`/api/admin/faqs/${id}`, { method: "DELETE" });
    if (faqForm.id === id) setFaqForm(blankFaq());
    flash("Soru silindi");
    load();
  }

  async function telegramLoginStart(e: React.FormEvent) {
    e.preventDefault();
    setTelegramLoginBusy(true);
    setTelegramLoginError("");
    const res = await fetch("/api/admin/telegram/login/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiId: Number(telegramLoginForm.apiId),
        apiHash: telegramLoginForm.apiHash.trim(),
        phoneNumber: telegramLoginForm.phoneNumber.trim(),
      }),
    });
    const data = await res.json().catch(() => ({}));
    setTelegramLoginBusy(false);
    if (!res.ok) {
      setTelegramLoginError(data.error ?? "Giriş başlatılamadı");
      return;
    }
    setTelegramLoginPhase("awaiting_code");
  }

  async function telegramLoginSubmitCode(e: React.FormEvent) {
    e.preventDefault();
    setTelegramLoginBusy(true);
    setTelegramLoginError("");
    const res = await fetch("/api/admin/telegram/login/code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: telegramCode.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    setTelegramLoginBusy(false);
    if (!res.ok) {
      setTelegramLoginError(data.error ?? "Kod doğrulanamadı");
      return;
    }
    if (data.needsPassword) {
      setTelegramLoginPhase("awaiting_password");
      return;
    }
    telegramLoginFinished(data.accountLabel);
  }

  async function telegramLoginSubmitPassword(e: React.FormEvent) {
    e.preventDefault();
    setTelegramLoginBusy(true);
    setTelegramLoginError("");
    const res = await fetch("/api/admin/telegram/login/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: telegramPassword }),
    });
    const data = await res.json().catch(() => ({}));
    setTelegramLoginBusy(false);
    if (!res.ok) {
      setTelegramLoginError(data.error ?? "Şifre doğrulanamadı");
      return;
    }
    telegramLoginFinished(data.accountLabel);
  }

  function telegramLoginFinished(accountLabel: string) {
    setTelegramLoginPhase("idle");
    setTelegramLoginForm(emptyTelegramLoginForm);
    setTelegramCode("");
    setTelegramPassword("");
    setTelegramStatus((prev) => ({
      ...prev,
      connected: true,
      accountLabel,
      hasApiCredentials: true,
    }));
    flash("Telegram hesabı bağlandı");
  }

  async function telegramDisconnect() {
    if (!confirm("Hesap bağlantısı kaldırılsın mı? Aktarma durur, bot tokeni kalır.")) return;
    await fetch("/api/admin/telegram/status", { method: "DELETE" });
    setTelegramStatus((prev) => ({
      ...prev,
      connected: false,
      accountLabel: "",
      hasApiCredentials: false,
    }));
    flash("Telegram bağlantısı kaldırıldı");
  }

  async function saveBotToken(e: React.FormEvent) {
    e.preventDefault();
    setBotTokenBusy(true);
    setBotTokenError("");
    const res = await fetch("/api/admin/telegram/bot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: botTokenInput.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    setBotTokenBusy(false);
    if (!res.ok) {
      setBotTokenError(data.error ?? "Token kaydedilemedi");
      return;
    }
    setBotTokenInput("");
    setTelegramStatus((prev) => ({
      ...prev,
      hasBotToken: true,
      botUsername: data.botUsername ?? "",
      botAdmin: data.botAdmin ?? prev.botAdmin,
    }));
    flash("Bot bağlandı");
  }

  async function removeBotToken() {
    if (!confirm("Bot tokeni kaldırılsın mı? Bot içinden yönetim durur.")) return;
    await fetch("/api/admin/telegram/bot", { method: "DELETE" });
    setTelegramStatus((prev) => ({
      ...prev,
      hasBotToken: false,
      botUsername: "",
    }));
    flash("Bot tokeni kaldırıldı");
  }

  async function saveTelegramRule(e: React.FormEvent) {
    e.preventDefault();
    if (!telegramRuleForm.sourceChannel.trim() || !telegramRuleForm.targetChannel.trim()) {
      flash("Kaynak ve hedef kanal zorunlu");
      return;
    }
    const isEdit = Boolean(telegramRuleForm.id);
    const res = await fetch(
      isEdit
        ? `/api/admin/telegram/rules/${telegramRuleForm.id}`
        : "/api/admin/telegram/rules",
      {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(telegramRuleForm),
      },
    );
    if (res.ok) {
      setTelegramRuleForm(blankTelegramRule());
      flash(isEdit ? "Eşleştirme güncellendi" : "Eşleştirme eklendi");
      loadTelegram();
    } else flash("İşlem başarısız");
  }

  async function toggleTelegramRule(rule: TelegramRule) {
    await fetch(`/api/admin/telegram/rules/${rule.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !rule.active }),
    });
    loadTelegram();
  }

  async function deleteTelegramRule(id: number) {
    if (!confirm("Bu eşleştirme silinsin mi?")) return;
    await fetch(`/api/admin/telegram/rules/${id}`, { method: "DELETE" });
    if (telegramRuleForm.id === id) setTelegramRuleForm(blankTelegramRule());
    flash("Eşleştirme silindi");
    loadTelegram();
  }

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    flash("Ayarlar kaydedildi");
  }

  async function logout() {
    await fetch("/api/admin/login", { method: "DELETE" });
    router.refresh();
  }

  const totalClicks = sites.reduce((a, s) => a + s.clicks, 0);
  const term = search.trim().toLowerCase();

  const inSection = sites.filter((s) =>
    section === "featured" ? s.featured : section === "rest" ? !s.featured : true,
  );
  const filtered = term
    ? inSection.filter(
        (s) =>
          s.name.toLowerCase().includes(term) ||
          s.bonusText.toLowerCase().includes(term),
      )
    : inSection;

  // Sıra numaralarını komşuyla takas eder; böylece yönetici sayı yazmadan
  // bölüm içindeki dizilişi değiştirebilir.
  async function move(site: Site, direction: -1 | 1) {
    const index = inSection.findIndex((s) => s.id === site.id);
    const neighbour = inSection[index + direction];
    if (!neighbour) return;

    const patch = (id: number, sortOrder: number) =>
      fetch(`/api/admin/sites/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sortOrder }),
      });

    // Aynı sıra numarasını paylaşıyorlarsa takas bir şey değiştirmez.
    const [a, b] =
      site.sortOrder === neighbour.sortOrder
        ? [site.sortOrder - direction, neighbour.sortOrder + direction]
        : [neighbour.sortOrder, site.sortOrder];

    await Promise.all([patch(site.id, a), patch(neighbour.id, b)]);
    load();
  }

  return (
    <div className={bare ? "min-w-0 text-foreground" : "min-h-screen bg-background pb-20 text-foreground"}>
      {bare ? null : (
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-[120rem] items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/logos/fist.png" alt="" className="h-10 w-auto" />
            <span className="text-sm font-black tracking-widest text-primary sm:text-base">
              AL KANKA PANEL
            </span>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/"
              target="_blank"
              className="rounded-lg border border-primary/40 px-3 py-2 text-xs font-bold text-primary"
            >
              Siteyi Gör
            </a>
            <button
              onClick={logout}
              className="rounded-lg bg-[#1a2338] px-3 py-2 text-xs font-bold text-white"
            >
              Çıkış
            </button>
          </div>
        </div>
      </header>
      )}

      <div className={bare ? "" : "mx-auto max-w-[120rem] px-4 py-6"}>
        {bare ? null : (
        <div className="grid grid-cols-3 gap-3">
          {[
            ["Toplam Site", sites.length],
            ["Aktif Site", sites.filter((s) => s.active).length],
            ["Toplam Tıklama", totalClicks],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-2xl border border-border bg-card p-4 text-center">
              <div className="text-2xl font-black text-primary">{value}</div>
              <div className="text-[10px] uppercase tracking-wider text-[#7e879c]">{label}</div>
            </div>
          ))}
        </div>
        )}

        <div className={bare ? "" : "mt-6 flex flex-col gap-6 lg:flex-row lg:items-start"}>
          {bare ? null : (
          <nav className="lg:sticky lg:top-20 lg:w-56 lg:shrink-0">
            <div className="flex flex-col gap-2">
              {ADMIN_TABS.filter(([key]) => {
                if (!embedded) return true;
                if (key === "seo" && !seo) return false;
                if (key === "studio" && !studio) return false;
                if (key === "community" && !community) return false;
                if (key === "badges" && !badges) return false;
                return true;
              }).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => {
                    setTab(key);
                    if (key === "telegram") void loadTelegram();
                  }}
                  className={`rounded-xl px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wide sm:text-sm ${
                    tab === key
                      ? "bg-primary text-primary-foreground"
                      : "border border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
              {embedded ? null : (
              <a
                href="/panel"
                className="rounded-xl border border-border bg-card px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-muted-foreground hover:border-primary/50 hover:text-foreground sm:text-sm"
              >
                Tasarım paneli
              </a>
              )}
            </div>
          </nav>
          )}

          <div className="min-w-0 flex-1">
        {msg ? (
          <div className="mt-4 rounded-xl border border-[#d4af37]/40 bg-[#121827] px-4 py-2 text-sm text-[#f2c94c]">
            {msg}
          </div>
        ) : null}

        {tab === "stats" && <StatisticsPanel />}

        {tab === "content" && <DesignContentPanel />}

        {tab === "arena" && <ArenaDesk />}

        {tab === "app" && <PushDesk />}

        {tab === "home" && (
          <div className="flex flex-col gap-4">
            <p className="rounded-xl border border-primary/30 bg-card px-4 py-3 text-sm text-muted-foreground">
              Bu ekran eski ana sayfa slaytlarını tutar. Sitede görünen slider, kutular ve kampanyalar Site içeriği sekmesindedir.
            </p>
            <HomeVisualsPanel />
          </div>
        )}

        {tab === "members" && <PointsDesk />}

        {tab === "players" && <MembersPanel />}

        {tab === "links" && <ShortLinksPanel />}

        {tab === "sites" && (
          <div className="mt-6 grid gap-6 lg:grid-cols-[380px_1fr]">
            <p className="rounded-xl border border-primary/30 bg-card px-4 py-3 text-sm text-muted-foreground lg:col-span-2">
              Ana sayfadaki öne çıkan sponsorlar, sponsor listesi ve site sayfaları buradan gelir.
              Ana sponsor rozeti büyük kartı seçer. Öne çıkan kutusu ve VIP rozeti yan kartları doldurur.
              Sıra küçükten büyüğe okunur. Logo yükle butonu logoyu kaydeder. Bonus metni ana sayfada görünür.
            </p>
            <form onSubmit={saveSite} className="card-surface h-fit rounded-2xl p-5">
              <h3 className="mb-4 text-sm font-black uppercase tracking-wide gold-text">
                {form.id ? "Sponsoru düzenle" : "Yeni sponsor"}
              </h3>
              <div className="space-y-3">
                <input
                  className={inputCls}
                  placeholder="Site adı"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
                <div className="space-y-2 rounded-lg border border-[#d4af37]/25 bg-[#0d1220] p-3">
                  <div className="flex items-center gap-3">
                    {form.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={form.logoUrl}
                        alt="Logo önizleme"
                        className="h-12 w-12 shrink-0 rounded-md bg-[#07090f] object-contain p-1"
                      />
                    ) : (
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-[#07090f] text-[9px] text-[#7e879c]">
                        Logo
                      </span>
                    )}
                    <label
                      className={`flex-1 cursor-pointer rounded-lg border border-[#d4af37]/40 px-3 py-2 text-center text-[11px] font-bold uppercase tracking-wide text-[#f2c94c] ${
                        uploading ? "opacity-50" : "hover:bg-[#1a2338]"
                      }`}
                    >
                      {uploading ? "Yükleniyor..." : "Logo yükle"}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        className="hidden"
                        disabled={uploading}
                        onChange={uploadLogo}
                      />
                    </label>
                    <span className="shrink-0 text-[11px] font-bold text-[#f2c94c]">256×256 px · kare</span>
                  </div>
                  <input
                    className={inputCls}
                    placeholder="Logo URL (opsiyonel)"
                    value={form.logoUrl}
                    onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
                  />
                  {uploadError ? (
                    <p className="text-[11px] font-semibold text-red-300">
                      {uploadError}
                    </p>
                  ) : (
                    <p className="text-[10px] text-[#7e879c]">
                      PNG, JPG, WEBP veya GIF · en fazla 8 MB. Dosya kalıcı diske yazılır.
                    </p>
                  )}
                </div>
                <textarea
                  className={inputCls}
                  rows={3}
                  placeholder="Bonus metni (ana sayfada görünür)"
                  value={form.bonusText}
                  onChange={(e) => setForm({ ...form, bonusText: e.target.value })}
                />
                <input
                  className={inputCls}
                  placeholder="Kısa tanım"
                  value={form.tagline}
                  onChange={(e) => setForm({ ...form, tagline: e.target.value })}
                />
                <textarea
                  className={inputCls}
                  rows={3}
                  placeholder="Özellikler, her satır bir madde"
                  value={form.perks}
                  onChange={(e) => setForm({ ...form, perks: e.target.value })}
                />
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-[11px] text-[#7e879c]">
                    Puan (0-5)
                    <input
                      className={`${inputCls} mt-1`}
                      type="number"
                      min={0}
                      max={5}
                      step={0.1}
                      value={form.rating}
                      onChange={(e) => setForm({ ...form, rating: Number(e.target.value) })}
                    />
                  </label>
                  <label className="text-[11px] text-[#7e879c]">
                    Çekim süresi
                    <input
                      className={`${inputCls} mt-1`}
                      placeholder="5 dk"
                      value={form.payout}
                      onChange={(e) => setForm({ ...form, payout: e.target.value })}
                    />
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <select
                    className={inputCls}
                    value={form.bonusType}
                    onChange={(e) => setForm({ ...form, bonusType: e.target.value })}
                  >
                    <option value="">Bonus türü</option>
                    {["Hoş geldin", "Yatırım", "Kayıp", "Freespin", "Deneme", "Bonus"].map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                  <input
                    className={inputCls}
                    placeholder="Çevrim şartı"
                    value={form.wagerText}
                    onChange={(e) => setForm({ ...form, wagerText: e.target.value })}
                  />
                </div>
                <input
                  className={inputCls}
                  placeholder="Bonus kodu (boş olabilir)"
                  value={form.bonusCode}
                  onChange={(e) => setForm({ ...form, bonusCode: e.target.value })}
                />
                <input
                  className={inputCls}
                  placeholder="Affiliate / yönlendirme linki"
                  value={form.url}
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                />
                <input
                  className={inputCls}
                  placeholder="Doğrudan giriş adresi (entry URL)"
                  value={form.entryUrl}
                  onChange={(e) => setForm({ ...form, entryUrl: e.target.value })}
                />
                <input
                  className={inputCls}
                  placeholder="Görünen alan adı (örn. betlesene.me)"
                  value={form.domain}
                  onChange={(e) => setForm({ ...form, domain: e.target.value })}
                />
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-[11px] text-[#7e879c]">
                    Ana sponsor / VIP
                    <select
                      className={`${inputCls} mt-1`}
                      value={form.badge}
                      onChange={(e) => setForm({ ...form, badge: e.target.value })}
                    >
                      {form.badge && !SPONSOR_BADGES.includes(form.badge as (typeof SPONSOR_BADGES)[number]) ? (
                        <option value={form.badge}>{form.badge}</option>
                      ) : null}
                      <option value="Ana Sponsor">Ana sponsor</option>
                      <option value="VIP Sponsor">VIP</option>
                      <option value="Sponsor">Güvenilir</option>
                    </select>
                  </label>
                  <label className="text-[11px] text-[#7e879c]">
                    Sıra
                    <input
                      className={`${inputCls} mt-1`}
                      type="number"
                      placeholder="Sıra"
                      value={form.sortOrder}
                      onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })}
                    />
                  </label>
                </div>
                <label className="block text-xs text-[#7e879c]">
                  Tıklama sayısı
                  <input
                    className={`${inputCls} mt-1`}
                    type="number"
                    min={0}
                    value={form.clicks}
                    onChange={(e) =>
                      setForm({ ...form, clicks: Number(e.target.value) })
                    }
                  />
                </label>
                <div className="flex gap-4 text-xs text-[#b8c0d4]">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.featured}
                      onChange={(e) => setForm({ ...form, featured: e.target.checked })}
                    />
                    Öne çıkanlarda göster
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.active}
                      onChange={(e) => setForm({ ...form, active: e.target.checked })}
                    />
                    Aktif
                  </label>
                </div>
                <div className="flex gap-2">
                  <button className="flex-1 rounded-xl gold-gradient py-2.5 text-sm font-extrabold uppercase text-black">
                    {form.id ? "Güncelle" : "Ekle"}
                  </button>
                  {form.id ? (
                    <button
                      type="button"
                      onClick={() => setForm(emptySite)}
                      className="rounded-xl border border-[#d4af37]/40 px-4 text-xs font-bold text-[#f2c94c]"
                    >
                      İptal
                    </button>
                  ) : null}
                </div>
              </div>
            </form>

            <div className="space-y-3">
              <div className="card-surface space-y-3 rounded-2xl p-3">
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ["all", "Tümü", sites.length],
                      [
                        "featured",
                        "Güvenilir Siteler",
                        sites.filter((s) => s.featured).length,
                      ],
                      [
                        "rest",
                        "Tüm Siteler Listesi",
                        sites.filter((s) => !s.featured).length,
                      ],
                    ] as const
                  ).map(([key, label, count]) => (
                    <button
                      key={key}
                      onClick={() => {
                        setSection(key);
                        setVisible(40);
                      }}
                      className={`rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide ${
                        section === key
                          ? "gold-gradient text-black"
                          : "border border-[#d4af37]/30 bg-[#0d1220] text-[#b8c0d4]"
                      }`}
                    >
                      {label} ({count})
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    className={inputCls}
                    placeholder="Site ara..."
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setVisible(40);
                    }}
                  />
                  <span className="whitespace-nowrap text-xs text-[#7e879c]">
                    {filtered.length} sonuç
                  </span>
                </div>
                {term ? (
                  <p className="text-[11px] text-[#7e879c]">
                    Arama açıkken sıralama düğmeleri gizlenir; diziliş
                    değiştirmek için aramayı temizleyin.
                  </p>
                ) : null}
              </div>
              {filtered.slice(0, visible).map((site) => (
                <div
                  key={site.id}
                  className="card-surface flex flex-wrap items-center gap-3 rounded-2xl p-4"
                >
                  <div className="flex h-12 w-20 shrink-0 items-center justify-center rounded-lg bg-[#0d1220]">
                    <SiteThumb logoUrl={site.logoUrl} name={site.name} />
                  </div>
                  <div className="min-w-40 flex-1">
                    <div className="text-sm font-bold text-white">
                      {site.name}{" "}
                      {site.featured ? (
                        <span className="ml-1 rounded bg-[#d4af37]/20 px-1.5 py-0.5 text-[10px] text-[#f2c94c]">
                          VIP
                        </span>
                      ) : null}
                    </div>
                    <div className="line-clamp-1 text-xs text-[#7e879c]">{site.bonusText}</div>
                    <div className="text-[10px] text-[#7e879c]">
                      Sıra: {site.sortOrder} · Tıklama: {site.clicks}
                      {site.domain ? ` · ${site.domain}` : ""}
                    </div>
                    {site.url && site.url !== "#" ? (
                      <a
                        href={site.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block truncate text-[10px] text-[#f2c94c] hover:underline"
                      >
                        {site.url}
                      </a>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {!term ? (
                      <div className="flex gap-1">
                        <button
                          onClick={() => move(site, -1)}
                          title="Yukarı taşı"
                          className="rounded-lg bg-[#1a2338] px-2.5 py-1.5 text-[11px] font-bold text-[#f2c94c]"
                        >
                          ↑
                        </button>
                        <button
                          onClick={() => move(site, 1)}
                          title="Aşağı taşı"
                          className="rounded-lg bg-[#1a2338] px-2.5 py-1.5 text-[11px] font-bold text-[#f2c94c]"
                        >
                          ↓
                        </button>
                      </div>
                    ) : null}
                    <button
                      onClick={() => toggleSite(site, "featured")}
                      className="rounded-lg border border-[#d4af37]/40 px-3 py-1.5 text-[11px] font-bold text-[#f2c94c]"
                    >
                      {site.featured ? "Öne çıkandan çıkar" : "Öne çıkar"}
                    </button>
                    <button
                      onClick={() => toggleSite(site, "active")}
                      className={`rounded-lg px-3 py-1.5 text-[11px] font-bold ${
                        site.active ? "bg-[#1a2338] text-white" : "bg-red-500/20 text-red-300"
                      }`}
                    >
                      {site.active ? "Aktif" : "Pasif"}
                    </button>
                    <button
                      onClick={() =>
                        setForm({
                          id: site.id,
                          name: site.name,
                          logoUrl: site.logoUrl,
                          bonusText: site.bonusText,
                          url: site.url,
                          entryUrl: site.entryUrl,
                          domain: site.domain,
                          badge: site.badge,
                          tagline: site.tagline ?? "",
                          perks: site.perks ?? "",
                          rating: Number(site.rating) || 0,
                          payout: site.payout ?? "",
                          bonusType: site.bonusType ?? "",
                          wagerText: site.wagerText ?? "",
                          bonusCode: site.bonusCode ?? "",
                          featured: site.featured,
                          active: site.active,
                          sortOrder: site.sortOrder,
                          clicks: site.clicks,
                        })
                      }
                      className="rounded-lg bg-[#1a2338] px-3 py-1.5 text-[11px] font-bold text-[#f2c94c]"
                    >
                      Düzenle
                    </button>
                    <button
                      onClick={() => deleteSite(site.id)}
                      className="rounded-lg bg-red-500/20 px-3 py-1.5 text-[11px] font-bold text-red-300"
                    >
                      Sil
                    </button>
                  </div>
                </div>
              ))}
              {filtered.length > visible ? (
                <button
                  onClick={() => setVisible((v) => v + 40)}
                  className="w-full rounded-xl border border-[#d4af37]/40 py-3 text-sm font-bold text-[#f2c94c]"
                >
                  Daha Fazla Göster ({filtered.length - visible})
                </button>
              ) : null}
            </div>
          </div>
        )}

        {tab === "news" && (
          <div className="mt-6 space-y-4">
            <form onSubmit={saveNews} className="card-surface rounded-2xl p-4">
              <h3 className="mb-3 text-sm font-black uppercase tracking-wide gold-text">
                {newsForm.id ? "Duyuruyu Düzenle" : "Yeni Duyuru Ekle"}
              </h3>
              <textarea
                className={inputCls}
                rows={2}
                placeholder="Kayan yazı duyurusu..."
                value={newsForm.text}
                onChange={(e) =>
                  setNewsForm({ ...newsForm, text: e.target.value })
                }
              />
              <div className="mt-3 flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-xs text-[#b8c0d4]">
                  Sıra
                  <input
                    className="w-24 rounded-lg border border-[#d4af37]/25 bg-[#0d1220] px-3 py-2 text-sm text-white outline-none focus:border-[#d4af37]"
                    type="number"
                    value={newsForm.sortOrder}
                    onChange={(e) =>
                      setNewsForm({
                        ...newsForm,
                        sortOrder: Number(e.target.value),
                      })
                    }
                  />
                </label>
                <label className="flex items-center gap-2 text-xs text-[#b8c0d4]">
                  <input
                    type="checkbox"
                    checked={newsForm.active}
                    onChange={(e) =>
                      setNewsForm({ ...newsForm, active: e.target.checked })
                    }
                  />
                  Sitede yayında
                </label>
                <div className="ml-auto flex gap-2">
                  {newsForm.id ? (
                    <button
                      type="button"
                      onClick={() => setNewsForm(blankNews())}
                      className="rounded-xl border border-[#d4af37]/40 px-4 py-2 text-xs font-bold text-[#f2c94c]"
                    >
                      İptal
                    </button>
                  ) : null}
                  <button className="rounded-xl gold-gradient px-6 py-2 text-sm font-extrabold uppercase text-black">
                    {newsForm.id ? "Güncelle" : "Ekle"}
                  </button>
                </div>
              </div>
            </form>

            {news.map((item) => (
              <div
                key={item.id}
                className="card-surface flex flex-wrap items-center gap-3 rounded-2xl p-4"
              >
                <div className="min-w-40 flex-1">
                  <p className="text-sm text-[#b8c0d4]">{item.text}</p>
                  <div className="mt-1 text-[10px] text-[#7e879c]">
                    Sıra: {item.sortOrder}
                  </div>
                </div>
                <button
                  onClick={() => toggleNews(item)}
                  className={`rounded-lg px-3 py-1.5 text-[11px] font-bold ${
                    item.active ? "bg-[#1a2338] text-white" : "bg-red-500/20 text-red-300"
                  }`}
                >
                  {item.active ? "Aktif" : "Pasif"}
                </button>
                <button
                  onClick={() =>
                    setNewsForm({
                      id: item.id,
                      text: item.text,
                      active: item.active,
                      sortOrder: item.sortOrder,
                    })
                  }
                  className="rounded-lg bg-[#1a2338] px-3 py-1.5 text-[11px] font-bold text-[#f2c94c]"
                >
                  Düzenle
                </button>
                <button
                  onClick={() => deleteNews(item.id)}
                  className="rounded-lg bg-red-500/20 px-3 py-1.5 text-[11px] font-bold text-red-300"
                >
                  Sil
                </button>
              </div>
            ))}
          </div>
        )}

        {tab === "popups" && (
          <div className="mt-6 space-y-4">
            <form onSubmit={savePopup} className="card-surface rounded-2xl p-4">
              <h3 className="mb-1 text-sm font-black uppercase tracking-wide gold-text">
                {popupForm.id ? "Pop-up Düzenle" : "Yeni Pop-up Ekle"}
              </h3>
              <p className="mb-4 text-[11px] leading-relaxed text-[#7e879c]">
                Aktif pop-up’lar ana sayfada sırayla, ekranın tam ortasında açılır.
                Mobil ve masaüstünde aynı kart kullanılır. Linki boş bırakılan
                buton yalnızca kapatır; dolu olanlar yeni sekmede açılır.
              </p>
              <div className="space-y-3">
                <input
                  className={inputCls}
                  placeholder="Başlık"
                  value={popupForm.title}
                  onChange={(e) =>
                    setPopupForm({ ...popupForm, title: e.target.value })
                  }
                />
                <textarea
                  className={inputCls}
                  rows={4}
                  placeholder="Pop-up metni"
                  value={popupForm.body}
                  onChange={(e) =>
                    setPopupForm({ ...popupForm, body: e.target.value })
                  }
                />
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    className={`${inputCls} flex-1`}
                    placeholder="Görsel URL (isteğe bağlı)"
                    value={popupForm.imageUrl}
                    onChange={(e) =>
                      setPopupForm({ ...popupForm, imageUrl: e.target.value })
                    }
                  />
                  <label className="cursor-pointer rounded-xl border border-[#d4af37]/40 px-4 py-2 text-xs font-bold text-[#f2c94c]">
                    {uploading ? "Yükleniyor..." : "Görsel yükle"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={uploadPopupImage}
                    />
                  </label>
                  <span className="text-[11px] font-bold text-[#f2c94c]">1024×640 px</span>
                </div>
                {uploadError ? (
                  <p className="text-[11px] font-semibold text-red-300">{uploadError}</p>
                ) : null}

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wide text-[#b8c0d4]">
                      Butonlar
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setPopupForm({
                          ...popupForm,
                          buttons: [
                            ...popupForm.buttons,
                            { text: "", url: "" },
                          ].slice(0, 4),
                        })
                      }
                      className="rounded-lg border border-[#d4af37]/40 px-3 py-1 text-[11px] font-bold text-[#f2c94c]"
                    >
                      Buton ekle
                    </button>
                  </div>
                  <div className="space-y-2">
                    {popupForm.buttons.map((button, index) => (
                      <div
                        key={index}
                        className="grid gap-2 sm:grid-cols-[1fr_1.4fr_auto]"
                      >
                        <input
                          className={inputCls}
                          placeholder="Buton yazısı"
                          value={button.text}
                          onChange={(e) => {
                            const buttons = [...popupForm.buttons];
                            buttons[index] = { ...button, text: e.target.value };
                            setPopupForm({ ...popupForm, buttons });
                          }}
                        />
                        <input
                          className={inputCls}
                          placeholder="Link (boş = kapat)"
                          value={button.url}
                          onChange={(e) => {
                            const buttons = [...popupForm.buttons];
                            buttons[index] = { ...button, url: e.target.value };
                            setPopupForm({ ...popupForm, buttons });
                          }}
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setPopupForm({
                              ...popupForm,
                              buttons: popupForm.buttons.filter((_, i) => i !== index),
                            })
                          }
                          className="rounded-lg bg-red-500/20 px-3 py-2 text-[11px] font-bold text-red-300"
                        >
                          Sil
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 text-xs text-[#b8c0d4]">
                    Sıra
                    <input
                      className="w-20 rounded-lg border border-[#d4af37]/25 bg-[#0d1220] px-3 py-2 text-sm text-white outline-none focus:border-[#d4af37]"
                      type="number"
                      value={popupForm.sortOrder}
                      onChange={(e) =>
                        setPopupForm({
                          ...popupForm,
                          sortOrder: Number(e.target.value),
                        })
                      }
                    />
                  </label>
                  <label className="flex items-center gap-2 text-xs text-[#b8c0d4]">
                    Gecikme (sn)
                    <input
                      className="w-20 rounded-lg border border-[#d4af37]/25 bg-[#0d1220] px-3 py-2 text-sm text-white outline-none focus:border-[#d4af37]"
                      type="number"
                      min={0}
                      max={120}
                      value={popupForm.delaySeconds}
                      onChange={(e) =>
                        setPopupForm({
                          ...popupForm,
                          delaySeconds: Number(e.target.value),
                        })
                      }
                    />
                  </label>
                  <label className="flex items-center gap-2 text-xs text-[#b8c0d4]">
                    <input
                      type="checkbox"
                      checked={popupForm.active}
                      onChange={(e) =>
                        setPopupForm({ ...popupForm, active: e.target.checked })
                      }
                    />
                    Sitede yayında
                  </label>
                  <label className="flex items-center gap-2 text-xs text-[#b8c0d4]">
                    <input
                      type="checkbox"
                      checked={popupForm.oncePerVisitor}
                      onChange={(e) =>
                        setPopupForm({
                          ...popupForm,
                          oncePerVisitor: e.target.checked,
                        })
                      }
                    />
                    Ziyaretçiye bir kez göster
                  </label>
                  <div className="ml-auto flex gap-2">
                    {popupForm.id ? (
                      <button
                        type="button"
                        onClick={() => setPopupForm(blankPopup())}
                        className="rounded-xl border border-[#d4af37]/40 px-4 py-2 text-xs font-bold text-[#f2c94c]"
                      >
                        İptal
                      </button>
                    ) : null}
                    <button className="rounded-xl gold-gradient px-6 py-2 text-sm font-extrabold uppercase text-black">
                      {popupForm.id ? "Güncelle" : "Ekle"}
                    </button>
                  </div>
                </div>
              </div>
            </form>

            {popupRows.map((item) => (
              <div
                key={item.id}
                className="card-surface flex flex-wrap items-center gap-3 rounded-2xl p-4"
              >
                <div className="min-w-40 flex-1">
                  <p className="text-sm font-bold text-white">
                    {item.title || "Başlıksız pop-up"}
                  </p>
                  {item.body ? (
                    <p className="mt-1 line-clamp-2 text-xs text-[#b8c0d4]">
                      {item.body}
                    </p>
                  ) : null}
                  <div className="mt-1 text-[10px] text-[#7e879c]">
                    Sıra: {item.sortOrder} · Gecikme: {item.delaySeconds}sn ·{" "}
                    {item.buttons.length} buton
                    {item.oncePerVisitor ? " · bir kez" : ""}
                  </div>
                </div>
                <button
                  onClick={() => togglePopup(item)}
                  className={`rounded-lg px-3 py-1.5 text-[11px] font-bold ${
                    item.active ? "bg-[#1a2338] text-white" : "bg-red-500/20 text-red-300"
                  }`}
                >
                  {item.active ? "Aktif" : "Pasif"}
                </button>
                <button
                  onClick={() =>
                    setPopupForm({
                      id: item.id,
                      title: item.title,
                      body: item.body,
                      imageUrl: item.imageUrl,
                      buttons: item.buttons.length
                        ? item.buttons
                        : [{ text: "Kapat", url: "" }],
                      delaySeconds: item.delaySeconds,
                      oncePerVisitor: item.oncePerVisitor,
                      active: item.active,
                      sortOrder: item.sortOrder,
                    })
                  }
                  className="rounded-lg bg-[#1a2338] px-3 py-1.5 text-[11px] font-bold text-[#f2c94c]"
                >
                  Düzenle
                </button>
                <button
                  onClick={() => deletePopup(item.id)}
                  className="rounded-lg bg-red-500/20 px-3 py-1.5 text-[11px] font-bold text-red-300"
                >
                  Sil
                </button>
              </div>
            ))}
          </div>
        )}

        {tab === "email" && <EmailTemplatesPanel />}

        {tab === "faq" && (
          <p className="mb-4 rounded-xl border border-primary/30 bg-card px-4 py-3 text-sm text-muted-foreground">
            Sitedeki SSS kutuları Site içeriği → SSS bölümünden gelir. Buradaki kayıtlar eski listeyi tutar.
          </p>
        )}
        {tab === "faq" && (
          <div className="mt-6 grid gap-6 lg:grid-cols-[380px_1fr]">
            <form onSubmit={saveFaq} className="card-surface h-fit rounded-2xl p-5">
              <h3 className="mb-1 text-sm font-black uppercase tracking-wide gold-text">
                {faqForm.id ? "Soruyu Düzenle" : "Yeni Soru Ekle"}
              </h3>
              <p className="mb-4 text-[11px] leading-relaxed text-[#7e879c]">
                Sorular ana sayfadaki S.S.S. bölümünde ve arama motorlarına
                gönderilen yapısal veride kullanılır. Cevapları en az iki cümle
                yazın; kısa cevaplar arama sonuçlarında zayıf kalır.
              </p>
              <div className="space-y-3">
                <input
                  className={inputCls}
                  placeholder="Soru (örn. Çevrim şartı ne demek?)"
                  value={faqForm.question}
                  onChange={(e) =>
                    setFaqForm({ ...faqForm, question: e.target.value })
                  }
                />
                <textarea
                  className={inputCls}
                  rows={6}
                  placeholder="Cevap"
                  value={faqForm.answer}
                  onChange={(e) =>
                    setFaqForm({ ...faqForm, answer: e.target.value })
                  }
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    className={inputCls}
                    list="faq-kategorileri"
                    placeholder="Kategori"
                    value={faqForm.category}
                    onChange={(e) =>
                      setFaqForm({ ...faqForm, category: e.target.value })
                    }
                  />
                  <datalist id="faq-kategorileri">
                    {FAQ_CATEGORIES.map((category) => (
                      <option key={category} value={category} />
                    ))}
                  </datalist>
                  <input
                    className={inputCls}
                    type="number"
                    placeholder="Sıra"
                    value={faqForm.sortOrder}
                    onChange={(e) =>
                      setFaqForm({ ...faqForm, sortOrder: Number(e.target.value) })
                    }
                  />
                </div>
                <label className="block text-xs text-[#7e879c]">
                  Bağlantı adı (boş bırakılırsa sorudan üretilir)
                  <input
                    className={`${inputCls} mt-1`}
                    placeholder="cevrim-sarti-nedir"
                    value={faqForm.slug}
                    onChange={(e) =>
                      setFaqForm({ ...faqForm, slug: e.target.value })
                    }
                  />
                </label>
                <label className="flex items-center gap-2 text-xs text-[#b8c0d4]">
                  <input
                    type="checkbox"
                    checked={faqForm.active}
                    onChange={(e) =>
                      setFaqForm({ ...faqForm, active: e.target.checked })
                    }
                  />
                  Sitede yayında
                </label>
                <div className="flex gap-2">
                  <button className="flex-1 rounded-xl gold-gradient py-2.5 text-sm font-extrabold uppercase text-black">
                    {faqForm.id ? "Güncelle" : "Ekle"}
                  </button>
                  {faqForm.id ? (
                    <button
                      type="button"
                      onClick={() => setFaqForm(blankFaq())}
                      className="rounded-xl border border-[#d4af37]/40 px-4 text-xs font-bold text-[#f2c94c]"
                    >
                      İptal
                    </button>
                  ) : null}
                </div>
              </div>
            </form>

            <div className="space-y-3">
              <div className="card-surface rounded-2xl p-3 text-xs text-[#7e879c]">
                {faqs.filter((f) => f.active).length} soru yayında,{" "}
                {faqs.length} soru kayıtlı.
              </div>
              {faqs.map((item) => (
                <div key={item.id} className="card-surface rounded-2xl p-4">
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="min-w-40 flex-1">
                      <div className="text-sm font-bold text-white">
                        {item.question}
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[#7e879c]">
                        {item.answer}
                      </p>
                      <div className="mt-1.5 text-[10px] text-[#7e879c]">
                        {item.category} · Sıra: {item.sortOrder}
                        {item.slug ? ` · #${item.slug}` : ""}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => toggleFaq(item)}
                        className={`rounded-lg px-3 py-1.5 text-[11px] font-bold ${
                          item.active
                            ? "bg-[#1a2338] text-white"
                            : "bg-red-500/20 text-red-300"
                        }`}
                      >
                        {item.active ? "Yayında" : "Gizli"}
                      </button>
                      <button
                        onClick={() =>
                          setFaqForm({
                            id: item.id,
                            question: item.question,
                            answer: item.answer,
                            category: item.category,
                            slug: item.slug,
                            active: item.active,
                            sortOrder: item.sortOrder,
                          })
                        }
                        className="rounded-lg bg-[#1a2338] px-3 py-1.5 text-[11px] font-bold text-[#f2c94c]"
                      >
                        Düzenle
                      </button>
                      <button
                        onClick={() => deleteFaq(item.id)}
                        className="rounded-lg bg-red-500/20 px-3 py-1.5 text-[11px] font-bold text-red-300"
                      >
                        Sil
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "seo" && <div className="mt-6">{seo}</div>}

        {tab === "studio" && <div className="mt-6">{studio}</div>}

        {tab === "community" && <div className="mt-6">{community}</div>}

        {tab === "badges" && <div className="mt-6">{badges}</div>}

        {tab === "telegram" && (
          <div className="mt-6 space-y-6">
            <div className="card-surface rounded-2xl p-5">
              <h3 className="mb-1 text-sm font-black uppercase tracking-wide gold-text">
                Bot, kanal ve canlı sohbet
              </h3>
              <p className="text-[11px] leading-relaxed text-[#7e879c]">
                Telegram hesapları sonra eklenecek. Bot token, hedef kanal, kaynak
                filtreleri, cron adresi ve sohbet grubu alanları hazır. Boş
                bırakılabilir.
              </p>
            </div>
            {mirror}
            <div className="card-surface rounded-2xl p-5">
              <h3 className="mb-1 text-sm font-black uppercase tracking-wide gold-text">
                Telegram Hesap Bağlantısı
              </h3>
              <p className="mb-4 text-[11px] leading-relaxed text-[#7e879c]">
                Kaynak kanaldaki postları hedef kanala alıntı izi bırakmadan
                iletebilmek için buradan kendi Telegram hesabınızla giriş
                yapın. API ID ve API Hash bilgisini{" "}
                <a
                  href="https://my.telegram.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#f2c94c] hover:underline"
                >
                  my.telegram.org
                </a>{" "}
                üzerinden alabilirsiniz. Bu giriş yalnızca bir kez yapılır.
              </p>

              {telegramStatus.connected ? (
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-300">
                    Bağlı
                  </span>
                  <span className="text-sm text-white">
                    {telegramStatus.accountLabel || "Telegram hesabı"}
                  </span>
                  <button
                    onClick={telegramDisconnect}
                    className="ml-auto rounded-lg bg-red-500/20 px-3 py-1.5 text-[11px] font-bold text-red-300"
                  >
                    Bağlantıyı Kaldır
                  </button>
                </div>
              ) : telegramLoginPhase === "idle" ? (
                <form onSubmit={telegramLoginStart} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      className={inputCls}
                      placeholder="API ID"
                      inputMode="numeric"
                      value={telegramLoginForm.apiId}
                      onChange={(e) =>
                        setTelegramLoginForm({ ...telegramLoginForm, apiId: e.target.value })
                      }
                    />
                    <input
                      className={inputCls}
                      placeholder="API Hash"
                      value={telegramLoginForm.apiHash}
                      onChange={(e) =>
                        setTelegramLoginForm({ ...telegramLoginForm, apiHash: e.target.value })
                      }
                    />
                  </div>
                  <input
                    className={inputCls}
                    placeholder="Telefon numarası (+905551112233)"
                    value={telegramLoginForm.phoneNumber}
                    onChange={(e) =>
                      setTelegramLoginForm({
                        ...telegramLoginForm,
                        phoneNumber: e.target.value,
                      })
                    }
                  />
                  {telegramLoginError ? (
                    <p className="text-[11px] font-semibold text-red-300">
                      {telegramLoginError}
                    </p>
                  ) : null}
                  <button
                    disabled={telegramLoginBusy}
                    className="rounded-xl gold-gradient px-6 py-2.5 text-sm font-extrabold uppercase text-black disabled:opacity-50"
                  >
                    {telegramLoginBusy ? "Gönderiliyor..." : "Kod Gönder"}
                  </button>
                </form>
              ) : telegramLoginPhase === "awaiting_code" ? (
                <form onSubmit={telegramLoginSubmitCode} className="space-y-3">
                  <p className="text-xs text-[#b8c0d4]">
                    Telegram hesabınıza gönderilen kodu girin.
                  </p>
                  <input
                    className={inputCls}
                    placeholder="Doğrulama kodu"
                    inputMode="numeric"
                    value={telegramCode}
                    onChange={(e) => setTelegramCode(e.target.value)}
                  />
                  {telegramLoginError ? (
                    <p className="text-[11px] font-semibold text-red-300">
                      {telegramLoginError}
                    </p>
                  ) : null}
                  <div className="flex gap-2">
                    <button
                      disabled={telegramLoginBusy}
                      className="rounded-xl gold-gradient px-6 py-2.5 text-sm font-extrabold uppercase text-black disabled:opacity-50"
                    >
                      {telegramLoginBusy ? "Doğrulanıyor..." : "Doğrula"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTelegramLoginPhase("idle");
                        setTelegramLoginError("");
                      }}
                      className="rounded-xl border border-[#d4af37]/40 px-4 text-xs font-bold text-[#f2c94c]"
                    >
                      İptal
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={telegramLoginSubmitPassword} className="space-y-3">
                  <p className="text-xs text-[#b8c0d4]">
                    Hesabınızda iki adımlı doğrulama açık. Şifrenizi girin.
                  </p>
                  <input
                    className={inputCls}
                    type="password"
                    placeholder="İki adımlı doğrulama şifresi"
                    value={telegramPassword}
                    onChange={(e) => setTelegramPassword(e.target.value)}
                  />
                  {telegramLoginError ? (
                    <p className="text-[11px] font-semibold text-red-300">
                      {telegramLoginError}
                    </p>
                  ) : null}
                  <button
                    disabled={telegramLoginBusy}
                    className="rounded-xl gold-gradient px-6 py-2.5 text-sm font-extrabold uppercase text-black disabled:opacity-50"
                  >
                    {telegramLoginBusy ? "Bağlanıyor..." : "Bağlan"}
                  </button>
                </form>
              )}
            </div>

            <div className="card-surface rounded-2xl p-5">
              <h3 className="mb-1 text-sm font-black uppercase tracking-wide gold-text">
                Yönetim Botu
              </h3>
              <p className="mb-4 text-[11px] leading-relaxed text-[#7e879c]">
                Aynı eşleştirme özelliklerini Telegram içinden, renkli yeni
                nesil butonlarla yönetmek için BotFather tokenini girin. Botu
                yalnızca <span className="text-[#f2c94c]">{telegramStatus.botAdmin || "TELEGRAM_BOT_ADMINS tanımlı değil"}</span> kullanabilir.
              </p>
              {telegramStatus.hasBotToken ? (
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-300">
                    Bot hazır
                  </span>
                  <span className="text-sm text-white">
                    {telegramStatus.botUsername ? `@${telegramStatus.botUsername}` : "Token kayıtlı"}
                  </span>
                  <span className="text-[11px] text-[#7e879c]">
                    Admin: {telegramStatus.botAdmin || "TELEGRAM_BOT_ADMINS tanımlı değil"}
                  </span>
                  <button
                    onClick={removeBotToken}
                    className="ml-auto rounded-lg bg-red-500/20 px-3 py-1.5 text-[11px] font-bold text-red-300"
                  >
                    Tokeni Kaldır
                  </button>
                </div>
              ) : (
                <form onSubmit={saveBotToken} className="space-y-3">
                  <input
                    className={inputCls}
                    type="password"
                    autoComplete="off"
                    placeholder="Bot token (BotFather)"
                    value={botTokenInput}
                    onChange={(e) => setBotTokenInput(e.target.value)}
                  />
                  {botTokenError ? (
                    <p className="text-[11px] font-semibold text-red-300">{botTokenError}</p>
                  ) : (
                    <p className="text-[10px] text-[#7e879c]">
                      Token şifrelenerek kaydedilir. Worker birkaç saniye içinde
                      botu dinlemeye başlar. Telegram&apos;da bota /start yazın.
                    </p>
                  )}
                  <button
                    disabled={botTokenBusy}
                    className="rounded-xl gold-gradient px-6 py-2.5 text-sm font-extrabold uppercase text-black disabled:opacity-50"
                  >
                    {botTokenBusy ? "Doğrulanıyor..." : "Botu Kaydet"}
                  </button>
                </form>
              )}
            </div>

            <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
              <form onSubmit={saveTelegramRule} className="card-surface h-fit rounded-2xl p-5">
                <h3 className="mb-1 text-sm font-black uppercase tracking-wide gold-text">
                  {telegramRuleForm.id ? "Eşleştirmeyi Düzenle" : "Yeni Eşleştirme Ekle"}
                </h3>
                <p className="mb-4 text-[11px] leading-relaxed text-[#7e879c]">
                  Kaynak kanaldaki her yeni metin postu, altına eklenen metin ve
                  renkli butonlarla birlikte hedef kanala anında gönderilir.
                  Görselli postlar otomatik olarak atlanır. Hedefte link
                  önizlemesi açılmaz.
                </p>
                <div className="space-y-3">
                  <input
                    className={inputCls}
                    placeholder="Kaynak kanal (@kullaniciadi veya kanal ID)"
                    value={telegramRuleForm.sourceChannel}
                    onChange={(e) =>
                      setTelegramRuleForm({
                        ...telegramRuleForm,
                        sourceChannel: e.target.value,
                      })
                    }
                  />
                  <input
                    className={inputCls}
                    placeholder="Hedef kanal (@kullaniciadi veya kanal ID)"
                    value={telegramRuleForm.targetChannel}
                    onChange={(e) =>
                      setTelegramRuleForm({
                        ...telegramRuleForm,
                        targetChannel: e.target.value,
                      })
                    }
                  />
                  <textarea
                    className={inputCls}
                    rows={4}
                    placeholder="Postun altına eklenecek metin (isteğe bağlı, **kalın** ve __italik__ desteklenir; premium özel emoji bot üzerinden eklenir)"
                    value={telegramRuleForm.footerText}
                    onChange={(e) =>
                      setTelegramRuleForm({
                        ...telegramRuleForm,
                        footerText: e.target.value,
                      })
                    }
                  />
                  <div className="space-y-2 rounded-xl border border-[#d4af37]/20 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wide text-[#f2c94c]">
                        Alt butonlar
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const nextButtons: TelegramFooterButton[] = [
                            ...telegramRuleForm.footerButtons,
                            { text: "", url: "https://", style: "success" },
                          ];
                          setTelegramRuleForm({
                            ...telegramRuleForm,
                            footerButtons: nextButtons.slice(0, 8),
                          });
                        }}
                        className="rounded-lg border border-[#d4af37]/40 px-2 py-1 text-[10px] font-bold text-[#f2c94c]"
                      >
                        + Buton
                      </button>
                    </div>
                    <p className="text-[10px] leading-relaxed text-[#7e879c]">
                      Hedef postun altında renkli URL butonu. Renkli buton için
                      yönetim botunun hedef kanalda yönetici olması gerekir.
                    </p>
                    <select
                      className={inputCls}
                      value={telegramRuleForm.footerButtonLayout}
                      onChange={(e) =>
                        setTelegramRuleForm({
                          ...telegramRuleForm,
                          footerButtonLayout: e.target.value as "stack" | "row",
                        })
                      }
                    >
                      <option value="stack">Alt alta</option>
                      <option value="row">Yan yana</option>
                    </select>
                    {telegramRuleForm.footerButtons.map((button, index) => (
                      <div key={index} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto]">
                        <input
                          className={inputCls}
                          placeholder="Buton metni"
                          value={button.text}
                          onChange={(e) => {
                            const footerButtons = [...telegramRuleForm.footerButtons];
                            footerButtons[index] = { ...button, text: e.target.value };
                            setTelegramRuleForm({ ...telegramRuleForm, footerButtons });
                          }}
                        />
                        <input
                          className={inputCls}
                          placeholder="https://adres"
                          value={button.url}
                          onChange={(e) => {
                            const footerButtons = [...telegramRuleForm.footerButtons];
                            footerButtons[index] = { ...button, url: e.target.value };
                            setTelegramRuleForm({ ...telegramRuleForm, footerButtons });
                          }}
                        />
                        <select
                          className={inputCls}
                          value={button.style}
                          onChange={(e) => {
                            const footerButtons = [...telegramRuleForm.footerButtons];
                            footerButtons[index] = {
                              ...button,
                              style: e.target.value as TelegramFooterButton["style"],
                            };
                            setTelegramRuleForm({ ...telegramRuleForm, footerButtons });
                          }}
                        >
                          <option value="primary">Mavi</option>
                          <option value="success">Yeşil</option>
                          <option value="danger">Kırmızı</option>
                        </select>
                        <button
                          type="button"
                          onClick={() =>
                            setTelegramRuleForm({
                              ...telegramRuleForm,
                              footerButtons: telegramRuleForm.footerButtons.filter(
                                (_, i) => i !== index,
                              ),
                            })
                          }
                          className="rounded-lg bg-red-500/20 px-3 py-2 text-[11px] font-bold text-red-300"
                        >
                          Sil
                        </button>
                      </div>
                    ))}
                  </div>
                  <input
                    className={inputCls}
                    type="number"
                    placeholder="Sıra"
                    value={telegramRuleForm.sortOrder}
                    onChange={(e) =>
                      setTelegramRuleForm({
                        ...telegramRuleForm,
                        sortOrder: Number(e.target.value),
                      })
                    }
                  />
                  <label className="flex items-center gap-2 text-xs text-[#b8c0d4]">
                    <input
                      type="checkbox"
                      checked={telegramRuleForm.active}
                      onChange={(e) =>
                        setTelegramRuleForm({
                          ...telegramRuleForm,
                          active: e.target.checked,
                        })
                      }
                    />
                    Aktif
                  </label>
                  <div className="flex gap-2">
                    <button className="flex-1 rounded-xl gold-gradient py-2.5 text-sm font-extrabold uppercase text-black">
                      {telegramRuleForm.id ? "Güncelle" : "Ekle"}
                    </button>
                    {telegramRuleForm.id ? (
                      <button
                        type="button"
                        onClick={() => setTelegramRuleForm(blankTelegramRule())}
                        className="rounded-xl border border-[#d4af37]/40 px-4 text-xs font-bold text-[#f2c94c]"
                      >
                        İptal
                      </button>
                    ) : null}
                  </div>
                </div>
              </form>

              <div className="space-y-6">
                <div className="space-y-3">
                  <h3 className="text-sm font-black uppercase tracking-wide gold-text">
                    Kanal Eşleştirmeleri ({telegramRules.length})
                  </h3>
                  {telegramRules.map((rule) => (
                    <div key={rule.id} className="card-surface rounded-2xl p-4">
                      <div className="flex flex-wrap items-start gap-3">
                        <div className="min-w-40 flex-1">
                          <div className="text-sm font-bold text-white">
                            {rule.sourceChannel} <span className="text-[#7e879c]">→</span>{" "}
                            {rule.targetChannel}
                          </div>
                          {rule.footerText ? (
                            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[#7e879c]">
                              {rule.footerText}
                            </p>
                          ) : null}
                          {(rule.footerButtons?.length ?? 0) > 0 ? (
                            <p className="mt-1 text-[11px] text-[#f2c94c]">
                              {rule.footerButtons
                                .map((button) => button.text || "Buton")
                                .join(" · ")}
                            </p>
                          ) : null}
                          <div className="mt-1.5 text-[10px] text-[#7e879c]">
                            Sıra: {rule.sortOrder}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => toggleTelegramRule(rule)}
                            className={`rounded-lg px-3 py-1.5 text-[11px] font-bold ${
                              rule.active
                                ? "bg-[#1a2338] text-white"
                                : "bg-red-500/20 text-red-300"
                            }`}
                          >
                            {rule.active ? "Aktif" : "Pasif"}
                          </button>
                          <button
                            onClick={() =>
                              setTelegramRuleForm({
                                id: rule.id,
                                sourceChannel: rule.sourceChannel,
                                targetChannel: rule.targetChannel,
                                footerText: rule.footerText,
                                footerButtons: Array.isArray(rule.footerButtons)
                                  ? rule.footerButtons
                                  : [],
                                footerButtonLayout:
                                  rule.footerButtonLayout === "row" ? "row" : "stack",
                                active: rule.active,
                                sortOrder: rule.sortOrder,
                              })
                            }
                            className="rounded-lg bg-[#1a2338] px-3 py-1.5 text-[11px] font-bold text-[#f2c94c]"
                          >
                            Düzenle
                          </button>
                          <button
                            onClick={() => deleteTelegramRule(rule.id)}
                            className="rounded-lg bg-red-500/20 px-3 py-1.5 text-[11px] font-bold text-red-300"
                          >
                            Sil
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {telegramRules.length === 0 ? (
                    <p className="card-surface rounded-2xl p-4 text-xs text-[#7e879c]">
                      Henüz bir eşleştirme eklenmedi.
                    </p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <h3 className="text-sm font-black uppercase tracking-wide gold-text">
                    Son Aktivite
                  </h3>
                  <div className="card-surface divide-y divide-[#d4af37]/10 rounded-2xl">
                    {telegramLogs.map((item) => (
                      <div key={item.id} className="flex flex-wrap items-center gap-3 p-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                            item.status === "forwarded"
                              ? "bg-emerald-500/20 text-emerald-300"
                              : item.status === "skipped_media" ||
                                  item.status === "skipped_format"
                                ? "bg-[#1a2338] text-[#b8c0d4]"
                                : "bg-red-500/20 text-red-300"
                          }`}
                        >
                          {item.status === "forwarded"
                            ? "İletildi"
                            : item.status === "skipped_media" ||
                                item.status === "skipped_format"
                              ? "Atlandı"
                              : "Hata"}
                        </span>
                        <span className="text-xs text-white">
                          {item.sourceChannel} → {item.targetChannel}
                        </span>
                        <span className="ml-auto text-[10px] text-[#7e879c]">
                          {new Date(item.createdAt).toLocaleString("tr-TR")}
                        </span>
                        {item.preview ? (
                          <p className="w-full text-[11px] text-[#7e879c]">{item.preview}</p>
                        ) : null}
                        {item.detail ? (
                          <p className="w-full text-[11px] text-red-300">{item.detail}</p>
                        ) : null}
                      </div>
                    ))}
                    {telegramLogs.length === 0 ? (
                      <p className="p-4 text-xs text-[#7e879c]">Henüz aktivite yok.</p>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === "settings" && (
          <form onSubmit={saveSettings} className="card-surface mt-6 space-y-4 rounded-2xl p-5">
            {(
              [
                ["hero_title", "Ana Başlık"],
                ["hero_subtitle", "Alt Başlık"],
                ["featured_title", "Güvenilir Siteler Başlığı"],
                ["featured_subtitle", "Güvenilir Siteler Açıklaması"],
                ["featured_big_count", "Güvenilir Siteler: Büyük Kart Sayısı (0-12)"],
                ["all_title", "Tüm Siteler Başlığı"],
                ["all_subtitle", "Tüm Siteler Açıklaması"],
                ["all_page_size", "Tüm Siteler: Sayfa Başına Kart (6-30)"],
                ["bottom_banner", "Alt Banner Metni"],
                ["bottom_banner_cta", "Alt Banner Buton Yazısı"],
                ["bottom_banner_url", "Alt Banner Link"],
                ["telegram_url", "Telegram Linki"],
                ["contact_email", "İletişim E-postası"],
              ] as const
            ).map(([key, label]) => (
              <div key={key}>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-[#7e879c]">
                  {label}
                </label>
                <textarea
                  rows={key.includes("banner") || key.includes("subtitle") ? 2 : 1}
                  className={inputCls}
                  value={settings[key] ?? ""}
                  onChange={(e) => setSettings({ ...settings, [key]: e.target.value })}
                />
              </div>
            ))}
            <button className="w-full rounded-xl gold-gradient py-3 text-sm font-extrabold uppercase text-black">
              Kaydet
            </button>
          </form>
        )}
          </div>
        </div>
      </div>
    </div>
  );
}
