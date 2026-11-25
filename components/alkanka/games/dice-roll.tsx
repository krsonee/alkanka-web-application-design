'use client'

/*
  Zar At at its own table: a navy felt dice table fills the stage and the two dice are thrown onto it from the
  player's corner. Across the top are the game's name and the four things a throw can be, each drawn with the dice
  that make it; Jako leans in at the lower left and says what is going on, the throw button is at the lower right
  (beside him on phones, where the stage is 9 : 16 instead of 2 : 1).

  The throw itself, the daily plays and the payout happen on the server (playMini); the dice only turn to the two
  values it returns.
*/

import { useRef, useState } from 'react'
import Image from 'next/image'
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
import { Die, MiniDie, restingTurn, rollTo, type DieTurn } from './dice-stage/die'
import type { MiniGameProps } from './lucky-wheel'
import { formatRemaining } from './mini-status'
import { CallerBubble, JakoCaller, StageResult, StageShade, StageTitle, type CallerMood } from './mini-stage/caller'
import { burst } from './wheel-stage/burst'
import { ActionButton, ActionNote } from './wheel-stage/parts'

type Pair = [number, number]

export type DiceDraw = () => Promise<{ ok: true; dice: Pair; points: number; balance: number } | { ok: false; error: string; balance?: number }>

const serverDraw: DiceDraw = async () => {
  const res = await playMini('zar')
  if (res.ok && res.game === 'zar') return { ok: true, dice: res.dice, points: res.points, balance: res.balance }
  return { ok: false, error: res.ok ? 'Zar atılamadı, tekrar dene.' : res.error, balance: res.balance }
}

const TIERS = ['Düşeş', 'Çift', 'Yüksek atış', 'Atış']
const CHEERS = ['Düşeş! Helal kanka.', 'Çift geldi, katladın.', 'Yüksek attın kanka.', 'Bu da cebe girdi.']

/** Which row of the pay table a throw falls in; the same order the server pays by. */
const tierOf = ([a, b]: Pair, dice: RewardConfig['dice']) => (a === 6 && b === 6 ? 0 : a === b ? 1 : a + b >= dice.highMin ? 2 : 3)

/** Two unequal dice that add up to the lowest total counted as a high throw, for that tile's picture. */
function highPair(min: number): Pair {
  const a = Math.min(6, Math.ceil(min / 2) + 1)
  return [a, Math.min(6, Math.max(1, min - a))]
}

const ROLL_MS = 1250
const START: Pair = [5, 3]

/*
  Where the dice come to rest on the felt (percentages of the stage) and how big they are; the nearer one is larger.
  --from-x / --from-y is the corner they are thrown in from: the throw button's side, off the stage.
*/
const RESTS = [
  'top-[57.5%] left-[37%] [--s:22cqw] [--from-x:34cqw] [--from-y:96cqw] @min-[600px]:top-[56%] @min-[600px]:left-[43%] @min-[600px]:[--s:9cqw] @min-[600px]:[--from-x:44cqw] @min-[600px]:[--from-y:26cqw]',
  'top-[65%] left-[64%] [--s:25cqw] [--from-x:24cqw] [--from-y:84cqw] @min-[600px]:top-[63.5%] @min-[600px]:left-[54.5%] @min-[600px]:[--s:10.5cqw] @min-[600px]:[--from-x:36cqw] @min-[600px]:[--from-y:22cqw]',
]

/** A little scatter per throw (in die widths, and degrees of lean), so two throws never land on the same spot. */
const SCATTER = [
  [0, 0, 0],
  [-0.2, 0.1, -7],
  [0.16, -0.12, 9],
  [-0.1, -0.14, 5],
  [0.22, 0.08, -11],
]

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
  const [mood, setMood] = useState<CallerMood>('idle')
  const [rules, setRules] = useState(false)
  const feltRef = useRef<HTMLSpanElement>(null)

  async function roll() {
    if (rolling || !canPlay()) return
    setRolling(true)
    setError('')
    setMood('busy')
    const res = await draw()
    if (!res.ok) {
      setRolling(false)
      setMood('idle')
      setError(res.error)
      if (typeof res.balance === 'number') setBalance(res.balance)
      return
    }
    setResult(null)
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
    setMood(big && res.points > 0 ? 'win' : 'idle')
    playSound(res.points <= 0 ? 'lose' : big ? 'win' : 'coin')
    if (big && res.points > 0) {
      const box = feltRef.current?.getBoundingClientRect()
      if (box) burst(box.left, box.top, tier === 0 ? 48 : 26)
    }
    onPlayed()
  }

  const plays = Math.max(1, playsLeft ?? 1)
  const tiers: { name: string; prize: string; faces: Pair }[] = [
    { name: 'Düşeş', prize: `${config.jackpot} KC`, faces: [6, 6] },
    { name: 'Çift', prize: `zar × ${config.doubleX}`, faces: [3, 3] },
    { name: `Toplam ${config.highMin}+`, prize: `toplam × ${config.highX}`, faces: highPair(config.highMin) },
    { name: 'Diğer', prize: `toplam × ${config.lowX}`, faces: [2, 1] },
  ]
  const settled = result && !rolling ? result : null
  const lit = settled ? settled.tier : null
  const says = error
    ? error
    : rolling
      ? 'Zarlar havada…'
      : settled
        ? CHEERS[settled.tier]
        : locked
          ? 'Bugünkü atışların bitti, yarın yine gel.'
          : 'Zarları at kanka, her atış kazandırır.'

  return (
    <article className="flex min-w-0 flex-col gap-3">
      <section aria-labelledby="zar-at-baslik" className="@container min-w-0">
        <h3 id="zar-at-baslik" className="sr-only">
          Zar At
        </h3>
        <div className="relative isolate aspect-[9/16] w-full overflow-hidden rounded-2xl border border-gold/25 bg-background @min-[600px]:aspect-[2/1] @min-[600px]:max-h-[600px]">
          <Image src="/images/dice/table-mobile.webp" alt="" fill sizes="100vw" priority className="object-cover @min-[600px]:hidden" />
          <Image
            src="/images/dice/table-desktop.webp"
            alt=""
            fill
            sizes="(min-width: 1280px) 1024px, 100vw"
            priority
            className="hidden object-cover @min-[600px]:block"
          />
          <StageShade />
          <TableBrand center={false} corners={false} jako={false} plaque="top" />
          <StageTitle
            title="Zar At"
            sub={
              <>
                Düşeş <span className="text-gold">{config.jackpot} KC</span>
              </>
            }
          />

          <ol
            aria-label="Zar ödülleri"
            className="absolute inset-x-[4%] top-[14%] grid grid-cols-4 gap-[1.6cqw] @min-[600px]:inset-x-auto @min-[600px]:top-[6.5%] @min-[600px]:right-[3.5%] @min-[600px]:w-[52%] @min-[600px]:gap-[0.8cqw]"
          >
            {tiers.map((tier, i) => (
              <li
                key={i}
                className={cn(
                  'flex min-w-0 flex-col items-center gap-[0.3em] rounded-xl px-1 py-[0.65em] text-center text-[clamp(10px,2.9cqw,12px)] leading-tight transition-colors duration-200 @min-[600px]:text-[clamp(10px,1.25cqw,13px)]',
                  lit === i ? 'bg-gold/25 inset-ring-2 inset-ring-gold' : 'bg-background/75 inset-ring inset-ring-foreground/15',
                )}
              >
                <span className="flex gap-[0.22em] text-[1.3em]">
                  <MiniDie value={tier.faces[0]} />
                  <MiniDie value={tier.faces[1]} />
                </span>
                <span className="w-full truncate font-bold text-foreground">{tier.name}</span>
                <span className="w-full truncate font-extrabold text-gold tabular-nums">{tier.prize}</span>
              </li>
            ))}
          </ol>

          {settled && (
            <StageResult
              key={throws}
              className="top-[27%] @min-[600px]:top-[24.5%]"
              points={settled.points}
              label={`${TIERS[settled.tier]} · ${settled.dice[0]} + ${settled.dice[1]} = ${settled.dice[0] + settled.dice[1]}`}
            />
          )}

          <span ref={feltRef} aria-hidden="true" className="absolute top-[61.5%] left-1/2 @min-[600px]:top-[60%]" />
          {settled && settled.tier < 3 && (
            <span
              key={`glow-${throws}`}
              aria-hidden="true"
              className="wheel-fade absolute top-[63%] left-1/2 h-[22%] w-[92%] -translate-1/2 rounded-[50%] bg-[radial-gradient(closest-side,color-mix(in_oklch,var(--gold)_38%,transparent),transparent)] @min-[600px]:top-[61.5%] @min-[600px]:h-[34%] @min-[600px]:w-[42%]"
            />
          )}

          {([0, 1] as const).map((i) => {
            const [dx, dy, lean] = SCATTER[(throws + i * 2) % SCATTER.length]
            return (
              <div
                key={i}
                className={cn('absolute size-(--s) -translate-1/2', RESTS[i])}
                style={{ marginLeft: `calc(var(--s) * ${dx})`, marginTop: `calc(var(--s) * ${dy})` }}
              >
                <span
                  key={`shade-${throws}`}
                  aria-hidden="true"
                  className={cn(
                    'absolute top-[84%] left-1/2 h-[30%] w-[130%] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(closest-side,rgb(0_0_0/0.8),transparent)]',
                    throws > 0 && 'dice-shade',
                  )}
                />
                <div key={`throw-${throws}`} className={cn(throws > 0 && 'dice-throw')} style={{ animationDelay: `${i * 90}ms` }}>
                  <Die value={shown[i]} turn={turns[i]} tone={i === 0 ? 'gold' : 'dark'} lean={(i === 0 ? 24 : -18) + lean} still={reduced} />
                </div>
              </div>
            )
          })}

          <JakoCaller mood={mood} className="left-[-10%] w-[52%] @min-[600px]:left-[-5%] @min-[600px]:w-[30%]" />

          <div className="absolute right-[4%] bottom-[2.5%] left-[35%] flex flex-col items-stretch gap-1.5 @min-[600px]:contents">
            <CallerBubble
              tail="left"
              tone={error ? 'error' : 'plain'}
              className="self-start @min-[600px]:absolute @min-[600px]:bottom-[8%] @min-[600px]:left-[20.5%] @min-[600px]:max-w-[25%]"
            >
              {says}
            </CallerBubble>
            <div className="flex flex-col items-stretch gap-1.5 @min-[600px]:absolute @min-[600px]:right-[3.5%] @min-[600px]:bottom-[4.5%] @min-[600px]:w-[24%]">
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
        </div>
      </section>

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
        {error || (settled ? `${TIERS[settled.tier]}: ${settled.dice[0]} ve ${settled.dice[1]}, ${settled.points} Kanka Coin kazandın` : '')}
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
