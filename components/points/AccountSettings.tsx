"use client";

import { useState } from "react";
import { LogoutButton } from "@/components/points/LogoutButton";

async function post(body: Record<string, string>) {
  const res = await fetch("/api/uye/hesap", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => null)) as { error?: string; email?: string } | null;
  if (!res.ok) throw new Error(data?.error || "İşlem tamamlanamadı.");
  return data ?? {};
}

export function AccountSettings({ email }: { email: string }) {
  const [mail, setMail] = useState(email);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [mailMsg, setMailMsg] = useState("");
  const [mailErr, setMailErr] = useState("");
  const [passMsg, setPassMsg] = useState("");
  const [passErr, setPassErr] = useState("");
  const [busy, setBusy] = useState<"email" | "password" | "">("");

  async function saveEmail(e: React.FormEvent) {
    e.preventDefault();
    setBusy("email");
    setMailErr("");
    setMailMsg("");
    try {
      const data = await post({ action: "email", email: mail });
      if (data.email) setMail(data.email);
      setMailMsg("E-posta güncellendi.");
    } catch (err) {
      setMailErr(err instanceof Error ? err.message : "İşlem tamamlanamadı.");
    } finally {
      setBusy("");
    }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy("password");
    setPassErr("");
    setPassMsg("");
    try {
      await post({ action: "password", currentPassword: current, newPassword: next });
      setCurrent("");
      setNext("");
      setPassMsg("Şifre değişti. Bir sonraki girişte yeni şifreyi kullan.");
    } catch (err) {
      setPassErr(err instanceof Error ? err.message : "İşlem tamamlanamadı.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div id="ayarlar" className="mt-6 rounded-2xl border border-border bg-card p-6">
      <h2 className="font-display text-sm font-bold uppercase tracking-wide text-primary">Hesap ayarları</h2>
      <form onSubmit={saveEmail} className="mt-4">
        <label className="block text-xs font-bold uppercase tracking-wide text-muted-foreground">
          E-posta
          <input
            type="email"
            required
            value={mail}
            onChange={(e) => setMail(e.target.value)}
            autoComplete="email"
            className="mt-1 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary"
            placeholder="ornek@posta.com"
          />
        </label>
        {mailErr ? <p className="mt-2 text-sm font-semibold text-primary">{mailErr}</p> : null}
        {mailMsg ? <p className="mt-2 text-sm font-semibold text-primary">{mailMsg}</p> : null}
        <button type="submit" disabled={busy === "email"} className="mt-3 h-9 rounded-lg border border-border px-3 text-xs font-bold uppercase tracking-wider text-foreground">
          {busy === "email" ? "Kaydediliyor..." : "E-postayı kaydet"}
        </button>
      </form>
      <form onSubmit={savePassword} className="mt-6 border-t border-[#d4af37]/15 pt-5">
        <label className="block text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Mevcut şifre
          <input
            type="password"
            required
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password"
            className="mt-1 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary"
          />
        </label>
        <label className="mt-3 block text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Yeni şifre
          <input
            type="password"
            required
            minLength={8}
            maxLength={72}
            value={next}
            onChange={(e) => setNext(e.target.value)}
            autoComplete="new-password"
            className="mt-1 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary"
          />
        </label>
        {passErr ? <p className="mt-2 text-sm font-semibold text-primary">{passErr}</p> : null}
        {passMsg ? <p className="mt-2 text-sm font-semibold text-primary">{passMsg}</p> : null}
        <button type="submit" disabled={busy === "password"} className="mt-3 h-9 rounded-lg bg-primary px-3 text-xs font-bold uppercase tracking-wider text-primary-foreground">
          {busy === "password" ? "Kaydediliyor..." : "Şifreyi değiştir"}
        </button>
      </form>
      <div className="mt-6 border-t border-[#d4af37]/15 pt-5">
        <LogoutButton />
      </div>
    </div>
  );
}
