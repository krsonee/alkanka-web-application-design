'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { Bell, Clock, Gift, ListChecks, Trophy, Users } from 'lucide-react'
import type { CemberGame } from '@/lib/cember-shared'
import { TELEGRAM_URL } from './data'
import { DetailButton, DetailModal } from './detail-modal'

export type ArenaEvent = {
  id: string
  title: string
  mode: string
  days: string
  hours: string
  prize: string | null
  winners: string
  maxPlayers: number
  conds: string[]
  next: number | null
}

export type ArenaGameCard = {
  game: CemberGame
  label: string
  image: string
  tagline: string
  field: string
  flow: string[]
  rules: string[]
  events: ArenaEvent[]
}

const TZ = 'Europe/Istanbul'
const dayKey = (t: number) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(t)
const clock = (t: number) => new Intl.DateTimeFormat('tr-TR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }).format(t)
const weekday = (t: number) => new Intl.DateTimeFormat('tr-TR', { timeZone: TZ, weekday: 'long' }).format(t)

function whenLabel(at: number, now: number) {
  if (dayKey(at) === dayKey(now)) return `Bugün ${clock(at)}`
  if (dayKey(at) === dayKey(now + 86400_000)) return `Yarın ${clock(at)}`
  return `${weekday(at)} ${clock(at)}`
}

function useNow() {
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    setNow(Date.now())
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  return now
}

function Countdown({ at, now }: { at: number; now: number | null }) {
  const total = now ? Math.max(0, Math.floor((at - now) / 1000)) : null
  const parts = [
    { v: total === null ? null : Math.floor(total / 86400), l: 'Gün' },
    { v: total === null ? null : Math.floor((total % 86400) / 3600), l: 'Saat' },
    { v: total === null ? null : Math.floor((total % 3600) / 60), l: 'Dk' },
    { v: total === null ? null : total % 60, l: 'Sn' },
  ]
  return (
    <div className="grid grid-cols-4 gap-1.5" role="timer" aria-label="Sıradaki tura kalan süre">
      {parts.map((p) => (
        <div key={p.l} className="flex flex-col items-center rounded-md bg-background py-1.5">
          <span className="font-display text-base font-bold tabular-nums text-foreground">
            {p.v === null ? '--' : String(p.v).padStart(2, '0')}
          </span>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{p.l}</span>
        </div>
      ))}
    </div>
  )
}

function soonest(events: ArenaEvent[]) {
  return events.reduce<ArenaEvent | null>((best, e) => (e.next !== null && (!best || e.next < (best.next ?? Infinity)) ? e : best), null)
}

function EventLine({ e }: { e: ArenaEvent }) {
  return (
    <li className="flex flex-col gap-1.5 border-t border-border/70 pt-3 first:border-t-0 first:pt-0">
      <div className="flex items-baseline justify-between gap-2">
        <h4 className="truncate text-sm font-bold text-foreground">{e.title}</h4>
        <span className="shrink-0 text-[11px] font-semibold text-primary">{e.mode}</span>
      </div>
      <p className="flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
        <Clock className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        <span>
          <span className="font-semibold text-foreground">{e.days}</span> · {e.hours}
        </span>
      </p>
      {e.prize && (
        <p className="flex items-start gap-1.5 text-xs leading-relaxed">
          <Gift className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden="true" />
          <span className="font-semibold text-primary">{e.prize}</span>
        </p>
      )}
      <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Trophy className="size-3.5" aria-hidden="true" />
          {e.winners}
        </span>
        <span className="flex items-center gap-1">
          <Users className="size-3.5" aria-hidden="true" />
          En fazla {e.maxPlayers}
        </span>
      </p>
      {e.conds.length > 0 && (
        <p className="flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
          <ListChecks className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span>Şart: {e.conds.join(' · ')}</span>
        </p>
      )}
    </li>
  )
}

export function ArenaCards({ cards, notice }: { cards: ArenaGameCard[]; notice: number }) {
  const now = useNow()
  const [detail, setDetail] = useState<ArenaGameCard | null>(null)
  const detailNext = detail ? soonest(detail.events) : null

  return (
    <>
      <ul aria-label="Canlı arena oyunları" className="grid gap-3 md:grid-cols-3">
        {cards.map((c) => {
          const next = soonest(c.events)
          return (
            <li key={c.game}>
              <article className="panel-gold flex h-full flex-col overflow-hidden rounded-xl">
                <div className="relative h-36 overflow-hidden">
                  <Image src={c.image} alt="" fill sizes="(min-width: 768px) 30vw, 100vw" className="object-cover" />
                  <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
                  <span className="absolute top-2 left-2 flex items-center gap-1.5 rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
                    <span aria-hidden="true" className="size-1.5 animate-pulse rounded-full bg-primary-foreground" />
                    Canlı arena
                  </span>
                  <span className="absolute top-2 right-2 rounded bg-background/85 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-foreground">
                    {c.events.length > 0 ? `${c.events.length} etkinlik` : 'Yakında'}
                  </span>
                </div>

                <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
                  <div className="flex flex-col">
                    <h3 className="font-display text-lg font-bold text-foreground">{c.label}</h3>
                    <p className="text-sm text-pretty text-muted-foreground">{c.tagline}</p>
                  </div>

                  {next?.next ? (
                    <div className="flex flex-col gap-1.5">
                      <p className="flex items-center justify-between text-xs">
                        <span className="font-semibold uppercase tracking-wider text-muted-foreground">Sıradaki tur</span>
                        <span className="font-bold capitalize text-primary">{now ? whenLabel(next.next, now) : clock(next.next)}</span>
                      </p>
                      <Countdown at={next.next} now={now} />
                    </div>
                  ) : (
                    <p className="rounded-md bg-background px-3 py-2.5 text-xs text-muted-foreground">
                      Planlı tur yok. Yeni saatler Telegram kanalında duyurulur.
                    </p>
                  )}

                  {c.events.length > 0 && (
                    <div className="flex flex-col gap-2">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Saatler ve ödüller</h4>
                      <ul className="flex flex-col gap-3 rounded-lg bg-background p-3">
                        {c.events.slice(0, 3).map((e) => (
                          <EventLine key={e.id} e={e} />
                        ))}
                      </ul>
                      {c.events.length > 3 && (
                        <button
                          type="button"
                          onClick={() => setDetail(c)}
                          className="self-start text-xs font-bold text-primary underline-offset-2 hover:underline"
                        >
                          +{c.events.length - 3} tur daha, tüm programı gör
                        </button>
                      )}
                    </div>
                  )}

                  <div className="mt-auto flex items-stretch gap-2">
                    <DetailButton onClick={() => setDetail(c)} label="Kurallar" />
                    <a
                      href={TELEGRAM_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-8 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-primary px-3 text-xs font-bold uppercase tracking-wider text-primary-foreground transition-opacity hover:opacity-90"
                    >
                      <Bell className="size-3.5" aria-hidden="true" />
                      Hatırlat
                    </a>
                  </div>
                </div>
              </article>
            </li>
          )
        })}
      </ul>

      <DetailModal
        onClose={() => setDetail(null)}
        content={
          detail && {
            eyebrow: 'Canlı arena oyunu',
            title: detail.label,
            image: detail.image,
            description: detail.field,
            facts: [
              { label: 'Sıradaki tur', value: detailNext?.next && now ? whenLabel(detailNext.next, now) : 'Planlı değil' },
              { label: 'Etkinlik', value: detail.events.length ? `${detail.events.length} aktif` : 'Yakında' },
              { label: 'Katılım', value: 'Ücretsiz · şartı tamamla' },
              { label: 'Bildirim', value: `Turdan ${notice} dk önce` },
            ],
            steps: detail.flow,
            table: detail.events.length
              ? {
                  title: 'Tur programı',
                  rows: detail.events.map((e) => ({
                    label: e.title,
                    sub: `${e.days} · ${e.hours}`,
                    value: [e.prize, e.winners].filter(Boolean).join(' · '),
                  })),
                }
              : undefined,
            rules: detail.rules,
            note: 'Turu sen yönetmezsin, fizik belirler. Tur saatinde sitede ol, ekrana gelen turu izle.',
          }
        }
      />
    </>
  )
}
