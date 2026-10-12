'use client'

import { useState, useTransition } from 'react'
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MarketProduct, MarketRequest, ProductInput } from '@/lib/market'
import { deleteMarketProductAction, resolveMarketRequestAction, saveMarketProductAction } from '@/app/panel/market-actions'
import { ImageField } from '@/components/panel/image-field'

type SponsorOption = { id: string; name: string }

const EMPTY: ProductInput = {
  id: null, kind: 'sponsor', sponsorId: null, sponsorName: null, type: 'SPONSOR BONUSU', name: '', description: '', delivery: '',
  rules: [], image: '', price: 1000, stock: 10, total: 10, perUser: 1, needsUsername: true, active: true, sort: 0,
}

const field = 'h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary'

export function MarketManager({ products, requests, sponsors }: { products: MarketProduct[]; requests: MarketRequest[]; sponsors: SponsorOption[] }) {
  const [view, setView] = useState<'talepler' | 'urunler'>('talepler')
  const [editing, setEditing] = useState<ProductInput | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, start] = useTransition()
  const waiting = requests.filter((r) => r.status === 'beklemede')

  function run(p: Promise<{ ok: true; message?: string } | { ok: false; error: string }>, after?: () => void) {
    start(async () => {
      const res = await p
      setMsg(res.ok ? { ok: true, text: res.message ?? 'Kaydedildi.' } : { ok: false, text: res.error })
      if (res.ok) after?.()
    })
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            ['talepler', `Talepler${waiting.length ? ` (${waiting.length} bekliyor)` : ''}`],
            ['urunler', `Ürünler (${products.length})`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setView(key)}
            className={cn(
              'rounded-lg px-4 py-2 text-sm font-semibold',
              view === key ? 'bg-primary text-primary-foreground' : 'border border-border bg-card text-muted-foreground hover:text-foreground',
            )}
          >
            {label}
          </button>
        ))}
        {msg && <p className={cn('text-sm', msg.ok ? 'text-success' : 'text-destructive')} aria-live="polite">{msg.text}</p>}
      </div>

      {view === 'talepler' ? (
        <RequestList requests={requests} pending={pending} onResolve={(id, ok, note) => run(resolveMarketRequestAction(id, ok, note))} />
      ) : (
        <div className="flex flex-col gap-4">
          <button
            type="button"
            onClick={() => setEditing({ ...EMPTY })}
            className="flex h-10 items-center gap-2 self-start rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground"
          >
            <Plus className="size-4" aria-hidden="true" />
            Yeni ürün / sponsor bonusu
          </button>

          {editing && (
            <ProductForm
              value={editing}
              sponsors={sponsors}
              pending={pending}
              onCancel={() => setEditing(null)}
              onSave={(v) => run(saveMarketProductAction(v), () => setEditing(null))}
            />
          )}

          <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
            {products.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                <span className={cn('rounded px-2 py-0.5 text-[10px] font-bold uppercase', p.kind === 'sponsor' ? 'bg-accent text-accent-foreground' : 'bg-secondary text-foreground')}>
                  {p.kind === 'sponsor' ? p.sponsorName : 'AL KANKA'}
                </span>
                <span className={cn('min-w-0 flex-1 font-medium text-foreground', !p.active && 'opacity-50')}>{p.name}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{p.price.toLocaleString('tr-TR')} KC</span>
                <span className={cn('text-xs tabular-nums', p.stock > 0 ? 'text-muted-foreground' : 'text-destructive')}>Stok {p.stock}/{p.total}</span>
                <button type="button" aria-label={`${p.name} düzenle`} onClick={() => setEditing({ ...p })} className="rounded-md p-1.5 text-muted-foreground hover:text-foreground">
                  <Pencil className="size-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label={`${p.name} sil`}
                  onClick={() => confirm(`${p.name} silinsin mi?`) && run(deleteMarketProductAction(p.id))}
                  className="rounded-md p-1.5 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function RequestList({ requests, pending, onResolve }: { requests: MarketRequest[]; pending: boolean; onResolve: (id: number, ok: boolean, note: string) => void }) {
  const [notes, setNotes] = useState<Record<number, string>>({})
  if (!requests.length) return <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Henüz talep yok.</p>
  return (
    <ul className="flex flex-col gap-2">
      {requests.map((r) => (
        <li key={r.id} className={cn('flex flex-col gap-2 rounded-xl border bg-card p-3', r.status === 'beklemede' ? 'border-primary/50' : 'border-border opacity-75')}>
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="font-semibold text-foreground">{r.itemName}</span>
            <span className="text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleString('tr-TR')}</span>
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
            <div><dt className="text-muted-foreground">Üye</dt><dd className="font-medium text-foreground">{r.userName}</dd></div>
            <div><dt className="text-muted-foreground">Site</dt><dd className="font-medium text-foreground">{r.sponsorName ?? 'AL KANKA'}</dd></div>
            <div><dt className="text-muted-foreground">Site kullanıcı adı</dt><dd className="select-all font-mono font-bold text-primary">{r.siteUsername ?? '—'}</dd></div>
            <div><dt className="text-muted-foreground">Tutar</dt><dd className="font-medium text-foreground tabular-nums">{r.price.toLocaleString('tr-TR')} KC</dd></div>
          </dl>
          {r.status === 'beklemede' ? (
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={notes[r.id] ?? ''}
                onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                placeholder="Not (opsiyonel, üyeye görünür)"
                className={cn(field, 'min-w-0 flex-1')}
              />
              <button type="button" disabled={pending} onClick={() => onResolve(r.id, true, notes[r.id] ?? '')} className="flex h-10 items-center gap-1.5 rounded-lg bg-success px-3 text-sm font-semibold text-background disabled:opacity-50">
                <Check className="size-4" aria-hidden="true" /> Onayla
              </button>
              <button type="button" disabled={pending} onClick={() => onResolve(r.id, false, notes[r.id] ?? '')} className="flex h-10 items-center gap-1.5 rounded-lg border border-destructive/50 px-3 text-sm font-semibold text-destructive disabled:opacity-50">
                <X className="size-4" aria-hidden="true" /> Reddet ve iade et
              </button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              {r.status === 'onaylandi' ? 'Onaylandı' : 'Reddedildi (KC iade edildi)'}
              {r.note && ` · ${r.note}`}
            </p>
          )}
        </li>
      ))}
    </ul>
  )
}

function ProductForm({ value, sponsors, pending, onSave, onCancel }: { value: ProductInput; sponsors: SponsorOption[]; pending: boolean; onSave: (v: ProductInput) => void; onCancel: () => void }) {
  const [v, setV] = useState(value)
  const set = <K extends keyof ProductInput>(k: K, x: ProductInput[K]) => setV((p) => ({ ...p, [k]: x }))
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSave(v)
      }}
      className="grid gap-3 rounded-xl border border-primary/40 bg-card p-4 sm:grid-cols-2"
    >
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Tür
        <select value={v.kind} onChange={(e) => set('kind', e.target.value as ProductInput['kind'])} className={field}>
          <option value="sponsor">Sponsor site bonusu</option>
          <option value="alkanka">AL KANKA ödülü</option>
        </select>
      </label>
      {v.kind === 'sponsor' ? (
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Sponsor site
          <select
            required
            value={v.sponsorId ?? ''}
            onChange={(e) => {
              const s = sponsors.find((x) => x.id === e.target.value)
              setV((p) => ({ ...p, sponsorId: s?.id ?? null, sponsorName: s?.name ?? null }))
            }}
            className={field}
          >
            <option value="">Seç</option>
            {sponsors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
      ) : (
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Etiket
          <input value={v.type} onChange={(e) => set('type', e.target.value)} className={field} placeholder="ROZET, HEDİYE, VIP..." />
        </label>
      )}
      <label className="flex flex-col gap-1 text-xs text-muted-foreground sm:col-span-2">
        Ürün / bonus adı
        <input required value={v.name} onChange={(e) => set('name', e.target.value)} className={field} placeholder="Örn: 500 TL deneme bonusu" />
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground sm:col-span-2">
        Açıklama
        <textarea value={v.description} onChange={(e) => set('description', e.target.value)} rows={2} className={cn(field, 'h-auto py-2')} />
      </label>
      {(
        [
          ['price', 'Fiyat (KC)'],
          ['stock', 'Kalan stok'],
          ['total', 'Toplam stok'],
          ['perUser', 'Kişi başı limit'],
        ] as const
      ).map(([k, label]) => (
        <label key={k} className="flex flex-col gap-1 text-xs text-muted-foreground">
          {label}
          <input type="number" min={k === 'price' || k === 'perUser' ? 1 : 0} value={v[k]} onChange={(e) => set(k, Number(e.target.value))} className={field} />
        </label>
      ))}
      <div className="flex flex-col gap-1 text-xs text-muted-foreground sm:col-span-2">
        Görsel URL
        <ImageField label="Ürün görseli" value={v.image} onChange={(image) => set('image', image)} placeholder="/images/tile-market.png veya https://..." />
      </div>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground sm:col-span-2">
        Teslimat notu
        <input value={v.delivery} onChange={(e) => set('delivery', e.target.value)} className={field} />
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground sm:col-span-2">
        Kurallar (her satır bir kural)
        <textarea value={v.rules.join('\n')} onChange={(e) => set('rules', e.target.value.split('\n'))} rows={3} className={cn(field, 'h-auto py-2')} />
      </label>
      <div className="flex flex-wrap items-center gap-4 text-sm text-foreground sm:col-span-2">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={v.needsUsername || v.kind === 'sponsor'} disabled={v.kind === 'sponsor'} onChange={(e) => set('needsUsername', e.target.checked)} />
          Kullanıcı adı sor
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={v.active} onChange={(e) => set('active', e.target.checked)} />
          Markette göster
        </label>
        <div className="ml-auto flex gap-2">
          <button type="button" onClick={onCancel} className="h-10 rounded-lg border border-border px-4 font-semibold text-muted-foreground">Vazgeç</button>
          <button type="submit" disabled={pending} className="h-10 rounded-lg bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-50">Kaydet</button>
        </div>
      </div>
    </form>
  )
}
