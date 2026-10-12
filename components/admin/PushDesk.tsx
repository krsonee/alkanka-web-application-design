"use client";

import { useEffect, useState } from "react";
import { PushSender } from "@/components/admin/PushSender";
import type { PushLog } from "@/lib/push";

export function PushDesk() {
  const [data, setData] = useState<{ total: number; members: number; log: PushLog[]; configured: boolean } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/push", { cache: "no-store" })
      .then((res) => res.json())
      .then((body) => {
        if (cancelled) return;
        if (typeof body?.total !== "number") {
          setError("Bildirim ayarları okunamadı.");
          return;
        }
        setData(body);
      })
      .catch(() => {
        if (!cancelled) setError("Bildirim ayarları okunamadı.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <p className="text-sm font-semibold text-red-300">{error}</p>;
  if (!data) return <p className="text-sm text-muted-foreground">Yükleniyor…</p>;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-black uppercase tracking-wide text-primary">Mobil uygulama</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Ana ekrana ekleyip uygulamadan giriş yapan üyeye bir kez 500 KC yazılır. Bildirim, abone olan cihazlara gider.
        </p>
      </div>
      <PushSender total={data.total} members={data.members} log={data.log} configured={data.configured} />
    </div>
  );
}
