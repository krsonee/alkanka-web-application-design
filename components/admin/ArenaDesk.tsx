"use client";

import { useEffect, useState } from "react";
import { ArenaSettingsEditor } from "@/components/admin/ArenaSettingsEditor";
import { TournamentManager } from "@/components/admin/TournamentManager";
import type { ArenaSettings } from "@/lib/arena";
import type { Tournament } from "@/lib/tournaments-shared";

export function ArenaDesk() {
  const [settings, setSettings] = useState<ArenaSettings | null>(null);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/arena", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (!data?.settings) {
          setError("Oyun ayarları okunamadı.");
          return;
        }
        setSettings(data.settings as ArenaSettings);
        setTournaments(Array.isArray(data.tournaments) ? data.tournaments : []);
      })
      .catch(() => {
        if (!cancelled) setError("Oyun ayarları okunamadı.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <p className="text-sm font-semibold text-red-300">{error}</p>;
  if (!settings) return <p className="text-sm text-muted-foreground">Yükleniyor…</p>;

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-black uppercase tracking-wide text-primary">Masa oyunları</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Tavla, okey, bilardo, blackjack, rulet, kafa topu ve kafa basketbolu. Kapalı oyun sitede görünmez.
          </p>
        </div>
        <ArenaSettingsEditor settings={settings} />
      </section>
      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-black uppercase tracking-wide text-primary">Turnuvalar</h2>
          <p className="mt-1 text-sm text-muted-foreground">Kayıt, eşleşme ve şampiyon buradan yönetilir.</p>
        </div>
        <TournamentManager tournaments={tournaments} />
      </section>
    </div>
  );
}
