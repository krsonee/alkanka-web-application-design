'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { MarketProduct } from '@/lib/market'

const fmt = (n: number) => n.toLocaleString('tr-TR')

function ProductCard({ p }: { p: MarketProduct }) {
  const soldOut = p.stock <= 0
  return (
    <Link
      href="/market"
      className="group relative isolate flex aspect-[4/5] flex-col justify-end overflow-hidden rounded-2xl border border-border bg-card"
    >
      {p.image && (
        <Image
          src={p.image}
          alt=""
          fill
          sizes="(min-width: 1024px) 280px, 50vw"
          className={cn('-z-10 object-cover transition-transform duration-500 group-hover:scale-105', soldOut && 'grayscale')}
        />
      )}
      <span aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-t from-background via-background/40 to-transparent" />
      <span
        className={cn(
          'absolute right-3 top-3 rounded-full bg-background/80 px-2.5 py-1 text-[11px] font-bold backdrop-blur',
          soldOut ? 'text-destructive' : 'text-foreground',
        )}
      >
        {soldOut ? 'Tükendi' : `Stok: ${p.stock}`}
      </span>
      <span className="flex flex-col gap-1 p-4">
        {(p.type || p.sponsorName) && (
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary">{p.kind === 'sponsor' ? p.sponsorName : p.type}</span>
        )}
        <span className="line-clamp-2 font-display text-base font-bold text-foreground">{p.name}</span>
        <span className="flex items-center gap-1.5 pt-1 font-display text-base font-bold text-foreground">
          <span aria-hidden="true" className="flex size-5 items-center justify-center rounded-full bg-primary text-[8px] font-black text-primary-foreground">
            KC
          </span>
          {fmt(p.price)}
          <span className="sr-only">Kanka Coin</span>
        </span>
      </span>
    </Link>
  )
}

export function MarketTabs({ products, count }: { products: MarketProduct[]; count: number }) {
  const own = products.filter((p) => p.kind !== 'sponsor')
  const sponsor = products.filter((p) => p.kind === 'sponsor')
  const [tab, setTab] = useState<'own' | 'sponsor'>(own.length ? 'own' : 'sponsor')
  const list = (tab === 'own' ? own : sponsor).slice(0, count)

  return (
    <div className="flex flex-col gap-4">
      {own.length > 0 && sponsor.length > 0 && (
        <div role="tablist" aria-label="Ürün türü" className="flex w-fit gap-1 rounded-xl border border-border bg-card p-1">
          {(
            [
              ['own', 'Alkanka ödülleri'],
              ['sponsor', 'Sponsor bonusları'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={cn(
                'h-9 rounded-lg px-4 text-sm font-semibold transition-colors',
                tab === key ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {list.map((p) => (
          <ProductCard key={p.id} p={p} />
        ))}
      </div>
    </div>
  )
}
