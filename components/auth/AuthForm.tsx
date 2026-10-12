"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPoints } from "@/lib/points-rules";

export function AuthForm({
  mode,
  signupBonus = 0,
}: {
  mode: "giris" | "kayit";
  signupBonus?: number;
}) {
  const router = useRouter();
  const isRegister = mode === "kayit";
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [refCode, setRefCode] = useState("");
  const [adult, setAdult] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const bonusLabel = signupBonus > 0 ? formatPoints(signupBonus) : "";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (isRegister && !adult) {
      setError("18 yaşından büyük olduğunu onaylamalısın.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(isRegister ? "/api/uye/kayit" : "/api/uye/giris", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isRegister
            ? { username, password, email, adult, ref: refCode }
            : { username: email, password },
        ),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setError(data?.error || "İşlem tamamlanamadı.");
        setLoading(false);
        return;
      }
      router.push("/profil");
      router.refresh();
    } catch {
      setError("Bağlantı kurulamadı. Tekrar deneyin.");
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
      <div className="grid md:grid-cols-2">
        <div className="relative flex min-h-72 flex-col justify-end overflow-hidden bg-background p-6 md:min-h-[36rem]">
          <img
            src={isRegister ? "/images/mascots/jako-merhaba.png" : "/images/mascots/jako.png"}
            alt="AL KANKA maskotu Jako"
            className="absolute inset-0 size-full object-cover object-center"
          />
          <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
          <div className="relative flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-widest text-primary">Jako diyor ki</span>
            <p className="font-display text-xl font-bold text-balance text-foreground">
              {isRegister
                ? bonusLabel
                  ? `Hoş geldin kanka! İlk girişte ${bonusLabel} Kanka Coin benden.`
                  : "Hoş geldin kanka! İlk girişte 250 Kanka Coin benden."
                : "Tekrar hoş geldin kanka, seri seni bekliyor."}
            </p>
          </div>
        </div>

        <div className="relative flex flex-col gap-5 p-6">
          <Link
            href="/"
            aria-label="Kapat"
            className="absolute top-3 right-3 z-10 flex size-8 items-center justify-center rounded-full bg-background/80 text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="size-4" aria-hidden="true" />
          </Link>

          <div role="tablist" aria-label="Hesap" className="grid grid-cols-2 gap-1 rounded-lg bg-background p-1">
            <Link
              href="/giris"
              role="tab"
              aria-selected={!isRegister}
              className={cn(
                "flex h-9 items-center justify-center rounded-md text-xs font-bold uppercase tracking-wider transition-colors",
                !isRegister ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              Giriş
            </Link>
            <Link
              href="/kayit"
              role="tab"
              aria-selected={isRegister}
              className={cn(
                "flex h-9 items-center justify-center rounded-md text-xs font-bold uppercase tracking-wider transition-colors",
                isRegister ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              Kayıt ol
            </Link>
          </div>

          <form onSubmit={submit} className="flex flex-col gap-4">
            <h1 className="font-display text-xl font-bold text-foreground">
              {isRegister ? "AL KANKA’ya katıl" : "Hesabına giriş yap"}
            </h1>

            {isRegister ? (
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-muted-foreground">Kullanıcı adı</span>
                <input
                  name="username"
                  required
                  minLength={3}
                  maxLength={20}
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder="kanka123"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="h-11 rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                />
              </label>
            ) : null}

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-muted-foreground">E-posta</span>
              <input
                name="email"
                type={isRegister ? "email" : "text"}
                required
                autoComplete={isRegister ? "email" : "username"}
                placeholder="ornek@mail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-muted-foreground">Şifre</span>
              <input
                name="password"
                type="password"
                required
                minLength={8}
                maxLength={72}
                autoComplete={isRegister ? "new-password" : "current-password"}
                placeholder="En az 8 karakter"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              />
            </label>

            {isRegister ? (
              <>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold text-muted-foreground">Referans kodu (isteğe bağlı)</span>
                  <input
                    name="ref"
                    placeholder="KANKA-XXXX"
                    value={refCode}
                    onChange={(e) => setRefCode(e.target.value)}
                    className="h-11 rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                  />
                </label>
                <label className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
                  <input
                    type="checkbox"
                    required
                    checked={adult}
                    onChange={(e) => setAdult(e.target.checked)}
                    className="mt-0.5 accent-[var(--primary)]"
                  />
                  18 yaşından büyüğüm, kullanım şartlarını ve kuralları kabul ediyorum.
                </label>
              </>
            ) : null}

            {error ? <p className="text-center text-sm font-semibold text-destructive">{error}</p> : null}

            <button
              type="submit"
              disabled={loading}
              className="flex h-11 items-center justify-center rounded-lg bg-primary text-xs font-bold uppercase tracking-wider text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {loading ? "Bekleyin..." : isRegister ? (bonusLabel ? `Kayıt ol, ${bonusLabel} KC kap` : "Kayıt ol, 250 KC kap") : "Giriş yap"}
            </button>
            <p className="text-center text-xs text-muted-foreground">
              {isRegister ? "Zaten hesabın var mı? " : "Hesabın yok mu? "}
              <Link href={isRegister ? "/giris" : "/kayit"} className="font-semibold text-primary hover:underline">
                {isRegister ? "Giriş yap" : "Kayıt ol"}
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
