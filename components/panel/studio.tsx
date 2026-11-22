'use client'


import { askConfirm, notify } from '@/components/panel/confirm-dialog'
import { useRouter } from 'next/navigation'
import { useState, useTransition, type FormEvent } from 'react'
import {
  BookOpen,
  Clapperboard,
  Download,
  Film,
  GalleryHorizontal,
  Globe,
  ImagePlus,
  Loader2,
  Palette,
  RefreshCw,
  Sparkles,
  Sticker,
  Trash2,
  Upload,
  Wand2,
} from 'lucide-react'
import {
  deleteBrandAction,
  deleteJobAction,
  extractBrandAction,
  moreJobsAction,
  saveBrandAction,
  saveStudioCapAction,
  studioToSlideAction,
} from '@/app/panel/studio-actions'
import { ALL_KINDS, AreaBar, AreaHead, areaOf, areaTotal, inKindGroup, startArea, writeArea, type StudioArea } from '@/components/panel/studio-areas'
import { BriefFields, MotionFields } from '@/components/panel/studio-brief-form'
import { StudioGuide, StudioHint } from '@/components/panel/studio-guide'
import { AutoReferences, ReferencePicker, StudioLibrary } from '@/components/panel/studio-library'
import { amountInput } from '@/lib/amount'
import { bestAssets } from '@/lib/studio-refs'
import {
  briefProblem,
  EMPTY_BRIEF,
  EMPTY_MOTION,
  matchAssets,
  type Brief,
  type Motion,
  type Recipe,
  type StudioFlow,
} from '@/lib/studio-brief'
import {
  budgetState,
  usd,
  DEFAULT_IMAGE_SIZE,
  DIRECTION_COST,
  EMPTY_TEXTS,
  GIF_DURATIONS,
  gifCost,
  IMAGE_SIZES,
  imageCost,
  sameTexts,
  STICKER_MOTION_COST,
  STUDIO_CATEGORIES,
  STUDIO_FORMATS,
  videoCost,
  type ImageSize,
  type MotionQuality,
  type StudioAreaTotal,
  type StudioAsset,
  type StudioBrand,
  type StudioJob,
  type StudioKind,
  type StudioTexts,
  TELEGRAM_LIMITS,
} from '@/lib/studio-types'
import { cn } from '@/lib/utils'

type StudioView = 'guide' | 'create' | 'brands' | 'library'
type AnimateMode = 'gif' | 'aigif' | 'video' | 'tgsticker' | 'tgmotion' | 'tgicon'
type AnimateOptions = { mode: AnimateMode; duration: number; audio: boolean; motion: Motion; quality: MotionQuality }
const PAID_MOTION: AnimateMode[] = ['aigif', 'video', 'tgmotion']

type Props = {
  brands: StudioBrand[]
  assets: StudioAsset[]
  /** The newest jobs of every brand, so each brand's area can be shown on its own. */
  jobs: StudioJob[]
  totals: StudioAreaTotal[]
  /** The brand area named in the address, if any. */
  initialArea?: string
  /** Spend and cap are sent to the owner account only; everyone else gets `null`. */
  spend: { total: number; month: number; count: number } | null
  budget: { cap: number | null; canEdit: boolean } | null
  /** This month's cap is used up. The one thing about the cap an account without the figures is told. */
  capFull: boolean
  /** The account may also open the Slider section, so a banner can be sent there. */
  canSlide: boolean
}

const input =
  'rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none'
const card = 'flex flex-col gap-4 rounded-2xl border border-border bg-card p-5'
const label = 'flex flex-col gap-1.5 text-xs font-semibold text-muted-foreground'
const primaryBtn =
  'flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50'
const ghostBtn =
  'flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary disabled:opacity-50'

function BudgetMeter({ spend, budget }: { spend: NonNullable<Props['spend']>; budget: NonNullable<Props['budget']> }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')
  const [message, setMessage] = useState('')
  const [pending, startTransition] = useTransition()
  const { level, share } = budgetState(spend.month, budget.cap)
  const percent = Math.round(share * 100)

  function open() {
    setValue(budget.cap ? amountInput(budget.cap) : '')
    setMessage('')
    setEditing(true)
  }

  function save(e: FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const res = await saveStudioCapAction(value)
      setMessage(res.message ?? '')
      if (!res.ok) return
      setEditing(false)
      router.refresh()
    })
  }

  return (
    <div className="flex min-w-0 flex-col gap-1.5 text-sm text-muted-foreground sm:ml-auto sm:max-w-sm sm:items-end">
      <p>
        Bu ay <strong className="text-foreground">{usd(spend.month)}</strong>
        {budget.cap != null ? ` / ${usd(budget.cap)}` : ''} · Toplam {spend.count} üretim, {usd(spend.total)}
      </p>
      {budget.cap != null ? (
        <div
          role="progressbar"
          aria-label="Aylık tavanın dolan kısmı"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          className="h-1.5 w-full overflow-hidden rounded-full bg-secondary sm:w-64"
        >
          <div
            className={cn('h-full rounded-full', level === 'full' ? 'bg-destructive' : level === 'near' ? 'bg-primary' : 'bg-success')}
            style={{ width: `${percent}%` }}
          />
        </div>
      ) : null}
      {level === 'full' ? (
        <p role="status" className="text-pretty font-semibold text-destructive sm:text-right">
          Bu ayın tavanı doldu. Ücretli üretim ay başına kadar kapalı; ücretsiz işlemler çalışır.
        </p>
      ) : level === 'near' ? (
        <p role="status" className="font-semibold text-foreground">{`Aylık tavanın %${percent}'i doldu.`}</p>
      ) : level === 'none' ? (
        <p>Aylık tavan yok: üretim sınırsız.</p>
      ) : null}
      {editing ? (
        <form onSubmit={save} data-no-guard className="flex flex-wrap items-end gap-2">
          <label className={label}>
            Aylık tavan (dolar)
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              inputMode="decimal"
              placeholder="Örn: 50"
              autoFocus
              className={cn(input, 'w-32')}
            />
          </label>
          <button type="submit" disabled={pending} className={primaryBtn}>
            Kaydet
          </button>
          <button type="button" onClick={() => setEditing(false)} className={cn(ghostBtn, 'py-2.5')}>
            Vazgeç
          </button>
          <p className="basis-full text-xs">Boş bırakıp kaydedersen tavan kalkar.</p>
        </form>
      ) : budget.canEdit ? (
        <button type="button" onClick={open} className={ghostBtn}>
          {budget.cap != null ? 'Tavanı değiştir' : 'Aylık tavan koy'}
        </button>
      ) : null}
      {message ? (
        <p role="status" className="text-xs text-foreground">
          {message}
        </p>
      ) : null}
    </div>
  )
}

export function Studio({ brands, assets, jobs, totals, initialArea, spend, budget, capFull, canSlide }: Props) {
  const [view, setView] = useState<StudioView>(brands.length ? 'create' : 'guide')
  const [picked, setPicked] = useState<StudioArea>(() => startArea(initialArea, brands))
  // A brand kit deleted while its area is open falls back to the first brand.
  const area = picked === '' || brands.some((b) => b.id === picked) ? picked : (brands[0]?.id ?? '')
  function pickArea(next: StudioArea) {
    setPicked(next)
    writeArea(next)
  }
  const figures = spend && budget ? { spend, budget } : null
  // Without the figures the screen only knows whether the cap is used up; the server refuses anything over it.
  const left = figures ? budgetState(figures.spend.month, figures.budget.cap).left : capFull ? 0 : null
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Stüdyo bölümü" className="flex flex-wrap gap-1 rounded-xl border border-border bg-card p-1">
          {(
            [
              ['guide', 'Rehber'],
              ['create', 'Üret'],
              ['brands', `Marka kitleri (${brands.length})`],
              ['library', `Sağlayıcı kütüphanesi (${assets.length})`],
            ] as const
          ).map(([key, text]) => (
            <button
              key={key}
              role="tab"
              aria-selected={view === key}
              onClick={() => setView(key)}
              className={cn(
                'flex items-center gap-1.5 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold',
                view === key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {key === 'guide' ? <BookOpen className="size-4" aria-hidden /> : null}
              {text}
            </button>
          ))}
        </div>
        {figures ? (
          <BudgetMeter spend={figures.spend} budget={figures.budget} />
        ) : capFull ? (
          <p role="status" className="min-w-0 text-pretty text-sm font-semibold text-destructive sm:ml-auto sm:max-w-sm sm:text-right">
            Bu ayın harcama sınırı doldu. Ücretli üretim ay başına kadar kapalı; ücretsiz işlemler çalışır.
          </p>
        ) : null}
      </div>
      {view === 'guide' ? (
        <StudioGuide onNavigate={setView} />
      ) : (
        <StudioHint section={view} onOpenGuide={() => setView('guide')} />
      )}
      {view === 'create' ? (
        <Creator brands={brands} assets={assets} jobs={jobs} totals={totals} area={area} onArea={pickArea} left={left} figures={Boolean(figures)} canSlide={canSlide} />
      ) : view === 'brands' ? (
        <BrandKits brands={brands} />
      ) : view === 'library' ? (
        <StudioLibrary assets={assets} />
      ) : null}
    </div>
  )
}

function Creator({
  brands,
  assets,
  jobs,
  totals,
  area: brandId,
  onArea,
  left,
  figures,
  canSlide,
}: Pick<Props, 'brands' | 'assets' | 'jobs' | 'totals' | 'canSlide'> & {
  /** The account sees the cap and what is left of it. */
  figures: boolean
  /** The brand whose area is open; the form makes new work for it and the list shows only its jobs. */
  area: StudioArea
  onArea: (area: StudioArea) => void
  left: number | null
}) {
  const router = useRouter()
  const [flow, setFlow] = useState<StudioFlow>('banner')
  const [kind, setKind] = useState<string>(ALL_KINDS)
  // Older jobs fetched with "show more", and jobs deleted since the list was loaded.
  const [older, setOlder] = useState<StudioJob[]>([])
  const [gone, setGone] = useState<number[]>([])
  const [loadingMore, startMore] = useTransition()
  const [formats, setFormats] = useState<string[]>(['1:1'])
  const [category, setCategory] = useState<string>(STUDIO_CATEGORIES[0])
  const [brief, setBrief] = useState<Brief>(EMPTY_BRIEF)
  const [picked, setPicked] = useState<number[]>([])
  const [autoPick, setAutoPick] = useState(true)
  const [running, setRunning] = useState(0)
  const [error, setError] = useState('')
  const [results, setResults] = useState<StudioJob[]>([])
  const [revising, setRevising] = useState<StudioJob | null>(null)
  const [revision, setRevision] = useState('')
  const [animating, setAnimating] = useState<StudioJob | null>(null)
  const [duration, setDuration] = useState<number>(6)
  const [gifSeconds, setGifSeconds] = useState<number>(GIF_DURATIONS[0])
  const [audio, setAudio] = useState(false)
  const [motion, setMotion] = useState<Motion>(EMPTY_MOTION)
  const [quality, setQuality] = useState<MotionQuality>('sd')
  // The GIF flow can also make the free light effect, where the picture itself does not move.
  const [gifReal, setGifReal] = useState(true)
  const [outline, setOutline] = useState(true)
  const [stickerMoves, setStickerMoves] = useState(false)
  const [animFlow, setAnimFlow] = useState<'gif' | 'video'>('gif')
  const [videoRuns, setVideoRuns] = useState(0)

  const [mascotOn, setMascotOn] = useState(true)
  const [texts, setTexts] = useState<StudioTexts>(EMPTY_TEXTS)
  const [revisedTexts, setRevisedTexts] = useState<StudioTexts>(EMPTY_TEXTS)
  const [size, setSize] = useState<ImageSize>(DEFAULT_IMAGE_SIZE)

  const brand = brands.find((b) => b.id === brandId)
  const useMascot = Boolean(brand?.mascot) && mascotOn
  const runs = flow === 'sticker' ? ['1:1'] : formats
  const clipCost = videoCost(duration, audio, quality === 'hd')
  const realGifCost = gifCost(gifSeconds, quality)
  const followUp: AnimateMode | null =
    flow === 'video' ? 'video' : flow === 'gif' ? (gifReal ? 'aigif' : 'gif') : flow === 'sticker' && stickerMoves ? 'tgmotion' : null
  const followCost = followUp === 'video' ? clipCost : followUp === 'aigif' ? realGifCost : followUp === 'tgmotion' ? STICKER_MOTION_COST : 0
  const unitCost = imageCost(flow === 'sticker' ? '1K' : size) + DIRECTION_COST + followCost
  const animCost = animFlow === 'gif' ? realGifCost : clipCost
  const motionOptions = (mode: AnimateMode): AnimateOptions => ({
    mode,
    duration: mode === 'aigif' ? gifSeconds : duration,
    audio,
    motion,
    quality,
  })
  const named = `${brief.subject} ${brief.scene} ${brief.character}`
  // The best pictures of the game the form names. They are used unless staff picked by hand or switched them off.
  const autoFound = bestAssets(named, assets, flow === 'sticker' ? 'sticker' : 'banner')
  const references = picked.length ? picked : autoPick ? autoFound : []
  const suggested = autoFound.length ? [] : matchAssets(named, assets).filter((id) => !picked.includes(id))

  function applyRecipe(recipe: Recipe) {
    setBrief({ ...EMPTY_BRIEF, ...recipe.brief })
    setMotion({ ...EMPTY_MOTION, ...recipe.motion })
    // Copy the user already typed is never replaced by the recipe's example.
    if (flow !== 'sticker' && recipe.texts && sameTexts(texts, EMPTY_TEXTS)) setTexts({ ...EMPTY_TEXTS, ...recipe.texts })
  }
  const textsChanged = revising?.kind === 'banner' && !sameTexts(revisedTexts, revising.texts)
  // Copy-only changes are re-printed on the stored text-free picture, so they cost nothing.
  const retextOnly = Boolean(revising?.retextable) && textsChanged && revision.trim().length < 5
  // The server refuses these too; the buttons close first so nobody waits for a refusal.
  const overCap = (cost: number) => left != null && cost > left + 1e-9
  const plannedCost = unitCost * runs.length
  const revisionCost = revising && !retextOnly ? imageCost(revising.kind === 'sticker' ? '1K' : size) + DIRECTION_COST : 0

  async function post(url: string, body: Record<string, unknown>): Promise<StudioJob | null> {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({ error: 'Sunucu zaman aşımına uğradı, tekrar dene.' }))
      if (!res.ok) throw new Error(data.error ?? 'Üretim başarısız oldu.')
      setResults((r) => [data.job, ...r])
      return data.job
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Üretim başarısız oldu.')
      return null
    }
  }

  async function generate(body: Record<string, unknown>) {
    setRunning((n) => n + 1)
    try {
      return await post('/api/studio/generate', body)
    } finally {
      setRunning((n) => n - 1)
    }
  }

  async function animate(job: StudioJob, options: AnimateOptions) {
    const isVideo = PAID_MOTION.includes(options.mode)
    if (isVideo) setVideoRuns((n) => n + 1)
    else setRunning((n) => n + 1)
    try {
      return await post('/api/studio/animate', { jobId: job.id, ...options })
    } finally {
      if (isVideo) setVideoRuns((n) => n - 1)
      else setRunning((n) => n - 1)
    }
  }

  async function start() {
    setError('')
    const problem = briefProblem(brief)
    if (problem) return setError(problem)
    if (!runs.length) return setError('En az bir format seç.')
    const baseKind = flow === 'sticker' ? 'sticker' : 'banner'
    await Promise.all(
      runs.map(async (format) => {
        const made = await generate({ kind: baseKind, format, category, brief, brandId, assetIds: references, useMascot, size, texts, outline })
        if (made && followUp) await animate(made, motionOptions(followUp))
      }),
    )
    router.refresh()
  }

  async function runAnimation(mode: 'gif' | 'aigif' | 'video') {
    if (!animating) return
    setError('')
    const job = animating
    setAnimating(null)
    await animate(job, motionOptions(mode))
    router.refresh()
  }

  function openRevision(job: StudioJob) {
    setRevising(job)
    setRevisedTexts(job.texts ?? EMPTY_TEXTS)
  }

  async function revise() {
    if (!revising || (revision.trim().length < 5 && !retextOnly)) return
    setError('')
    const parent = revising
    setRevising(null)
    await generate({
      kind: parent.kind,
      format: parent.format,
      category,
      prompt: revision,
      brandId: parent.brandId ?? brandId,
      parentId: parent.id,
      useMascot: Boolean(brands.find((b) => b.id === (parent.brandId ?? brandId))?.mascot) && mascotOn,
      size,
      ...(parent.kind === 'banner' ? { texts: revisedTexts, retext: retextOnly } : {}),
    })
    setRevision('')
    router.refresh()
  }

  const byId = new Map<number, StudioJob>()
  for (const job of [...results, ...jobs, ...older]) {
    if (!byId.has(job.id) && !gone.includes(job.id) && areaOf(job, brands) === brandId) byId.set(job.id, job)
  }
  const mine = [...byId.values()].sort((a, b) => b.id - a.id)
  const shown = mine.filter((job) => inKindGroup(job, kind))
  const total = areaTotal(totals, brandId)
  const areaName = brand?.name ?? 'Markasız'

  function switchArea(next: StudioArea) {
    setKind(ALL_KINDS)
    onArea(next)
  }

  function loadMore() {
    const last = mine[mine.length - 1]
    if (!last) return
    startMore(async () => {
      const res = await moreJobsAction(brandId === '' ? null : brandId, last.id)
      if (res.jobs) setOlder((list) => [...list, ...(res.jobs ?? [])])
      else setError(res.message ?? 'Liste yüklenemedi.')
    })
  }

  return (
    <div className="flex flex-col gap-6">
    <AreaBar brands={brands} totals={totals} area={brandId} onPick={switchArea} />
    <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
      <div className={cn(card, 'h-fit')}>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ['banner', 'Görsel / Banner', ImagePlus],
              ['gif', 'Hareketli GIF', Film],
              ['video', 'Video', Clapperboard],
              ['sticker', 'Sticker', Sticker],
            ] as const
          ).map(([key, text, Icon]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFlow(key)}
              aria-pressed={flow === key}
              className={cn(
                'flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-bold',
                flow === key ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground',
              )}
            >
              <Icon className="size-4" aria-hidden />
              {text}
            </button>
          ))}
        </div>

        <label className={label}>
          Marka (logo ve renkler bu kitten alınır)
          <select value={brandId} onChange={(e) => switchArea(e.target.value ? Number(e.target.value) : '')} className={input}>
            <option value="">Markasız</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} {b.domain ? `· ${b.domain}` : ''}
              </option>
            ))}
          </select>
        </label>
        {brand ? (
          <div className="flex items-center gap-3 rounded-xl bg-secondary p-3">
            {brand.logoUrl ? (
              <img src={brand.logoUrl || '/placeholder.svg'} alt={`${brand.name} logosu`} className="h-8 max-w-28 object-contain" />
            ) : (
              <span className="text-xs text-muted-foreground">Logo yok</span>
            )}
            <div className="flex gap-1">
              {brand.colors.map((c) => (
                <span key={c} className="size-5 rounded-full border border-border" style={{ background: c }} title={c} />
              ))}
            </div>
          </div>
        ) : null}
        {brand?.mascotUrl ? (
          <label
            className={cn(
              'flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors',
              mascotOn ? 'border-primary bg-primary/10' : 'border-border',
            )}
          >
            <img src={brand.mascotUrl || '/placeholder.svg'} alt={`${brand.name} maskotu`} className="size-12 shrink-0 rounded-lg object-contain" />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-sm font-bold text-foreground">Maskotu tasarıma ekle</span>
              <span className="text-xs leading-relaxed text-muted-foreground">Maskot birebir korunur, sadece pozu ve ifadesi talimata göre değişir.</span>
            </span>
            <input type="checkbox" checked={mascotOn} onChange={(e) => setMascotOn(e.target.checked)} className="size-4 accent-primary" />
          </label>
        ) : null}

        {flow !== 'sticker' ? (
          <>
            <fieldset className={label}>
              <legend className="mb-1.5">Formatlar (birden fazla seçersen hepsi aynı anda üretilir)</legend>
              <div className="grid grid-cols-3 gap-2">
                {STUDIO_FORMATS.map((f) => {
                  const on = formats.includes(f.id)
                  return (
                    <button
                      key={f.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setFormats((list) => (on ? list.filter((x) => x !== f.id) : [...list, f.id]))}
                      className={cn(
                        'flex flex-col items-center rounded-xl border px-2 py-2 text-xs',
                        on ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground',
                      )}
                    >
                      <span className="font-bold">{f.label}</span>
                      <span>{f.hint}</span>
                    </button>
                  )
                })}
              </div>
            </fieldset>
            <fieldset className={label}>
              <legend className="mb-1.5">Kalite</legend>
              <div className="grid grid-cols-3 gap-2">
                {IMAGE_SIZES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={size === s.id}
                    onClick={() => setSize(s.id)}
                    className={cn(
                      'flex flex-col items-center rounded-xl border px-2 py-2 text-xs',
                      size === s.id ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground',
                    )}
                  >
                    <span className="font-bold">{s.label}</span>
                    <span className="text-center">{s.hint}</span>
                    <span>~{usd(s.cost)}</span>
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-xs font-normal leading-relaxed text-muted-foreground">
                En yüksek, daha büyük modelle çizilir: ışık, doku ve ayrıntı belirgin biçimde iyileşir, görsel başına ücret artar. Her üretimde isteğin önce ayrıntılı sahne tarifine çevrilir (~{usd(DIRECTION_COST)}).
              </p>
            </fieldset>
            <label className={label}>
              Kategori
              <select value={category} onChange={(e) => setCategory(e.target.value)} className={input}>
                {STUDIO_CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <TextFields value={texts} onChange={setTexts} />
          </>
        ) : null}

        <BriefFields flow={flow} brief={brief} onBrief={setBrief} motion={motion} onMotion={setMotion} onRecipe={applyRecipe} />
        {autoFound.length && !picked.length ? (
          <AutoReferences assets={assets} ids={autoFound} on={autoPick} onToggle={setAutoPick} onEdit={() => setPicked(autoFound)} />
        ) : null}
        {suggested.length && picked.length < 3 ? (
          <button type="button" onClick={() => setPicked((p) => [...p, ...suggested].slice(0, 3))} className={ghostBtn}>
            {`Kütüphanede adı geçen ${suggested.length} görsel var · referans olarak ekle`}
          </button>
        ) : null}

        {flow === 'gif' ? (
          <fieldset className={label}>
            <legend className="mb-1.5">GIF nasıl hareket etsin</legend>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  [true, 'Gerçek hareket', 'Karakter ve sahne oynar · ücretli'],
                  [false, 'Işık efekti', 'Görsel durur, üstünden ışık geçer · ücretsiz'],
                ] as const
              ).map(([real, name, about]) => (
                <button
                  key={name}
                  type="button"
                  aria-pressed={gifReal === real}
                  onClick={() => setGifReal(real)}
                  className={cn(
                    'flex flex-col items-center gap-0.5 rounded-xl border px-2 py-2 text-center text-xs',
                    gifReal === real ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground',
                  )}
                >
                  <span className="font-bold">{name}</span>
                  <span className="text-pretty font-normal">{about}</span>
                </button>
              ))}
            </div>
          </fieldset>
        ) : null}
        {flow === 'video' || flow === 'sticker' || (flow === 'gif' && gifReal) ? (
          <MotionFields
            flow={flow}
            motion={motion}
            onMotion={setMotion}
            duration={duration}
            setDuration={setDuration}
            gifSeconds={gifSeconds}
            setGifSeconds={setGifSeconds}
            audio={audio}
            setAudio={setAudio}
            quality={quality}
            setQuality={setQuality}
          />
        ) : null}
        {flow === 'sticker' ? (
          <div className="flex flex-col gap-2 rounded-xl border border-border p-3 text-xs font-semibold text-muted-foreground">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={outline} onChange={(e) => setOutline(e.target.checked)} className="size-4 accent-primary" />
              Beyaz kenar çizgisi ekle
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={stickerMoves} onChange={(e) => setStickerMoves(e.target.checked)} className="size-4 accent-primary" />
              {`Hareketlisini de üret (Telegram video sticker) · ~${usd(STICKER_MOTION_COST)}`}
            </label>
            <p className="font-normal leading-relaxed">
              Sticker şeffaf arka planla, Telegram ölçüsünde (512 px) çıkar. Hareketlisini sonradan sticker kartındaki düğmeyle de üretebilirsin.{' '}
              {outline
                ? 'Beyaz kenar her yerde aynı kalınlıkta basılır.'
                : 'Beyaz kenar basılmaz, çizim olduğu gibi çıkar; koyu renkli yazı Telegram’ın koyu temasında zor okunur.'}
            </p>
          </div>
        ) : null}

        {assets.length ? <ReferencePicker assets={assets} picked={picked} onPicked={setPicked} /> : null}

        <button type="button" onClick={start} disabled={running + videoRuns > 0 || overCap(plannedCost)} className={primaryBtn}>
          {running + videoRuns > 0 ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Sparkles className="size-4" aria-hidden />}
          {running + videoRuns > 0 ? `Üretiliyor (${running + videoRuns})...` : `Üret · ~${usd(plannedCost)}`}
        </button>
        {overCap(plannedCost) ? <CapNote cost={plannedCost} left={figures ? left : null} /> : null}
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-4">
        <AreaHead name={areaName} count={Math.max(total.count, mine.length)} cost={total.cost} jobs={mine} kind={kind} onKind={setKind} />
        {revising ? (
          <div className={card}>
            <div className="flex items-center gap-2">
              <Wand2 className="size-5 text-primary" aria-hidden />
              <h3 className="font-display text-lg font-bold uppercase text-foreground">Revize et</h3>
            </div>
            <div className="flex gap-4">
              <img src={revising.url || '/placeholder.svg'} alt="Revize edilecek görsel" className="h-28 rounded-lg object-contain" />
              <textarea
                value={revision}
                onChange={(e) => setRevision(e.target.value)}
                rows={4}
                aria-label="Görsel için revize talimatı"
                placeholder={revising.kind === 'banner' ? 'Örn: karakter erkek olsun, arka plan daha koyu olsun' : 'Örn: maskot gülsün, yazı "KOD GELDİ!" olsun'}
                className={cn(input, 'flex-1 resize-y')}
              />
            </div>
            {revising.kind === 'banner' ? (
              <>
                <TextFields value={revisedTexts} onChange={setRevisedTexts} />
                {!revising.retextable && textsChanged ? (
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Bu eski bir üretim, yazısız hali saklı değil. Yazıyı değiştirmek için yukarıya kısa bir görsel talimatı da yaz.
                  </p>
                ) : null}
              </>
            ) : null}
            <div className="flex gap-2">
              <button type="button" onClick={revise} disabled={(revision.trim().length < 5 && !retextOnly) || overCap(revisionCost)} className={primaryBtn}>
                {retextOnly ? 'Yazıyı güncelle · ücretsiz' : `Revizeyi üret · ~${usd(revisionCost)}`}
              </button>
              <button type="button" onClick={() => setRevising(null)} className={ghostBtn}>
                Vazgeç
              </button>
            </div>
            {overCap(revisionCost) ? <CapNote cost={revisionCost} left={figures ? left : null} /> : null}
          </div>
        ) : null}

        {animating ? (
          <div className={card}>
            <div className="flex items-center gap-2">
              <Film className="size-5 text-primary" aria-hidden />
              <h3 className="font-display text-lg font-bold uppercase text-foreground">Hareketlendir</h3>
            </div>
            <div className="flex flex-col gap-4 md:flex-row">
              <img src={animating.url || '/placeholder.svg'} alt="Hareketlendirilecek banner" className="h-32 self-start rounded-lg object-contain" />
              <div className="flex flex-1 flex-col gap-3">
                <div className="flex gap-1.5" role="group" aria-label="Çıktı türü">
                  {(
                    [
                      ['gif', 'Hareketli GIF'],
                      ['video', 'Video'],
                    ] as const
                  ).map(([key, name]) => (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={animFlow === key}
                      onClick={() => setAnimFlow(key)}
                      className={cn(
                        'rounded-lg border px-3 py-1.5 text-xs font-bold',
                        animFlow === key ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground',
                      )}
                    >
                      {name}
                    </button>
                  ))}
                </div>
                <MotionFields
                  flow={animFlow}
                  motion={motion}
                  onMotion={setMotion}
                  duration={duration}
                  setDuration={setDuration}
                  gifSeconds={gifSeconds}
                  setGifSeconds={setGifSeconds}
                  audio={audio}
                  setAudio={setAudio}
                  quality={quality}
                  setQuality={setQuality}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => runAnimation(animFlow === 'gif' ? 'aigif' : 'video')} disabled={overCap(animCost)} className={primaryBtn}>
                {animFlow === 'gif' ? <Film className="size-4" aria-hidden /> : <Clapperboard className="size-4" aria-hidden />}
                {`${animFlow === 'gif' ? 'Hareketli GIF üret' : 'Video üret'} · ~${usd(animCost)}`}
              </button>
              <button type="button" onClick={() => runAnimation('gif')} className={ghostBtn} title="Görsel durur, üstünden ışık geçer">
                <Film className="size-3.5" aria-hidden /> Işık efektli GIF · ücretsiz
              </button>
              <button type="button" onClick={() => setAnimating(null)} className={ghostBtn}>
                Vazgeç
              </button>
            </div>
            {overCap(animCost) ? <CapNote cost={animCost} left={figures ? left : null} /> : null}
          </div>
        ) : null}

        {shown.length === 0 && running + videoRuns === 0 ? (
          <div className="flex min-h-80 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border p-8 text-center">
            <Sparkles className="size-8 text-primary" aria-hidden />
            <p className="font-semibold text-foreground">{mine.length ? 'Bu türde üretim yok' : `${areaName} için henüz üretim yok`}</p>
            <p className="max-w-sm text-pretty text-sm text-muted-foreground">
              {mine.length
                ? 'Yukarıdan başka bir tür seç ya da "Hepsi"ne dön.'
                : 'Soldan işi seç, formu doldur ve üret; çıkan iş bu markanın alanında durur. Logo yapay zekaya çizdirilmez, kitteki orijinal logo birebir basılır.'}
            </p>
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: running }).map((_, i) => (
            <div key={`run-${i}`} className="flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-card">
              <Loader2 className="size-6 animate-spin text-primary" aria-hidden />
              <span className="text-xs text-muted-foreground">Üretiliyor, 10-30 sn</span>
            </div>
          ))}
          {Array.from({ length: videoRuns }).map((_, i) => (
            <div key={`video-${i}`} className="flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-card p-4 text-center">
              <Clapperboard className="size-6 animate-pulse text-primary" aria-hidden />
              <span className="text-xs text-muted-foreground">Hareket üretiliyor, 1-3 dk sürer. Sayfadan ayrılma.</span>
            </div>
          ))}
          {shown.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              canSlide={canSlide}
              onRevise={() => openRevision(job)}
              onAnimate={() => setAnimating(job)}
              onDeleted={() => setGone((ids) => [...ids, job.id])}
              motionOff={overCap(STICKER_MOTION_COST)}
              onTelegram={async (mode) => {
                setError('')
                await animate(job, motionOptions(mode))
                router.refresh()
              }}
            />
          ))}
        </div>
        {mine.length < total.count ? (
          <button type="button" onClick={loadMore} disabled={loadingMore} className={cn(ghostBtn, 'self-center')}>
            {loadingMore ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
            {`Daha eski üretimleri göster (${total.count - mine.length})`}
          </button>
        ) : null}
      </div>
    </div>
    </div>
  )
}

function CapNote({ cost, left }: { cost: number; left: number | null }) {
  return (
    <p role="status" className="text-pretty text-sm text-destructive">
      {left == null
        ? 'Bu iş bu ayın harcama sınırını aşıyor. Sınırı sadece ana yönetici görür ve değiştirir.'
        : `Bu iş (~${usd(cost)}) aylık tavandan kalan ${usd(left)} tutarını aşıyor. Tavanı yukarıdan değiştirebilirsin.`}
    </p>
  )
}

const KIND_LABEL: Record<StudioKind, string> = {
  banner: 'Banner',
  sticker: 'Sticker',
  gif: 'GIF',
  video: 'Video',
  tgsticker: 'Telegram hareketli sticker',
  tgicon: 'Telegram paket ikonu',
}

const TEXT_FIELDS: { key: keyof StudioTexts; name: string; placeholder: string }[] = [
  { key: 'headline', name: 'Başlık', placeholder: '%500 FREESPIN BONUSU' },
  { key: 'subline', name: 'Alt yazı', placeholder: 'İlk yatırımına özel, bugün son gün' },
  { key: 'cta', name: 'Buton', placeholder: 'HEMEN KATIL' },
]

function TextFields({ value, onChange }: { value: StudioTexts; onChange: (texts: StudioTexts) => void }) {
  return (
    <fieldset className="flex flex-col gap-3 rounded-xl border border-border p-3">
      <legend className="px-1 text-xs font-semibold text-muted-foreground">Görsel üstü yazılar (opsiyonel)</legend>
      {TEXT_FIELDS.map((field) => (
        <label key={field.key} className={label}>
          {field.name}
          <input
            value={value[field.key]}
            onChange={(e) => onChange({ ...value, [field.key]: e.target.value })}
            placeholder={field.placeholder}
            className={input}
          />
        </label>
      ))}
      <p className="text-xs leading-relaxed text-muted-foreground">
        Buraya yazdıkların yapay zekaya çizdirilmez, gerçek fontla birebir basılır; Türkçe harf hatası ya da tekrar olmaz. Rakam ve % içeren kelimeler marka rengiyle vurgulanır. Türkçe harfsiz yazdıysan (HOS GELDIN) harfler düzeltilip basılır (HOŞ GELDİN), kelimelerin değişmez. Bu alanları boş bırakıp konuya &quot;üstünde ... yazsın&quot; dersen o yazı da ayıklanıp aynı şekilde basılır; yazı istemediysen görsel yazısız çıkar. Basılan yazıyı sonradan ücretsiz değiştirebilirsin.
      </p>
    </fieldset>
  )
}

function JobCard({
  job,
  onRevise,
  onAnimate,
  onTelegram,
  onDeleted,
  motionOff,
  canSlide,
}: {
  job: StudioJob
  canSlide: boolean
  onRevise: () => void
  onAnimate: () => void
  onDeleted?: () => void
  onTelegram?: (mode: 'tgsticker' | 'tgmotion' | 'tgicon') => void
  /** The monthly cap has no room left for a model-animated sticker. */
  motionOff?: boolean
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const transparent = job.kind === 'sticker' || job.kind === 'tgsticker' || job.kind === 'tgicon'
  return (
    <figure className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card">
      <div className={cn('flex items-center justify-center', transparent ? 'bg-[repeating-conic-gradient(var(--secondary)_0_25%,transparent_0_50%)] bg-[length:20px_20px] p-4' : 'bg-secondary')}>
        {job.kind === 'tgsticker' ? (
          <video src={job.url} autoPlay loop muted playsInline className="max-h-80 w-full object-contain">
            <track kind="captions" />
          </video>
        ) : job.kind === 'video' ? (
          <video src={job.url} controls loop muted playsInline preload="metadata" className="max-h-80 w-full bg-foreground object-contain">
            <track kind="captions" />
          </video>
        ) : (
          <img src={job.url || '/placeholder.svg'} alt={job.prompt} loading="lazy" className="max-h-80 w-full object-contain" />
        )}
      </div>
      <figcaption className="flex flex-col gap-2 p-3">
        <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{job.prompt}</p>
        <p className="text-xs font-semibold text-foreground">
          {job.brandName || 'Markasız'} · {KIND_LABEL[job.kind]}
          {job.kind !== 'sticker' ? ` ${job.format}` : ''}
          {job.parentId && (job.kind === 'banner' || job.kind === 'sticker') ? ' · revize' : ''}
        </p>
        <div className="flex flex-wrap gap-1.5">
          <a href={`${job.url}?download`} className={ghostBtn}>
            <Download className="size-3.5" aria-hidden /> {job.hdUrl ? 'İndir (Telegram)' : 'İndir'}
          </a>
          {job.hdUrl ? (
            <a href={`${job.hdUrl}?download`} className={ghostBtn} title="1024 px, saydam zeminli, sıkıştırılmamış PNG. Telegram dışındaki işler için.">
              <Download className="size-3.5" aria-hidden /> HD indir (PNG)
            </a>
          ) : null}
          {job.kind === 'banner' || job.kind === 'sticker' ? (
            <button type="button" onClick={onRevise} className={ghostBtn}>
              <RefreshCw className="size-3.5" aria-hidden /> Revize
            </button>
          ) : null}
          {job.kind === 'banner' ? (
            <button type="button" onClick={onAnimate} className={ghostBtn}>
              <Film className="size-3.5" aria-hidden /> Hareketlendir
            </button>
          ) : null}
          {job.kind === 'banner' && canSlide ? (
            <button
              type="button"
              disabled={pending}
              title="Görseli gizli bir slayt olarak Slider'a ekler"
              onClick={() =>
                void askConfirm(
                  job.format === '16:9'
                    ? 'Bu görsel Slider\'a gizli bir slayt olarak eklensin mi? Başlığını ve linkini Slider bölümünde düzenleyip yayına alırsın.'
                    : `Bu görsel ${job.format} oranında; slider yatay olduğu için kenarları kesilir. Yine de gizli bir slayt olarak eklensin mi?`,
                ).then(
                  (ok) =>
                    ok &&
                    start(async () => {
                      const result = await studioToSlideAction(job.id)
                      notify(Boolean(result.ok), result.message ?? 'Eklenemedi.')
                    }),
                )
              }
              className={ghostBtn}
            >
              <GalleryHorizontal className="size-3.5" aria-hidden /> {'Slider\'a ekle'}
            </button>
          ) : null}
          {job.kind === 'sticker' && onTelegram ? (
            <>
              <button
                type="button"
                onClick={() => onTelegram('tgmotion')}
                disabled={motionOff}
                className={ghostBtn}
                title={`Karakter gerçekten hareket eder; soldaki "Ne hareket etsin" alanını kullanır. ${TELEGRAM_LIMITS.tgsticker.label}`}
              >
                <Film className="size-3.5" aria-hidden /> {`Hareketlendir · ~${usd(STICKER_MOTION_COST)}`}
              </button>
              <button
                type="button"
                onClick={() => onTelegram('tgsticker')}
                className={ghostBtn}
                title={`Sticker olduğu gibi hafifçe sallanır. ${TELEGRAM_LIMITS.tgsticker.label}`}
              >
                Sallanma · ücretsiz
              </button>
              <button type="button" onClick={() => onTelegram('tgicon')} className={ghostBtn} title={TELEGRAM_LIMITS.tgicon.label}>
                Paket ikonu
              </button>
            </>
          ) : null}
          <button
            type="button"
            disabled={pending}
            aria-label="Sil"
            onClick={() =>
              void askConfirm('Bu üretim ve dosyası kalıcı olarak silinsin mi? Geri alınamaz.').then(
                (ok) =>
                  ok &&
                  start(async () => {
                    const res = await deleteJobAction(job.id)
                    if (res.ok) onDeleted?.()
                    router.refresh()
                  }),
              )
            }
            className={cn(ghostBtn, 'ml-auto text-destructive')}
          >
            <Trash2 className="size-3.5" aria-hidden />
          </button>
        </div>
        {job.kind === 'tgsticker' ? <TelegramHowTo /> : null}
      </figcaption>
    </figure>
  )
}

/** A moving sticker is a .webm file; Telegram takes it only through the @Stickers bot. */
function TelegramHowTo() {
  return (
    <details className="rounded-lg border border-border bg-secondary/40 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
      <summary className="cursor-pointer font-semibold text-foreground">{'Telegram\'a nasıl eklenir?'}</summary>
      <ol className="mt-2 flex list-decimal flex-col gap-1 pl-4">
        <li>
          {'Telegram\'da '}
          <a href="https://t.me/Stickers" target="_blank" rel="noreferrer" className="font-semibold text-foreground underline underline-offset-2">
            @Stickers
          </a>
          {' botunu aç.'}
        </li>
        <li>
          {'Yeni paket için '}
          <code className="font-mono text-foreground">/newvideo</code>
          {', hazır paketine eklemek için '}
          <code className="font-mono text-foreground">/addsticker</code>
          {' yaz.'}
        </li>
        <li>{'İndirdiğin .webm dosyasını bota gönder, ardından bu stickera uyan bir emoji yolla.'}</li>
        <li>
          {'Yeni pakette '}
          <code className="font-mono text-foreground">/publish</code>
          {' ile paketi yayınla; bot paketin linkini verir.'}
        </li>
      </ol>
      <p className="mt-2">
        {'Telegram\'ın sticker panelindeki + düğmesi (sticker düzenleyicisi) sadece fotoğraf alır; hareketli sticker oradan eklenmez.'}
      </p>
    </details>
  )
}

type Draft = {
  id: number | null
  name: string
  domain: string
  logo: string
  logoUrl: string
  mascot: string
  mascotUrl: string
  colors: string[]
  font: string
  notes: string
}
const emptyDraft: Draft = { id: null, name: '', domain: '', logo: '', logoUrl: '', mascot: '', mascotUrl: '', colors: [], font: '', notes: '' }

function BrandKits({ brands }: { brands: StudioBrand[] }) {
  const router = useRouter()
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [message, setMessage] = useState('')
  const [pending, start] = useTransition()
  const [uploading, setUploading] = useState<'' | 'logo' | 'mascot'>('')
  const [reading, setReading] = useState(false)
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }))

  function extract() {
    if (!draft.domain.trim()) return setMessage('Önce domain yaz.')
    setMessage('')
    start(async () => {
      const res = await extractBrandAction(draft.domain)
      if (res.brand) {
        set({
          name: draft.name || res.brand.name,
          domain: res.brand.domain,
          logo: res.brand.logo || draft.logo,
          logoUrl: res.brand.logo ? `/api/studio/file/${res.brand.logo.replace(/^studio\//, '')}` : draft.logoUrl,
          colors: res.brand.colors.length ? res.brand.colors : draft.colors,
          font: res.brand.font || draft.font,
        })
      }
      setMessage(res.message ?? '')
    })
  }

  async function fromScreenshot(file: File) {
    setMessage('')
    setReading(true)
    const form = new FormData()
    form.set('file', file)
    form.set('domain', draft.domain)
    try {
      const res = await fetch('/api/studio/brand-screenshot', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) return setMessage(data.error)
      const b = data.brand as { name: string; domain: string; logo: string; colors: string[]; font: string }
      set({
        name: draft.name || b.name,
        domain: b.domain || draft.domain,
        logo: b.logo || draft.logo,
        logoUrl: b.logo ? `/api/studio/file/${b.logo.replace(/^studio\//, '')}` : draft.logoUrl,
        colors: b.colors.length ? b.colors : draft.colors,
        font: b.font || draft.font,
      })
      setMessage(data.message ?? '')
    } catch {
      setMessage('Ekran görüntüsü işlenemedi, tekrar dene.')
    } finally {
      setReading(false)
    }
  }

  async function uploadBrandImage(file: File, target: 'logo' | 'mascot') {
    setUploading(target)
    const form = new FormData()
    form.set('target', target)
    form.append('file', file)
    try {
      const res = await fetch('/api/studio/upload', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) return setMessage(data.error)
      const pathname = data.pathnames[0] as string
      const url = `/api/studio/file/${pathname.replace(/^studio\//, '')}`
      set(target === 'logo' ? { logo: pathname, logoUrl: url } : { mascot: pathname, mascotUrl: url })
    } catch {
      setMessage('Yükleme başarısız oldu, tekrar dene.')
    } finally {
      setUploading('')
    }
  }

  function save() {
    start(async () => {
      const res = await saveBrandAction(draft)
      setMessage(res.message ?? '')
      if (res.ok) {
        setDraft(emptyDraft)
        router.refresh()
      }
    })
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <div className={card}>
        <div className="flex items-center gap-2">
          <Palette className="size-5 text-primary" aria-hidden />
          <h2 className="font-display text-xl font-bold uppercase text-foreground">
            {draft.id ? 'Marka kitini düzenle' : 'Yeni marka kiti'}
          </h2>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Sitenin güncel domainini yaz ve &quot;Siteden çek&quot;e bas. Logo, renkler ve font otomatik alınır. Her marka ayrı tutulur, tasarımlar
          birbirine karışmaz.
        </p>
        <div className="flex gap-2">
          <input
            value={draft.domain}
            onChange={(e) => set({ domain: e.target.value })}
            placeholder="ornekbahis123.com"
            aria-label="Domain"
            className={cn(input, 'flex-1')}
          />
          <button type="button" onClick={extract} disabled={pending} className={primaryBtn}>
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Globe className="size-4" aria-hidden />}
            Siteden çek
          </button>
        </div>
        <div className="flex flex-col gap-2 rounded-xl border border-dashed border-border p-3 md:flex-row md:items-center md:justify-between">
          <p className="text-xs leading-relaxed text-muted-foreground">
            Site bot korumasındaysa ya da yanlış veri gelirse: sitenin ana sayfasının ekran görüntüsünü yükle. Yapay zeka logoyu keser, renkleri ve font
            stilini çıkarır.
          </p>
          <label className={cn(ghostBtn, 'shrink-0 cursor-pointer')}>
            {reading ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Upload className="size-3.5" aria-hidden />}
            {reading ? 'Okunuyor...' : 'Ekran görüntüsünden çek'}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              disabled={reading}
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) fromScreenshot(f)
                e.target.value = ''
              }}
            />
          </label>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <label className={label}>
            Marka adı
            <input value={draft.name} onChange={(e) => set({ name: e.target.value })} className={input} />
          </label>
          <label className={label}>
            Font
            <input value={draft.font} onChange={(e) => set({ font: e.target.value })} placeholder="Montserrat" className={input} />
          </label>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-muted-foreground">Renkler</span>
          <div className="flex flex-wrap items-center gap-2">
            {draft.colors.map((c, i) => (
              <span key={`${c}-${i}`} className="flex items-center gap-1 rounded-lg border border-border p-1">
                <input
                  type="color"
                  value={c}
                  aria-label={`Renk ${i + 1}`}
                  onChange={(e) => set({ colors: draft.colors.map((x, j) => (j === i ? e.target.value : x)) })}
                  className="size-7 cursor-pointer rounded border-0 bg-transparent"
                />
                <button
                  type="button"
                  aria-label="Rengi kaldır"
                  onClick={() => set({ colors: draft.colors.filter((_, j) => j !== i) })}
                  className="px-1 text-xs text-muted-foreground hover:text-destructive"
                >
                  ×
                </button>
              </span>
            ))}
            {draft.colors.length < 6 ? (
              <button type="button" onClick={() => set({ colors: [...draft.colors, '#f5c400'] })} className={ghostBtn}>
                + Renk
              </button>
            ) : null}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-muted-foreground">Logo (şeffaf PNG veya SVG en iyi sonucu verir)</span>
          <div className="flex items-center gap-3">
            <div className="flex h-16 w-40 items-center justify-center rounded-xl border border-border bg-[repeating-conic-gradient(var(--secondary)_0_25%,transparent_0_50%)] bg-[length:16px_16px] p-2">
              {draft.logoUrl ? (
                <img src={draft.logoUrl || '/placeholder.svg'} alt="Logo önizleme" className="max-h-full max-w-full object-contain" />
              ) : (
                <span className="text-xs text-muted-foreground">Logo yok</span>
              )}
            </div>
            <label className={cn(ghostBtn, 'cursor-pointer')}>
              {uploading === 'logo' ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Upload className="size-3.5" aria-hidden />}
              Logo yükle
              <input
                type="file"
                accept="image/png,image/svg+xml,image/webp,image/jpeg"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) uploadBrandImage(f, 'logo')
                  e.target.value = ''
                }}
              />
            </label>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-muted-foreground">Site maskotu (isteğe bağlı, şeffaf arka planlı tam boy görsel en iyisi)</span>
          <div className="flex items-center gap-3">
            <div className="flex size-24 items-center justify-center rounded-xl border border-border bg-[repeating-conic-gradient(var(--secondary)_0_25%,transparent_0_50%)] bg-[length:16px_16px] p-2">
              {draft.mascotUrl ? (
                <img src={draft.mascotUrl || '/placeholder.svg'} alt="Maskot önizleme" className="max-h-full max-w-full object-contain" />
              ) : (
                <span className="text-xs text-muted-foreground">Maskot yok</span>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <label className={cn(ghostBtn, 'cursor-pointer')}>
                {uploading === 'mascot' ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Upload className="size-3.5" aria-hidden />}
                Maskot yükle
                <input
                  type="file"
                  accept="image/png,image/webp,image/jpeg,image/svg+xml"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) uploadBrandImage(f, 'mascot')
                    e.target.value = ''
                  }}
                />
              </label>
              {draft.mascot ? (
                <button type="button" onClick={() => set({ mascot: '', mascotUrl: '' })} className="text-left text-xs text-muted-foreground hover:text-destructive">
                  Maskotu kaldır
                </button>
              ) : null}
            </div>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Yüklenirse bu markanın görsel, sticker, GIF ve video siparişlerinde maskot karakter olarak kullanılır.
          </p>
        </div>
        <label className={label}>
          Marka notları (yapay zekaya ek tarz bilgisi)
          <textarea
            value={draft.notes}
            onChange={(e) => set({ notes: e.target.value })}
            rows={4}
            placeholder="Örn: koyu lacivert zemin, altın vurgular, aslan maskotu"
            className={cn(input, 'resize-y')}
          />
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={save} disabled={pending || !draft.name.trim()} className={primaryBtn}>
            Kaydet
          </button>
          {draft.id ? (
            <button type="button" onClick={() => setDraft(emptyDraft)} className={ghostBtn}>
              Yeni kit
            </button>
          ) : null}
          {message ? (
            <p role="status" className="text-sm text-muted-foreground">
              {message}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {brands.length === 0 ? <p className="text-sm text-muted-foreground">Henüz marka kiti yok.</p> : null}
        {brands.map((b) => (
          <div key={b.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
            <div className="flex h-12 w-20 shrink-0 items-center justify-center rounded-lg bg-secondary p-1">
              {b.logoUrl ? <img src={b.logoUrl || '/placeholder.svg'} alt={`${b.name} logosu`} className="max-h-full max-w-full object-contain" /> : null}
            </div>
            {b.mascotUrl ? (
              <img src={b.mascotUrl || '/placeholder.svg'} alt={`${b.name} maskotu`} className="size-12 shrink-0 rounded-lg bg-secondary object-contain p-1" />
            ) : null}
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <p className="truncate text-sm font-bold text-foreground">{b.name}</p>
              <p className="truncate text-xs text-muted-foreground">{b.domain || 'domain yok'}</p>
              <div className="flex gap-1">
                {b.colors.map((c) => (
                  <span key={c} className="size-3.5 rounded-full border border-border" style={{ background: c }} />
                ))}
              </div>
            </div>
            <button type="button" onClick={() => setDraft({ ...b })} className={ghostBtn}>
              Düzenle
            </button>
            <button
              type="button"
              aria-label={`${b.name} kitini sil`}
              onClick={() =>
                void askConfirm(`${b.name} silinsin mi?`).then((ok) => ok && start(async () => {
                  await deleteBrandAction(b.id)
                  router.refresh()
                }))
              }
              className={cn(ghostBtn, 'text-destructive')}
            >
              <Trash2 className="size-3.5" aria-hidden />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
