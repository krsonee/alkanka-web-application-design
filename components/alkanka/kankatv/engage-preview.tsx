'use client'

import { useState } from 'react'
import { Radio, X } from 'lucide-react'
import { DEFAULT_TV, type TvEngage } from '@/lib/kankatv-shared'
import type { Match } from '@/lib/kankatv'
import { MatchEngage, WatchBar } from './engage'

const { goalBot: _goalBot, ...publicConfig } = DEFAULT_TV

const demoEngage: TvEngage = {
  config: { ...publicConfig, goalAlerts: true },
  member: true,
  watch: { minutes: 34, earned: 15, cap: 60, nextIn: 6 },
  viewers: 1284,
  reactions: [],
  predictions: [],
  follows: [],
  odds: [
    { match: 'Galatasaray - Fenerbahçe', siteName: 'Örnek Bet', market: 'Maç sonucu 1', newOdd: 2.45, oldOdd: 2.1, link: '' },
    { match: 'Galatasaray - Fenerbahçe', siteName: 'Kanka Bahis', market: 'KG Var', newOdd: 1.95, oldOdd: 1.7, link: '' },
  ],
}

const liveMatch: Match = {
  id: 900001,
  start: new Date().toISOString(),
  state: 'in',
  status: 'Canlı',
  clock: "67'",
  home: { id: 1, name: 'Galatasaray', logo: '', score: 1 },
  away: { id: 2, name: 'Fenerbahçe', logo: '', score: 1 },
}

const settledEngage: TvEngage = {
  ...demoEngage,
  odds: [],
  follows: [3],
  predictions: [
    { id: 1, gameId: 900002, home: 'Beşiktaş', away: 'Trabzonspor', pick: 'home', status: 'won', coin: 20, createdAt: new Date().toISOString() },
  ],
}

const settledMatch: Match = {
  ...liveMatch,
  id: 900002,
  clock: "81'",
  home: { id: 3, name: 'Beşiktaş', logo: '', score: 2 },
  away: { id: 4, name: 'Trabzonspor', logo: '', score: 0 },
}

function Section({ title, note, children }: { title: string; note: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-base font-bold text-foreground">{title}</h2>
        <p className="text-pretty text-sm leading-relaxed text-muted-foreground">{note}</p>
      </div>
      {children}
    </section>
  )
}

function MatchCard({ match, demo }: { match: Match; demo: TvEngage }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="flex items-center gap-1.5 text-xs font-bold text-live">
          <span className="size-2 rounded-full bg-live motion-safe:animate-pulse" aria-hidden="true" />
          {match.clock}
        </span>
        <span className="text-xs text-muted-foreground">Süper Lig</span>
      </div>
      <div className="flex items-center justify-between gap-3 font-semibold text-foreground">
        <span className="truncate">{match.home.name}</span>
        <span className="shrink-0 tabular-nums text-lg">
          {match.home.score} - {match.away.score}
        </span>
        <span className="truncate text-right">{match.away.name}</span>
      </div>
      <MatchEngage match={match} football demo={demo} />
    </div>
  )
}

export function EngagePreview() {
  const [miniOpen, setMiniOpen] = useState(true)

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-6">
      <header className="flex flex-col gap-1">
        <span className="text-xs font-bold uppercase tracking-wider text-primary">Örnek görünüm</span>
        <h1 className="text-balance text-2xl font-bold text-foreground">KankaTV etkileşim önizlemesi</h1>
        <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
          Buradaki veriler örnektir, butonlar gerçek coin/tahmin yazmaz. Tıklayıp deneyebilirsin.
        </p>
      </header>

      <Section title="Oynatıcı altı: izle-kazan + canlı tepkiler" note="İzleyici sayısı, günlük coin sayacı, ilerleme çubuğu ve uçan tepkiler.">
        <div className="flex flex-col gap-3">
          <div className="relative flex aspect-video w-full items-center justify-center rounded-xl border border-border bg-muted">
            <span className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <Radio className="size-4" aria-hidden="true" /> Yayın alanı
            </span>
          </div>
          <WatchBar playing demo={demoEngage} />
        </div>
      </Section>

      <Section title="Maç detayı: mini tahmin + gol bildirimi + özel oran" note="Canlı futbol maçında açılır. Tahmin seç, takım takip et.">
        <MatchCard match={liveMatch} demo={demoEngage} />
      </Section>

      <Section title="Sonuçlanmış tahmin örneği" note="Tahmin tutunca kullanıcı bunu görür; takip edilen takım dolu buton olur.">
        <MatchCard match={settledMatch} demo={settledEngage} />
      </Section>

      <Section title="Mini oynatıcı" note="Sayfayı aşağı kaydırınca yayın sağ alta küçülür. Örneği sağ altta görüyorsun.">
        <button
          type="button"
          onClick={() => setMiniOpen(true)}
          className="self-start rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground hover:border-primary"
        >
          Mini oynatıcıyı tekrar göster
        </button>
      </Section>

      {miniOpen && (
        <div className="fixed bottom-24 right-3 z-40 flex aspect-video w-60 items-center justify-center overflow-hidden rounded-xl border border-primary bg-muted shadow-2xl sm:w-80">
          <button
            type="button"
            onClick={() => setMiniOpen(false)}
            aria-label="Mini oynatıcıyı kapat"
            className="absolute right-1.5 top-1.5 z-10 flex size-7 items-center justify-center rounded-full bg-background/90 text-foreground shadow"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
          <span className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <Radio className="size-4" aria-hidden="true" /> Canlı yayın
          </span>
        </div>
      )}
    </main>
  )
}
