'use client'

import { useState, useTransition } from 'react'
import { Check, ChevronDown, Star, X } from 'lucide-react'
import { loadLeagueFixtures, pinLeague } from '@/app/panel/community-actions'
import { importGoalMatches } from '@/app/panel/goal-actions'
import type { FeedLeague, Fixture, LeagueFixtures } from '@/lib/kankatv'
import { MAX_LEAGUES_AT_ONCE, type LeaguePin } from '@/lib/prediction-book-shared'
import { usePanelAction } from '@/components/panel/flash'
import { StatusLine } from '@/components/alkanka/community/use-action'
import { cn } from '@/lib/utils'
import { LeagueBrowser } from './league-browser'

/** Goals are a football count, so only football fixtures can be taken from the calendar. */
const SPORT = 'football'

const dayKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' })
const istanbulDay = (offset = 0) => dayKey.format(Date.now() + offset * 86_400_000)
const stamp = (iso: string) => new Date(iso).toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' })

type Range = 'all' | 'today' | 'tomorrow' | 'week'

const RANGES: [Range, string][] = [
  ['all', 'Hepsi'],
  ['today', 'Bugün'],
  ['tomorrow', 'Yarın'],
  ['week', '7 gün'],
]

function inRange(f: Fixture, range: Range) {
  if (range === 'all') return true
  const day = dayKey.format(new Date(f.kickoff))
  if (range === 'today') return day === istanbulDay()
  if (range === 'tomorrow') return day === istanbulDay(1)
  return day <= istanbulDay(6)
}

function Crest({ src, name }: { src: string; name: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- crests come from the fixture feed's image host
    <img src={src} alt="" width={24} height={24} loading="lazy" className="size-6 shrink-0 object-contain" title={name} />
  )
}

const chip = (on: boolean) => cn('h-9 rounded-md px-3 text-xs font-bold', on ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')

/** Adds calendar games to one goal reward event: pick the leagues, list their games, tick the ones to add. */
export function GoalFixturePicker({
  eventId,
  taken,
  pins,
  onSaved,
  onPinsChanged,
}: {
  eventId: number
  /** Calendar ids of the games this event already has. */
  taken: number[]
  pins: LeaguePin[]
  onSaved: () => void
  onPinsChanged: () => void
}) {
  const [leagues, setLeagues] = useState<FeedLeague[]>([])
  const [browsing, setBrowsing] = useState(false)
  const [groups, setGroups] = useState<LeagueFixtures[] | null>(null)
  const [picked, setPicked] = useState<Set<number>>(new Set())
  const [range, setRange] = useState<Range>('all')
  const [error, setError] = useState('')
  const [loading, startLoading] = useTransition()
  const add = usePanelAction()
  const pin = usePanelAction()
  const inEvent = new Set(taken)
  const full = leagues.length >= MAX_LEAGUES_AT_ONCE

  const reset = () => {
    setGroups(null)
    setPicked(new Set())
    setError('')
  }

  const toggleLeague = (l: FeedLeague) => {
    reset()
    if (leagues.some((x) => x.id === l.id)) return setLeagues(leagues.filter((x) => x.id !== l.id))
    if (full) return setError(`Bir seferde en fazla ${MAX_LEAGUES_AT_ONCE} lig seçilebilir. Önce bu liglerin maçlarını ekle.`)
    setLeagues([...leagues, l])
  }

  const load = () => {
    setError('')
    startLoading(async () => {
      const r = await loadLeagueFixtures(
        SPORT,
        leagues.map((l) => l.id),
      )
      if (!r.ok) {
        setError(r.error)
        setGroups(null)
        return
      }
      setGroups(r.groups)
      setPicked(new Set())
      if (r.missing.length) {
        const names = leagues.filter((l) => r.missing.includes(l.id)).map((l) => l.name)
        setError(`Şu liglerin maçları okunamadı: ${names.join(', ')}. Diğerleri aşağıda.`)
      }
    })
  }

  const toggle = (id: number) =>
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const closed = (f: Fixture) => f.started || inEvent.has(f.extId)
  const shown = (groups ?? []).map((g) => ({ ...g, fixtures: g.fixtures.filter((f) => inRange(f, range)) }))
  const free = shown.flatMap((g) => g.fixtures).filter((f) => !closed(f))
  const chosen = free.filter((f) => picked.has(f.extId))
  const allPicked = free.length > 0 && free.every((f) => picked.has(f.extId))

  return (
    <div className="flex flex-col gap-3 rounded-lg bg-secondary/50 p-3">
      <p className="text-xs leading-relaxed text-muted-foreground">
        Ligi seç, maçlarını getir, eklemek istediklerini işaretle. Takvimden alınan maçın logoları kendiliğinden gelir; maç bitince skoru kaynaktan okunur ve ödül kendiliğinden hesaplanır. Skor okunamazsa maç &quot;sonuç bekliyor&quot; olarak kalır,
        sonucu elle girersin.
      </p>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold text-muted-foreground">Sabitlenen ligler</span>
        {pins.length ? (
          <ul className="flex flex-wrap gap-1.5">
            {pins.map((p) => {
              const on = leagues.some((l) => l.id === p.id)
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleLeague({ id: p.id, name: p.name, country: p.country })}
                    className={cn(
                      'flex min-h-9 items-center gap-1.5 rounded-full border px-3 py-1 text-left text-xs font-semibold transition-colors',
                      on ? 'border-primary bg-primary/15 text-primary' : 'border-border bg-card text-foreground hover:border-primary hover:text-primary',
                    )}
                  >
                    <Star className="size-3.5 shrink-0" fill="currentColor" aria-hidden="true" />
                    <span>
                      {p.name}
                      {p.country && <span className="font-normal text-muted-foreground">{` · ${p.country}`}</span>}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="text-xs leading-relaxed text-muted-foreground">Sabitlenmiş futbol ligi yok. Aşağıdan ülkeyi aç, ligin yanındaki yıldıza bas; bir dahaki sefere burada hazır durur.</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          aria-expanded={browsing}
          onClick={() => setBrowsing((v) => !v)}
          className="flex h-10 items-center gap-1.5 self-start rounded-lg border border-border bg-card px-4 text-xs font-bold text-foreground hover:bg-secondary"
        >
          Ülkeden lig seç
          <ChevronDown className={cn('size-3.5 text-muted-foreground transition-transform', browsing && 'rotate-180')} aria-hidden="true" />
        </button>
        {browsing && (
          <LeagueBrowser
            sport={SPORT}
            chosen={(id) => leagues.some((l) => l.id === id)}
            onToggle={toggleLeague}
            pins={pins}
            onPin={(l, on) => pin.run(() => pinLeague({ sport: SPORT, id: l.id, name: l.name, country: l.country }, on), onPinsChanged)}
          />
        )}
        <StatusLine status={pin.status} />
      </div>

      {leagues.length > 0 && (
        <div className="flex flex-col gap-2 rounded-lg bg-background p-3">
          <span className="text-xs font-semibold text-muted-foreground">
            Seçilen ligler ({leagues.length}/{MAX_LEAGUES_AT_ONCE})
          </span>
          <ul className="flex flex-wrap gap-1.5">
            {leagues.map((l) => (
              <li key={l.id} className="flex items-center gap-1 rounded-full border border-border bg-card py-0.5 pl-3 pr-1 text-xs font-semibold text-foreground">
                {l.name}
                <button type="button" onClick={() => toggleLeague(l)} aria-label={`${l.name} seçimden çıkar`} className="flex size-7 items-center justify-center rounded-full text-muted-foreground hover:text-foreground">
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
          <button type="button" disabled={loading} onClick={load} className="h-10 self-start rounded-lg bg-primary px-4 text-xs font-bold text-primary-foreground disabled:opacity-40">
            {loading ? 'Maçlar getiriliyor...' : groups ? 'Maçları yenile' : 'Bu liglerin maçlarını getir'}
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="text-xs font-medium leading-relaxed text-destructive">
          {error}
        </p>
      )}

      {groups && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div role="group" aria-label="Tarih aralığı" className="flex w-fit max-w-full flex-wrap gap-1 rounded-lg border border-border bg-background p-1">
              {RANGES.map(([id, text]) => (
                <button key={id} type="button" aria-pressed={range === id} onClick={() => setRange(id)} className={chip(range === id)}>
                  {text}
                </button>
              ))}
            </div>
            <button
              type="button"
              disabled={!free.length}
              onClick={() => setPicked(allPicked ? new Set() : new Set(free.map((f) => f.extId)))}
              className="h-9 rounded-lg border border-border bg-card px-3 text-xs font-semibold text-foreground hover:bg-secondary disabled:opacity-40"
            >
              {allPicked ? 'Seçimi kaldır' : 'Listedekilerin hepsini seç'}
            </button>
          </div>
          <div className="flex max-h-[28rem] flex-col gap-3 overflow-y-auto pr-1">
            {shown.map((g) => (
              <fieldset key={g.league.id} className="flex flex-col gap-1">
                <legend className="mb-1 text-xs font-bold uppercase tracking-wider text-primary">
                  {g.league.name}
                  {g.league.country && <span className="font-normal normal-case tracking-normal text-muted-foreground">{` · ${g.league.country}`}</span>}
                </legend>
                {g.fixtures.length ? (
                  g.fixtures.map((f) => {
                    const here = inEvent.has(f.extId)
                    const off = closed(f)
                    return (
                      <label
                        key={f.extId}
                        className={cn('flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border px-3 py-2 text-sm', picked.has(f.extId) && !off ? 'border-primary bg-primary/10' : 'border-border bg-background', off ? 'opacity-60' : 'cursor-pointer')}
                      >
                        <input type="checkbox" disabled={off} checked={!off && picked.has(f.extId)} onChange={() => toggle(f.extId)} className="size-4 shrink-0 accent-primary" />
                        <span className="w-24 shrink-0 text-xs tabular-nums text-muted-foreground">{stamp(f.kickoff)}</span>
                        <span className="flex min-w-0 flex-1 basis-56 items-center gap-2">
                          <Crest src={f.homeLogo} name={f.home} />
                          <span className="min-w-0 truncate font-semibold text-foreground">{f.home}</span>
                          <span className="text-xs text-muted-foreground">-</span>
                          <span className="min-w-0 truncate font-semibold text-foreground">{f.away}</span>
                          <Crest src={f.awayLogo} name={f.away} />
                        </span>
                        {here ? (
                          <span className="flex shrink-0 items-center gap-1 text-xs font-bold text-primary">
                            <Check className="size-3.5" aria-hidden="true" />
                            Etkinlikte
                          </span>
                        ) : f.started ? (
                          <span className="shrink-0 text-xs font-semibold text-muted-foreground">Başladı</span>
                        ) : null}
                      </label>
                    )
                  })
                ) : (
                  <p className="rounded-lg bg-background px-3 py-2 text-xs text-muted-foreground">{range === 'all' ? 'Bu ligde yaklaşan maç yok.' : 'Bu aralıkta maç yok.'}</p>
                )}
              </fieldset>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={add.pending || !chosen.length}
          onClick={() =>
            add.run(
              () =>
                importGoalMatches(
                  eventId,
                  chosen.map(({ extId, league, home, away, homeLogo, awayLogo, kickoff }) => ({ extId, league, home, away, homeLogo, awayLogo, kickoff })),
                ),
              () => {
                setPicked(new Set())
                onSaved()
              },
            )
          }
          className="h-9 rounded-lg bg-primary px-4 text-xs font-bold text-primary-foreground disabled:opacity-40"
        >
          {add.pending ? 'Ekleniyor...' : `Seçilenleri etkinliğe ekle (${chosen.length})`}
        </button>
        <StatusLine status={add.status} />
      </div>
    </div>
  )
}
