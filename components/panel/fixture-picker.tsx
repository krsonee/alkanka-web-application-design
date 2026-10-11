'use client'

import { useMemo, useState, useTransition } from 'react'
import { CalendarDays, Check, RefreshCw } from 'lucide-react'
import { autoSettleMatches, loadFixtures, publishFixtures } from '@/app/panel/community-actions'
import type { Fixture } from '@/lib/kankatv'
import { StatusLine, useAction } from '@/components/alkanka/community/use-action'
import { cn } from '@/lib/utils'

const istanbulDay = (offset = 0) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(Date.now() + offset * 86_400_000)

const clock = (iso: string) => new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' })

function Crest({ src, name }: { src: string; name: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" width={24} height={24} loading="lazy" className="size-6 shrink-0 object-contain" title={name} />
  )
}

export function FixturePicker() {
  const [day, setDay] = useState(istanbulDay())
  const [fixtures, setFixtures] = useState<Fixture[] | null>(null)
  const [published, setPublished] = useState<Set<number>>(new Set())
  const [picked, setPicked] = useState<Set<number>>(new Set())
  const [error, setError] = useState('')
  const [loading, startLoading] = useTransition()
  const publish = useAction()
  const settle = useAction()

  const load = (d: string) => {
    setDay(d)
    setError('')
    startLoading(async () => {
      const r = await loadFixtures(d)
      if (!r.ok) {
        setError(r.error)
        setFixtures([])
        return
      }
      setFixtures(r.fixtures)
      setPublished(new Set(r.published))
      setPicked(new Set())
    })
  }

  const groups = useMemo(() => {
    const map = new Map<string, Fixture[]>()
    for (const f of fixtures ?? []) map.set(f.league, [...(map.get(f.league) ?? []), f])
    return [...map.entries()]
  }, [fixtures])

  const toggle = (id: number) =>
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const selectable = (f: Fixture) => !f.started && !published.has(f.extId)
  const chosen = (fixtures ?? []).filter((f) => picked.has(f.extId))

  return (
    <section aria-labelledby="fikstur" className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h3 id="fikstur" className="flex items-center gap-2 font-display text-base font-bold text-foreground">
            <CalendarDays className="size-4 text-primary" aria-hidden /> Takvimden maç seç
          </h3>
          <p className="text-xs text-muted-foreground">Büyük ligler, Avrupa kupaları ve milli maçlar. Seç, tek tıkla yayınla; logolar otomatik gelir.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {[0, 1, 2].map((o) => {
            const d = istanbulDay(o)
            return (
              <button key={o} type="button" onClick={() => load(d)} className={cn('h-9 rounded-lg px-3 text-xs font-bold', day === d && fixtures ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground')}>
                {o === 0 ? 'Bugün' : o === 1 ? 'Yarın' : 'Ertesi gün'}
              </button>
            )
          })}
          <label className="sr-only" htmlFor="fx-day">Tarih</label>
          <input id="fx-day" type="date" value={day} min={istanbulDay()} onChange={(e) => e.target.value && load(e.target.value)} className="h-9 rounded-lg border border-border bg-background px-2 text-sm text-foreground" />
        </div>
      </div>

      {loading ? (
        <p className="rounded-lg bg-background p-6 text-center text-sm text-muted-foreground">Fikstür yükleniyor...</p>
      ) : error ? (
        <p role="alert" className="text-sm text-destructive">{error}</p>
      ) : fixtures === null ? (
        <button type="button" onClick={() => load(day)} className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground hover:text-foreground">
          Seçilen günün maçlarını getir
        </button>
      ) : fixtures.length === 0 ? (
        <p className="rounded-lg bg-background p-6 text-center text-sm text-muted-foreground">Bu tarihte kapsamdaki liglerde maç yok.</p>
      ) : (
        <div className="flex max-h-[28rem] flex-col gap-3 overflow-y-auto pr-1">
          {groups.map(([league, list]) => (
            <fieldset key={league} className="flex flex-col gap-1">
              <legend className="mb-1 text-[11px] font-bold uppercase tracking-wider text-primary">{league}</legend>
              {list.map((f) => {
                const live = published.has(f.extId)
                const can = selectable(f)
                return (
                  <label key={f.extId} className={cn('flex items-center gap-3 rounded-lg border px-3 py-2 text-sm', picked.has(f.extId) ? 'border-primary bg-primary/10' : 'border-border bg-background', can ? 'cursor-pointer' : 'opacity-60')}>
                    <input type="checkbox" disabled={!can} checked={picked.has(f.extId)} onChange={() => toggle(f.extId)} className="size-4 accent-primary" />
                    <span className="w-11 shrink-0 font-mono text-xs tabular-nums text-muted-foreground">{clock(f.kickoff)}</span>
                    <span className="flex min-w-0 flex-1 items-center justify-end gap-2 text-right">
                      <span className="truncate font-semibold text-foreground">{f.home}</span>
                      <Crest src={f.homeLogo} name={f.home} />
                    </span>
                    <span className="text-xs text-muted-foreground">-</span>
                    <span className="flex min-w-0 flex-1 items-center gap-2">
                      <Crest src={f.awayLogo} name={f.away} />
                      <span className="truncate font-semibold text-foreground">{f.away}</span>
                    </span>
                    {live ? (
                      <span className="flex shrink-0 items-center gap-1 text-[11px] font-bold text-primary"><Check className="size-3.5" aria-hidden />Yayında</span>
                    ) : f.started ? (
                      <span className="shrink-0 text-[11px] text-muted-foreground">Başladı</span>
                    ) : null}
                  </label>
                )
              })}
            </fieldset>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <button
          type="button"
          disabled={publish.pending || !chosen.length}
          onClick={() =>
            publish.run(
              () => publishFixtures(chosen.map(({ started: _s, ...f }) => f)),
              () => {
                setPublished((prev) => new Set([...prev, ...chosen.map((f) => f.extId)]))
                setPicked(new Set())
              },
            )
          }
          className="h-10 rounded-lg bg-primary px-4 text-xs font-bold uppercase tracking-wider text-primary-foreground disabled:opacity-40"
        >
          {publish.pending ? 'Yayınlanıyor...' : `Seçilenleri yayınla (${chosen.length})`}
        </button>
        <button
          type="button"
          disabled={settle.pending}
          onClick={() => settle.run(() => autoSettleMatches())}
          className="flex h-10 items-center gap-1.5 rounded-lg bg-secondary px-4 text-xs font-bold text-secondary-foreground disabled:opacity-40"
        >
          <RefreshCw className={cn('size-3.5', settle.pending && 'animate-spin')} aria-hidden /> Biten maçları otomatik puanla
        </button>
        <StatusLine status={publish.status} />
        <StatusLine status={settle.status} />
      </div>
    </section>
  )
}
