'use client'

import { useEffect, useRef } from 'react'
import { Bot, Crown, Eye, Hand } from 'lucide-react'
import { cn } from '@/lib/utils'
import { playSound } from '@/lib/sound'
import { cardName, isPapaz, type PapazEvent, type PapazView } from '@/lib/games/papaz'
import { BatakCard } from './batak-pvp'
import type { Remote } from './remote'

function eventText(e: PapazEvent, name: (i: number) => string, me: number) {
  const who = e.seat === me ? 'Sen' : name(e.seat)
  if (e.kind === 'pair' && e.pair) return `${who} eşledi: ${cardName(e.pair[0])} + ${cardName(e.pair[1])}`
  if (e.kind === 'draw') {
    const src = e.from === me ? 'senden' : `${name(e.from)} oyuncusundan`
    if (e.card && isPapaz(e.card)) return `${who} ${src} Maça Papaz'ı çekti!`
    return `${who} ${src} kart çekti${e.card ? ` (${cardName(e.card)})` : ''}`
  }
  if (e.kind === 'out') return `${who} kartlarını bitirdi, kurtuldu`
  if (e.kind === 'end') return `Papaz ${e.seat === me ? 'sende' : `${name(e.seat)} oyuncusunda`} kaldı`
  return 'Kartlar dağıtıldı, eşler yere atıldı'
}

function CardBack({ className, onClick, disabled, label }: { className?: string; onClick?: () => void; disabled?: boolean; label?: string }) {
  const Comp = onClick ? 'button' : 'div'
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      disabled={onClick ? disabled : undefined}
      aria-label={label}
      className={cn(
        'card-back relative shrink-0 rounded-md border border-gold/40 shadow-md transition-transform duration-150',
        onClick && !disabled && 'cursor-pointer hover:-translate-y-3 focus-visible:-translate-y-3 focus-visible:ring-2 focus-visible:ring-gold',
        className,
      )}
    />
  )
}

function SeatChip({ v, seat, name, active, me }: { v: PapazView; seat: number; name: string; active: boolean; me: boolean }) {
  const out = v.finished.includes(seat)
  const lost = v.loser === seat
  return (
    <div
      className={cn(
        'flex min-w-0 items-center gap-2 rounded-xl border bg-background/70 px-2.5 py-1.5 backdrop-blur-sm transition-colors',
        active ? 'border-gold shadow-[0_0_0_2px_hsl(var(--gold)/0.25)]' : 'border-border/60',
        out && 'opacity-60',
        lost && 'border-destructive',
      )}
    >
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold text-foreground">
        {v.bots.includes(seat) ? <Bot className="size-4" aria-hidden="true" /> : name.slice(0, 1).toUpperCase()}
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold text-foreground">{me ? 'Sen' : name}</p>
        <p className="text-[11px] leading-tight text-muted-foreground">
          {lost ? 'Papaz elinde kaldı' : out ? 'Kurtuldu' : `${v.handCounts[seat]} kart · ${v.pairCounts[seat]} eş`}
        </p>
      </div>
    </div>
  )
}

export function PapazPvp({ remote }: { remote: Remote<PapazView> }) {
  const v = remote.state
  const me = remote.spectator ? -1 : remote.seat
  const name = (i: number) => remote.names[i] || (v.bots.includes(i) ? `Bot ${i + 1}` : `Oyuncu ${i + 1}`)
  const ended = v.loser != null
  const myTurn = remote.myTurn && !ended && me >= 0
  const target = v.target
  const lastEvent = v.log[v.log.length - 1]

  const lastSeq = useRef(v.seq)
  useEffect(() => {
    if (v.seq === lastSeq.current) return
    const fresh = v.log.filter((e) => e.seq > lastSeq.current)
    lastSeq.current = v.seq
    if (fresh.some((e) => e.kind === 'end')) playSound(v.loser === me ? 'leave' : 'win')
    else if (fresh.some((e) => e.kind === 'pair')) playSound('coin')
    else if (fresh.some((e) => e.kind === 'draw')) playSound('turn')
  }, [v.seq, v.log, v.loser, me])

  const base = me >= 0 ? me : 0
  const others = Array.from({ length: v.seats - 1 }, (_, i) => (base + 1 + i) % v.seats)
  const mySeatShown = me >= 0
  const targetCount = target >= 0 ? v.handCounts[target] : 0
  const hand = [...v.hand].sort((a, b) => a.r - b.r || a.s - b.s)

  const status = ended
    ? `Oyun bitti. Papaz ${v.loser === me ? 'sende kaldı, kaybettin' : `${name(v.loser!)} oyuncusunda kaldı`}.`
    : myTurn
      ? `${name(target)} oyuncusunun kartlarından birini seç`
      : remote.spectator
        ? `${name(v.turn)} kart çekiyor`
        : `${name(v.turn)} oyuncusu ${target === me ? 'senden' : `${name(target)} oyuncusundan`} kart çekiyor`

  return (
    <div className="baize-table relative flex h-[calc(100dvh-8.75rem)] min-h-[25rem] flex-col overflow-hidden rounded-[1.4rem] p-3 sm:p-4 lg:h-[min(38rem,calc(100dvh-11rem))] lg:min-h-[30rem]">
      <div className="flex flex-wrap justify-center gap-2">
        {others.map((i) => (
          <SeatChip key={i} v={v} seat={i} name={name(i)} active={!ended && v.turn === i} me={false} />
        ))}
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3">
        <p
          className={cn(
            'rounded-full px-3 py-1 text-center text-xs font-semibold sm:text-sm',
            myTurn ? 'bg-gold text-gold-foreground' : 'bg-background/70 text-foreground',
          )}
          aria-live="polite"
        >
          {status}
        </p>

        {!ended && target >= 0 && (
          <div className="flex max-w-full items-end justify-center px-6" role="group" aria-label={`${name(target)} oyuncusunun kapalı kartları`}>
            {Array.from({ length: targetCount }, (_, i) => (
              <CardBack
                key={`${v.seq}-${i}`}
                className={cn('h-[4.4rem] w-[3.15rem] sm:h-[5.6rem] sm:w-16', i > 0 && (targetCount > 9 ? '-ml-8 sm:-ml-10' : '-ml-5 sm:-ml-7'))}
                onClick={myTurn ? () => remote.send({ type: 'draw', index: i }) : undefined}
                disabled={remote.busy}
                label={`${i + 1}. kapalı kartı çek`}
              />
            ))}
          </div>
        )}

        {ended && (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-gold/50 bg-background/85 px-5 py-4 text-center backdrop-blur">
            <Crown className="size-6 text-gold" aria-hidden="true" />
            <BatakCard card={{ s: 0, r: 13 }} size="sm" />
            <p className="text-sm font-semibold text-foreground">{v.loser === me ? 'Papaz sende kaldı kanka' : `${name(v.loser!)} kaybetti`}</p>
            <p className="text-xs text-muted-foreground">Diğer herkes kazandı</p>
          </div>
        )}

        {lastEvent && !ended && (
          <p className="max-w-md text-pretty text-center text-xs text-foreground/80">{eventText(lastEvent, name, me)}</p>
        )}
      </div>

      {mySeatShown ? (
        <div className="flex flex-col items-center gap-2">
          <div className="flex max-w-full items-end justify-center overflow-x-auto px-6 pb-1 pt-4">
            {hand.length ? (
              hand.map((c, i) => (
                <div key={`${c.s}-${c.r}`} className={cn('relative', i > 0 && (hand.length > 10 ? '-ml-7 sm:-ml-8' : '-ml-4 sm:-ml-5'))}>
                  <BatakCard card={c} size="sm" className={cn(isPapaz(c) && 'ring-2 ring-destructive')} />
                  {isPapaz(c) && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground">
                      Papaz
                    </span>
                  )}
                </div>
              ))
            ) : (
              <p className="flex items-center gap-1.5 text-sm text-foreground/80">
                <Hand className="size-4" aria-hidden="true" />
                Kartların bitti, kurtuldun
              </p>
            )}
          </div>
          <SeatChip v={v} seat={me} name={name(me)} active={myTurn} me />
        </div>
      ) : (
        <p className="flex items-center justify-center gap-1.5 text-xs text-foreground/70">
          <Eye className="size-3.5" aria-hidden="true" />
          İzleyici modundasın
        </p>
      )}
    </div>
  )
}
