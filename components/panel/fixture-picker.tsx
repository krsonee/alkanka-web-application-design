'use client'

import { useState, useTransition } from 'react'
import { CalendarDays, Check, ChevronDown, Pencil, RefreshCw, Star, X } from 'lucide-react'
import { autoSettleMatches, loadLeagueFixtures, pinLeague, publishFixtures } from '@/app/panel/community-actions'
import type { FeedLeague, Fixture, LeagueFixtures } from '@/lib/kankatv'
import { MAX_LEAGUES_AT_ONCE, type LeagueBook } from '@/lib/prediction-book-shared'
import { SPORTS, SPORT_IDS, startingSet, type LeagueSettings, type QuestionSet, type Sport } from '@/lib/predictions-shared'
import { usePanelAction } from '@/components/panel/flash'
import { StatusLine, useAction } from '@/components/alkanka/community/use-action'
import { cn } from '@/lib/utils'
import { LeagueBrowser } from './league-browser'
import { QuestionSetEditor, ceilingLine, questionLine, setProblem, type PrizeOptions } from './league-fields'

const FEED_SPORTS = SPORT_IDS.filter((s) => SPORTS[s].feed)

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

const tabs = 'flex w-fit max-w-full flex-wrap gap-1 rounded-lg border border-border bg-background p-1'
const tab = (on: boolean) => cn('h-9 rounded-md px-3 text-xs font-bold', on ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')

/** Publishes calendar games: pick the sport, then the leagues, and only those leagues' games are listed. */
export function FixturePicker({ book, onBookChanged, settings, options }: { book: LeagueBook; onBookChanged: () => void; settings: LeagueSettings; options: PrizeOptions }) {
  const [sport, setSport] = useState<Sport>('football')
  const [leagues, setLeagues] = useState<FeedLeague[]>([])
  const [browsing, setBrowsing] = useState(false)
  const [groups, setGroups] = useState<LeagueFixtures[] | null>(null)
  const [published, setPublished] = useState<Set<number>>(new Set())
  const [picked, setPicked] = useState<Set<number>>(new Set())
  const [range, setRange] = useState<Range>('all')
  // Questions chosen for one match; a match without an entry opens with its sport's template.
  const [own, setOwn] = useState<Map<number, QuestionSet>>(new Map())
  const [editing, setEditing] = useState<number | 'all' | null>(null)
  const [shared, setShared] = useState<QuestionSet | null>(null)
  const [error, setError] = useState('')
  const [loading, startLoading] = useTransition()
  const publish = useAction()
  const settle = useAction()
  const pin = usePanelAction()
  const pins = book.pins.filter((p) => p.sport === sport)
  const full = leagues.length >= MAX_LEAGUES_AT_ONCE

  const reset = () => {
    setGroups(null)
    setPicked(new Set())
    setOwn(new Map())
    setEditing(null)
    setShared(null)
    setError('')
  }

  const pickSport = (next: Sport) => {
    setSport(next)
    setLeagues([])
    setBrowsing(false)
    reset()
  }

  const toggleLeague = (l: FeedLeague) => {
    reset()
    if (leagues.some((x) => x.id === l.id)) return setLeagues(leagues.filter((x) => x.id !== l.id))
    if (full) return setError(`Bir seferde en fazla ${MAX_LEAGUES_AT_ONCE} lig seçilebilir. Önce bu liglerin maçlarını yayınla.`)
    setLeagues([...leagues, l])
  }

  const load = () => {
    setError('')
    startLoading(async () => {
      const r = await loadLeagueFixtures(sport, leagues.map((l) => l.id))
      if (!r.ok) {
        setError(r.error)
        setGroups(null)
        return
      }
      setGroups(r.groups)
      setPublished(new Set(r.published))
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

  const shown = (groups ?? []).map((g) => ({ ...g, fixtures: g.fixtures.filter((f) => inRange(f, range)) }))
  const chosen = shown.flatMap((g) => g.fixtures).filter((f) => picked.has(f.extId))
  const openFixtures = shown.flatMap((g) => g.fixtures).filter((f) => !published.has(f.extId))
  const allPicked = openFixtures.length > 0 && openFixtures.every((f) => picked.has(f.extId))
  const template = startingSet(settings, sport)
  const setOf = (id: number) => own.get(id) ?? template
  const putOwn = (id: number, set: QuestionSet | null) =>
    setOwn((prev) => {
      const next = new Map(prev)
      if (set) next.set(id, set)
      else next.delete(id)
      return next
    })
  const sharedDraft = shared ?? template
  const broken = chosen.find((f) => own.has(f.extId) && setProblem(own.get(f.extId)!))

  return (
    <section aria-labelledby="fikstur" className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-1">
        <h3 id="fikstur" className="flex items-center gap-2 font-display text-base font-bold text-foreground">
          <CalendarDays className="size-4 text-primary" aria-hidden="true" /> Takvimden maç seç
        </h3>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Önce sporu, sonra ligleri seç; sadece o liglerin yaklaşan maçları gelir. Sık kullandığın ligi yıldızla sabitle, her açılışta en üstte dursun. Logolar kendiliğinden gelir. E-spor maçları kaynakta yok; onları aşağıdan elle eklersin.
        </p>
      </div>

      <div role="tablist" aria-label="Spor" className={tabs}>
        {FEED_SPORTS.map((s) => (
          <button key={s} type="button" role="tab" aria-selected={sport === s} onClick={() => pickSport(s)} className={tab(sport === s)}>
            {SPORTS[s].label}
          </button>
        ))}
      </div>

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
                      on ? 'border-primary bg-primary/15 text-primary' : 'border-border text-foreground hover:border-primary hover:text-primary',
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
          <p className="text-xs leading-relaxed text-muted-foreground">Bu sporda sabitlenmiş lig yok. Aşağıdan ülkeyi aç, ligin yanındaki yıldıza bas.</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          aria-expanded={browsing}
          onClick={() => setBrowsing((v) => !v)}
          className="flex h-10 items-center gap-1.5 self-start rounded-lg border border-border px-4 text-xs font-bold text-foreground hover:bg-secondary"
        >
          Ülkeden lig seç
          <ChevronDown className={cn('size-3.5 text-muted-foreground transition-transform', browsing && 'rotate-180')} aria-hidden="true" />
        </button>
        {browsing && (
          <LeagueBrowser
            key={sport}
            sport={sport}
            chosen={(id) => leagues.some((l) => l.id === id)}
            onToggle={toggleLeague}
            pins={pins}
            onPin={(l, on) => pin.run(() => pinLeague({ sport, id: l.id, name: l.name, country: l.country }, on), onBookChanged)}
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
            <div role="group" aria-label="Tarih aralığı" className={tabs}>
              {RANGES.map(([id, label]) => (
                <button key={id} type="button" aria-pressed={range === id} onClick={() => setRange(id)} className={tab(range === id)}>
                  {label}
                </button>
              ))}
            </div>
            <button
              type="button"
              disabled={!openFixtures.length}
              onClick={() => setPicked(allPicked ? new Set() : new Set(openFixtures.map((f) => f.extId)))}
              className="h-9 rounded-lg border border-border px-3 text-xs font-semibold text-foreground hover:bg-secondary disabled:opacity-40"
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
                    const live = published.has(f.extId)
                    return (
                      <label
                        key={f.extId}
                        className={cn('flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border px-3 py-2 text-sm', picked.has(f.extId) ? 'border-primary bg-primary/10' : 'border-border bg-background', live ? 'opacity-60' : 'cursor-pointer')}
                      >
                        <input type="checkbox" disabled={live} checked={picked.has(f.extId)} onChange={() => toggle(f.extId)} className="size-4 shrink-0 accent-primary" />
                        <span className="w-24 shrink-0 text-xs tabular-nums text-muted-foreground">{stamp(f.kickoff)}</span>
                        <span className="flex min-w-0 flex-1 basis-56 items-center gap-2">
                          <Crest src={f.homeLogo} name={f.home} />
                          <span className="min-w-0 truncate font-semibold text-foreground">{f.home}</span>
                          <span className="text-xs text-muted-foreground">-</span>
                          <span className="min-w-0 truncate font-semibold text-foreground">{f.away}</span>
                          <Crest src={f.awayLogo} name={f.away} />
                        </span>
                        {live && (
                          <span className="flex shrink-0 items-center gap-1 text-xs font-bold text-primary">
                            <Check className="size-3.5" aria-hidden="true" />
                            Yayında
                          </span>
                        )}
                      </label>
                    )
                  })
                ) : (
                  <p className="rounded-lg bg-background px-3 py-2 text-xs text-muted-foreground">{range === 'all' ? 'Bu ligde yaklaşan maç yok.' : 'Bu aralıkta maç yok.'}</p>
                )}
              </fieldset>
            ))}
          </div>
          {chosen.length > 0 && (
            <section aria-labelledby="secilen-sorular" className="flex flex-col gap-3 rounded-lg border border-border bg-background p-3">
              <div className="flex flex-col gap-1">
                <h4 id="secilen-sorular" className="text-sm font-bold text-foreground">
                  Seçilen maçların soruları ({chosen.length})
                </h4>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Her maç {SPORTS[sport].label.toLocaleLowerCase('tr')} şablonuyla açılır. İstediğin maçın yanındaki &quot;Soruları seç&quot; ile o maça tek ya da çok soruyu ayrı belirle, ya da hepsine birden aynı soruları uygula.
                  {sport === 'tennis' ? ' Tenis 3 set üzerinden sayılır; 5 setlik maçta soruları seçerken maç uzunluğunu da seç.' : ''}
                </p>
              </div>
              <button
                type="button"
                aria-expanded={editing === 'all'}
                onClick={() => setEditing(editing === 'all' ? null : 'all')}
                className="flex h-9 items-center gap-1.5 self-start rounded-lg border border-border px-3 text-xs font-semibold text-foreground hover:bg-secondary"
              >
                <Pencil className="size-3.5" aria-hidden="true" />
                {editing === 'all' ? 'Vazgeç' : 'Hepsine aynı soruları uygula'}
              </button>
              {editing === 'all' && (
                <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3">
                  <QuestionSetEditor value={sharedDraft} onChange={setShared} options={options} />
                  {setProblem(sharedDraft) && (
                    <p role="alert" className="text-xs font-medium text-destructive">
                      {setProblem(sharedDraft)}
                    </p>
                  )}
                  <button
                    type="button"
                    disabled={Boolean(setProblem(sharedDraft))}
                    onClick={() => {
                      setOwn((prev) => {
                        const next = new Map(prev)
                        for (const f of chosen) next.set(f.extId, sharedDraft)
                        return next
                      })
                      setEditing(null)
                    }}
                    className="h-9 self-start rounded-lg bg-primary px-4 text-xs font-bold text-primary-foreground disabled:opacity-40"
                  >
                    Seçilen {chosen.length} maça uygula
                  </button>
                </div>
              )}
              <ul className="flex flex-col gap-2">
                {chosen.map((f) => {
                  const set = setOf(f.extId)
                  const mine = own.has(f.extId)
                  const open = editing === f.extId
                  const problem = mine ? setProblem(set) : null
                  return (
                    <li key={f.extId} className={cn('flex flex-col gap-2 rounded-lg border bg-card p-3', mine ? 'border-primary/40' : 'border-border')}>
                      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                        <div className="flex min-w-0 flex-1 basis-56 flex-col gap-0.5">
                          <span className="text-sm font-bold text-foreground">
                            {f.home} - {f.away}
                          </span>
                          <span className="text-xs leading-relaxed text-muted-foreground">
                            {stamp(f.kickoff)} · {mine ? 'bu maça özel' : 'şablon'}: <span className="text-foreground">{questionLine(set)}</span> · en fazla {ceilingLine(set)}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            aria-expanded={open}
                            onClick={() => {
                              if (!open && !mine) putOwn(f.extId, template)
                              setEditing(open ? null : f.extId)
                            }}
                            className="flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-semibold text-foreground hover:bg-secondary"
                          >
                            <Pencil className="size-3.5" aria-hidden="true" />
                            {open ? 'Tamam' : 'Soruları seç'}
                          </button>
                          {mine && (
                            <button
                              type="button"
                              onClick={() => {
                                putOwn(f.extId, null)
                                if (open) setEditing(null)
                              }}
                              className="h-9 rounded-lg border border-border px-3 text-xs font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground"
                            >
                              Şablona dön
                            </button>
                          )}
                        </div>
                      </div>
                      {open && <QuestionSetEditor value={set} onChange={(next) => putOwn(f.extId, next)} options={options} />}
                      {problem && (
                        <p role="alert" className="text-xs font-medium text-destructive">
                          {problem}
                        </p>
                      )}
                    </li>
                  )
                })}
              </ul>
            </section>
          )}
          <p className="text-xs leading-relaxed text-muted-foreground">Yayınladıktan sonra da, maça tahmin gelmeden önce aşağıdaki listeden sorularını değiştirebilirsin.</p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <button
          type="button"
          disabled={publish.pending || !chosen.length || Boolean(broken)}
          onClick={() =>
            publish.run(
              () => publishFixtures(chosen.map(({ started: _started, ...f }) => ({ ...f, set: own.get(f.extId) }))),
              () => {
                setPublished((prev) => new Set([...prev, ...chosen.map((f) => f.extId)]))
                setPicked(new Set())
                setOwn(new Map())
                setEditing(null)
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
          <RefreshCw className={cn('size-3.5', settle.pending && 'animate-spin')} aria-hidden="true" /> Biten maçları otomatik puanla
        </button>
        <StatusLine status={publish.status} />
        <StatusLine status={settle.status} />
      </div>
    </section>
  )
}
