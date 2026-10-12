"use client";

import { useCallback, useEffect, useState } from "react";

type StatsPayload = {
  generatedAt: string;
  online: number;
  today: { visitors: number; pageviews: number; clicks: number };
  yesterday: { visitors: number; pageviews: number; clicks: number };
  allTime: { visitors: number; pageviews: number; clicks: number };
  destinations: { target: string; label: string; count: number }[];
  topSitesToday: { id: number; name: string; clicks: number }[];
  topSitesAllTime: { id: number; name: string; clicks: number }[];
  hourly: { hour: string; pageviews: number; clicks: number }[];
  recent: { id: number; kind: string; target: string; label: string; createdAt: string }[];
};

function formatNumber(value: number) {
  return value.toLocaleString("tr-TR");
}

function changePct(today: number, yesterday: number) {
  if (yesterday <= 0) return today > 0 ? "+100%" : "—";
  const pct = Math.round(((today - yesterday) / yesterday) * 100);
  return `${pct > 0 ? "+" : ""}${pct}%`;
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const seconds = Math.max(0, Math.round(diff / 1000));
  if (seconds < 10) return "şimdi";
  if (seconds < 60) return `${seconds} sn önce`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} dk önce`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} sa önce`;
  return new Date(iso).toLocaleString("tr-TR", {
    timeZone: "Europe/Istanbul",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function kindLabel(kind: string) {
  return kind === "pageview" ? "Ziyaret" : "Tıklama";
}

export function StatisticsPanel() {
  const [data, setData] = useState<StatsPayload | null>(null);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/stats", { cache: "no-store" });
    if (!res.ok) {
      setError("İstatistikler alınamadı");
      return;
    }
    const json = (await res.json()) as StatsPayload;
    setData(json);
    setError("");
  }, []);

  useEffect(() => {
    void load();
    const refresh = window.setInterval(() => void load(), 5000);
    const clock = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => {
      window.clearInterval(refresh);
      window.clearInterval(clock);
    };
  }, [load]);

  const maxHour = Math.max(
    1,
    ...(data?.hourly ?? []).flatMap((row) => [row.pageviews, row.clicks]),
  );
  const maxDest = Math.max(1, ...(data?.destinations ?? []).map((row) => row.count));
  const maxTodaySite = Math.max(1, ...(data?.topSitesToday ?? []).map((row) => row.clicks));
  const maxAllSite = Math.max(1, ...(data?.topSitesAllTime ?? []).map((row) => row.clicks));

  return (
    <div className="mt-6 space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-sm font-black uppercase tracking-wide gold-text">
            Genel İstatistikler
          </h3>
          <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-[#8b93a7]">
            Siteye giren ziyaretçiler ve tıklanan yerler canlı güncellenir.
            Sayılar Türkiye saatiyle bugünü gösterir.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-[#d4af37]/30 bg-[#121827] px-3 py-1.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
          </span>
          <span className="text-[11px] font-bold uppercase tracking-wide text-emerald-300">
            Canlı
          </span>
          <span className="text-[11px] text-[#8b93a7]">
            {data
              ? new Date(data.generatedAt).toLocaleTimeString("tr-TR", {
                  timeZone: "Europe/Istanbul",
                })
              : "yükleniyor"}
          </span>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-400/40 bg-[#121827] px-4 py-2 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ["Şu an sitede", data?.online ?? 0, "son 5 dakika", ""],
          ["Ziyaretçi bugün", data?.today.visitors ?? 0, "benzersiz kişi", changePct(data?.today.visitors ?? 0, data?.yesterday.visitors ?? 0)],
          ["Sayfa görüntüleme", data?.today.pageviews ?? 0, "bugün", changePct(data?.today.pageviews ?? 0, data?.yesterday.pageviews ?? 0)],
          ["Tıklama bugün", data?.today.clicks ?? 0, "tüm hedefler", changePct(data?.today.clicks ?? 0, data?.yesterday.clicks ?? 0)],
          ["Toplam tıklama", data?.allTime.clicks ?? 0, "kayıt başlangıcından", ""],
        ].map(([label, value, hint, delta]) => (
          <div key={String(label)} className="card-surface rounded-2xl p-4">
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8b93a7]">
              {label}
            </div>
            <div className="mt-2 text-3xl font-black gold-text">{formatNumber(Number(value))}</div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-[#7e879c]">
              <span>{hint}</span>
              {delta ? <span className="text-[#f2c94c]">{delta}</span> : null}
            </div>
          </div>
        ))}
      </div>

      <div className="card-surface rounded-2xl p-5">
        <div className="mb-4 flex items-center justify-between">
          <h4 className="text-xs font-black uppercase tracking-wide text-white">
            Son 24 saat
          </h4>
          <div className="flex gap-3 text-[10px] font-bold uppercase tracking-wide text-[#8b93a7]">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm bg-[#8b93a7]" /> Görüntüleme
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm bg-[#d4af37]" /> Tıklama
            </span>
          </div>
        </div>
        <div className="flex h-36 items-end gap-1">
          {(data?.hourly ?? Array.from({ length: 24 }, () => ({ hour: "", pageviews: 0, clicks: 0 }))).map(
            (row, index) => (
              <div key={`${row.hour}-${index}`} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1">
                <div className="flex h-28 w-full items-end justify-center gap-0.5">
                  <div
                    className="w-[42%] rounded-t-sm bg-[#8b93a7]/70"
                    style={{ height: `${Math.max(3, (row.pageviews / maxHour) * 100)}%` }}
                    title={`${row.hour} görüntüleme ${row.pageviews}`}
                  />
                  <div
                    className="w-[42%] rounded-t-sm bg-[#d4af37]"
                    style={{ height: `${Math.max(3, (row.clicks / maxHour) * 100)}%` }}
                    title={`${row.hour} tıklama ${row.clicks}`}
                  />
                </div>
                <span className="hidden text-[9px] text-[#667085] sm:block">
                  {index % 3 === 0 ? row.hour : ""}
                </span>
              </div>
            ),
          )}
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <div className="card-surface rounded-2xl p-5">
          <h4 className="mb-4 text-xs font-black uppercase tracking-wide text-white">
            Bugün nereye tıklandı
          </h4>
          {data?.destinations.length ? (
            <div className="space-y-3">
              {data.destinations.map((row) => (
                <div key={row.target}>
                  <div className="mb-1 flex items-center justify-between text-[12px]">
                    <span className="font-bold text-white">{row.label}</span>
                    <span className="gold-text font-black">{formatNumber(row.count)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[#1a2338]">
                    <div
                      className="h-full rounded-full gold-gradient"
                      style={{ width: `${Math.max(6, (row.count / maxDest) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[12px] text-[#8b93a7]">Henüz tıklama yok.</p>
          )}
        </div>

        <div className="card-surface rounded-2xl p-5">
          <h4 className="mb-4 text-xs font-black uppercase tracking-wide text-white">
            Canlı hareket
          </h4>
          {data?.recent.length ? (
            <div className="max-h-[22rem] space-y-2 overflow-auto pr-1">
              {data.recent.map((row) => (
                <div
                  key={`${row.id}-${tick}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[#d4af37]/10 bg-[#0a0f1c] px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="truncate text-[12px] font-bold text-white">{row.label}</div>
                    <div className="text-[10px] uppercase tracking-wide text-[#8b93a7]">
                      {kindLabel(row.kind)}
                    </div>
                  </div>
                  <div className="shrink-0 text-[11px] text-[#f2c94c]">
                    {relativeTime(row.createdAt)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[12px] text-[#8b93a7]">
              Ziyaretçiler siteye girdikçe hareket burada görünür.
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <div className="card-surface rounded-2xl p-5">
          <h4 className="mb-4 text-xs font-black uppercase tracking-wide text-white">
            Bugün en çok tıklanan siteler
          </h4>
          {data?.topSitesToday.length ? (
            <div className="space-y-3">
              {data.topSitesToday.map((row, index) => (
                <div key={row.id} className="flex items-center gap-3">
                  <span className="w-6 text-right text-[11px] font-black text-[#d4af37]">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex justify-between text-[12px]">
                      <span className="truncate font-bold text-white">{row.name}</span>
                      <span className="ml-2 gold-text font-black">{formatNumber(row.clicks)}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-[#1a2338]">
                      <div
                        className="h-full rounded-full gold-gradient"
                        style={{ width: `${Math.max(6, (row.clicks / maxTodaySite) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[12px] text-[#8b93a7]">Bugün site tıklaması yok.</p>
          )}
        </div>

        <div className="card-surface rounded-2xl p-5">
          <h4 className="mb-4 text-xs font-black uppercase tracking-wide text-white">
            Tüm zamanlar — en çok tıklanan
          </h4>
          {data?.topSitesAllTime.length ? (
            <div className="space-y-3">
              {data.topSitesAllTime.map((row, index) => (
                <div key={row.id} className="flex items-center gap-3">
                  <span className="w-6 text-right text-[11px] font-black text-[#d4af37]">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex justify-between text-[12px]">
                      <span className="truncate font-bold text-white">{row.name}</span>
                      <span className="ml-2 gold-text font-black">{formatNumber(row.clicks)}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-[#1a2338]">
                      <div
                        className="h-full rounded-full gold-gradient"
                        style={{ width: `${Math.max(6, (row.clicks / maxAllSite) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[12px] text-[#8b93a7]">Henüz site tıklaması kaydı yok.</p>
          )}
        </div>
      </div>
    </div>
  );
}
