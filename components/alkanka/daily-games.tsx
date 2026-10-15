'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import type { MiniGame } from '@/app/actions/wallet'
import { MiniCountdown, useMiniStatus } from './games/mini-status'

const GAMES: { game: MiniGame; title: string; text: string; image: string; reward: string }[] = [
  { game: 'cark', title: 'Şans Çarkı', text: '6 saatte bir ücretsiz çevir', image: '/images/tile-wheel.png', reward: '500 KC’ye kadar' },
  { game: 'zar', title: 'Zar At', text: 'Günde 3 atış, düşeş jackpot', image: '/images/tile-dice.png', reward: '400 KC’ye kadar' },
  { game: 'sandik', title: 'Gizemli Sandık', text: 'Her gün bir sandık aç', image: '/images/tile-chest.png', reward: '500 KC’ye kadar' },
]

export function DailyGames() {
  const { status } = useMiniStatus()
  const games = GAMES.filter((g) => !status?.hidden?.includes(g.game))
  if (!games.length) return null
  return (
    <section aria-labelledby="gunluk-oyunlar" className="flex flex-col gap-3">
      <div className="flex items-end justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary">Günlük haklar</span>
          <h2 id="gunluk-oyunlar" className="font-display text-lg font-bold text-foreground">
            Çark, zar ve sandık
          </h2>
        </div>
        <Link href="/oyunlar" className="text-xs font-semibold text-muted-foreground hover:text-foreground">
          Tüm oyunlar
        </Link>
      </div>
      <ul className="grid gap-3 sm:grid-cols-3">
        {games.map((g) => (
          <li key={g.game}>
            <Link
              href={`/oyunlar/${g.game}`}
              className="group flex items-center gap-3 rounded-xl border border-border bg-card p-2.5 transition-colors hover:border-primary/60 focus-visible:outline-2 focus-visible:outline-primary"
            >
              <span className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-background">
                <Image src={g.image || '/placeholder.svg'} alt="" fill sizes="64px" className="object-cover transition-transform duration-300 group-hover:scale-110" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-bold text-foreground">{g.title}</span>
                  <ArrowUpRight className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" aria-hidden="true" />
                </span>
                <span className="truncate text-xs text-muted-foreground">{g.text}</span>
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-[11px] font-semibold text-primary">{g.reward}</span>
                  <MiniCountdown game={g.game} readyLabel="Hazır" className="px-1.5 py-0.5 text-[10px]" />
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
