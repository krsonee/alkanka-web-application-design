'use client'

import { useState, useTransition } from 'react'
import { Pencil, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { saveSiteAction } from '@/app/panel/site-actions'
import { SITE_BADGES, type SiteInput, type SponsorSite } from '@/lib/sites-shared'

const field = 'h-10 w-full rounded-lg border border-border bg-background px-3 text-sm font-normal text-foreground outline-none focus:border-primary'
const EMPTY: SiteInput = {
  id: null,
  name: '',
  logoUrl: '',
  bonusText: '',
  url: '',
  entryUrl: '',
  domain: '',
  badge: '',
  featured: false,
  active: true,
  sortOrder: 0,
  tagline: '',
  perks: '',
  rating: 0,
  payout: '',
  bonusType: '',
  wagerText: '',
  bonusCode: '',
}

const BADGE_LABEL: Record<(typeof SITE_BADGES)[number], string> = {
  '': 'Güvenilir',
  'Ana Sponsor': 'Ana sponsor',
  VIP: 'VIP',
}

export function SitesManager({ sites }: { sites: SponsorSite[] }) {
  const [editing, setEditing] = useState<SiteInput | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, start] = useTransition()

  function save(input: SiteInput) {
    start(async () => {
      const res = await saveSiteAction(input)
      setMsg(res.ok ? { ok: true, text: res.message ?? 'Kaydedildi.' } : { ok: false, text: res.error })
      if (res.ok) setEditing(null)
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
        Sponsor adı, logo, bonus, ana veya VIP rozeti, öne çıkan işareti, sıra ve çekim bilgisi burada durur. Kayıt silinmez; yayından çıkarmak için aktif kutusunu kapat.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setEditing({ ...EMPTY, sortOrder: sites.length })}
          className="flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground"
        >
          <Plus className="size-4" aria-hidden="true" />
          Yeni sponsor
        </button>
        {msg && (
          <p className={cn('text-sm', msg.ok ? 'text-success' : 'text-destructive')} aria-live="polite">
            {msg.text}
          </p>
        )}
      </div>
      {editing && <SiteForm value={editing} pending={pending} onCancel={() => setEditing(null)} onSave={save} />}
      {sites.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Henüz sponsor yok. Formdan ekle.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
          {sites.map((site) => (
            <li key={site.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
              <span className="w-8 shrink-0 text-xs tabular-nums text-muted-foreground">{site.sortOrder}</span>
              <span className={cn('min-w-0 flex-1 font-medium text-foreground', !site.active && 'opacity-50')}>{site.name}</span>
              <span className="rounded bg-secondary px-2 py-0.5 text-[10px] font-bold uppercase text-foreground">{BADGE_LABEL[site.badge as (typeof SITE_BADGES)[number]] ?? site.badge}</span>
              {site.featured && <span className="text-[10px] font-bold uppercase text-primary">Öne çıkan</span>}
              {!site.active && <span className="text-[10px] font-bold uppercase text-muted-foreground">Pasif</span>}
              <button type="button" aria-label={`${site.name} düzenle`} onClick={() => setEditing(site)} className="rounded-md p-1.5 text-muted-foreground hover:text-foreground">
                <Pencil className="size-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

type SiteDraft = Omit<SiteInput, 'rating' | 'sortOrder'> & { rating: string; sortOrder: string }

function draftFrom(value: SiteInput): SiteDraft {
  return { ...value, rating: String(value.rating), sortOrder: String(value.sortOrder) }
}

function numberFrom(value: string) {
  return Number(value.trim().replaceAll(',', '.'))
}

function savedFrom(draft: SiteDraft): SiteInput {
  return { ...draft, rating: numberFrom(draft.rating), sortOrder: numberFrom(draft.sortOrder) }
}

function SiteForm({
  value,
  pending,
  onSave,
  onCancel,
}: {
  value: SiteInput
  pending: boolean
  onSave: (value: SiteInput) => void
  onCancel: () => void
}) {
  const [v, setV] = useState<SiteDraft>(() => draftFrom(value))
  const set = <K extends keyof SiteDraft>(key: K, next: SiteDraft[K]) => setV((prev) => ({ ...prev, [key]: next }))
  function submit() {
    onSave(savedFrom(v))
  }
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
      className="grid gap-4 rounded-xl border border-border bg-card p-4 md:grid-cols-2"
    >
      <Field label="Sponsor adı" value={v.name} onChange={(name) => set('name', name)} required />
      <Field label="Kısa tanım" value={v.tagline} onChange={(tagline) => set('tagline', tagline)} />
      <Field label="Logo adresi" value={v.logoUrl} onChange={(logoUrl) => set('logoUrl', logoUrl)} placeholder="https://… veya /images/…" />
      <Field label="Bonus satırı" value={v.bonusText} onChange={(bonusText) => set('bonusText', bonusText)} />
      <Field label="Bonus türü" value={v.bonusType} onChange={(bonusType) => set('bonusType', bonusType)} placeholder="Deneme, hoş geldin…" />
      <Field label="Çevrim" value={v.wagerText} onChange={(wagerText) => set('wagerText', wagerText)} />
      <Field label="Bonus kodu" value={v.bonusCode} onChange={(bonusCode) => set('bonusCode', bonusCode)} />
      <Field label="Çekim süresi" value={v.payout} onChange={(payout) => set('payout', payout)} placeholder="15 dk" />
      <Field label="Site adresi" value={v.url} onChange={(url) => set('url', url)} placeholder="https://" />
      <Field label="Giriş adresi" value={v.entryUrl} onChange={(entryUrl) => set('entryUrl', entryUrl)} placeholder="https://" />
      <Field label="Alan adı" value={v.domain} onChange={(domain) => set('domain', domain)} placeholder="ornek.com" />
      <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground">
        Rozet
        <select value={v.badge} onChange={(event) => set('badge', event.target.value)} className={field}>
          {SITE_BADGES.map((badge) => (
            <option key={badge || 'guvenilir'} value={badge}>
              {BADGE_LABEL[badge]}
            </option>
          ))}
        </select>
      </label>
      <Field label="Puan (5 üzerinden)" value={v.rating} onChange={(rating) => set('rating', rating)} inputMode="decimal" />
      <Field label="Sıra" value={v.sortOrder} onChange={(sortOrder) => set('sortOrder', sortOrder)} inputMode="numeric" />
      <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground md:col-span-2">
        Ayrıcalıklar
        <textarea
          value={v.perks}
          onChange={(event) => set('perks', event.target.value)}
          rows={3}
          placeholder="Her satır bir madde"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-normal text-foreground outline-none focus:border-primary"
        />
      </label>
      <label className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <input type="checkbox" checked={v.featured} onChange={(event) => set('featured', event.target.checked)} className="size-4 accent-primary" />
        Öne çıkan
      </label>
      <label className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <input type="checkbox" checked={v.active} onChange={(event) => set('active', event.target.checked)} className="size-4 accent-primary" />
        Aktif
      </label>
      <div className="flex flex-wrap gap-2 md:col-span-2">
        <button type="button" disabled={pending} onClick={submit} className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">
          {pending ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
        <button type="button" onClick={onCancel} className="h-10 rounded-lg border border-border px-4 text-sm font-semibold text-foreground">
          Vazgeç
        </button>
      </div>
    </form>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
  inputMode,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  required?: boolean
  inputMode?: 'decimal' | 'numeric'
}) {
  return (
    <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground">
      {label}
      <input required={required} value={value} inputMode={inputMode} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className={field} />
    </label>
  )
}
