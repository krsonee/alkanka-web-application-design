'use client'

import { ArrowDown, ArrowUp, Download, Film, Loader2, Plus, Shuffle, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useMemo, useRef, useState, type ReactNode } from 'react'
import { notify } from '@/components/panel/confirm-dialog'
import type { StudioArea } from '@/components/panel/studio-areas'
import { MotionPreview, useMotionKit } from '@/components/panel/studio-motion-preview'
import { MotionStyles } from '@/components/panel/studio-motion-styles'
import { prepareReel, reelSeconds } from '@/lib/motion/frame'
import {
  brandColors,
  cleanScenes,
  DEFAULT_LOOK,
  drawnSize,
  EFFECTS,
  MAX_SCENES,
  MOTION_FONTS,
  MOTION_FPS,
  MOTION_SIZES,
  MOTION_WEIGHTS,
  PACES,
  parseSize,
  REVEALS,
  TEXTURES,
  TRANSITIONS,
  type MotionColors,
  type MotionLook,
  type MotionSpec,
  type MotionWeight,
} from '@/lib/motion/spec'
import type { MotionStyle } from '@/lib/motion/styles'
import type { StudioAsset, StudioBrand, StudioJob } from '@/lib/studio-types'
import { cn } from '@/lib/utils'

type Props = {
  brands: StudioBrand[]
  assets: StudioAsset[]
  styles: MotionStyle[]
  /** The brand area open in Studio; the film is made for it and its results land in that area. */
  area: StudioArea
  onArea: (area: StudioArea) => void
}

type Line = { id: number; text: string; logo: boolean; figure: boolean; effect: boolean }
type Made = { job: StudioJob; about: { width: number; height: number; bytes: number; seconds: number } }

const input = 'rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none'
const card = 'flex flex-col gap-4 rounded-2xl border border-border bg-card p-5'
const field = 'flex flex-col gap-1.5 text-xs font-semibold text-muted-foreground'
const heading = 'font-display text-lg font-bold uppercase text-foreground'
const primaryBtn =
  'flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50'
const ghostBtn =
  'flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary disabled:opacity-50'
const chip = (on: boolean) =>
  cn(
    'rounded-lg border px-3 py-1.5 text-xs font-semibold',
    on ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-foreground hover:bg-secondary',
  )

const START: Line[] = [
  { id: 1, text: '*%100* HOŞ GELDİN BONUSU', logo: true, figure: false, effect: true },
  { id: 2, text: 'HER GÜN *KAYIP* BONUSU', logo: true, figure: false, effect: false },
  { id: 3, text: 'HEMEN *ÜYE OL*', logo: true, figure: false, effect: true },
]

const SIZE_GROUPS = [...new Set(MOTION_SIZES.map((size) => size.group))]
const COLOR_FIELDS: { key: keyof MotionColors; label: string }[] = [
  { key: 'deep', label: 'Zemin, koyu ton' },
  { key: 'mid', label: 'Zemin, açık ton' },
  { key: 'text', label: 'Yazı' },
  { key: 'accent', label: 'Vurgu ve patlama' },
]

const megabytes = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`
const secondsText = (seconds: number) => `${seconds.toFixed(1).replace('.', ',')} sn`

function Choice<T extends string>({
  legend,
  options,
  value,
  onChange,
}: {
  legend: string
  options: readonly { id: T; label: string; hint?: string }[]
  value: T
  onChange: (value: T) => void
}) {
  const hint = options.find((option) => option.id === value)?.hint
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-xs font-semibold text-muted-foreground">{legend}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => (
          <button key={option.id} type="button" aria-pressed={value === option.id} onClick={() => onChange(option.id)} className={chip(value === option.id)}>
            {option.label}
          </button>
        ))}
      </div>
      {hint ? <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p> : null}
    </fieldset>
  )
}

function Toggle({ on, disabled, onChange, children }: { on: boolean; disabled?: boolean; onChange: (on: boolean) => void; children: ReactNode }) {
  return (
    <label className={cn('flex items-center gap-1.5 text-xs font-semibold', disabled ? 'text-muted-foreground/60' : 'text-foreground')}>
      <input type="checkbox" checked={on && !disabled} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="size-4 accent-[var(--primary)]" />
      {children}
    </label>
  )
}

export function StudioMotion({ brands, assets, styles: savedStyles, area, onArea }: Props) {
  const router = useRouter()
  const brand = brands.find((b) => b.id === area) ?? null
  const [sizes, setSizes] = useState<string[]>(['728x90'])
  const [picked, setShown] = useState('728x90')
  // A size taken out of the selection can no longer be the one on show.
  const shown = sizes.includes(picked) ? picked : sizes[0]
  const [extra, setExtra] = useState<string[]>([])
  const [custom, setCustom] = useState('')
  const [lines, setLines] = useState<Line[]>(START)
  const nextId = useRef(START.length + 1)
  const [look, setLook] = useState<MotionLook>(DEFAULT_LOOK)
  const [ownColors, setOwnColors] = useState<MotionColors | null>(null)
  const [figureChoice, setFigureChoice] = useState('')
  const [quality, setQuality] = useState<MotionWeight>('sd')
  const [seed, setSeed] = useState(4127)
  const [styles, setStyles] = useState(savedStyles)
  const [activeStyle, setActiveStyle] = useState<number | null>(null)
  const [busy, setBusy] = useState<{ done: number; total: number; size: string } | null>(null)
  const [made, setMade] = useState<Made[]>([])

  const characters = useMemo(() => assets.filter((asset) => asset.role === 'character').slice(0, 80), [assets])
  // The mascot belongs to a brand kit: with another brand open the choice no longer points at anything.
  const figure = figureChoice === 'mascot' && !brand?.mascot ? '' : figureChoice
  const colors = useMemo(() => ownColors ?? brandColors(brand?.colors ?? []), [ownColors, brand])
  const scenes = useMemo(() => cleanScenes(lines.map((line) => ({ ...line, figure: line.figure && Boolean(figure) }))), [lines, figure])
  const { kit, failed } = useMotionKit(look.font, area, figure)

  const brandName = brand?.name ?? ''
  const spec = useMemo<MotionSpec>(() => {
    const asked = parseSize(shown) ?? { width: 728, height: 90 }
    return { ...drawnSize(asked.width, asked.height), fps: MOTION_FPS, seed, brand: brandName, look, colors, scenes }
  }, [shown, seed, brandName, look, colors, scenes])
  const reel = useMemo(() => (kit ? prepareReel(spec, kit) : null), [spec, kit])
  const fits = reel ? reel.segments.length > 0 : true

  function toggleSize(size: string) {
    if (!sizes.includes(size)) setShown(size)
    setSizes((current) => (!current.includes(size) ? [...current, size] : current.length === 1 ? current : current.filter((s) => s !== size)))
  }

  function addCustom() {
    const parsed = parseSize(custom)
    if (!parsed) {
      notify(false, 'Boyutu "970x250" gibi yaz. Her kenar 40 ile 2400 piksel arasında olur.')
      return
    }
    const size = `${parsed.width}x${parsed.height}`
    if (!MOTION_SIZES.some((s) => s.id === size)) setExtra((current) => (current.includes(size) ? current : [...current, size]))
    setSizes((current) => (current.includes(size) ? current : [...current, size]))
    setShown(size)
    setCustom('')
  }

  const patchLine = (id: number, patch: Partial<Line>) => setLines((list) => list.map((line) => (line.id === id ? { ...line, ...patch } : line)))
  function moveLine(index: number, by: number) {
    setLines((list) => {
      const to = index + by
      if (to < 0 || to >= list.length) return list
      const next = [...list]
      ;[next[index], next[to]] = [next[to], next[index]]
      return next
    })
  }

  function changeLook(patch: Partial<MotionLook>) {
    setLook((current) => ({ ...current, ...patch }))
    setActiveStyle(null)
  }

  function applyStyle(style: MotionStyle, withColors: boolean) {
    setLook(style.look)
    setActiveStyle(style.id)
    if (withColors) setOwnColors(style.colors)
  }

  async function produce() {
    if (!scenes.length) {
      notify(false, 'En az bir mesaj yaz.')
      return
    }
    const list = [...sizes]
    for (let i = 0; i < list.length; i++) {
      setBusy({ done: i, total: list.length, size: list[i] })
      try {
        const res = await fetch('/api/studio/motion', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ brandId: area, figure, size: list[i], scenes, look, colors, quality, seed }),
        })
        const data = (await res.json().catch(() => null)) as { job?: StudioJob; about?: Made['about']; error?: string } | null
        if (!res.ok || !data?.job || !data.about) {
          notify(false, `${list[i]}: ${data?.error ?? 'GIF oluşturulamadı.'}`)
          if (res.status === 401) break
          continue
        }
        const done: Made = { job: data.job, about: data.about }
        setMade((earlier) => [done, ...earlier])
      } catch {
        notify(false, `${list[i]}: bağlantı koptu.`)
      }
    }
    setBusy(null)
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-6">
      <section className={card} aria-labelledby="motion-preview">
        <div className="flex flex-col gap-1">
          <h2 id="motion-preview" className={heading}>
            Hareketli banner
          </h2>
          <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
            Bu banner&apos;ı model çizmez. Yazdığın mesajlar gerçek yazı tipiyle, logo kendi dosyasıyla kurulur; bu yüzden harfler bozulmaz, logo değişmez ve aynı
            kurgu istediğin her boyutta çıkar. Üretim ücretsizdir.
          </p>
        </div>
        {failed ? (
          <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-foreground">
            Önizleme yüklenemedi. Sayfayı yenile; oturumun kapanmış olabilir.
          </p>
        ) : (
          <MotionPreview reel={fits ? reel : null} label={`${shown} boyutunda banner önizlemesi`} />
        )}
        {reel && !fits ? (
          <p role="status" className="text-sm font-semibold text-destructive">
            Bu boyuta sığan bir kurgu çıkmadı. Mesajları kısalt.
          </p>
        ) : null}
        <div className="flex flex-wrap items-end gap-3">
          <label className={field}>
            Önizlenen boyut
            <select value={shown} onChange={(e) => setShown(e.target.value)} className={cn(input, 'py-2')}>
              {sizes.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={() => setSeed((s) => (s * 7 + 131) % 100000)} className={cn(ghostBtn, 'py-2.5')} title="Aynı mesajlarla coinlerin, patlamanın ve dokunun yerleşimini değiştirir">
            <Shuffle className="size-3.5" aria-hidden /> Başka düzen
          </button>
          {reel && fits ? (
            <p className="pb-2 text-xs text-muted-foreground" role="status">
              {reel.spec.width}x{reel.spec.height} çizilir · {secondsText(reelSeconds(reel))} · {scenes.length} mesaj
            </p>
          ) : null}
        </div>
      </section>

      <section className={card} aria-labelledby="motion-copy">
        <h2 id="motion-copy" className={heading}>
          Mesajlar
        </h2>
        <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
          Her satır ekranda tek başına görünen bir mesajdır; sırayla döner. Vurgulu çıkmasını istediğin kelimeyi iki yıldız arasına al: <span className="font-mono text-foreground">*%100* BONUS</span>
        </p>
        <ol className="flex flex-col gap-3">
          {lines.map((line, index) => (
            <li key={line.id} className="flex flex-col gap-2 rounded-xl border border-border bg-background p-3">
              <div className="flex items-center gap-2">
                <span className="w-5 shrink-0 text-center text-xs font-bold text-muted-foreground" aria-hidden>
                  {index + 1}
                </span>
                <input
                  value={line.text}
                  onChange={(e) => patchLine(line.id, { text: e.target.value })}
                  aria-label={`${index + 1}. mesaj`}
                  placeholder="Örn: *500 TL* DENEME BONUSU"
                  className={cn(input, 'min-w-0 flex-1')}
                />
                <button type="button" onClick={() => moveLine(index, -1)} disabled={index === 0} className={ghostBtn} aria-label={`${index + 1}. mesajı yukarı taşı`}>
                  <ArrowUp className="size-3.5" aria-hidden />
                </button>
                <button type="button" onClick={() => moveLine(index, 1)} disabled={index === lines.length - 1} className={ghostBtn} aria-label={`${index + 1}. mesajı aşağı taşı`}>
                  <ArrowDown className="size-3.5" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => setLines((list) => list.filter((l) => l.id !== line.id))}
                  disabled={lines.length === 1}
                  className={ghostBtn}
                  aria-label={`${index + 1}. mesajı sil`}
                >
                  <Trash2 className="size-3.5" aria-hidden />
                </button>
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-2 pl-7">
                <Toggle on={line.logo} disabled={!brand?.logo} onChange={(logo) => patchLine(line.id, { logo })}>
                  Logo görünsün
                </Toggle>
                <Toggle on={line.figure} disabled={!figure} onChange={(on) => patchLine(line.id, { figure: on })}>
                  Karakter görünsün
                </Toggle>
                <Toggle on={line.effect} disabled={look.effect === 'none'} onChange={(effect) => patchLine(line.id, { effect })}>
                  Efekt oynasın
                </Toggle>
              </div>
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={lines.length >= MAX_SCENES}
            onClick={() => setLines((list) => [...list, { id: nextId.current++, text: '', logo: true, figure: false, effect: false }])}
            className={cn(ghostBtn, 'py-2')}
          >
            <Plus className="size-3.5" aria-hidden /> Mesaj ekle
          </button>
          <p className="text-xs text-muted-foreground">En fazla {MAX_SCENES} mesaj. Kısa mesaj büyük ve okunaklı çıkar.</p>
        </div>
      </section>

      <section className={card} aria-labelledby="motion-brand">
        <h2 id="motion-brand" className={heading}>
          Marka, karakter ve boyutlar
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <label className={field}>
            Marka kiti
            <select value={area === '' ? '' : String(area)} onChange={(e) => onArea(e.target.value === '' ? '' : Number(e.target.value))} className={input}>
              <option value="">Markasız (logo yok)</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            {brand && !brand.logo ? <span className="font-normal">Bu kitte logo yok; Marka kitleri sekmesinden ekleyebilirsin.</span> : null}
          </label>
          <label className={field}>
            Karakter (isteğe bağlı)
            <select value={figure} onChange={(e) => setFigureChoice(e.target.value)} className={input}>
              <option value="">Karakter yok</option>
              {brand?.mascot ? <option value="mascot">{brand.name} maskotu</option> : null}
              {characters.map((asset) => (
                <option key={asset.id} value={String(asset.id)}>
                  {[asset.game, asset.provider].filter(Boolean).join(' · ') || 'Kütüphane görseli'} (#{asset.id})
                </option>
              ))}
            </select>
            <span className="font-normal">Zemini saydam bir görsel seç. Hangi mesajda görüneceğini mesajın altından işaretle.</span>
          </label>
        </div>
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold text-muted-foreground">Boyutlar: işaretlediğin her boyut için ayrı GIF çıkar ({sizes.length} seçili)</p>
          {SIZE_GROUPS.map((group) => (
            <div key={group} className="flex flex-wrap items-center gap-1.5">
              <span className="w-24 shrink-0 text-xs text-muted-foreground">{group}</span>
              {MOTION_SIZES.filter((size) => size.group === group).map((size) => (
                <button key={size.id} type="button" aria-pressed={sizes.includes(size.id)} onClick={() => toggleSize(size.id)} className={chip(sizes.includes(size.id))}>
                  {size.id}
                </button>
              ))}
            </div>
          ))}
          {extra.length ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="w-24 shrink-0 text-xs text-muted-foreground">Özel</span>
              {extra.map((size) => (
                <button key={size} type="button" aria-pressed={sizes.includes(size)} onClick={() => toggleSize(size)} className={chip(sizes.includes(size))}>
                  {size}
                </button>
              ))}
            </div>
          ) : null}
          <div className="flex flex-wrap items-end gap-2">
            <label className={field}>
              Başka bir boyut
              <input
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter' || e.nativeEvent.isComposing || e.keyCode === 229) return
                  e.preventDefault()
                  addCustom()
                }}
                placeholder="970x250"
                className={cn(input, 'w-36')}
              />
            </label>
            <button type="button" onClick={addCustom} className={cn(ghostBtn, 'py-2.5')}>
              Ekle
            </button>
          </div>
        </div>
      </section>

      <section className={card} aria-labelledby="motion-examples">
        <h2 id="motion-examples" className={heading}>
          Örnek tarzlar
        </h2>
        <MotionStyles styles={styles} onStyles={setStyles} active={activeStyle} onApply={applyStyle} />
      </section>

      <section className={card} aria-labelledby="motion-look">
        <h2 id="motion-look" className={heading}>
          Tarz ayarları
        </h2>
        <div className="grid gap-5 md:grid-cols-2">
          <Choice legend="Mesajlar arası geçiş" options={TRANSITIONS} value={look.transition} onChange={(transition) => changeLook({ transition })} />
          <Choice legend="Yazının gelişi" options={REVEALS} value={look.reveal} onChange={(reveal) => changeLook({ reveal })} />
          <Choice
            legend="Hız"
            options={PACES.map((pace) => ({ id: pace.id, label: pace.label, hint: `Her mesaj yaklaşık ${String(pace.beat).replace('.', ',')} saniye ekranda kalır` }))}
            value={look.pace}
            onChange={(pace) => changeLook({ pace })}
          />
          <Choice legend="Zemin" options={TEXTURES} value={look.texture} onChange={(texture) => changeLook({ texture })} />
          <Choice legend="Efekt" options={EFFECTS} value={look.effect} onChange={(effect) => changeLook({ effect })} />
          <Choice legend="Yazı tipi" options={MOTION_FONTS} value={look.font} onChange={(font) => changeLook({ font })} />
        </div>
        <Toggle on={look.logoIntro} disabled={!brand?.logo} onChange={(logoIntro) => changeLook({ logoIntro })}>
          Banner sadece logoyla açılsın, mesajlar ondan sonra gelsin
        </Toggle>
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold text-muted-foreground">Renkler {ownColors ? '(elle seçildi)' : brand ? `(${brand.name} kitinden)` : '(varsayılan)'}</p>
          <div className="flex flex-wrap items-end gap-4">
            {COLOR_FIELDS.map(({ key, label }) => (
              <label key={key} className={field}>
                {label}
                <input type="color" value={colors[key]} onChange={(e) => setOwnColors({ ...colors, [key]: e.target.value })} className="h-10 w-20 cursor-pointer rounded-lg border border-input bg-background p-1" />
              </label>
            ))}
            {ownColors ? (
              <button type="button" onClick={() => setOwnColors(null)} className={cn(ghostBtn, 'py-2.5')}>
                {brand ? 'Marka renklerine dön' : 'Varsayılan renklere dön'}
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <section className={card} aria-labelledby="motion-make">
        <h2 id="motion-make" className={heading}>
          Üret
        </h2>
        <Choice
          legend="Dosya ağırlığı"
          options={MOTION_WEIGHTS.map((weight) => ({
            id: weight.id,
            label: `${weight.label} (${weight.hint})`,
            hint: 'Sınırı aşan banner önce daha az kareyle, sonra daha küçük çizilerek sınıra indirilir; renk sayısı düşürülmez.',
          }))}
          value={quality}
          onChange={setQuality}
        />
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => void produce()} disabled={Boolean(busy) || !scenes.length || !fits} className={primaryBtn}>
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Film className="size-4" aria-hidden />}
            {busy ? `${busy.size} hazırlanıyor (${busy.done + 1} / ${busy.total})` : sizes.length > 1 ? `${sizes.length} boyutta GIF üret` : 'GIF üret'}
          </button>
          <p className="text-xs leading-relaxed text-muted-foreground" role="status">
            {busy ? 'Sekmeyi kapatma; her boyut 10 saniye ile 1 dakika arasında sürer.' : 'Çıkan GIF\'ler seçili markanın alanına da kaydedilir.'}
          </p>
        </div>
        {made.length ? (
          <ul className="grid gap-4 md:grid-cols-2">
            {made.map(({ job, about }) => (
              <li key={job.id} className="flex flex-col overflow-hidden rounded-xl border border-border bg-background">
                <div className="flex items-center justify-center bg-secondary p-3">
                  <img src={job.url || '/placeholder.svg'} alt={`${job.format} boyutunda üretilen banner`} className="max-h-64 max-w-full object-contain" />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 p-3">
                  <p className="text-xs font-semibold text-foreground">
                    {job.format} · {secondsText(about.seconds)} · {megabytes(about.bytes)}
                    {`${about.width}x${about.height}` === job.format ? '' : ` · ${about.width}x${about.height} çizildi`}
                  </p>
                  <a href={`${job.url}?download`} className={ghostBtn}>
                    <Download className="size-3.5" aria-hidden /> İndir
                  </a>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  )
}
