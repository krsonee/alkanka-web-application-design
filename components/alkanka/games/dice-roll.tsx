'use client'

/*
  Zar At at its own table: a navy felt dice table seen from the shooter's end runs away down the stage to a padded
  wall (the same table on phones: the tall picture is the middle of the wide one), and Jako, the croupier, stands
  at its near end, lower left, with a dice cup. A die is read from its top face: what the result says is what
  the two dice show on top. There is one pair of dice, the
  two on the felt: his clips show the cup and never dice of their own. A throw makes them jump into the cup; he
  swings it out over the table and the same two fly out of its mouth, at the frame of his clip where the swing ends
  (the stage follows the clip's clock, and measures where the mouth is on screen). They fly down the table, hit the
  wall, come back off it, land twice and roll over their edges to a stop (dice-stage/throw.ts), drawn smaller the
  farther down the table they are, raising dust and a ring on the felt as they land (mini-stage/room-fx.tsx). While
  they are in the air the pay tiles light up in turn, and the one the throw made
  stays lit; coins spill onto the felt for what was won, and a double or better makes the dice jump. Across the
  top are the game's name and the four things a throw can be, each drawn with the dice that make it; what Jako
  says is beside him and the throw button is at the lower right (the stage is 9 : 16 on phones instead of 2 : 1).

  The throw itself, the daily plays and the payout happen on the server (playMini); the dice are thrown to land
  on the two values it returns.
*/

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { flushSync } from 'react-dom'
import Image from 'next/image'
import { Clock } from 'lucide-react'
import { playMini } from '@/app/actions/wallet'
import type { RewardConfig } from '@/lib/rewards-shared'
import { pacedFrames } from '@/lib/paced-frames'
import { buzz, playSound } from '@/lib/sound'
import { usePrefersReducedMotion } from '@/lib/use-motion'
import { cn } from '@/lib/utils'
import { TableBrand } from '../arena/table-brand'
import { useCatalog } from '../catalog-context'
import { DetailButton, DetailModal } from '../detail-modal'
import { usePoints } from '../points-context'
import { Die, MiniDie } from './dice-stage/die'
import { hop, REST_RISE, restSpot, scoop, settle, TABLES, throwDice, type DieRig, type Scene } from './dice-stage/throw'
import type { MiniGameProps } from './lucky-wheel'
import { formatRemaining } from './mini-status'
import { CallerBubble, StageResult, StageShade, StageTitle } from './mini-stage/caller'
import { RoomFx, type RoomFxHandle, type Zone } from './mini-stage/room-fx'
import { burst } from './wheel-stage/burst'
import { JakoActor, type ActorCast, type ActorClock, type ActorState } from './wheel-stage/jako-actor'
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

/*
  The throw clip, in seconds: Jako swings the cup out over the table and its mouth points at the felt from
  TIPPED_S until it starts back at UPRIGHT_S. The dice leave it at FLUNG_S, on the last frame of the swing, so it
  is the swing that throws them, however fast the server answers.
*/
const FLUNG_S = 1.375
const TIPPED_S = 1.417
const UPRIGHT_S = 2.542
/** The clip is given this long to reach FLUNG_S; with no clip on screen (the still picture) the dice wait STILL_MS. */
const TIP_LIMIT_MS = 3400
const STILL_MS = 700
/** Where the cup's mouth is on Jako's picture, as fractions of it: standing, and swung out over the table. */
const RIM = { left: '75.7%', top: '35.7%' }
const MOUTH = { left: '92.8%', top: '46.6%' }
/** How wide a die is while it is inside the cup, against the width of Jako's picture. */
const IN_CUP = 0.06
const START: Pair = [5, 3]
/** How far each die is turned about the upright at rest: its value is on top, and two sides show under it. */
const LEANS = [24, -18]
/** Coins that spill onto the felt, by what the throw was. */
const COINS = [30, 16, 9, 4]
/** Where dust hangs in the lamp light over the felt. */
const DUST: { wide: Zone; tall: Zone } = { wide: { x: [0.28, 0.92], y: [0.06, 0.8] }, tall: { x: [0.02, 0.98], y: [0.2, 0.84] } }

/*
  The croupier: cup in hand while waiting, the cup swung out over the table for the throw, and the cup raised for
  a double or better. Every throw pays. Each clip is played out and back over the same frames, so it ends on the
  frame it began on. The picture is wide enough for the arm at full stretch, which is why he stands so far left in it.
*/
const CROUPIER: ActorCast = {
  still: '/images/dice/jako.webp',
  clips: { idle: '/video/dice/jako-idle.mp4', spin: '/video/dice/jako-spin.mp4', win: '/video/dice/jako-win.mp4' },
  frame: { width: 1100, height: 680 },
  mirrored: true,
  beats: { spin: { hold: TIPPED_S, back: UPRIGHT_S }, win: { hold: 2, back: 2 } },
  backRate: 1.8,
}
/*
  Jako's picture on the stage; the cup's two mouths are placed on the same box. On phones he is small enough for
  the swung cup to stop short of what he says.
*/
const CROUPIER_BOX = 'pointer-events-none absolute bottom-0 left-[-36.2%] aspect-[1100/680] w-[94.6%] @min-[600px]:left-[-11.35%] @min-[600px]:w-[61.24%]'

/*
  Where the dice come to rest on the felt, in table units (die widths right of the middle, and down the table from
  its near end): on the wide stage, and on the tall one. The table's perspective turns that into a place on the
  stage and a size, so the nearer die is the larger. On the wide stage they lie right of the cup.
*/
const RESTS: { wide: [number, number][]; tall: [number, number][] } = {
  wide: [
    [1.02, 4.1],
    [2.4, 2.85],
  ],
  tall: [
    [-0.8, 1.9],
    [0.75, 1.2],
  ],
}

/** A little scatter per throw (in die widths, and degrees of lean), so two throws never land on the same spot. */
const SCATTER = [
  [0, 0, 0],
  [-0.2, 0.16, -7],
  [0.16, -0.2, 9],
  [-0.1, -0.22, 5],
  [0.22, 0.12, -11],
]

const scatterOf = (i: number, throws: number) => SCATTER[(throws + i * 2) % SCATTER.length]

/** Where die `i` rests on throw number `throws`, in table units. */
function restOf(layout: 'wide' | 'tall', i: number, throws: number): [number, number] {
  const [dx, dz] = scatterOf(i, throws)
  return [RESTS[layout][i][0] + dx, RESTS[layout][i][1] + dz]
}

/*
  The resting place as the stage's own percentages, for both shapes of stage: the box is put with its lower part on
  the spot where the die touches the felt.
*/
const REST_BOX = cn(
  'absolute top-(--py) left-(--px) size-(--s) [--s:var(--ps)]',
  '@min-[600px]:top-(--ly) @min-[600px]:left-(--lx) @min-[600px]:[--s:var(--ls)]',
)

function restVars(i: number, throws: number) {
  const wide = restSpot(TABLES.wide, ...restOf('wide', i, throws))
  const tall = restSpot(TABLES.tall, ...restOf('tall', i, throws))
  const n = (v: number) => v.toFixed(3)
  return {
    '--lx': `${n(wide.left)}%`,
    '--ly': `${n(wide.top)}%`,
    '--ls': `${n(wide.size)}cqw`,
    '--px': `${n(tall.left)}%`,
    '--py': `${n(tall.top)}%`,
    '--ps': `${n(tall.size)}cqw`,
    translate: `-50% ${n(-(0.5 + REST_RISE) * 100)}%`,
  } as CSSProperties
}

type Result = { dice: Pair; points: number; tier: number }
type Frames = ReturnType<typeof pacedFrames>

/** `draw` is where a throw's outcome comes from: the server, unless a preview passes its own. */
export function DiceRoll({ lockedFor, playsLeft, canPlay, onPlayed, draw = serverDraw }: MiniGameProps & { draw?: DiceDraw }) {
  const { setBalance } = usePoints()
  const config = useCatalog().rewards.dice
  const reduced = usePrefersReducedMotion()
  const locked = lockedFor > 0
  const [shown, setShown] = useState<Pair>(START)
  const [throws, setThrows] = useState(0)
  const [rolling, setRolling] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState('')
  const [mood, setMood] = useState<ActorState>('idle')
  const [rules, setRules] = useState(false)
  const [chase, setChase] = useState<number | null>(null)
  /** The dice have left the cup. */
  const [flying, setFlying] = useState(false)
  const stageRef = useRef<HTMLDivElement>(null)
  const feltRef = useRef<HTMLSpanElement>(null)
  const rimRef = useRef<HTMLSpanElement>(null)
  const mouthRef = useRef<HTMLSpanElement>(null)
  /** Which of Jako's clips is on screen and how far into it, written by his player on every frame. */
  const clock = useRef<ActorClock>({ clip: null, time: 0 })
  const gone = useRef(false)
  const fx = useRef<RoomFxHandle>(null)
  const rests = useRef<(HTMLDivElement | null)[]>([])
  const movers = useRef<(HTMLDivElement | null)[]>([])
  const cubes = useRef<(HTMLDivElement | null)[]>([])
  const shades = useRef<(HTMLSpanElement | null)[]>([])
  /* the throw and the jump after a good one run on their own loops, so a new throw can cut the jump short */
  const throwLoop = useRef<Frames | null>(null)
  const hopLoop = useRef<Frames | null>(null)

  useEffect(() => {
    gone.current = false
    return () => {
      gone.current = true
      throwLoop.current?.cancel()
      hopLoop.current?.cancel()
    }
  }, [])

  const layout = () => ((stageRef.current?.offsetWidth ?? 0) >= 600 ? 'wide' : 'tall')

  /** The stage as it is on screen right now, with one of the cup's mouths as where the dice go to or come from. */
  function sceneFor(target: HTMLElement | null): Scene | null {
    const stage = stageRef.current?.getBoundingClientRect()
    const to = target?.getBoundingClientRect()
    if (!stage || !to) return null
    return {
      table: TABLES[layout()],
      width: stage.width,
      height: stage.height,
      from: { x: to.left - stage.left, y: to.top - stage.top },
      inCup: (target?.parentElement?.offsetWidth ?? 0) * IN_CUP,
    }
  }

  const cupTipped = () => clock.current.clip === 'spin' && clock.current.time >= FLUNG_S && clock.current.time < UPRIGHT_S

  /** Waits for the frame of the throw clip where the cup has been swung out over the table. */
  function tip() {
    return new Promise<void>((done) => {
      const started = performance.now()
      const check = () => {
        const waited = performance.now() - started
        const limit = clock.current.clip === null ? STILL_MS : TIP_LIMIT_MS
        if (gone.current || cupTipped() || waited >= limit) done()
        else setTimeout(check, 25)
      }
      check()
    })
  }

  /* while the dice are in the air the pay tiles light up one after another */
  useEffect(() => {
    if (!rolling || reduced) {
      setChase(null)
      return
    }
    let at = 0
    setChase(0)
    const timer = setInterval(() => setChase((at = (at + 1) % 4)), 120)
    return () => clearInterval(timer)
  }, [rolling, reduced])

  const bigWin = Boolean(result && !rolling && result.tier < 3)
  useEffect(() => {
    fx.current?.glints(
      rolling || locked ? [] : rests.current.map((el) => ({ el, rate: bigWin ? 2.4 : 0.35, box: [0.1, 0, 0.9, 0.7] as [number, number, number, number] })),
    )
  }, [rolling, locked, bigWin])

  /** The two dice as the throw code moves them, leaning the way they do on throw number `count`. */
  function rigsFor(count: number): DieRig[] | null {
    const list: DieRig[] = []
    const shape = layout()
    for (const i of [0, 1]) {
      const mover = movers.current[i]
      const cube = cubes.current[i]
      const shade = shades.current[i]
      if (!mover || !cube || !shade) return null
      const faces = Array.from(cube.querySelectorAll<HTMLElement>('[data-shade]'))
      list.push({ mover, cube, faces, shade, lean: LEANS[i] + scatterOf(i, count)[2], at: restOf(shape, i, count) })
    }
    return list
  }

  async function roll() {
    if (rolling || !canPlay()) return
    hopLoop.current?.cancel()
    const loop = (throwLoop.current ??= pacedFrames(60))
    setRolling(true)
    setFlying(false)
    setError('')
    setMood('spin')
    const lying = reduced ? null : rigsFor(throws)
    /* the dice on the felt go into the cup while it still stands */
    const rim = lying && sceneFor(rimRef.current)
    const cleared =
      lying && rim
        ? scoop(loop, lying, shown, rim, (die) => {
            playSound('tile', 0.5)
            if (die === 0) buzz(8)
          })
        : Promise.resolve()
    const res = await draw()
    await Promise.all([reduced ? null : tip(), cleared])
    if (gone.current) return
    if (!res.ok) {
      lying?.forEach((rig, i) => settle(rig, shown[i]))
      setRolling(false)
      setMood('idle')
      setError(res.error)
      if (typeof res.balance === 'number') setBalance(res.balance)
      return
    }
    /* the dice are in the cup: move them to this throw's resting places before they come out of it */
    const count = throws + 1
    flushSync(() => {
      setResult(null)
      setShown(res.dice)
      setThrows(count)
      setFlying(true)
    })
    const dice = reduced ? null : rigsFor(count)
    /* out of the swung cup's mouth; out of the top if the cup is standing (no clip, or a very late answer) */
    const mouth = dice && sceneFor(cupTipped() ? mouthRef.current : rimRef.current)
    if (dice && mouth) {
      playSound('dice', 0.6)
      await throwDice(loop, dice, res.dice, mouth, (die, kind, power) => {
        if (kind === 'wall') {
          /* the padding at the far end: a dull knock, and a little dust where the die met it */
          fx.current?.puff(fx.current.spot(dice[die].mover), 0.4)
          playSound('tile', 0.7)
          if (die === 0) buzz(6)
          return
        }
        if (kind === 'flop') {
          /* over an edge and down onto a face */
          fx.current?.puff(fx.current.spot(dice[die].shade), power * 0.7)
          playSound('tile', power)
          return
        }
        const at = fx.current?.spot(dice[die].shade) ?? null
        const first = power === 1
        fx.current?.puff(at, power)
        if (first) fx.current?.ring(at, dice[die].mover.getBoundingClientRect().width * 1.3, 0.3)
        playSound(first ? 'dice' : 'tile', power)
        if (first && die === 0) buzz(12)
      })
    } else if (dice) {
      dice.forEach((rig, i) => settle(rig, res.dice[i]))
    }
    if (gone.current) return

    const tier = tierOf(res.dice, config)
    const big = tier < 3
    setRolling(false)
    setResult({ dice: res.dice, points: res.points, tier })
    setBalance(res.balance)
    setMood(big ? 'win' : 'idle')
    playSound(big ? 'win' : 'coin')
    if (dice) {
      const size = dice[0].mover.offsetWidth
      const felt = fx.current?.spot(feltRef.current) ?? null
      fx.current?.coins(felt, COINS[tier], { floor: (felt?.y ?? 0) + size * 0.55, depth: size * 0.5, spread: big ? 1 : 0.55, lift: big ? 0.82 : 0.6 })
      if (big) {
        fx.current?.flash(felt, size * 3.2)
        fx.current?.sparks(felt, tier === 0 ? 46 : 22)
        buzz(tier === 0 ? [20, 40, 30] : 18)
        void hop((hopLoop.current ??= pacedFrames(60)), dice, res.dice, (die) => {
          fx.current?.puff(fx.current.spot(dice[die].shade), 0.45)
          playSound('tile', 0.45)
        })
      }
    }
    if (tier === 0) {
      const box = feltRef.current?.getBoundingClientRect()
      if (box) burst(box.left, box.top, 40)
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
  const says = error
    ? error
    : rolling
      ? flying
        ? 'Zarlar havada…'
        : 'Zarlar kupada, sallıyorum…'
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
        <div
          ref={stageRef}
          className="relative isolate aspect-[9/16] w-full overflow-hidden rounded-2xl border border-gold/25 bg-background @min-[600px]:aspect-[2/1] @min-[600px]:max-h-[600px]"
        >
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
                  'flex min-w-0 flex-col items-center gap-[0.3em] rounded-xl px-1 py-[0.65em] text-center text-[clamp(10px,2.9cqw,12px)] leading-tight transition-colors duration-150 @min-[600px]:text-[clamp(10px,1.25cqw,13px)]',
                  settled?.tier === i
                    ? 'tier-lit bg-gold/25 inset-ring-2 inset-ring-gold'
                    : chase === i
                      ? 'bg-gold/15 inset-ring inset-ring-gold/70'
                      : 'bg-background/75 inset-ring inset-ring-foreground/15',
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

          <span
            aria-hidden="true"
            className="room-breathe pointer-events-none absolute top-[60%] left-1/2 h-[26%] w-[120%] -translate-1/2 rounded-[50%] bg-[radial-gradient(closest-side,color-mix(in_oklch,var(--gold)_15%,transparent),transparent)] mix-blend-plus-lighter @min-[600px]:top-[54%] @min-[600px]:left-[64%] @min-[600px]:h-[44%] @min-[600px]:w-[48%]"
          />
          <span ref={feltRef} aria-hidden="true" className="absolute top-[61.5%] left-1/2 @min-[600px]:top-[60.5%] @min-[600px]:left-[63%]" />
          {settled && settled.tier < 3 && (
            <span
              key={`glow-${throws}`}
              aria-hidden="true"
              className="felt-glow absolute top-[63%] left-1/2 h-[22%] w-[92%] -translate-1/2 rounded-[50%] bg-[radial-gradient(closest-side,color-mix(in_oklch,var(--gold)_38%,transparent),transparent)] @min-[600px]:top-[62%] @min-[600px]:left-[63%] @min-[600px]:h-[34%] @min-[600px]:w-[42%]"
            />
          )}

          <div className={CROUPIER_BOX}>
            <JakoActor cast={CROUPIER} state={mood} armed={!locked} clock={clock} className="absolute inset-0" />
            <span ref={rimRef} aria-hidden="true" className="absolute" style={RIM} />
            <span ref={mouthRef} aria-hidden="true" className="absolute" style={MOUTH} />
          </div>

          {/* after Jako, so the dice are drawn over his cup as they go in and come out */}
          {([0, 1] as const).map((i) => {
            const lean = scatterOf(i, throws)[2]
            return (
              <div
                key={i}
                ref={(el) => {
                  rests.current[i] = el
                }}
                className={REST_BOX}
                style={restVars(i, throws)}
              >
                <span
                  ref={(el) => {
                    shades.current[i] = el
                  }}
                  aria-hidden="true"
                  /* under the whole footprint of the cube, which is seen from well above */
                  className="absolute top-[36%] left-[-46%] h-[116%] w-[192%] rounded-[50%] bg-[radial-gradient(closest-side,rgb(0_0_0/0.85)_48%,transparent)]"
                />
                <Die
                  value={shown[i]}
                  tone={i === 0 ? 'gold' : 'dark'}
                  lean={LEANS[i] + lean}
                  moverRef={(el) => {
                    movers.current[i] = el
                  }}
                  cubeRef={(el) => {
                    cubes.current[i] = el
                  }}
                />
              </div>
            )
          })}

          <RoomFx ref={fx} zone={DUST} />

          <div className="absolute right-[4%] bottom-[2.5%] left-[35%] flex flex-col items-stretch gap-1.5 @min-[600px]:contents">
            <CallerBubble
              tail="left"
              tone={error ? 'error' : 'plain'}
              /* on phones it stands clear of the cup, which the dice go into and come out of */
              className="w-[62%] self-end @min-[600px]:absolute @min-[600px]:bottom-[7%] @min-[600px]:left-[39%] @min-[600px]:w-auto @min-[600px]:max-w-[31%]"
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
