'use client'

import { usd, type StudioAreaTotal, type StudioBrand, type StudioJob, type StudioKind } from '@/lib/studio-types'
import { cn } from '@/lib/utils'

/** '' is the area of jobs made without a brand kit, or whose kit was deleted since. */
export type StudioArea = number | ''

const AREA_PARAM = 'marka'
const NO_BRAND = 'yok'

export function areaOf(job: StudioJob, brands: StudioBrand[]): StudioArea {
  return job.brandId != null && brands.some((b) => b.id === job.brandId) ? job.brandId : ''
}

export function startArea(raw: string | undefined, brands: StudioBrand[]): StudioArea {
  if (raw === NO_BRAND) return ''
  const id = Number(raw)
  return brands.some((b) => b.id === id) ? id : (brands[0]?.id ?? '')
}

/** Every brand's area has its own address, so it can be bookmarked or sent to a teammate. */
export function writeArea(area: StudioArea) {
  const url = new URL(window.location.href)
  url.searchParams.set(AREA_PARAM, area === '' ? NO_BRAND : String(area))
  window.history.replaceState(window.history.state, '', url)
}

export function areaTotal(totals: StudioAreaTotal[], area: StudioArea): StudioAreaTotal {
  const brandId = area === '' ? null : area
  return totals.find((t) => t.brandId === brandId) ?? { brandId, count: 0, cost: 0 }
}

const KIND_GROUPS: { id: string; label: string; kinds: StudioKind[] }[] = [
  { id: 'banner', label: 'Banner', kinds: ['banner'] },
  { id: 'sticker', label: 'Sticker', kinds: ['sticker'] },
  { id: 'gif', label: 'GIF', kinds: ['gif'] },
  { id: 'video', label: 'Video', kinds: ['video'] },
  { id: 'telegram', label: 'Telegram', kinds: ['tgsticker', 'tgicon'] },
]

export const ALL_KINDS = 'all'

export function inKindGroup(job: StudioJob, group: string) {
  const found = KIND_GROUPS.find((g) => g.id === group)
  return !found || found.kinds.includes(job.kind)
}

const chip = 'flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold'
const chipOn = 'border-primary bg-primary/10 text-foreground'
const chipOff = 'border-border bg-card text-muted-foreground hover:text-foreground'

export function AreaBar({
  brands,
  totals,
  area,
  onPick,
}: {
  brands: StudioBrand[]
  totals: StudioAreaTotal[]
  area: StudioArea
  onPick: (area: StudioArea) => void
}) {
  const loose = areaTotal(totals, '').count
  return (
    <section aria-labelledby="studio-areas" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 id="studio-areas" className="text-sm font-semibold text-foreground">
          Marka alanları
        </h2>
        <p className="text-pretty text-xs leading-relaxed text-muted-foreground">
          Her markanın üretimleri kendi alanında durur. Markaya bas, form da liste de o markaya geçer.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {brands.map((b) => (
          <button
            key={b.id}
            type="button"
            aria-pressed={area === b.id}
            onClick={() => onPick(b.id)}
            className={cn(chip, area === b.id ? chipOn : chipOff)}
          >
            {b.logoUrl ? (
              <img src={b.logoUrl || '/placeholder.svg'} alt="" className="size-6 rounded-md bg-secondary object-contain" />
            ) : (
              <span aria-hidden className="flex size-6 items-center justify-center rounded-md bg-secondary text-xs text-foreground">
                {b.name.slice(0, 1).toLocaleUpperCase('tr')}
              </span>
            )}
            <span className="max-w-40 truncate">{b.name}</span>
            <Count value={areaTotal(totals, b.id).count} />
          </button>
        ))}
        {loose > 0 || area === '' ? (
          <button type="button" aria-pressed={area === ''} onClick={() => onPick('')} className={cn(chip, area === '' ? chipOn : chipOff)}>
            Markasız
            <Count value={loose} />
          </button>
        ) : null}
      </div>
    </section>
  )
}

function Count({ value }: { value: number }) {
  return (
    <span className="rounded-md bg-secondary px-1.5 py-0.5 text-xs tabular-nums text-muted-foreground">
      <span className="sr-only">{'üretim sayısı: '}</span>
      {value}
    </span>
  )
}

export function AreaHead({
  name,
  count,
  cost,
  jobs,
  kind,
  onKind,
}: {
  name: string
  count: number
  cost: number
  /** The jobs loaded for this area; the type filter only offers types that are among them. */
  jobs: StudioJob[]
  kind: string
  onKind: (kind: string) => void
}) {
  const groups = KIND_GROUPS.filter((g) => jobs.some((j) => g.kinds.includes(j.kind)))
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-balance text-lg font-semibold text-foreground">{`${name} üretimleri`}</h2>
        <p className="text-xs text-muted-foreground">{count ? `${count} üretim · toplam ~${usd(cost)}` : 'Henüz üretim yok'}</p>
      </div>
      {groups.length > 1 ? (
        <div role="group" aria-label="Üretim türü" className="flex flex-wrap gap-1 rounded-xl border border-border bg-card p-1">
          {[{ id: ALL_KINDS, label: 'Hepsi' }, ...groups].map((g) => (
            <button
              key={g.id}
              type="button"
              aria-pressed={kind === g.id}
              onClick={() => onKind(g.id)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-semibold',
                kind === g.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {g.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
