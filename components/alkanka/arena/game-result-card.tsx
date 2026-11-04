import type { ReactNode } from 'react'
import { Bot, Coins, Crown, Eye, RotateCcw, Trophy, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatAC } from '../points-context'

export type ResultOutcome = 'win' | 'lose' | 'draw' | 'cancel' | 'spectate'

type ResultPlayer = { id: string; name: string; winner: boolean; me: boolean; bot?: boolean }

const SPARKS = [
  { left: '12%', delay: '0s', size: 'size-1.5' },
  { left: '24%', delay: '1.1s', size: 'size-1' },
  { left: '38%', delay: '0.4s', size: 'size-2' },
  { left: '55%', delay: '1.6s', size: 'size-1' },
  { left: '68%', delay: '0.7s', size: 'size-1.5' },
  { left: '82%', delay: '1.3s', size: 'size-2' },
  { left: '90%', delay: '0.2s', size: 'size-1' },
]

export function GameResultCard({
  outcome,
  title,
  subtitle,
  gameTitle,
  gameImage,
  stake,
  players,
  extra,
  children,
}: {
  outcome: ResultOutcome
  title: string
  subtitle: string
  gameTitle: string
  gameImage?: string
  stake: number
  players: ResultPlayer[]
  extra?: ReactNode
  children: ReactNode
}) {
  const win = outcome === 'win'
  const lose = outcome === 'lose'
  const neutral = outcome === 'draw' || outcome === 'cancel'
  const Icon = win || outcome === 'spectate' ? Trophy : lose ? X : neutral ? RotateCcw : Eye
  const ranked = [...players].sort((a, b) => Number(b.winner) - Number(a.winner))

  return (
    <div
      className={cn(
        'relative flex w-full max-w-sm flex-col overflow-hidden rounded-[28px] border bg-card text-center shadow-2xl animate-in zoom-in-90 slide-in-from-bottom-8 duration-500',
        win ? 'border-primary/70 glow-gold' : 'border-border',
      )}
    >
      <div className="relative flex h-48 items-center justify-center overflow-hidden">
        {gameImage && (
          <img
            src={gameImage || '/placeholder.svg'}
            alt=""
            aria-hidden="true"
            className={cn('absolute inset-0 size-full scale-110 object-cover blur-[2px]', !win && 'grayscale', lose ? 'opacity-25' : 'opacity-45')}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-card/30 via-card/60 to-card" aria-hidden="true" />

        {win && (
          <>
            <div
              aria-hidden="true"
              className="result-rays absolute left-1/2 top-1/2 size-[30rem] -translate-x-1/2 -translate-y-1/2 opacity-60"
            />
            <div aria-hidden="true" className="absolute inset-0">
              {SPARKS.map((s, i) => (
                <span
                  key={i}
                  className={cn('result-spark absolute bottom-0 rounded-full bg-primary', s.size)}
                  style={{ left: s.left, animationDelay: s.delay }}
                />
              ))}
            </div>
          </>
        )}

        <div className="relative flex flex-col items-center gap-3">
          <span className="relative flex items-center justify-center">
            {win && <span aria-hidden="true" className="absolute inset-0 rounded-full bg-primary/40 animate-[app-halo_1.8s_ease-out_infinite]" />}
            <span
              className={cn(
                'relative flex size-24 items-center justify-center rounded-full border-4 shadow-xl animate-in zoom-in-50 spin-in-12 duration-700',
                win
                  ? 'border-primary/40 bg-primary text-primary-foreground'
                  : lose
                    ? 'border-border bg-secondary text-muted-foreground'
                    : 'border-border bg-secondary text-foreground',
              )}
            >
              <Icon className={cn('size-11', win && 'animate-[app-trophy_2.4s_ease-in-out_infinite]')} aria-hidden="true" />
            </span>
          </span>
          <span
            className={cn(
              'rounded-full border px-3 py-1 font-display text-[11px] font-bold uppercase tracking-[0.25em]',
              win ? 'border-primary/50 bg-background/70 text-primary' : 'border-border bg-background/70 text-muted-foreground',
            )}
          >
            Maç sonu · {gameTitle}
          </span>
        </div>
      </div>

      <div className="flex flex-col items-center gap-4 px-6 pb-6">
        <div className="flex flex-col items-center gap-1">
          <p
            id="game-result-title"
            className={cn(
              'font-display text-4xl font-black uppercase tracking-tight text-balance',
              win ? 'text-primary' : 'text-foreground',
            )}
          >
            {title}
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground text-pretty">{subtitle}</p>
        </div>

        <div
          className={cn(
            'flex items-center gap-2 rounded-2xl border px-4 py-2 font-display text-lg font-black',
            win
              ? 'border-primary/50 bg-primary/10 text-primary'
              : lose
                ? 'border-destructive/40 bg-destructive/10 text-destructive'
                : 'border-border bg-secondary text-foreground',
          )}
        >
          <Coins className="size-5" aria-hidden="true" />
          {win ? 'Pot senin' : lose ? `-${formatAC(stake)} KC` : neutral ? `${formatAC(stake)} KC iade` : `Bahis ${formatAC(stake)} KC`}
        </div>

        {ranked.length > 1 && (
          <ol className="flex w-full flex-col gap-1.5" aria-label="Sonuç sıralaması">
            {ranked.map((p) => (
              <li
                key={p.id}
                className={cn(
                  'flex items-center gap-3 rounded-xl border px-3 py-2 text-left text-sm',
                  p.winner ? 'border-primary/50 bg-primary/10' : 'border-border bg-background/40',
                )}
              >
                <span
                  className={cn(
                    'flex size-7 shrink-0 items-center justify-center rounded-full',
                    p.winner ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground',
                  )}
                >
                  {p.winner ? <Crown className="size-4" aria-hidden="true" /> : p.bot ? <Bot className="size-4" aria-hidden="true" /> : <span className="size-1.5 rounded-full bg-current" />}
                </span>
                <span className={cn('min-w-0 flex-1 truncate font-bold', p.winner ? 'text-foreground' : 'text-muted-foreground')}>
                  {p.name}
                  {p.me && <span className="ml-1.5 text-xs font-semibold text-primary">(Sen)</span>}
                </span>
                <span className={cn('text-xs font-bold uppercase tracking-wider', p.winner ? 'text-primary' : 'text-muted-foreground')}>
                  {p.winner ? 'Kazandı' : outcome === 'draw' || outcome === 'cancel' ? '—' : 'Elendi'}
                </span>
              </li>
            ))}
          </ol>
        )}

        {extra}

        <div className="grid w-full grid-cols-2 gap-2">{children}</div>
      </div>
    </div>
  )
}
