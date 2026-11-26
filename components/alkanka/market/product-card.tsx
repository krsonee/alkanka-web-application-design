'use client'

import Image from 'next/image'
import Link from 'next/link'
import { CheckCircle2, Clock, Coins, Handshake, Package, Target, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MarketProduct } from '@/lib/market'
import { productImage } from '@/lib/market-image'
import { stockLevel } from '@/lib/market-stock'
import { dealShown, dealSpentText, dealUsesText, rewardText } from '@/lib/market-shared'
import { DetailButton } from '../detail-modal'
import { formatAC } from '../points-context'

export type BuyState =
  | { kind: 'ok' }
  | { kind: 'out' }
  | { kind: 'limit' }
  | { kind: 'short'; short: number }

/**
 * Why a member can or cannot take a product right now; a guest is never told coins are short.
 * `pay` is what this member is charged: the campaign price, or the task price once the task is done.
 */
export function buyState(item: MarketProduct, left: number, used: number, points: number, signedIn: boolean, pay = item.salePrice): BuyState {
  if (left <= 0) return { kind: 'out' }
  if (signedIn && used >= item.perUser) return { kind: 'limit' }
  if (signedIn && points < pay) return { kind: 'short', short: pay - points }
  return { kind: 'ok' }
}

export function SaleTag({ item, className }: { item: MarketProduct; className?: string }) {
  if (!item.sale) return null
  return (
    <span className={cn('rounded bg-primary px-1.5 py-0.5 text-xs font-bold tracking-wider text-primary-foreground', className)}>
      <span className="sr-only">{`${item.sale.name}: `}</span>
      {`%${item.sale.pct} indirim`}
    </span>
  )
}

/** The cheaper price a finished task unlocks; links to the task until the member has done it. */
export function DealLine({ item, taskDone, left = 0, spent = false, className }: { item: MarketProduct; taskDone: boolean; left?: number; spent?: boolean; className?: string }) {
  if (!dealShown(item, taskDone) || !item.dealTask) return null
  const price = `${formatAC(item.dealPrice)} KC`
  if (spent) {
    return (
      <p className={cn('flex items-start gap-1.5 rounded-lg bg-secondary px-2 py-1.5 text-xs leading-relaxed text-muted-foreground', className)}>
        <Target className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        <span className="min-w-0 text-pretty">{dealSpentText(item)}</span>
      </p>
    )
  }
  if (taskDone) {
    return (
      <p className={cn('flex items-start gap-1.5 rounded-lg bg-success/10 px-2 py-1.5 text-xs font-semibold leading-relaxed text-success', className)}>
        <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        <span className="min-w-0 text-pretty">{`Görevi tamamladın: ${Math.max(1, left)} adet ${price} fiyatla alabilirsin`}</span>
      </p>
    )
  }
  return (
    <Link
      href={`/gorevler?gorev=${item.dealTaskId}`}
      className={cn('flex items-start gap-1.5 rounded-lg border border-primary/40 px-2 py-1.5 text-xs leading-relaxed text-foreground hover:bg-primary/10', className)}
    >
      <Target className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden="true" />
      <span className="min-w-0 text-pretty">
        <b className="font-bold text-primary">{`Görevle ${price}`}</b>
        {`: ${item.dealTask.title}. ${dealUsesText(item)}`}
      </span>
    </Link>
  )
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

/**
 * What stands for the product on its card. A sponsor's product is the sponsor itself, so its logo fills the
 * tile on a quiet panel; a picture behind it only fought the logo. Everything else keeps its picture.
 */
function ProductMedia({
  item,
  dimmed,
  sizes,
  phone,
}: {
  item: MarketProduct
  dimmed: boolean
  sizes: string
  /** The small phone card: the logo sits in a short band, and moves down when a price tag shares the band. */
  phone?: 'plain' | 'tagged'
}) {
  if (item.kind === 'sponsor' && item.sponsorLogo) {
    return (
      <div
        className={cn(
          'absolute inset-0 flex items-center justify-center bg-background bg-[radial-gradient(120%_90%_at_50%_0%,color-mix(in_oklch,var(--primary)_22%,transparent),transparent_70%)] px-5 pb-2 pt-7',
          phone && 'max-sm:px-4 max-sm:py-2',
          phone === 'tagged' && 'max-sm:pt-7',
          dimmed && 'opacity-50 grayscale',
        )}
      >
        <span aria-hidden="true" className="absolute inset-0 opacity-[0.06] [background-image:radial-gradient(var(--primary)_1px,transparent_1px)] [background-size:12px_12px]" />
        {/* eslint-disable-next-line @next/next/no-img-element -- sponsor logos are uploaded files of any size */}
        <img src={item.sponsorLogo} alt={item.sponsorName ?? ''} className={cn('relative max-h-[52%] w-auto max-w-full object-contain drop-shadow-[0_6px_16px_oklch(0_0_0/0.55)]', phone && 'max-sm:max-h-full')} />
      </div>
    )
  }
  return (
    <>
      <Image src={productImage(item)} alt="" fill sizes={sizes} className={cn('object-cover', dimmed && 'opacity-50 grayscale')} />
      {item.kind === 'sponsor' && item.sponsorName && (
        <div className="absolute inset-x-0 bottom-0 flex p-2">
          <SponsorTag item={item} />
        </div>
      )}
    </>
  )
}

function Price({ value, was, small, className }: { value: number; was: number; small?: boolean; className?: string }) {
  return (
    <span className={cn('flex flex-wrap items-center gap-x-1.5', className)}>
      <Coins className="size-4 text-primary" aria-hidden="true" />
      <span className={cn('font-display font-bold text-foreground tabular-nums', small ? 'text-base' : 'text-lg')}>{formatAC(value)}</span>
      <span className="text-xs text-muted-foreground">KC</span>
      {was > value && (
        <s className="text-xs text-muted-foreground tabular-nums">
          <span className="sr-only">Eski fiyat </span>
          {formatAC(was)}
        </s>
      )}
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
  /** What this member is charged right now. */
  pay: number
  taskDone: boolean
  /** Units the finished task still buys at the task price. */
  dealLeft?: number
  /** The task is done but every discounted unit it covered has been bought. */
  dealSpent?: boolean
  onBuy: () => void
  onDetail: () => void
}

export function ProductCard({ item, left, used, points, signedIn, pay, taskDone, dealLeft, dealSpent, onBuy, onDetail }: CardProps) {
  const state = buyState(item, left, used, points, signedIn, pay)
  const level = stockLevel(left, item.total)
  const deal = dealShown(item, taskDone) && Boolean(item.dealTask) && !dealSpent
  const logoTile = item.kind === 'sponsor' && Boolean(item.sponsorLogo)
  const tagged = Boolean(item.sale) || deal
  // Phones: the card is the picture, the name and the price; one tap opens the detail sheet, which carries the button.
  return (
    <li className="panel-gold relative flex flex-col overflow-hidden rounded-xl max-sm:rounded-2xl">
      <button
        type="button"
        onClick={onDetail}
        aria-label={`${item.name}: detay ve ${buyLabel(item).toLocaleLowerCase('tr')}`}
        className="absolute inset-0 z-10 rounded-2xl focus-visible:outline-2 focus-visible:outline-primary sm:hidden"
      />
      <div className={cn('relative aspect-[4/3] overflow-hidden bg-secondary', logoTile ? 'max-sm:aspect-auto max-sm:h-16' : 'max-sm:aspect-[2/1]')}>
        <ProductMedia
          item={item}
          dimmed={state.kind === 'out'}
          phone={tagged ? 'tagged' : 'plain'}
          sizes="(min-width: 1536px) 20vw, (min-width: 768px) 30vw, 50vw"
        />
        <div className="absolute inset-x-0 top-0 flex flex-wrap items-start gap-1 p-2 max-sm:p-1.5 sm:justify-between">
          <span className="rounded bg-background/85 px-1.5 py-0.5 text-xs font-bold tracking-wider text-foreground max-sm:hidden">{item.type}</span>
          <SaleTag item={item} className="max-sm:rounded-full max-sm:px-2 max-sm:text-[11px] max-sm:leading-4 max-sm:tracking-normal" />
          {deal ? (
            <span className="flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold leading-4 text-primary-foreground sm:hidden">
              <Target className="size-3" aria-hidden="true" />
              {taskDone ? 'Görev fiyatı' : `Görevle ${formatAC(item.dealPrice)}`}
            </span>
          ) : null}
        </div>
      </div>
      {/* Phone: kind and stock share one line, the name takes only the lines it needs, the price closes the card. */}
      <div className="flex flex-1 flex-col gap-1 p-2.5 sm:hidden">
        <div className="flex items-start justify-between gap-2 text-[11px] leading-4">
          <span className="min-w-0 font-semibold lowercase text-muted-foreground first-letter:uppercase">{item.type}</span>
          <span
            className={cn(
              'flex shrink-0 items-center gap-1 tabular-nums',
              level === 'out' ? 'font-semibold text-destructive' : level === 'low' ? 'font-semibold text-primary' : 'text-muted-foreground',
            )}
          >
            {level !== 'out' && <Package className="size-3" aria-hidden="true" />}
            <span className="sr-only">Stok: </span>
            {level === 'out' ? 'Tükendi' : level === 'low' ? `Son ${left}` : item.total > 0 ? `${left}/${item.total}` : 'Var'}
          </span>
        </div>
        <h3 className="text-sm font-semibold leading-snug text-foreground text-pretty">{item.name}</h3>
        <Price value={pay} was={item.price} small className="mt-auto pt-0.5" />
      </div>
      <div className="flex flex-1 flex-col gap-3 p-3 max-sm:hidden">
        <div className="flex flex-col items-start gap-1.5">
          <h3 className="text-sm font-semibold leading-snug text-foreground text-pretty">{item.name}</h3>
          <DeliveryLine item={item} className="max-w-full" />
        </div>
        <StockMeter left={left} total={item.total} />
        <div className="mt-auto flex flex-col gap-2">
          <DealLine item={item} taskDone={taskDone} left={dealLeft} spent={dealSpent} />
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <Price value={pay} was={item.price} />
            <LimitLine item={item} used={used} signedIn={signedIn} />
          </div>
          <BuyButton item={item} state={state} onBuy={onBuy} />
          <DetailButton onClick={onDetail} />
        </div>
      </div>
    </li>
  )
}

export function FeaturedCard({ item, left, used, points, signedIn, pay, taskDone, dealLeft, dealSpent, onBuy, onDetail }: CardProps) {
  const state = buyState(item, left, used, points, signedIn, pay)
  return (
    <li className="panel-gold flex flex-col overflow-hidden rounded-2xl @lg:flex-row">
      <div className="relative aspect-[16/9] shrink-0 overflow-hidden bg-secondary @lg:aspect-auto @lg:w-2/5">
        <ProductMedia item={item} dimmed={state.kind === 'out'} sizes="(min-width: 1024px) 30vw, 90vw" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-3 p-4">
        <div className="flex flex-col items-start gap-1.5">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-primary">{item.type}</span>
            <SaleTag item={item} />
          </span>
          <h3 className="font-display text-xl font-bold leading-tight text-foreground text-balance">{item.name}</h3>
          {item.description && <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground text-pretty">{item.description}</p>}
          <DeliveryLine item={item} className="max-w-full" />
        </div>
        <StockMeter left={left} total={item.total} />
        <DealLine item={item} taskDone={taskDone} left={dealLeft} spent={dealSpent} className="self-start" />
        <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2">
          <Price value={pay} was={item.price} />
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
