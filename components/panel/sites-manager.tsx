'use client'

import { HideButton } from '@/components/panel/hide-button'
import { ImageField } from '@/components/panel/image-field'
import { useId, useState, useTransition, type ReactNode } from 'react'
import { BarChart3, Check, Copy, Eye, EyeOff, Link2, Loader2, Pencil, Plus, Save, Search, TriangleAlert } from 'lucide-react'
import { SideSheet } from '@/components/panel/side-sheet'
import { cn } from '@/lib/utils'
import { bulkSitesActiveAction, checkSiteLinksAction, reorderSitesAction, saveSiteAction, sponsorSummaryAction } from '@/app/panel/site-actions'
import { askConfirm } from '@/components/panel/confirm-dialog'
import { SortableList, mergeOrder, useOrder } from '@/components/panel/sortable-list'
import { SponsorSummaryPanel } from '@/components/panel/sponsor-summary'
import { amountInput, parseAmount } from '@/lib/amount'
import type { SponsorSummary, SummarySection } from '@/lib/sponsor-summary-shared'
import {
  DEAL_WARN_DAYS,
  SITE_BADGES,
  SLUG_LETTER_ERROR,
  dealDaysLeft,
  dealLabel,
  publicSlug,
  slugHasLetter,
  type LinkCheck,
  type LinkState,
  type SiteInput,
  type SponsorSite,
} from '@/lib/sites-shared'

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
  dealEnds: '',
  dealFee: 0,
}

const LINK_TONE: Record<LinkState, string> = {
  ok: 'text-success',
  redirect: 'text-primary',
  blocked: 'text-muted-foreground',
  down: 'text-destructive',
  timeout: 'text-destructive',
  none: 'text-muted-foreground',
}

const LINK_LABEL: Record<LinkState, string> = {
  ok: 'Link açılıyor',
  redirect: 'Başka adrese gidiyor',
  blocked: 'Buradan doğrulanamadı',
  down: 'Link açılmıyor',
  timeout: 'Cevap gelmedi',
  none: 'Kontrol edilmedi',
}

const BADGE_LABEL: Record<(typeof SITE_BADGES)[number], string> = {
  'Ana Sponsor': '1 · Ana sponsor',
  'Elit Sponsor': '2 · Elit sponsor',
  VIP: '3 · VIP sponsor',
  '': '4 · Güvenilir sponsor',
  'Sponsor Değil': '5 · Sponsor değil (yalnızca güven merkezi ve özel oranlar)',
}

const NOT_SPONSOR = 'Sponsor Değil'

type ListFilter = 'all' | 'live' | 'hidden' | 'missing' | 'deal'

/** What a visitor would notice is absent on the sponsor's card. A record that is not a sponsor has no card, so only its logo counts. */
function missingOf(site: SponsorSite, logo: string) {
  const card = site.badge !== NOT_SPONSOR
  return [
    !logo ? 'logo' : '',
    card && !site.entryUrl.trim() && !site.url.trim() ? 'giriş adresi' : '',
    card && !site.bonusText.trim() ? 'bonus satırı' : '',
  ].filter(Boolean)
}

function fold(value: string) {
  return value.toLocaleLowerCase('tr').trim()
}

function CopyLink({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      aria-label={label}
      title={value}
      onClick={() => {
        void navigator.clipboard?.writeText(value).then(() => {
          setDone(true)
          window.setTimeout(() => setDone(false), 1600)
        })
      }}
      className="flex h-9 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-semibold text-foreground hover:bg-secondary"
    >
      {done ? <Check className="size-3.5 text-success" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
      <span aria-live="polite">{done ? 'Kopyalandı' : 'Link'}</span>
    </button>
  )
}

/**
 * `legacyLogos` are logos uploaded on the old "Sponsor logoları" screen, keyed by address slug. The
 * site still falls back to them; opening a sponsor puts its old logo in the form so the next save keeps it on the record.
 */
export function SitesManager({ sites, today, legacyLogos = {}, siteUrl = '' }: { sites: SponsorSite[]; today: string; legacyLogos?: Record<string, string>; siteUrl?: string }) {
  const logoOf = (site: SponsorSite) => site.logoUrl.trim() || legacyLogos[site.slug] || ''
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<ListFilter>('all')
  const [selected, setSelected] = useState<Set<number>>(() => new Set())
  const [bulking, startBulk] = useTransition()
  const [checks, setChecks] = useState<Map<number, LinkCheck> | null>(null)
  const [checking, startCheck] = useTransition()
  const picked = sites.filter((site) => selected.has(site.id))

  function toggle(id: number, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })
  }

  function bulk(active: boolean) {
    const ids = picked.map((site) => site.id)
    if (!ids.length) return
    const question = active
      ? `${ids.length} sponsor yayına alınsın mı? Sitede hemen görünürler.`
      : `${ids.length} sponsor yayından çıkarılsın mı? Sitede görünmezler; kayıtlar ve geçmiş silinmez.`
    void askConfirm(question).then((ok) => {
      if (!ok) return
      startBulk(async () => {
        const res = await bulkSitesActiveAction(ids, active)
        setMsg(res.ok ? { ok: true, text: res.message ?? 'Kaydedildi.' } : { ok: false, text: res.error })
        if (res.ok) setSelected(new Set())
      })
    })
  }

  function checkLinks() {
    startCheck(async () => {
      const res = await checkSiteLinksAction()
      if (!res.ok) {
        setMsg({ ok: false, text: res.error })
        return
      }
      setChecks(new Map(res.checks.map((check) => [check.id, check])))
      const total = res.checks.length
      const broken = res.checks.filter((check) => check.state === 'down' || check.state === 'timeout').length
      const unsure = res.checks.filter((check) => check.state === 'blocked' || check.state === 'none').length
      const moved = res.checks.filter((check) => check.state === 'redirect').length
      const parts = [
        broken ? `${broken} tanesi açılmıyor` : '',
        unsure ? `${unsure} tanesi buradan doğrulanamadı` : '',
        moved ? `${moved} tanesi başka adrese gidiyor` : '',
      ].filter(Boolean)
      setMsg({
        ok: broken === 0,
        text: total === 0 ? 'Yayında sponsor yok; kontrol edilecek link bulunamadı.' : parts.length ? `${total} sponsorun linki denendi: ${parts.join(', ')}. Ayrıntı satırların altında.` : `${total} sponsorun linki denendi, hepsi açılıyor.`,
      })
    })
  }

  const [editing, setEditing] = useState<SiteInput | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  function open(input: SiteInput) {
    setFormError(null)
    setEditing(input)
  }
  const [pending, start] = useTransition()
  const order = useOrder(sites, (site) => String(site.id))
  const [sorting, startSort] = useTransition()
  const [summary, setSummary] = useState<SponsorSummary | null>(null)
  const [sections, setSections] = useState<SummarySection[]>([])
  const [loadingId, setLoadingId] = useState<number | null>(null)
  const [, startSummary] = useTransition()

  const closing = (site: SponsorSite) => {
    const days = dealDaysLeft(site.dealEnds, today)
    return days !== null && days <= DEAL_WARN_DAYS
  }
  const matches: Record<ListFilter, (site: SponsorSite) => boolean> = {
    all: () => true,
    live: (site) => site.active,
    hidden: (site) => !site.active,
    missing: (site) => missingOf(site, logoOf(site)).length > 0,
    deal: closing,
  }
  const FILTERS: { id: ListFilter; label: string }[] = [
    { id: 'all', label: 'Hepsi' },
    { id: 'live', label: 'Yayında' },
    { id: 'hidden', label: 'Gizli' },
    { id: 'missing', label: 'Eksik bilgi' },
    { id: 'deal', label: 'Anlaşması bitiyor' },
  ]
  const needle = fold(query)
  const visible = order.ordered.filter(
    (site) => matches[filter](site) && (!needle || [site.name, site.slug, site.domain, site.bonusCode].some((text) => fold(text).includes(needle))),
  )
  const position = new Map(order.ordered.map((site, i) => [site.id, i + 1]))
  const narrowed = visible.length !== order.ordered.length

  function move(shown: string[]) {
    const ids = mergeOrder(
      order.ordered.map((site) => String(site.id)),
      shown,
    )
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
      setFormError(SLUG_LETTER_ERROR)
      return
    }
    setFormError(null)
    start(async () => {
      const res = await saveSiteAction(input)
      if (res.ok) {
        setMsg({ ok: true, text: res.message ?? 'Kaydedildi.' })
        setEditing(null)
      } else setFormError(res.error)
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
          onClick={() => open({ ...EMPTY, sortOrder: sites.length })}
          className="flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground"
        >
          <Plus className="size-4" aria-hidden="true" />
          Yeni sponsor
        </button>
        <button
          type="button"
          disabled={checking || sites.length === 0}
          onClick={checkLinks}
          className="flex h-10 items-center gap-2 rounded-lg border border-border px-4 text-sm font-semibold text-foreground hover:bg-secondary disabled:opacity-60"
        >
          {checking ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Link2 className="size-4" aria-hidden="true" />}
          {checking ? 'Linkler deneniyor…' : 'Linkleri kontrol et'}
        </button>
        {msg && (
          <p className={cn('text-sm', msg.ok ? 'text-success' : 'text-destructive')} aria-live="polite">
            {msg.text}
          </p>
        )}
      </div>
      {checks && (
        <p className="text-xs leading-relaxed text-muted-foreground text-pretty">
          Kontrol, yayındaki her sponsorun giriş adresini sunucumuzdan bir kez açar. Bazı siteler yurt dışından gelen isteği kapatır; &quot;Buradan doğrulanamadı&quot; yazanlarda adresi kendi tarayıcından aç. Sonuç kaydedilmez, sayfayı yenileyince silinir.
        </p>
      )}
      {picked.length > 0 && (
        <div role="region" aria-label="Seçilen sponsorlar" className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/40 bg-primary/10 p-3">
          <span className="text-sm font-semibold text-foreground">{picked.length} sponsor seçildi</span>
          <button type="button" disabled={bulking} onClick={() => bulk(true)} className="flex h-9 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-xs font-semibold text-foreground hover:bg-secondary disabled:opacity-60">
            <Eye className="size-3.5" aria-hidden="true" />
            Yayına al
          </button>
          <button type="button" disabled={bulking} onClick={() => bulk(false)} className="flex h-9 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-xs font-semibold text-foreground hover:bg-secondary disabled:opacity-60">
            <EyeOff className="size-3.5" aria-hidden="true" />
            Yayından çıkar
          </button>
          <button type="button" disabled={bulking} onClick={() => setSelected(new Set())} className="h-9 rounded-md px-3 text-xs font-semibold text-muted-foreground hover:text-foreground">
            Seçimi bırak
          </button>
          {sites.length > 1 && picked.length < sites.length && (
            <button type="button" disabled={bulking} onClick={() => setSelected(new Set(sites.map((site) => site.id)))} className="h-9 rounded-md px-3 text-xs font-semibold text-muted-foreground hover:text-foreground">
              Hepsini seç
            </button>
          )}
        </div>
      )}
      {editing && <SiteForm key={editing.id ?? 'yeni'} value={editing} pending={pending} error={formError} onCancel={() => setEditing(null)} onSave={save} />}
      {sites.length > 0 && (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3">
          <label className="relative flex items-center">
            <span className="sr-only">Sponsor ara</span>
            <Search className="pointer-events-none absolute left-3 size-4 text-muted-foreground" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Ad, adres kısaltması, alan adı ya da bonus kodu"
              className={cn(field, 'pl-9')}
            />
          </label>
          <div role="group" aria-label="Sponsor süzgeci" className="flex flex-wrap gap-2">
            {FILTERS.map((item) => {
              const count = sites.filter(matches[item.id]).length
              const on = filter === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setFilter(item.id)}
                  className={cn(
                    'flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold',
                    on ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-foreground hover:bg-secondary',
                  )}
                >
                  {item.label}
                  <span className={cn('tabular-nums', on ? 'opacity-80' : 'text-muted-foreground')}>{count}</span>
                </button>
              )
            })}
          </div>
          {narrowed && (
            <p className="text-xs leading-relaxed text-muted-foreground text-pretty" aria-live="polite">
              {sites.length} sponsordan {visible.length} tanesi görünüyor. Sürükleyince görünenler kendi aralarında yer değiştirir, gizlenenlerin sırası bozulmaz.
            </p>
          )}
        </div>
      )}
      {sites.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Henüz sponsor yok. &quot;Yeni sponsor&quot; ile ekle.</p>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">Bu aramaya ya da süzgece uyan sponsor yok.</p>
          <button
            type="button"
            onClick={() => {
              setQuery('')
              setFilter('all')
            }}
            className="h-9 rounded-md border border-border px-3 text-xs font-semibold text-foreground hover:bg-secondary"
          >
            Süzgeci temizle
          </button>
        </div>
      ) : (
        <SortableList
          items={visible}
          idOf={(site) => String(site.id)}
          nameOf={(site) => site.name}
          onMove={move}
          disabled={sorting}
          className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card"
          itemClassName="bg-card first:rounded-t-xl last:rounded-b-xl"
        >
          {(site, handle) => {
            const daysLeft = dealDaysLeft(site.dealEnds, today)
            const check = checks?.get(site.id)
            const missing = missingOf(site, logoOf(site))
            return (
            <>
              <div data-find={`sponsor-${site.id}`} className="flex flex-wrap items-center gap-2 p-2 pr-3 text-sm">
                {handle}
                <input
                  type="checkbox"
                  checked={selected.has(site.id)}
                  onChange={(event) => toggle(site.id, event.target.checked)}
                  aria-label={`${site.name} seç`}
                  className="size-4 shrink-0 accent-primary"
                />
                <span className="w-6 shrink-0 text-xs tabular-nums text-muted-foreground">{position.get(site.id)}</span>
                <span className={cn('flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-background', !site.active && 'opacity-50')}>
                  {logoOf(site) ? (
                    // eslint-disable-next-line @next/next/no-img-element -- sponsor logos can come from any https host set in the panel
                    <img src={logoOf(site)} alt="" loading="lazy" className="size-full object-contain p-0.5" />
                  ) : (
                    <span className="text-xs font-bold text-muted-foreground" aria-hidden="true">
                      {site.name.slice(0, 2).toLocaleUpperCase('tr')}
                    </span>
                  )}
                </span>
                <span className={cn('min-w-0 flex-1 basis-40 font-medium text-foreground', !site.active && 'opacity-50')}>
                  {site.name}
                  {site.slug ? <span className="ml-2 font-normal text-muted-foreground">/{site.slug}</span> : null}
                </span>
                {missing.length > 0 && (
                  <span className="flex items-center gap-1 rounded bg-destructive/15 px-2 py-0.5 text-xs font-semibold text-destructive">
                    <TriangleAlert className="size-3.5 shrink-0" aria-hidden="true" />
                    Eksik: {missing.join(', ')}
                  </span>
                )}
                <span className="rounded bg-secondary px-2 py-0.5 text-xs font-bold uppercase text-foreground">{BADGE_LABEL[site.badge as (typeof SITE_BADGES)[number]] ?? site.badge}</span>
                {site.featured && <span className="text-xs font-bold uppercase text-primary">Öne çıkan</span>}
                {!site.active && <span className="text-xs font-bold uppercase text-muted-foreground">Gizli</span>}
                {daysLeft !== null && daysLeft <= DEAL_WARN_DAYS && (
                  <span className={cn('rounded px-2 py-0.5 text-xs font-semibold', daysLeft < 0 ? 'bg-destructive/15 text-destructive' : 'bg-primary/15 text-primary')}>{dealLabel(daysLeft)}</span>
                )}
                {check && <span className={cn('text-xs font-semibold', LINK_TONE[check.state])}>{LINK_LABEL[check.state]}{check.state === 'ok' && check.ms !== null ? ` · ${check.ms} ms` : ''}</span>}
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
                {siteUrl && site.slug && site.badge !== NOT_SPONSOR && <CopyLink value={`${siteUrl}/git/${site.slug}`} label={`${site.name} Git linkini kopyala`} />}
                <HideButton key={`${site.id}-${site.active}`} kind="sponsor" id={site.id} hidden={!site.active} label={site.name} />
                <button type="button" aria-label={`${site.name} düzenle`} onClick={() => open({ ...site, logoUrl: logoOf(site) })} className="rounded-md p-1.5 text-muted-foreground hover:text-foreground">
                  <Pencil className="size-4" aria-hidden="true" />
                </button>
              </div>
              {check && check.state !== 'ok' && (
                <p className={cn('px-3 pb-2 text-xs leading-relaxed text-pretty', check.state === 'down' || check.state === 'timeout' ? 'text-destructive' : 'text-muted-foreground')}>
                  {check.note}
                  {check.target ? <span className="ml-1 break-all font-mono text-muted-foreground">{check.target}</span> : null}
                </p>
              )}
              {summary?.id === site.id && <SponsorSummaryPanel summary={summary} sections={sections} onClose={() => setSummary(null)} />}
            </>
            )
          }}
        </SortableList>
      )}
    </div>
  )
}

type SiteDraft = Omit<SiteInput, 'rating' | 'sortOrder' | 'dealFee'> & { rating: string; sortOrder: string; dealFee: string }

const FEE_ERROR = 'Bedel okunamadı. Kuruşu virgülle yaz: 25.000,00'

function draftFrom(value: SiteInput): SiteDraft {
  return { ...value, rating: String(value.rating), sortOrder: String(value.sortOrder), dealFee: value.dealFee ? amountInput(value.dealFee) : '' }
}

function numberFrom(value: string) {
  return Number(value.trim().replaceAll(',', '.'))
}

function feeFrom(value: string) {
  return value.trim() ? parseAmount(value) : 0
}

function savedFrom(draft: SiteDraft): SiteInput {
  return { ...draft, rating: numberFrom(draft.rating), sortOrder: numberFrom(draft.sortOrder), dealFee: feeFrom(draft.dealFee) ?? 0 }
}

function Group({ children }: { children: ReactNode }) {
  return <h3 className="border-t border-border pt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground first:border-t-0 first:pt-0 md:col-span-2">{children}</h3>
}

function SiteForm({
  value,
  pending,
  error,
  onSave,
  onCancel,
}: {
  value: SiteInput
  pending: boolean
  error: string | null
  onSave: (value: SiteInput) => void
  onCancel: () => void
}) {
  const formId = useId()
  const [v, setV] = useState<SiteDraft>(() => draftFrom(value))
  const [slugError, setSlugError] = useState<string | null>(null)
  const [feeError, setFeeError] = useState<string | null>(null)
  const set = <K extends keyof SiteDraft>(key: K, next: SiteDraft[K]) => setV((prev) => ({ ...prev, [key]: next }))
  function submit() {
    if (!slugHasLetter(publicSlug(v.slug, v.name))) {
      setSlugError(SLUG_LETTER_ERROR)
      return
    }
    if (feeFrom(v.dealFee) === null) {
      setFeeError(FEE_ERROR)
      return
    }
    setFeeError(null)
    setSlugError(null)
    onSave(savedFrom(v))
  }
  return (
    <SideSheet
      size="lg"
      eyebrow={value.id ? 'Sponsor düzenle' : 'Sponsorlar'}
      title={value.id ? value.name : 'Yeni sponsor'}
      onClose={onCancel}
      footer={
        <>
          <button form={formId} disabled={pending} className="flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />}
            {pending ? 'Kaydediliyor…' : value.id ? 'Kaydet' : 'Sponsoru ekle'}
          </button>
          {(error || slugError || feeError) && (
            <p role="alert" className="min-w-0 flex-1 text-sm leading-relaxed text-destructive text-pretty">
              {error || slugError || feeError}
            </p>
          )}
        </>
      }
    >
    <form
      id={formId}
      data-no-guard
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
      className="grid gap-4 md:grid-cols-2"
    >
      <Group>Kimlik</Group>
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
        <ImageField
          label="Logo"
          value={v.logoUrl}
          onChange={(logoUrl) => set('logoUrl', logoUrl)}
          uploadId={`sponsor-logo-${v.id ?? 'yeni'}`}
          compact
          hint="Sponsor kartlarında baş harflerin yerine görünür. Kare ya da şeffaf arka planlı PNG/SVG en iyi sonucu verir; bilgisayardan yükle ya da link yapıştır."
        />
      </div>
      <Group>Bonus ve çekim</Group>
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
      <Group>Adresler</Group>
      <Field label="Site adresi" value={v.url} onChange={(url) => set('url', url)} placeholder="https://" />
      <Field label="Giriş adresi" value={v.entryUrl} onChange={(entryUrl) => set('entryUrl', entryUrl)} placeholder="https://" />
      <Field label="Alan adı" value={v.domain} onChange={(domain) => set('domain', domain)} placeholder="ornek.com" />
      <Group>Rozet ve sıra</Group>
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
      <Group>Anlaşma</Group>
      <Field
        label="Anlaşma bitiş tarihi"
        type="date"
        value={v.dealEnds}
        onChange={(dealEnds) => set('dealEnds', dealEnds)}
        hint={`Boş bırakırsan süresiz sayılır. Bitişe ${DEAL_WARN_DAYS} gün kala listede ve Genel bakışta hatırlatma çıkar. Tarih geçince sponsor kendiliğinden yayından kalkmaz.`}
      />
      <Field
        label="Aylık anlaşma bedeli (TL)"
        value={v.dealFee}
        onChange={(dealFee) => {
          setFeeError(null)
          set('dealFee', dealFee)
        }}
        inputMode="decimal"
        placeholder="25.000"
        hint="Sponsorun sana her ay ödediği sabit tutar. Özet ekranında kayıt başı maliyet bununla hesaplanır. Sitede görünmez."
        error={feeError}
      />
      <Group>Ayrıcalıklar ve yayın</Group>
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
    </form>
    </SideSheet>
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
  type,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  required?: boolean
  inputMode?: 'decimal' | 'numeric'
  hint?: string
  error?: string | null
  type?: 'date'
}) {
  return (
    <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground">
      {label}
      <input type={type} required={required} value={value} inputMode={inputMode} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className={field} aria-invalid={error ? true : undefined} />
      {hint ? <span className="text-xs font-normal leading-relaxed text-muted-foreground">{hint}</span> : null}
      {error ? <span role="alert" className="text-xs font-normal text-destructive">{error}</span> : null}
    </label>
  )
}
