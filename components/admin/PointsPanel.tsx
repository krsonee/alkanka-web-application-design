"use client";

import { useCallback, useEffect, useState } from "react";
import {
  formatPoints,
  formatPointsWhen,
  pointReasonLabel,
} from "@/lib/points-rules";

type MemberRow = {
  id: number;
  username: string;
  balance: number;
  createdAt: string;
};

type LedgerRow = {
  amount: number;
  reason: string;
  createdAt: string;
};

const inputCls =
  "w-full rounded-lg border border-[#d4af37]/25 bg-[#0d1220] px-3 py-2 text-sm text-white outline-none focus:border-[#d4af37]";

async function readError(res: Response) {
  const data = (await res.json().catch(() => null)) as { error?: string } | null;
  return data?.error || "İşlem tamamlanamadı.";
}

export function PointsPanel() {
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async (q: string) => {
    setLoading(true);
    setError("");
    const res = await fetch(`/api/admin/members?q=${encodeURIComponent(q)}`, { cache: "no-store" });
    if (!res.ok) {
      setError(await readError(res));
      setLoading(false);
      return;
    }
    const data = (await res.json()) as { members: MemberRow[] };
    setMembers(data.members);
    setLoading(false);
  }, []);

  useEffect(() => {
    // load() only sets state after its fetch resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load("");
  }, [load]);

  async function openMember(id: number) {
    setSelectedId(id);
    setNotice("");
    setError("");
    const res = await fetch(`/api/admin/members/${id}/points`, { cache: "no-store" });
    if (!res.ok) {
      setLedger([]);
      setError(await readError(res));
      return;
    }
    const data = (await res.json()) as { ledger: LedgerRow[] };
    setLedger(data.ledger);
  }

  async function adjust(sign: 1 | -1) {
    if (!selectedId) return;
    if (!/^\d+$/.test(amount.trim()) || Number(amount) <= 0) {
      setError("Eklenecek veya düşülecek tutar 1 veya daha büyük bir tam sayı olmalı.");
      return;
    }
    const magnitude = Number(amount);
    if (!reason.trim()) {
      setError("Sebep yazın.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    const res = await fetch(`/api/admin/members/${selectedId}/points`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: sign * magnitude, reason }),
    });
    const data = (await res.json().catch(() => null)) as {
      error?: string;
      balance?: number;
      entry?: LedgerRow;
    } | null;
    setBusy(false);
    if (!res.ok) {
      setError(data?.error || "Puan yazılamadı.");
      return;
    }
    setMembers((rows) =>
      rows.map((row) => (row.id === selectedId ? { ...row, balance: data?.balance ?? row.balance } : row)),
    );
    if (data?.entry) setLedger((rows) => [data.entry as LedgerRow, ...rows].slice(0, 20));
    setAmount("");
    setReason("");
    setNotice(`Bakiye güncellendi: ${formatPoints(data?.balance ?? 0)}`);
  }

  const selected = members.find((row) => row.id === selectedId) ?? null;

  return (
    <div className="mt-6 space-y-6">
      {error ? (
        <div className="rounded-xl border border-red-500/40 bg-[#121827] px-4 py-2 text-sm text-red-300">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="rounded-xl border border-[#d4af37]/40 bg-[#121827] px-4 py-2 text-sm text-[#f2c94c]">
          {notice}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="card-surface overflow-hidden rounded-2xl">
          <form
            className="flex gap-2 border-b border-[#d4af37]/15 p-4"
            onSubmit={(e) => {
              e.preventDefault();
              setQuery(search);
              void load(search);
            }}
          >
            <input
              className={inputCls}
              placeholder="Kullanıcı adı ara"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button className="rounded-lg border border-[#d4af37]/40 px-4 text-xs font-bold uppercase text-[#f2c94c]">
              Ara
            </button>
          </form>
          {loading ? (
            <p className="px-4 py-8 text-center text-sm text-[#7e879c]">Yükleniyor...</p>
          ) : members.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-[#7e879c]">
              {query ? "Bu aramaya uyan üye yok." : "Henüz üye yok."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-[10px] uppercase tracking-wider text-[#7e879c]">
                  <tr>
                    <th className="px-4 py-2 font-bold">Üye</th>
                    <th className="px-4 py-2 font-bold">Bakiye</th>
                    <th className="px-4 py-2 font-bold">Kayıt</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((member) => (
                    <tr
                      key={member.id}
                      onClick={() => void openMember(member.id)}
                      className={`cursor-pointer border-t border-[#d4af37]/10 ${
                        selectedId === member.id ? "bg-[#1a2338]" : "hover:bg-[#121827]"
                      }`}
                    >
                      <td className="px-4 py-3 font-semibold text-white">{member.username}</td>
                      <td className="px-4 py-3 font-black text-[#f2c94c]">
                        {formatPoints(member.balance)}
                      </td>
                      <td className="px-4 py-3 text-xs text-[#7e879c]">
                        {formatPointsWhen(member.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {members.length === 200 ? (
            <p className="border-t border-[#d4af37]/10 px-4 py-2 text-[11px] text-[#7e879c]">
              İlk 200 üye listeleniyor. Aramayla daraltın.
            </p>
          ) : null}
        </div>

        <div className="card-surface h-fit rounded-2xl p-5">
          <h3 className="text-sm font-black uppercase tracking-wide gold-text">Puan yaz</h3>
          {selected ? (
            <>
              <p className="mt-2 text-sm text-white">
                {selected.username}{" "}
                <span className="font-black text-[#f2c94c]">{formatPoints(selected.balance)}</span>
              </p>
              <label className="mt-4 block text-xs font-bold uppercase tracking-wide text-[#7e879c]">
                Tutar
                <input
                  className={`${inputCls} mt-1`}
                  inputMode="numeric"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="100"
                />
              </label>
              <label className="mt-3 block text-xs font-bold uppercase tracking-wide text-[#7e879c]">
                Sebep
                <textarea
                  className={`${inputCls} mt-1`}
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Neden eklendi veya düşüldü"
                  required
                />
              </label>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void adjust(1)}
                  className="rounded-xl gold-gradient py-2.5 text-xs font-extrabold uppercase text-black disabled:opacity-60"
                >
                  Ekle
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void adjust(-1)}
                  className="rounded-xl border border-red-400/50 py-2.5 text-xs font-extrabold uppercase text-red-300 disabled:opacity-60"
                >
                  Düş
                </button>
              </div>
              <div className="mt-5 space-y-2">
                {ledger.length === 0 ? (
                  <p className="text-xs text-[#7e879c]">Hareket yok.</p>
                ) : (
                  ledger.map((row, index) => (
                    <div key={`${row.createdAt}-${index}`} className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs font-semibold text-white">{pointReasonLabel(row.reason)}</div>
                        <div className="text-[10px] text-[#7e879c]">{formatPointsWhen(row.createdAt)}</div>
                      </div>
                      <div className={`text-xs font-black ${row.amount > 0 ? "text-[#f2c94c]" : "text-red-400"}`}>
                        {row.amount > 0 ? "+" : ""}
                        {formatPoints(row.amount)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            <p className="mt-3 text-sm text-[#7e879c]">Puan yazmak için listeden bir üye seçin. Sebep zorunludur.</p>
          )}
        </div>
      </div>
    </div>
  );
}
