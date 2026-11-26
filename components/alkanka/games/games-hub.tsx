'use client'

import type { CSSProperties } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Clock, Trophy, Users } from 'lucide-react'
import { ARENA_GAMES, ARENA_META, botMatchFactor, posterCover, type ArenaGame, type ArenaSettings } from '@/lib/arena'
import type { MiniGame } from '@/app/actions/wallet'
import { cn } from '@/lib/utils'
import { formatRemaining, useMiniLock } from './mini-status'

function MiniCard({ game, title, text, image, limit, index }: (typeof GAME_CARDS)[number] & { index: number }) {
  const { remaining, locked, left } = useMiniLock(game)
  return (
    <li>
      <Link
        href={`/oyunlar/${game}`}
        data-ready={!locked}
        style={{ '--i': index } as CSSProperties}
        className="mini-card group flex h-full items-stretch overflow-hidden rounded-2xl border border-border bg-card transition-[border-color,transform] duration-300 hover:-translate-y-0.5 hover:border-primary/60 focus-visible:outline-2 focus-visible:outline-primary max-sm:relative max-sm:isolate max-sm:aspect-square max-sm:items-end max-sm:border-foreground/10 max-sm:active:scale-[0.97] sm:flex-col"
      >
        <div className="relative w-32 shrink-0 overflow-hidden bg-background max-sm:absolute max-sm:inset-0 max-sm:-z-20 max-sm:w-full sm:aspect-[16/10] sm:w-full">
          <div className="mini-jako absolute inset-0">
            <Image
              src={image || '/placeholder.svg'}
              alt=""
              fill
              sizes="(min-width: 640px) 33vw, 160px"
              className="object-cover transition-transform duration-500 group-hover:scale-110"
            />
          </div>
          <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-foreground/10 max-sm:hidden" aria-hidden="true" />
        </div>
        <span aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-t from-background via-background/50 to-transparent sm:hidden" />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-3 max-sm:p-2.5 sm:p-4">
          <span className="w-fit rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary max-sm:hidden">
            {limit}
          </span>
          <h3 className="font-display text-lg font-bold uppercase leading-tight text-foreground max-sm:text-[13px] max-sm:normal-case max-sm:text-balance">{title}</h3>
          <p className="line-clamp-2 flex-1 text-xs leading-relaxed text-muted-foreground max-sm:hidden">{text}</p>
          <div className="flex items-center justify-between gap-3 pt-1 max-sm:absolute max-sm:left-2 max-sm:top-2 max-sm:rounded-full max-sm:bg-background/85 max-sm:px-2 max-sm:py-1 max-sm:pt-1">
            {locked ? (
              <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground max-sm:gap-1 max-sm:text-[11px]">
                <Clock className="size-3.5 shrink-0 text-primary max-sm:size-3" aria-hidden="true" />
                <span className="truncate">
                  <span className="max-sm:sr-only">Yeni hak: </span>
                  <span className="font-bold tabular-nums text-foreground">{formatRemaining(remaining)}</span>
                </span>
              </span>
            ) : (
              <span className="flex items-center gap-2 text-xs font-bold text-primary max-sm:gap-1.5 max-sm:text-[11px]">
                <span className="mini-dot size-2 rounded-full bg-primary max-sm:size-1.5" aria-hidden="true" />
                <span className="max-sm:hidden">{left !== null && left > 1 ? `${left} hakkın var` : 'Hakkın hazır'}</span>
                <span className="sm:hidden">{left !== null && left > 1 ? `${left} hak` : 'Hazır'}</span>
              </span>
            )}
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary-foreground transition-transform group-hover:scale-105 max-sm:hidden">
              {locked ? 'Göz at' : 'Oyna'}
              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </span>
          </div>
        </div>
      </Link>
    </li>
  )
}

const GAME_CARDS: { game: MiniGame; title: string; text: string; image: string; limit: string }[] = [
  { game: 'cark', title: 'Şans Çarkı', text: 'Her 6 saatte 1 ücretsiz çevirme. Kanka Coin, boost ve promo kod kazan.', image: '/images/games/mini-cark.png', limit: '6 saatte 1' },
  { game: 'sandik', title: 'Gizemli Sandık', text: 'Günde 1 sandık. Bronz, gümüş, altın: kapağı aç, içinden ne çıkacak?', image: '/images/games/mini-sandik.png', limit: 'Günde 1' },
  { game: 'zar', title: 'Zar At', text: 'Günde 3 atış. Çift gelirse kazancın katlanır, düşeş jackpotu açar.', image: '/images/games/mini-zar.png', limit: 'Günde 3' },
]

const SHORT_PLAYERS: Record<ArenaGame, string> = {
  tavla: '1v1',
  okey: '4 kişi',
  okey101: '2-4',
  batak: '4 kişi',
  pisti: '2-4',
  papaz: '2-6',
  monopoly: '2-8',
  bilardo: '1v1',
  blackjack: 'Krupiye',
  rulet: 'Masa',
  'kafa-topu': '1v1',
  'kafa-basketbolu': '1v1',
}

export function GamesHub({ arena, hiddenMini = [] }: { arena: ArenaSettings; hiddenMini?: string[] }) {
  const tables = ARENA_GAMES.filter((g) => arena[g].enabled)
  const minis = GAME_CARDS.filter((c) => !hiddenMini.includes(c.game))
  // Phones: with an odd number of games the first one takes the full row, so the two-column grid ends even.
  const lead = tables.length % 2 === 1
  return (
    <div className="flex flex-col gap-10 max-sm:gap-8">
      {tables.length > 0 && (
        <section aria-labelledby="masa-oyunlari" className="flex flex-col gap-4 max-sm:gap-3">
          <div className="flex flex-wrap items-end justify-between gap-3 max-sm:flex-nowrap max-sm:items-center">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary max-sm:hidden">Kanka Coin ile oyna</span>
              <h2 id="masa-oyunlari" className="font-display text-2xl font-bold uppercase text-foreground text-balance max-sm:text-xl max-sm:normal-case">
                Masa oyunları
              </h2>
            </div>
            <Link href="/turnuvalar" className="flex items-center gap-2 rounded-lg border border-primary/50 px-4 py-2 text-sm font-bold text-primary hover:bg-primary/10 max-sm:h-11 max-sm:shrink-0 max-sm:px-3 max-sm:text-xs">
              <Trophy className="size-4" aria-hidden="true" />
              <span className="max-sm:hidden">Turnuvalara göz at</span>
              <span className="sm:hidden">Turnuvalar</span>
            </Link>
          </div>
          <ul className="grid grid-cols-2 gap-3 max-sm:gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {tables.map((g, index) => {
              const meta = ARENA_META[g]
              const s = arena[g]
              const poster = posterCover(s)
              // A poster keeps the 4:3 shape it was drawn in, so it never becomes the wide lead card.
              const wide = lead && index === 0 && !poster
              const factor = botMatchFactor(g, s) ?? 0
              return (
                <li key={g} className={cn(wide && 'max-sm:col-span-2')}>
                  <Link
                    href={`/oyunlar/${g}`}
                    className={cn(
                      'group relative flex aspect-[4/3] flex-col justify-end overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-primary max-sm:rounded-2xl max-sm:border-foreground/10 max-sm:transition-[scale] max-sm:active:scale-[0.98]',
                      wide && 'max-sm:aspect-[2/1]',
                    )}
                  >
                    <Image src={s.image || meta.image || '/placeholder.svg'} alt="" fill sizes="(min-width: 1280px) 20vw, (min-width: 640px) 33vw, 50vw" className="object-cover transition-transform duration-500 group-hover:scale-105" />
                    {!poster && <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />}
                    {/* A poster has its logo in the top left corner, so both tags move to the right. */}
                    <span className={cn('absolute top-2 flex items-center gap-1.5', poster ? 'right-2' : 'inset-x-2 justify-between')}>
                      <span className="flex items-center gap-1 whitespace-nowrap rounded bg-background/90 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                        <Users className="size-3" aria-hidden="true" />
                        {SHORT_PLAYERS[g]}
                      </span>
                      {factor > 1 && <span className="rounded bg-primary px-1.5 py-0.5 font-display text-xs font-bold text-primary-foreground">x{factor.toLocaleString('tr-TR')}</span>}
                    </span>
                    <div className={cn('relative flex flex-col gap-1 p-3', poster && 'sr-only')}>
                      <h3 className={cn('font-display text-lg font-bold uppercase leading-tight text-foreground max-sm:normal-case', wide ? 'max-sm:text-2xl' : 'max-sm:text-base')}>{meta.title}</h3>
                      <span className={cn('flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-primary max-sm:text-xs max-sm:normal-case max-sm:tracking-normal', !wide && 'max-sm:hidden')}>
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

      <section aria-labelledby="mini-oyunlar" className="flex flex-col gap-4 max-sm:gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary max-sm:hidden">Ücretsiz</span>
          <h2 id="mini-oyunlar" className="font-display text-2xl font-bold uppercase text-foreground max-sm:text-xl max-sm:normal-case">
            Mini oyunlar
          </h2>
        </div>
            <ul className="grid grid-cols-1 gap-3 max-sm:grid-cols-3 max-sm:gap-2.5 sm:grid-cols-3">
              {minis.map((g, i) => (
                <MiniCard key={g.game} {...g} index={i} />
          ))}
        </ul>
      </section>
    </div>
  )
}
