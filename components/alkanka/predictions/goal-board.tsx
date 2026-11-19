'use client'

import { useEffect, useId, useState } from 'react'
import { Check } from 'lucide-react'
import { pickGoalSideAction } from '@/app/actions/community'
import {
  GOAL_APPROVAL_LABEL,
  GOAL_CATEGORIES,
  goalAmount,
  goalConditions,
  goalReward,
  goalStatusLabel,
  type GoalCategory,
  type GoalEventView,
  type GoalMatch,
  type GoalSide,
} from '@/lib/goal-rewards-shared'
import { cn } from '@/lib/utils'
import { TeamLogo } from '../logo-context'
import { StatusLine, useAction } from '../community/use-action'

const when = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' })
const fmt = (n: number) => n.toLocaleString('tr-TR')

function Crest({ name, src }: { name: string; src: string | null }) {
  if (!src) return <TeamLogo name={name} className="size-7 border-0" />
  return (
    <span className="flex size-7 shrink-0 items-center justify-center">
      {/* eslint-disable-next-line @next/next/no-img-element -- crests come from the fixture feed's image host */}
      <img src={src} alt="" width={28} height={28} loading="lazy" className="size-7 object-contain" />
    </span>
  )
}

/** How the member's pick turned out, in one sentence. */
function outcome(event: GoalEventView, m: GoalMatch): { text: string; tone: 'good' | 'plain' | 'bad' } | null {
  const pick = m.myPick
  if (!pick) return null
  const team = pick.side === 'home' ? m.home : m.away
  if (m.status === 'void') return { text: `Seçimin ${team} idi. Maç iptal edildi, ödül verilmez.`, tone: 'plain' }
  if (m.status !== 'settled' || pick.reward === null) {
    return { text: `Seçimin: ${team}. Attığı her gol ${goalAmount(m.perGoal, event.unit)} kazandırır.`, tone: 'plain' }
  }
  if (pick.reward === 0) return { text: `${team} gol atamadı, bu maçtan ödül çıkmadı.`, tone: 'plain' }
  const earned = `${team} ${pick.goals} gol attı: ${goalAmount(pick.reward, event.unit)}`
  if (event.category !== 'sponsor') return { text: pick.paid ? `${earned} hesabına yatırıldı.` : `${earned} kazandın, birazdan hesabına yatar.`, tone: 'good' }
  if (pick.paid) return { text: `${earned} sponsor hesabına tanımlandı.`, tone: 'good' }
  if (pick.approval === 'rejected') return { text: `${earned} hak edilecekti, ancak katılım şartı sağlanmadığı için verilmedi.`, tone: 'bad' }
  return { text: `${earned} hak ettin. ${pick.approval === 'approved' ? 'Şart onaylandı, ödül tanımlanmayı bekliyor.' : 'Katılım şartın kontrol ediliyor.'}`, tone: 'good' }
}

function SideButton({
  side,
  m,
  chosen,
  locked,
  onChoose,
}: {
  side: GoalSide
  m: GoalMatch
  chosen: boolean
  locked: boolean
  onChoose: () => void
}) {
  const home = side === 'home'
  const name = home ? m.home : m.away
  const goals = home ? m.homeGoals : m.awayGoals
  const picks = home ? m.homePicks : m.awayPicks
  return (
    <button
      type="button"
      role="radio"
      aria-checked={chosen}
      disabled={locked}
      onClick={onChoose}
      className={cn(
        'flex min-h-14 min-w-0 items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors',
        chosen ? 'border-primary bg-primary/10' : 'border-border bg-background',
        !locked && !chosen && 'hover:border-primary/60',
        locked && !chosen && 'opacity-70',
      )}
    >
      <Crest name={name} src={home ? m.homeLogo : m.awayLogo} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-semibold text-foreground">{name}</span>
        <span className="text-xs text-muted-foreground">{fmt(picks)} seçim</span>
      </span>
      {goals !== null && <span className="font-display text-xl font-bold tabular-nums text-foreground">{goals}</span>}
      {chosen && goals === null && <Check className="size-4 shrink-0 text-primary" aria-hidden="true" />}
    </button>
  )
}

function MatchCard({ event, m, now }: { event: GoalEventView; m: GoalMatch; now: number }) {
  const { pending, status, run } = useAction()
  const [side, setSide] = useState<GoalSide | null>(null)
  const [username, setUsername] = useState('')
  const fieldId = useId()
  const sponsor = event.category === 'sponsor'
  const open = m.status === 'open' && Date.parse(m.kickoff) > now && !m.myPick
  const result = outcome(event, m)
  const team = side === 'home' ? m.home : side === 'away' ? m.away : null
  const ready = side !== null && (!sponsor || username.trim().length >= 2)

  return (
    <article className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 @2xl:p-4">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        {m.league && <span>{m.league}</span>}
        <time dateTime={m.kickoff}>{when.format(new Date(m.kickoff))}</time>
        <span className={cn('font-semibold', m.status === 'void' ? 'text-destructive' : open ? 'text-primary' : 'text-foreground')}>{goalStatusLabel(m, now)}</span>
      </p>

      <div role="radiogroup" aria-label={`${m.home} - ${m.away}: takımını seç`} className="grid gap-2 @md:grid-cols-2">
        {(['home', 'away'] as const).map((s) => (
          <SideButton key={s} side={s} m={m} chosen={(m.myPick?.side ?? side) === s} locked={!open || pending} onChoose={() => setSide(s)} />
        ))}
      </div>

      {open && side && (
        <div className="flex flex-col gap-3 rounded-lg bg-secondary/60 p-3">
          <p className="text-xs leading-relaxed text-foreground">
            <b>{team}</b> seçersen attığı her gol <b className="text-primary">{goalAmount(m.perGoal, event.unit)}</b> kazandırır; örneğin 3 gol atarsa {goalAmount(goalReward(m.perGoal, 3), event.unit)}. Seçim bir kez yapılır,
            kaydettikten sonra değişmez.
          </p>
          {sponsor && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor={fieldId} className="text-xs font-semibold text-foreground">
                {event.siteName ?? 'Sponsor'} sitesindeki kullanıcı adın
              </label>
              <input
                id={fieldId}
                value={username}
                maxLength={60}
                autoComplete="off"
                onChange={(e) => setUsername(e.target.value)}
                className="h-11 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
              />
              <span className="text-xs text-muted-foreground">Ödül bu hesaba tanımlanır; yanlış yazılan hesaba ödül gönderilemez.</span>
            </div>
          )}
          <button
            type="button"
            disabled={pending || !ready}
            onClick={() => run(() => pickGoalSideAction(m.id, side, username))}
            className="h-11 self-start rounded-lg bg-primary px-6 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {pending ? 'Kaydediliyor...' : `${team} seçimini kaydet`}
          </button>
        </div>
      )}

      {result && (
        <p
          className={cn(
            'rounded-lg px-3 py-2 text-xs leading-relaxed',
            result.tone === 'good' ? 'bg-success/10 text-foreground' : result.tone === 'bad' ? 'bg-destructive/10 text-foreground' : 'bg-secondary/60 text-muted-foreground',
          )}
        >
          {result.text}
          {sponsor && m.myPick?.siteUsername && m.status !== 'void' ? ` Kullanıcı adın: ${m.myPick.siteUsername}. ${m.status === 'settled' ? '' : GOAL_APPROVAL_LABEL[m.myPick.approval] + '.'}` : ''}
        </p>
      )}
      {!result && !open && m.status === 'open' && <p className="text-xs text-muted-foreground">Seçimler maç başlarken kapandı. Sonuç girilince ödüller dağıtılır.</p>}
      <StatusLine status={status} />
    </article>
  )
}

function EventBlock({ event, now }: { event: GoalEventView; now: number }) {
  const conditions = goalConditions(event)
  const sponsor = event.category === 'sponsor'
  return (
    <section aria-label={event.title} className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h3 className="font-display text-lg font-bold text-foreground text-balance">{event.title}</h3>
          <p className="text-sm text-muted-foreground">
            Gol başı <b className="font-display text-base text-primary">{goalAmount(event.perGoal, event.unit)}</b>
            {sponsor && event.siteName ? ` · ${event.siteName}` : ''}
          </p>
        </div>
        {conditions.length > 0 && (
          <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-card px-3 py-2.5">
            <p className="text-xs font-bold text-foreground">{sponsor ? 'Katılım şartı' : 'Kurallar'}</p>
            <ul className="flex list-disc flex-col gap-1 pl-4 text-xs leading-relaxed text-muted-foreground">
              {conditions.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            {sponsor && <p className="text-xs leading-relaxed text-muted-foreground">Ödülü sponsor verir. Şartı sağladığın onaylanınca sponsor hesabına tanımlanır; Alkanka hesabına KC olarak yatmaz.</p>}
          </div>
        )}
      </div>
      <div className="grid items-start gap-3 @4xl:grid-cols-2">
        {event.matches.map((m) => (
          <MatchCard key={m.id} event={event} m={m} now={now} />
        ))}
      </div>
    </section>
  )
}

export function GoalBoard({
  events,
  serverNow,
  sponsorNote,
}: {
  events: GoalEventView[]
  serverNow: number
  /** Why sponsor events are not shown to this visitor, when they are held back. */
  sponsorNote: string | null
}) {
  const [now, setNow] = useState(serverNow)
  useEffect(() => {
    setNow(Date.now())
    const t = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])

  const has = (c: GoalCategory) => events.some((e) => e.category === c)
  const shown = GOAL_CATEGORIES.filter((c) => has(c.id) || (c.id === 'sponsor' && sponsorNote))
  const [chosen, setChosen] = useState<GoalCategory | null>(null)
  if (shown.length === 0) return null
  const category = chosen && shown.some((c) => c.id === chosen) ? chosen : shown[0].id
  const list = events.filter((e) => e.category === category)

  return (
    <section aria-labelledby="gol-basi-odul" className="@container mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-6">
      <div className="flex flex-col gap-1">
        <h2 id="gol-basi-odul" className="font-display text-xl font-bold text-foreground text-balance">
          Gol başı ödül
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground text-pretty">Takımını seç, maçta attığı her gol için ödül kazan. Skoru bilmen gerekmez; takımın ne kadar çok gol atarsa o kadar kazanırsın.</p>
      </div>

      {shown.length > 1 && (
        <div role="tablist" aria-label="Etkinlik türü" className="grid grid-cols-2 gap-1 self-start rounded-lg border border-border bg-card p-1">
          {shown.map((c) => (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={category === c.id}
              onClick={() => setChosen(c.id)}
              className={cn('h-10 rounded-md px-4 text-sm font-bold transition-colors', category === c.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground">{GOAL_CATEGORIES.find((c) => c.id === category)?.hint}</p>

      {category === 'sponsor' && sponsorNote ? (
        <p className="rounded-xl border border-border bg-card p-4 text-sm leading-relaxed text-muted-foreground">{sponsorNote}</p>
      ) : (
        <div className="flex flex-col gap-8">
          {list.map((e) => (
            <EventBlock key={e.id} event={e} now={now} />
          ))}
        </div>
      )}
    </section>
  )
}
