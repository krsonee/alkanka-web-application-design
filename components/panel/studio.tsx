'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import {
  BookOpen,
  Clapperboard,
  Download,
  Film,
  Globe,
  ImagePlus,
  Link2,
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
  deleteAssetAction,
  deleteBrandAction,
  deleteJobAction,
  extractBrandAction,
  saveBrandAction,
} from '@/app/panel/studio-actions'
import { StudioGuide, StudioHint } from '@/components/panel/studio-guide'
import {
  IMAGE_COST,
  STUDIO_CATEGORIES,
  STUDIO_FORMATS,
  VIDEO_DURATIONS,
  videoCost,
  type StudioAsset,
  type StudioBrand,
  type StudioJob,
  type StudioKind,
} from '@/lib/studio-types'
import { cn } from '@/lib/utils'

type StudioView = 'guide' | 'create' | 'brands' | 'library'
type AnimateOptions = { mode: 'gif' | 'video'; duration: number; audio: boolean; motion: string }

type Props = {
  brands: StudioBrand[]
  assets: StudioAsset[]
  jobs: StudioJob[]
  spend: { total: number; month: number; count: number }
}

const input =
  'rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none'
const card = 'flex flex-col gap-4 rounded-2xl border border-border bg-card p-5'
const label = 'flex flex-col gap-1.5 text-xs font-semibold text-muted-foreground'
const primaryBtn =
  'flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50'
const ghostBtn =
  'flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary disabled:opacity-50'

const usd = (n: number) => `$${n.toFixed(2)}`

export function Studio({ brands, assets, jobs, spend }: Props) {
  const [view, setView] = useState<StudioView>(brands.length ? 'create' : 'guide')
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
        <p className="text-sm text-muted-foreground">
          Bu ay <strong className="text-foreground">{usd(spend.month)}</strong> · Toplam {spend.count} üretim, {usd(spend.total)}
        </p>
      </div>
      {view === 'guide' ? (
        <StudioGuide onNavigate={setView} />
      ) : (
        <StudioHint section={view} onOpenGuide={() => setView('guide')} />
      )}
      {view === 'create' ? (
        <Creator brands={brands} assets={assets} jobs={jobs} />
      ) : view === 'brands' ? (
        <BrandKits brands={brands} />
      ) : view === 'library' ? (
        <Library assets={assets} />
      ) : null}
    </div>
  )
}

function Creator({ brands, assets, jobs }: Omit<Props, 'spend'>) {
  const router = useRouter()
  const [kind, setKind] = useState<StudioKind>('banner')
  const [brandId, setBrandId] = useState<number | ''>(brands[0]?.id ?? '')
  const [formats, setFormats] = useState<string[]>(['1:1'])
  const [category, setCategory] = useState<string>(STUDIO_CATEGORIES[0])
  const [prompt, setPrompt] = useState('')
  const [picked, setPicked] = useState<number[]>([])
  const [running, setRunning] = useState(0)
  const [error, setError] = useState('')
  const [results, setResults] = useState<StudioJob[]>([])
  const [revising, setRevising] = useState<StudioJob | null>(null)
  const [revision, setRevision] = useState('')
  const [animating, setAnimating] = useState<StudioJob | null>(null)
  const [duration, setDuration] = useState<number>(6)
  const [audio, setAudio] = useState(false)
  const [motion, setMotion] = useState('')
  const [videoRuns, setVideoRuns] = useState(0)

  const [mascotOn, setMascotOn] = useState(true)

  const brand = brands.find((b) => b.id === brandId)
  const useMascot = Boolean(brand?.mascot) && mascotOn
  const runs = kind === 'sticker' ? ['1:1'] : formats
  const unitCost = IMAGE_COST + (kind === 'video' ? videoCost(duration, audio) : 0)

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
    const isVideo = options.mode === 'video'
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
    if (prompt.trim().length < 5) return setError('Talimatı yaz (en az 5 karakter).')
    if (!runs.length) return setError('En az bir format seç.')
    const baseKind = kind === 'sticker' ? 'sticker' : 'banner'
    await Promise.all(
      runs.map(async (format) => {
        const banner = await generate({ kind: baseKind, format, category, prompt, brandId, assetIds: picked, useMascot })
        if (banner && (kind === 'gif' || kind === 'video')) {
          await animate(banner, { mode: kind, duration, audio, motion })
        }
      }),
    )
    router.refresh()
  }

  async function runAnimation(mode: 'gif' | 'video') {
    if (!animating) return
    setError('')
    const job = animating
    setAnimating(null)
    await animate(job, { mode, duration, audio, motion })
    router.refresh()
  }

  async function revise() {
    if (!revising || revision.trim().length < 5) return
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
    })
    setRevision('')
    router.refresh()
  }

  const shown = [...results, ...jobs.filter((j) => !results.some((r) => r.id === j.id))]

  return (
    <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
      <div className={cn(card, 'h-fit')}>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ['banner', 'Görsel / Banner', ImagePlus],
              ['sticker', 'Sticker', Sticker],
              ['gif', 'Hareketli GIF', Film],
              ['video', 'Video', Clapperboard],
            ] as const
          ).map(([key, text, Icon]) => (
            <button
              key={key}
              type="button"
              onClick={() => setKind(key)}
              aria-pressed={kind === key}
              className={cn(
                'flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-bold',
                kind === key ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground',
              )}
            >
              <Icon className="size-4" aria-hidden />
              {text}
            </button>
          ))}
        </div>

        <label className={label}>
          Marka (logo ve renkler bu kitten alınır)
          <select value={brandId} onChange={(e) => setBrandId(e.target.value ? Number(e.target.value) : '')} className={input}>
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

        {kind !== 'sticker' ? (
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
            <label className={label}>
              Kategori
              <select value={category} onChange={(e) => setCategory(e.target.value)} className={input}>
                {STUDIO_CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
          </>
        ) : null}

        <label className={label}>
          Talimat
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={5}
            maxLength={1500}
            placeholder={
              kind === 'sticker'
                ? 'Örn: Zeus karakteri göz kırpıyor, üstünde "Kod Geliyor!" yazısı'
                : 'Örn: Büyük başlık "%500 FREESPIN BONUSU", altında "Hemen Dene" butonu, altın ve mor tonlar, erkek karakter'
            }
            className={cn(input, 'resize-y leading-relaxed')}
          />
        </label>

        {kind === 'gif' ? (
          <p className="rounded-xl bg-secondary p-3 text-xs leading-relaxed text-muted-foreground">
            Önce banner üretilir, sonra üstünden parlama geçen ve hafif nefes alan döngülü bir GIF yapılır. GIF adımı ücretsizdir, logo ve yazılar hiç bozulmaz.
          </p>
        ) : null}
        {kind === 'video' ? (
          <VideoOptions duration={duration} setDuration={setDuration} audio={audio} setAudio={setAudio} motion={motion} setMotion={setMotion} />
        ) : null}

        {assets.length ? (
          <details className="rounded-xl border border-border p-3">
            <summary className="cursor-pointer text-xs font-semibold text-muted-foreground">
              Referans görsel seç ({picked.length}/3)
            </summary>
            <div className="mt-3 grid max-h-56 grid-cols-4 gap-2 overflow-y-auto">
              {assets.map((a) => {
                const on = picked.includes(a.id)
                return (
                  <button
                    key={a.id}
                    type="button"
                    aria-pressed={on}
                    title={`${a.provider} ${a.game}`}
                    onClick={() =>
                      setPicked((p) => (on ? p.filter((x) => x !== a.id) : p.length < 3 ? [...p, a.id] : p))
                    }
                    className={cn('overflow-hidden rounded-lg border-2', on ? 'border-primary' : 'border-transparent')}
                  >
                    <img src={a.url || '/placeholder.svg'} alt={`${a.provider} ${a.game}`} className="aspect-square w-full object-cover" />
                  </button>
                )
              })}
            </div>
          </details>
        ) : null}

        <button type="button" onClick={start} disabled={running + videoRuns > 0} className={primaryBtn}>
          {running + videoRuns > 0 ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Sparkles className="size-4" aria-hidden />}
          {running + videoRuns > 0 ? `Üretiliyor (${running + videoRuns})...` : `Üret · ~${usd(unitCost * runs.length)}`}
        </button>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-4">
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
                placeholder='Örn: "%100" yerine "%500" yazsın, karakter erkek olsun'
                className={cn(input, 'flex-1 resize-y')}
              />
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={revise} disabled={revision.trim().length < 5} className={primaryBtn}>
                Revizeyi üret
              </button>
              <button type="button" onClick={() => setRevising(null)} className={ghostBtn}>
                Vazgeç
              </button>
            </div>
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
                <VideoOptions duration={duration} setDuration={setDuration} audio={audio} setAudio={setAudio} motion={motion} setMotion={setMotion} />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => runAnimation('gif')} className={ghostBtn}>
                <Film className="size-3.5" aria-hidden /> GIF yap · ücretsiz
              </button>
              <button type="button" onClick={() => runAnimation('video')} className={primaryBtn}>
                <Clapperboard className="size-4" aria-hidden /> Video üret · ~{usd(videoCost(duration, audio))}
              </button>
              <button type="button" onClick={() => setAnimating(null)} className={ghostBtn}>
                Vazgeç
              </button>
            </div>
          </div>
        ) : null}

        {shown.length === 0 && running + videoRuns === 0 ? (
          <div className="flex min-h-80 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border p-8 text-center">
            <Sparkles className="size-8 text-primary" aria-hidden />
            <p className="font-semibold text-foreground">Henüz üretim yok</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Soldan markayı seç, talimatı yaz ve üret. Logo yapay zekaya çizdirilmez, kitteki orijinal logo birebir basılır.
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
              <span className="text-xs text-muted-foreground">Video üretiliyor, 1-3 dk sürer. Sayfadan ayrılma.</span>
            </div>
          ))}
          {shown.map((job) => (
            <JobCard key={job.id} job={job} onRevise={() => setRevising(job)} onAnimate={() => setAnimating(job)} />
          ))}
        </div>
      </div>
    </div>
  )
}

const KIND_LABEL: Record<StudioKind, string> = { banner: 'Banner', sticker: 'Sticker', gif: 'GIF', video: 'Video' }

function VideoOptions({
  duration,
  setDuration,
  audio,
  setAudio,
  motion,
  setMotion,
}: {
  duration: number
  setDuration: (n: number) => void
  audio: boolean
  setAudio: (b: boolean) => void
  motion: string
  setMotion: (s: string) => void
}) {
  return (
    <div className="flex flex-col gap-3">
      <label className={label}>
        Hareket talimatı (opsiyonel)
        <textarea
          value={motion}
          onChange={(e) => setMotion(e.target.value)}
          rows={2}
          maxLength={600}
          placeholder="Örn: karakter kılıcını kaldırıyor, arkada altın paralar yağıyor, kamera yavaşça yaklaşıyor"
          className={cn(input, 'resize-y')}
        />
      </label>
      <div className="flex flex-wrap items-end gap-4">
        <fieldset className={label}>
          <legend className="mb-1.5">Video süresi</legend>
          <div className="flex gap-1">
            {VIDEO_DURATIONS.map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={duration === d}
                onClick={() => setDuration(d)}
                className={cn(
                  'rounded-lg border px-3 py-1.5 text-xs font-bold',
                  duration === d ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground',
                )}
              >
                {d} sn
              </button>
            ))}
          </div>
        </fieldset>
        <label className="flex items-center gap-2 pb-1.5 text-xs font-semibold text-muted-foreground">
          <input type="checkbox" checked={audio} onChange={(e) => setAudio(e.target.checked)} className="size-4 accent-primary" />
          Ses / müzik ekle
        </label>
      </div>
    </div>
  )
}

function JobCard({ job, onRevise, onAnimate }: { job: StudioJob; onRevise: () => void; onAnimate: () => void }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  return (
    <figure className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card">
      <div className={cn('flex items-center justify-center', job.kind === 'sticker' ? 'bg-[repeating-conic-gradient(var(--secondary)_0_25%,transparent_0_50%)] bg-[length:20px_20px] p-4' : 'bg-secondary')}>
        {job.kind === 'video' ? (
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
            <Download className="size-3.5" aria-hidden /> İndir
          </a>
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
          <button
            type="button"
            disabled={pending}
            aria-label="Sil"
            onClick={() =>
              start(async () => {
                await deleteJobAction(job.id)
                router.refresh()
              })
            }
            className={cn(ghostBtn, 'ml-auto text-destructive')}
          >
            <Trash2 className="size-3.5" aria-hidden />
          </button>
        </div>
      </figcaption>
    </figure>
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
            <input value={draft.name} onChange={(e) => set({ name: e.target.value })} maxLength={60} className={input} />
          </label>
          <label className={label}>
            Font
            <input value={draft.font} onChange={(e) => set({ font: e.target.value })} maxLength={60} placeholder="Montserrat" className={input} />
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
            rows={2}
            maxLength={600}
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
                confirm(`${b.name} silinsin mi?`) &&
                start(async () => {
                  await deleteBrandAction(b.id)
                  router.refresh()
                })
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

function Library({ assets }: { assets: StudioAsset[] }) {
  const router = useRouter()
  const [provider, setProvider] = useState('')
  const [game, setGame] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [, start] = useTransition()
  const providers = [...new Set(assets.map((a) => a.provider))]

  const [links, setLinks] = useState('')

  async function upload(files: FileList | null, urls = '') {
    if (!provider.trim()) return setMessage('Önce sağlayıcı adını yaz.')
    setBusy(true)
    setMessage('')
    const form = new FormData()
    form.set('provider', provider)
    form.set('game', game)
    if (urls) form.set('urls', urls)
    for (const f of Array.from(files ?? [])) form.append('file', f)
    const res = await fetch('/api/studio/upload', { method: 'POST', body: form })
    const data = await res.json().catch(() => ({ error: 'Yükleme zaman aşımına uğradı.' }))
    setBusy(false)
    if (res.ok) {
      setMessage(`${data.pathnames.length} görsel eklendi.${data.failed?.length ? ` Eklenemeyen: ${data.failed.length}` : ''}`)
      setLinks('')
      router.refresh()
    } else setMessage(data.error)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className={card}>
        <div className="flex items-center gap-2">
          <ImagePlus className="size-5 text-primary" aria-hidden />
          <h2 className="font-display text-xl font-bold uppercase text-foreground">Görsel ekle</h2>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Sağlayıcı portallarından aldığın oyun karakterleri, logolar ve arka planlar. Üretimde referans olarak seçilir.
        </p>
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <label className={label}>
            Sağlayıcı
            <input value={provider} onChange={(e) => setProvider(e.target.value)} list="studio-providers" placeholder="Pragmatic Play" className={input} />
            <datalist id="studio-providers">
              {providers.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </label>
          <label className={label}>
            Oyun (opsiyonel)
            <input value={game} onChange={(e) => setGame(e.target.value)} placeholder="Gates of Olympus" className={input} />
          </label>
          <label className={cn(primaryBtn, 'cursor-pointer self-end')}>
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Upload className="size-4" aria-hidden />}
            Dosya seç (20&apos;ye kadar)
            <input
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
              className="sr-only"
              onChange={(e) => e.target.files?.length && upload(e.target.files)}
            />
          </label>
        </div>
        <label className={label}>
          <span className="flex items-center gap-1.5">
            <Link2 className="size-3.5" aria-hidden /> Veya görsel linklerini yapıştır (her satıra bir link, en fazla 30)
          </span>
          <textarea
            value={links}
            onChange={(e) => setLinks(e.target.value)}
            rows={3}
            placeholder="https://.../gates-of-olympus-character.png"
            className={cn(input, 'resize-y font-mono text-xs')}
          />
        </label>
        <button
          type="button"
          disabled={busy || !links.trim()}
          onClick={() => upload(null, links)}
          className={cn(ghostBtn, 'self-start')}
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Link2 className="size-3.5" aria-hidden />}
          Linklerden ekle
        </button>
        {message ? (
          <p role="status" className="text-sm text-muted-foreground">
            {message}
          </p>
        ) : null}
      </div>

      {providers.map((p) => (
        <section key={p} className="flex flex-col gap-3">
          <h3 className="font-display text-lg font-bold uppercase text-foreground">{p}</h3>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-8">
            {assets
              .filter((a) => a.provider === p)
              .map((a) => (
                <div key={a.id} className="group relative overflow-hidden rounded-xl border border-border bg-secondary">
                  <img src={a.url || '/placeholder.svg'} alt={`${a.provider} ${a.game}`} loading="lazy" className="aspect-square w-full object-cover" />
                  {a.game ? <p className="truncate px-2 py-1 text-xs text-muted-foreground">{a.game}</p> : null}
                  <button
                    type="button"
                    aria-label="Görseli sil"
                    onClick={() =>
                      start(async () => {
                        await deleteAssetAction(a.id)
                        router.refresh()
                      })
                    }
                    className="absolute right-1 top-1 rounded-md bg-card/90 p-1 text-destructive opacity-0 group-hover:opacity-100 focus:opacity-100"
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                  </button>
                </div>
              ))}
          </div>
        </section>
      ))}
    </div>
  )
}
