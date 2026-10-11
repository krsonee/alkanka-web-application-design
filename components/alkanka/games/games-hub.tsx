'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Clock, Coins, Trophy, Users } from 'lucide-react'
import { ARENA_GAMES, ARENA_META, type ArenaSettings } from '@/lib/arena'
import { formatAC } from '../points-context'
import { jakoSrc, type JakoPose } from '../jako'
import type { MiniGame } from '@/app/actions/wallet'
import { formatRemaining, useMiniLock } from './mini-status'

function MiniCard({ game, title, text, pose, limit }: (typeof GAME_CARDS)[number]) {
  const { remaining, locked } = useMiniLock(game)
  return (
    <li>
      <Link
        href={`/oyunlar/${game}`}
        className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-primary"
      >
        <div className="relative aspect-[16/10] overflow-hidden bg-background">
          <Image
            src={jakoSrc(pose) || '/placeholder.svg'}
            alt=""
            fill
            sizes="(min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" />
          <span className="absolute left-3 top-3 rounded-md bg-background/90 px-2 py-1 text-xs font-bold uppercase tracking-wider text-primary">
            {limit}
          </span>
        </div>
        <div className="flex flex-1 flex-col gap-2 p-5">
          <h3 className="font-display text-xl font-bold uppercase text-foreground">{title}</h3>
          <p className="flex-1 text-sm leading-relaxed text-muted-foreground">{text}</p>
          <div className="flex items-center justify-between gap-3 pt-1">
            {locked ? (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="size-3.5 text-primary" aria-hidden="true" />
                Yeni hak: <span className="font-bold tabular-nums text-foreground">{formatRemaining(remaining)}</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-xs font-bold text-primary">
                <span className="size-2 rounded-full bg-primary" aria-hidden="true" />
                Hakkın hazır
              </span>
            )}
            <span className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-primary">
              {locked ? 'Göz at' : 'Oyna'}
              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" aria-hidden="true" />
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
]

export function GamesHub({ arena }: { arena: ArenaSettings }) {
  const tables = ARENA_GAMES.filter((g) => arena[g].enabled)
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
          <ul className="grid gap-4 md:grid-cols-3">
            {tables.map((g) => {
              const meta = ARENA_META[g]
              const s = arena[g]
              return (
                <li key={g}>
                  <Link
                    href={`/oyunlar/${g}`}
                    className="group relative flex aspect-[4/5] flex-col justify-end overflow-hidden rounded-2xl border border-border bg-card transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    <Image src={meta.image || '/placeholder.svg'} alt="" fill sizes="(min-width: 768px) 33vw, 100vw" className="object-cover transition-transform duration-500 group-hover:scale-105" />
                    <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-transparent" />
                    <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-md bg-background/90 px-2 py-1 text-xs font-bold uppercase tracking-wider text-primary">
                      <Users className="size-3.5" aria-hidden="true" />
                      {meta.players}
                    </span>
                    <span className="absolute right-3 top-3 rounded-md bg-primary px-2 py-1 font-display text-sm font-bold text-primary-foreground">x{s.multiplier}</span>
                    <div className="relative flex flex-col gap-2 p-5">
                      <h3 className="font-display text-3xl font-bold uppercase text-foreground">{meta.title}</h3>
                      <p className="text-sm leading-relaxed text-muted-foreground">{meta.short}</p>
                      <div className="flex items-center justify-between pt-1">
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Coins className="size-3.5 text-primary" aria-hidden="true" />
                          {formatAC(s.bets[0])} - {formatAC(s.bets[s.bets.length - 1])} KC
                        </span>
                        <span className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-primary">
                          Masaya otur
                          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                        </span>
                      </div>
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
        <ul className="grid gap-4 sm:grid-cols-2">
          {GAME_CARDS.map((g) => (
            <MiniCard key={g.game} {...g} />
          ))}
        </ul>
      </section>
    </div>
  )
}
