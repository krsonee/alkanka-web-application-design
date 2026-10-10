'use client'

import { Check, Coins } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MarketItem } from '../data'
import { formatAC } from '../points-context'
import { useMarketItem } from '../use-entries'

export function MarketAction({ item, delivery }: { item: MarketItem; delivery: string }) {
  const { owned, left, soldOut, limitReached, affordable, missing, status, claim, points } = useMarketItem(item)
  const pct = Math.round((left / item.total) * 100)

  return (
    <div className="panel-gold flex flex-col gap-4 rounded-2xl p-5">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Fiyat</span>
        <span className="flex items-center gap-2">
          <Coins className="size-6 text-primary" aria-hidden="true" />
          <span className="font-display text-4xl font-bold text-foreground tabular-nums">{formatAC(item.price)}</span>
          <span className="text-sm text-muted-foreground">AC</span>
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Stok</span>
          <span className={cn('font-semibold tabular-nums', soldOut ? 'text-destructive' : 'text-foreground')}>
            {left} / {item.total}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-background" aria-hidden="true">
          <div className={cn('h-full rounded-full', soldOut ? 'bg-destructive' : 'bg-primary')} style={{ width: `${pct}%` }} />
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Kişi başı limit</span>
          <span className="font-semibold text-foreground tabular-nums">
            {owned} / {item.perUser}
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={claim}
        disabled={soldOut || limitReached}
        className={cn(
          'flex h-12 items-center justify-center gap-2 rounded-xl text-sm font-bold uppercase tracking-wider transition-opacity',
          soldOut || limitReached
            ? 'cursor-not-allowed bg-secondary text-muted-foreground'
            : affordable
              ? 'bg-primary text-primary-foreground hover:opacity-90'
              : 'border border-primary/40 text-primary hover:bg-primary/10',
        )}
      >
        {soldOut ? 'Tükendi' : limitReached ? 'Limit doldu' : 'Talep et'}
      </button>

      <p aria-live="polite" className="min-h-4 text-center text-xs">
        {status === 'funds' ? (
          <span className="text-destructive">{formatAC(missing)} AC eksik — oyunlardan topla</span>
        ) : status === 'ok' ? (
          <span className="flex items-center justify-center gap-1 text-live">
            <Check className="size-3.5" aria-hidden="true" />
            Ürün hesabına tanımlandı · Teslim: {delivery}
          </span>
        ) : soldOut ? (
          <span className="text-muted-foreground">Yeni stok Telegram kanalında duyurulur.</span>
        ) : (
          <span className="text-muted-foreground">
            Bakiyen: <span className="font-semibold text-foreground">{formatAC(points)} AC</span>
          </span>
        )}
      </p>
    </div>
  )
}
