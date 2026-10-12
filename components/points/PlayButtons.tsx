"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatPoints } from "@/lib/points-rules";

async function post(body: Record<string, unknown>) {
  const res = await fetch("/api/puan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok) throw new Error(String(data?.error || "İşlem tamamlanamadı."));
  return data ?? {};
}

function Note({ error, ok }: { error: string; ok: string }) {
  if (error) return <p className="mt-3 text-sm font-semibold text-red-400">{error}</p>;
  if (ok) return <p className="mt-3 text-sm font-semibold text-[#f2c94c]">{ok}</p>;
  return null;
}

export function TaskButton({
  taskId,
  needsCode,
  disabled,
  claimed,
}: {
  taskId: number;
  needsCode: boolean;
  disabled: boolean;
  claimed: boolean;
}) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function claim() {
    setLoading(true);
    setError("");
    try {
      const data = await post({ action: "task", taskId, code });
      router.refresh();
      setError("");
      void data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "İşlem tamamlanamadı.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-3">
      {needsCode ? (
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Kod"
          disabled={disabled || claimed}
          className="mb-2 w-full rounded-lg border border-[#d4af37]/30 bg-[#0d1220] px-3 py-2 text-sm text-white outline-none"
        />
      ) : null}
      <button
        type="button"
        disabled={disabled || claimed || loading}
        onClick={() => void claim()}
        className={claimed ? "btn btn-spent btn-sm w-full" : "btn btn-gold btn-sm w-full"}
      >
        {claimed ? "Alındı" : loading ? "Yazılıyor..." : "Topla"}
      </button>
      <Note error={error} ok="" />
    </div>
  );
}

export function BuyButton({
  action,
  idKey,
  id,
  label,
  disabled,
}: {
  action: "market" | "ticket";
  idKey: "rewardId" | "eventId";
  id: number;
  label: string;
  disabled: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [loading, setLoading] = useState(false);

  return (
    <div>
      <button
        type="button"
        disabled={disabled || loading}
        onClick={() => {
          setLoading(true);
          setError("");
          setOk("");
          void post({ action, [idKey]: id })
            .then((data) => {
              if (action === "ticket" && data.number) setOk(`Bilet numaran: ${String(data.number)}`);
              else setOk("İşlem yazıldı.");
              router.refresh();
            })
            .catch((err: unknown) => setError(err instanceof Error ? err.message : "İşlem tamamlanamadı."))
            .finally(() => setLoading(false));
        }}
        className="btn btn-gold btn-sm w-full"
      >
        {loading ? "Yazılıyor..." : label}
      </button>
      <Note error={error} ok={ok} />
    </div>
  );
}

export function WheelButton({ disabled }: { disabled: boolean }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [loading, setLoading] = useState(false);

  return (
    <div className="text-center">
      <button
        type="button"
        disabled={disabled || loading}
        onClick={() => {
          setLoading(true);
          setError("");
          setOk("");
          void post({ action: "wheel" })
            .then((data) => {
              const points = Number(data.points ?? 0);
              setOk(
                points > 0
                  ? `${String(data.label)} — +${formatPoints(points)} puan`
                  : `${String(data.label)} — bu çevirmede puan yok`,
              );
              router.refresh();
            })
            .catch((err: unknown) => setError(err instanceof Error ? err.message : "İşlem tamamlanamadı."))
            .finally(() => setLoading(false));
        }}
        className="btn btn-gold btn-sm"
      >
        {loading ? "Çevriliyor..." : "Çevir"}
      </button>
      <Note error={error} ok={ok} />
    </div>
  );
}

export function DicePair({ rolling = false }: { rolling?: boolean }) {
  return (
    <div className="dice-table" aria-hidden>
      <img src="/oyun/zar-cift.jpg" alt="" className={rolling ? "dice-photo dice-photo-spin" : "dice-photo"} />
    </div>
  );
}

export function DiceForm({
  min,
  max,
  multiplier,
  disabled,
}: {
  min: number;
  max: number;
  multiplier: number;
  disabled: boolean;
}) {
  const router = useRouter();
  const [stake, setStake] = useState(String(min));
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [loading, setLoading] = useState(false);
  const [rolling, setRolling] = useState(false);
  const [roll, setRoll] = useState<number | null>(null);

  async function play(side: "over" | "under") {
    setLoading(true);
    setRolling(true);
    setError("");
    setOk("");
    setRoll(null);
    const started = Date.now();
    try {
      const data = await post({ action: "dice", side, stake: Number(stake) });
      const value = Number(data.roll);
      const wait = Math.max(0, 1100 - (Date.now() - started));
      await new Promise((resolve) => window.setTimeout(resolve, wait));
      setRoll(value);
      const outcome = data.outcome === "win" ? "Kazandın" : data.outcome === "push" ? "İade" : "Kaybettin";
      setOk(`Zar ${String(value)}. ${outcome}. Deftere yazıldı. Bakiye ${formatPoints(Number(data.balance ?? 0))}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "İşlem tamamlanamadı.");
    } finally {
      setRolling(false);
      setLoading(false);
    }
  }

  return (
    <div className="panel dice-card mt-6 max-w-xl rounded-2xl p-6 text-center">
      <DicePair rolling={rolling} />
      {roll != null ? <p className="dice-result">{roll}</p> : null}
      <p className="text-sm text-[#b8c0d4]">
        1-100 arası sayı. 51-100 üst, 1-49 alt, 50 iade. Kazanç {multiplier} kat.
      </p>
      <label className="mt-4 block text-xs font-bold uppercase tracking-wide text-[#7e879c]">
        Bahis ({min}-{max})
        <input
          value={stake}
          onChange={(e) => setStake(e.target.value)}
          inputMode="numeric"
          disabled={disabled}
          className="mx-auto mt-1 block w-40 rounded-lg border border-[#d4af37]/30 bg-[#0d1220] px-3 py-2 text-center text-sm text-white outline-none"
        />
      </label>
      <div className="mt-4 flex justify-center gap-3">
        <button
          type="button"
          disabled={disabled || loading}
          onClick={() => void play("over")}
          className="btn btn-gold"
        >
          Üst
        </button>
        <button
          type="button"
          disabled={disabled || loading}
          onClick={() => void play("under")}
          className="btn btn-line"
        >
          Alt
        </button>
      </div>
      <Note error={error} ok={ok} />
    </div>
  );
}

export function MatchButton({
  matchId,
  disabled,
  options,
}: {
  matchId: number;
  disabled: boolean;
  options: { a: string; b: string; c: string };
}) {
  const router = useRouter();
  const [option, setOption] = useState("a");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <select
        value={option}
        disabled={disabled}
        onChange={(e) => setOption(e.target.value)}
        className="rounded-lg border border-[#d4af37]/30 bg-[#0d1220] px-3 py-2 text-sm text-white"
      >
        <option value="a">{options.a}</option>
        <option value="b">{options.b}</option>
        <option value="c">{options.c}</option>
      </select>
      <button
        type="button"
        disabled={disabled || loading}
        onClick={() => {
          setLoading(true);
          setError("");
          void post({ action: "match", matchId, option })
            .then(() => router.refresh())
            .catch((err: unknown) => setError(err instanceof Error ? err.message : "İşlem tamamlanamadı."))
            .finally(() => setLoading(false));
        }}
        className="btn btn-gold btn-sm"
      >
        Tahmin et
      </button>
      <Note error={error} ok="" />
    </div>
  );
}

export function TelegramBox({
  linked,
  username,
}: {
  linked: boolean;
  username: string;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function start() {
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/uye/telegram/baslat", { method: "POST" });
      const data = (await res.json().catch(() => null)) as { url?: string; message?: string; connected?: boolean } | null;
      if (data?.url) {
        window.location.href = data.url;
        return;
      }
      setMessage(data?.message || "Telegram henüz bağlanmadı.");
    } catch {
      setMessage("Telegram henüz bağlanmadı.");
    } finally {
      setLoading(false);
    }
  }

  async function check() {
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/uye/telegram/kanal", { method: "POST" });
      const data = (await res.json().catch(() => null)) as { message?: string } | null;
      setMessage(data?.message || "Telegram henüz bağlanmadı.");
    } catch {
      setMessage("Telegram henüz bağlanmadı.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="panel mt-6 rounded-2xl p-6 text-center">
      <h2 className="text-sm font-black uppercase tracking-wide gold-text">Telegram</h2>
      <p className="mt-2 text-sm text-[#b8c0d4]">
        {linked ? `Bağlı hesap: @${username || "telegram"}` : "Hesabın henüz bağlı değil."}
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <button
          type="button"
          disabled={loading}
          onClick={() => void start()}
          className="btn btn-line btn-sm"
        >
          Telegram ile bağla
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => void check()}
          className="btn btn-ghost btn-sm"
        >
          Kanalı doğrula
        </button>
        {linked ? (
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              setLoading(true);
              void fetch("/api/uye/telegram/kopar", { method: "POST" }).then(() => {
                setLoading(false);
                router.refresh();
              });
            }}
            className="btn btn-ghost btn-sm"
          >
            Bağı kopar
          </button>
        ) : null}
      </div>
      {message ? <p className="mt-3 text-sm font-semibold text-[#e8d9a8]">{message}</p> : null}
    </div>
  );
}
