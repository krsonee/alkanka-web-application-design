'use client'

import { useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { JakoAvatar, type JakoPose } from '../jako'
import { ParticleBurst } from './particle-burst'
import { DetailButton, DetailModal } from '../detail-modal'
import type { MiniGameProps } from './lucky-wheel'
import { formatRemaining } from './mini-status'
import { playMini } from '@/app/actions/wallet'
import { usePoints } from '../points-context'
import { useCatalog } from '../catalog-context'
import { diceReward } from '@/lib/rewards-shared'

const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
}

function Die({ value, rolling, tone }: { value: number; rolling: boolean; tone: 'cyan' | 'purple' }) {
  return (
    <div
      role="img"
      aria-label={`Zar: ${value}`}
      className={cn(
        'grid size-20 grid-cols-3 grid-rows-3 gap-1 rounded-2xl border bg-card p-3 sm:size-24',
        tone === 'cyan' ? 'border-primary/50 glow-cyan' : 'border-accent/50 glow-purple',
        rolling && 'animate-tumble',
      )}
    >
      {Array.from({ length: 9 }).map((_, i) => (
        <span key={i} className="flex items-center justify-center">
          {PIPS[value].includes(i) && (
            <span
              className={cn(
                'size-3 rounded-full sm:size-3.5',
                tone === 'cyan' ? 'bg-primary shadow-[0_0_8px_var(--primary)]' : 'bg-accent shadow-[0_0_8px_var(--accent)]',
              )}
            />
          )}
        </span>
      ))}
    </div>
  )
}


const rand = () => 1 + Math.floor(Math.random() * 6)

export function DiceRoll({ lockedFor, canPlay, onPlayed }: MiniGameProps) {
  const { setBalance } = usePoints()
  const { dice: diceConfig } = useCatalog().rewards
  const locked = lockedFor > 0
  const [dice, setDice] = useState<[number, number]>([5, 3])
  const [rolling, setRolling] = useState(false)
  const [result, setResult] = useState<{ label: string; points: number } | null>(null)
  const [rollKey, setRollKey] = useState(0)
  const [rules, setRules] = useState(false)
  const interval = useRef<ReturnType<typeof setInterval> | null>(null)

  async function roll() {
    if (rolling || !canPlay()) return
    setRolling(true)
    setResult(null)
    setRollKey((k) => k + 1)
    interval.current = setInterval(() => setDice([rand(), rand()]), 90)
    const started = Date.now()
    const res = await playMini('zar')
    setTimeout(() => {
      if (interval.current) clearInterval(interval.current)
      setRolling(false)
      if (!res.ok || res.game !== 'zar') {
        if (typeof res.balance === 'number') setBalance(res.balance)
        if (!res.ok) setResult({ label: res.error, points: 0 })
        return
      }
      setDice(res.dice)
      setResult({ label: diceReward(res.dice[0], res.dice[1], diceConfig).label, points: res.points })
      setBalance(res.balance)
      onPlayed()
    }, Math.max(0, 900 - (Date.now() - started)))
  }

  const isDouble = result && dice[0] === dice[1]
  const jakoPose: JakoPose = rolling ? 'zar' : result ? (result.points >= 100 ? 'kazandi' : 'jako') : 'zar'

  return (
    <article className="panel-gold relative flex flex-col gap-5 overflow-hidden rounded-2xl p-6">
      <header className="flex items-start justify-between gap-4">
        <div className="flex flex-col items-start gap-1">
          <span className="text-xs font-semibold uppercase tracking-widest text-primary">Mini oyun</span>
          <h3 className="font-display text-xl font-bold text-foreground">Zar At</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">Çift gelirse puanın katlanır. Düşeş jackpot kutusunu açar.</p>
          <DetailButton onClick={() => setRules(true)} label="Oyun kuralları" />
        </div>
        <JakoAvatar pose={jakoPose} size="lg" className={cn('transition-transform', result && 'animate-pop')} />
      </header>

      <div className="relative flex items-center justify-center gap-5 py-4" key={rollKey}>
        <Die value={dice[0]} rolling={rolling} tone="cyan" />
        <Die value={dice[1]} rolling={rolling} tone="purple" />
        {isDouble && <ParticleBurst count={16} distance={110} />}
      </div>

      <div className="flex items-center justify-between gap-3">
        <p aria-live="polite" className="min-w-0 text-sm">
          {result ? (
            <span className="animate-pop font-semibold text-gold">{result.label}</span>
          ) : (
            <span className="text-muted-foreground">
              {rolling ? 'Zarlar dönüyor…' : locked ? `Haklar ${formatRemaining(lockedFor)} sonra yenilenir` : `Günde ${diceConfig.dailyPlays} atış hakkın var`}
            </span>
          )}
        </p>
        <button
          type="button"
          onClick={roll}
          disabled={rolling || locked}
          className="shrink-0 rounded-lg bg-primary px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-primary-foreground transition-transform hover:scale-105 disabled:opacity-60 disabled:hover:scale-100"
        >
          {rolling ? 'Atılıyor' : locked ? 'Hak doldu' : 'Zar at'}
        </button>
      </div>

      <DetailModal
        onClose={() => setRules(false)}
        content={
          rules
            ? {
                eyebrow: 'Mini oyun',
                title: 'Zar At kuralları',
                description: 'İki zar atılır, sonuca göre Kanka Coin kazanırsın. Her atış kazandırır, çift ve düşeş daha çok kazandırır.',
                prizes: [
                  { place: 'Düşeş (6-6)', prize: `Jackpot · ${diceConfig.jackpot} KC` },
                  { place: 'Çift (1-1 … 5-5)', prize: `Zar × ${diceConfig.doubleX} KC` },
                  { place: `Toplam ${diceConfig.highMin}+`, prize: `Toplam × ${diceConfig.highX} KC` },
                  { place: 'Diğer atışlar', prize: `Toplam × ${diceConfig.lowX} KC` },
                ],
                rules: [
                  `Günde ${diceConfig.dailyPlays} atış hakkın var, haklar 00:00’da yenilenir.`,
                  'Marketten alınan 2x Boost aktifken kazanç ikiye katlanır.',
                  'Sonuçlar tamamen rastgeledir, önceki atışlar sonraki atışı etkilemez.',
                  'Kazanılan Kanka Coin anında bakiyene eklenir.',
                  'Otomasyon veya çoklu hesap tespitinde kazançlar iptal edilir.',
                ],
              }
            : null
        }
      />
    </article>
  )
}
