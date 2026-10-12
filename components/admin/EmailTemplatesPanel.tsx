"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  compileEmailHtml,
  compileEmailText,
  EMAIL_BODY_STYLES,
  EMAIL_PRESETS,
  normalizeEmailFields,
  type EmailBodyStyle,
  type EmailLayout,
  type EmailTemplateFields,
} from "@/lib/email-template";

type SavedTemplate = EmailTemplateFields & {
  id: number;
  name: string;
  html: string;
  updatedAt?: string;
};

const emptyFields: EmailTemplateFields = {
  subject: "",
  preheader: "",
  layout: "promo",
  headline: "",
  bodyText: "",
  bodyStyle: "paragraphs",
  imageUrl: "",
  ctaText: "",
  ctaUrl: "https://alkanka.com",
  footerNote: "",
};

const inputCls =
  "w-full rounded-lg border border-[#d4af37]/25 bg-[#0d1220] px-3 py-2 text-sm text-white outline-none focus:border-[#d4af37]";

const labelCls = "mb-1 block text-[11px] font-bold uppercase tracking-wide text-[#8b93a7]";

export function EmailTemplatesPanel() {
  const [rows, setRows] = useState<SavedTemplate[]>([]);
  const [form, setForm] = useState<EmailTemplateFields & { id?: number; name: string }>({
    name: "",
    ...emptyFields,
  });
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const [copied, setCopied] = useState<"html" | "txt" | null>(null);

  const load = useCallback(async () => {
    const data = await fetch("/api/admin/email-templates").then((r) => r.json());
    setRows(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const fields = useMemo(() => normalizeEmailFields(form), [form]);
  const html = useMemo(() => compileEmailHtml(fields), [fields]);
  const plainText = useMemo(() => compileEmailText(fields), [fields]);

  function flash(text: string) {
    setMsg(text);
    window.setTimeout(() => setMsg(""), 2500);
  }

  function blank() {
    setForm({ name: "", ...emptyFields });
  }

  function applyPreset(key: keyof typeof EMAIL_PRESETS) {
    const preset = EMAIL_PRESETS[key];
    setForm((prev) => ({
      ...prev,
      ...preset.fields,
      name: prev.name || preset.label,
    }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      flash("Şablon adı zorunlu");
      return;
    }
    setBusy(true);
    const isEdit = Boolean(form.id);
    const res = await fetch(
      isEdit ? `/api/admin/email-templates/${form.id}` : "/api/admin/email-templates",
      {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      },
    );
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      flash(data.error ?? "Kayıt başarısız");
      return;
    }
    flash(isEdit ? "Şablon güncellendi" : "Şablon kaydedildi");
    if (!isEdit && data.id) setForm((prev) => ({ ...prev, id: data.id }));
    void load();
  }

  async function remove(id: number) {
    if (!confirm("Bu e-posta şablonu silinsin mi?")) return;
    await fetch(`/api/admin/email-templates/${id}`, { method: "DELETE" });
    if (form.id === id) blank();
    flash("Şablon silindi");
    void load();
  }

  async function uploadImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    const body = new FormData();
    body.append("file", file);
    body.append("name", form.name || "email");
    const res = await fetch("/api/admin/upload-logo", { method: "POST", body });
    const data = await res.json().catch(() => ({}));
    setUploading(false);
    if (!res.ok) {
      flash(data.error ?? "Görsel yüklenemedi");
      return;
    }
    setForm((prev) => ({
      ...prev,
      imageUrl: String(data.url).startsWith("http")
        ? data.url
        : `${window.location.origin}${data.url}`,
    }));
    flash("Görsel yüklendi");
  }

  function fileSlug() {
    return (
      (form.name || "email-sablon")
        .toLocaleLowerCase("tr")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "email-sablon"
    );
  }

  async function copyContent(kind: "html" | "txt") {
    try {
      await navigator.clipboard.writeText(kind === "html" ? html : plainText);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 1800);
    } catch {
      flash("Kopyalanamadı");
    }
  }

  function downloadFile(content: string, mime: string, ext: string) {
    const blob = new Blob([content], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${fileSlug()}.${ext}`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mt-6 space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-sm font-black uppercase tracking-wide gold-text">
            E-posta HTML Şablonları
          </h3>
          <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-[#8b93a7]">
            Outlook ve Gmail uyumlu HTML üretir; düz metin sürümünü de .txt
            olarak indirir. Soldan şablon seç, alanları doldur, sağda anlık
            önizlemeyi gör.
          </p>
        </div>
        <button
          type="button"
          onClick={blank}
          className="rounded-xl border border-[#d4af37]/40 px-4 py-2 text-xs font-bold text-[#f2c94c]"
        >
          Yeni şablon
        </button>
      </div>

      {msg ? (
        <div className="rounded-xl border border-[#d4af37]/40 bg-[#121827] px-4 py-2 text-sm text-[#f2c94c]">
          {msg}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {Object.entries(EMAIL_PRESETS).map(([key, preset]) => (
          <button
            key={key}
            type="button"
            onClick={() => applyPreset(key as keyof typeof EMAIL_PRESETS)}
            className="rounded-lg border border-[#d4af37]/25 bg-[#121827] px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-[#b8c0d4] hover:border-[#d4af37]/60"
          >
            Hazır: {preset.label}
          </button>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[220px_minmax(0,1fr)_minmax(320px,420px)]">
        <aside className="space-y-2">
          {rows.length === 0 ? (
            <div className="card-surface rounded-2xl p-4 text-[12px] text-[#8b93a7]">
              Kayıtlı şablon yok. Formu doldurup kaydet.
            </div>
          ) : (
            rows.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() =>
                  setForm({
                    id: item.id,
                    name: item.name,
                    subject: item.subject,
                    preheader: item.preheader,
                    layout: item.layout,
                    headline: item.headline,
                    bodyText: item.bodyText,
                    bodyStyle: item.bodyStyle,
                    imageUrl: item.imageUrl,
                    ctaText: item.ctaText,
                    ctaUrl: item.ctaUrl,
                    footerNote: item.footerNote,
                  })
                }
                className={`card-surface w-full rounded-2xl p-3 text-left ${
                  form.id === item.id ? "ring-1 ring-[#d4af37]" : ""
                }`}
              >
                <div className="truncate text-sm font-bold text-white">{item.name}</div>
                <div className="mt-1 truncate text-[11px] text-[#8b93a7]">
                  {item.subject || "Konu yok"}
                </div>
              </button>
            ))
          )}
        </aside>

        <form onSubmit={save} className="card-surface space-y-3 rounded-2xl p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={labelCls}>Şablon adı</span>
              <input
                className={inputCls}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Mayıs kampanya maili"
              />
            </label>
            <label className="block">
              <span className={labelCls}>Düzen</span>
              <select
                className={inputCls}
                value={form.layout}
                onChange={(e) =>
                  setForm({ ...form, layout: e.target.value as EmailLayout })
                }
              >
                <option value="promo">Kampanya (görsel + buton)</option>
                <option value="announcement">Duyuru</option>
                <option value="simple">Sade metin</option>
              </select>
            </label>
          </div>

          <label className="block">
            <span className={labelCls}>E-posta konusu</span>
            <input
              className={inputCls}
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              placeholder="Konu satırı"
            />
          </label>

          <label className="block">
            <span className={labelCls}>Ön izleme metni</span>
            <input
              className={inputCls}
              value={form.preheader}
              onChange={(e) => setForm({ ...form, preheader: e.target.value })}
              placeholder="Gelen kutusunda konu altında görünen kısa satır"
            />
          </label>

          <label className="block">
            <span className={labelCls}>Başlık</span>
            <input
              className={inputCls}
              value={form.headline}
              onChange={(e) => setForm({ ...form, headline: e.target.value })}
              placeholder="Mail içi ana başlık"
            />
          </label>

          <div>
            <span className={labelCls}>Gövde şablonu</span>
            <select
              className={`${inputCls} mb-2`}
              value={form.bodyStyle}
              onChange={(e) =>
                setForm({ ...form, bodyStyle: e.target.value as EmailBodyStyle })
              }
            >
              {EMAIL_BODY_STYLES.map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
            <p className="mb-2 text-[11px] leading-relaxed text-[#8b93a7]">
              Metnini sen yaz; şablon yalnızca düzeni değiştirir. Satır veya
              boş satırla ayırdığın parçalar otomatik yerleşir.
            </p>
            <textarea
              className={inputCls}
              rows={7}
              value={form.bodyText}
              onChange={(e) => setForm({ ...form, bodyText: e.target.value })}
              placeholder="Kendi metnini yaz. Şablon seçince sağdaki önizleme anında düzenler."
            />
          </div>

          <div>
            <span className={labelCls}>
              Görsel <span className="normal-case text-[#f2c94c]">1072×600 px</span>
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <input
                className={`${inputCls} flex-1`}
                value={form.imageUrl}
                onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                placeholder="https://... veya yükle"
              />
              <label className="cursor-pointer rounded-xl border border-[#d4af37]/40 px-4 py-2 text-xs font-bold text-[#f2c94c]">
                {uploading ? "Yükleniyor..." : "Yükle"}
                <input type="file" accept="image/*" className="hidden" onChange={uploadImage} />
              </label>
            </div>
            {form.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={form.imageUrl}
                alt=""
                className="mt-2 max-h-24 rounded-lg border border-[#d4af37]/20 object-contain"
              />
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={labelCls}>Buton yazısı</span>
              <input
                className={inputCls}
                value={form.ctaText}
                onChange={(e) => setForm({ ...form, ctaText: e.target.value })}
                placeholder="Kampanyayı incele"
              />
            </label>
            <label className="block">
              <span className={labelCls}>Buton linki</span>
              <input
                className={inputCls}
                value={form.ctaUrl}
                onChange={(e) => setForm({ ...form, ctaUrl: e.target.value })}
                placeholder="https://alkanka.com"
              />
            </label>
          </div>

          <label className="block">
            <span className={labelCls}>Alt bilgi</span>
            <input
              className={inputCls}
              value={form.footerNote}
              onChange={(e) => setForm({ ...form, footerNote: e.target.value })}
              placeholder="Boş bırakılırsa varsayılan yasal metin kullanılır"
            />
          </label>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              disabled={busy}
              className="rounded-xl gold-gradient px-6 py-2 text-sm font-extrabold uppercase text-black disabled:opacity-60"
            >
              {form.id ? "Güncelle" : "Kaydet"}
            </button>
            {form.id ? (
              <button
                type="button"
                onClick={() => remove(form.id as number)}
                className="rounded-xl bg-red-500/20 px-4 py-2 text-xs font-bold text-red-300"
              >
                Sil
              </button>
            ) : null}
          </div>

          <div className="rounded-xl border border-[#d4af37]/20 bg-[#0a0f1c] p-3">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#8b93a7]">
              Dışa aktar
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <button
                type="button"
                onClick={() => void copyContent("html")}
                className="rounded-lg border border-[#d4af37]/35 px-3 py-2 text-[11px] font-bold text-[#f2c94c]"
              >
                {copied === "html" ? "Kopyalandı" : "HTML kopyala"}
              </button>
              <button
                type="button"
                onClick={() => downloadFile(html, "text/html", "html")}
                className="rounded-lg border border-[#d4af37]/35 px-3 py-2 text-[11px] font-bold text-[#f2c94c]"
              >
                .html indir
              </button>
              <button
                type="button"
                onClick={() => void copyContent("txt")}
                className="rounded-lg border border-[#d4af37]/35 px-3 py-2 text-[11px] font-bold text-[#f2c94c]"
              >
                {copied === "txt" ? "Kopyalandı" : "TXT kopyala"}
              </button>
              <button
                type="button"
                onClick={() =>
                  downloadFile(plainText.replace(/\n/g, "\r\n"), "text/plain", "txt")
                }
                className="rounded-lg gold-gradient px-3 py-2 text-[11px] font-extrabold text-black"
              >
                .txt indir
              </button>
            </div>
          </div>
        </form>

        <div className="card-surface overflow-hidden rounded-2xl">
          <div className="flex items-center justify-between border-b border-[#d4af37]/20 px-4 py-3">
            <span className="text-[11px] font-bold uppercase tracking-wide text-[#8b93a7]">
              Canlı önizleme
            </span>
            <div className="flex gap-1">
              {(["desktop", "mobile"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setPreviewMode(mode)}
                  className={`rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase ${
                    previewMode === mode
                      ? "gold-gradient text-black"
                      : "bg-[#1a2338] text-[#b8c0d4]"
                  }`}
                >
                  {mode === "desktop" ? "Web" : "Mobil"}
                </button>
              ))}
            </div>
          </div>
          <div className="bg-[#07090f] p-3">
            <div
              className={`mx-auto overflow-hidden rounded-xl border border-[#d4af37]/15 bg-white ${
                previewMode === "mobile" ? "w-[320px]" : "w-full"
              }`}
            >
              <iframe
                title="E-posta önizleme"
                sandbox=""
                srcDoc={html}
                className="block h-[640px] w-full bg-[#07090f]"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
