'use client'

import { useId, useState } from 'react'
import { Check, ChevronDown, CircleDashed, Lock, Ticket } from 'lucide-react'
import { joinGoalMatchAction, submitGoalCouponAction } from '@/app/actions/community'
import { usePoints } from '@/components/alkanka/points-context'
import {
  GOAL_KC_UNIT,
  GOAL_NO_RULE,
  checkCoupon,
  goalAmount,
  goalReward,
  goalRuleProgress,
  goalRuleText,
  goalRulesMet,
  goalStatusLabel,
  type GoalEventView,
  type GoalMatch,
} from '@/lib/goal-rewards-shared'
import { TR_TZ, trDay } from '@/lib/tr-time'
import { cn } from '@/lib/utils'
import { TeamLogo } from '../logo-context'
import { StatusLine, useAction } from '../community/use-action'

const when = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: TR_TZ })
const dayName = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', timeZone: TR_TZ })
const fmt = (n: number) => n.toLocaleString('tr-TR')

const matchCard = 'flex flex-col gap-2.5 rounded-xl border border-border bg-card p-3 shadow-[inset_0_1px_0_0_oklch(1_0_0/0.04)] @2xl:p-3.5'
const matchMeta = 'text-xs text-muted-foreground'
const smallAction = 'flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-bold transition-[opacity,scale] duration-150 active:scale-[0.97]'

type Outcome = { text: string; tone: 'good' | 'plain' | 'bad' }

function Crest({ name, src }: { name: string; src: string | null }) {
  if (!src) return <TeamLogo name={name} className="size-6 border-0" />
  return (
    <span className="flex size-6 shrink-0 items-center justify-center">
      {/* eslint-disable-next-line @next/next/no-img-element -- crests come from the fixture feed's image host */}
      <img src={src} alt="" width={24} height={24} loading="lazy" className="size-6 object-contain" />
    </span>
  )
}

/** `label` replaces the usual status where it would mislead: a match nobody can join yet is not "open". */
function MatchHead({ m, now, open, label }: { m: GoalMatch; now: number; open: boolean; label?: string }) {
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
      <span
        className={cn(
          'rounded-full px-2 py-0.5 font-semibold',
          m.status === 'void' ? 'bg-destructive/15 text-destructive' : open ? 'bg-primary/15 text-primary' : m.status === 'settled' ? 'bg-secondary text-foreground' : 'bg-secondary text-foreground/80',
        )}
      >
        {label ?? goalStatusLabel(m, now)}
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

// --- Alkanka: join the match, meet the condition ---------------------------

/**
 * How the member's entry turned out, in one sentence. Entries saved while these events still asked
 * for a team keep naming it, because they are paid for that team's goals.
 */
function entryOutcome(event: GoalEventView, m: GoalMatch): Outcome | null {
  const pick = m.myPick
  if (!pick) return null
  const team = pick.side === 'home' ? m.home : pick.side === 'away' ? m.away : null
  const each = goalAmount(m.perGoal, event.unit)
  if (m.status === 'void') {
    const fee = pick.fee > 0 ? (pick.feeRefunded ? ` ${goalAmount(pick.fee, GOAL_KC_UNIT)} katılım ücretin geri yatırıldı.` : ` ${goalAmount(pick.fee, GOAL_KC_UNIT)} katılım ücretin birazdan geri yatar.`) : ''
    return { text: `Maç iptal edildi, ödül verilmez.${fee}`, tone: 'plain' }
  }
  if (m.status !== 'settled' || pick.reward === null) {
    return { text: team ? `Seçimin: ${team}. Attığı her gol ${each} kazandırır.` : `Maça katıldın. Maçta atılan her gol ${each} kazandırır.`, tone: 'plain' }
  }
  if (pick.reward === 0) return { text: team ? `${team} gol atamadı, bu maçtan ödül çıkmadı.` : 'Maçta gol olmadı, bu maçtan ödül çıkmadı.', tone: 'plain' }
  const earned = `${team ? `${team} ${pick.goals} gol attı` : `Maçta ${pick.goals} gol oldu`}: ${goalAmount(pick.reward, event.unit)}`
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

/** What the event asks for, shown before joining so nobody pays a fee for a condition they did not read. */
function RuleList({ event, m }: { event: GoalEventView; m: GoalMatch }) {
  const many = event.rules.length > 1
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-bold text-foreground">
        Ödül için {dayName.format(new Date(m.kickoff))} günü Alkanka&apos;da {many ? (event.ruleMode === 'any' ? 'bunlardan birini yap' : 'bunların hepsini yap') : 'bunu yap'}
      </p>
      <ul className="flex flex-col gap-1.5">
        {event.rules.map((r) => (
          <li key={`${r.kind}-${r.game}`} className="flex items-start gap-1.5 text-xs leading-relaxed text-foreground">
            <CircleDashed className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden="true" />
            {goalRuleText(r)}
          </li>
        ))}
      </ul>
      <p className="text-xs leading-relaxed text-muted-foreground">Sistem kendisi sayar, bir şey göndermen gerekmez. Gün Türkiye saatiyle 00:00 - 23:59 arasıdır.</p>
    </div>
  )
}

export function JoinMatchCard({ event, m, now }: { event: GoalEventView; m: GoalMatch; now: number }) {
  const { pending, status, run } = useAction()
  const { setBalance, refresh } = usePoints()
  const running = m.status === 'open' && Date.parse(m.kickoff) > now
  const open = running && !m.myPick
  const ready = event.rules.length > 0
  const result = entryOutcome(event, m)
  const fee = event.entryFee

  return (
    <article className={matchCard}>
      <MatchHead m={m} now={now} open={open && ready} label={open && !ready ? 'Şart bekleniyor' : undefined} />

      <div className="flex items-end gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <TeamLine name={m.home} logo={m.homeLogo} goals={m.homeGoals} />
          <TeamLine name={m.away} logo={m.awayLogo} goals={m.awayGoals} />
        </div>
        {open && ready && (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => joinGoalMatchAction(m.id), (r) => (r.balance === undefined ? refresh() : setBalance(r.balance)))}
            className="h-10 shrink-0 rounded-full bg-primary px-4 text-sm font-bold text-primary-foreground transition-[opacity,scale] duration-150 hover:opacity-90 active:scale-[0.97] disabled:opacity-40"
          >
            {pending ? 'Kaydediliyor...' : fee > 0 ? `Katıl (${goalAmount(fee, GOAL_KC_UNIT)})` : 'Maça katıl'}
          </button>
        )}
      </div>
      <p className={matchMeta}>
        Her gol <b className="text-primary">{goalAmount(m.perGoal, event.unit)}</b> · {fmt(m.picks)} katılım
      </p>

      {/* A paid entry keeps its condition open: nobody should pay a fee for a condition they did not read. */}
      {open && ready && (
        <details open={fee > 0} className="group rounded-lg border border-border bg-background/70">
          <summary className="flex h-9 cursor-pointer list-none items-center justify-between gap-2 px-3 text-xs font-semibold text-foreground [&::-webkit-details-marker]:hidden">
            <span>
              Ödül şartı: <span className="text-primary">{event.rules.length} şart</span>
            </span>
            <ChevronDown className="size-4 text-muted-foreground transition-transform duration-200 group-open:rotate-180" aria-hidden="true" />
          </summary>
          <div className="flex flex-col gap-2.5 border-t border-border p-3">
            <RuleList event={event} m={m} />
            <p className="text-xs leading-relaxed text-foreground">
              Takım seçmek yok: maçta atılan her gol <b className="text-primary">{goalAmount(m.perGoal, event.unit)}</b> kazandırır; örneğin maç 3 golle biterse {goalAmount(goalReward(m.perGoal, 3), event.unit)}.
              {fee > 0 && (
                <>
                  {' '}
                  Katıldığında <b>{goalAmount(fee, GOAL_KC_UNIT)}</b> katılım ücreti bakiyenden düşer; şartı tamamlamazsan geri verilmez.
                </>
              )}
            </p>
          </div>
        </details>
      )}
      {open && !ready && <p className="text-xs leading-relaxed text-muted-foreground">{GOAL_NO_RULE}</p>}

      {result && <OutcomeLine outcome={result} />}
      <Conditions event={event} m={m} now={now} />
      {!result && !running && m.status === 'open' && <p className="text-xs text-muted-foreground">Katılım maç başlarken kapandı. Sonuç girilince ödüller dağıtılır.</p>}
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
    <span className="flex min-w-0 items-center gap-2">
      <Crest name={name} src={logo} />
      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{name}</span>
      {goals !== null && <span className="font-display text-lg font-bold leading-none tabular-nums text-foreground">{goals}</span>}
    </span>
  )
}

/**
 * Why the coupon field is closed: no session, no account at this sponsor, an account staff has not
 * checked yet, or one staff turned down.
 */
export type CouponLock = 'guest' | 'none' | 'pending' | 'rejected'

const LOCK_NOTE: Record<CouponLock, (site: string) => string> = {
  guest: (site) => `Kupon girmek için giriş yap, sonra ${site} hesabını bağla.`,
  none: (site) => `Kupon için ${site} hesabını bir kez bağla; onaylanınca alan açılır.`,
  pending: (site) => `${site} hesabın onay bekliyor; onaylanınca kupon alanı açılır.`,
  rejected: (site) => `${site} hesabın onaylanmadı; doğru kullanıcı adını bağla.`,
}


/** The coupon field stays closed until the member's account at this sponsor is linked and approved; one line says which step is missing. */
function AccountLock({ site, lock, linkFieldId, canLink }: { site: string; lock: CouponLock; linkFieldId: string; canLink: boolean }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/[0.06] py-1.5 pl-2.5 pr-1.5">
      <Lock className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
      <p className="min-w-0 flex-1 text-xs leading-snug text-muted-foreground text-pretty">{LOCK_NOTE[lock](site)}</p>
      {lock === 'guest' ? (
        <a href="#kayit" className={cn(smallAction, 'bg-primary text-primary-foreground hover:opacity-90')}>
          Giriş yap
        </a>
      ) : (
        canLink &&
        lock !== 'pending' && (
          <button
            type="button"
            onClick={() => {
              const field = document.getElementById(linkFieldId)
              field?.scrollIntoView({ block: 'center', behavior: 'smooth' })
              field?.focus({ preventScroll: true })
            }}
            className={cn(smallAction, 'bg-primary text-primary-foreground hover:opacity-90')}
          >
            Hesabı bağla
          </button>
        )
      )}
    </div>
  )
}

/**
 * `account` is the sponsor username the member linked; `blocked` says staff closed their participation.
 * Without a usable account (`lock`) the coupon field is not offered at all: the card shows the step that is
 * missing and leads to the form named by `linkFieldId`.
 */
export function CouponMatchCard({
  event,
  m,
  now,
  account,
  blocked,
  lock,
  linkFieldId,
}: {
  event: GoalEventView
  m: GoalMatch
  now: number
  account: string | null
  blocked: boolean
  lock: CouponLock | null
  linkFieldId: string
}) {
  const { pending, status, run } = useAction()
  const [coupon, setCoupon] = useState('')
  const [editing, setEditing] = useState(false)
  const [entering, setEntering] = useState(false)
  const fieldId = useId()
  const formId = useId()
  const pick = m.myPick
  const running = m.status === 'open' && Date.parse(m.kickoff) > now
  const linked = account !== null && lock === null
  const canEnter = running && !blocked && linked && (!pick || (pick.approval === 'pending' && editing))
  const canFix = running && !blocked && linked && pick?.approval === 'pending' && !editing
  const result = couponOutcome(event, m)
  const checked = checkCoupon(coupon)

  // The field waits behind one button so a list of twenty matches is not twenty open forms.
  const formOpen = canEnter && (entering || editing)

  return (
    <article className={matchCard}>
      <MatchHead m={m} now={now} open={running && !pick} />

      <div className="flex items-end gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <TeamLine name={m.home} logo={m.homeLogo} goals={m.homeGoals} />
          <TeamLine name={m.away} logo={m.awayLogo} goals={m.awayGoals} />
        </div>
        {canEnter && !pick && (
          <button
            type="button"
            aria-expanded={formOpen}
            aria-controls={formId}
            onClick={() => setEntering((v) => !v)}
            className={cn(smallAction, 'h-10 px-3.5', formOpen ? 'border border-border bg-background text-foreground' : 'bg-primary text-primary-foreground hover:opacity-90')}
          >
            <Ticket className="size-3.5" aria-hidden="true" />
            {formOpen ? 'Vazgeç' : 'Kupon gir'}
          </button>
        )}
      </div>
      <p className={matchMeta}>
        Her gol <b className="text-primary">{goalAmount(m.perGoal, event.unit)}</b> · {fmt(m.picks)} katılım
      </p>

      {formOpen && (
        <form
          id={formId}
          className="flex flex-col gap-2 rounded-lg border border-primary/30 bg-primary/[0.05] p-2.5 animate-in fade-in slide-in-from-top-1 duration-200"
          onSubmit={(e) => {
            e.preventDefault()
            if (!checked.ok) return
            run(
              () => submitGoalCouponAction(m.id, checked.value),
              () => {
                setCoupon('')
                setEditing(false)
                setEntering(false)
              },
            )
          }}
        >
          <label htmlFor={fieldId} className="sr-only">
            Kupon numarası
          </label>
          <div className="flex gap-2">
            <input
              id={fieldId}
              value={coupon}
              maxLength={40}
              autoFocus
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder={`${event.siteName ?? 'Sponsor'} kupon numaran`}
              onChange={(e) => setCoupon(e.target.value)}
              className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 text-base text-foreground sm:text-sm"
            />
            <button type="submit" disabled={pending || !checked.ok} className="h-10 shrink-0 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40">
              {pending ? 'Kaydediliyor...' : pick ? 'Güncelle' : 'Gönder'}
            </button>
          </div>
          <span className="text-xs leading-snug text-muted-foreground">
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
      {!pick && running && lock && !blocked && <AccountLock site={event.siteName ?? 'Sponsor'} lock={lock} linkFieldId={linkFieldId} canLink={Boolean(event.siteSlug)} />}
      {!pick && !running && m.status === 'open' && <p className="text-xs text-muted-foreground">Kupon girişi maç başlarken kapandı.</p>}
      <StatusLine status={status} />
    </article>
  )
}
