'use client'

import { useEffect, useId, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import type { LeagueMatch, LeagueRow, LeagueScope, PaidPeriod } from '@/lib/predictions'
import type { Award, PeriodKind } from '@/lib/predictions-shared'
import { cn } from '@/lib/utils'
import { MatchRow, matchState, type MatchState } from './match-row'
import { MyAwards } from './my-awards'
import { Standings, type PeriodView } from './standings'

const TABS: { id: MatchState; label: string; short: string; empty: string }[] = [
  { id: 'open', label: 'Tahmine açık', short: 'Açık', empty: 'Şu an tahmine açık maç yok. Yeni maçlar eklendiğinde burada görünür.' },
  { id: 'waiting', label: 'Sonuç bekleyen', short: 'Bekleyen', empty: 'Sonucu beklenen maç yok.' },
  { id: 'done', label: 'Sonuçlanan', short: 'Biten', empty: 'Son 7 günde sonuçlanan maç yok.' },
]

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
          <li>Her maçın kendi soruları vardır: maç sonucu, tam skor, gol, korner ya da kart gibi. Hangi soruların sorulduğu ve ödülü maçın kartında yazar.</li>
          <li>Her doğru cevap ayrı puan ve ödül kazandırır. Bir maçın bütün sorularını bilirsen bonus da alırsın.</li>
          <li>Tahmin maç başlamadan kapanır ve bir kez yapılır; kaydettikten sonra değişmez.</li>
          <li>Uzatmaya giden maçlarda 90 dakikanın sonucu sayılır. Kart sorusunda sarı ve kırmızı kartlar toplanır.</li>
          <li>Verisi alınamayan bir soru iptal edilir; puanlanmaz ve bonusu etkilemez.</li>
          <li>Puanların haftalık ve aylık lig tablosuna yazılır. Eşitlikte tam skoru daha çok bilen öne geçer.</li>
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
  awards,
  meId,
  serverNow,
}: {
  matches: LeagueMatch[]
  tables: Record<LeagueScope, LeagueRow[]>
  periods: Record<PeriodKind, PeriodView>
  paid: Partial<Record<PeriodKind, PaidPeriod>>
  awards: Award[]
  meId: string | null
  serverNow: number
}) {
  const now = useNow(serverNow, 30_000)
  const [chosen, setChosen] = useState<MatchState | null>(null)
  const [view, setView] = useState<'matches' | 'league'>('matches')
  const [mineOnly, setMineOnly] = useState(false)
  const [saved, setSaved] = useState(false)

  const groups: Record<MatchState, LeagueMatch[]> = { open: [], waiting: [], done: [] }
  for (const m of matches) groups[matchState(m, now)].push(m)
  groups.open.sort((a, b) => a.kickoff.localeCompare(b.kickoff))
  groups.waiting.sort((a, b) => a.kickoff.localeCompare(b.kickoff))
  groups.done.sort((a, b) => b.kickoff.localeCompare(a.kickoff))

  const tab = chosen ?? (groups.open.length ? 'open' : groups.waiting.length ? 'waiting' : 'done')
  const canFilter = tab !== 'open' && groups[tab].some((m) => m.myPick) && groups[tab].some((m) => !m.myPick)
  const list = canFilter && mineOnly ? groups[tab].filter((m) => m.myPick) : groups[tab]

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
              {groups.open.length > 0 ? (
                <>
                  <b className="text-foreground">{groups.open.length} maç</b> tahminini bekliyor.
                </>
              ) : stillOpen ? (
                'Açık maçların hepsini tahmin ettin.'
              ) : (
                'Şu an tahmine açık maç yok.'
              )}
            </>
          ) : (
            <>
              {groups.open.length > 0 ? (
                <>
                  <b className="text-foreground">{groups.open.length} maç</b> tahmine açık.{' '}
                </>
              ) : null}
              Soruları cevapla, her doğru cevapla puan ve ödül kazan. Tahminlerin lig tablosuna yazılır.
            </>
          )}
        </p>
        <HowTo />
      </div>

      <div role="tablist" aria-label="Görünüm" className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-card p-1 @4xl:hidden">
        {(['matches', 'league'] as const).map((v) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={view === v}
            onClick={() => setView(v)}
            className={cn('flex h-10 items-center justify-center gap-1.5 rounded-md text-sm font-bold transition-colors', view === v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
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
            <div role="tablist" aria-label="Maç durumu" className="grid w-full grid-cols-3 gap-1 rounded-lg border border-border bg-card p-1 @md:flex @md:w-auto">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.id}
                  onClick={() => {
                    setChosen(t.id)
                    setSaved(false)
                  }}
                  className={cn(
                    'flex h-9 min-w-0 items-center justify-center gap-1.5 rounded-md px-2 text-xs font-bold transition-colors @md:shrink-0 @md:px-3',
                    tab === t.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <span className="truncate @md:hidden" aria-hidden="true">
                    {t.short}
                  </span>
                  <span className="sr-only @md:not-sr-only">{t.label}</span>
                  <span className={cn('tabular-nums', tab === t.id ? 'opacity-80' : 'text-foreground')}>{groups[t.id].length}</span>
                </button>
              ))}
            </div>
            {canFilter && (
              <button
                type="button"
                aria-pressed={mineOnly}
                onClick={() => setMineOnly((v) => !v)}
                className={cn('flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-colors', mineOnly ? 'border-primary text-primary' : 'border-border text-muted-foreground hover:text-foreground')}
              >
                <span className={cn('flex size-4 items-center justify-center rounded border', mineOnly ? 'border-primary bg-primary text-primary-foreground' : 'border-border')}>
                  {mineOnly && <Check className="size-3" aria-hidden="true" />}
                </span>
                Sadece tahmin yaptıklarım
              </button>
            )}
          </div>

          {saved && (
            <p role="status" className="rounded-lg bg-live/10 px-3 py-2 text-xs font-semibold text-live">
              Tahminin kaydedildi. Maç bitene kadar &quot;Sonuç bekleyen&quot; sekmesinde durur.
            </p>
          )}

          {list.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm leading-relaxed text-muted-foreground">{TABS.find((t) => t.id === tab)?.empty}</p>
          ) : (
            byDay(list, now).map((day) => (
              <section key={day.title} aria-label={day.title} className="flex flex-col gap-2">
                <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {day.title}
                  <span aria-hidden="true" className="h-px flex-1 bg-border" />
                  <span className="font-normal normal-case tracking-normal">{day.items.length} maç</span>
                </h2>
                {day.items.map((m) => (
                  <MatchRow key={m.id} m={m} state={tab} now={now} signedIn={meId !== null} onSaved={() => setSaved(true)} />
                ))}
              </section>
            ))
          )}
        </div>

        <aside className={cn('min-w-0 flex-col gap-4 @4xl:sticky @4xl:top-20', view === 'league' ? 'flex' : 'hidden @4xl:flex')}>
          <MyAwards awards={awards} />
          <Standings tables={tables} periods={periods} paid={paid} meId={meId} />
        </aside>
      </div>
    </div>
  )
}
