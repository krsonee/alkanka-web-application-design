'use client'

import { useActionState, useState } from 'react'
import { AlertTriangle, CalendarClock, Copy, Eye, MousePointerClick, Trash2 } from 'lucide-react'
import { saveAds, type ActionState } from '@/app/panel/actions'
import { AD_PAGES, AD_POSITIONS, type AdMap, type AdPage, type AdPosition, type AdSlot } from '@/lib/ads'
import { formatLocal, scheduleState } from '@/lib/schedule'
import { ImageField } from '@/components/panel/image-field'
import { cn } from '@/lib/utils'

type SlotKey = `${AdPage}:${AdPosition}`
type Stats = Record<string, { views: number; clicks: number }>

const EXPECTED: Record<AdPosition, { w: number; h: number }> = {
  top: { w: 1200, h: 150 },
  left: { w: 160, h: 600 },
  right: { w: 160, h: 600 },
}

const input =
  'h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none'

const emptySlot: AdSlot = { image: '', href: '', alt: '' }

export function AdsEditor({ saved, stats = {} }: { saved: AdMap; stats?: Stats }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveAds, {})
  const [slots, setSlots] = useState<Record<string, AdSlot>>(() => {
    const out: Record<string, AdSlot> = {}
    for (const p of AD_PAGES) for (const pos of AD_POSITIONS) out[`${p.id}:${pos.id}`] = { ...emptySlot, ...saved[`${p.id}:${pos.id}` as SlotKey] }
    return out
  })
  const [page, setPage] = useState<AdPage>(AD_PAGES[0].id)
  const [pos, setPos] = useState<AdPosition>('top')
  const [sizeWarn, setSizeWarn] = useState<Record<string, string>>({})
  const key = `${page}:${pos}` as SlotKey
  const current = slots[key]
  const posMeta = AD_POSITIONS.find((p) => p.id === pos)!

  const update = (k: string, patch: Partial<AdSlot>) => setSlots((s) => ({ ...s, [k]: { ...s[k], ...patch } }))

  const checkSize = (k: string, position: AdPosition, url: string) => {
    if (!url) return setSizeWarn((w) => ({ ...w, [k]: '' }))
    const img = new window.Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const exp = EXPECTED[position]
      const ratio = img.naturalWidth / img.naturalHeight
      const off = Math.abs(ratio - exp.w / exp.h) / (exp.w / exp.h) > 0.15
      setSizeWarn((w) => ({
        ...w,
        [k]: off ? `Görsel ${img.naturalWidth}×${img.naturalHeight}. Bu alan ${exp.w}×${exp.h} oranında; kenarlar kırpılabilir.` : '',
      }))
    }
    img.src = url
  }

  const applyToAll = () => {
    if (!confirm(`Bu reklam bütün sayfaların "${posMeta.label}" alanına kopyalansın mı?`)) return
    setSlots((s) => {
      const next = { ...s }
      for (const p of AD_PAGES) next[`${p.id}:${pos}`] = { ...current }
      return next
    })
  }

  const filledCount = (p: AdPage) => AD_POSITIONS.filter((x) => slots[`${p}:${x.id}`]?.image).length

  return (
    <form action={action} className="flex flex-col gap-5">
      {Object.entries(slots).map(([k, s]) => (
        <div key={k} hidden>
          <input type="hidden" name={`${k}:image`} value={s.image} />
          <input type="hidden" name={`${k}:href`} value={s.href} />
          <input type="hidden" name={`${k}:alt`} value={s.alt} />
          <input type="hidden" name={`${k}:startAt`} value={s.startAt ?? ''} />
          <input type="hidden" name={`${k}:endAt`} value={s.endAt ?? ''} />
        </div>
      ))}

      <div className="flex flex-col gap-1">
        <h2 className="font-display text-lg font-bold uppercase text-foreground">Sponsor reklam alanları</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Sayfayı seç, şemada düzenlemek istediğin alana tıkla. Boş bıraktığın alan sitede görünmez; kuleler mobilde içeriğin altına iner.
        </p>
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Sayfalar">
        {AD_PAGES.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={page === p.id}
            onClick={() => setPage(p.id)}
            className={cn(
              'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold',
              page === p.id ? 'border-primary bg-primary/10 text-foreground' : 'border-border bg-card text-muted-foreground hover:text-foreground',
            )}
          >
            {p.label}
            <span className="rounded-full bg-secondary px-1.5 text-xs tabular-nums text-foreground">{`${filledCount(p.id)}/3`}</span>
          </button>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
          <span className="text-xs font-semibold text-muted-foreground">Sayfa şeması</span>
          <div className="flex flex-col gap-3 rounded-xl bg-background p-3">
            <SchemaBox k={`${page}:top`} slot={slots[`${page}:top`]} label="Üst banner" active={pos === 'top'} onClick={() => setPos('top')} className="h-20" />
            <div className="flex gap-3">
              <SchemaBox k={`${page}:left`} slot={slots[`${page}:left`]} label="Sol kule" active={pos === 'left'} onClick={() => setPos('left')} className="h-72 w-20 shrink-0" />
              <div className="flex flex-1 flex-col gap-2 rounded-lg border border-dashed border-border p-3">
                <span className="h-3 w-2/3 rounded bg-secondary" />
                <span className="h-3 w-1/2 rounded bg-secondary" />
                <span className="mt-2 h-24 rounded bg-secondary" />
                <span className="h-3 w-3/4 rounded bg-secondary" />
                <span className="mt-auto text-center text-xs text-muted-foreground">Sayfa içeriği</span>
              </div>
              <SchemaBox k={`${page}:right`} slot={slots[`${page}:right`]} label="Sağ kule" active={pos === 'right'} onClick={() => setPos('right')} className="h-72 w-20 shrink-0" />
            </div>
          </div>
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-primary" />Dolu</span>
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm border border-dashed border-muted-foreground" />Boş</span>
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-destructive" />Zamanı dışında</span>
          </div>
        </div>

        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col">
              <span className="font-display text-base font-bold text-foreground">{`${AD_PAGES.find((p) => p.id === page)!.label} · ${posMeta.label}`}</span>
              <span className="text-xs text-muted-foreground">{`Önerilen boyut: ${posMeta.size}`}</span>
            </div>
            {stats[key] && (
              <span className="flex shrink-0 items-center gap-3 rounded-lg bg-secondary px-2.5 py-1.5 text-xs tabular-nums text-foreground" title="Son 30 gün">
                <span className="flex items-center gap-1"><Eye className="size-3.5" aria-hidden="true" />{stats[key].views.toLocaleString('tr-TR')}<span className="sr-only">gösterim</span></span>
                <span className="flex items-center gap-1"><MousePointerClick className="size-3.5" aria-hidden="true" />{stats[key].clicks.toLocaleString('tr-TR')}<span className="sr-only">tıklanma</span></span>
                {stats[key].views > 0 && <span>{`%${((stats[key].clicks / stats[key].views) * 100).toFixed(1)}`}</span>}
              </span>
            )}
          </div>

          <ImageField
            key={key}
            label="Reklam görseli"
            value={current.image}
            onChange={(url) => {
              update(key, { image: url })
              checkSize(key, pos, url)
            }}
            uploadId={`ad-${page}-${pos}`}
            placeholder="GIF, PNG veya JPG"
          />
          {sizeWarn[key] && (
            <p className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              {sizeWarn[key]}
            </p>
          )}
          <label className="flex flex-col gap-1.5 text-sm text-foreground">
            Tıklanınca gidilecek link
            <input value={current.href} onChange={(e) => update(key, { href: e.target.value })} placeholder="https://sponsor.com" className={input} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm text-foreground">
            Sponsor adı
            <input value={current.alt} onChange={(e) => update(key, { alt: e.target.value })} placeholder="Örn. Makrobet" className={input} />
            <span className="text-xs text-muted-foreground">Görsel yüklenmezse ve ekran okuyucularda bu isim görünür.</span>
          </label>
          <fieldset className="flex flex-col gap-2 rounded-lg border border-border bg-background p-3">
            <legend className="flex items-center gap-1 px-1 text-xs font-semibold text-muted-foreground">
              <CalendarClock className="size-3.5" aria-hidden="true" />
              Yayın zamanı (isteğe bağlı)
            </legend>
            <div className="grid grid-cols-2 gap-2">
              {(['startAt', 'endAt'] as const).map((f) => (
                <label key={f} className="flex flex-col gap-1 text-xs text-foreground">
                  {f === 'startAt' ? 'Başlangıç' : 'Bitiş'}
                  <input
                    type="datetime-local"
                    value={current[f] ?? ''}
                    onChange={(e) => update(key, { [f]: e.target.value })}
                    className="rounded-md border border-input bg-card px-2 py-1.5 text-sm text-foreground outline-none [color-scheme:dark] focus:border-primary"
                  />
                </label>
              ))}
            </div>
            <span className="text-xs text-muted-foreground">Sponsor anlaşması bitince reklam kendiliğinden kalkar. Türkiye saatiyle.</span>
          </fieldset>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!current.image}
              onClick={applyToAll}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary disabled:opacity-40"
            >
              <Copy className="size-3.5" aria-hidden="true" />
              Tüm sayfalara uygula
            </button>
            <button
              type="button"
              disabled={!current.image}
              onClick={() => update(key, { ...emptySlot, startAt: '', endAt: '' })}
              className="flex items-center gap-1.5 rounded-lg border border-destructive/40 px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-secondary disabled:opacity-40"
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
              Alanı boşalt
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="h-10 rounded-lg bg-primary px-5 text-sm font-bold text-primary-foreground disabled:opacity-60">
          {pending ? 'Kaydediliyor…' : 'Reklamları kaydet'}
        </button>
        {state.message && (
          <p role="status" className={state.ok ? 'text-sm text-live' : 'text-sm text-destructive'}>
            {state.message}
          </p>
        )}
      </div>
    </form>
  )
}

function SchemaBox({
  k,
  slot,
  label,
  active,
  onClick,
  className,
}: {
  k: string
  slot?: AdSlot
  label: string
  active: boolean
  onClick: () => void
  className?: string
}) {
  const filled = !!slot?.image
  const off = filled && scheduleState(slot!) !== 'live'
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={`${label}${filled ? ' (dolu)' : ' (boş)'}`}
      data-slot={k}
      className={cn(
        'relative flex items-center justify-center overflow-hidden rounded-lg text-xs font-semibold transition-colors',
        filled ? 'bg-primary/15 text-foreground' : 'border border-dashed border-muted-foreground/50 text-muted-foreground hover:border-primary',
        off && 'bg-destructive/15',
        active && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
      )}
    >
      {filled && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={slot!.image || '/placeholder.svg'} alt="" className="absolute inset-0 size-full object-cover opacity-70" />
      )}
      <span className="relative rounded bg-background/80 px-1.5 py-0.5 text-center leading-tight">
        {label}
        {off && <span className="block text-[10px] text-destructive">{slot!.endAt && scheduleState(slot!) === 'ended' ? `${formatLocal(slot!.endAt)} bitti` : 'Henüz başlamadı'}</span>}
      </span>
    </button>
  )
}
