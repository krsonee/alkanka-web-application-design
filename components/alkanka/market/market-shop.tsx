'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import useSWR, { mutate as refreshShared } from 'swr'
import { Clock, Coins, Percent, Star, Target } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getMyMarketAccounts, getMyMarketDeals, getMyMarketRequests } from '@/app/actions/market'
import type { MarketProduct } from '@/lib/market'
import { productImage } from '@/lib/market-image'
import { FEATURED_SLOTS, MARKET_CATEGORIES, dealShown, isMarketCategory, payable, rewardText, type MarketCategory } from '@/lib/market-shared'
import { MARKET_KIND_PARAM } from '@/lib/record-links'
import { TR_TZ } from '@/lib/tr-time'
import { DetailModal } from '../detail-modal'
import { JakoTip } from '../jako'
import { formatAC, usePoints } from '../points-context'
import { ThemeShop } from '../theme-shop'
import { LookShelf } from './look-shelf'
import { FeaturedCard, ProductCard, buyLabel, buyState } from './product-card'
import { RequestDialog, type RequestResult } from './request-dialog'

const COMMON_RULES = [
  'Elle teslim edilen ürünlerde coin talep anında düşer; talep reddedilirse otomatik iade edilir.',
  'Ürünler başka hesaba devredilemez, satılamaz.',
  'Birden fazla hesapla stok toplayan kullanıcıların tüm ödülleri iptal edilir.',
]

const THEME_ANCHOR = 'masa-temalari'

const STATUS = {
  beklemede: { label: 'Onay bekliyor', className: 'bg-primary/15 text-primary' },
  onaylandi: { label: 'Teslim edildi', className: 'bg-success/15 text-success' },
  reddedildi: { label: 'Reddedildi, iade edildi', className: 'bg-destructive/15 text-destructive' },
} as const

const EMPTY_TEXT: Record<'sponsor' | 'alkanka', string> = {
  sponsor: 'Şu an sponsor ödülü yok. Yenileri eklendiğinde burada görünür.',
  alkanka: 'Şu an site içi ödül yok. Yenileri eklendiğinde burada görünür.',
}

const kindCategory = (items: MarketProduct[]): MarketCategory => (items.some((i) => i.kind === 'sponsor') ? 'sponsor' : 'alkanka')

function startCategory(items: MarketProduct[], kind: string | undefined, focus: MarketProduct | null): MarketCategory {
  if (isMarketCategory(kind)) return kind
  if (focus) return focus.kind
  return kindCategory(items)
}

const saleEnd = (iso: string) => new Date(iso).toLocaleString('tr-TR', { timeZone: TR_TZ, day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })

export function MarketShop({ items, focus, kind }: { items: MarketProduct[]; focus?: string; kind?: string }) {
  const { points, member, setBalance, requireLogin } = usePoints()
  const focused = focus == null ? null : (items.find((i) => i.id === focus) ?? null)
  const [category, setCategoryState] = useState<MarketCategory>(() => startCategory(items, kind, focused))
  // A product's own page (/market/[id]) opens with that product's details on screen.
  const [detail, setDetail] = useState<MarketProduct | null>(focused)
  const [asking, setAsking] = useState<MarketProduct | null>(null)
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null)
  const [stock, setStock] = useState<Record<string, number>>(() => Object.fromEntries(items.map((i) => [i.id, i.stock])))
  const { data: mine, mutate } = useSWR(member ? ['market-mine', member.id] : null, () => getMyMarketRequests())
  const { data: doneTasks } = useSWR(member ? ['market-deals', member.id] : null, () => getMyMarketDeals())
  // Undefined until the answer arrives; the purchase form waits for it rather than asking for a name it will not use.
  const { data: accounts } = useSWR(member ? ['market-accounts', member.id] : null, () => getMyMarketAccounts())

  // Task rewards and the in-table theme picker still link to /market#masa-temalari from before themes had their own tab.
  useEffect(() => {
    if (window.location.hash !== `#${THEME_ANCHOR}`) return
    setCategoryState('tema')
    requestAnimationFrame(() => document.getElementById(THEME_ANCHOR)?.scrollIntoView())
  }, [])

  const signedIn = Boolean(member)
  const leftOf = (item: MarketProduct) => stock[item.id] ?? item.stock
  const usedOf = (item: MarketProduct) => (mine ?? []).filter((r) => r.itemId === item.id && r.status !== 'reddedildi').length
  const taskDoneOf = (item: MarketProduct) => item.dealTaskId != null && (doneTasks ?? []).includes(item.dealTaskId)
  const payOf = (item: MarketProduct) => payable(item, taskDoneOf(item))
  const cardProps = (item: MarketProduct) => ({
    item,
    left: leftOf(item),
    used: usedOf(item),
    points,
    signedIn,
    pay: payOf(item),
    taskDone: taskDoneOf(item),
    onBuy: () => start(item),
    onDetail: () => setDetail(item),
  })

  const soldOutLast = (a: MarketProduct, b: MarketProduct) => Number(leftOf(a) <= 0) - Number(leftOf(b) <= 0)
  const featured = items.filter((i) => i.featured && leftOf(i) > 0).slice(0, FEATURED_SLOTS)
  const inCategory = (id: 'sponsor' | 'alkanka') => items.filter((i) => i.kind === id).sort(soldOutLast)
  const deals = items.filter((i) => dealShown(i, taskDoneOf(i))).sort(soldOutLast)
  const counts: Partial<Record<MarketCategory, number>> = { firsat: deals.length, sponsor: inCategory('sponsor').length, alkanka: inCategory('alkanka').length }
  const categories = MARKET_CATEGORIES.filter((c) => c.id !== 'firsat' || deals.length > 0)
  // The deals tab disappears with its last product; a link that still points at it lands on a real category.
  const shown: MarketCategory = category === 'firsat' && deals.length === 0 ? kindCategory(items) : category
  const reachable = items.filter((i) => leftOf(i) > 0 && points >= payOf(i)).length
  const sales = Array.from(new Map(items.flatMap((i) => (i.sale && leftOf(i) > 0 ? [[i.sale.id, i.sale] as const] : []))).values())
  const onSale = (id: number) => items.filter((i) => i.sale?.id === id && leftOf(i) > 0).length

  function setCategory(next: MarketCategory) {
    setCategoryState(next)
    if (focus != null) return
    const url = new URL(window.location.href)
    url.searchParams.set(MARKET_KIND_PARAM, next)
    window.history.replaceState(null, '', url)
  }

  function start(item: MarketProduct) {
    if (!requireLogin()) return
    setDetail(null)
    setFlash(null)
    setAsking(item)
  }

  function onDone(item: MarketProduct, res: RequestResult) {
    if (!res.ok) return setFlash({ ok: false, text: res.error })
    setBalance(res.balance)
    setStock((s) => ({ ...s, [item.id]: Math.max(0, (s[item.id] ?? item.stock) - 1) }))
    setFlash({ ok: true, text: res.message })
    setAsking(null)
    void mutate()
    // Bought wheel and dice rights show up on the games right away.
    void refreshShared('mini-status')
  }

  const detailPay = detail ? payOf(detail) : 0
  const detailState = detail ? buyState(detail, leftOf(detail), usedOf(detail), points, signedIn, detailPay) : null

  return (
    <section aria-label="Puan marketi" className="@container flex flex-col gap-6">
      <div className="panel-gold flex flex-col gap-4 rounded-2xl p-4 @2xl:flex-row @2xl:items-center @2xl:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/15">
            <Coins className="size-6 text-primary" aria-hidden="true" />
          </span>
          <div className="flex flex-col">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{signedIn ? 'Bakiyen' : 'Kanka Coin ile alışveriş'}</span>
            {signedIn ? (
              <span className="font-display text-3xl font-bold leading-tight text-foreground tabular-nums">
                {formatAC(points)} <span className="text-base font-semibold text-muted-foreground">KC</span>
              </span>
            ) : (
              <span className="font-display text-xl font-bold leading-tight text-foreground text-balance">Giriş yap, coinini ödüle çevir</span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
            {signedIn
              ? reachable > 0
                ? `Coinin şu an ${reachable} ürüne yetiyor.`
                : 'Coinin henüz hiçbir ürüne yetmiyor, biraz daha topla.'
              : 'Oyunlardan ve görevlerden coin topla, buradan harca.'}
          </p>
          {signedIn ? (
            <Link href="/gorevler" className="flex h-10 items-center gap-2 rounded-lg border border-primary/40 px-3 text-sm font-bold text-primary hover:bg-primary/10">
              <Target className="size-4" aria-hidden="true" />
              Coin kazan
            </Link>
          ) : (
            <button type="button" onClick={() => requireLogin()} className="flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground hover:opacity-90">
              Giriş yap
            </button>
          )}
        </div>
      </div>

      {sales.length > 0 && (
        <ul aria-label="Yayındaki indirimler" className="flex flex-col gap-2">
          {sales.map((sale) => (
            <li key={sale.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-primary/50 bg-primary/10 px-4 py-3">
              <span className="flex items-center gap-2 font-display text-base font-bold text-foreground">
                <Percent className="size-4 shrink-0 text-primary" aria-hidden="true" />
                {sale.name}
              </span>
              <span className="text-sm leading-relaxed text-muted-foreground text-pretty">
                {`${onSale(sale.id)} üründe %${sale.pct} indirim. ${saleEnd(sale.endsAt)} tarihinde biter.`}
              </span>
            </li>
          ))}
        </ul>
      )}

      {flash && (
        <JakoTip pose={flash.ok ? 'kazandi' : 'uzgun'} title={flash.ok ? 'Tamamdır kanka' : 'Olmadı kanka'}>
          {flash.text}
        </JakoTip>
      )}

      {featured.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
            <Star className="size-4 text-primary" aria-hidden="true" />
            Öne çıkanlar
          </h2>
          <ul className={cn('grid gap-3', featured.length > 1 && '@4xl:grid-cols-2')}>
            {featured.map((item) => (
              <FeaturedCard key={item.id} {...cardProps(item)} />
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-col gap-4">
        <div role="tablist" aria-label="Market kategorisi" className="flex max-w-full gap-1 self-start overflow-x-auto rounded-xl border border-border bg-card p-1 [scrollbar-width:none]">
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              role="tab"
              id={`market-sekme-${c.id}`}
              aria-selected={shown === c.id}
              aria-controls="market-icerik"
              onClick={() => setCategory(c.id)}
              className={cn(
                'whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-semibold',
                shown === c.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {c.label}
              {counts[c.id] != null && (
                <>
                  {' '}
                  <span className="tabular-nums opacity-80">
                    <span className="sr-only">(</span>
                    {counts[c.id]}
                    <span className="sr-only"> ürün)</span>
                  </span>
                </>
              )}
            </button>
          ))}
        </div>

        <div id="market-icerik" role="tabpanel" aria-labelledby={`market-sekme-${shown}`} className="flex flex-col gap-4">
          {shown === 'tema' ? (
            <ThemeShop />
          ) : shown === 'avatar' ? (
            <LookShelf />
          ) : shown === 'firsat' ? (
            <>
              <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
                Bu ürünleri normal fiyatından da alabilirsin. Kartta yazan görevi tamamlarsan görev fiyatı kendiliğinden uygulanır; ayrıca bir şey yapmana gerek yok.
              </p>
              <ul className="grid grid-cols-2 gap-3 @2xl:grid-cols-3 @5xl:grid-cols-4">
                {deals.map((item) => (
                  <ProductCard key={item.id} {...cardProps(item)} />
                ))}
              </ul>
            </>
          ) : (
            <>
              {shown === 'sponsor' && inCategory('sponsor').length > 0 && (
                <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
                  Sponsor ödülleri sponsorun sitesindeki hesabına yüklenir. O sponsorda hesabını bağladıysan kullanıcı adın bağlı hesabından alınır; bağlamadıysan talep ederken o sitedeki kullanıcı adını doğru yaz. Ekip onaylayınca ödül oraya eklenir.
                </p>
              )}
              {inCategory(shown).length === 0 ? (
                <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">{EMPTY_TEXT[shown]}</p>
              ) : (
                <ul className="grid grid-cols-2 gap-3 @2xl:grid-cols-3 @5xl:grid-cols-4">
                  {inCategory(shown).map((item) => (
                    <ProductCard key={item.id} {...cardProps(item)} />
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>

      {mine && mine.length > 0 && (
        <div className="panel-gold flex flex-col gap-2 rounded-xl p-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Clock className="size-4 text-primary" aria-hidden="true" />
            Son alışverişlerim
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

      <DetailModal
        onClose={() => setDetail(null)}
        content={
          detail && {
            eyebrow: detail.kind === 'sponsor' ? `${detail.sponsorName} · ${detail.type}` : detail.type,
            title: detail.name,
            image: productImage(detail),
            description: detail.description,
            facts: [
              { label: 'Fiyat', value: detailPay < detail.price ? `${formatAC(detailPay)} KC (normali ${formatAC(detail.price)} KC)` : `${formatAC(detail.price)} KC` },
              ...(detail.sale ? [{ label: 'Kampanya', value: `${detail.sale.name} · %${detail.sale.pct} · ${saleEnd(detail.sale.endsAt)} tarihinde biter` }] : []),
              ...(dealShown(detail, taskDoneOf(detail)) && detail.dealTask
                ? [{ label: 'Görevle', value: `${formatAC(detail.dealPrice)} KC · ${detail.dealTask.title}${taskDoneOf(detail) ? ' (tamamladın)' : ''}` }]
                : []),
              { label: 'Stok', value: `${leftOf(detail)}${detail.total ? ` / ${detail.total}` : ''}` },
              { label: 'Limit', value: `Kişi başı ${detail.perUser}` },
              {
                label: 'Teslimat',
                value: detail.deliveryMode === 'auto' && detail.reward ? (detail.reward.kind === 'rozet' ? 'Anında, profiline' : `Anında: ${rewardText(detail.reward)}`) : 'Ekip onayıyla',
              },
            ],
            rules: [...detail.rules, ...COMMON_RULES],
            note: detail.delivery,
          }
        }
        action={
          detail &&
          detailState && (
            <button
              type="button"
              disabled={detailState.kind === 'out' || detailState.kind === 'limit'}
              onClick={() => start(detail)}
              className="flex h-11 items-center justify-center rounded-lg bg-primary text-xs font-bold uppercase tracking-wider text-primary-foreground disabled:bg-secondary disabled:text-muted-foreground"
            >
              {detailState.kind === 'out'
                ? 'Tükendi'
                : detailState.kind === 'limit'
                  ? 'Sınırına ulaştın'
                  : detailState.kind === 'short'
                    ? `${formatAC(detailState.short)} KC eksik`
                    : `${formatAC(detailPay)} KC ile ${buyLabel(detail).toLocaleLowerCase('tr')}`}
            </button>
          )
        }
      />

      {asking && (
        <RequestDialog
          item={asking}
          pay={payOf(asking)}
          taskDone={taskDoneOf(asking)}
          account={asking.kind === 'sponsor' && asking.sponsorSlug ? (accounts?.[asking.sponsorSlug] ?? null) : null}
          checking={Boolean(member) && asking.kind === 'sponsor' && accounts === undefined}
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
