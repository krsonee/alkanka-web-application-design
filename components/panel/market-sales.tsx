'use client'

import { useId, useState, useTransition, type ReactNode } from 'react'
import { CalendarClock, Loader2, Pencil, Percent, Plus, Power, Save, Search, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MarketProduct } from '@/lib/market'
import {
  SALE_MAX_PCT,
  SALE_MIN_PCT,
  SALE_SCOPES,
  afterPct,
  givesCoin,
  saleCovers,
  saleState,
  type MarketSale,
  type SaleInput,
  type SaleState,
} from '@/lib/market-shared'
import { TR_TZ, TR_ZONE_NOTE, trInput, trInputMs } from '@/lib/tr-time'
import { deleteMarketSaleAction, saveMarketSaleAction, toggleMarketSaleAction } from '@/app/panel/market-actions'
import { askConfirm } from '@/components/panel/confirm-dialog'
import { Flash } from '@/components/panel/flash'
import { SideSheet } from '@/components/panel/side-sheet'

const field = 'h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary'
const icon = 'rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-50'
const DAY = 86_400_000

const STATE: Record<SaleState, { label: string; className: string }> = {
  yayinda: { label: 'Yayında', className: 'bg-success/15 text-success' },
  bekliyor: { label: 'Başlamadı', className: 'bg-primary/15 text-primary' },
  kapali: { label: 'Durduruldu', className: 'bg-secondary text-foreground' },
  bitti: { label: 'Bitti', className: 'bg-secondary text-muted-foreground' },
}

const when = (iso: string) =>
  new Date(iso).toLocaleString('tr-TR', { timeZone: TR_TZ, day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })

const kc = (n: number) => `${n.toLocaleString('tr-TR')} KC`
const fold = (text: string | null) => (text ?? '').toLocaleLowerCase('tr')

const blank = (): SaleInput => ({
  id: null,
  name: '',
  pct: 20,
  startsAt: trInput(Date.now()),
  endsAt: trInput(Date.now() + 7 * DAY),
  scope: 'all',
  itemIds: [],
  active: true,
})

const toInput = (sale: MarketSale): SaleInput => ({ ...sale, startsAt: trInput(sale.startsAt), endsAt: trInput(sale.endsAt) })

export function MarketSales({ sales, products }: { sales: MarketSale[]; products: MarketProduct[] }) {
  const [editing, setEditing] = useState<SaleInput | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, start] = useTransition()

  const covered = (sale: Pick<MarketSale, 'scope' | 'itemIds'>) => products.filter((p) => p.active && saleCovers(sale, p))

  function run(p: Promise<{ ok: true; message?: string } | { ok: false; error: string }>) {
    start(async () => {
      const res = await p
      setMsg(res.ok ? { ok: true, text: res.message ?? 'Kaydedildi.' } : { ok: false, text: res.error })
    })
  }

  function save(input: SaleInput) {
    setFormError(null)
    start(async () => {
      const res = await saveMarketSaleAction(input)
      if (!res.ok) return setFormError(res.error)
      setMsg({ ok: true, text: res.message ?? 'Kampanya kaydedildi.' })
      setEditing(null)
    })
  }

  function open(input: SaleInput) {
    setFormError(null)
    setEditing(input)
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4 text-sm leading-relaxed text-muted-foreground">
        <p className="flex items-center gap-2 font-semibold text-foreground">
          <Percent className="size-4 text-primary" aria-hidden="true" />
          İndirim kampanyası nasıl çalışır?
        </p>
        <p className="text-pretty">
          Yüzdeyi, başlangıç ve bitiş tarihini seçersin. Kampanya başlangıç saatinde kendiliğinden başlar, bitiş saatinde kendiliğinden biter; senin bir şeye basman gerekmez. Sitede ürünün eski
          fiyatı üstü çizili, yeni fiyatı yanında görünür.
        </p>
        <p className="text-pretty">
          Bir ürüne aynı anda iki kampanya denk gelirse indirimler toplanmaz, yüksek olan uygulanır. Kanka Coin veren ürünler hiçbir kampanyaya girmez. Avatarlar ve masa temaları kendi
          fiyatlarıyla satılır, bu kampanyalar onlara işlemez.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => open(blank())} className="flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90">
          <Plus className="size-4" aria-hidden="true" />
          Yeni kampanya
        </button>
        <span className="text-xs text-muted-foreground">{sales.length ? `${sales.length} kampanya.` : ''}</span>
        <Flash ok={msg?.ok} text={msg?.text} token={msg} />
      </div>

      {sales.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Henüz kampanya yok. &quot;Yeni kampanya&quot; ile ilkini oluştur.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
          {sales.map((sale) => {
            const state = saleState(sale)
            const scope = SALE_SCOPES.find((s) => s.id === sale.scope)?.label ?? 'Bütün ürünler'
            const count = covered(sale).length
            return (
              <li key={sale.id} data-find={`sale-${sale.id}`} className={cn('flex flex-wrap items-center gap-x-4 gap-y-2 p-3', state === 'bitti' && 'opacity-70')}>
                <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary/15 font-display text-base font-bold text-primary tabular-nums">{`%${sale.pct}`}</span>
                <div className="flex min-w-48 flex-1 flex-col gap-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-foreground text-pretty">{sale.name}</span>
                    <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', STATE[state].className)}>{STATE[state].label}</span>
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CalendarClock className="size-3.5 shrink-0" aria-hidden="true" />
                    {`${when(sale.startsAt)} → ${when(sale.endsAt)}`}
                  </span>
                  <span className="text-xs text-muted-foreground">{`${scope} · yayındaki ${count} ürüne işliyor`}</span>
                </div>
                <div className="flex items-center gap-0.5">
                  {state !== 'bitti' && (
                    <button
                      type="button"
                      aria-pressed={sale.active}
                      aria-label={sale.active ? `${sale.name} durdurulsun` : `${sale.name} açılsın`}
                      title={sale.active ? 'Durdur' : 'Aç'}
                      disabled={pending}
                      onClick={() => run(toggleMarketSaleAction(sale.id, !sale.active))}
                      className={cn(icon, sale.active && 'text-success hover:text-success')}
                    >
                      <Power className="size-4" aria-hidden="true" />
                    </button>
                  )}
                  <button type="button" aria-label={`${sale.name} düzenle`} title="Düzenle" onClick={() => open(toInput(sale))} className={icon}>
                    <Pencil className="size-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    aria-label={`${sale.name} sil`}
                    title="Sil"
                    disabled={pending}
                    onClick={() =>
                      void askConfirm(`${sale.name} silinsin mi?${state === 'yayinda' ? ' Kampanya yayında; silince fiyatlar hemen normale döner.' : ''}`).then(
                        (ok) => ok && run(deleteMarketSaleAction(sale.id)),
                      )
                    }
                    className={cn(icon, 'hover:text-destructive')}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {editing && (
        <SaleForm key={editing.id ?? 'new'} value={editing} products={products} pending={pending} error={formError} onCancel={() => setEditing(null)} onSave={save} />
      )}
    </div>
  )
}

function SaleForm({
  value,
  products,
  pending,
  error,
  onSave,
  onCancel,
}: {
  value: SaleInput
  products: MarketProduct[]
  pending: boolean
  error: string | null
  onSave: (v: SaleInput) => void
  onCancel: () => void
}) {
  const formId = useId()
  const [v, setV] = useState(value)
  const [query, setQuery] = useState('')
  const set = <K extends keyof SaleInput>(k: K, x: SaleInput[K]) => setV((p) => ({ ...p, [k]: x }))

  const pct = Math.min(SALE_MAX_PCT, Math.max(0, Math.floor(Number(v.pct) || 0)))
  const hit = products.filter((p) => p.active && saleCovers(v, p))
  const needle = fold(query.trim())
  const pickable = products.filter((p) => !needle || [p.name, p.sponsorName, p.type].some((text) => fold(text).includes(needle)))
  const backwards = Boolean(v.startsAt && v.endsAt) && trInputMs(v.endsAt) <= trInputMs(v.startsAt)

  function toggle(id: string, on: boolean) {
    setV((p) => ({ ...p, itemIds: on ? [...p.itemIds, id] : p.itemIds.filter((x) => x !== id) }))
  }

  return (
    <SideSheet
      size="lg"
      eyebrow={value.id ? 'Kampanyayı düzenle' : 'Market'}
      title={value.id ? value.name : 'Yeni indirim kampanyası'}
      onClose={onCancel}
      footer={
        <>
          <button
            form={formId}
            disabled={pending}
            className="flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />}
            {pending ? 'Kaydediliyor…' : value.id ? 'Kaydet' : 'Kampanyayı oluştur'}
          </button>
          {error && (
            <p role="alert" className="min-w-0 flex-1 text-sm leading-relaxed text-destructive text-pretty">
              {error}
            </p>
          )}
        </>
      }
    >
      <form
        id={formId}
        data-no-guard
        onSubmit={(e) => {
          e.preventDefault()
          onSave(v)
        }}
        className="grid gap-4 md:grid-cols-2"
      >
        <Label text="Kampanya adı (markette üyeye görünür)" wide>
          <input required value={v.name} onChange={(e) => set('name', e.target.value)} maxLength={80} className={field} placeholder="Örn: Hafta sonu indirimi" />
        </Label>
        <Label text={`İndirim yüzdesi (${SALE_MIN_PCT} - ${SALE_MAX_PCT})`}>
          <input type="number" inputMode="numeric" required min={SALE_MIN_PCT} max={SALE_MAX_PCT} value={v.pct} onChange={(e) => set('pct', Number(e.target.value))} className={field} />
        </Label>
        <div className="hidden md:block" aria-hidden="true" />
        <Label text="Başlangıç">
          <input type="datetime-local" required value={v.startsAt} onChange={(e) => set('startsAt', e.target.value)} className={field} />
        </Label>
        <Label text="Bitiş">
          <input type="datetime-local" required value={v.endsAt} onChange={(e) => set('endsAt', e.target.value)} className={field} aria-invalid={backwards} />
        </Label>
        <p className={cn('text-xs leading-relaxed md:col-span-2', backwards ? 'text-destructive' : 'text-muted-foreground')}>
          {backwards ? 'Bitiş tarihi başlangıçtan sonra olmalı.' : `Tarihler ${TR_ZONE_NOTE}. Kampanya başlangıç saatinde kendiliğinden başlar, bitiş saatinde kendiliğinden biter.`}
        </p>

        <fieldset className="flex flex-col gap-2 md:col-span-2">
          <legend className="pb-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">Hangi ürünler?</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {SALE_SCOPES.map((s) => (
              <label key={s.id} className={cn('flex cursor-pointer gap-3 rounded-xl border p-3 text-sm', v.scope === s.id ? 'border-primary bg-primary/10' : 'border-border bg-background')}>
                <input type="radio" name="scope" checked={v.scope === s.id} onChange={() => set('scope', s.id)} className="mt-1" />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="font-semibold text-foreground">{s.label}</span>
                  <span className="text-xs leading-relaxed text-muted-foreground text-pretty">{s.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {v.scope === 'items' && (
          <div className="flex flex-col gap-2 md:col-span-2">
            <label className="relative flex items-center">
              <span className="sr-only">Ürünlerde ara</span>
              <Search className="pointer-events-none absolute left-3 size-4 text-muted-foreground" aria-hidden="true" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ürün ya da sponsor ara" className={cn(field, 'pl-9')} />
            </label>
            <ul className="flex max-h-72 flex-col divide-y divide-border overflow-y-auto rounded-xl border border-border bg-background">
              {pickable.length === 0 && <li className="p-3 text-sm text-muted-foreground">Bu aramaya uyan ürün yok.</li>}
              {pickable.map((p) => {
                const coin = givesCoin(p)
                return (
                  <li key={p.id}>
                    <label className={cn('flex items-center gap-3 px-3 py-2 text-sm', coin ? 'cursor-not-allowed opacity-60' : 'cursor-pointer')}>
                      <input type="checkbox" disabled={coin} checked={!coin && v.itemIds.includes(p.id)} onChange={(e) => toggle(p.id, e.target.checked)} />
                      <span className="min-w-0 flex-1 text-foreground text-pretty">
                        {p.name}
                        {!p.active && <span className="text-muted-foreground"> · gizli</span>}
                        {coin && <span className="text-muted-foreground"> · coin verdiği için indirime girmez</span>}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{kc(p.price)}</span>
                    </label>
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        <div className="flex flex-col gap-2 rounded-xl border border-primary/40 bg-primary/5 p-3 md:col-span-2" aria-live="polite">
          <p className="text-sm font-semibold text-foreground">{hit.length ? `Yayındaki ${hit.length} ürün indirime girer` : 'Bu seçimle indirime giren yayında ürün yok'}</p>
          {pct > 0 && hit.length > 0 && (
            <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
              {hit.slice(0, 5).map((p) => (
                <li key={p.id} className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="min-w-0 truncate">{p.name}</span>
                  <span className="tabular-nums">
                    <s>{kc(p.price)}</s> <b className="text-foreground">{kc(afterPct(p.price, pct))}</b>
                  </span>
                </li>
              ))}
              {hit.length > 5 && <li>{`ve ${hit.length - 5} ürün daha`}</li>}
            </ul>
          )}
          <p className="text-xs leading-relaxed text-muted-foreground text-pretty">
            Görevle indirimli bir üründe üye, kampanya fiyatı ile görev fiyatından hangisi düşükse onu öder; ikisi üst üste binmez.
          </p>
        </div>

        <label className="flex items-start gap-2 text-sm leading-relaxed text-foreground md:col-span-2">
          <input type="checkbox" checked={v.active} onChange={(e) => set('active', e.target.checked)} className="mt-1" />
          Kampanya açık (kapalıysa tarihi gelse de başlamaz)
        </label>
      </form>
    </SideSheet>
  )
}

function Label({ text, wide, children }: { text: string; wide?: boolean; children: ReactNode }) {
  return (
    <label className={cn('flex flex-col gap-1 text-xs text-muted-foreground', wide && 'md:col-span-2')}>
      {text}
      {children}
    </label>
  )
}
