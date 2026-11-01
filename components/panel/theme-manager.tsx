'use client'

import { useState, useTransition } from 'react'
import { cn } from '@/lib/utils'
import {
  MAX_THEME_LEVEL,
  TABLE_THEMES,
  THEME_CATEGORIES,
  THEME_RARITY,
  THEME_SOURCE,
  type ThemeCategory,
  type ThemeOffer,
  type ThemeSource,
} from '@/lib/table-themes'
import { saveThemeOfferAction } from '@/app/panel/theme-actions'

const field = 'h-9 rounded-lg border border-border bg-background px-2 text-sm text-foreground outline-none focus:border-primary'

export function ThemeManager({ catalog }: { catalog: Record<string, ThemeOffer> }) {
  const [cat, setCat] = useState<ThemeCategory>('fan')
  const list = TABLE_THEMES.filter((t) => t.cat === cat)

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm leading-relaxed text-muted-foreground">
        Her temanın kaynağını (ücretsiz, mağaza, görev ödülü), KC fiyatını ve kullanmak için gereken rozet seviyesini buradan ayarla. Görev ödülü temalar
        Görevler bölümündeki tema ödüllü görevlerle verilir.
      </p>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Tema kategorileri">
        {(Object.keys(THEME_CATEGORIES) as ThemeCategory[]).map((c) => (
          <button
            key={c}
            type="button"
            role="tab"
            aria-selected={cat === c}
            onClick={() => setCat(c)}
            className={cn(
              'rounded-lg px-4 py-2 text-sm font-semibold',
              cat === c ? 'bg-primary text-primary-foreground' : 'border border-border bg-card text-muted-foreground hover:text-foreground',
            )}
          >
            {THEME_CATEGORIES[c]}
          </button>
        ))}
      </div>
      <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
        {list.map((t) => (
          <ThemeRow key={t.id} name={t.name} rarity={THEME_RARITY[t.rarity]} offer={catalog[t.id]} />
        ))}
      </ul>
    </div>
  )
}

function ThemeRow({ name, rarity, offer }: { name: string; rarity: string; offer: ThemeOffer }) {
  const [v, setV] = useState(offer)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, start] = useTransition()
  const dirty = JSON.stringify(v) !== JSON.stringify(offer)

  function save() {
    start(async () => {
      const res = await saveThemeOfferAction(v)
      setMsg(res.ok ? { ok: true, text: 'Kaydedildi' } : { ok: false, text: res.error })
    })
  }

  return (
    <li className="flex flex-wrap items-center gap-3 p-3 text-sm">
      <div className={cn('flex min-w-40 flex-1 flex-col', !v.active && 'opacity-50')}>
        <span className="font-medium text-foreground">{name}</span>
        <span className="text-xs text-muted-foreground">{rarity}</span>
      </div>
      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
        Kaynak
        <select className={field} value={v.source} onChange={(e) => setV({ ...v, source: e.target.value as ThemeSource })}>
          {(Object.keys(THEME_SOURCE) as ThemeSource[]).map((s) => (
            <option key={s} value={s}>
              {THEME_SOURCE[s]}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
        KC
        <input
          type="number"
          min={0}
          className={cn(field, 'w-24 tabular-nums')}
          value={v.source === 'shop' ? v.price : 0}
          disabled={v.source !== 'shop'}
          onChange={(e) => setV({ ...v, price: Number(e.target.value) })}
        />
      </label>
      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
        Lv
        <input
          type="number"
          min={1}
          max={MAX_THEME_LEVEL}
          className={cn(field, 'w-16 tabular-nums')}
          value={v.minLevel}
          onChange={(e) => setV({ ...v, minLevel: Number(e.target.value) })}
        />
      </label>
      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <input type="checkbox" checked={v.active} onChange={(e) => setV({ ...v, active: e.target.checked })} className="size-4 accent-primary" />
        Aktif
      </label>
      <button
        type="button"
        onClick={save}
        disabled={!dirty || pending}
        className="h-9 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:opacity-40"
      >
        {pending ? 'Kaydediliyor' : 'Kaydet'}
      </button>
      {msg && (
        <span className={cn('text-xs', msg.ok ? 'text-success' : 'text-destructive')} aria-live="polite">
          {msg.text}
        </span>
      )}
    </li>
  )
}
