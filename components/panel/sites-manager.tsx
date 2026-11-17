'use client'

import { HideButton } from '@/components/panel/hide-button'
import { ImageField } from '@/components/panel/image-field'
import { useState, useTransition } from 'react'
import { BarChart3, Loader2, Pencil, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { reorderSitesAction, saveSiteAction, sponsorSummaryAction } from '@/app/panel/site-actions'
import { SortableList, useOrder } from '@/components/panel/sortable-list'
import { SponsorSummaryPanel } from '@/components/panel/sponsor-summary'
import type { SponsorSummary, SummarySection } from '@/lib/sponsor-summary-shared'
import { SITE_BADGES, SLUG_LETTER_ERROR, publicSlug, slugHasLetter, type SiteInput, type SponsorSite } from '@/lib/sites-shared'

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
  slug: '',
}

const BADGE_LABEL: Record<(typeof SITE_BADGES)[number], string> = {
  'Ana Sponsor': '1 · Ana sponsor',
  'Elit Sponsor': '2 · Elit sponsor',
  VIP: '3 · VIP sponsor',
  '': '4 · Güvenilir sponsor',
  'Sponsor Değil': '5 · Sponsor değil (yalnızca güven merkezi ve özel oranlar)',
}

export function SitesManager({ sites }: { sites: SponsorSite[] }) {
  const [editing, setEditing] = useState<SiteInput | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, start] = useTransition()
  const order = useOrder(sites, (site) => String(site.id))
  const [sorting, startSort] = useTransition()
  const [summary, setSummary] = useState<SponsorSummary | null>(null)
  const [sections, setSections] = useState<SummarySection[]>([])
  const [loadingId, setLoadingId] = useState<number | null>(null)
  const [, startSummary] = useTransition()

  function move(ids: string[]) {
    order.set(ids)
    startSort(async () => {
      const res = await reorderSitesAction(ids.map(Number))
      if (!res.ok) order.reset()
      setMsg(res.ok ? { ok: true, text: res.message ?? 'Sıra kaydedildi.' } : { ok: false, text: res.error })
    })
  }

  function toggleSummary(id: number) {
    if (summary?.id === id) {
      setSummary(null)
      return
    }
    setLoadingId(id)
    startSummary(async () => {
      const res = await sponsorSummaryAction(id)
      setLoadingId(null)
      if (res.ok) {
        setSections(res.sections)
        setSummary(res.summary)
      } else setMsg({ ok: false, text: res.error })
    })
  }

  function save(input: SiteInput) {
    if (!slugHasLetter(publicSlug(input.slug, input.name))) {
      setMsg({ ok: false, text: SLUG_LETTER_ERROR })
      return
    }
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
      <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
        Sırayı değiştirmek için soldaki tutamağı sürükle; bıraktığın an kaydedilir. Sitede önce rozet sırası geçerlidir (ana, elit, VIP, güvenilir), bu liste aynı rozetteki sponsorların kendi arasındaki sırayı belirler. &quot;Özet&quot; o sponsorun tıklama, yorum, şikayet ve hakediş durumunu açar.
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
        <SortableList
          items={order.ordered}
          idOf={(site) => String(site.id)}
          nameOf={(site) => site.name}
          onMove={move}
          disabled={sorting}
          className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card"
          itemClassName="bg-card first:rounded-t-xl last:rounded-b-xl"
        >
          {(site, handle, i) => (
            <>
              <div data-find={`sponsor-${site.id}`} className="flex flex-wrap items-center gap-2 p-2 pr-3 text-sm">
                {handle}
                <span className="w-6 shrink-0 text-xs tabular-nums text-muted-foreground">{i + 1}</span>
                <span className={cn('min-w-0 flex-1 basis-40 font-medium text-foreground', !site.active && 'opacity-50')}>
                  {site.name}
                  {site.slug ? <span className="ml-2 font-normal text-muted-foreground">/{site.slug}</span> : null}
                </span>
                <span className="rounded bg-secondary px-2 py-0.5 text-xs font-bold uppercase text-foreground">{BADGE_LABEL[site.badge as (typeof SITE_BADGES)[number]] ?? site.badge}</span>
                {site.featured && <span className="text-xs font-bold uppercase text-primary">Öne çıkan</span>}
                {!site.active && <span className="text-xs font-bold uppercase text-muted-foreground">Gizli</span>}
                <button
                  type="button"
                  aria-expanded={summary?.id === site.id}
                  disabled={loadingId !== null}
                  onClick={() => toggleSummary(site.id)}
                  className="flex h-9 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-semibold text-foreground hover:bg-secondary disabled:opacity-60"
                >
                  {loadingId === site.id ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <BarChart3 className="size-3.5" aria-hidden="true" />}
                  Özet
                </button>
                <HideButton key={`${site.id}-${site.active}`} kind="sponsor" id={site.id} hidden={!site.active} label={site.name} />
                <button type="button" aria-label={`${site.name} düzenle`} onClick={() => setEditing(site)} className="rounded-md p-1.5 text-muted-foreground hover:text-foreground">
                  <Pencil className="size-4" aria-hidden="true" />
                </button>
              </div>
              {summary?.id === site.id && <SponsorSummaryPanel summary={summary} sections={sections} onClose={() => setSummary(null)} />}
            </>
          )}
        </SortableList>
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
  const [slugError, setSlugError] = useState<string | null>(null)
  const set = <K extends keyof SiteDraft>(key: K, next: SiteDraft[K]) => setV((prev) => ({ ...prev, [key]: next }))
  function submit() {
    if (!slugHasLetter(publicSlug(v.slug, v.name))) {
      setSlugError(SLUG_LETTER_ERROR)
      return
    }
    setSlugError(null)
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
      <Field
        label="Adres kısaltması"
        value={v.slug}
        onChange={(slug) => {
          setSlugError(null)
          set('slug', slug)
        }}
        placeholder="makro-bet"
        hint="Sponsor yayındayken değiştirirsen eski linkler çalışmaz."
        error={slugError}
      />
      <Field label="Kısa tanım" value={v.tagline} onChange={(tagline) => set('tagline', tagline)} />
      <div className="md:col-span-2">
        <ImageField label="Logo" value={v.logoUrl} onChange={(logoUrl) => set('logoUrl', logoUrl)} uploadId="sponsor-logo" compact />
      </div>
      <Field label="Bonus satırı" value={v.bonusText} onChange={(bonusText) => set('bonusText', bonusText)} />
      <Field label="Bonus türü" value={v.bonusType} onChange={(bonusType) => set('bonusType', bonusType)} placeholder="Deneme, hoş geldin…" />
      <Field label="Çevrim" value={v.wagerText} onChange={(wagerText) => set('wagerText', wagerText)} />
      <Field label="Bonus kodu" value={v.bonusCode} onChange={(bonusCode) => set('bonusCode', bonusCode)} />
      <Field
        label="Çekim süresi"
        value={v.payout}
        onChange={(payout) => set('payout', payout)}
        placeholder="15 dk"
        hint="Sayı ile yaz (ör. 15 dk, 2 saat). Sayı yoksa sitede gösterilmez."
        error={v.payout.trim() && !/\d/.test(v.payout) ? 'Çekim süresi bir sayı içermeli.' : null}
      />
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
  hint,
  error,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  required?: boolean
  inputMode?: 'decimal' | 'numeric'
  hint?: string
  error?: string | null
}) {
  return (
    <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground">
      {label}
      <input required={required} value={value} inputMode={inputMode} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className={field} aria-invalid={error ? true : undefined} />
      {hint ? <span className="text-xs font-normal leading-relaxed text-muted-foreground">{hint}</span> : null}
      {error ? <span role="alert" className="text-xs font-normal text-destructive">{error}</span> : null}
    </label>
  )
}
