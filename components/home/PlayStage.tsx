"use client";

import Link from "next/link";
import { useState } from "react";

const CHESTS = [
  { id: "bronze", name: "Bronz", odds: "Sık" },
  { id: "silver", name: "Gümüş", odds: "Orta" },
  { id: "gold", name: "Altın", odds: "Nadir" },
] as const;

type ChestId = (typeof CHESTS)[number]["id"];

type Opened = { chest: string; label: string; points: number } | null;

export function PlayStage({
  loggedIn,
  opened,
  chestsOnly = false,
}: {
  loggedIn: boolean;
  opened: Opened;
  chestsOnly?: boolean;
}) {
  const [phase, setPhase] = useState<"idle" | "shaking" | "opened">(opened ? "opened" : "idle");
  const [picked, setPicked] = useState<string | null>(opened?.chest ?? null);
  const [result, setResult] = useState<Opened>(opened);
  const [error, setError] = useState("");

  async function openChest(id: ChestId) {
    if (phase !== "idle" || result) return;
    if (!loggedIn) {
      window.location.href = "/giris";
      return;
    }
    setPicked(id);
    setPhase("shaking");
    setError("");
    const started = Date.now();
    try {
      const res = await fetch("/api/puan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "chest", chest: id }),
      });
      const data = (await res.json().catch(() => null)) as
        | { error?: string; chest?: string; label?: string; points?: number }
        | null;
      const wait = Math.max(0, 1100 - (Date.now() - started));
      await new Promise((resolve) => setTimeout(resolve, wait));
      if (!res.ok || !data || typeof data.points !== "number" || !data.label) {
        setPhase("idle");
        setPicked(null);
        setError(data?.error || "Sandık açılamadı.");
        return;
      }
      setResult({ chest: id, label: data.label, points: data.points });
      setPhase("opened");
    } catch {
      setPhase("idle");
      setPicked(null);
      setError("Sandık açılamadı.");
    }
  }

  const chests = (
    <article className="play-card home-chest">
      <header className="play-card-head">
        <h2>Gizem sandığı</h2>
        <p>Günde bir sandık. Ödül puan defterine yazılır.</p>
      </header>
      <div className="chest-row">
        {CHESTS.map((chest) => {
          const isPicked = picked === chest.id;
          const revealed = phase === "opened" && isPicked;
          return (
            <button
              key={chest.id}
              type="button"
              className={isPicked ? "chest-btn chest-btn-on" : "chest-btn"}
              disabled={phase !== "idle" || Boolean(result)}
              onClick={() => void openChest(chest.id)}
              aria-label={revealed ? `${chest.name}: ${result?.points} puan` : `${chest.name} sandığı aç`}
            >
              <span className={isPicked && phase === "shaking" ? "chest-art chest-shaking" : "chest-art"}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/images/chests/${chest.id}-${revealed ? "open" : "closed"}.png`}
                  alt=""
                />
              </span>
              {revealed && result ? (
                <span className="chest-prize">+{result.points} puan</span>
              ) : (
                <span className="chest-name">
                  {chest.name}
                  <small>{chest.odds}</small>
                </span>
              )}
            </button>
          );
        })}
      </div>
      <p className="play-note" aria-live="polite">
        {error
          ? error
          : phase === "shaking"
            ? "Sandık açılıyor."
            : result
              ? `${result.label}: +${result.points} puan hesabına yazıldı.`
              : loggedIn
                ? "Açmak için bir sandığa dokun."
                : "Sandık için giriş yap."}
      </p>
    </article>
  );

  if (chestsOnly) return chests;

  return (
    <div className="play-stage">
      <article className="play-card home-wheel">
        <header className="play-card-head">
          <h2>Çark</h2>
          <p>Günde bir çevirme. Sonuç çark sayfasında yazılır.</p>
        </header>
        <Link href="/cark" className="home-wheel-link" aria-label="Çarka git">
          <span className="home-wheel-mask">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/oyun/cark-nesne.jpg" alt="" className="home-wheel-spin" />
          </span>
        </Link>
        <Link href="/cark" className="btn btn-gold btn-sm">
          Çarka git
        </Link>
      </article>

      <article className="play-card home-dice">
        <header className="play-card-head">
          <h2>Zar</h2>
          <p>Üst ve alt bahsi zar sayfasında. Sayı durunca görünür.</p>
        </header>
        <Link href="/zar" className="home-dice-link" aria-label="Zara git">
          <span className="home-dice-frame">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/oyun/zar-cift.jpg" alt="" className="home-dice-rock" />
          </span>
        </Link>
        <Link href="/zar" className="btn btn-gold btn-sm">
          Zara git
        </Link>
      </article>

      {chests}
    </div>
  );
}
