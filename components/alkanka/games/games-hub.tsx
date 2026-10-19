'use client'

import type { CSSProperties } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Clock, Trophy, Users } from 'lucide-react'
import { ARENA_GAMES, ARENA_META, type ArenaGame, type ArenaSettings } from '@/lib/arena'
import { jakoSrc, type JakoPose } from '../jako'
import type { MiniGame } from '@/app/actions/wallet'
import { formatRemaining, useMiniLock } from './mini-status'

function MiniCard({ game, title, text, pose, limit, index }: (typeof GAME_CARDS)[number] & { index: number }) {
  const { remaining, locked } = useMiniLock(game)
  return (
    <li>
      <Link
        href={`/oyunlar/${game}`}
        data-ready={!locked}
        style={{ '--i': index } as CSSProperties}
        className="mini-card group flex h-full items-stretch overflow-hidden rounded-2xl border border-border bg-card transition-[border-color,transform] duration-300 hover:-translate-y-0.5 hover:border-primary/60 focus-visible:outline-2 focus-visible:outline-primary sm:flex-col"
      >
        <div className="relative flex w-28 shrink-0 items-center justify-center overflow-hidden bg-background sm:aspect-[16/10] sm:w-full">
          <div className="mini-jako absolute -inset-2">
            <Image
              src={jakoSrc(pose) || '/placeholder.svg'}
              alt=""
              fill
              sizes="(min-width: 640px) 33vw, 128px"
              className="object-cover transition-transform duration-500 group-hover:scale-110"
            />
          </div>
          <div
            className="mini-halo pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_60%,color-mix(in_oklab,var(--primary)_28%,transparent),transparent_65%)] mix-blend-screen"
            aria-hidden="true"
          />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-card to-transparent sm:inset-x-0 sm:inset-y-auto sm:bottom-0 sm:h-10 sm:w-auto sm:bg-gradient-to-t" aria-hidden="true" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-3 sm:p-4">
          <span className="w-fit rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
            {limit}
          </span>
          <h3 className="font-display text-lg font-bold uppercase leading-tight text-foreground">{title}</h3>
          <p className="line-clamp-2 flex-1 text-xs leading-relaxed text-muted-foreground">{text}</p>
          <div className="flex items-center justify-between gap-3 pt-1">
            {locked ? (
              <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
                <span className="truncate">
                  Yeni hak: <span className="font-bold tabular-nums text-foreground">{formatRemaining(remaining)}</span>
                </span>
              </span>
            ) : (
              <span className="flex items-center gap-2 text-xs font-bold text-primary">
                <span className="mini-dot size-2 rounded-full bg-primary" aria-hidden="true" />
                Hakkın hazır
              </span>
            )}
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary-foreground transition-transform group-hover:scale-105">
              {locked ? 'Göz at' : 'Oyna'}
              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </span>
          </div>
        </div>
      </Link>
    </li>
  )
}

const GAME_CARDS: { game: MiniGame; title: string; text: string; pose: JakoPose; limit: string }[] = [
  { game: 'cark', title: 'Şans Çarkı', text: 'Her 6 saatte 1 ücretsiz çevirme. Kanka Coin, boost ve promo kod kazan.', pose: 'kazandi', limit: '6 saatte 1' },
  { game: 'sandik', title: 'Gizemli Sandık', text: 'Günde 1 sandık. Bronz, gümüş, altın: kapağı aç, içinden ne çıkacak?', pose: 'sandik', limit: 'Günde 1' },
  { game: 'zar', title: 'Zar At', text: 'Günde 3 atış. Çift gelirse kazancın katlanır, düşeş jackpotu açar.', pose: 'zar', limit: 'Günde 3' },
]

const SHORT_PLAYERS: Record<ArenaGame, string> = {
  tavla: '1v1',
  okey: '1v1 · 4',
  okey101: '2-4',
  batak: '4 kişi',
  pisti: '2-4',
  papaz: '2-6',
  monopoly: '2-4',
  bilardo: '1v1',
  blackjack: 'Krupiye',
  rulet: 'Masa',
  'kafa-topu': '1v1',
  'kafa-basketbolu': '1v1',
}

export function GamesHub({ arena, hiddenMini = [] }: { arena: ArenaSettings; hiddenMini?: string[] }) {
  const tables = ARENA_GAMES.filter((g) => arena[g].enabled)
  const minis = GAME_CARDS.filter((c) => !hiddenMini.includes(c.game))
  return (
    <div className="flex flex-col gap-10">
      {tables.length > 0 && (
        <section aria-labelledby="masa-oyunlari" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Kanka Coin ile oyna</span>
              <h2 id="masa-oyunlari" className="font-display text-2xl font-bold uppercase text-foreground text-balance">
                Masa oyunları
              </h2>
            </div>
            <Link href="/turnuvalar" className="flex items-center gap-2 rounded-lg border border-primary/50 px-4 py-2 text-sm font-bold text-primary hover:bg-primary/10">
              <Trophy className="size-4" aria-hidden="true" />
              Turnuvalara göz at
            </Link>
          </div>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {tables.map((g) => {
              const meta = ARENA_META[g]
              const s = arena[g]
              return (
                <li key={g}>
                  <Link
                    href={`/oyunlar/${g}`}
                    className="group relative flex aspect-[4/3] flex-col justify-end overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    <Image src={s.image || meta.image || '/placeholder.svg'} alt="" fill sizes="(min-width: 1280px) 20vw, (min-width: 640px) 33vw, 50vw" className="object-cover transition-transform duration-500 group-hover:scale-105" />
                    <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
                    <span className="absolute left-2 top-2 flex items-center gap-1 whitespace-nowrap rounded bg-background/90 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                      <Users className="size-3" aria-hidden="true" />
                      {SHORT_PLAYERS[g]}
                    </span>
                    {s.multiplier > 1 && (
                      <span className="absolute right-2 top-2 rounded bg-primary px-1.5 py-0.5 font-display text-xs font-bold text-primary-foreground">x{s.multiplier}</span>
                    )}
                    <div className="relative flex flex-col gap-1 p-3">
                      <h3 className="font-display text-lg font-bold uppercase leading-tight text-foreground">{meta.title}</h3>
                      <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-primary">
                        Masaya otur
                        <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                      </span>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <section aria-labelledby="mini-oyunlar" className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Ücretsiz</span>
          <h2 id="mini-oyunlar" className="font-display text-2xl font-bold uppercase text-foreground">
            Mini oyunlar
          </h2>
        </div>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {minis.map((g, i) => (
                <MiniCard key={g.game} {...g} index={i} />
          ))}
        </ul>
      </section>
    </div>
  )
}
