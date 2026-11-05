'use client'

import NextImage from 'next/image'
import useSWR from 'swr'
import { Lock, Play, Trophy, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getHeadRecord } from '@/app/actions/head-ball'
import { CHARACTERS, POWERS, type Sport, type Stats } from './engine'
import { BOT_OPTIONS, Segmented, charIndex, setPrefs, usePrefs } from './controls'

const STAT_LABELS: [keyof Stats, string][] = [
  ['speed', 'Hız'],
  ['jump', 'Zıplama'],
  ['shot', 'Şut'],
  ['head', 'Kafa'],
  ['power', 'Güç dolumu'],
]

function StatBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-20 shrink-0 text-xs font-semibold text-muted-foreground">{label}</span>
      <div className="flex flex-1 gap-1" aria-label={`${label} ${value} / 5`} role="img">
        {[1, 2, 3, 4, 5].map((i) => (
          <span key={i} className={cn('h-2 flex-1 rounded-full', i <= value ? 'bg-primary' : 'bg-muted')} />
        ))}
      </div>
    </div>
  )
}

/** Pre-match lineup: pick a head, see its stats and signature power, then kick off. */
export function CharacterSelect({ sport, onStart }: { sport: Sport; onStart: (ch: number) => void }) {
  const prefs = usePrefs()
  const { data: record } = useSWR('head-record', () => getHeadRecord(), { revalidateOnFocus: false })
  const trophies = record?.trophies ?? 0
  const selected = charIndex(prefs.char)
  const current = CHARACTERS[selected]
  const locked = (i: number) => CHARACTERS[i].unlock > trophies
  const canStart = !locked(selected)
  const power = POWERS[current.power]

  return (
    <section
      aria-label="Karakter seçimi"
      className="flex flex-col gap-4 rounded-2xl border border-primary/30 bg-card p-4 text-card-foreground shadow-xl md:p-6"
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col">
          <p className="text-xs font-bold uppercase tracking-widest text-primary">{sport === 'futbol' ? 'Kafa Topu' : 'Kafa Basketbolu'}</p>
          <h2 className="text-balance font-display text-2xl font-black uppercase tracking-tight">Kadronu seç kanka</h2>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-background/60 px-3 py-2">
          <Trophy className="size-5 text-primary" aria-hidden="true" />
          <div className="flex flex-col leading-tight">
            <span className="font-display text-lg font-black tabular-nums">{trophies}</span>
            <span className="text-[11px] font-semibold text-muted-foreground">
              {record ? `${record.wins}G ${record.draws}B ${record.losses}M` : 'Kupa'}
            </span>
          </div>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-[1fr_minmax(0,18rem)]">
        <ul className="grid content-start grid-cols-3 gap-2 sm:grid-cols-6 md:grid-cols-3">
          {CHARACTERS.map((c, i) => {
            const isLocked = locked(i)
            const active = i === selected
            return (
              <li key={c.id}>
                <button
                  type="button"
                  aria-pressed={active}
                  aria-label={isLocked ? `${c.name}, ${c.unlock} kupada açılır` : `${c.name}, ${c.title}`}
                  onClick={() => setPrefs({ char: c.id })}
                  className={cn(
                    'relative flex w-full flex-col items-center gap-1.5 rounded-xl border-2 bg-background/50 p-2 transition-all',
                    active ? 'border-primary shadow-[0_0_0_3px] shadow-primary/25' : 'border-border hover:border-primary/50',
                  )}
                >
                  <span className="relative block size-16 overflow-hidden rounded-full bg-muted sm:size-14 md:size-16 [@media(max-height:500px)]:size-10">
                    <NextImage
                      src={`${c.img}.webp`}
                      alt=""
                      fill
                      sizes="64px"
                      className={cn('object-cover', c.facesLeft || '-scale-x-100', isLocked && 'opacity-40 grayscale')}
                    />
                  </span>
                  <span className="text-sm font-black">{c.name}</span>
                  <span className="text-[11px] font-semibold text-muted-foreground">{c.title}</span>
                  {isLocked && (
                    <span className="absolute right-1.5 top-1.5 flex items-center gap-1 rounded-full bg-background/90 px-1.5 py-0.5 text-[10px] font-bold">
                      <Lock className="size-3" aria-hidden="true" />
                      {c.unlock}
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>

        <div className="flex flex-col gap-3 rounded-xl border border-border bg-background/50 p-4">
          <div className="flex items-center gap-3">
            <span className="relative block size-14 shrink-0 overflow-hidden rounded-full border-2 border-primary bg-muted">
              <NextImage src={`${current.img}.webp`} alt={`${current.name} portresi`} fill sizes="56px" className={cn('object-cover', current.facesLeft || '-scale-x-100')} />
            </span>
            <div className="flex flex-col">
              <p className="font-display text-xl font-black uppercase leading-none">{current.name}</p>
              <p className="text-xs font-semibold text-muted-foreground">{current.title}</p>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            {STAT_LABELS.map(([k, label]) => (
              <StatBar key={k} label={label} value={current.stats[k]} />
            ))}
          </div>
          <div className="flex gap-2 rounded-lg bg-muted/60 p-2.5">
            <Zap className="mt-0.5 size-4 shrink-0" style={{ color: power.color }} aria-hidden="true" />
            <div className="flex flex-col gap-0.5">
              <p className="text-sm font-black">{power.name}</p>
              <p className="text-pretty text-xs leading-relaxed text-muted-foreground">{power.desc}</p>
            </div>
          </div>
          <Segmented label="Bot seviyesi" value={prefs.bot} options={BOT_OPTIONS} onChange={(bot) => setPrefs({ bot })} />
          <button
            type="button"
            disabled={!canStart}
            onClick={() => onStart(selected)}
            className="sticky bottom-3 z-10 flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-display text-base font-black uppercase text-primary-foreground shadow-md transition-transform active:scale-95 disabled:opacity-50"
          >
            <Play className="size-4" aria-hidden="true" />
            {canStart ? 'Maça çık' : `${current.unlock} kupada açılır`}
          </button>
        </div>
      </div>
      <p className="text-pretty text-xs leading-relaxed text-muted-foreground">
        Her karakter aynı toplam güce sahip, sadece dağılımı farklı. Kupa kazandıkça yeni kafalar açılır. Güç barı topa dokundukça dolar; dolunca
        <kbd className="mx-1 rounded bg-muted px-1 font-mono">E</kbd>ya da şimşek tuşuyla süper gücünü patlat.
      </p>
    </section>
  )
}
