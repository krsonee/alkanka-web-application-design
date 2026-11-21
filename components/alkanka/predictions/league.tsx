'use client'

import { useEffect, useId, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import type { LeagueMatch, LeagueRow, LeagueScope, PaidPeriod } from '@/lib/predictions'
import { SPORTS, SPORT_IDS, sportOf, type Award, type PeriodKind, type Sport } from '@/lib/predictions-shared'
import { plainClick } from '@/lib/plain-click'
import { LEAGUE_HOME, LEAGUE_SPORT_ADDRESS, LEAGUE_SPORT_PARAM, LEAGUE_TAB_PARAM, LEAGUE_TABLE_ADDRESS, LEAGUE_TABLE_PARAM, leaguePath } from '@/lib/record-links'
import { cn } from '@/lib/utils'
import { MatchRow, matchState, type MatchState } from './match-row'
import { MyAwards } from './my-awards'
import { Standings, type BoardView, type PeriodView } from './standings'
import { filterChip, filterCount, segmentCount, segmentItem, segmentTray } from './ui'

/** What a shared address can open: one of the match tabs, or the league table (its own view on a narrow screen). */
export type LeagueStart = MatchState | 'league'

const TAB_ADDRESS: Record<LeagueStart, string> = { open: 'acik', waiting: 'bekleyen', done: 'sonuclanan', league: 'lig' }

const TABS: { id: MatchState; label: string; short: string; empty: string }[] = [
  { id: 'open', label: 'Tahmine açık', short: 'Açık', empty: 'Şu an tahmine açık maç yok. Yeni maçlar eklendiğinde burada görünür.' },
  { id: 'waiting', label: 'Sonuç bekleyen', short: 'Bekleyen', empty: 'Sonucu beklenen maç yok.' },
  { id: 'done', label: 'Sonuçlanan', short: 'Biten', empty: 'Son 7 günde sonuçlanan maç yok.' },
]

const GENERAL_LEAGUE_NAME = 'Genel lig'

const DAY_MS = 86_400_000
const dayKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' })
const dayName = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', weekday: 'long', timeZone: 'Europe/Istanbul' })

function dayTitle(iso: string, now: number) {
  const at = new Date(iso).getTime()
  const key = dayKey.format(at)
  if (key === dayKey.format(now)) return 'Bugün'
  if (key === dayKey.format(now + DAY_MS)) return 'Yarın'
  if (key === dayKey.format(now - DAY_MS)) return 'Dün'
  return dayName.format(at)
}

/** Starts on the server's clock so the first paint matches, then follows the visitor's. */
function useNow(initial: number, everyMs: number) {
  const [now, setNow] = useState(initial)
  useEffect(() => {
    setNow(Date.now())
    const t = setInterval(() => setNow(Date.now()), everyMs)
    return () => clearInterval(t)
  }, [everyMs])
  return now
}

function byDay(list: LeagueMatch[], now: number) {
  const days: { title: string; items: LeagueMatch[] }[] = []
  for (const m of list) {
    const title = dayTitle(m.kickoff, now)
    const last = days[days.length - 1]
    if (last?.title === title) last.items.push(m)
    else days.push({ title, items: [m] })
  }
  return days
}

function setParam(url: URL, name: string, value: string | null) {
  if (value) url.searchParams.set(name, value)
  else url.searchParams.delete(name)
}

function HowTo() {
  const [open, setOpen] = useState(false)
  const id = useId()
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 self-start text-xs font-semibold text-primary underline-offset-2 hover:underline"
      >
        Nasıl oynanır?
        <ChevronDown className={cn('size-3.5 transition-transform', open && 'rotate-180')} aria-hidden="true" />
      </button>
      {open && (
        <ul id={id} className="flex list-disc flex-col gap-1 pl-5 text-xs leading-relaxed text-muted-foreground">
          <li>Her maçın kendi soruları vardır: futbolda maç sonucu, tam skor, gol, korner ya da kart; diğer sporlarda kazanan, toplam sayı, set ya da harita skoru gibi. Hangi soruların sorulduğu ve ödülü maçın kartında yazar.</li>
          <li>Her doğru cevap ayrı puan ve ödül kazandırır. Bir maçın bütün sorularını bilirsen bonus da alırsın.</li>
          <li>Tahmin maç başlamadan kapanır ve bir kez yapılır; kaydettikten sonra değişmez.</li>
          <li>Futbolda uzatmaya giden maçlarda 90 dakikanın sonucu sayılır. Kart sorusunda sarı ve kırmızı kartlar toplanır.</li>
          <li>Basketbolda uzatmalar skora dahildir. Voleybol ve teniste set skoru, e-sporda harita skoru sorulur; bu maçlarda beraberlik olmaz.</li>
          <li>Verisi alınamayan bir soru iptal edilir; puanlanmaz ve bonusu etkilemez.</li>
          <li>Puanların haftalık ve aylık lig tablosuna yazılır. Eşitlikte tam skoru daha çok bilen öne geçer.</li>
          <li>Kartında özel lig adı yazan maçın puanı o ligin kendi tablosuna yazılır. Her özel ligin kendi sayfası vardır: ligin adına bastığında maçları ve tablosu birlikte açılır.</li>
        </ul>
      )}
    </div>
  )
}

export function League({
  matches,
  tables,
  periods,
  paid,
  boards,
  awards,
  meId,
  serverNow,
  focus,
  start,
  league: leagueStart,
  table: tableStart,
  sport: sportStart,
}: {
  matches: LeagueMatch[]
  tables: Record<LeagueScope, LeagueRow[]>
  periods: Record<PeriodKind, PeriodView>
  paid: Partial<Record<PeriodKind, PaidPeriod>>
  /** Special leagues, each with its own table. */
  boards: BoardView[]
  awards: Award[]
  meId: string | null
  serverNow: number
  /** The match of a shared /tahminler/[id] address: its tab is shown and its row starts open. */
  focus?: number
  start?: LeagueStart
  /** The league of a shared /tahminler/lig/... address; 0 stands for the general league. */
  league?: number | null
  /** The table period and the sport a shared address asked for. */
  table?: LeagueScope
  sport?: Sport
}) {
  const now = useNow(serverNow, 30_000)
  const [chosen, setChosen] = useState<MatchState | null>(() => {
    const focused = focus == null ? undefined : matches.find((m) => m.id === focus)
    if (focused) return matchState(focused, serverNow)
    return start && start !== 'league' ? start : null
  })
  const [view, setView] = useState<'matches' | 'league'>(focus == null && start === 'league' ? 'league' : 'matches')
  const [mineOnly, setMineOnly] = useState(false)
  const [onlySport, setOnlySport] = useState<Sport | null>(sportStart ?? null)
  // 0 stands for the general league.
  const [league, setLeague] = useState<number | null>(leagueStart ?? null)
  const [scope, setScope] = useState<LeagueScope>(tableStart ?? 'week')
  const [saved, setSaved] = useState(false)

  const allGroups: Record<MatchState, LeagueMatch[]> = { open: [], waiting: [], done: [] }
  for (const m of matches) allGroups[matchState(m, now)].push(m)
  allGroups.open.sort((a, b) => a.kickoff.localeCompare(b.kickoff))
  allGroups.waiting.sort((a, b) => a.kickoff.localeCompare(b.kickoff))
  allGroups.done.sort((a, b) => b.kickoff.localeCompare(a.kickoff))

  // With a league chosen, the tabs, their counts and the filters below all speak of that league alone.
  const inLeague = (m: LeagueMatch) => league === null || (m.boardId ?? 0) === league
  const groups: Record<MatchState, LeagueMatch[]> = { open: allGroups.open.filter(inLeague), waiting: allGroups.waiting.filter(inLeague), done: allGroups.done.filter(inLeague) }
  const tab = chosen ?? (groups.open.length ? 'open' : groups.waiting.length ? 'waiting' : 'done')

  const leagueNames = new Map<number, string>([[0, GENERAL_LEAGUE_NAME]])
  for (const b of boards) leagueNames.set(b.id, b.name)
  for (const m of matches) if (m.boardId && m.boardName) leagueNames.set(m.boardId, m.boardName)
  const leagueHref = (id: number | null) => (id === null ? LEAGUE_HOME : leaguePath(id, leagueNames.get(id)))

  // On a match's own page the address already says what is shown.
  const address = (change: (url: URL) => void) => {
    if (focus != null) return
    const url = new URL(window.location.href)
    change(url)
    window.history.replaceState(null, '', url)
  }
  const remember = (next: LeagueStart) => address((url) => url.searchParams.set(LEAGUE_TAB_PARAM, TAB_ADDRESS[next]))
  // Choosing a league keeps the tab the visitor is looking at, even when that league has nothing in it.
  const pickLeague = (id: number | null) => {
    setChosen(tab)
    setLeague(id)
    address((url) => {
      url.pathname = leagueHref(id)
    })
  }
  const pickSport = (next: Sport | null) => {
    setOnlySport(next)
    address((url) => setParam(url, LEAGUE_SPORT_PARAM, next ? LEAGUE_SPORT_ADDRESS[next] : null))
  }
  // The weekly, monthly and all-time tables belong to the general league: asking for one leaves a special league's page.
  const pickScope = (next: LeagueScope) => {
    const leaving = league !== null && league > 0
    setScope(next)
    if (leaving) {
      setChosen(tab)
      setLeague(null)
    }
    address((url) => {
      setParam(url, LEAGUE_TABLE_PARAM, next === 'week' ? null : LEAGUE_TABLE_ADDRESS[next])
      if (leaving) url.pathname = LEAGUE_HOME
    })
  }

  const canFilter = tab !== 'open' && groups[tab].some((m) => m.myPick) && groups[tab].some((m) => !m.myPick)
  // The sport filter only appears where there is something to tell apart, and lets go of a sport the tab no longer has.
  const sportsHere = SPORT_IDS.filter((s) => groups[tab].some((m) => sportOf(m.set) === s))
  const sport = onlySport && sportsHere.length > 1 && sportsHere.includes(onlySport) ? onlySport : null
  // The leagues with a match in this tab, and the chosen one even when it has none here: its button is the way back out.
  const leaguesHere = [...new Set(allGroups[tab].map((m) => m.boardId ?? 0))]
  if (league !== null && !leaguesHere.includes(league)) leaguesHere.push(league)
  leaguesHere.sort((a, b) => a - b)
  const list = groups[tab].filter((m) => (!canFilter || !mineOnly || m.myPick) && (!sport || sportOf(m.set) === sport))
  const filtered = list.length < groups[tab].length

  const week = tables.week
  const myIndex = meId ? week.findIndex((r) => r.userId === meId) : -1
  const myRow = myIndex >= 0 ? week[myIndex] : null
  const stillOpen = matches.some((m) => !m.settled && m.myPick && new Date(m.closesAt ?? m.kickoff).getTime() > now)
  const waitingAwards = awards.filter((a) => a.status === 'beklemede' && a.needsUsername && !a.siteUsername).length

  return (
    <div className="@container flex flex-col gap-4">
      <div className="flex flex-col gap-2 rounded-xl border border-border bg-card px-4 py-3">
        <p className="text-sm leading-relaxed text-foreground">
          {meId ? (
            <>
              Bu hafta <b className="font-display text-primary tabular-nums">{myRow?.points ?? 0} puan</b>
              {myRow ? (
                <>
                  {' '}
                  ile <b className="text-foreground">{myIndex + 1}. sıradasın</b>
                </>
              ) : (
                ' topladın'
              )}
              .{' '}
              {allGroups.open.length > 0 ? (
                <>
                  <b className="text-foreground">{allGroups.open.length} maç</b> tahminini bekliyor.
                </>
              ) : stillOpen ? (
                'Açık maçların hepsini tahmin ettin.'
              ) : (
                'Şu an tahmine açık maç yok.'
              )}
            </>
          ) : (
            <>
              {allGroups.open.length > 0 ? (
                <>
                  <b className="text-foreground">{allGroups.open.length} maç</b> tahmine açık.{' '}
                </>
              ) : null}
              Soruları cevapla, her doğru cevapla puan ve ödül kazan. Tahminlerin lig tablosuna yazılır.
            </>
          )}
        </p>
        <HowTo />
      </div>

      <div role="tablist" aria-label="Görünüm" className={cn(segmentTray, 'grid grid-cols-2 gap-1 @4xl:hidden')}>
        {(['matches', 'league'] as const).map((v) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={view === v}
            onClick={() => {
              setView(v)
              remember(v === 'league' ? 'league' : tab)
            }}
            className={cn(segmentItem(view === v), 'h-10 text-sm')}
          >
            {v === 'matches' ? 'Maçlar' : 'Lig ve ödüller'}
            {v === 'league' && waitingAwards > 0 && (
              <span className={cn('rounded-full px-1.5 text-xs tabular-nums', view === v ? 'bg-primary-foreground text-primary' : 'bg-primary text-primary-foreground')}>
                {waitingAwards}
                <span className="sr-only"> ödül senden bilgi bekliyor</span>
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="grid items-start gap-5 @4xl:grid-cols-[minmax(0,1fr)_19rem]">
        <div className={cn('@container min-w-0 flex-col gap-3', view === 'matches' ? 'flex' : 'hidden @4xl:flex')}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div role="tablist" aria-label="Maç durumu" className={cn(segmentTray, 'grid w-full grid-cols-3 gap-1 @md:flex @md:w-auto')}>
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.id}
                  onClick={() => {
                    setChosen(t.id)
                    setSaved(false)
                    remember(t.id)
                  }}
                  className={cn(segmentItem(tab === t.id), 'h-10 px-2 text-xs @md:shrink-0 @md:px-4 @md:text-sm')}
                >
                  <span className="truncate @md:hidden" aria-hidden="true">
                    {t.short}
                  </span>
                  <span className="sr-only @md:not-sr-only">{t.label}</span>
                  <span className={segmentCount(tab === t.id)}>{groups[t.id].length}</span>
                </button>
              ))}
            </div>
            {canFilter && (
              <button
                type="button"
                aria-pressed={mineOnly}
                onClick={() => setMineOnly((v) => !v)}
                className={cn('flex h-10 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-colors', mineOnly ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card text-foreground/80 hover:border-primary/50 hover:text-foreground')}
              >
                <span className={cn('flex size-4 items-center justify-center rounded border', mineOnly ? 'border-primary bg-primary text-primary-foreground' : 'border-border')}>
                  {mineOnly && <Check className="size-3" aria-hidden="true" />}
                </span>
                Sadece tahmin yaptıklarım
              </button>
            )}
          </div>

          {sportsHere.length > 1 && (
            <div role="group" aria-label="Spor" className="flex flex-wrap items-center gap-1.5">
              <span className="w-full text-xs font-semibold text-muted-foreground @md:w-10" aria-hidden="true">
                Spor
              </span>
              {[null, ...sportsHere].map((s) => (
                <button
                  key={s ?? 'hepsi'}
                  type="button"
                  aria-pressed={sport === s}
                  onClick={() => pickSport(s)}
                  className={filterChip(sport === s)}
                >
                  {s ? SPORTS[s].label : 'Hepsi'}
                  <span className={filterCount(sport === s)}>{s ? groups[tab].filter((m) => sportOf(m.set) === s).length : groups[tab].length}</span>
                </button>
              ))}
            </div>
          )}

          {(leaguesHere.length > 1 || league !== null) && (
            <nav aria-label="Ligler" className="flex flex-wrap items-center gap-1.5">
              <span className="w-full text-xs font-semibold text-muted-foreground @md:w-10" aria-hidden="true">
                Lig
              </span>
              {[null, ...leaguesHere].map((id) => (
                <a
                  key={id ?? 'hepsi'}
                  href={leagueHref(id)}
                  aria-current={league === id ? 'page' : undefined}
                  onClick={(e) => {
                    if (!plainClick(e)) return
                    e.preventDefault()
                    pickLeague(id)
                  }}
                  className={filterChip(league === id)}
                >
                  {id === null ? 'Bütün ligler' : (leagueNames.get(id) ?? 'Özel lig')}
                  <span className={filterCount(league === id)}>{id === null ? allGroups[tab].length : allGroups[tab].filter((m) => (m.boardId ?? 0) === id).length}</span>
                </a>
              ))}
            </nav>
          )}

          {saved && (
            <p role="status" className="rounded-lg bg-live/10 px-3 py-2 text-xs font-semibold text-live">
              Tahminin kaydedildi. Maç bitene kadar &quot;Sonuç bekleyen&quot; sekmesinde durur.
            </p>
          )}

          {list.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm leading-relaxed text-muted-foreground">
              {filtered ? 'Bu süzgeçle eşleşen maç yok.' : league !== null ? `${leagueNames.get(league) ?? 'Bu lig'} için bu sekmede maç yok. Diğer sekmelere ya da "Bütün ligler"e bakabilirsin.` : TABS.find((t) => t.id === tab)?.empty}
            </p>
          ) : (
            byDay(list, now).map((day) => (
              <section key={day.title} aria-label={day.title} className="flex flex-col gap-2">
                <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {day.title}
                  <span aria-hidden="true" className="h-px flex-1 bg-border" />
                  <span className="font-normal normal-case tracking-normal">{day.items.length} maç</span>
                </h2>
                {day.items.map((m) => (
                  <MatchRow key={m.id} m={m} state={tab} now={now} signedIn={meId !== null} onSaved={() => setSaved(true)} defaultOpen={m.id === focus} />
                ))}
              </section>
            ))
          )}
        </div>

        <aside className={cn('min-w-0 flex-col gap-4 @4xl:sticky @4xl:top-20', view === 'league' ? 'flex' : 'hidden @4xl:flex')}>
          <MyAwards awards={awards} />
          <Standings
            tables={tables}
            periods={periods}
            paid={paid}
            boards={boards}
            meId={meId}
            scope={scope}
            onScope={pickScope}
            boardId={league !== null && league > 0 ? league : null}
            onBoard={pickLeague}
          />
        </aside>
      </div>
    </div>
  )
}
