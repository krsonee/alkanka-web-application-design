'use client'

import { useId, useState, useTransition, type FormEvent, type ReactNode } from 'react'
import Image from 'next/image'
import { CalendarClock, Copy, ExternalLink, Eye, ImageIcon, Loader2, MousePointerClick, Pencil, Plus, RotateCcw, Save, Trash2, Type } from 'lucide-react'
import { createSlide, duplicateSlide, reorderSlides, resetHero, resetSlide, saveHero, saveSlide, type ActionState } from '@/app/panel/actions'
import { askConfirm, notify } from '@/components/panel/confirm-dialog'
import { HideButton } from '@/components/panel/hide-button'
import { ImageField } from '@/components/panel/image-field'
import { SideSheet } from '@/components/panel/side-sheet'
import { SortableList, useOrder } from '@/components/panel/sortable-list'
import { MAX_CUSTOM_SLIDES, MAX_HOME_SLIDES } from '@/lib/custom-slides'
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
  /** The slide shows its picture alone: nothing is written or shaded over it. */
  plain?: boolean
  /** A ready-made game slide; with no words of its own it takes the page's cover copy. */
  game?: boolean
  /** False for a ready-made promo slide that has never been saved: the new home design leaves it out. */
  inNewDesign?: boolean
  stats?: { views: number; clicks: number }
}

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
  plain: true,
  inNewDesign: true,
  defaults: { cta: 'İncele', href: '/' },
  saved: null,
}

const rowButton = 'flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-40'
const input = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary'

const titleOf = (item: EditorItem) => item.saved?.title || item.defaults.title || item.label || 'Adsız afiş'
const imageOf = (item: EditorItem) => item.saved?.image || item.defaults.image || '/placeholder.svg'

function Thumb({ src }: { src: string }) {
  return (
    <span className="relative h-11 w-24 shrink-0 overflow-hidden rounded-md border border-border bg-secondary">
      {/* eslint-disable-next-line @next/next/no-img-element -- a small preview of an image from any https host set in the panel */}
      <img src={src || '/placeholder.svg'} alt="" loading="lazy" className="size-full object-cover" />
    </span>
  )
}

function Chip({ tone = 'muted', title, children }: { tone?: 'muted' | 'primary' | 'danger'; title?: string; children: ReactNode }) {
  return (
    <span
      title={title}
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

const OFF_IN_NEW_DESIGN = 'Bu hazır slayt yeni ana sayfa tasarımında dönmüyor. Açıp Kaydet\'e basınca dönmeye başlar.'

/** `newDesign`: the new home design is on for members or guests, so the ready-made promo slides need saving once to join it. */
export function SlideManager({ slides, library, newDesign }: { slides: EditorItem[]; library: string[]; newDesign: boolean }) {
  const order = useOrder(slides, (slide) => slide.id)
  const [sorting, startSort] = useTransition()
  const [busy, startBusy] = useTransition()
  const [editing, setEditing] = useState<string | null>(null)
  const customCount = slides.filter((slide) => slide.custom).length
  const full = customCount >= MAX_CUSTOM_SLIDES
  const open = editing === '' ? NEW_SLIDE : slides.find((slide) => slide.id === editing)
  const off = (slide: EditorItem) => newDesign && slide.inNewDesign === false

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
          <p className="text-xs leading-relaxed text-muted-foreground text-pretty">
            Ana sayfanın en üstündeki slider bu listeyi sırayla döndürür. Kendi afişini eklemek için &quot;Yeni slayt&quot;a bas. Sırayı tutamaçtan sürükle; bıraktığın an kaydedilir.
          </p>
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
      {slides.length > MAX_HOME_SLIDES && (
        <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
          {`Sitede en fazla ${MAX_HOME_SLIDES} slayt döner: gizli olmayan ilk ${MAX_HOME_SLIDES} slayt. Fazlasını göstermek için üsttekilerden birini gizle.`}
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
          const link = slide.saved?.href || (slide.custom ? null : slide.defaults.href)
          const sub = [slide.plain ? null : slide.saved?.eyebrow || slide.defaults.eyebrow, slide.custom || slide.plain ? link : null].filter(Boolean).join(' · ')
          return (
            <div data-find={`slide-${slide.id}`} className="flex flex-wrap items-center gap-x-2 gap-y-1 p-1.5 pr-2.5">
              {handle}
              <span className="w-5 shrink-0 text-center text-xs tabular-nums text-muted-foreground">{i + 1}</span>
              <button
                type="button"
                onClick={() => setEditing(slide.id)}
                aria-label={`${titleOf(slide)} slaytını düzenle`}
                className={cn('flex min-w-0 flex-1 basis-56 items-center gap-3 rounded-md p-1 text-left hover:bg-secondary/60', (slide.hidden || off(slide)) && 'opacity-60')}
              >
                <Thumb src={imageOf(slide)} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm font-medium text-foreground max-sm:line-clamp-2 sm:truncate">{titleOf(slide)}</span>
                  {sub && <span className="truncate text-xs text-muted-foreground">{sub}</span>}
                </span>
              </button>
              <div className="flex flex-wrap items-center gap-1.5">
                {slide.plain && (
                  <Chip tone="primary" title="Görselin üstüne yazı yazılmaz, karartılmaz.">
                    <ImageIcon className="size-3" aria-hidden="true" />
                    Sadece görsel
                  </Chip>
                )}
                {off(slide) && <Chip title={OFF_IN_NEW_DESIGN}>Yeni tasarımda kapalı</Chip>}
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
                <HideButton key={`${slide.id}-${!!slide.hidden}`} kind="slide" id={slide.id} hidden={!!slide.hidden} label={titleOf(slide)} className="min-w-[5.5rem] justify-center" />
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
      {open && <ItemEditor key={open.id || 'new'} item={open} library={library} off={off(open)} onDone={() => setEditing(null)} />}
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

type Draft = Required<Fields> & { plain: boolean }

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
    plain: item.plain === true,
  }
}

const MODES = [
  {
    plain: true,
    icon: ImageIcon,
    label: 'Sadece görsel',
    text: 'Yazısı ve düğmesi içinde olan hazır afişler için. Üstüne hiçbir şey yazılmaz, karartılmaz; görselin tamamı tıklanır.',
  },
  {
    plain: false,
    icon: Type,
    label: 'Görsel + yazı',
    text: 'Düz bir fotoğraf için. Başlığı, açıklamayı ve düğmeyi site görselin soluna kendisi yazar.',
  },
] as const

type Shown = { eyebrow: string; title: string; description: string; cta: string }

/**
 * What the slide will look like on the home page, on a wide screen and on a phone. A banner is drawn the way
 * the site draws it: whole, with the leftover edge filled by a soft copy of itself. The small boxes mark where
 * the slider's own buttons sit, so the banner's words can be kept clear of them.
 */
function SlidePreview({ plain, image, mobileImage, shown }: { plain: boolean; image: string; mobileImage: string; shown: Shown }) {
  const frame = (src: string, phone: boolean) => (
    <div className={cn('relative overflow-hidden rounded-xl border border-border bg-secondary', phone ? 'aspect-[5/4]' : 'aspect-[12/5]')}>
      {src ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- preview of an image from any https host set in the panel */}
          {plain && <img src={src} alt="" aria-hidden="true" className="absolute inset-0 size-full scale-125 object-cover opacity-45 blur-xl" />}
          {/* eslint-disable-next-line @next/next/no-img-element -- preview of an image from any https host set in the panel */}
          <img src={src} alt="" className={cn('absolute inset-0 size-full', plain ? cn('object-contain', phone && mobileImage ? 'object-center' : 'object-top') : 'object-cover')} />
        </>
      ) : (
        <span className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
          <ImageIcon className="size-5" aria-hidden="true" />
          {!phone && 'Görsel ekleyince burada görünür'}
        </span>
      )}
      {!plain && (
        <>
          <div className={cn('absolute inset-0', phone ? 'bg-gradient-to-t from-background via-background/40 to-transparent' : 'bg-gradient-to-r from-background/95 via-background/60 to-transparent')} />
          <div className={cn('absolute inset-y-0 left-0 flex flex-col justify-end gap-1', phone ? 'w-full p-2' : 'w-2/3 p-4 pb-8')}>
            {shown.eyebrow && <span className={cn('truncate font-bold uppercase tracking-wider text-primary', phone ? 'text-[9px]' : 'text-xs')}>{shown.eyebrow}</span>}
            <span className={cn('line-clamp-2 shrink-0 text-balance font-display font-bold leading-tight text-foreground', phone ? 'text-xs' : 'text-lg')}>{shown.title || 'Başlık burada görünür'}</span>
            {!phone && shown.description && <span className="line-clamp-2 shrink-0 text-xs leading-relaxed text-foreground/80">{shown.description}</span>}
            {!phone && shown.cta && <span className="mt-1 w-fit rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground">{shown.cta}</span>}
          </div>
        </>
      )}
      {!phone && src && (
        <span aria-hidden="true" className="absolute bottom-2 left-3 flex gap-1">
          {[0, 1, 2].map((n) => (
            <span key={n} className={cn('h-2.5 w-9 rounded border bg-background/70', n === 0 ? 'border-primary/70' : 'border-border')} />
          ))}
        </span>
      )}
    </div>
  )
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-end gap-3">
        <figure className="flex min-w-0 flex-1 flex-col gap-1.5">
          {frame(image, false)}
          <figcaption className="text-xs text-muted-foreground">Masaüstü</figcaption>
        </figure>
        <figure className="flex w-28 shrink-0 flex-col gap-1.5 sm:w-36">
          {frame(mobileImage || image, true)}
          <figcaption className="text-xs text-muted-foreground">{plain ? 'Dar kutu, telefon' : 'Telefon'}</figcaption>
        </figure>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        {plain
          ? 'Sitede böyle görünür: görsel kesilmez, tamamı gösterilir. Sol alttaki küçük kutular slayt düğmelerinin yeridir.'
          : 'Sitede böyle görünür: görsel kutuyu dolduracak kadar büyütülür, kenarları kesilebilir; solu yazı için karartılır.'}
      </p>
    </div>
  )
}

function ItemEditor({ item, library, off = false, onDone }: { item: EditorItem; library: string[]; off?: boolean; onDone: () => void }) {
  const isSlide = item.kind === 'slide'
  const isNew = isSlide && !item.id
  const formId = useId()
  const [v, setV] = useState<Draft>(() => draftOf(item))
  const [opened] = useState(() => JSON.stringify(draftOf(item)))
  const [error, setError] = useState('')
  const [pending, start] = useTransition()
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setV((prev) => ({ ...prev, [key]: value }))
  const shown = (key: 'eyebrow' | 'title' | 'description' | 'cta' | 'speech') => v[key] || item.defaults[key] || ''
  const image = v.image || item.defaults.image || ''
  const changed = !!item.saved && Object.values(item.saved).some(Boolean)
  const plain = isSlide && v.plain
  const dirty = JSON.stringify(v) !== opened
  const typed = Boolean(v.eyebrow || v.title || v.description || v.cta)

  function payload() {
    const form = new FormData()
    form.set(isSlide ? 'id' : 'slug', item.id)
    for (const [key, value] of Object.entries(v)) form.set(key, typeof value === 'boolean' ? (value ? '1' : '0') : value)
    return form
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    if (isSlide && plain && !image) return setError('Önce görseli ekle: "Sadece görsel" slaytında sitede görünen tek şey görseldir.')
    if (isSlide && !plain && item.custom && !v.title.trim()) return setError('Başlığı yaz ya da üstten "Sadece görsel"i seç.')
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
          {dirty && !pending && (
            <span role="status" className="flex items-center gap-1.5 text-xs font-semibold text-primary">
              <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
              {isNew ? 'Henüz eklenmedi' : 'Kaydedilmedi'}
            </span>
          )}
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
      <form id={formId} data-no-guard noValidate onSubmit={submit} className="flex flex-col gap-4">
        {isSlide ? (
          <>
            {off && <p className="rounded-lg border border-border bg-background p-3 text-xs leading-relaxed text-muted-foreground">{OFF_IN_NEW_DESIGN}</p>}
            <fieldset className="flex flex-col gap-2">
              <legend className="pb-1.5 text-xs font-semibold text-foreground">Bu slaytta ne görünsün?</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {MODES.map((mode) => (
                  <label
                    key={mode.label}
                    className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-background p-3 has-[:checked]:border-primary has-[:checked]:bg-primary/10 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring"
                  >
                    <input type="radio" name="mode" value={mode.plain ? 'plain' : 'text'} checked={v.plain === mode.plain} onChange={() => set('plain', mode.plain)} className="sr-only" />
                    <mode.icon className={cn('mt-0.5 size-4 shrink-0', v.plain === mode.plain ? 'text-primary' : 'text-muted-foreground')} aria-hidden="true" />
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-sm font-semibold text-foreground">{mode.label}</span>
                      <span className="text-xs leading-relaxed text-muted-foreground">{mode.text}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <SlidePreview
              plain={plain}
              image={image}
              mobileImage={v.mobileImage}
              shown={{ eyebrow: shown('eyebrow'), title: shown('title'), description: shown('description'), cta: shown('cta') }}
            />
          </>
        ) : (
          <div className="relative aspect-video overflow-hidden rounded-xl border border-border bg-secondary sm:aspect-[16/6]">
            <Image src={image || '/placeholder.svg'} alt="" fill sizes="720px" className="object-cover" />
            <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/50 to-transparent" />
            <div className="absolute inset-y-0 left-0 flex w-3/4 flex-col justify-end gap-1 p-4">
              {shown('eyebrow') && <span className="truncate text-xs font-bold uppercase tracking-wider text-primary">{shown('eyebrow')}</span>}
              <span className="line-clamp-2 shrink-0 text-balance font-display text-lg font-bold leading-tight text-foreground">{shown('title') || 'Başlık burada görünür'}</span>
              {shown('description') && <span className="line-clamp-2 shrink-0 text-xs leading-relaxed text-foreground/80">{shown('description')}</span>}
              {shown('speech') && <span className="mt-1 w-fit max-w-full truncate rounded-lg bg-card/90 px-2.5 py-1 text-xs text-foreground">{`Jako: ${shown('speech')}`}</span>}
            </div>
            <span className="absolute right-2 top-2 rounded bg-background/80 px-1.5 py-0.5 text-xs text-muted-foreground backdrop-blur">Önizleme</span>
          </div>
        )}

        <ImageField
          label="Görsel"
          value={v.image}
          onChange={(next) => set('image', next)}
          library={library}
          uploadId={isSlide ? 'slide' : 'hero'}
          placeholder={item.defaults.image ? 'Hazır görsel kullanılıyor' : 'https://… veya /images/…'}
          hint={
            !isSlide
              ? 'Bilgisayardan yükle, galeriden seç ya da link yapıştır. Önerilen boyut 1600×500.'
              : plain
                ? 'Bilgisayardan yükle, galeriden seç ya da link yapıştır. Önerilen ölçü 1600×680 (yatay). Başka ölçü de olur: görsel kesilmez. Yükledikten sonra alttaki düğmeyle kaydetmeyi unutma.'
                : 'Bilgisayardan yükle, galeriden seç ya da link yapıştır. Önerilen ölçü 1600×680. Yazı sol tarafa geleceği için görselin önemli kısmı sağda olsun.'
          }
        />

        {isSlide && (
          <ImageField
            label={plain ? 'Dar kutu ve telefon görseli (isteğe bağlı)' : 'Telefon görseli (isteğe bağlı)'}
            value={v.mobileImage}
            onChange={(mobileImage) => set('mobileImage', mobileImage)}
            library={library}
            uploadId="slide-mobile"
            placeholder="Boşsa telefonda da üstteki görsel kullanılır"
            previewClassName="aspect-[5/4] w-40"
            hint={
              plain
                ? 'Telefonda ve masaüstünde sohbet paneli açıkken slayt kutusu kareye yakındır; bu görsel o kutuda kullanılır. Önerilen ölçü 1000×800. Boş bırakırsan geniş afiş o kutuda küçülerek tam gösterilir, altı ve üstü boş kalır.'
                : 'Telefonda slayt kutusu kareye yakındır; geniş görselin sağı ve solu kesilir. Önerilen ölçü 1000×800.'
            }
          />
        )}

        {plain && (
          <Text
            label="Afişin adı (isteğe bağlı)"
            value={v.title}
            onChange={(title) => set('title', title)}
            max={LIMITS.title}
            placeholder={item.defaults.title || 'Örnek: Market kampanyası'}
            hint="Görselin üstüne yazılmaz. Slayt düğmesinde ve ekran okuyucularda bu ad okunur."
          />
        )}

        {isSlide && !plain && (
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

        {!plain && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Text label="Üst etiket" value={v.eyebrow} onChange={(eyebrow) => set('eyebrow', eyebrow)} max={LIMITS.eyebrow} placeholder={item.defaults.eyebrow || 'Boş bırakılırsa gösterilmez'} />
            {isSlide && <Text label="Buton yazısı" value={v.cta} onChange={(cta) => set('cta', cta)} max={LIMITS.cta} placeholder={item.defaults.cta} />}
            <div className="sm:col-span-2">
              <Text label="Başlık" value={v.title} onChange={(title) => set('title', title)} max={LIMITS.title} placeholder={item.defaults.title} />
            </div>
            <div className="sm:col-span-2">
              <Text label="Açıklama" value={v.description} onChange={(description) => set('description', description)} max={LIMITS.description} placeholder={item.defaults.description} multiline />
            </div>
            {item.game && !typed && (
              <p className="text-xs leading-relaxed text-muted-foreground sm:col-span-2">
                Yazı alanlarını boş bırakırsan bu oyun slaytı yeni ana sayfada sitenin hazır kapak yazısıyla görünür. Bir şey yazarsan senin yazdığın görünür.
              </p>
            )}
          </div>
        )}

        {isSlide ? (
          <>
            <Text
              label={plain ? 'Görsele tıklayınca gidilecek link' : 'Butonun gideceği link'}
              value={v.href}
              onChange={(href) => set('href', href)}
              max={300}
              placeholder={item.defaults.href || '/oyunlar/tavla veya https://…'}
              hint={item.custom ? 'Site içi sayfa için / ile başlat (örnek: /market), başka site için https:// ile.' : 'Boş bırakırsan hazır linke gider. Site içi sayfa için / ile başlat (örnek: /market), başka site için https:// ile.'}
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
  hint,
  warnAt,
  warning,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  max: number
  placeholder?: string
  multiline?: boolean
  hint?: string
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
        <input value={value} onChange={(event) => onChange(event.target.value)} maxLength={max} placeholder={placeholder} className={cn(input, 'font-normal')} />
      )}
      {hint && <span className="font-normal leading-relaxed text-muted-foreground">{hint}</span>}
      {over && warning && <span className="font-normal text-destructive">{warning}</span>}
    </label>
  )
}
