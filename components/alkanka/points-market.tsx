'use client'

import { useState, useTransition } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import useSWR from 'swr'
import { Check, Clock, Coins, Handshake, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getMyMarketRequests, requestMarketItem } from '@/app/actions/market'
import type { MarketProduct } from '@/lib/market'
import { productImage } from '@/lib/market-image'
import { DetailButton, DetailModal } from './detail-modal'
import { JakoTip } from './jako'
import { formatAC, usePoints } from './points-context'

const COMMON_RULES = [
  'Talep onaylanana kadar Kanka Coin rezerve edilir; reddedilirse otomatik iade edilir.',
  'Ürünler başka hesaba devredilemez, satılamaz.',
  'Birden fazla hesapla stok toplayan kullanıcıların tüm ödülleri iptal edilir.',
]

const STATUS = {
  beklemede: { label: 'Onay bekliyor', className: 'bg-primary/15 text-primary' },
  onaylandi: { label: 'Onaylandı', className: 'bg-success/15 text-success' },
  reddedildi: { label: 'Reddedildi', className: 'bg-destructive/15 text-destructive' },
} as const

type Filter = 'hepsi' | 'sponsor' | 'alkanka'


function SponsorTag({ item, className }: { item: MarketProduct; className?: string }) {
  const body = (
    <>
      {item.sponsorLogo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.sponsorLogo} alt={item.sponsorName ?? ''} className="h-7 w-auto max-w-32 object-contain" />
      ) : (
        <>
          <Handshake className="size-4 shrink-0 text-primary" aria-hidden="true" />
          <span className="truncate">{item.sponsorName}</span>
        </>
      )}
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

export function PointsMarket({ items }: { items: MarketProduct[] }) {
  const { points, member, setBalance, requireLogin } = usePoints()
  const [filter, setFilter] = useState<Filter>('hepsi')
  const [detail, setDetail] = useState<MarketProduct | null>(null)
  const [asking, setAsking] = useState<MarketProduct | null>(null)
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null)
  const [stock, setStock] = useState<Record<string, number>>(() => Object.fromEntries(items.map((i) => [i.id, i.stock])))
  const { data: mine, mutate } = useSWR(member ? ['market-mine', member.id] : null, () => getMyMarketRequests())

  const shown = items.filter((i) => filter === 'hepsi' || i.kind === filter)
  const sponsorCount = items.filter((i) => i.kind === 'sponsor').length

  function start(item: MarketProduct) {
    if (!requireLogin()) return
    setDetail(null)
    setFlash(null)
    setAsking(item)
  }

  function onDone(item: MarketProduct, res: Awaited<ReturnType<typeof requestMarketItem>>) {
    if (res.ok) {
      setBalance(res.balance)
      setStock((s) => ({ ...s, [item.id]: Math.max(0, (s[item.id] ?? 1) - 1) }))
      setFlash({ ok: true, text: res.message })
      setAsking(null)
      mutate()
    } else {
      setFlash({ ok: false, text: res.error })
    }
  }

  return (
    <section aria-label="Puan marketi" className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-sm">
          <Coins className="size-4 text-primary" aria-hidden="true" />
          <span className="text-muted-foreground">Bakiyen</span>
          <span className="font-display font-bold text-foreground tabular-nums">{formatAC(points)}</span>
        </span>
        <div role="tablist" aria-label="Ürün türü" className="flex max-w-full gap-1 overflow-x-auto rounded-lg border border-border bg-card p-1 [scrollbar-width:none]">
          {(
            [
              ['hepsi', `Tümü (${items.length})`],
              ...(sponsorCount > 0 ? [['sponsor', `Sponsor bonusları (${sponsorCount})`] as const] : []),
              ['alkanka', 'AL KANKA ödülleri'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={filter === key}
              onClick={() => setFilter(key)}
              className={cn(
                'whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold',
                filter === key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <JakoTip pose={flash?.ok ? 'kazandi' : flash ? 'uzgun' : 'market'} title={flash?.ok ? 'Talebin alındı' : flash ? 'Olmadı kanka' : 'Jako’nun tavsiyesi'}>
        {flash?.text ?? 'Sponsor bonuslarında site kullanıcı adını doğru yaz; ekip onaylayınca bonus direkt o hesaba yüklenir.'}
      </JakoTip>

      {mine && mine.length > 0 && (
        <div className="panel-gold flex flex-col gap-2 rounded-xl p-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Clock className="size-4 text-primary" aria-hidden="true" />
            Taleplerim
          </h2>
          <ul className="flex flex-col divide-y divide-border">
            {mine.slice(0, 5).map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs">
                <span className="min-w-0 flex-1 truncate text-foreground">
                  {r.itemName}
                  {r.siteUsername && <span className="text-muted-foreground"> · {r.siteUsername}</span>}
                </span>
                {r.note && <span className="text-muted-foreground">{r.note}</span>}
                <span className={cn('rounded px-2 py-0.5 font-bold', STATUS[r.status].className)}>{STATUS[r.status].label}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {shown.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {items.length === 0 ? 'Şu an listelenecek ürün yok, yakında burada olacak.' : 'Bu kategoride şu an ürün yok.'}
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-4">
          {shown.map((item) => {
            const left = stock[item.id] ?? item.stock
            const soldOut = left <= 0
            const affordable = points >= item.price
            return (
              <li key={item.id} className="panel-gold flex flex-col overflow-hidden rounded-xl">
                <div className="relative aspect-[4/3] overflow-hidden bg-secondary">
                  <Image
                    src={productImage(item)}
                    alt=""
                    fill
                    sizes="(min-width: 1536px) 20vw, (min-width: 768px) 30vw, 50vw"
                    className={cn('object-cover', soldOut && 'opacity-50 grayscale')}
                  />
                  <div className="absolute inset-x-0 top-0 flex p-2">
                    <span className="rounded bg-background/85 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-foreground">{item.type}</span>
                  </div>
                  {item.kind === 'sponsor' && item.sponsorName && (
                    <div className="absolute inset-x-0 bottom-0 flex p-2">
                      <SponsorTag item={item} />
                    </div>
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-3 p-3">
                  <div className="flex flex-col items-start gap-0.5">
                    <h3 className="text-sm font-semibold leading-snug text-foreground text-pretty">{item.name}</h3>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      Stok: {left}
                      {item.total > 0 && ` / ${item.total}`}
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
                    onClick={() => start(item)}
                    className={cn(
                      'flex h-9 items-center justify-center rounded-lg text-xs font-bold uppercase tracking-wider transition-opacity',
                      soldOut
                        ? 'cursor-not-allowed bg-secondary text-muted-foreground'
                        : affordable
                          ? 'bg-primary text-primary-foreground hover:opacity-90'
                          : 'border border-primary/40 text-primary hover:bg-primary/10',
                    )}
                  >
                    {soldOut ? 'Tükendi' : 'Talep et'}
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <DetailModal
        onClose={() => setDetail(null)}
        content={
          detail && {
            eyebrow: detail.kind === 'sponsor' ? `${detail.sponsorName} · ${detail.type}` : detail.type,
            title: detail.name,
            image: productImage(detail),
            description: detail.description,
            facts: [
              { label: 'Fiyat', value: `${formatAC(detail.price)} KC` },
              { label: 'Stok', value: `${stock[detail.id] ?? detail.stock}${detail.total ? ` / ${detail.total}` : ''}` },
              { label: 'Limit', value: `Kişi başı ${detail.perUser}` },
              { label: 'Teslimat', value: 'Panel onayıyla' },
            ],
            rules: [...detail.rules, ...COMMON_RULES],
            note: detail.delivery,
          }
        }
        action={
          detail && (
            <button
              type="button"
              disabled={(stock[detail.id] ?? detail.stock) <= 0}
              onClick={() => start(detail)}
              className="flex h-11 items-center justify-center rounded-lg bg-primary text-xs font-bold uppercase tracking-wider text-primary-foreground disabled:bg-secondary disabled:text-muted-foreground"
            >
              {(stock[detail.id] ?? detail.stock) <= 0 ? 'Tükendi' : `${formatAC(detail.price)} KC ile talep et`}
            </button>
          )
        }
      />

      {asking && (
        <RequestDialog
          item={asking}
          points={points}
          error={flash && !flash.ok ? flash.text : null}
          onClose={() => {
            setAsking(null)
            setFlash(null)
          }}
          onDone={(res) => onDone(asking, res)}
        />
      )}
    </section>
  )
}

function RequestDialog({
  item,
  points,
  error,
  onClose,
  onDone,
}: {
  item: MarketProduct
  points: number
  error: string | null
  onClose: () => void
  onDone: (res: Awaited<ReturnType<typeof requestMarketItem>>) => void
}) {
  const [username, setUsername] = useState('')
  const [pending, startTransition] = useTransition()
  const short = item.price - points

  function submit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => onDone(await requestMarketItem(item.id, item.needsUsername ? username : null)))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 p-4 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="market-request-title"
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-md flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-primary">
              {item.kind === 'sponsor' ? item.sponsorName : 'AL KANKA'}
            </span>
            <h2 id="market-request-title" className="font-display text-lg font-bold text-foreground text-balance">{item.name}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Kapat" className="rounded-md p-1 text-muted-foreground hover:text-foreground">
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        {item.needsUsername && (
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-foreground">
              {item.kind === 'sponsor' ? `${item.sponsorName} kullanıcı adın` : 'Kullanıcı adın'}
            </span>
            <input
              autoFocus
              required
              minLength={2}
              maxLength={60}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Sitedeki kullanıcı adını yaz"
              className="h-11 rounded-lg border border-border bg-background px-3 text-foreground outline-none focus:border-primary"
            />
            <span className="text-xs leading-relaxed text-muted-foreground">
              Bonus bu kullanıcı adına yüklenecek. Yanlış yazılan taleplerde iade yapılır.
            </span>
          </label>
        )}

        <div className="flex items-center justify-between rounded-lg bg-secondary px-3 py-2 text-sm">
          <span className="text-muted-foreground">Ödenecek</span>
          <span className="flex items-center gap-1 font-display font-bold text-foreground tabular-nums">
            <Coins className="size-4 text-primary" aria-hidden="true" />
            {formatAC(item.price)} KC
          </span>
        </div>

        <p aria-live="polite" className="min-h-4 text-xs text-destructive">
          {error ?? (short > 0 ? `${formatAC(short)} KC eksik — oyunlardan topla` : '')}
        </p>

        <button
          type="submit"
          disabled={pending || short > 0}
          className="flex h-11 items-center justify-center gap-2 rounded-lg bg-primary text-xs font-bold uppercase tracking-wider text-primary-foreground disabled:opacity-50"
        >
          <Check className="size-4" aria-hidden="true" />
          {pending ? 'Gönderiliyor...' : 'Talebi gönder'}
        </button>
      </form>
    </div>
  )
}
