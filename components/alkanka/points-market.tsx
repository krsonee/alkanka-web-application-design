'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Check, Coins } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MARKET_ITEMS, type MarketItem } from './data'
import { DetailButton, DetailModal } from './detail-modal'
import { formatAC, usePoints } from './points-context'
import { SectionHeading } from './section-heading'

export function PointsMarket() {
  const { points, spend } = usePoints()
  const [stock, setStock] = useState(() => Object.fromEntries(MARKET_ITEMS.map((i) => [i.id, i.stock])))
  const [claimed, setClaimed] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [detail, setDetail] = useState<MarketItem | null>(null)

  function claim(id: string, price: number) {
    if (!stock[id]) return
    if (!spend(price)) {
      setError(id)
      setClaimed(null)
      return
    }
    setStock((s) => ({ ...s, [id]: s[id] - 1 }))
    setClaimed(id)
    setError(null)
  }

  return (
    <section id="market" aria-labelledby="market-title" className="flex scroll-mt-20 flex-col gap-5">
      <SectionHeading
        id="market-title"
        title="Puan Marketi"
        description="Rozet, ekstra hak ve hediyelik. Nakit yok. Topladığın Kanka Coin ile dilediğini al."
        action={
          <span className="flex items-center gap-2 self-start rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-sm sm:self-auto">
            <Coins className="size-4 text-primary" aria-hidden="true" />
            <span className="text-muted-foreground">Bakiyen</span>
            <span className="font-display font-bold text-foreground tabular-nums">{formatAC(points)}</span>
          </span>
        }
      />

      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-4">
        {MARKET_ITEMS.map((item) => {
          const left = stock[item.id]
          const soldOut = left === 0
          const affordable = points >= item.price
          return (
            <li key={item.id} className="panel-gold flex flex-col overflow-hidden rounded-xl">
              <div className="relative aspect-[4/3] overflow-hidden">
                <Image
                  src={item.image || '/placeholder.svg'}
                  alt=""
                  fill
                  sizes="(min-width: 1536px) 20vw, (min-width: 768px) 30vw, 50vw"
                  className={cn('object-cover', soldOut && 'grayscale opacity-50')}
                />
                <div className="absolute inset-x-0 top-0 flex flex-wrap gap-1 p-2">
                  <span className="rounded bg-background/85 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-foreground">
                    {item.type}
                  </span>
                  {item.refOnly && (
                    <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-accent-foreground">
                      REFERANS ÖZEL
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-1 flex-col gap-3 p-3">
                <div className="flex flex-col items-start gap-0.5">
                  <h3 className="text-sm font-semibold leading-snug text-foreground">{item.name}</h3>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    Stok: {left} / {item.total}
                  </span>
                  <DetailButton onClick={() => setDetail(item)} />
                </div>
                <div className="mt-auto flex items-center gap-1.5">
                  <Coins className="size-4 text-primary" aria-hidden="true" />
                  <span className="font-display text-lg font-bold text-foreground tabular-nums">{formatAC(item.price)}</span>
                  <span className="text-xs text-muted-foreground">KC</span>
                </div>
                <button
                  type="button"
                  disabled={soldOut}
                  onClick={() => claim(item.id, item.price)}
                  className={cn(
                    'flex h-9 items-center justify-center gap-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-opacity',
                    soldOut
                      ? 'cursor-not-allowed bg-secondary text-muted-foreground'
                      : affordable
                        ? 'bg-primary text-primary-foreground hover:opacity-90'
                        : 'border border-primary/40 text-primary hover:bg-primary/10',
                  )}
                >
                  {claimed === item.id && <Check className="size-3.5" aria-hidden="true" />}
                  {soldOut ? 'Tükendi' : claimed === item.id ? 'Alındı' : 'Talep et'}
                </button>
                <p aria-live="polite" className="min-h-4 text-center text-xs text-destructive">
                  {error === item.id ? `${formatAC(item.price - points)} KC eksik — oyunlardan topla` : ''}
                </p>
              </div>
            </li>
          )
        })}
      </ul>

      <DetailModal
        onClose={() => setDetail(null)}
        content={
          detail && {
            eyebrow: detail.type,
            title: detail.name,
            image: detail.image,
            description: detail.description,
            facts: [
              { label: 'Fiyat', value: `${formatAC(detail.price)} KC` },
              { label: 'Stok', value: `${stock[detail.id]} / ${detail.total}` },
              { label: 'Limit', value: `Kişi başı ${detail.limit}` },
              { label: 'Teslimat', value: detail.refOnly ? 'Referans özel' : 'Anında' },
            ],
            rules: detail.rules,
            note: detail.delivery,
          }
        }
        action={
          detail && (
            <div className="flex flex-col gap-1">
              <button
                type="button"
                disabled={!stock[detail.id]}
                onClick={() => claim(detail.id, detail.price)}
                className="flex h-11 items-center justify-center rounded-lg bg-primary text-xs font-bold uppercase tracking-wider text-primary-foreground disabled:bg-secondary disabled:text-muted-foreground"
              >
                {!stock[detail.id] ? 'Tükendi' : claimed === detail.id ? 'Alındı' : `${formatAC(detail.price)} KC ile al`}
              </button>
              <p aria-live="polite" className="min-h-4 text-center text-xs text-destructive">
                {error === detail.id ? `${formatAC(detail.price - points)} KC eksik — oyunlardan topla` : ''}
              </p>
            </div>
          )
        }
      />
    </section>
  )
}
