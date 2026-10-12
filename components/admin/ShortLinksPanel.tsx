"use client";

import { useCallback, useEffect, useState } from "react";

type LinkRow = {
  id: number;
  slug: string;
  url: string;
  active: boolean;
  clicks: number;
};

const empty = { id: 0, slug: "", url: "", active: true };

export function ShortLinksPanel() {
  const [rows, setRows] = useState<LinkRow[]>([]);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/short-links", { cache: "no-store" });
    const data = (await res.json().catch(() => null)) as { links?: LinkRow[]; error?: string } | null;
    if (!res.ok) {
      setError(data?.error || "Liste alınamadı.");
      setLoading(false);
      return;
    }
    setRows(data?.links ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    // Liste, istek bitince yazılır.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    const res = await fetch("/api/admin/short-links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: form.id ? "update" : "create",
        id: form.id || undefined,
        slug: form.slug,
        url: form.url,
        active: form.active,
      }),
    });
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    setBusy(false);
    if (!res.ok) {
      setError(data?.error || "Kayıt tamamlanamadı.");
      return;
    }
    setForm(empty);
    setNotice(form.id ? "Kısa link güncellendi." : "Kısa link eklendi.");
    await load();
  }

  async function remove(id: number) {
    if (!window.confirm("Bu kısa link silinsin mi?")) return;
    setError("");
    setNotice("");
    const res = await fetch("/api/admin/short-links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id }),
    });
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    if (!res.ok) {
      setError(data?.error || "Silinemedi.");
      return;
    }
    if (form.id === id) setForm(empty);
    setNotice("Kısa link silindi.");
    await load();
  }

  return (
    <div className="mt-6 space-y-4">
      {error ? (
        <div className="rounded-xl border border-red-500/40 bg-[#121827] px-4 py-2 text-sm text-red-300">{error}</div>
      ) : null}
      {notice ? (
        <div className="rounded-xl border border-[#d4af37]/40 bg-[#121827] px-4 py-2 text-sm text-[#f2c94c]">{notice}</div>
      ) : null}

      <form onSubmit={save} className="panel space-y-3 rounded-2xl p-5">
        <h3 className="text-sm font-black uppercase tracking-wide gold-text">
          {form.id ? "Kısa linki düzenle" : "Yeni kısa link"}
        </h3>
        <label className="block text-xs font-bold uppercase tracking-wide text-[#7e879c]">
          Kısa ad
          <input
            className="field mt-1"
            value={form.slug}
            onChange={(e) => setForm({ ...form, slug: e.target.value })}
            placeholder="makrobet"
            required
            maxLength={40}
          />
        </label>
        <p className="text-xs text-[#7e879c]">
          Adres alkanka.com/kısa-ad olur. admin, api, go ve diğer sayfa adları kullanılamaz.
        </p>
        <label className="block text-xs font-bold uppercase tracking-wide text-[#7e879c]">
          Hedef adres
          <input
            className="field mt-1"
            value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
            placeholder="https://"
            required
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-[#b8c0d4]">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => setForm({ ...form, active: e.target.checked })}
            className="h-4 w-4 accent-[#d4af37]"
          />
          Açık
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={busy} className="btn btn-gold btn-sm">
            {busy ? "Kaydediliyor..." : "Kaydet"}
          </button>
          {form.id ? (
            <button type="button" className="btn btn-line btn-sm" onClick={() => setForm(empty)}>
              Vazgeç
            </button>
          ) : null}
        </div>
      </form>

      <div className="panel overflow-hidden rounded-2xl">
        <div className="grid grid-cols-[1fr_1.4fr_auto_auto_auto] gap-2 border-b border-[#d4af37]/15 px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-[#7e879c] max-sm:hidden">
          <span>Kısa ad</span>
          <span>Hedef</span>
          <span>Durum</span>
          <span>Tıklama</span>
          <span />
        </div>
        {loading ? (
          <p className="px-4 py-8 text-center text-sm text-[#7e879c]">Yükleniyor...</p>
        ) : rows.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm font-semibold text-[#e8d9a8]">
            Henüz kısa link yok.
          </p>
        ) : (
          <ul>
            {rows.map((row) => (
              <li
                key={row.id}
                className="grid items-center gap-2 border-b border-[#d4af37]/10 px-4 py-3 last:border-b-0 sm:grid-cols-[1fr_1.4fr_auto_auto_auto]"
              >
                <div className="text-sm font-black text-[#f2c94c]">/{row.slug}</div>
                <div className="truncate text-xs text-[#b8c0d4]">{row.url}</div>
                <div className="text-xs font-bold text-[#b8c0d4]">{row.active ? "Açık" : "Kapalı"}</div>
                <div className="text-sm font-black text-white">{row.clicks}</div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn btn-line btn-sm"
                    onClick={() => {
                      setForm({ id: row.id, slug: row.slug, url: row.url, active: row.active });
                      setNotice("");
                      setError("");
                    }}
                  >
                    Düzenle
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => void remove(row.id)}>
                    Sil
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
