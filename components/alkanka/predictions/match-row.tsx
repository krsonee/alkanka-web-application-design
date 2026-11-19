'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { savePickAction } from '@/app/actions/community'
import type { LeagueMatch } from '@/lib/predictions'
import { MARKETS, answerText, ceilingText, marketList, prizeText, type Answers, type MarketId } from '@/lib/predictions-shared'
import { cn } from '@/lib/utils'
import { TeamLogo } from '../logo-context'
import { usePoints } from '../points-context'
import { StatusLine, useAction } from '../community/use-action'
import { QuestionInput, QuestionResult, layoutOrder, scoreAnswer, type ScoreDraft } from './question'

export type MatchState = 'open' | 'waiting' | 'done'

export function matchState(m: LeagueMatch, now: number): MatchState {
  if (m.settled) return 'done'
  return new Date(m.closesAt ?? m.kickoff).getTime() <= now || m.myPick ? 'waiting' : 'open'
}

const clock = new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' })
const fmt = (n: number) => n.toLocaleString('tr-TR')

function Crest({ name, src }: { name: string; src: string | null }) {
  if (!src) return <TeamLogo name={name} className="size-6 border-0" />
  return (
    <span className="flex size-6 shrink-0 items-center justify-center">
      {/* eslint-disable-next-line @next/next/no-img-element -- crests come from the fixture feed's image host */}
      <img src={src} alt="" width={24} height={24} loading="lazy" className="size-6 object-contain" />
    </span>
  )
}

function TeamLine({ name, logo, goals, lost }: { name: string; logo: string | null; goals: number | null; lost: boolean }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <Crest name={name} src={logo} />
      <span className={cn('min-w-0 flex-1 truncate text-sm font-semibold', lost ? 'text-muted-foreground' : 'text-foreground')}>{name}</span>
      {goals !== null && <span className={cn('font-display text-base font-bold tabular-nums', lost ? 'text-muted-foreground' : 'text-foreground')}>{goals}</span>}
    </span>
  )
}

/** What the lock is about to do, in the member's terms. */
function closingText(m: LeagueMatch, now: number) {
  const closes = new Date(m.closesAt ?? m.kickoff).getTime()
  const minutes = Math.floor((closes - now) / 60_000)
  if (minutes < 60) return { text: `${Math.max(1, minutes)} dk kaldı`, soon: true }
  if (m.closesAt && m.closesAt !== m.kickoff) return { text: `${clock.format(closes)} kapanır`, soon: false }
  return null
}

function earnedText(pick: NonNullable<LeagueMatch['myPick']>) {
  const parts = [pick.points ? `+${pick.points} puan` : '', pick.kc ? `${fmt(pick.kc)} KC` : '', pick.kp ? `${fmt(pick.kp)} KP` : ''].filter(Boolean)
  return parts.join(' · ')
}

type Fact = { text: string; tone?: string }

/** The one line under the teams: what is asked and what it pays, or how the member did. */
function facts(m: LeagueMatch, state: MatchState, ids: MarketId[], now: number, signedIn: boolean): Fact[] {
  const league: Fact = { text: m.league }
  if (state === 'open') {
    const closing = closingText(m, now)
    return [
      league,
      { text: `${ids.length} soru` },
      { text: `Ödül: ${ceilingText(m.set)}`, tone: 'font-semibold text-primary' },
      ...(closing ? [{ text: closing.text, tone: closing.soon ? 'font-semibold text-destructive' : undefined }] : []),
    ]
  }
  if (!m.myPick) return [league, { text: signedIn ? 'Tahmin yapmadın' : `${fmt(m.picks)} tahmin` }]
  if (state === 'waiting') {
    const teams = { home: m.home, away: m.away }
    return [
      league,
      { text: 'Tahminin alındı', tone: 'font-semibold text-live' },
      { text: ids.map((id) => `${MARKETS[id].short} ${answerText(id, m.myPick?.answers[id], teams, m.set.markets[id])}`).join(', ') },
    ]
  }
  const earned = earnedText(m.myPick)
  const hits = ids.filter((id) => m.myPick?.outcomes?.[id] === 'hit').length
  const counted = ids.filter((id) => m.myPick?.outcomes?.[id] !== 'void').length
  return [
    league,
    { text: earned || 'Tutmadı', tone: earned ? 'font-semibold text-success' : undefined },
    { text: `${hits}/${counted} doğru${m.myPick.bonus ? ', bonus' : ''}` },
  ]
}

export function MatchRow({
  m,
  state,
  now,
  signedIn,
  onSaved,
  defaultOpen = false,
}: {
  m: LeagueMatch
  state: MatchState
  now: number
  signedIn: boolean
  onSaved: () => void
  defaultOpen?: boolean
}) {
  const root = useRef<HTMLElement>(null)
  useEffect(() => {
    if (defaultOpen) root.current?.scrollIntoView({ block: 'center' })
  }, [defaultOpen])
  const { requireLogin } = usePoints()
  const { pending, status, run } = useAction()
  const [open, setOpen] = useState(defaultOpen)
  const [picks, setPicks] = useState<Answers>({})
  const [score, setScore] = useState<ScoreDraft>({ home: null, away: null })
  const panelId = useId()
  const ids = marketList(m.set)
  const teams = { home: m.home, away: m.away }
  const answers: Answers = { ...picks, score: scoreAnswer(score) }
  const answered = ids.filter((id) => answers[id]).length
  const bonus = m.set.bonus
  const bonusText = bonus ? [bonus.pts ? `${bonus.pts} puan` : '', prizeText(bonus.prize)].filter(Boolean).join(' + ') : ''
  const homeLost = m.settled && m.homeGoals !== null && m.awayGoals !== null && m.homeGoals < m.awayGoals
  const awayLost = m.settled && m.homeGoals !== null && m.awayGoals !== null && m.awayGoals < m.homeGoals

  return (
    <article ref={root} className={cn('overflow-hidden rounded-xl border bg-card transition-colors', open ? 'border-primary/40' : 'border-border')}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full flex-col gap-2 p-3 text-left @2xl:px-4"
      >
        <span className="flex items-center gap-3">
          <span className="w-11 shrink-0 font-display text-sm font-bold tabular-nums text-foreground">{state === 'done' ? 'Bitti' : clock.format(new Date(m.kickoff))}</span>
          <span className="flex min-w-0 flex-1 flex-col gap-1.5">
            <TeamLine name={m.home} logo={m.homeLogo} goals={m.settled ? m.homeGoals : null} lost={homeLost} />
            <TeamLine name={m.away} logo={m.awayLogo} goals={m.settled ? m.awayGoals : null} lost={awayLost} />
          </span>
          {state === 'open' ? (
            <span className="flex h-9 min-w-9 shrink-0 items-center justify-center gap-1 rounded-lg bg-primary px-2.5 text-xs font-bold text-primary-foreground @xs:px-3">
              <span className="sr-only @xs:not-sr-only">{open ? 'Kapat' : 'Tahmin yap'}</span>
              <ChevronDown className={cn('size-3.5 transition-transform', open && 'rotate-180')} aria-hidden="true" />
            </span>
          ) : (
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground">
              <ChevronDown className={cn('size-4 transition-transform', open && 'rotate-180')} aria-hidden="true" />
              <span className="sr-only">{open ? 'Ayrıntıyı kapat' : 'Ayrıntıyı aç'}</span>
            </span>
          )}
        </span>
        <span className="block pl-14 text-xs text-muted-foreground">
          {/* Each fact carries its separator in its own left padding; the clip hides it wherever a line starts. */}
          <span className="block overflow-hidden">
            <span className="-ml-3 flex flex-wrap gap-y-0.5">
              {facts(m, state, ids, now, signedIn).map((f, i) => (
                <span key={i} className="relative min-w-0 pl-3 before:absolute before:left-1 before:text-muted-foreground before:content-['·']">
                  <span className={cn('break-words', f.tone)}>{f.text}</span>
                </span>
              ))}
            </span>
          </span>
        </span>
      </button>

      {open && state === 'open' && (
        <div id={panelId} className="flex flex-col gap-4 border-t border-border p-3 @2xl:p-4">
          <div className="grid gap-x-6 gap-y-4 @2xl:grid-cols-2">
            {layoutOrder(ids).map((id) => (
              <QuestionInput
                key={id}
                id={id}
                rule={m.set.markets[id]!}
                teams={teams}
                value={picks[id]}
                score={score}
                disabled={pending}
                onPick={(value) => setPicks((p) => ({ ...p, [id]: value }))}
                onScore={setScore}
              />
            ))}
          </div>
          {bonusText && (
            <p className="rounded-lg bg-primary/10 px-3 py-2 text-xs leading-relaxed text-foreground">
              Bütün soruları bilirsen ek olarak <b className="text-primary">{bonusText}</b> kazanırsın.
            </p>
          )}
          <div className="flex flex-col gap-2 @md:flex-row @md:items-center @md:justify-between @md:gap-4">
            <p className="text-xs leading-relaxed text-muted-foreground" aria-live="polite">
              {answered}/{ids.length} soru cevaplandı. Tahmin bir kez yapılır, kaydettikten sonra değişmez.
            </p>
            <button
              type="button"
              disabled={pending || answered < ids.length}
              onClick={() => requireLogin() && run(() => savePickAction(m.id, answers), onSaved)}
              className="h-11 shrink-0 rounded-lg bg-primary px-6 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:bg-primary/15 disabled:text-primary"
            >
              {pending ? 'Kaydediliyor...' : 'Tahmini kaydet'}
            </button>
          </div>
          <StatusLine status={status} />
        </div>
      )}

      {open && state !== 'open' && (
        <div id={panelId} className="flex flex-col gap-4 border-t border-border p-3 @2xl:p-4">
          <div className="grid gap-x-6 gap-y-4 @2xl:grid-cols-2">
            {layoutOrder(ids).map((id) => (
              <QuestionResult
                key={id}
                id={id}
                rule={m.set.markets[id]!}
                teams={teams}
                mine={m.myPick?.answers[id]}
                crowd={m.crowd?.[id]}
                result={m.result}
                outcome={m.myPick?.outcomes?.[id]}
              />
            ))}
          </div>
          {state === 'done' && m.myPick?.bonus && bonusText && (
            <p className="rounded-lg bg-success/10 px-3 py-2 text-xs leading-relaxed text-foreground">
              Bütün soruları bildin: <b className="text-success">{bonusText}</b> bonus kazandın.
            </p>
          )}
          <p className="text-xs leading-relaxed text-muted-foreground">
            {fmt(m.picks)} kişi tahmin yaptı.
            {state === 'waiting' ? ' Maç bitip sonuç girilince puanlar ve ödüller kendiliğinden yazılır.' : ''}
            {state === 'done' && ids.some((id) => m.myPick?.outcomes?.[id] === 'void') ? ` İptal edilen sorular puanlanmadı: ${ids.filter((id) => m.myPick?.outcomes?.[id] === 'void').map((id) => MARKETS[id].label).join(', ')}.` : ''}
          </p>
        </div>
      )}
    </article>
  )
}
