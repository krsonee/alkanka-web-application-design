"use client";

export type MiniSlot<T> = { used: number; limit: number; last: T | null };

export type MiniSnapshot = {
  cark: MiniSlot<{ index: number; label: string; points: number }>;
  zar: MiniSlot<{ dice: [number, number]; label: string; points: number }>;
  sandik: MiniSlot<{ chest: string; label: string; points: number }>;
};

export async function loadMini(): Promise<MiniSnapshot | null> {
  const res = await fetch("/api/mini", { cache: "no-store" });
  if (!res.ok) return null;
  return (await res.json()) as MiniSnapshot;
}

export async function playMini(body: { game: "cark" | "zar" | "sandik"; chest?: string }) {
  let res: Response;
  try {
    res = await fetch("/api/mini", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, data: { error: "Bağlantı koptu. Sayfayı yenile; hak sunucuda kayıtlıdır." } };
  }
  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    balance?: number;
    used?: number;
    limit?: number;
    index?: number;
    label?: string;
    points?: number;
    dice?: [number, number];
    chest?: string;
  };
  return { ok: res.ok, data };
}
