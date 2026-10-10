'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { jakoSrc, type JakoPose } from '../jako'

const GAME_CARDS: { href: string; title: string; text: string; pose: JakoPose; limit: string }[] = [
  { href: '/oyunlar/cark', title: 'Şans Çarkı', text: 'Günde 1 ücretsiz çevirme. 25 ile 1.000 Kanka Coin arası ödül.', pose: 'kazandi', limit: 'Günde 1 hak' },
  { href: '/oyunlar/zar', title: 'Kanka Zarı', text: 'İki zar at, çift gelirse katlanır. 6-6 jackpot.', pose: 'zar', limit: 'Günde 3 hak' },
  { href: '/oyunlar/sandik', title: 'Gizemli Sandık', text: 'Bronz, gümüş, altın. Kapağı aç, içinden ne çıkacak?', pose: 'sandik', limit: '6 saatte 1' },
]

export function GamesHub() {
  return (
    <ul className="grid gap-4 md:grid-cols-3">
      {GAME_CARDS.map((g) => (
        <li key={g.href}>
          <Link
            href={g.href}
            className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-primary"
          >
            <div className="relative aspect-square bg-secondary">
              <Image
                src={jakoSrc(g.pose) || '/placeholder.svg'}
                alt=""
                fill
                sizes="(min-width: 768px) 33vw, 100vw"
                className="object-contain p-6 transition-transform duration-300 group-hover:scale-105"
              />
              <span className="absolute left-3 top-3 rounded-md bg-background/90 px-2 py-1 text-xs font-bold uppercase tracking-wider text-primary">
                {g.limit}
              </span>
            </div>
            <div className="flex flex-1 flex-col gap-2 p-5">
              <h2 className="font-display text-xl font-bold uppercase text-foreground">{g.title}</h2>
              <p className="flex-1 text-sm leading-relaxed text-muted-foreground">{g.text}</p>
              <span className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-primary">
                Oyna
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" aria-hidden="true" />
              </span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  )
}
