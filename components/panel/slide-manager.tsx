'use client'

import { useId, useState, useTransition, type FormEvent, type ReactNode } from 'react'
import Image from 'next/image'
import { CalendarClock, Copy, ExternalLink, Eye, Loader2, MousePointerClick, Pencil, Plus, RotateCcw, Save, Trash2 } from 'lucide-react'
import { createSlide, duplicateSlide, reorderSlides, resetHero, resetSlide, saveHero, saveSlide, type ActionState } from '@/app/panel/actions'
import { askConfirm, notify } from '@/components/panel/confirm-dialog'
import { HideButton } from '@/components/panel/hide-button'
import { ImageField } from '@/components/panel/image-field'
import { SideSheet } from '@/components/panel/side-sheet'
import { SortableList, useOrder } from '@/components/panel/sortable-list'
import { useSiblingTabs } from '@/components/panel/telegram-tabs'
import { MAX_CUSTOM_SLIDES } from '@/lib/custom-slides'
import { formatLocal, scheduleState } from '@/lib/schedule'
import { JAKO_POSES } from '@/lib/site-registry'
import { cn } from '@/lib/utils'

type Fields = {
  eyebrow?: string
  title?: string
  description?: string
  cta?: string
  speech?: string
  image?: string
  mobileImage?: string
  pose?: string
  href?: string
  startAt?: string
  endAt?: string
}

export type EditorItem = {
  kind: 'slide' | 'hero'
  id: string
  label: string
  path: string
  defaults: Fields
  saved: Fields | null
  hidden?: boolean
  custom?: boolean
  stats?: { views: number; clicks: number }
}

export type SlideAudience = { members: boolean; guests: boolean }

const LIMITS = { eyebrow: 40, title: 90, description: 280, cta: 30, speech: 160 } as const
const SPEECH_FITS = 80

const SLIDE_PRESETS = [
  { label: 'Tavla turnuvası', eyebrow: 'Büyük Tavla Turnuvası', title: 'Zarı at, kupayı kap', description: 'Yüksek ödüllü tavla turnuvasına kaydını şimdi yap, yerini kapan kazansın.', cta: 'Turnuvaya katıl' },
  { label: 'Ücretsiz Okey & 101', eyebrow: 'Canlı Masalar', title: 'Okey ve 101 masaları seni bekliyor', description: 'Ücretsiz canlı masalara otur, kankalarınla aynı masada taşları diz.', cta: 'Masaya otur' },
  { label: 'Batak ligi', eyebrow: 'Batak Ligi', title: 'Koz senden, zafer senden', description: 'Haftalık Batak liginde puan topla, sıralamanın zirvesine çık.', cta: 'Lige katıl' },
  { label: 'Bilardo düellosu', eyebrow: 'Amerikan Bilardo', title: 'Istakanı hazırla', description: 'Birebir bilardo düellolarında rakibini yen, Kanka Coin kazan.', cta: 'Düelloya başla' },
] as const

const POSE_LABELS: Record<string, string> = {
  jako: 'Klasik',
  merhaba: 'Merhaba',
  kazandi: 'Kazandı',
  duyuru: 'Duyuru',
  sandik: 'Sandık',
  dusunen: 'Düşünen',
  zar: 'Zar',
  market: 'Market',
  uzgun: 'Üzgün',
  telegram: 'Telegram',
}

const poseImage = (p: string) => (p === 'jako' ? '/images/mascots/jako.png' : `/images/mascots/jako-${p}.png`)

const NEW_SLIDE: EditorItem = {
  kind: 'slide',
  id: '',
  label: 'Yeni slayt',
  path: '/',
  custom: true,
  defaults: { image: '/images/banner-wheel.png', cta: 'İncele' },
  saved: null,
}

const rowButton = 'flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-40'
const input = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary'

const titleOf = (item: EditorItem) => item.saved?.title || item.defaults.title || item.label
const imageOf = (item: EditorItem) => item.saved?.image || item.defaults.image || '/placeholder.svg'

function Thumb({ src }: { src: string }) {
  return (
    <span className="relative h-11 w-24 shrink-0 overflow-hidden rounded-md border border-border bg-secondary">
      {/* eslint-disable-next-line @next/next/no-img-element -- a small preview of an image from any https host set in the panel */}
      <img src={src || '/placeholder.svg'} alt="" loading="lazy" className="size-full object-cover" />
    </span>
  )
}

function Chip({ tone = 'muted', children }: { tone?: 'muted' | 'primary' | 'danger'; children: ReactNode }) {
  return (
    <span
      className={cn(
        'flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-xs font-semibold',
        tone === 'primary' ? 'bg-primary/15 text-primary' : tone === 'danger' ? 'bg-destructive/15 text-destructive' : 'bg-secondary text-muted-foreground',
      )}
    >
      {children}
    </span>
  )
}

function ScheduleChip({ startAt, endAt }: { startAt?: string; endAt?: string }) {
  if (!startAt && !endAt) return null
  const state = scheduleState({ startAt, endAt })
  const text = state === 'upcoming' ? `${formatLocal(startAt)} başlar` : state === 'ended' ? 'Süresi doldu' : endAt ? `${formatLocal(endAt)} biter` : 'Yayında'
  return (
    <Chip tone={state === 'ended' ? 'danger' : state === 'upcoming' ? 'primary' : 'muted'}>
      <CalendarClock className="size-3" aria-hidden="true" />
      {text}
    </Chip>
  )
}

function audienceText({ members, guests }: SlideAudience) {
  if (members && guests) return null
  if (!members && !guests) return 'Yeni ana sayfa tasarımı açık: bu slaytlar şu an sitede görünmüyor.'
  return `Yeni ana sayfa tasarımı ${members ? 'misafirlere' : 'üyelere'} açık: bu slaytları şu an sadece ${members ? 'üyeler' : 'misafirler'} görüyor.`
}

export function SlideManager({ slides, library, audience }: { slides: EditorItem[]; library: string[]; audience: SlideAudience }) {
  const order = useOrder(slides, (slide) => slide.id)
  const [sorting, startSort] = useTransition()
  const [busy, startBusy] = useTransition()
  const [editing, setEditing] = useState<string | null>(null)
  const tabs = useSiblingTabs()
  const customCount = slides.filter((slide) => slide.custom).length
  const full = customCount >= MAX_CUSTOM_SLIDES
  const open = editing === '' ? NEW_SLIDE : slides.find((slide) => slide.id === editing)
  const note = audienceText(audience)
  const layoutTab = tabs?.tabs.some((tab) => tab.id === 'layout')

  function move(ids: string[]) {
    order.set(ids)
    startSort(async () => {
      const result = await reorderSlides(ids)
      if (!result.ok) {
        order.reset()
        notify(false, result.message ?? 'Sıra kaydedilemedi.')
      }
    })
  }

  function run(action: (prev: ActionState, form: FormData) => Promise<ActionState>, id: string, fallback: string) {
    startBusy(async () => {
      const form = new FormData()
      form.set('id', id)
      const result = await action({}, form)
      notify(Boolean(result.ok), result.message ?? fallback)
    })
  }

  async function remove(slide: EditorItem) {
    if (!(await askConfirm(`"${titleOf(slide)}" slaytı silinsin mi? Bu işlem geri alınamaz.`))) return
    run(resetSlide, slide.id, 'Silinemedi.')
  }

  return (
    <div className="@container flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex min-w-0 flex-1 basis-60 flex-col gap-0.5">
          <h2 className="text-sm font-semibold text-foreground">
            Slaytlar <span className="font-normal text-muted-foreground">{`· ${slides.length}`}</span>
          </h2>
          <p className="text-xs leading-relaxed text-muted-foreground text-pretty">Sırayı tutamaçtan sürükleyerek değiştir; bıraktığın an kaydedilir.</p>
        </div>
        <button
          type="button"
          disabled={full}
          title={full ? `En fazla ${MAX_CUSTOM_SLIDES} yeni slayt eklenebilir.` : undefined}
          onClick={() => setEditing('')}
          className="flex h-9 shrink-0 items-center gap-2 rounded-lg bg-primary px-3.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          <Plus className="size-4" aria-hidden="true" />
          Yeni slayt
        </button>
      </div>
      {note && (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span className="size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
          <span className="min-w-0">{note}</span>
          {layoutTab && (
            <button type="button" onClick={() => tabs?.open('layout')} className="font-semibold text-primary hover:underline">
              Ana sayfa düzenini aç
            </button>
          )}
        </p>
      )}
      <SortableList
        items={order.ordered}
        idOf={(slide) => slide.id}
        nameOf={titleOf}
        onMove={move}
        disabled={sorting}
        className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card"
        itemClassName="bg-card first:rounded-t-xl last:rounded-b-xl"
      >
        {(slide, handle, i) => {
          const ctr = slide.stats && slide.stats.views > 0 ? (slide.stats.clicks / slide.stats.views) * 100 : null
          const sub = [slide.saved?.eyebrow || slide.defaults.eyebrow, slide.custom ? slide.saved?.href : null].filter(Boolean).join(' · ')
          return (
            <div data-find={`slide-${slide.id}`} className="flex flex-wrap items-center gap-x-2 gap-y-1 p-1.5 pr-2.5">
              {handle}
              <span className="w-5 shrink-0 text-center text-xs tabular-nums text-muted-foreground">{i + 1}</span>
              <button
                type="button"
                onClick={() => setEditing(slide.id)}
                aria-label={`${titleOf(slide)} slaytını düzenle`}
                className={cn('flex min-w-0 flex-1 basis-56 items-center gap-3 rounded-md p-1 text-left hover:bg-secondary/60', slide.hidden && 'opacity-60')}
              >
                <Thumb src={imageOf(slide)} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium text-foreground">{titleOf(slide)}</span>
                  {sub && <span className="truncate text-xs text-muted-foreground">{sub}</span>}
                </span>
              </button>
              <div className="flex flex-wrap items-center gap-1.5">
                {slide.hidden && <Chip>Gizli</Chip>}
                <ScheduleChip startAt={slide.saved?.startAt} endAt={slide.saved?.endAt} />
              </div>
              {slide.stats && (
                <span className="hidden w-52 shrink-0 items-center justify-end gap-3 text-xs tabular-nums text-muted-foreground @4xl:flex" title="Son 30 gün">
                  <span className="flex items-center gap-1">
                    <Eye className="size-3.5" aria-hidden="true" />
                    <span className="sr-only">Gösterim</span>
                    {slide.stats.views.toLocaleString('tr-TR')}
                  </span>
                  <span className="flex items-center gap-1">
                    <MousePointerClick className="size-3.5" aria-hidden="true" />
                    <span className="sr-only">Tıklanma</span>
                    {slide.stats.clicks.toLocaleString('tr-TR')}
                  </span>
                  <span className={cn('w-12 text-right', ctr !== null && 'font-semibold text-foreground')}>{ctr === null ? '-' : `%${ctr.toLocaleString('tr-TR', { maximumFractionDigits: 1 })}`}</span>
                </span>
              )}
              <div className="ml-auto flex shrink-0 items-center gap-0.5">
                <button type="button" onClick={() => setEditing(slide.id)} className={rowButton} aria-label={`${titleOf(slide)}: düzenle`} title="Düzenle">
                  <Pencil className="size-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  disabled={busy || full}
                  onClick={() => run(duplicateSlide, slide.id, 'Kopyalanamadı.')}
                  className={rowButton}
                  aria-label={`${titleOf(slide)}: kopyasını oluştur`}
                  title={full ? `En fazla ${MAX_CUSTOM_SLIDES} yeni slayt eklenebilir.` : 'Kopyala'}
                >
                  <Copy className="size-4" aria-hidden="true" />
                </button>
                <HideButton key={`${slide.id}-${!!slide.hidden}`} kind="slide" id={slide.id} hidden={!!slide.hidden} label={titleOf(slide)} />
                {slide.custom ? (
                  <button type="button" disabled={busy} onClick={() => void remove(slide)} className={cn(rowButton, 'hover:text-destructive')} aria-label={`${titleOf(slide)}: sil`} title="Sil">
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                ) : (
                  <span className="size-9 shrink-0" aria-hidden="true" />
                )}
              </div>
            </div>
          )
        }}
      </SortableList>
      {open && <ItemEditor key={open.id || 'new'} item={open} library={library} onDone={() => setEditing(null)} />}
    </div>
  )
}

export function HeroManager({ heroes, library }: { heroes: EditorItem[]; library: string[] }) {
  const [editing, setEditing] = useState<string | null>(null)
  const open = heroes.find((hero) => hero.id === editing)
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-sm font-semibold text-foreground">
          Sayfa başlıkları <span className="font-normal text-muted-foreground">{`· ${heroes.length}`}</span>
        </h2>
        <p className="text-xs leading-relaxed text-muted-foreground text-pretty">Her sayfanın en üstündeki görsel, başlık ve Jako balonu. Boş bıraktığın alan hazır metinle gösterilir.</p>
      </div>
      <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
        {heroes.map((hero) => {
          const changed = !!hero.saved && Object.values(hero.saved).some(Boolean)
          return (
            <li key={hero.id} data-find={`hero-${hero.id}`} className="flex flex-wrap items-center gap-x-2 gap-y-1 p-1.5 pr-2.5">
              <button
                type="button"
                onClick={() => setEditing(hero.id)}
                aria-label={`${hero.label} sayfa başlığını düzenle`}
                className="flex min-w-0 flex-1 basis-56 items-center gap-3 rounded-md p-1 text-left hover:bg-secondary/60"
              >
                <Thumb src={imageOf(hero)} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium text-foreground">{hero.label}</span>
                  <span className="truncate text-xs text-muted-foreground">{titleOf(hero)}</span>
                </span>
              </button>
              {changed && <Chip tone="primary">Değiştirildi</Chip>}
              <div className="ml-auto flex shrink-0 items-center gap-0.5">
                <a href={hero.path} target="_blank" rel="noreferrer" className={rowButton} aria-label={`${hero.label}: sitede aç`} title={`Sitede aç: ${hero.path}`}>
                  <ExternalLink className="size-4" aria-hidden="true" />
                </a>
                <button type="button" onClick={() => setEditing(hero.id)} className={rowButton} aria-label={`${hero.label}: düzenle`} title="Düzenle">
                  <Pencil className="size-4" aria-hidden="true" />
                </button>
              </div>
            </li>
          )
        })}
      </ul>
      {open && <ItemEditor key={open.id} item={open} library={library} onDone={() => setEditing(null)} />}
    </div>
  )
}

type Draft = Required<Fields>

function draftOf(item: EditorItem): Draft {
  const saved = item.saved ?? {}
  return {
    eyebrow: saved.eyebrow ?? '',
    title: saved.title ?? '',
    description: saved.description ?? '',
    cta: saved.cta ?? '',
    speech: saved.speech ?? '',
    image: saved.image ?? '',
    mobileImage: saved.mobileImage ?? '',
    pose: saved.pose ?? '',
    href: saved.href ?? (item.custom ? '/' : ''),
    startAt: saved.startAt ?? '',
    endAt: saved.endAt ?? '',
  }
}

function ItemEditor({ item, library, onDone }: { item: EditorItem; library: string[]; onDone: () => void }) {
  const isSlide = item.kind === 'slide'
  const isNew = isSlide && !item.id
  const formId = useId()
  const [v, setV] = useState<Draft>(() => draftOf(item))
  const [error, setError] = useState('')
  const [pending, start] = useTransition()
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setV((prev) => ({ ...prev, [key]: value }))
  const shown = (key: 'eyebrow' | 'title' | 'description' | 'cta' | 'speech') => v[key] || item.defaults[key] || ''
  const preview = v.image || item.defaults.image || '/placeholder.svg'
  const changed = !!item.saved && Object.values(item.saved).some(Boolean)

  function payload() {
    const form = new FormData()
    form.set(isSlide ? 'id' : 'slug', item.id)
    for (const [key, value] of Object.entries(v)) form.set(key, value)
    return form
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    start(async () => {
      const result = await (isNew ? createSlide : isSlide ? saveSlide : saveHero)({}, payload())
      if (!result.ok) {
        setError(result.message ?? 'Kaydedilemedi.')
        return
      }
      notify(true, result.message ?? 'Kaydedildi.')
      onDone()
    })
  }

  async function reset() {
    const question = item.custom ? `"${titleOf(item)}" slaytı silinsin mi? Bu işlem geri alınamaz.` : 'Bu kayıt hazır haline dönsün mü? Yazdığın metinler ve yüklediğin görsel bu kayıttan kalkar.'
    if (!(await askConfirm(question))) return
    setError('')
    start(async () => {
      const result = await (isSlide ? resetSlide : resetHero)({}, payload())
      if (!result.ok) {
        setError(result.message ?? 'İşlem yapılamadı.')
        return
      }
      notify(true, result.message ?? 'Tamam.')
      onDone()
    })
  }

  async function fill(preset: (typeof SLIDE_PRESETS)[number]) {
    const typed = v.eyebrow || v.title || v.description || v.cta
    if (typed && !(await askConfirm(`"${preset.label}" yazıları mevcut metnin yerine geçsin mi?`))) return
    setV((prev) => ({ ...prev, eyebrow: preset.eyebrow, title: preset.title, description: preset.description, cta: preset.cta }))
  }

  return (
    <SideSheet
      size="lg"
      eyebrow={isNew ? 'Slider' : isSlide ? 'Slayt düzenle' : `Sayfa başlığı · ${item.path}`}
      title={isNew ? 'Yeni slayt' : isSlide ? titleOf(item) : item.label}
      onClose={onDone}
      footer={
        <>
          <button form={formId} disabled={pending} className="flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />}
            {isNew ? 'Slaytı ekle' : 'Kaydet'}
          </button>
          {!isNew && (item.custom || changed) && (
            <button
              type="button"
              disabled={pending}
              onClick={() => void reset()}
              className={cn(
                'flex h-10 items-center gap-2 rounded-lg border px-3 text-sm disabled:opacity-50',
                item.custom ? 'border-destructive/40 text-destructive hover:bg-destructive/10' : 'border-border text-foreground hover:bg-secondary',
              )}
            >
              {item.custom ? <Trash2 className="size-4" aria-hidden="true" /> : <RotateCcw className="size-4" aria-hidden="true" />}
              {item.custom ? 'Slaytı sil' : 'Hazır haline dön'}
            </button>
          )}
          {!isNew && (
            <a href={item.path} target="_blank" rel="noreferrer" className="ml-auto flex h-10 items-center gap-1.5 rounded-lg px-2 text-sm text-muted-foreground hover:text-foreground">
              Sitede aç
              <ExternalLink className="size-3.5" aria-hidden="true" />
            </a>
          )}
          {error && (
            <p role="alert" className="w-full text-sm text-destructive">
              {error}
            </p>
          )}
        </>
      }
    >
      <form id={formId} data-no-guard onSubmit={submit} className="flex flex-col gap-4">
        <div className="relative aspect-[16/6] overflow-hidden rounded-xl border border-border bg-secondary">
          <Image src={preview} alt="" fill sizes="720px" className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/50 to-transparent" />
          <div className="absolute inset-y-0 left-0 flex w-3/4 flex-col justify-end gap-1 p-4">
            {shown('eyebrow') && <span className="truncate text-xs font-bold uppercase tracking-wider text-primary">{shown('eyebrow')}</span>}
            <span className="line-clamp-2 text-balance font-display text-lg font-bold leading-tight text-foreground">{shown('title') || 'Başlık burada görünür'}</span>
            {shown('description') && <span className="line-clamp-2 text-xs leading-relaxed text-foreground/80">{shown('description')}</span>}
            {isSlide && shown('cta') && <span className="mt-1 w-fit rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground">{shown('cta')}</span>}
            {!isSlide && shown('speech') && <span className="mt-1 w-fit max-w-full truncate rounded-lg bg-card/90 px-2.5 py-1 text-xs text-foreground">{`Jako: ${shown('speech')}`}</span>}
          </div>
          <span className="absolute right-2 top-2 rounded bg-background/80 px-1.5 py-0.5 text-xs text-muted-foreground backdrop-blur">Önizleme</span>
        </div>

        {isSlide && (
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-muted-foreground">Hazır metin şablonları</span>
            <div className="flex flex-wrap gap-1.5">
              {SLIDE_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => void fill(preset)}
                  className="rounded-full border border-border px-2.5 py-1 text-xs font-semibold text-foreground hover:border-primary hover:text-primary max-sm:min-h-9 max-sm:px-3"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Text label="Üst etiket" value={v.eyebrow} onChange={(eyebrow) => set('eyebrow', eyebrow)} max={LIMITS.eyebrow} placeholder={item.defaults.eyebrow || 'Boş bırakılırsa gösterilmez'} />
          {isSlide && <Text label="Buton yazısı" value={v.cta} onChange={(cta) => set('cta', cta)} max={LIMITS.cta} placeholder={item.defaults.cta} />}
          <div className="sm:col-span-2">
            <Text label="Başlık" value={v.title} onChange={(title) => set('title', title)} max={LIMITS.title} placeholder={item.defaults.title} required={!!item.custom} />
          </div>
          <div className="sm:col-span-2">
            <Text label="Açıklama" value={v.description} onChange={(description) => set('description', description)} max={LIMITS.description} placeholder={item.defaults.description} multiline />
          </div>
          {item.custom && (
            <div className="sm:col-span-2">
              <Text label="Butonun gideceği link" value={v.href} onChange={(href) => set('href', href)} max={300} placeholder="/oyunlar/tavla veya https://…" />
            </div>
          )}
        </div>

        <ImageField
          label="Görsel"
          value={v.image}
          onChange={(image) => set('image', image)}
          library={library}
          uploadId={isSlide ? 'slide' : 'hero'}
          placeholder="Hazır görsel kullanılıyor"
          hint={`Bilgisayardan yükle, galeriden seç ya da link yapıştır. Önerilen boyut ${isSlide ? '1600×600' : '1600×500'}.`}
        />

        {isSlide ? (
          <>
            <ImageField
              label="Telefon görseli (isteğe bağlı)"
              value={v.mobileImage}
              onChange={(mobileImage) => set('mobileImage', mobileImage)}
              library={library}
              uploadId="slide-mobile"
              placeholder="Boşsa telefonda da üstteki görsel kullanılır"
              previewClassName="aspect-[5/4] w-40"
              hint="Telefonda slayt kutusu kareye yakındır; geniş görselin sağı ve solu kesilir. Önerilen boyut 1000×800."
            />
            <fieldset className="flex flex-col gap-2">
              <legend className="pb-1.5 text-xs font-semibold text-foreground">Yayın zamanı (isteğe bağlı)</legend>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                  Başlangıç
                  <input type="datetime-local" value={v.startAt} onChange={(event) => set('startAt', event.target.value)} className={cn(input, '[color-scheme:dark]')} />
                </label>
                <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                  Bitiş
                  <input type="datetime-local" value={v.endAt} onChange={(event) => set('endAt', event.target.value)} className={cn(input, '[color-scheme:dark]')} />
                </label>
              </div>
              <span className="text-xs text-muted-foreground">Boş bırakırsan slayt hep yayında kalır. Türkiye saatiyle.</span>
            </fieldset>
          </>
        ) : (
          <>
            <Text
              label="Jako konuşma balonu"
              value={v.speech}
              onChange={(speech) => set('speech', speech)}
              max={LIMITS.speech}
              warnAt={SPEECH_FITS}
              warning={`Telefonda taşabilir, ${SPEECH_FITS} karakterin altında tut.`}
              placeholder={item.defaults.speech || 'Boş bırakılırsa hazır metin kullanılır'}
            />
            <fieldset className="flex flex-col">
              <legend className="pb-1.5 text-xs font-semibold text-foreground">Jako pozu</legend>
              <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
                {['', ...JAKO_POSES].map((pose) => (
                  <label
                    key={pose || 'default'}
                    className="flex cursor-pointer flex-col items-center gap-1 rounded-lg border border-border bg-background p-1.5 text-center text-xs text-foreground has-[:checked]:border-primary has-[:checked]:bg-primary/10"
                  >
                    <input type="radio" name="pose" value={pose} checked={v.pose === pose} onChange={() => set('pose', pose)} className="sr-only" />
                    {pose ? (
                      <Image src={poseImage(pose)} alt="" width={40} height={40} className="size-10 object-contain" />
                    ) : (
                      <span className="flex size-10 items-center justify-center text-muted-foreground">
                        <RotateCcw className="size-4" aria-hidden="true" />
                      </span>
                    )}
                    <span className="w-full truncate">{pose ? (POSE_LABELS[pose] ?? pose) : 'Hazır poz'}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </>
        )}
      </form>
    </SideSheet>
  )
}

function Text({
  label,
  value,
  onChange,
  max,
  placeholder,
  multiline,
  required,
  warnAt,
  warning,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  max: number
  placeholder?: string
  multiline?: boolean
  required?: boolean
  warnAt?: number
  warning?: string
}) {
  const over = warnAt !== undefined && value.length > warnAt
  const near = value.length >= max * 0.8 || warnAt !== undefined
  return (
    <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground">
      <span className="flex items-center justify-between gap-2">
        {label}
        {near && <span className={cn('font-normal tabular-nums', over ? 'text-destructive' : 'text-muted-foreground')}>{`${value.length}/${warnAt ?? max}`}</span>}
      </span>
      {multiline ? (
        <textarea value={value} onChange={(event) => onChange(event.target.value)} maxLength={max} placeholder={placeholder} rows={3} className={cn(input, 'resize-y font-normal leading-relaxed')} />
      ) : (
        <input value={value} onChange={(event) => onChange(event.target.value)} maxLength={max} placeholder={placeholder} required={required} className={cn(input, 'font-normal')} />
      )}
      {over && warning && <span className="font-normal text-destructive">{warning}</span>}
    </label>
  )
}
