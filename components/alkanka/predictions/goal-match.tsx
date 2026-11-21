'use client'

import { useId, useState } from 'react'
import { Check, CircleDashed, Ticket } from 'lucide-react'
import { pickGoalSideAction, submitGoalCouponAction } from '@/app/actions/community'
import { usePoints } from '@/components/alkanka/points-context'
import {
  GOAL_KC_UNIT,
  checkCoupon,
  goalAmount,
  goalReward,
  goalRuleProgress,
  goalRuleText,
  goalRulesMet,
  goalStatusLabel,
  type GoalEventView,
  type GoalMatch,
  type GoalSide,
} from '@/lib/goal-rewards-shared'
import { TR_TZ, trDay } from '@/lib/tr-time'
import { cn } from '@/lib/utils'
import { TeamLogo } from '../logo-context'
import { StatusLine, useAction } from '../community/use-action'

const when = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: TR_TZ })
const dayName = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', timeZone: TR_TZ })
const fmt = (n: number) => n.toLocaleString('tr-TR')

type Outcome = { text: string; tone: 'good' | 'plain' | 'bad' }

function Crest({ name, src }: { name: string; src: string | null }) {
  if (!src) return <TeamLogo name={name} className="size-7 border-0" />
  return (
    <span className="flex size-7 shrink-0 items-center justify-center">
      {/* eslint-disable-next-line @next/next/no-img-element -- crests come from the fixture feed's image host */}
      <img src={src} alt="" width={28} height={28} loading="lazy" className="size-7 object-contain" />
    </span>
  )
}

function MatchHead({ m, now, open }: { m: GoalMatch; now: number; open: boolean }) {
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
      <span
        className={cn(
          'rounded-full px-2 py-0.5 font-semibold',
          m.status === 'void' ? 'bg-destructive/15 text-destructive' : open ? 'bg-primary/15 text-primary' : m.status === 'settled' ? 'bg-secondary text-foreground' : 'bg-secondary text-foreground/80',
        )}
      >
        {goalStatusLabel(m, now)}
      </span>
      <time dateTime={m.kickoff} className="font-semibold text-foreground">
        {when.format(new Date(m.kickoff))}
      </time>
      {m.league && <span className="truncate">{m.league}</span>}
    </p>
  )
}

function OutcomeLine({ outcome }: { outcome: Outcome }) {
  return (
    <p className={cn('rounded-lg px-3 py-2 text-xs leading-relaxed', outcome.tone === 'good' ? 'bg-success/10 text-foreground' : outcome.tone === 'bad' ? 'bg-destructive/10 text-foreground' : 'bg-secondary/60 text-muted-foreground')}>
      {outcome.text}
    </p>
  )
}

// --- Alkanka: back a team --------------------------------------------------

/** How the member's team pick turned out, in one sentence. */
function teamOutcome(event: GoalEventView, m: GoalMatch): Outcome | null {
  const pick = m.myPick
  if (!pick) return null
  const team = pick.side === 'home' ? m.home : m.away
  if (m.status === 'void') {
    const fee = pick.fee > 0 ? (pick.feeRefunded ? ` ${goalAmount(pick.fee, GOAL_KC_UNIT)} katılım ücretin geri yatırıldı.` : ` ${goalAmount(pick.fee, GOAL_KC_UNIT)} katılım ücretin birazdan geri yatar.`) : ''
    return { text: `Seçimin ${team} idi. Maç iptal edildi, ödül verilmez.${fee}`, tone: 'plain' }
  }
  if (m.status !== 'settled' || pick.reward === null) return { text: `Seçimin: ${team}. Attığı her gol ${goalAmount(m.perGoal, event.unit)} kazandırır.`, tone: 'plain' }
  if (pick.reward === 0) return { text: `${team} gol atamadı, bu maçtan ödül çıkmadı.`, tone: 'plain' }
  const earned = `${team} ${pick.goals} gol attı: ${goalAmount(pick.reward, event.unit)}`
  if (pick.paid) return { text: `${earned} hesabına yatırıldı.`, tone: 'good' }
  if (pick.approval === 'rejected') return { text: `${earned} kazanılacaktı, ancak etkinliğin şartı maç günü tamamlanmadığı için verilmedi.`, tone: 'bad' }
  if (event.rules.length > 0 && pick.approval === 'pending') return { text: `${earned} kazandın. Aşağıdaki şartı gün bitmeden tamamladığında hesabına yatar.`, tone: 'good' }
  return { text: `${earned} kazandın, birazdan hesabına yatar.`, tone: 'good' }
}

/** Where the member stands on the event's conditions for this match's day. */
function Conditions({ event, m, now }: { event: GoalEventView; m: GoalMatch; now: number }) {
  const pick = m.myPick
  if (!pick || event.rules.length === 0 || m.status === 'void' || pick.paid || pick.approval === 'rejected' || pick.reward === 0) return null
  const matchDay = trDay(m.kickoff)
  const today = trDay(now)
  const done = pick.progress ?? event.rules.map(() => 0)
  const met = goalRulesMet(event.rules, event.ruleMode, done)
  const title =
    today < matchDay
      ? `Şart maç günü sayılır: ${dayName.format(new Date(m.kickoff))} (Türkiye saatiyle 00:00 - 23:59)`
      : met
        ? 'Şart tamamlandı'
        : today === matchDay
          ? `Bugün tamamlanacak şart${event.rules.length > 1 ? (event.ruleMode === 'any' ? 'lar (biri yeter)' : 'lar (hepsi)') : ''}`
          : 'Maç günü şartı'
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-background px-3 py-2.5">
      <p className={cn('text-xs font-bold', met ? 'text-success' : 'text-foreground')}>{title}</p>
      <ul className="flex flex-col gap-2">
        {event.rules.map((r, i) => {
          const have = Math.min(done[i] ?? 0, r.amount)
          const ok = have >= r.amount
          return (
            <li key={`${r.kind}-${r.game}`} className="flex flex-col gap-1">
              <span className="flex items-start gap-1.5 text-xs leading-relaxed text-foreground">
                {ok ? <Check className="mt-0.5 size-3.5 shrink-0 text-success" aria-hidden="true" /> : <CircleDashed className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />}
                <span className="min-w-0 flex-1">{goalRuleText(r)}</span>
                <span className={cn('shrink-0 font-semibold tabular-nums', ok ? 'text-success' : 'text-muted-foreground')}>{goalRuleProgress(r, have)}</span>
              </span>
              <span className="h-1.5 overflow-hidden rounded-full bg-secondary" aria-hidden="true">
                <span className={cn('block h-full rounded-full', ok ? 'bg-success' : 'bg-primary')} style={{ width: `${Math.round((have / r.amount) * 100)}%` }} />
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function SideButton({ side, m, chosen, locked, onChoose }: { side: GoalSide; m: GoalMatch; chosen: boolean; locked: boolean; onChoose: () => void }) {
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

export function TeamMatchCard({ event, m, now }: { event: GoalEventView; m: GoalMatch; now: number }) {
  const { pending, status, run } = useAction()
  const { setBalance, refresh } = usePoints()
  const [side, setSide] = useState<GoalSide | null>(null)
  const open = m.status === 'open' && Date.parse(m.kickoff) > now && !m.myPick
  const result = teamOutcome(event, m)
  const team = side === 'home' ? m.home : side === 'away' ? m.away : null
  const fee = event.entryFee

  return (
    <article className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 @2xl:p-4">
      <MatchHead m={m} now={now} open={open} />

      <div role="radiogroup" aria-label={`${m.home} - ${m.away}: takımını seç`} className="grid gap-2 @md:grid-cols-2">
        {(['home', 'away'] as const).map((s) => (
          <SideButton key={s} side={s} m={m} chosen={(m.myPick?.side ?? side) === s} locked={!open || pending} onChoose={() => setSide(s)} />
        ))}
      </div>
      {open && !side && <p className="text-xs text-muted-foreground">Katılmak için takımını seç.</p>}

      {open && side && (
        <div className="flex flex-col gap-3 rounded-lg bg-secondary/60 p-3">
          <p className="text-xs leading-relaxed text-foreground">
            <b>{team}</b> seçersen attığı her gol <b className="text-primary">{goalAmount(m.perGoal, event.unit)}</b> kazandırır; örneğin 3 gol atarsa {goalAmount(goalReward(m.perGoal, 3), event.unit)}.
            {fee > 0 && (
              <>
                {' '}
                Kaydettiğinde <b>{goalAmount(fee, GOAL_KC_UNIT)}</b> katılım ücreti bakiyenden düşer.
              </>
            )}{' '}
            Seçim bir kez yapılır, kaydettikten sonra değişmez.
          </p>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => pickGoalSideAction(m.id, side), (r) => (r.balance === undefined ? refresh() : setBalance(r.balance)))}
            className="h-11 self-start rounded-lg bg-primary px-6 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {pending ? 'Kaydediliyor...' : fee > 0 ? `${team} seçimini kaydet (${goalAmount(fee, GOAL_KC_UNIT)})` : `${team} seçimini kaydet`}
          </button>
        </div>
      )}

      {result && <OutcomeLine outcome={result} />}
      <Conditions event={event} m={m} now={now} />
      {!result && !open && m.status === 'open' && <p className="text-xs text-muted-foreground">Seçimler maç başlarken kapandı. Sonuç girilince ödüller dağıtılır.</p>}
      <StatusLine status={status} />
    </article>
  )
}

// --- Sponsor: hand in the coupon -------------------------------------------

/** How the member's coupon turned out, in one sentence. */
function couponOutcome(event: GoalEventView, m: GoalMatch): Outcome | null {
  const pick = m.myPick
  if (!pick) return null
  const each = goalAmount(m.perGoal, event.unit)
  const coupon = pick.coupon ? `Kupon numaran: ${pick.coupon}. ` : ''
  if (m.status === 'void') return { text: `${coupon}Maç iptal edildi, ödül verilmez.`, tone: 'plain' }
  if (pick.approval === 'rejected') return { text: `${coupon}Talebin geçersiz sayıldı${pick.rejectReason ? `: ${pick.rejectReason}` : ''}. Bu maçtan ödül verilmez.`, tone: 'bad' }
  if (m.status !== 'settled' || pick.reward === null) {
    return pick.approval === 'approved'
      ? { text: `${coupon}Kuponun geçerli sayıldı. Maçta atılan her gol ${each} kazandırır.`, tone: 'good' }
      : { text: `${coupon}Kuponun kontrol edilecek; geçerliyse maçta atılan her gol ${each} kazandırır.`, tone: 'plain' }
  }
  if (pick.reward === 0) return { text: `${coupon}Maçta gol olmadı, ödül çıkmadı.`, tone: 'plain' }
  const earned = `Maçta ${pick.goals} gol oldu: ${goalAmount(pick.reward, event.unit)}`
  if (pick.paid) return { text: `${earned} ${event.siteName ?? 'sponsor'} hesabına tanımlandı.`, tone: 'good' }
  if (pick.approval === 'approved') return { text: `${earned} hak ettin. Ödül ${event.siteName ?? 'sponsor'} hesabına tanımlanmayı bekliyor.`, tone: 'good' }
  return { text: `${coupon}${earned} hak edebilirsin; kuponun kontrol ediliyor.`, tone: 'plain' }
}

function TeamLine({ name, logo, goals }: { name: string; logo: string | null; goals: number | null }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <Crest name={name} src={logo} />
      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{name}</span>
      {goals !== null && <span className="font-display text-xl font-bold tabular-nums text-foreground">{goals}</span>}
    </span>
  )
}

/**
 * `account` is the sponsor username the member linked; `blocked` says staff closed their participation.
 * Without an account the card explains what is missing instead of offering a form that cannot work.
 */
export function CouponMatchCard({ event, m, now, account, blocked }: { event: GoalEventView; m: GoalMatch; now: number; account: string | null; blocked: boolean }) {
  const { pending, status, run } = useAction()
  const [coupon, setCoupon] = useState('')
  const [editing, setEditing] = useState(false)
  const fieldId = useId()
  const pick = m.myPick
  const running = m.status === 'open' && Date.parse(m.kickoff) > now
  const canEnter = running && !blocked && account !== null && (!pick || (pick.approval === 'pending' && editing))
  const canFix = running && !blocked && account !== null && pick?.approval === 'pending' && !editing
  const result = couponOutcome(event, m)
  const checked = checkCoupon(coupon)

  return (
    <article className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 @2xl:p-4">
      <MatchHead m={m} now={now} open={running && !pick} />

      <div className="flex flex-col gap-2 rounded-lg border border-border bg-background px-3 py-2.5">
        <TeamLine name={m.home} logo={m.homeLogo} goals={m.homeGoals} />
        <TeamLine name={m.away} logo={m.awayLogo} goals={m.awayGoals} />
      </div>
      <p className="text-xs text-muted-foreground">
        Her gol <b className="text-primary">{goalAmount(m.perGoal, event.unit)}</b> · {fmt(m.picks)} katılım
      </p>

      {canEnter && (
        <form
          className="flex flex-col gap-2 rounded-lg bg-secondary/60 p-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (!checked.ok) return
            run(
              () => submitGoalCouponAction(m.id, checked.value),
              () => {
                setCoupon('')
                setEditing(false)
              },
            )
          }}
        >
          <label htmlFor={fieldId} className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Ticket className="size-3.5 text-primary" aria-hidden="true" />
            Kupon numarası
          </label>
          <div className="flex flex-wrap gap-2">
            <input
              id={fieldId}
              value={coupon}
              maxLength={40}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder={`${event.siteName ?? 'Sponsor'} kupon numaran`}
              onChange={(e) => setCoupon(e.target.value)}
              className="h-11 min-w-0 flex-1 basis-44 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
            />
            <button type="submit" disabled={pending || !checked.ok} className="h-11 rounded-lg bg-primary px-5 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40">
              {pending ? 'Kaydediliyor...' : pick ? 'Kuponu güncelle' : 'Talebi gönder'}
            </button>
          </div>
          <span className="text-xs leading-relaxed text-muted-foreground">
            Talebine <b className="text-foreground">{account}</b> kullanıcı adın eklenir. Kupon bu maça, maç başlamadan önce alınmış olmalı.
          </span>
        </form>
      )}

      {result && <OutcomeLine outcome={result} />}
      {canFix && (
        <button type="button" onClick={() => setEditing(true)} className="self-start text-xs font-semibold text-primary underline-offset-2 hover:underline">
          Kupon numarasını yanlış yazdım, düzelt
        </button>
      )}
      {!pick && running && account === null && !blocked && <p className="text-xs leading-relaxed text-muted-foreground">Kupon numarası girebilmek için önce yukarıdan {event.siteName ?? 'sponsor'} hesabını bağla.</p>}
      {!pick && !running && m.status === 'open' && <p className="text-xs text-muted-foreground">Kupon girişi maç başlarken kapandı.</p>}
      <StatusLine status={status} />
    </article>
  )
}
