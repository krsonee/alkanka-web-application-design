'use client'

import { useState } from 'react'
import { MonitorPlay } from 'lucide-react'
import { CemberStage } from '@/components/alkanka/cember/cember-overlay'
import { serverNow } from '@/components/alkanka/cember/cember-clock'
import { MAX_PLAYERS, type CemberRound } from '@/lib/cember-shared'

const NAMES = ['kanka', 'jako', 'bozkurt', 'pasa', 'reis', 'efe', 'aslan', 'sultan', 'tilki', 'kartal', 'ayaz', 'dolunay', 'yildiz', 'zeybek']

function makeDemoRound(count: number, title: string, prize: string): CemberRound {
  const participants = Array.from({ length: count }, (_, i) => ({
    id: `demo-${i}`,
    name: `${NAMES[i % NAMES.length]}${i >= NAMES.length ? Math.floor(i / NAMES.length) + 1 : ''}`,
    image: null,
  }))
  return {
    slot: new Date(serverNow()).toISOString(),
    title,
    game: 'cember' as const,
    duration: 0,
    seed: Math.floor(Math.random() * 2 ** 31),
    participants,
    winner: null,
    winners: [],
    steps: 0,
    prizeText: prize,
    survival: null,
    winningTeam: -1,
  }
}

export function CemberDemo({ title, prize }: { title: string; prize: string }) {
  const [count, setCount] = useState(40)
  const [compact, setCompact] = useState(false)
  const [round, setRound] = useState<CemberRound | null>(null)

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-gold/40 bg-card p-4">
      <div className="flex flex-col gap-1">
        <h3 className="font-display text-base font-bold uppercase text-foreground">Demo izle</h3>
        <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
          Sahte kullanıcılarla turu sadece senin ekranında oynatır. Kimseye ödül verilmez, sohbete duyuru düşmez, kayıt tutulmaz. Her basışta farklı bir tur
          çıkar.
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold">Kişi sayısı</span>
          <input
            type="number"
            min={2}
            max={MAX_PLAYERS}
            value={count}
            onChange={(e) => setCount(Math.min(MAX_PLAYERS, Math.max(2, Number(e.target.value) || 2)))}
            className="w-28 rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
        <div className="flex flex-wrap gap-1.5">
          {[2, 10, 40, 150, 500].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setCount(n)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${count === n ? 'border-gold bg-gold/15 text-foreground' : 'border-border text-muted-foreground'}`}
            >
              {n}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input type="checkbox" checked={compact} onChange={(e) => setCompact(e.target.checked)} className="size-4 accent-primary" />
          Masadaki görünüm (köşede küçük)
        </label>
        <button
          type="button"
          onClick={() => setRound(makeDemoRound(count, title || 'Jako Çemberi', prize))}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          <MonitorPlay className="size-4" aria-hidden />
          Demoyu başlat
        </button>
      </div>
      {round && (
        <CemberStage key={round.seed} slot={round.slot} status={null} meId="demo-0" compact={compact} demo={round} onDone={() => setRound(null)} />
      )}
    </section>
  )
}
