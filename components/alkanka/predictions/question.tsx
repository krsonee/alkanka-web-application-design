'use client'

import { Check, Minus, Plus, X } from 'lucide-react'
import {
  MARKETS,
  MAX_GOALS,
  correctAnswer,
  marketOptions,
  marketTitle,
  parseScore,
  rewardText,
  type MarketId,
  type MarketRule,
  type MatchResult,
  type Outcome,
  type Teams,
} from '@/lib/predictions-shared'
import { cn } from '@/lib/utils'

const QUICK_GOALS = [0, 1, 2, 3, 4, 5]
const MORE_FROM = 6

const chip = 'flex h-10 min-w-0 flex-1 items-center justify-center rounded-md border text-sm font-bold tabular-nums transition-colors disabled:opacity-50'
const chipIdle = 'border-border bg-background text-foreground hover:border-primary/50'
const chipOn = 'border-primary bg-primary text-primary-foreground'

function GoalPicker({ team, value, onChange, disabled }: { team: string; value: number | null; onChange: (n: number) => void; disabled: boolean }) {
  const more = value !== null && value >= MORE_FROM
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="truncate text-xs font-semibold text-muted-foreground">{team}</span>
      <div role="group" aria-label={`${team} gol sayısı`} className="flex min-w-0 flex-1 gap-1">
        {QUICK_GOALS.map((n) => (
          <button key={n} type="button" disabled={disabled} aria-pressed={value === n} onClick={() => onChange(n)} className={cn(chip, value === n ? chipOn : chipIdle)}>
            {n}
          </button>
        ))}
        {more ? (
          <span className={cn(chip, chipOn, 'flex-[1.8] justify-between px-1')}>
            <button type="button" disabled={disabled} onClick={() => onChange(value - 1)} aria-label={`${team} golünü azalt`} className="flex size-7 items-center justify-center rounded">
              <Minus className="size-3.5" aria-hidden="true" />
            </button>
            <span aria-live="polite">{value}</span>
            <button type="button" disabled={disabled || value >= MAX_GOALS} onClick={() => onChange(value + 1)} aria-label={`${team} golünü artır`} className="flex size-7 items-center justify-center rounded disabled:opacity-40">
              <Plus className="size-3.5" aria-hidden="true" />
            </button>
          </span>
        ) : (
          <button type="button" disabled={disabled} aria-pressed={false} onClick={() => onChange(MORE_FROM)} className={cn(chip, chipIdle, 'flex-[1.8]')}>
            {MORE_FROM}+
          </button>
        )}
      </div>
    </div>
  )
}

/** The score question is the wide one: it takes the whole row wherever the questions sit two abreast. */
const WIDE = '@2xl:col-span-2'

/** The order the questions are laid out in, with the wide score question placed where it leaves no gap beside it. */
export function layoutOrder(ids: MarketId[]): MarketId[] {
  const rest = ids.filter((id) => id !== 'score')
  return rest.length === ids.length || rest.length < 2 ? ids : [...rest.slice(0, 2), 'score', ...rest.slice(2)]
}

export type ScoreDraft = { home: number | null; away: number | null }

export const scoreAnswer = (s: ScoreDraft) => (s.home === null || s.away === null ? undefined : `${s.home}-${s.away}`)

const OUTCOME_TEXT: Record<Outcome, string> = { hit: 'Doğru', near: 'Taraf doğru', miss: 'Tutmadı', void: 'İptal' }
const OUTCOME_TONE: Record<Outcome, string> = { hit: 'text-success', near: 'text-primary', miss: 'text-destructive', void: 'text-muted-foreground' }

function Head({ id, rule, outcome }: { id: MarketId; rule: MarketRule; outcome?: Outcome | null }) {
  const earned = outcome === 'near' ? rewardText({ pts: rule.nearPts ?? 0, coin: rule.coin, amount: rule.nearAmount ?? 0 }) : rewardText(rule)
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="flex min-w-0 flex-col">
        <span className="text-sm font-bold text-foreground">{marketTitle(id, rule)}</span>
        <span className="truncate text-xs text-muted-foreground">{MARKETS[id].ask}</span>
      </span>
      {outcome ? (
        <span className={cn('shrink-0 text-xs font-bold', OUTCOME_TONE[outcome])}>
          {OUTCOME_TEXT[outcome]}
          {(outcome === 'hit' || outcome === 'near') && earned ? ` · +${earned}` : ''}
        </span>
      ) : (
        rewardText(rule) && <span className="shrink-0 text-xs font-semibold text-primary">+{rewardText(rule)}</span>
      )}
    </div>
  )
}

/** One question while the member is still answering it. */
export function QuestionInput({
  id,
  rule,
  teams,
  value,
  score,
  disabled,
  onPick,
  onScore,
}: {
  id: MarketId
  rule: MarketRule
  teams: Teams
  value: string | undefined
  score: ScoreDraft
  disabled: boolean
  onPick: (value: string) => void
  onScore: (score: ScoreDraft) => void
}) {
  const options = marketOptions(id, teams, rule)
  return (
    <div className={cn('@container flex flex-col gap-2', id === 'score' && WIDE)}>
      <Head id={id} rule={rule} />
      {id === 'score' ? (
        <div className="grid gap-x-6 gap-y-2 @xl:grid-cols-2">
          <GoalPicker team={teams.home} value={score.home} disabled={disabled} onChange={(home) => onScore({ ...score, home })} />
          <GoalPicker team={teams.away} value={score.away} disabled={disabled} onChange={(away) => onScore({ ...score, away })} />
        </div>
      ) : (
        <div role="group" aria-label={marketTitle(id, rule)} className={cn('grid gap-1.5', options.length === 3 ? 'grid-cols-3' : 'grid-cols-2')}>
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              disabled={disabled}
              aria-pressed={value === o.value}
              onClick={() => onPick(o.value)}
              className={cn('flex min-h-11 min-w-0 items-center justify-center rounded-md border px-1 py-1 text-center text-xs font-semibold leading-tight transition-colors disabled:opacity-50 @xs:px-2 @xs:text-sm', value === o.value ? 'border-primary bg-primary/15 text-primary' : chipIdle)}
            >
              <span className="line-clamp-2 text-balance break-words">{o.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const pct = (n: number, total: number) => (total > 0 ? Math.round((n / total) * 100) : 0)

/** One question after it can no longer be answered: what the member said, what the others said and, once known, what was right. */
export function QuestionResult({
  id,
  rule,
  teams,
  mine,
  crowd,
  result,
  outcome,
}: {
  id: MarketId
  rule: MarketRule
  teams: Teams
  mine: string | undefined
  crowd: Record<string, number> | undefined
  result: MatchResult | null
  outcome: Outcome | null | undefined
}) {
  const right = result ? correctAnswer(id, rule, result) : null
  const total = Object.values(crowd ?? {}).reduce((s, n) => s + n, 0)

  if (id === 'score') {
    const top = Object.entries(crowd ?? {})
      .filter(([value]) => parseScore(value))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
    return (
      <div className={cn('flex flex-col gap-2', WIDE)}>
        <Head id={id} rule={rule} outcome={outcome} />
        <dl className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
          <div className="flex items-baseline gap-1.5">
            <dt className="text-xs text-muted-foreground">Tahminin</dt>
            <dd className={cn('font-display font-bold tabular-nums', mine ? (outcome ? OUTCOME_TONE[outcome] : 'text-primary') : 'text-muted-foreground')}>{mine ?? '-'}</dd>
          </div>
          {right && (
            <div className="flex items-baseline gap-1.5">
              <dt className="text-xs text-muted-foreground">Sonuç</dt>
              <dd className="font-display font-bold tabular-nums text-foreground">{right}</dd>
            </div>
          )}
        </dl>
        {top.length > 0 && (
          <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <span>En çok yazılan:</span>
            {top.map(([value, n]) => (
              <span key={value} className={cn('rounded border px-1.5 py-0.5 font-semibold tabular-nums', value === right ? 'border-success/50 text-success' : 'border-border text-foreground')}>
                {value} <span className="font-normal text-muted-foreground">%{pct(n, total)}</span>
              </span>
            ))}
          </p>
        )}
      </div>
    )
  }

  const options = marketOptions(id, teams, rule)
  return (
    <div className="@container flex flex-col gap-2">
      <Head id={id} rule={rule} outcome={outcome} />
      <ul className={cn('grid gap-1.5', options.length === 3 ? 'grid-cols-3' : 'grid-cols-2')}>
        {options.map((o) => {
          const share = pct(crowd?.[o.value] ?? 0, total)
          const isMine = mine === o.value
          const isRight = right === o.value
          return (
            <li
              key={o.value}
              className={cn(
                'relative flex min-h-11 min-w-0 flex-col items-center justify-center overflow-hidden rounded-md border px-1 py-1 text-center @xs:px-2',
                isRight ? 'border-success/60 text-success' : isMine ? (right ? 'border-destructive/60 text-destructive' : 'border-primary text-primary') : 'border-border text-foreground',
              )}
            >
              {total > 0 && <span aria-hidden="true" className="absolute inset-y-0 left-0 bg-foreground/5" style={{ width: `${share}%` }} />}
              <span className="relative flex w-full items-center justify-center gap-1 text-xs font-semibold leading-tight @xs:text-sm">
                {isRight && <Check className="size-3.5 shrink-0" aria-label="Doğru cevap" />}
                {isMine && right && !isRight && <X className="size-3.5 shrink-0" aria-hidden="true" />}
                <span className="line-clamp-2 text-balance break-words">{o.label}</span>
              </span>
              <span className="relative text-xs text-muted-foreground">
                {isMine ? 'Seçimin' : ''}
                {isMine && total > 0 ? ' · ' : ''}
                {total > 0 ? `%${share}` : ''}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
