"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { PublicSite } from "@/lib/public-site";
import { SiteCard } from "./SiteCard";
import { SearchIcon } from "@/components/icons";

export function AllSites({
  initial,
  total,
  token,
  pageSize = 24,
  seed,
  children,
}: {
  initial: PublicSite[];
  total: number;
  token: string;
  pageSize?: number;
  seed: number;
  children?: ReactNode;
}) {
  const [items, setItems] = useState<PublicSite[]>(initial);
  const [count, setCount] = useState(total);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const firstRun = useRef(true);

  const request = useCallback(
    async (offset: number, term: string) => {
      const res = await fetch(
        `/api/sites?offset=${offset}&limit=${pageSize}&q=${encodeURIComponent(term)}&seed=${seed}`,
        { headers: { "x-list-token": token } },
      );

      // Token süresi dolduğunda sayfayı tazelemek yeni bir tane getirir.
      if (res.status === 403) {
        window.location.reload();
        return null;
      }
      if (res.status === 429) {
        setError("Çok fazla istek gönderildi, lütfen biraz bekleyin.");
        return null;
      }
      if (!res.ok) {
        setError("Liste yüklenemedi, lütfen tekrar deneyin.");
        return null;
      }

      setError("");
      return res.json();
    },
    [token, pageSize, seed],
  );

  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      const data = await request(0, q);
      if (data) {
        setItems(data.items ?? []);
        setCount(data.total ?? 0);
      }
      setSearching(false);
    }, 350);
    return () => clearTimeout(t);
  }, [q, request]);

  async function loadMore() {
    setLoading(true);
    const data = await request(items.length, q);
    if (data) {
      setItems((prev) => [...prev, ...(data.items ?? [])]);
      setCount(data.total ?? count);
    }
    setLoading(false);
  }

  return (
    <div className="flex flex-col">
      <div className="site-search max-lg:order-2 max-lg:mt-4">
        <SearchIcon className="h-5 w-5 shrink-0 text-[#d4af37]" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Site ara"
          aria-label="Site ara"
          type="search"
        />
        {q ? (
          <button
            type="button"
            onClick={() => setQ("")}
            className="shrink-0 text-xs font-bold text-[#7e879c] hover:text-[#f2c94c]"
          >
            Temizle
          </button>
        ) : null}
      </div>

      <p className="mt-2 text-xs text-[#7e879c] max-lg:order-3">
        {searching ? "Aranıyor..." : `${count} site listeleniyor`}
      </p>

      {children ? <div className="max-lg:order-1">{children}</div> : null}

      {error ? (
        <p className="mt-2 text-center text-xs font-semibold text-red-300 max-lg:order-4">
          {error}
        </p>
      ) : null}

      <div className="mt-3 grid grid-cols-2 gap-2.5 max-lg:order-1 max-lg:mt-0 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((site, i) => (
          <SiteCard key={site.id} site={site} compact eager={i < 8} />
        ))}
      </div>

      {items.length === 0 && !searching ? (
        <div className="panel mt-6 rounded-2xl px-6 py-12 text-center max-lg:order-4">
          <div className="mx-auto mb-4 h-1 w-16 rounded-full gold-gradient" />
          <p className="text-sm font-semibold text-[#e8d9a8]">
            {q
              ? "Bu aramada site yok."
              : "Bu özellik aktif olacak. İçerik kısa sürede eklenecek."}
          </p>
        </div>
      ) : null}

      {items.length < count ? (
        <div className="mt-8 text-center max-lg:order-5">
          <button
            onClick={loadMore}
            disabled={loading}
            className="btn btn-gold"
          >
            {loading
              ? "Yükleniyor..."
              : `+ Daha Fazla Yükle (${count - items.length} site)`}
          </button>
        </div>
      ) : null}
    </div>
  );
}
