"use client";

import { useCallback, useEffect, useState } from "react";

type Slide = {
  id: number;
  imageUrl: string;
  title: string;
  line: string;
  buttonLabel: string;
  href: string;
  sortOrder: number;
  active: boolean;
};

type Card = {
  id: number;
  slot: string;
  imageUrl: string;
  title: string;
  buttonLabel: string;
  href: string;
};

const COPY_KEYS = [
  "home_hero_image",
  "home_campaign_image",
  "telegram_announce_url",
  "promo_code",
  "partner_brand",
  "partner_url",
  "partner_bonus",
] as const;

type CopyKey = (typeof COPY_KEYS)[number];
type HomeCopy = Record<CopyKey, string>;

const emptyCopy = (): HomeCopy => ({
  home_hero_image: "",
  home_campaign_image: "",
  telegram_announce_url: "",
  promo_code: "",
  partner_brand: "",
  partner_url: "",
  partner_bonus: "",
});

const emptySlide = {
  id: 0,
  imageUrl: "",
  title: "",
  line: "",
  buttonLabel: "",
  href: "/",
  sortOrder: 0,
  active: true,
};

async function uploadImage(file: File, name: string) {
  const body = new FormData();
  body.set("file", file);
  body.set("name", name);
  const res = await fetch("/api/admin/upload-logo", { method: "POST", body });
  const data = (await res.json().catch(() => null)) as { url?: string; error?: string } | null;
  if (!res.ok || !data?.url) throw new Error(data?.error || "Görsel yüklenemedi.");
  return data.url;
}

export function HomeVisualsPanel() {
  const [slides, setSlides] = useState<Slide[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [slide, setSlide] = useState(emptySlide);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [copy, setCopy] = useState<HomeCopy>(emptyCopy);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/home", { cache: "no-store" });
    const data = (await res.json().catch(() => null)) as { slides?: Slide[]; cards?: Card[]; error?: string } | null;
    if (!res.ok) {
      setError(data?.error || "Liste alınamadı.");
      return;
    }
    setSlides(data?.slides ?? []);
    setCards(data?.cards ?? []);
  }, []);

  const loadCopy = useCallback(async () => {
    const res = await fetch("/api/admin/settings", { cache: "no-store" });
    const data = (await res.json().catch(() => null)) as Record<string, string> | null;
    if (!res.ok || !data) return;
    const next = emptyCopy();
    for (const key of COPY_KEYS) next[key] = data[key] ?? "";
    setCopy(next);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    void loadCopy();
  }, [load, loadCopy]);

  async function post(body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/admin/home", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setError(data?.error || "Kayıt tamamlanamadı.");
        return false;
      }
      setNotice("Kaydedildi.");
      await load();
      return true;
    } catch {
      setError("Kayıt tamamlanamadı.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 space-y-8">
      {error ? <p className="text-sm font-semibold text-red-300">{error}</p> : null}
      {notice ? <p className="text-sm font-semibold text-[#f2c94c]">{notice}</p> : null}

      <section className="panel rounded-2xl p-5">
        <h3 className="text-sm font-black uppercase tracking-wide gold-text">Slaytlar</h3>
        <p className="mt-2 text-sm font-semibold text-[#f2c94c]">Görsel boyutu: 1600×700 px</p>
        <p className="mt-1 text-xs text-[#b8c0d4]">Boşsa sitedeki hazır görsel kalır. Yükleyince o slaytın tamamını kaplar.</p>
        <form
          className="mt-4 grid gap-3 sm:grid-cols-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const ok = await post({ action: "save-slide", ...slide });
            if (ok) setSlide(emptySlide);
          }}
        >
          <label className="text-xs font-semibold text-[#b8c0d4]">
            Başlık
            <input className="field mt-1" value={slide.title} onChange={(e) => setSlide({ ...slide, title: e.target.value })} required />
          </label>
          <label className="text-xs font-semibold text-[#b8c0d4]">
            Kısa satır
            <input className="field mt-1" value={slide.line} onChange={(e) => setSlide({ ...slide, line: e.target.value })} />
          </label>
          <label className="text-xs font-semibold text-[#b8c0d4]">
            Düğme yazısı
            <input className="field mt-1" value={slide.buttonLabel} onChange={(e) => setSlide({ ...slide, buttonLabel: e.target.value })} required />
          </label>
          <label className="text-xs font-semibold text-[#b8c0d4]">
            Bağlantı
            <input className="field mt-1" value={slide.href} onChange={(e) => setSlide({ ...slide, href: e.target.value })} required />
          </label>
          <label className="text-xs font-semibold text-[#b8c0d4]">
            Sıra
            <input className="field mt-1" inputMode="numeric" value={slide.sortOrder} onChange={(e) => setSlide({ ...slide, sortOrder: Number(e.target.value) })} />
          </label>
          <label className="flex items-center gap-2 pt-5 text-sm text-[#b8c0d4]">
            <input type="checkbox" className="h-4 w-4 accent-[#d4af37]" checked={slide.active} onChange={(e) => setSlide({ ...slide, active: e.target.checked })} />
            Açık
          </label>
          <label className="text-xs font-semibold text-[#b8c0d4] sm:col-span-2">
            Görsel <span className="font-bold text-[#f2c94c]">1600×700 px</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="mt-1 block w-full text-sm text-[#b8c0d4]"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                setError("");
                try {
                  const imageUrl = await uploadImage(file, "slayt");
                  setSlide((current) => ({ ...current, imageUrl }));
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Görsel yüklenemedi.");
                }
              }}
            />
          </label>
          {slide.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={slide.imageUrl} alt="" className="h-24 w-full rounded-lg object-cover sm:col-span-2" />
          ) : (
            <p className="text-xs text-[#7e879c] sm:col-span-2">Henüz görsel yok. Slayt koyu tam genişlik kalır.</p>
          )}
          <div className="flex gap-2 sm:col-span-2">
            <button type="submit" disabled={busy} className="btn btn-gold btn-sm">
              {busy ? "Kaydediliyor..." : slide.id ? "Slaytı güncelle" : "Slayt ekle"}
            </button>
            {slide.id ? (
              <button type="button" className="btn btn-line btn-sm" onClick={() => setSlide(emptySlide)}>
                Vazgeç
              </button>
            ) : null}
          </div>
        </form>
        <ul className="mt-4 space-y-2">
          {slides.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#d4af37]/20 px-3 py-2 text-sm">
              <span>
                {row.sortOrder}. {row.title} {row.active ? "" : "· kapalı"} {row.imageUrl ? "· görselli" : "· görselsiz"}
              </span>
              <span className="flex gap-2">
                <button type="button" className="btn btn-line btn-sm" onClick={() => setSlide(row)}>
                  Düzenle
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    if (!window.confirm("Bu slayt silinsin mi?")) return;
                    void post({ action: "delete-slide", id: row.id });
                  }}
                >
                  Sil
                </button>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel rounded-2xl p-5">
        <h3 className="text-sm font-black uppercase tracking-wide gold-text">Özellik kartları</h3>
        <p className="mt-2 text-sm font-semibold text-[#f2c94c]">Görsel boyutu: 800×500 px</p>
        <p className="mt-1 text-xs text-[#b8c0d4]">Boşsa kartın hazır görseli kalır.</p>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {cards.map((card) => (
            <CardForm key={card.id} card={card} busy={busy} onSave={(body) => post(body)} />
          ))}
        </div>
      </section>

      <section className="panel rounded-2xl p-5">
        <h3 className="text-sm font-black uppercase tracking-wide gold-text">Duyuru ve ortak</h3>
        <p className="mt-2 text-sm font-semibold text-[#f2c94c]">Kahraman ve kampanya görseli, Telegram duyurusu, promo kodu, ortak marka.</p>
        <form
          className="mt-4 grid gap-3 sm:grid-cols-2"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            setNotice("");
            try {
              const res = await fetch("/api/admin/settings", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(copy),
              });
              const data = (await res.json().catch(() => null)) as { error?: string } | null;
              if (!res.ok) {
                setError(data?.error || "Kayıt tamamlanamadı.");
                return;
              }
              setNotice("Kaydedildi.");
              await loadCopy();
            } catch {
              setError("Kayıt tamamlanamadı.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <ImageField
            label="Kahraman görseli"
            size="1600×220 px"
            hint="Ana sayfa akışında, kartların altında. Slider’ın yerini almaz. Şerit 176 px yüksekliğinde kesilir."
            url={copy.home_hero_image}
            name="kahraman"
            onUrl={(url) => setCopy((current) => ({ ...current, home_hero_image: url }))}
            onError={setError}
          />
          <ImageField
            label="Kampanya görseli"
            size="1400×340 px"
            hint="Ortak satırının yanında durur. Kutu yaklaşık 730×176 px, görsel cover ile dolar."
            url={copy.home_campaign_image}
            name="kampanya"
            onUrl={(url) => setCopy((current) => ({ ...current, home_campaign_image: url }))}
            onError={setError}
          />
          <label className="text-xs font-semibold text-[#b8c0d4]">
            Telegram duyuru linki
            <input
              className="field mt-1"
              value={copy.telegram_announce_url}
              onChange={(e) => setCopy({ ...copy, telegram_announce_url: e.target.value })}
              placeholder="https://"
            />
          </label>
          <label className="text-xs font-semibold text-[#b8c0d4]">
            Promo kodu
            <input
              className="field mt-1"
              value={copy.promo_code}
              onChange={(e) => setCopy({ ...copy, promo_code: e.target.value })}
            />
          </label>
          <label className="text-xs font-semibold text-[#b8c0d4]">
            Partner marka
            <input
              className="field mt-1"
              value={copy.partner_brand}
              onChange={(e) => setCopy({ ...copy, partner_brand: e.target.value })}
            />
          </label>
          <label className="text-xs font-semibold text-[#b8c0d4]">
            Affiliate URL
            <input
              className="field mt-1"
              value={copy.partner_url}
              onChange={(e) => setCopy({ ...copy, partner_url: e.target.value })}
              placeholder="https://"
            />
          </label>
          <label className="text-xs font-semibold text-[#b8c0d4] sm:col-span-2">
            Bonus yüzdesi
            <input
              className="field mt-1"
              value={copy.partner_bonus}
              onChange={(e) => setCopy({ ...copy, partner_bonus: e.target.value })}
              inputMode="decimal"
            />
          </label>
          <div className="sm:col-span-2">
            <button type="submit" disabled={busy} className="btn btn-gold btn-sm">
              {busy ? "Kaydediliyor..." : "Duyuruyu kaydet"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function ImageField({
  label,
  size,
  hint,
  url,
  name,
  onUrl,
  onError,
}: {
  label: string;
  size: string;
  hint: string;
  url: string;
  name: string;
  onUrl: (url: string) => void;
  onError: (message: string) => void;
}) {
  return (
    <div className="text-xs font-semibold text-[#b8c0d4]">
      {label} <span className="font-bold text-[#f2c94c]">{size}</span>
      <p className="mt-1 font-medium text-[#7e879c]">{hint}</p>
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="mt-2 block w-full text-sm text-[#b8c0d4]"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          try {
            onUrl(await uploadImage(file, name));
          } catch (err) {
            onError(err instanceof Error ? err.message : "Görsel yüklenemedi.");
          }
        }}
      />
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="mt-2 h-24 w-full rounded-lg object-cover" />
      ) : (
        <p className="mt-2 text-[#7e879c]">Henüz görsel yok.</p>
      )}
    </div>
  );
}

function CardForm({
  card,
  busy,
  onSave,
}: {
  card: Card;
  busy: boolean;
  onSave: (body: Record<string, unknown>) => Promise<boolean>;
}) {
  const [form, setForm] = useState(card);

  useEffect(() => {
    setForm(card);
  }, [card]);

  return (
    <form
      className="rounded-xl border border-[#d4af37]/20 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        void onSave({ action: "save-card", ...form });
      }}
    >
      <p className="text-xs font-bold uppercase tracking-wide text-[#d4af37]">{card.title}</p>
      <p className="mt-1 text-xs font-semibold text-[#f2c94c]">Görsel boyutu: 800×500 px</p>
      <label className="mt-2 block text-xs font-semibold text-[#b8c0d4]">
        Başlık
        <input className="field mt-1" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
      </label>
      <label className="mt-2 block text-xs font-semibold text-[#b8c0d4]">
        Düğme yazısı
        <input className="field mt-1" value={form.buttonLabel} onChange={(e) => setForm({ ...form, buttonLabel: e.target.value })} required />
      </label>
      <label className="mt-2 block text-xs font-semibold text-[#b8c0d4]">
        Bağlantı
        <input className="field mt-1" value={form.href} onChange={(e) => setForm({ ...form, href: e.target.value })} required />
      </label>
      <label className="mt-2 block text-xs font-semibold text-[#b8c0d4]">
        Görsel <span className="font-bold text-[#f2c94c]">800×500 px</span>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="mt-1 block w-full text-sm text-[#b8c0d4]"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            try {
              const imageUrl = await uploadImage(file, card.slot || "kart");
              setForm((current) => ({ ...current, imageUrl }));
            } catch {
              /* Üst form hatayı gösterir; kart kaydı görselsiz kalır. */
            }
          }}
        />
      </label>
      {form.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={form.imageUrl} alt="" className="mt-2 h-24 w-full rounded-lg object-cover" />
      ) : null}
      <button type="submit" disabled={busy} className="btn btn-gold btn-sm mt-3">
        Kartı kaydet
      </button>
    </form>
  );
}
