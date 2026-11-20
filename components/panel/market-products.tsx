'use client'

import { useState, useTransition } from 'react'
import Image from 'next/image'
import { Hand, LayoutGrid, PackageOpen, Pencil, Plus, Rows3, Search, Star, Trash2, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { stockLevel, stockWarning } from '@/lib/market-stock'
import { productImage } from '@/lib/market-image'
import { rewardText } from '@/lib/market-shared'
import type { MarketProduct, ProductInput } from '@/lib/market'
import { deleteMarketProductAction, featureMarketProductAction, reorderMarketProductsAction, saveMarketProductAction } from '@/app/panel/market-actions'
import { MarketGuide } from '@/components/panel/area-guides'
import { askConfirm } from '@/components/panel/confirm-dialog'
import { Flash } from '@/components/panel/flash'
import { HideButton } from '@/components/panel/hide-button'
import { MarketProductForm, type BadgeOption, type SponsorOption } from '@/components/panel/market-product-form'
import { RecordLink } from '@/components/panel/record-link'
import { SortableList, mergeOrder, useOrder } from '@/components/panel/sortable-list'
import { useUrlTab } from '@/components/panel/use-url-tab'

const EMPTY: ProductInput = {
  id: null, kind: 'sponsor', sponsorId: null, sponsorName: null, type: 'SPONSOR BONUSU', name: '', description: '', delivery: '',
  rules: [], image: '', price: 1000, stock: 10, total: 10, perUser: 1, needsUsername: true, active: true, sort: 0,
  deliveryMode: 'manual', reward: null, featured: false,
}

type KindFilter = 'hepsi' | 'sponsor' | 'alkanka'
type StockFilter = 'hepsi' | 'var' | 'az' | 'bitti' | 'gizli'

const KINDS: { id: KindFilter; label: string }[] = [
  { id: 'hepsi', label: 'Tüm türler' },
  { id: 'sponsor', label: 'Sponsor bonusu' },
  { id: 'alkanka', label: 'Site içi ürün' },
]

const STOCKS: { id: StockFilter; label: string }[] = [
  { id: 'hepsi', label: 'Tüm stoklar' },
  { id: 'var', label: 'Stokta' },
  { id: 'az', label: 'Stok azaldı' },
  { id: 'bitti', label: 'Stok bitti' },
  { id: 'gizli', label: 'Gizli' },
]

const select = 'h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary'
const icon = 'rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground'

const fold = (text: string | null) => (text ?? '').toLocaleLowerCase('tr')

function matchesStock(p: MarketProduct, filter: StockFilter) {
  if (filter === 'hepsi') return true
  if (filter === 'gizli') return !p.active
  const level = stockLevel(p.stock, p.total)
  return filter === 'var' ? level === 'ok' : filter === 'az' ? level === 'low' : level === 'out'
}

export function MarketProducts({ products, sponsors, badges }: { products: MarketProduct[]; sponsors: SponsorOption[]; badges: BadgeOption[] }) {
  const [view, setView] = useUrlTab<'kart' | 'tablo'>(['kart', 'tablo'], 'kart', 'g')
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState<KindFilter>('hepsi')
  const [stock, setStock] = useState<StockFilter>('hepsi')
  const [editing, setEditing] = useState<ProductInput | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, start] = useTransition()
  const [sorting, startSort] = useTransition()
  const order = useOrder(products, (p) => p.id)

  const needle = fold(query.trim())
  const visible = order.ordered.filter(
    (p) => (kind === 'hepsi' || p.kind === kind) && matchesStock(p, stock) && (!needle || [p.name, p.sponsorName, p.type, p.description].some((text) => fold(text).includes(needle))),
  )
  const narrowed = visible.length !== order.ordered.length
  const lowStock = products.filter((p) => p.active && stockLevel(p.stock, p.total) !== 'ok').sort((a, b) => a.stock - b.stock)
  const badgeName = (id: string | null) => badges.find((b) => b.id === id)?.name ?? null

  function run(p: Promise<{ ok: true; message?: string } | { ok: false; error: string }>) {
    start(async () => {
      const res = await p
      setMsg(res.ok ? { ok: true, text: res.message ?? 'Kaydedildi.' } : { ok: false, text: res.error })
    })
  }

  function save(input: ProductInput) {
    setFormError(null)
    start(async () => {
      const res = await saveMarketProductAction(input)
      if (!res.ok) return setFormError(res.error)
      setMsg({ ok: true, text: res.message ?? 'Ürün kaydedildi.' })
      setEditing(null)
    })
  }

  function move(shown: string[]) {
    const ids = mergeOrder(
      order.ordered.map((p) => p.id),
      shown,
    )
    order.set(ids)
    startSort(async () => {
      const res = await reorderMarketProductsAction(ids)
      if (!res.ok) order.reset()
      setMsg(res.ok ? { ok: true, text: res.message ?? 'Sıra kaydedildi.' } : { ok: false, text: res.error })
    })
  }

  function open(input: ProductInput) {
    setFormError(null)
    setEditing(input)
  }

  const delivery = (p: MarketProduct) =>
    p.deliveryMode === 'auto' && p.reward ? (
      <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-xs font-semibold text-success">
        <Zap className="size-3" aria-hidden="true" />
        {`Otomatik: ${rewardText(p.reward, badgeName(p.reward.ref))}`}
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-foreground">
        <Hand className="size-3" aria-hidden="true" />
        Elle teslim
      </span>
    )

  const stockBadge = (p: MarketProduct) => {
    const level = p.active ? stockLevel(p.stock, p.total) : 'ok'
    return (
      <span className={cn('text-xs tabular-nums', level === 'out' ? 'font-semibold text-destructive' : level === 'low' ? 'font-semibold text-primary' : 'text-muted-foreground')}>
        {`Stok ${p.stock}/${p.total}`}
        {level === 'out' ? ' · bitti' : level === 'low' ? ' · azaldı' : ''}
      </span>
    )
  }

  const actions = (p: MarketProduct) => (
    <div className="flex items-center gap-0.5">
      <button
        type="button"
        aria-pressed={p.featured}
        aria-label={p.featured ? `${p.name} öne çıkanlardan alınsın` : `${p.name} öne çıkarılsın`}
        title={p.featured ? 'Öne çıkanlardan al' : 'Öne çıkar'}
        disabled={pending}
        onClick={() => run(featureMarketProductAction(p.id, !p.featured))}
        className={cn(icon, p.featured && 'text-primary hover:text-primary')}
      >
        <Star className={cn('size-4', p.featured && 'fill-current')} aria-hidden="true" />
      </button>
      <RecordLink kind="market" id={p.id} name={p.name} compact className="contents" />
      <HideButton key={`${p.id}-${p.active}`} kind="market" id={p.id} hidden={!p.active} label={p.name} />
      <button type="button" aria-label={`${p.name} düzenle`} title="Düzenle" onClick={() => open({ ...p })} className={icon}>
        <Pencil className="size-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-label={`${p.name} sil`}
        title="Sil"
        onClick={() => void askConfirm(`${p.name} silinsin mi? Geçmiş talepler kayıtta kalır.`).then((ok) => ok && run(deleteMarketProductAction(p.id)))}
        className={cn(icon, 'hover:text-destructive')}
      >
        <Trash2 className="size-4" aria-hidden="true" />
      </button>
    </div>
  )

  const owner = (p: MarketProduct) => (
    <span className={cn('max-w-full truncate rounded px-2 py-0.5 text-[11px] font-bold uppercase', p.kind === 'sponsor' ? 'bg-accent text-accent-foreground' : 'bg-secondary text-foreground')}>
      {p.kind === 'sponsor' ? (p.sponsorName ?? 'Sponsor') : 'AL KANKA'}
    </span>
  )

  return (
    <div className="flex flex-col gap-5">
      <MarketGuide />

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => open({ ...EMPTY })} className="flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90">
          <Plus className="size-4" aria-hidden="true" />
          Yeni ürün
        </button>
        <label className="relative flex min-w-48 flex-1 items-center">
          <span className="sr-only">Ürünlerde ara</span>
          <Search className="pointer-events-none absolute left-3 size-4 text-muted-foreground" aria-hidden="true" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ürün ya da sponsor ara" className={cn(select, 'w-full pl-9')} />
        </label>
        <label>
          <span className="sr-only">Tür süzgeci</span>
          <select value={kind} onChange={(e) => setKind(e.target.value as KindFilter)} className={select}>
            {KINDS.map((k) => (
              <option key={k.id} value={k.id}>
                {k.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Stok süzgeci</span>
          <select value={stock} onChange={(e) => setStock(e.target.value as StockFilter)} className={select}>
            {STOCKS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <div role="group" aria-label="Görünüm" className="flex gap-1 rounded-lg border border-border bg-card p-1">
          {(
            [
              ['kart', 'Kart', LayoutGrid],
              ['tablo', 'Tablo', Rows3],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              aria-pressed={view === id}
              onClick={() => setView(id)}
              className={cn('flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold', view === id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
            >
              <Icon className="size-3.5" aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>{narrowed ? `${products.length} üründen ${visible.length} tanesi gösteriliyor.` : `${products.length} ürün.`}</span>
        <span>Tutamaçtan sürükleyerek sırala; market sayfası aynı sırayı kullanır.</span>
        <Flash ok={msg?.ok} text={msg?.text} token={msg} />
      </div>

      {lowStock.length > 0 && (
        <div role="status" className="flex flex-col gap-2 rounded-xl border border-primary/40 bg-primary/10 p-4 text-sm">
          <p className="flex items-center gap-2 font-semibold text-foreground">
            <PackageOpen className="size-4 text-primary" aria-hidden="true" />
            {`Stoku azalan ya da biten ${lowStock.length} ürün var`}
          </p>
          <ul className="flex flex-col gap-1 text-muted-foreground">
            {lowStock.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => open({ ...p })} className="font-medium text-foreground underline-offset-2 hover:underline">
                  {p.name}
                </button>
                {`: ${stockWarning(p.stock, p.total)} (toplam ${p.total})`}
              </li>
            ))}
          </ul>
          <p className="text-xs leading-relaxed text-muted-foreground">Ürünün adına basıp &quot;Kalan stok&quot; alanını artır. Satmayacaksan ürünü gizle; gizli ürün için uyarı çıkmaz.</p>
        </div>
      )}

      {visible.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {products.length === 0 ? 'Henüz ürün yok. "Yeni ürün" ile ilk ürünü ekle.' : 'Bu aramaya ya da süzgece uyan ürün yok.'}
        </p>
      ) : view === 'kart' ? (
        <SortableList
          items={visible}
          idOf={(p) => p.id}
          nameOf={(p) => p.name}
          onMove={move}
          disabled={sorting}
          layout="grid"
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
          itemClassName="rounded-xl"
        >
          {(p, handle) => (
            <div data-find={`product-${p.id}`} className={cn('flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card', !p.active && 'opacity-60')}>
              <div className="relative aspect-[16/9] bg-secondary">
                <Image src={productImage(p)} alt="" fill sizes="(min-width: 1280px) 25vw, (min-width: 640px) 40vw, 90vw" className="object-cover" />
                <div className="absolute left-2 top-2 rounded-md bg-background/85">{handle}</div>
                {!p.active && <span className="absolute right-2 top-2 rounded bg-background/85 px-2 py-0.5 text-[11px] font-bold uppercase text-foreground">Gizli</span>}
              </div>
              <div className="flex flex-1 flex-col gap-2 p-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  {owner(p)}
                  {delivery(p)}
                </div>
                <h3 className="text-sm font-semibold leading-snug text-foreground text-pretty">{p.name}</h3>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-sm font-semibold text-foreground tabular-nums">{`${p.price.toLocaleString('tr-TR')} KC`}</span>
                  {stockBadge(p)}
                  <span className="text-xs text-muted-foreground">{`Kişi başı ${p.perUser}`}</span>
                </div>
                <div className="mt-auto flex justify-end border-t border-border pt-2">{actions(p)}</div>
              </div>
            </div>
          )}
        </SortableList>
      ) : (
        <SortableList
          items={visible}
          idOf={(p) => p.id}
          nameOf={(p) => p.name}
          onMove={move}
          disabled={sorting}
          className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card"
          itemClassName="bg-card first:rounded-t-xl last:rounded-b-xl"
        >
          {(p, handle) => (
            <div data-find={`product-${p.id}`} className={cn('flex flex-wrap items-center gap-x-3 gap-y-2 p-2 pr-3 text-sm', !p.active && 'opacity-60')}>
              {handle}
              <span className="relative size-10 shrink-0 overflow-hidden rounded-md bg-secondary">
                <Image src={productImage(p)} alt="" fill sizes="40px" className="object-cover" />
              </span>
              <span className="flex min-w-40 flex-1 flex-col gap-1">
                <span className="font-medium text-foreground text-pretty">{p.name}</span>
                <span className="flex flex-wrap items-center gap-1.5">
                  {owner(p)}
                  {delivery(p)}
                </span>
              </span>
              <span className="w-24 text-right font-semibold text-foreground tabular-nums">{`${p.price.toLocaleString('tr-TR')} KC`}</span>
              <span className="w-32">{stockBadge(p)}</span>
              {actions(p)}
            </div>
          )}
        </SortableList>
      )}

      {editing && (
        <MarketProductForm
          key={editing.id ?? 'new'}
          value={editing}
          sponsors={sponsors}
          badges={badges}
          pending={pending}
          error={formError}
          onCancel={() => setEditing(null)}
          onSave={save}
        />
      )}
    </div>
  )
}
