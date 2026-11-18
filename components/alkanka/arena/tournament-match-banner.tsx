'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Trophy } from 'lucide-react'
import { ARENA_META, type ArenaGame } from '@/lib/arena'
import { matchHref, type MyMatch } from '@/lib/tournaments-shared'
import { usePoints } from '../points-context'
import { Countdown, useSecondsLeft } from './tournament-countdown'

const ENTER = 'shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:brightness-110'

function MatchRow({ m, children }: { m: MyMatch; children: ReactNode }) {
  const game = ARENA_META[m.game as ArenaGame]?.title ?? m.game
  const left = useSecondsLeft(m.joinBy)
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-xl bg-background/60 px-3 py-2">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <Trophy className="size-4" aria-hidden="true" />
      </span>
      <span className="flex min-w-0 flex-1 basis-48 flex-col">
        <span className="font-display text-sm font-bold text-foreground">{m.seated ? 'Turnuva maçın sürüyor' : 'Turnuva maçın hazır'}</span>
        <span className="text-pretty text-xs leading-relaxed text-muted-foreground">
          {game} · {m.title} · {m.round}.{' '}
          {m.seated
            ? 'Masadan uzun süre ayrı kalırsan hamle süren dolar.'
            : left == null
              ? 'Masada bahis yok.'
              : left > 0
                ? m.shared
                  ? 'Süre dolmadan masaya girmezsen elenirsin, masa sensiz oynanır.'
                  : 'Süre dolmadan masaya girmezsen maçı hükmen kaybedersin.'
                : 'Giriş süresi doldu. Sonuç henüz yazılmadıysa hemen girersen maça alınırsın.'}
        </span>
      </span>
      {left != null && left > 0 && <Countdown seconds={left} label="Masaya girmek için kalan süre" className="font-mono text-lg font-bold tabular-nums text-primary" />}
      {children}
    </li>
  )
}

function Strip({ children }: { children: ReactNode }) {
  return (
    <section aria-label="Turnuva maçın" aria-live="polite" className="panel-gold rounded-2xl p-2 [body:has([data-table-playing])_&]:hidden">
      <ul className="flex flex-col gap-2">{children}</ul>
    </section>
  )
}

/** Above every page while a tournament table is waiting for the member; one tap opens that table. */
export function TournamentMatchBanner() {
  const { matches } = usePoints()
  const pathname = usePathname()
  // The game's own page shows `TournamentMatchCard`, which opens the table without leaving the page.
  const shown = matches.filter((m) => pathname !== `/oyunlar/${m.game}`)
  if (!shown.length) return null
  return (
    <Strip>
      {shown.map((m) => (
        <MatchRow key={m.tableId} m={m}>
          <Link href={matchHref(m)} className={ENTER}>
            Masaya gir
          </Link>
        </MatchRow>
      ))}
    </Strip>
  )
}

/** The same call on the game's own page, shown above the stake screen so nobody pays a stake to play a tournament match. */
export function TournamentMatchCard({ game, onEnter }: { game: ArenaGame; onEnter: (tableId: string) => void }) {
  const { matches } = usePoints()
  const shown = matches.filter((m) => m.game === game)
  if (!shown.length) return null
  return (
    <Strip>
      {shown.map((m) => (
        <MatchRow key={m.tableId} m={m}>
          <button type="button" onClick={() => onEnter(m.tableId)} className={ENTER}>
            Masaya gir
          </button>
        </MatchRow>
      ))}
    </Strip>
  )
}
