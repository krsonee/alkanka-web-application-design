'use client'

/*
  Zar At on the Şans Çarkı terrace: Jako on the left, two dice thrown onto the dais on the right, and between them
  the title plaque, what each throw pays and the throw button. On phones (stage under 600 wide) Jako is behind the
  balustrade, the dice land on the dais at the foot and the pay table sits under the stage as chips.

  The throw itself, the daily plays and the payout happen on the server (playMini); the dice only turn to the two
  values it returns.
*/

import { useRef, useState } from 'react'
import { Clock } from 'lucide-react'
import { playMini } from '@/app/actions/wallet'
import type { RewardConfig } from '@/lib/rewards-shared'
import { playSound } from '@/lib/sound'
import { usePrefersReducedMotion } from '@/lib/use-motion'
import { cn } from '@/lib/utils'
import { TableBrand } from '../arena/table-brand'
import { useCatalog } from '../catalog-context'
import { DetailButton, DetailModal } from '../detail-modal'
import { usePoints } from '../points-context'
import { Die, restingTurn, rollTo, type DieTurn } from './dice-stage/die'
import type { MiniGameProps } from './lucky-wheel'
import { formatRemaining } from './mini-status'
import { burst } from './wheel-stage/burst'
import type { ActorState } from './wheel-stage/jako-actor'
import { ActionButton, ActionNote, PayChips, PayRows, StagePlaque, type PayRow } from './wheel-stage/parts'
import { StageBackdrop } from './wheel-stage/stage'

type Pair = [number, number]

export type DiceDraw = () => Promise<{ ok: true; dice: Pair; points: number; balance: number } | { ok: false; error: string; balance?: number }>

const serverDraw: DiceDraw = async () => {
  const res = await playMini('zar')
  if (res.ok && res.game === 'zar') return { ok: true, dice: res.dice, points: res.points, balance: res.balance }
  return { ok: false, error: res.ok ? 'Zar atılamadı, tekrar dene.' : res.error, balance: res.balance }
}

const TIERS = ['Düşeş', 'Çift', 'Yüksek atış', 'Atış']

/** Which row of the pay table a throw falls in; the same order the server pays by. */
const tierOf = ([a, b]: Pair, dice: RewardConfig['dice']) => (a === 6 && b === 6 ? 0 : a === b ? 1 : a + b >= dice.highMin ? 2 : 3)

const ROLL_MS = 1250
const START: Pair = [5, 3]

type Result = { dice: Pair; points: number; tier: number }

/** `draw` is where a throw's outcome comes from: the server, unless a preview passes its own. */
export function DiceRoll({ lockedFor, playsLeft, canPlay, onPlayed, draw = serverDraw }: MiniGameProps & { draw?: DiceDraw }) {
  const { setBalance } = usePoints()
  const config = useCatalog().rewards.dice
  const reduced = usePrefersReducedMotion()
  const locked = lockedFor > 0
  const [shown, setShown] = useState<Pair>(START)
  const [turns, setTurns] = useState<[DieTurn, DieTurn]>(() => [restingTurn(START[0]), restingTurn(START[1])])
  const [throws, setThrows] = useState(0)
  const [rolling, setRolling] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState('')
  const [actor, setActor] = useState<ActorState>('idle')
  const [rules, setRules] = useState(false)
  const diceRef = useRef<HTMLDivElement>(null)

  async function roll() {
    if (rolling || !canPlay()) return
    setRolling(true)
    setError('')
    const res = await draw()
    if (!res.ok) {
      setRolling(false)
      setError(res.error)
      if (typeof res.balance === 'number') setBalance(res.balance)
      return
    }
    setResult(null)
    setActor('spin')
    setShown(res.dice)
    setTurns(([a, b]) => [rollTo(a, res.dice[0], 2), rollTo(b, res.dice[1], 3)])
    setThrows((n) => n + 1)
    playSound('dice')
    await new Promise((done) => setTimeout(done, reduced ? 0 : ROLL_MS))

    const tier = tierOf(res.dice, config)
    const big = tier < 3
    setRolling(false)
    setResult({ dice: res.dice, points: res.points, tier })
    setBalance(res.balance)
    setActor(res.points <= 0 ? 'lose' : big ? 'win' : 'idle')
    playSound(res.points <= 0 ? 'lose' : big ? 'win' : 'coin')
    if (big && res.points > 0) {
      const box = diceRef.current?.getBoundingClientRect()
      if (box) burst(box.left + box.width / 2, box.top + box.height / 2, tier === 0 ? 48 : 26)
    }
    onPlayed()
  }

  const plays = Math.max(1, playsLeft ?? 1)
  const prizes = [`${config.jackpot} KC`, `zar × ${config.doubleX}`, `toplam × ${config.highX}`, `toplam × ${config.lowX}`]
  // The middle column is narrow, so its rows use the short names; the chips under a phone stage have room for more.
  const rows: PayRow[] = ['Düşeş', 'Çift', `${config.highMin}+`, 'Diğer'].map((name, i) => ({ name, prize: prizes[i] }))
  const chips: PayRow[] = ['Düşeş (6-6)', 'Çift', `Toplam ${config.highMin}+`, 'Diğer atışlar'].map((name, i) => ({ name, prize: prizes[i] }))
  const lit = result && !rolling ? result.tier : null

  return (
    <article className="flex min-w-0 flex-col gap-3">
      <section aria-labelledby="zar-at-baslik" className="@container min-w-0">
        <h3 id="zar-at-baslik" className="sr-only">
          Zar At
        </h3>
        <div className="relative isolate aspect-[9/16] w-full overflow-hidden rounded-2xl border border-gold/25 bg-background @min-[600px]:aspect-[2/1] @min-[600px]:max-h-[600px]">
          <StageBackdrop state={actor} armed={!locked && !rolling} />
          <TableBrand center={false} corners={false} jako={false} plaque="top" />
          <StagePlaque>Zar At</StagePlaque>

          <div className="absolute top-[23.5%] left-[31.5%] hidden w-[19.5%] @min-[600px]:block">
            <PayRows label="Zar ödülleri" rows={rows} lit={lit} />
          </div>

          <div className="absolute top-[42%] left-1/2 flex w-[84%] -translate-x-1/2 flex-col items-center text-center @min-[600px]:top-[8%] @min-[600px]:left-[69.7%] @min-[600px]:w-[34%]">
            {error ? (
              <p className="rounded-lg bg-background/80 px-3 py-2 text-sm leading-5 font-semibold text-destructive">{error}</p>
            ) : result && !rolling ? (
              <div key={throws} className="wheel-rise flex flex-col items-center">
                <p className="text-[clamp(13px,3.6cqw,16px)] font-bold text-foreground tabular-nums [text-shadow:0_1px_0_rgb(0_0_0/0.7)] @min-[600px]:text-[clamp(11px,1.5cqw,15px)]">
                  {TIERS[result.tier]} · {result.dice[0]} + {result.dice[1]} = {result.dice[0] + result.dice[1]}
                </p>
                <p className="flex items-baseline gap-1.5 font-display text-[clamp(34px,11cqw,48px)] leading-[1.1] font-extrabold tracking-tight text-gold tabular-nums [text-shadow:0_2px_0_rgb(0_0_0/0.6)] @min-[600px]:text-[clamp(26px,4.6cqw,48px)]">
                  +{result.points.toLocaleString('tr-TR')}
                  <span className="text-[0.42em] font-bold tracking-normal">KC</span>
                </p>
              </div>
            ) : (
              <p className="text-[clamp(13px,3.6cqw,16px)] leading-relaxed font-semibold text-foreground/85 [text-shadow:0_1px_0_rgb(0_0_0/0.7)] @min-[600px]:text-[clamp(11px,1.5cqw,15px)]">
                {rolling ? 'Zarlar havada…' : (
                  <>
                    Düşeş gelirse <span className="font-extrabold text-gold tabular-nums">{config.jackpot} KC</span>
                  </>
                )}
              </p>
            )}
          </div>

          <div
            ref={diceRef}
            className="absolute top-[63.4%] left-1/2 flex -translate-x-1/2 gap-[10cqw] [--s:26cqw] @min-[600px]:top-[46.5%] @min-[600px]:left-[69.7%] @min-[600px]:gap-[4.6cqw] @min-[600px]:[--s:11.5cqw]"
          >
            {([0, 1] as const).map((i) => (
              <div key={i} className="relative size-(--s)">
                <span
                  key={`shade-${throws}`}
                  aria-hidden="true"
                  className={cn(
                    'absolute top-[88%] left-1/2 h-[26%] w-[120%] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(closest-side,rgb(0_0_0/0.75),transparent)]',
                    throws > 0 && 'dice-shade',
                  )}
                />
                <div key={`hop-${throws}`} className={cn(throws > 0 && 'dice-hop')} style={{ animationDelay: `${i * 70}ms` }}>
                  <Die value={shown[i]} turn={turns[i]} tone={i === 0 ? 'gold' : 'dark'} lean={i === 0 ? 16 : -16} still={reduced} />
                </div>
              </div>
            ))}
          </div>

          <div className="absolute inset-x-[6%] bottom-[4%] flex flex-col items-stretch gap-1.5 @min-[600px]:inset-x-auto @min-[600px]:bottom-[6%] @min-[600px]:left-[31.5%] @min-[600px]:w-[19.5%]">
            <ActionButton onClick={roll} disabled={rolling || locked}>
              {locked ? (
                <>
                  <Clock className="size-4" aria-hidden="true" />
                  <span className="sr-only">Sonraki atış: </span>
                  {formatRemaining(lockedFor)}
                </>
              ) : rolling ? (
                'Zarlar atılıyor…'
              ) : result ? (
                'Tekrar at'
              ) : (
                'Zar at'
              )}
            </ActionButton>
            <ActionNote>
              {locked
                ? 'Hakların 00:00’da yenilenir.'
                : playsLeft == null
                  ? `Günde ${config.dailyPlays} atış hakkın var.`
                  : `${plays} atış hakkın var.`}
            </ActionNote>
          </div>
        </div>
      </section>

      <div className="@container">
        <div className="@min-[600px]:hidden">
          <PayChips label="Zar ödülleri" rows={chips} lit={lit} columns={2} />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl border border-border bg-card px-4 py-3">
        <p className="min-w-0 flex-1 basis-56 text-sm leading-relaxed text-muted-foreground">
          Günde {config.dailyPlays} atış. Her atış kazandırır; çift gelirse puanın katlanır, düşeş jackpot verir.
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <DetailButton onClick={() => setRules(true)} label="Oyun kuralları" />
          <span className="rounded-md bg-primary/10 px-2.5 py-1 text-xs font-semibold tabular-nums text-primary">
            {locked ? formatRemaining(lockedFor) : `${plays} hak`}
          </span>
        </div>
      </div>

      <p aria-live="polite" className="sr-only">
        {error || (result && !rolling ? `${TIERS[result.tier]}: ${result.dice[0]} ve ${result.dice[1]}, ${result.points} Kanka Coin kazandın` : '')}
      </p>

      <DetailModal
        onClose={() => setRules(false)}
        content={
          rules
            ? {
                eyebrow: 'Mini oyun',
                title: 'Zar At kuralları',
                description: 'İki zar atılır, sonuca göre Kanka Coin kazanırsın. Her atış kazandırır, çift ve düşeş daha çok kazandırır.',
                prizes: [
                  { place: 'Düşeş (6-6)', prize: `Jackpot · ${config.jackpot} KC` },
                  { place: 'Çift (1-1 … 5-5)', prize: `Zar × ${config.doubleX} KC` },
                  { place: `Toplam ${config.highMin}+`, prize: `Toplam × ${config.highX} KC` },
                  { place: 'Diğer atışlar', prize: `Toplam × ${config.lowX} KC` },
                ],
                rules: [
                  `Günde ${config.dailyPlays} atış hakkın var, haklar 00:00’da yenilenir.`,
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
