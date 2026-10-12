"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function AdminLogin() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setLoading(false);
    if (res.ok) {
      router.refresh();
    } else {
      setError("Hatalı şifre, tekrar deneyin.");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-3xl border border-border bg-card p-8 text-center"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/logos/fist.png"
          alt="AL KANKA"
          className="mx-auto h-20 w-auto"
        />
        <h1 className="mt-4 text-xl font-black tracking-widest text-primary">
          AL KANKA PANEL
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">Yönetim paneline giriş yapın</p>

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Şifre"
          autoFocus
          className="mt-6 w-full rounded-xl border border-border bg-background px-4 py-3 text-center text-foreground outline-none focus:border-primary"
        />

        {error ? <p className="mt-3 text-xs font-semibold text-red-400">{error}</p> : null}

        <button
          type="submit"
          disabled={loading}
          className="mt-5 w-full rounded-xl bg-primary py-3 text-sm font-extrabold uppercase tracking-wider text-primary-foreground disabled:opacity-60"
        >
          {loading ? "Kontrol ediliyor..." : "Giriş Yap"}
        </button>
        <Link href="/" className="mt-4 block text-xs text-muted-foreground hover:text-primary">
          ← Siteye dön
        </Link>
      </form>
    </div>
  );
}
