import type { ReactNode } from 'react'
import { Bot, Coins, Crown, Eye, RotateCcw, Trophy, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatAC } from '../points-context'

export type ResultOutcome = 'win' | 'lose' | 'draw' | 'cancel' | 'spectate'

type ResultPlayer = { id: string; name: string; winner: boolean; me: boolean; bot?: boolean; tag?: string }

const SPARKS = [
  { left: '12%', delay: '0s', size: 'size-1.5' },
  { left: '24%', delay: '1.1s', size: 'size-1' },
  { left: '38%', delay: '0.4s', size: 'size-2' },
  { left: '55%', delay: '1.6s', size: 'size-1' },
  { left: '68%', delay: '0.7s', size: 'size-1.5' },
  { left: '82%', delay: '1.3s', size: 'size-2' },
  { left: '90%', delay: '0.2s', size: 'size-1' },
]

/** Net KC for the member: what came back minus what was staked. */
function kcLabel(outcome: ResultOutcome, stake: number, delta: number | null | undefined) {
  const neutral = outcome === 'draw' || outcome === 'cancel'
  if (outcome === 'spectate') return `Bahis ${formatAC(stake)} KC`
  if (!stake && !delta) return 'Bahissiz maç'
  if (delta != null && !neutral) return delta > 0 ? `+${formatAC(delta)} KC` : delta < 0 ? `-${formatAC(-delta)} KC` : '0 KC'
  if (outcome === 'win') return 'Pot senin'
  if (outcome === 'lose') return `-${formatAC(stake)} KC`
  return `${formatAC(stake)} KC iade`
}

/**
 * The one match-end card every game lands on: result, net KC, and the shared recap (KP, task, next level).
 * `extra` holds game-specific detail such as a final score table; `children` are the action buttons.
 * It is kept short on purpose: on a phone the buttons must be on screen without scrolling.
 */
export function GameResultCard({
  outcome,
  title,
  subtitle,
  gameTitle,
  gameImage,
  stake,
  delta,
  kcText,
  badge,
  players,
  extra,
  recap,
  children,
}: {
  outcome: ResultOutcome
  title: string
  subtitle: string
  gameTitle: string
  gameImage?: string
  stake: number
  /** Net KC from the settled match; falls back to the stake while it is still unknown. */
  delta?: number | null
  /** Replaces the KC line where no stake is on the table, e.g. a tournament match. */
  kcText?: string
  /** Short highlight beside the game name, e.g. "Mars · 3x". */
  badge?: string
  players: ResultPlayer[]
  extra?: ReactNode
  recap?: ReactNode
  children: ReactNode
}) {
  const win = outcome === 'win'
  const lose = outcome === 'lose'
  const neutral = outcome === 'draw' || outcome === 'cancel'
  const Icon = win || outcome === 'spectate' ? Trophy : lose ? X : neutral ? RotateCcw : Eye
  const ranked = [...players].sort((a, b) => Number(b.winner) - Number(a.winner))
  // A draw or a cancelled table has no order to show: the names share one line instead of a row each.
  const flat = !ranked.some((p) => p.winner || p.tag)

  return (
    <div
      className={cn(
        'relative flex max-h-[calc(100dvh-2rem)] w-full max-w-sm flex-col overflow-y-auto overflow-x-hidden rounded-2xl border bg-card text-center shadow-2xl animate-in fade-in zoom-in-95 slide-in-from-bottom-4 duration-300 phone-ls:max-w-xl',
        win ? 'border-primary/60 glow-gold' : 'border-border',
      )}
    >
      <div className="relative shrink-0 overflow-hidden px-4 pb-3 pt-4 text-left">
        {gameImage && (
          <img
            src={gameImage || '/placeholder.svg'}
            alt=""
            aria-hidden="true"
            className={cn('absolute inset-0 size-full scale-110 object-cover blur-[2px]', !win && 'grayscale', lose ? 'opacity-15' : 'opacity-30')}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-card/50 to-card" aria-hidden="true" />
        {win && (
          <div aria-hidden="true" className="absolute inset-0">
            {SPARKS.map((s, i) => (
              <span key={i} className={cn('result-spark absolute bottom-0 rounded-full bg-primary', s.size)} style={{ left: s.left, animationDelay: s.delay }} />
            ))}
          </div>
        )}

        <div className="relative flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="relative flex shrink-0 items-center justify-center">
            {win && <span aria-hidden="true" className="absolute inset-0 rounded-full bg-primary/40 animate-[app-halo_1.8s_ease-out_infinite]" />}
            <span
              className={cn(
                'relative flex size-11 items-center justify-center rounded-full',
                win ? 'bg-primary text-primary-foreground' : lose ? 'bg-secondary text-muted-foreground' : 'bg-secondary text-foreground',
              )}
            >
              <Icon className={cn('size-5', win && 'animate-[app-trophy_2.4s_ease-in-out_infinite]')} aria-hidden="true" />
            </span>
          </span>

          <div className="flex min-w-32 flex-1 flex-col gap-1">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-muted-foreground">
              <span>{`Maç sonu · ${gameTitle}`}</span>
              {badge && (
                <span className="animate-badge-pulse rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-primary">
                  {badge}
                </span>
              )}
            </span>
            <p
              id="game-result-title"
              className={cn('font-display text-2xl font-black uppercase leading-tight tracking-tight text-balance', win ? 'text-primary' : 'text-foreground')}
            >
              {title}
            </p>
          </div>

          <span
            aria-live="polite"
            className={cn(
              'flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-black tabular-nums',
              win
                ? 'border-primary/50 bg-primary/10 text-primary'
                : lose
                  ? 'border-destructive/40 bg-destructive/10 text-destructive'
                  : 'border-border bg-secondary text-foreground',
            )}
          >
            <Coins className="size-4" aria-hidden="true" />
            {kcText ?? kcLabel(outcome, stake, delta)}
          </span>
        </div>

        {subtitle && <p className="relative mt-2 text-sm leading-relaxed text-muted-foreground text-pretty">{subtitle}</p>}
      </div>

      <div className="flex flex-col items-center gap-3 px-4 pb-4">
        {ranked.length > 1 &&
          (flat ? (
            <p className="w-full rounded-xl bg-secondary/50 px-3 py-2 text-left text-sm leading-relaxed text-muted-foreground text-pretty">
              <span className="sr-only">Oyuncular: </span>
              {ranked.map((p, i) => (
                <span key={p.id}>
                  {i > 0 && ' · '}
                  <span className={cn('font-semibold', p.me && 'text-foreground')}>{p.name}</span>
                  {p.me && <span className="text-primary"> (Sen)</span>}
                </span>
              ))}
            </p>
          ) : (
            <ol className="flex w-full flex-col divide-y divide-border overflow-hidden rounded-xl border border-border text-left" aria-label="Sonuç sıralaması">
              {ranked.map((p) => (
                <li key={p.id} className={cn('flex items-center gap-2 px-3 py-1.5 text-sm', p.winner && 'bg-primary/10')}>
                  <span
                    className={cn(
                      'flex size-5 shrink-0 items-center justify-center rounded-full',
                      p.winner ? 'bg-primary text-primary-foreground' : 'text-muted-foreground',
                    )}
                  >
                    {p.winner ? (
                      <Crown className="size-3" aria-hidden="true" />
                    ) : p.bot ? (
                      <Bot className="size-3.5" aria-hidden="true" />
                    ) : (
                      <span className="size-1.5 rounded-full bg-current" />
                    )}
                  </span>
                  <span className={cn('min-w-0 flex-1 truncate font-semibold', p.winner ? 'text-foreground' : 'text-muted-foreground')}>
                    {p.name}
                    {p.me && <span className="ml-1.5 text-xs text-primary">(Sen)</span>}
                  </span>
                  <span className={cn('shrink-0 text-xs font-semibold', p.winner ? 'text-primary' : 'text-muted-foreground')}>
                    {p.tag ?? (p.winner ? 'Kazandı' : 'Elendi')}
                  </span>
                </li>
              ))}
            </ol>
          ))}

        {extra}

        {recap}

        <div className="grid w-full grid-cols-2 gap-2">{children}</div>
      </div>
    </div>
  )
}
