'use client'

import { useState } from 'react'
import { Gem, Gift, Package, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ParticleBurst } from './particle-burst'

const CHESTS = [
  { name: 'Gümüş Sandık', icon: Package, tone: 'cyan' as const },
  { name: 'Altın Sandık', icon: Gem, tone: 'gold' as const },
  { name: 'Mavi Sandık', icon: Gift, tone: 'purple' as const },
]

const REWARDS = [
  { label: '75 Kanka Coin', points: 75 },
  { label: '24s 2x Boost', points: 150 },
  { label: 'VIP Promo Kod', points: 300 },
  { label: '120 Kanka Coin', points: 120 },
  { label: 'Seri Kalkanı', points: 90 },
]

const TONE = {
  cyan: { ring: 'border-primary/50 glow-cyan', icon: 'text-primary' },
  gold: { ring: 'border-gold/50 glow-gold', icon: 'text-gold' },
  purple: { ring: 'border-accent/50 glow-purple', icon: 'text-accent' },
}

type Phase = 'idle' | 'opening' | 'opened'

export function MysteryChests({ onWin }: { onWin: (points: number) => void }) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [picked, setPicked] = useState<number | null>(null)
  const [contents, setContents] = useState<typeof REWARDS>([])

  function open(index: number) {
    if (phase !== 'idle') return
    const shuffled = [...REWARDS].sort(() => Math.random() - 0.5).slice(0, 3)
    setContents(shuffled)
    setPicked(index)
    setPhase('opening')
    setTimeout(() => {
      setPhase('opened')
      onWin(shuffled[index].points)
    }, 1300)
  }

  function reset() {
    setPhase('idle')
    setPicked(null)
  }

  return (
    <article className="panel-gold relative flex flex-col gap-5 overflow-hidden rounded-2xl p-6">
      <header className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-widest text-gold">Günlük bonus</span>
          <h3 className="font-display text-xl font-bold text-foreground">Gizemli Sandıklar</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">Günde 1 sandık seç. Her sandıkta garantili ödül var.</p>
        </div>
        {phase === 'opened' && (
          <button
            type="button"
            onClick={reset}
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <RotateCcw className="size-3.5" aria-hidden="true" />
            Tekrar dene
          </button>
        )}
      </header>

      <div className="grid grid-cols-3 gap-3">
        {CHESTS.map((chest, i) => {
          const Icon = chest.icon
          const isPicked = picked === i
          const revealed = phase === 'opened'
          return (
            <button
              key={chest.name}
              type="button"
              onClick={() => open(i)}
              disabled={phase !== 'idle'}
              aria-label={revealed ? `${chest.name}: ${contents[i]?.label}` : `${chest.name} aç`}
              className={cn(
                'relative flex aspect-[4/5] flex-col items-center justify-center gap-2 rounded-2xl border bg-card/70 p-2 transition-all duration-300',
                phase === 'idle' && 'hover:-translate-y-1 hover:bg-card',
                isPicked ? TONE[chest.tone].ring : 'border-border',
                revealed && !isPicked && 'opacity-45',
              )}
            >
              <span className={cn('relative', isPicked && phase === 'opening' && 'animate-shake')}>
                <Icon
                  className={cn('size-10 transition-transform sm:size-12', TONE[chest.tone].icon, revealed && isPicked && 'scale-110')}
                  strokeWidth={1.5}
                  aria-hidden="true"
                />
              </span>
              {revealed ? (
                <span className={cn('animate-pop text-center text-xs font-semibold', isPicked ? 'text-gold' : 'text-muted-foreground')}>
                  {contents[i]?.label}
                </span>
              ) : (
                <span className="text-center text-xs text-muted-foreground">{chest.name}</span>
              )}
              {revealed && isPicked && <ParticleBurst count={20} distance={80} />}
            </button>
          )
        })}
      </div>

      <p aria-live="polite" className="text-sm text-muted-foreground">
        {phase === 'idle' && 'Açmak için bir sandığa dokun.'}
        {phase === 'opening' && 'Sandık açılıyor…'}
        {phase === 'opened' && picked !== null && (
          <>
            <span className="font-semibold text-gold">{contents[picked]?.label}</span> kazandın. Sonraki sandık 23s 59dk sonra.
          </>
        )}
      </p>
    </article>
  )
}
