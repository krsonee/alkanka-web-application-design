'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Clock, Coins, Handshake, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MarketProduct } from '@/lib/market'
import { productImage } from '@/lib/market-image'
import { stockLevel } from '@/lib/market-stock'
import { rewardText } from '@/lib/market-shared'
import { DetailButton } from '../detail-modal'
import { formatAC } from '../points-context'

export type BuyState =
  | { kind: 'ok' }
  | { kind: 'out' }
  | { kind: 'limit' }
  | { kind: 'short'; short: number }

/** Why a member can or cannot take a product right now; a guest is never told coins are short. */
export function buyState(item: MarketProduct, left: number, used: number, points: number, signedIn: boolean): BuyState {
  if (left <= 0) return { kind: 'out' }
  if (signedIn && used >= item.perUser) return { kind: 'limit' }
  if (signedIn && points < item.price) return { kind: 'short', short: item.price - points }
  return { kind: 'ok' }
}

export const buyLabel = (item: MarketProduct) => (item.deliveryMode === 'auto' ? 'Satın al' : 'Talep et')

export function SponsorTag({ item, className }: { item: MarketProduct; className?: string }) {
  const body = item.sponsorLogo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={item.sponsorLogo} alt={item.sponsorName ?? ''} className="h-7 w-auto max-w-32 object-contain" />
  ) : (
    <>
      <Handshake className="size-4 shrink-0 text-primary" aria-hidden="true" />
      <span className="truncate">{item.sponsorName}</span>
    </>
  )
  const cls = cn(
    'flex max-w-full items-center gap-2 rounded-lg border border-primary/40 bg-background/90 px-2.5 py-1 text-sm font-bold text-foreground backdrop-blur',
    className,
  )
  return item.sponsorSlug ? (
    <Link href={`/siteler/${item.sponsorSlug}`} className={cn(cls, 'hover:border-primary')} aria-label={`${item.sponsorName} sitesine git`}>
      {body}
    </Link>
  ) : (
    <span className={cls}>{body}</span>
  )
}

export function DeliveryLine({ item, className }: { item: MarketProduct; className?: string }) {
  const auto = item.deliveryMode === 'auto' && item.reward
  return (
    <p className={cn('flex items-center gap-1.5 text-xs font-medium', auto ? 'text-success' : 'text-muted-foreground', className)}>
      {auto ? <Zap className="size-3.5 shrink-0" aria-hidden="true" /> : <Clock className="size-3.5 shrink-0" aria-hidden="true" />}
      <span className="min-w-0 truncate">
        {auto && item.reward
          ? item.reward.kind === 'rozet'
            ? 'Anında profiline takılır'
            : `${rewardText(item.reward)} · anında`
          : item.kind === 'sponsor'
            ? 'Ekip onayıyla sitene yüklenir'
            : 'Ekip onayıyla teslim'}
      </span>
    </p>
  )
}

export function StockMeter({ left, total, className }: { left: number; total: number; className?: string }) {
  const level = stockLevel(left, total)
  const ratio = total > 0 ? Math.min(1, Math.max(0, left / total)) : left > 0 ? 1 : 0
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className={cn('font-semibold', level === 'out' ? 'text-destructive' : level === 'low' ? 'text-primary' : 'text-muted-foreground')}>
          {level === 'out' ? 'Stok tükendi' : level === 'low' ? `Son ${left} adet` : 'Stokta'}
        </span>
        <span className="text-muted-foreground tabular-nums">{total > 0 ? `${left} / ${total}` : left}</span>
      </div>
      <div aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-secondary">
        <div className={cn('h-full rounded-full', level === 'out' ? 'bg-muted-foreground/40' : 'bg-primary')} style={{ width: `${Math.round(ratio * 100)}%` }} />
      </div>
    </div>
  )
}

function Price({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn('flex items-center gap-1.5', className)}>
      <Coins className="size-4 text-primary" aria-hidden="true" />
      <span className="font-display text-lg font-bold text-foreground tabular-nums">{formatAC(value)}</span>
      <span className="text-xs text-muted-foreground">KC</span>
    </span>
  )
}

function BuyButton({ item, state, onBuy, className }: { item: MarketProduct; state: BuyState; onBuy: () => void; className?: string }) {
  const blocked = state.kind === 'out' || state.kind === 'limit'
  return (
    <button
      type="button"
      disabled={blocked}
      onClick={onBuy}
      className={cn(
        'flex h-10 items-center justify-center rounded-lg px-3 text-xs font-bold uppercase tracking-wider transition-opacity',
        blocked
          ? 'cursor-not-allowed bg-secondary text-muted-foreground'
          : state.kind === 'short'
            ? 'border border-primary/40 text-primary hover:bg-primary/10'
            : 'bg-primary text-primary-foreground hover:opacity-90',
        className,
      )}
    >
      {state.kind === 'out' ? 'Tükendi' : state.kind === 'limit' ? 'Sınırına ulaştın' : state.kind === 'short' ? `${formatAC(state.short)} KC eksik` : buyLabel(item)}
    </button>
  )
}

function LimitLine({ item, used, signedIn }: { item: MarketProduct; used: number; signedIn: boolean }) {
  return (
    <span className="text-xs text-muted-foreground tabular-nums">
      {signedIn && used > 0 ? `Kişi başı ${item.perUser} · ${used} aldın` : `Kişi başı ${item.perUser}`}
    </span>
  )
}

type CardProps = {
  item: MarketProduct
  left: number
  used: number
  points: number
  signedIn: boolean
  onBuy: () => void
  onDetail: () => void
}

export function ProductCard({ item, left, used, points, signedIn, onBuy, onDetail }: CardProps) {
  const state = buyState(item, left, used, points, signedIn)
  return (
    <li className="panel-gold flex flex-col overflow-hidden rounded-xl">
      <div className="relative aspect-[4/3] overflow-hidden bg-secondary">
        <Image
          src={productImage(item)}
          alt=""
          fill
          sizes="(min-width: 1536px) 20vw, (min-width: 768px) 30vw, 50vw"
          className={cn('object-cover', state.kind === 'out' && 'opacity-50 grayscale')}
        />
        <div className="absolute inset-x-0 top-0 flex p-2">
          <span className="rounded bg-background/85 px-1.5 py-0.5 text-xs font-bold tracking-wider text-foreground">{item.type}</span>
        </div>
        {item.kind === 'sponsor' && item.sponsorName && (
          <div className="absolute inset-x-0 bottom-0 flex p-2">
            <SponsorTag item={item} />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-3">
        <div className="flex flex-col items-start gap-1.5">
          <h3 className="text-sm font-semibold leading-snug text-foreground text-pretty">{item.name}</h3>
          <DeliveryLine item={item} className="max-w-full" />
        </div>
        <StockMeter left={left} total={item.total} />
        <div className="mt-auto flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <Price value={item.price} />
            <LimitLine item={item} used={used} signedIn={signedIn} />
          </div>
          <BuyButton item={item} state={state} onBuy={onBuy} />
          <DetailButton onClick={onDetail} />
        </div>
      </div>
    </li>
  )
}

export function FeaturedCard({ item, left, used, points, signedIn, onBuy, onDetail }: CardProps) {
  const state = buyState(item, left, used, points, signedIn)
  return (
    <li className="panel-gold flex flex-col overflow-hidden rounded-2xl @lg:flex-row">
      <div className="relative aspect-[16/9] shrink-0 overflow-hidden bg-secondary @lg:aspect-auto @lg:w-2/5">
        <Image
          src={productImage(item)}
          alt=""
          fill
          sizes="(min-width: 1024px) 30vw, 90vw"
          className={cn('object-cover', state.kind === 'out' && 'opacity-50 grayscale')}
        />
        {item.kind === 'sponsor' && item.sponsorName && (
          <div className="absolute inset-x-0 bottom-0 flex p-2">
            <SponsorTag item={item} />
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-3 p-4">
        <div className="flex flex-col items-start gap-1.5">
          <span className="text-xs font-bold uppercase tracking-wider text-primary">{item.type}</span>
          <h3 className="font-display text-xl font-bold leading-tight text-foreground text-balance">{item.name}</h3>
          {item.description && <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground text-pretty">{item.description}</p>}
          <DeliveryLine item={item} className="max-w-full" />
        </div>
        <StockMeter left={left} total={item.total} />
        <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2">
          <Price value={item.price} />
          <LimitLine item={item} used={used} signedIn={signedIn} />
          <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
            <DetailButton onClick={onDetail} label="Detay" />
            <BuyButton item={item} state={state} onBuy={onBuy} className="min-w-32" />
          </div>
        </div>
      </div>
    </li>
  )
}
