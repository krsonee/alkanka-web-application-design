'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { Coins, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { EVENTS, PREDICTIONS, type EventItem } from './data'
import { DetailButton, DetailModal } from './detail-modal'
import { JakoTip } from './jako'
import { TeamLogo } from './logo-context'
import { formatAC, usePoints } from './points-context'
import { SectionHeading } from './section-heading'
import { useTexts } from './texts-context'

function useNow() {
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    setNow(Date.now())
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  return now
}

function Countdown({ hoursLeft, start }: { hoursLeft: number; start: number | null }) {
  const now = useNow()
  const total = start && now ? Math.max(0, hoursLeft * 3600 - Math.floor((now - start) / 1000)) : hoursLeft * 3600
  const parts = [
    { v: Math.floor(total / 86400), l: 'Gün' },
    { v: Math.floor((total % 86400) / 3600), l: 'Saat' },
    { v: Math.floor((total % 3600) / 60), l: 'Dk' },
    { v: Math.floor(total % 60), l: 'Sn' },
  ]
  return (
    <div className="grid grid-cols-4 gap-1.5" role="timer" aria-label="Kalan süre">
      {parts.map((p) => (
        <div key={p.l} className="flex flex-col items-center rounded-md bg-background py-1.5">
          <span className="font-display text-base font-bold text-foreground tabular-nums">{String(p.v).padStart(2, '0')}</span>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{p.l}</span>
        </div>
      ))}
    </div>
  )
}

function EventCards() {
  const { spend } = usePoints()
  const t = useTexts()
  const [start] = useState(() => (typeof window === 'undefined' ? null : Date.now()))
  const [joined, setJoined] = useState<Record<string, boolean>>({})
  const [detail, setDetail] = useState<EventItem | null>(null)

  function join(id: string, entry: number) {
    if (joined[id]) return
    if (entry > 0 && !spend(entry)) return
    setJoined((j) => ({ ...j, [id]: true }))
  }

  return (
    <ul className="grid gap-3 md:grid-cols-3">
      {EVENTS.map((e) => (
        <li key={e.id} className="panel-gold flex flex-col overflow-hidden rounded-xl">
          <div className="relative h-28 overflow-hidden">
            <Image src={e.image || '/placeholder.svg'} alt="" fill sizes="(min-width: 768px) 30vw, 100vw" className="object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
            <span className="absolute top-2 left-2 rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
              {e.kind}
            </span>
          </div>
          <div className="flex flex-1 flex-col gap-3 p-4 pt-0">
            <div className="flex flex-col">
              <h3 className="font-display text-lg font-bold text-foreground">{t(`event.${e.id}.title`, e.title)}</h3>
              <p className="text-sm text-muted-foreground">{t(`event.${e.id}.subtitle`, e.subtitle)}</p>
            </div>
            <Countdown hoursLeft={e.hoursLeft} start={start} />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Users className="size-3.5" aria-hidden="true" />
                {formatAC(e.participants + (joined[e.id] ? 1 : 0))} katılımcı
              </span>
              <span className="text-primary">{t(`event.${e.id}.prize`, e.prize)}</span>
            </div>
            <DetailButton onClick={() => setDetail(e)} />
            <button
              type="button"
              onClick={() => join(e.id, e.entry)}
              disabled={joined[e.id]}
              className="mt-auto flex h-10 items-center justify-center gap-1.5 rounded-lg bg-primary text-xs font-bold uppercase tracking-wider text-primary-foreground transition-opacity hover:opacity-90 disabled:bg-primary/15 disabled:text-primary"
            >
              {joined[e.id] ? 'Katıldın' : e.entry === 0 ? 'Ücretsiz katıl' : (
                <>
                  <Coins className="size-3.5" aria-hidden="true" />
                  {e.entry} KC ile katıl
                </>
              )}
            </button>
          </div>
        </li>
      ))}
      <DetailModal
        onClose={() => setDetail(null)}
        content={
          detail && {
            eyebrow: `${detail.kind} etkinlik`,
            title: t(`event.${detail.id}.title`, detail.title),
            image: detail.image,
            description: detail.description,
            facts: [
              { label: 'Katılım', value: detail.entry === 0 ? 'Ücretsiz' : `${detail.entry} KC` },
              { label: 'Katılımcı', value: formatAC(detail.participants + (joined[detail.id] ? 1 : 0)) },
            ],
            steps: detail.steps,
            prizes: detail.prizes,
            rules: detail.rules,
          }
        }
        action={
          detail && (
            <button
              type="button"
              onClick={() => join(detail.id, detail.entry)}
              disabled={joined[detail.id]}
              className="flex h-11 items-center justify-center rounded-lg bg-primary text-xs font-bold uppercase tracking-wider text-primary-foreground disabled:bg-primary/15 disabled:text-primary"
            >
              {joined[detail.id] ? 'Katıldın' : detail.entry === 0 ? 'Ücretsiz katıl' : `${detail.entry} KC ile katıl`}
            </button>
          )
        }
      />
    </ul>
  )
}

function Predictions() {
  const { add } = usePoints()
  const [picks, setPicks] = useState<Record<string, string>>({})

  function pick(matchId: string, optionId: string, reward: number) {
    if (picks[matchId]) return
    setPicks((p) => ({ ...p, [matchId]: optionId }))
    add(Math.round(reward / 5))
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {PREDICTIONS.map((m) => {
        const picked = picks[m.id]
        const total = m.options.reduce((s, o) => s + o.votes, 0) + (picked ? 1 : 0)
        return (
          <article key={m.id} className="panel-gold flex flex-col gap-4 rounded-xl p-4">
            <header className="flex items-center justify-between text-xs">
              <span className="font-semibold uppercase tracking-wider text-primary">{m.league}</span>
              <span className="text-muted-foreground">{m.kickoff}</span>
            </header>
            <div className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 flex-1 items-center gap-2 font-display text-base font-bold text-foreground">
                <TeamLogo name={m.home} />
                <span className="truncate">{m.home}</span>
              </span>
              <span className="rounded bg-background px-2 py-1 text-xs font-bold text-muted-foreground">VS</span>
              <span className="flex min-w-0 flex-1 items-center justify-end gap-2 text-right font-display text-base font-bold text-foreground">
                <span className="truncate">{m.away}</span>
                <TeamLogo name={m.away} />
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2" role="group" aria-label={`${m.home} - ${m.away} tahmini`}>
              {m.options.map((o) => {
                const votes = o.votes + (picked === o.id ? 1 : 0)
                const pct = Math.round((votes / total) * 100)
                const isPicked = picked === o.id
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => pick(m.id, o.id, m.reward)}
                    disabled={!!picked}
                    aria-pressed={isPicked}
                    className={cn(
                      'relative flex flex-col items-center gap-0.5 overflow-hidden rounded-lg border py-2.5 text-xs transition-colors',
                      isPicked ? 'border-primary text-primary' : 'border-border text-foreground',
                      !picked && 'hover:border-primary/50',
                    )}
                  >
                    {picked && (
                      <span aria-hidden="true" className="absolute inset-y-0 left-0 bg-primary/10" style={{ width: `${pct}%` }} />
                    )}
                    <span className="relative font-semibold">{o.label}</span>
                    {picked && <span className="relative text-muted-foreground tabular-nums">%{pct}</span>}
                  </button>
                )
              })}
            </div>
            <p className="text-xs text-muted-foreground" aria-live="polite">
              {picked ? (
                <>
                  Tahminin kaydedildi. Doğru çıkarsa <span className="font-semibold text-primary">+{m.reward} KC</span>.
                </>
              ) : (
                <>
                  Doğru tahmin: <span className="font-semibold text-primary">+{m.reward} KC</span>. Katılım bonusu anında.
                </>
              )}
            </p>
          </article>
        )
      })}
    </div>
  )
}

export function Events({ view }: { view: 'biletler' | 'tahminler' }) {
  return (
    <section aria-label={view === 'biletler' ? 'Biletler' : 'Tahminler'} className="flex flex-col gap-5">
      {view === 'biletler' ? (
        <>
          <JakoTip pose="duyuru" title="Jako duyuruyor">
            Bilet çekilişi her pazar 21:00&apos;de canlı yayında! Ne kadar çok bilet, o kadar çok şans kanka.
          </JakoTip>
          <EventCards />
        </>
      ) : (
        <Predictions />
      )}
    </section>
  )
}
