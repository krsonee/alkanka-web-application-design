"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatPoints } from "@/lib/points-rules";

type Slice = { id: number; label: string; points: number };
type SpinRow = { username: string; label: string; points: number; when: string };

export function PrizeRoom({
  slices,
  used,
  loggedIn,
  recent,
  allowance,
  lastLabel,
}: {
  slices: Slice[];
  used: boolean;
  loggedIn: boolean;
  recent: SpinRow[];
  allowance: string;
  lastLabel: string;
}) {
  const router = useRouter();
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [spent, setSpent] = useState(used);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [latest, setLatest] = useState(lastLabel);
  const [right, setRight] = useState(allowance);
  const count = Math.max(slices.length, 1);
  const sweep = 360 / count;

  async function spin() {
    if (spinning || spent) return;
    setSpinning(true);
    setError("");
    setOk("");
    try {
      const res = await fetch("/api/puan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "wheel" }),
      });
      const data = (await res.json().catch(() => null)) as {
        error?: string;
        sliceId?: number;
        label?: string;
        points?: number;
      } | null;
      if (!res.ok || !data) throw new Error(data?.error || "İşlem tamamlanamadı.");
      const index = Math.max(0, slices.findIndex((slice) => slice.id === Number(data.sliceId)));
      const turns = 5 * 360;
      setRotation((current) => {
        const base = Math.ceil(current / 360) * 360;
        return base + turns - index * sweep;
      });
      await new Promise((resolve) => window.setTimeout(resolve, 6400));
      const points = Number(data.points ?? 0);
      const label = String(data.label ?? "");
      setLatest(points > 0 ? `${label} +${formatPoints(points)}` : label || "Puan yok");
      setRight("Kullanıldı");
      setOk(
        points > 0
          ? `${label} — +${formatPoints(points)} puan. Deftere yazıldı.`
          : `${label} — bu çevirmede puan yok.`,
      );
      setSpent(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "İşlem tamamlanamadı.");
    } finally {
      setSpinning(false);
    }
  }

  return (
    <div className="room">
      <aside className="room-feed">
        <h2>Son çeviriler</h2>
        {recent.length === 0 ? (
          <p className="room-empty">Henüz çevirme yok.</p>
        ) : (
          <ul>
            {recent.map((row, index) => (
              <li key={`${row.username}-${row.when}-${index}`}>
                <span>
                  <b>{row.username}</b>
                  <small>{row.label}</small>
                </span>
                <em>{row.points > 0 ? `+${formatPoints(row.points)}` : "0"}</em>
              </li>
            ))}
          </ul>
        )}
      </aside>

      <div className="room-stage">
        <div className="prize">
          <div className="prize-shadow" aria-hidden />
          <div className="prize-rotor" style={{ ["--spin" as string]: `${rotation}deg` }}>
            <img className="prize-object" src="/oyun/cark-nesne.jpg" alt="" />
            <div className="prize-names">
              {slices.map((slice, index) => {
                const rad = ((index * sweep - 90) * Math.PI) / 180;
                const radius = 29;
                const chord = 2 * radius * Math.sin((sweep * Math.PI) / 360);
                const name = slice.label.length > 12 ? `${slice.label.slice(0, 11)}…` : slice.label;
                return (
                  <span
                    key={slice.id}
                    className="prize-name"
                    style={{
                      left: `${50 + radius * Math.cos(rad)}%`,
                      top: `${50 + radius * Math.sin(rad)}%`,
                      width: `${Math.max(11, chord * 0.62)}%`,
                      fontSize: count > 10 ? "2cqw" : count > 7 ? "2.3cqw" : "2.7cqw",
                    }}
                  >
                    <b>{name}</b>
                    <small>{slice.points > 0 ? `+${formatPoints(slice.points)}` : "0"}</small>
                  </span>
                );
              })}
            </div>
          </div>
          <img className="prize-needle" src="/oyun/cark-ibre.png" alt="" />
        </div>
        {loggedIn ? (
          <button type="button" className="btn btn-gold mt-4" disabled={spent || spinning} onClick={() => void spin()}>
            {spinning ? "Dönüyor..." : "ÇEVİR"}
          </button>
        ) : (
          <Link href="/giris" className="btn btn-line mt-4">
            Giriş
          </Link>
        )}
        {spent ? <p className="mt-3 text-xs text-[#7e879c]">Bugünkü çevirmeni kullandın.</p> : null}
        {error ? <p className="mt-3 text-sm font-semibold text-[#f2c94c]">{error}</p> : null}
        {ok ? <p className="mt-3 text-center text-sm font-semibold text-[#f2c94c]">{ok}</p> : null}
      </div>

      <div className="room-stats">
        <div className="room-stat">
          <span>Bugünkü hak</span>
          <strong>{right}</strong>
        </div>
        <div className="room-stat">
          <span>Son sonuç</span>
          <strong>{latest}</strong>
        </div>
        <div className="room-stat">
          <span>Dilim sayısı</span>
          <strong>{slices.length}</strong>
        </div>
      </div>
    </div>
  );
}
