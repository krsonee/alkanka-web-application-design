'use client'

/*
  Gizemli Sandık in its own room: a vault with three plinths, one chest on each (the middle one on the taller
  plinth; on phones the three stand as a triangle). Each chest's reward range is on a plate on its plinth. Jako,
  the keeper, stands at the lower right with the vault's key. What he says is over his head (beside him on
  phones, where the stage is 9 : 16).

  While they wait the chests stir now and then, light slides over their metal and their keyholes glow. Choosing
  one puts it under the ceiling lamp; Jako points and the key's light flies to its lock, the chest shakes and
  light leaks from under its lid until the server answers. Then it is thrown open under turning rays, its coins
  spill onto the floor (mini-stage/room-fx.tsx), the win counts up across the top of the vault, and the other two
  chests open one after the other to show what they held.

  Which chest pays what is decided on the server (playMini) once a chest is chosen; this component shows the chosen
  chest opening and what the other two held.
*/

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { Clock } from 'lucide-react'
import { playMini } from '@/app/actions/wallet'
import { CHEST_IDS } from '@/lib/rewards-shared'
import { buzz, playSound } from '@/lib/sound'
import { usePrefersReducedMotion } from '@/lib/use-motion'
import { cn } from '@/lib/utils'
import { TableBrand } from '../arena/table-brand'
import { useCatalog } from '../catalog-context'
import { DetailButton, DetailModal } from '../detail-modal'
import { usePoints } from '../points-context'
import type { MiniGameProps } from './lucky-wheel'
import { formatRemaining } from './mini-status'
import { CallerBubble, StageResult, StageShade, StageTitle } from './mini-stage/caller'
import { RoomFx, type RoomFxHandle, type Zone } from './mini-stage/room-fx'
import { burst } from './wheel-stage/burst'
import { JakoActor, type ActorCast, type ActorState } from './wheel-stage/jako-actor'
import { ActionButton } from './wheel-stage/parts'

const rulesFor = (dailyPlays: number) => [
  `Günde ${dailyPlays} sandık hakkın var, haklar her gün 00:00’da yenilenir.`,
  'Her sandıkta garantili ödül vardır, boş sandık yoktur.',
  'Hangi sandığı açacağını sen seçersin; her sandığın ödül aralığı üstünde yazar.',
  'Kazanılan Kanka Coin anında bakiyene eklenir.',
  'Promo kod ödülleri hesabındaki “Kodlarım” alanına düşer, 7 gün geçerlidir.',
  'Bot, çoklu hesap veya otomasyon tespit edilirse ödüller iptal edilir.',
]

export type ChestDraw = (
  index: number,
) => Promise<{ ok: true; prizes: number[]; points: number; balance: number } | { ok: false; error: string; balance?: number }>

const serverDraw: ChestDraw = async (index) => {
  const res = await playMini('sandik', index)
  if (res.ok && res.game === 'sandik') return { ok: true, prizes: res.prizes, points: res.points, balance: res.balance }
  return { ok: false, error: res.ok ? 'Sandık açılamadı, tekrar dene.' : res.error, balance: res.balance }
}

type Phase = 'idle' | 'opening' | 'opened'

/** Jako's pointing wing is out this long after a chest is chosen; the key's light leaves it then. */
const POINT_MS = 460
const FLIGHT_MS = 340
/** The least a lock takes to give once the key is in it, however fast the server answers. */
const LOCK_MS = 620
/** The other two chests open this long after the chosen one, and this long after each other. */
const OTHERS_MS = 620
const OTHERS_GAP_MS = 340

/** Where each chest's keyhole is on its picture, as fractions of it. */
const KEYHOLES: Record<string, [number, number]> = { gold: [0.66, 0.53], silver: [0.66, 0.55], bronze: [0.63, 0.56] }
const keyholeOf = (id: string) => KEYHOLES[id] ?? [0.65, 0.54]
/** The part of a chest's picture its metal is in, for glints. */
const METAL: [number, number, number, number] = [0.16, 0.24, 0.86, 0.78]
/** Where dust hangs in the lamp light of the vault. */
const DUST: { wide: Zone; tall: Zone } = { wide: { x: [0.22, 0.78], y: [0.04, 0.82] }, tall: { x: [0.04, 0.96], y: [0.1, 0.8] } }

const wait = (ms: number) => new Promise<void>((done) => setTimeout(done, ms))

/** The keeper: key in hand while waiting, the key offered while the lock turns, the key held up over a win. No chest is empty. */
const KEEPER: ActorCast = {
  still: '/images/chests/jako.webp',
  clips: { idle: '/video/chests/jako-idle.mp4', spin: '/video/chests/jako-spin.mp4', win: '/video/chests/jako-win.mp4' },
  frame: { width: 896, height: 640 },
}

const rewardRange = (rewards: number[]) => `${Math.min(...rewards)}–${Math.max(...rewards)} KC`

/** "Altın Sandık" as "Altın": the plate sits under the chest it names. */
const shortName = (name: string) => name.replace(/\s+sandık$/i, '') || name

/*
  Where each chest stands, by its place in the list: on the left, middle and right plinth of the vault art.
  Percentages of the stage; the chest art has a margin of its own under it, which is where the plate goes.
*/
const SPOTS = [
  'left-[21.8%] bottom-[21.6%] z-[2] w-[37%] @min-[600px]:left-[30.2%] @min-[600px]:bottom-[19.6%] @min-[600px]:w-[17.5%]',
  'left-1/2 bottom-[31.4%] z-[1] w-[45%] @min-[600px]:bottom-[20.7%] @min-[600px]:w-[21.5%]',
  'left-[78.2%] bottom-[19.8%] z-[2] w-[37%] @min-[600px]:left-[69.6%] @min-[600px]:bottom-[19.6%] @min-[600px]:w-[17.5%]',
]

/** `draw` is where an opened chest's outcome comes from: the server, unless a preview passes its own. */
export function MysteryChests({ lockedFor, playsLeft, canPlay, onPlayed, draw = serverDraw }: MiniGameProps & { draw?: ChestDraw }) {
  const { setBalance } = usePoints()
  const config = useCatalog().rewards.chest
  const reduced = usePrefersReducedMotion()
  const chests = config.chests.map((chest, i) => ({ ...chest, id: CHEST_IDS[i] ?? 'bronze' }))
  const jackpot = Math.max(...chests.flatMap((chest) => chest.rewards))
  const locked = lockedFor > 0
  const [phase, setPhase] = useState<Phase>('idle')
  const [picked, setPicked] = useState<number | null>(null)
  const [contents, setContents] = useState<number[]>([])
  const [won, setWon] = useState(0)
  const [error, setError] = useState('')
  const [mood, setMood] = useState<ActorState>('idle')
  const [rules, setRules] = useState(false)
  /** The key is in the lock: the chest shakes harder and light leaks from under its lid. */
  const [turned, setTurned] = useState(false)
  /** The chests that were not chosen and have been opened to show what they held. */
  const [lifted, setLifted] = useState<number[]>([])
  const chestRefs = useRef<(HTMLButtonElement | null)[]>([])
  const handRef = useRef<HTMLSpanElement>(null)
  const fx = useRef<RoomFxHandle>(null)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const gone = useRef(false)

  useEffect(() => {
    gone.current = false
    return () => {
      gone.current = true
      timers.current.forEach(clearTimeout)
    }
  }, [])

  const chestCount = chests.length
  useEffect(() => {
    const list = chestRefs.current.slice(0, chestCount)
    if (phase === 'idle' && lockedFor <= 0) {
      fx.current?.glints(list.map((el, i) => ({ el, rate: i === 1 ? 1.1 : 0.5, box: METAL })))
    } else if (phase === 'opened' && picked !== null) {
      fx.current?.glints([{ el: list[picked], rate: 5, box: [0.22, 0.3, 0.8, 0.62] }])
    } else {
      fx.current?.glints([])
    }
  }, [phase, picked, lockedFor, chestCount])

  /* with the key in the lock, sparks leak from under the lid until it gives */
  useEffect(() => {
    if (!turned || phase !== 'opening' || picked === null) return
    const el = chestRefs.current[picked]
    const timer = setInterval(() => {
      fx.current?.sparks(fx.current.spot(el, 0.26 + Math.random() * 0.5, 0.43), 2, 0.4)
    }, 150)
    return () => clearInterval(timer)
  }, [turned, phase, picked])

  /** The key's light leaves Jako's wing, flies to the chest's lock and turns in it. */
  async function turnKey(index: number) {
    const el = chestRefs.current[index]
    const [kx, ky] = keyholeOf(chests[index]?.id ?? '')
    await wait(POINT_MS)
    await fx.current?.streak(fx.current.spot(handRef.current), fx.current.spot(el, kx, ky), FLIGHT_MS)
    if (gone.current) return
    const lock = fx.current?.spot(el, kx, ky) ?? null
    fx.current?.flash(lock, (el?.offsetWidth ?? 0) * 0.42)
    fx.current?.sparks(lock, 12, 0.6)
    playSound('tick')
    buzz(10)
    setTurned(true)
    await wait(LOCK_MS)
  }

  async function open(index: number) {
    if (phase !== 'idle' || !canPlay()) return
    setPicked(index)
    setPhase('opening')
    setTurned(false)
    setLifted([])
    setError('')
    setMood('spin')
    playSound('chip')
    const [res] = await Promise.all([draw(index), reduced ? null : turnKey(index)])
    if (gone.current) return
    if (!res.ok) {
      setPhase('idle')
      setPicked(null)
      setTurned(false)
      setMood('idle')
      setError(res.error)
      if (typeof res.balance === 'number') setBalance(res.balance)
      return
    }
    setContents(res.prizes)
    setWon(res.points)
    setPhase('opened')
    setBalance(res.balance)
    setMood('win')
    playSound('win')
    const top = res.points >= jackpot
    const el = chestRefs.current[index]
    if (el && fx.current) {
      const size = el.offsetWidth
      const mouth = fx.current.spot(el, 0.5, 0.5)
      /* the floor in front of the plinth, below the plate */
      const foot = fx.current.spot(el, 0.5, 1.1)
      fx.current.flash(mouth, size * 1.15)
      fx.current.ring(fx.current.spot(el, 0.5, 0.82), size * 0.95, 0.3)
      fx.current.sparks(mouth, top ? 54 : 28)
      fx.current.coins(mouth, Math.round(9 + 30 * Math.min(1, res.points / jackpot)), { floor: foot?.y, depth: size * 0.1, lift: 1.1 })
      buzz(top ? [20, 40, 30] : 18)
      timers.current.push(setTimeout(() => playSound('coin'), 420))
    }
    if (top && el) {
      const box = el.getBoundingClientRect()
      burst(box.left + box.width / 2, box.top + box.height * 0.45, 40)
    }
    const others = chests.map((_, i) => i).filter((i) => i !== index)
    if (reduced) setLifted(others)
    else
      others.forEach((i, n) => {
        timers.current.push(
          setTimeout(
            () => {
              setLifted((list) => [...list, i])
              fx.current?.puff(fx.current.spot(chestRefs.current[i], 0.5, 0.5), 0.6)
              playSound('tile', 0.6)
            },
            OTHERS_MS + n * OTHERS_GAP_MS,
          ),
        )
      })
    onPlayed()
  }

  function reset() {
    timers.current.forEach(clearTimeout)
    timers.current = []
    setPhase('idle')
    setPicked(null)
    setTurned(false)
    setLifted([])
    setMood('idle')
  }

  const revealed = phase === 'opened'
  const plays = Math.max(1, playsLeft ?? 1)
  const says = error
    ? error
    : phase === 'opening'
      ? turned
        ? 'Kilit dönüyor…'
        : 'Anahtar geliyor kanka…'
      : revealed
        ? won >= jackpot
          ? 'Jackpot! Helal kanka.'
          : 'Helal kanka, cebe girdi.'
        : locked
          ? 'Bugünkü sandığını açtın, yarın yine gel.'
          : 'Bir sandığa dokun kanka, içindeki senin.'

  return (
    <article className="flex min-w-0 flex-col gap-3">
      <section aria-labelledby="gizemli-sandik-baslik" className="@container min-w-0">
        <h3 id="gizemli-sandik-baslik" className="sr-only">
          Gizemli Sandık
        </h3>
        <div className="relative isolate aspect-[9/16] w-full overflow-hidden rounded-2xl border border-gold/25 bg-background @min-[600px]:aspect-[2/1] @min-[600px]:max-h-[600px]">
          <Image src="/images/chests/vault-mobile.webp" alt="" fill sizes="100vw" priority className="object-cover @min-[600px]:hidden" />
          <Image
            src="/images/chests/vault-desktop.webp"
            alt=""
            fill
            sizes="(min-width: 1280px) 1024px, 100vw"
            priority
            className="hidden object-cover @min-[600px]:block"
          />
          <StageShade />
          <TableBrand center={false} corners={false} jako={false} plaque="top" />
          <StageTitle
            title="Gizemli Sandık"
            sub={
              <>
                En büyük ödül <span className="text-gold">{jackpot} KC</span>
                {' · '}
                {locked ? 'yeni sandık 00:00’da' : playsLeft == null ? `günde ${config.dailyPlays} sandık` : `${plays} hakkın var`}
              </>
            }
          />

          {revealed && picked !== null && (
            <StageResult className="top-[13%] @min-[600px]:top-[8%]" points={won} label={chests[picked]?.name ?? 'Sandık'} />
          )}

          <span
            aria-hidden="true"
            className="room-breathe pointer-events-none absolute top-[40%] left-1/2 h-[30%] w-[76%] -translate-1/2 rounded-[50%] bg-[radial-gradient(closest-side,color-mix(in_oklch,var(--gold)_22%,transparent),transparent)] mix-blend-plus-lighter @min-[600px]:top-[48%] @min-[600px]:h-[62%] @min-[600px]:w-[30%]"
          />

          {chests.map((chest, i) => {
            const isPicked = picked === i
            const opened = revealed && isPicked
            const shownOpen = opened || lifted.includes(i)
            const amount = isPicked ? won : (contents[i] ?? 0)
            const waiting = phase === 'idle' && !locked
            const [kx, ky] = keyholeOf(chest.id)
            return (
              <button
                key={i}
                ref={(el) => {
                  chestRefs.current[i] = el
                }}
                type="button"
                onClick={() => open(i)}
                disabled={!waiting}
                aria-label={revealed ? `${chest.name}: ${amount} Kanka Coin` : `${chest.name} aç, ${rewardRange(chest.rewards)}`}
                className={cn(
                  'group absolute aspect-square -translate-x-1/2 rounded-2xl outline-offset-[-6px] [-webkit-tap-highlight-color:transparent] disabled:cursor-default',
                  SPOTS[i] ?? SPOTS[0],
                )}
              >
                {isPicked && phase !== 'idle' && (
                  <>
                    <span
                      aria-hidden="true"
                      className="vault-beam pointer-events-none absolute bottom-[16%] left-1/2 h-[420%] w-[128%] origin-top -translate-x-1/2 bg-linear-to-b from-gold/35 via-gold/12 to-gold/5 mix-blend-plus-lighter [clip-path:polygon(41%_0,59%_0,100%_100%,0_100%)]"
                    />
                    <span
                      aria-hidden="true"
                      className="wheel-fade pointer-events-none absolute top-[74%] left-1/2 h-[20%] w-[124%] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(closest-side,color-mix(in_oklch,var(--gold)_50%,transparent),transparent)] mix-blend-plus-lighter"
                    />
                  </>
                )}
                {opened && (
                  <span
                    aria-hidden="true"
                    className="vault-rays pointer-events-none absolute top-[46%] left-1/2 size-[230%] -translate-1/2 rounded-full mix-blend-plus-lighter [background:repeating-conic-gradient(from_0deg,color-mix(in_oklch,var(--gold)_32%,transparent)_0deg_6deg,transparent_6deg_20deg)] [mask:radial-gradient(closest-side,black_14%,transparent_72%)]"
                  />
                )}
                <span
                  className={cn(
                    'absolute inset-0 transition-[filter,scale] duration-300',
                    waiting && 'chest-wait group-hover:scale-[1.07] group-hover:brightness-125 group-active:scale-100',
                    isPicked && phase === 'opening' && (turned ? 'chest-rattle-hard' : 'chest-rattle'),
                    !isPicked && (phase === 'opening' || locked) && 'brightness-[0.45] saturate-[0.5]',
                    !isPicked && revealed && 'brightness-[0.68] saturate-[0.7]',
                  )}
                  style={{ animationDelay: `${i * -1.9}s` }}
                >
                  <Image
                    src={`/images/chests/stage/${chest.id}-closed.webp`}
                    alt=""
                    fill
                    sizes="(min-width: 640px) 200px, 45vw"
                    className={cn('object-contain drop-shadow-[0_1cqw_0.8cqw_rgb(0_0_0/0.6)]', shownOpen && 'opacity-0')}
                  />
                  <Image
                    src={`/images/chests/stage/${chest.id}-open.webp`}
                    alt=""
                    fill
                    sizes="(min-width: 640px) 200px, 45vw"
                    className={cn('object-contain drop-shadow-[0_1cqw_0.8cqw_rgb(0_0_0/0.6)]', 'origin-[50%_86%] scale-[1.18]', shownOpen ? 'chest-open' : 'opacity-0')}
                  />
                  {waiting && (
                    <>
                      <span
                        aria-hidden="true"
                        className="absolute inset-0 overflow-hidden [mask-position:center] [mask-repeat:no-repeat] [mask-size:contain]"
                        style={{ maskImage: `url(/images/chests/stage/${chest.id}-mask.webp)` }}
                      >
                        <span
                          className="chest-sheen absolute inset-y-0 left-0 w-[22%] -skew-x-12 bg-linear-to-r from-transparent via-foreground/50 to-transparent mix-blend-plus-lighter"
                          style={{ animationDelay: `${i * 1.5}s` }}
                        />
                      </span>
                      <span
                        aria-hidden="true"
                        className="keyhole-pulse absolute size-[16%] -translate-1/2 rounded-full bg-[radial-gradient(closest-side,var(--gold),transparent)] mix-blend-plus-lighter"
                        style={{ left: `${kx * 100}%`, top: `${ky * 100}%`, animationDelay: `${i * -0.7}s` }}
                      />
                    </>
                  )}
                  {isPicked && phase === 'opening' && turned && (
                    <span
                      aria-hidden="true"
                      className="chest-seam absolute top-[39%] left-[14%] h-[9%] w-[72%] rounded-[50%] bg-[radial-gradient(closest-side,var(--foreground),var(--gold)_45%,transparent)] mix-blend-plus-lighter"
                    />
                  )}
                </span>
                <span
                  key={shownOpen ? 'held' : 'range'}
                  className={cn(
                    'absolute top-[91%] left-1/2 flex -translate-x-1/2 items-baseline gap-[0.4em] rounded-md px-[0.7em] py-[0.25em] text-[clamp(10px,2.9cqw,12px)] leading-tight font-extrabold whitespace-nowrap tabular-nums @min-[600px]:text-[clamp(10px,1.2cqw,13px)]',
                    shownOpen && 'tier-lit',
                    opened
                      ? 'bg-gold text-gold-foreground'
                      : shownOpen
                        ? 'bg-background/85 text-foreground/70 inset-ring inset-ring-foreground/15'
                        : 'bg-background/85 text-foreground inset-ring inset-ring-gold/40',
                  )}
                >
                  {shownOpen ? (
                    `${opened ? '+' : ''}${amount.toLocaleString('tr-TR')} KC`
                  ) : (
                    <>
                      {shortName(chest.name)}
                      <span className="font-bold text-gold">{rewardRange(chest.rewards)}</span>
                    </>
                  )}
                </span>
              </button>
            )
          })}

          <RoomFx ref={fx} zone={DUST} className="z-[2]" />
          <span
            ref={handRef}
            aria-hidden="true"
            className="absolute bottom-[10.5%] left-[69%] @min-[600px]:bottom-[25%] @min-[600px]:left-[83%]"
          />

          <JakoActor
            cast={KEEPER}
            state={mood}
            armed={!locked}
            className="absolute bottom-0 left-[56.5%] z-[3] aspect-[896/640] w-[62%] @min-[600px]:left-[74.5%] @min-[600px]:w-[42%]"
          />

          <div className="absolute right-[40%] bottom-[2.5%] left-[4%] z-[4] flex flex-col items-stretch gap-1.5 @min-[600px]:contents">
            <div className="flex justify-end @min-[600px]:absolute @min-[600px]:top-[37%] @min-[600px]:right-[2.5%] @min-[600px]:z-[4] @min-[600px]:w-[21%]">
              <CallerBubble tail="right" tone={error ? 'error' : 'plain'} className="@min-[600px]:hidden">
                {says}
              </CallerBubble>
              <CallerBubble tail="down" tone={error ? 'error' : 'plain'} className="hidden @min-[600px]:block">
                {says}
              </CallerBubble>
            </div>
            {(revealed || locked) && (
              <div className="flex flex-col items-stretch @min-[600px]:absolute @min-[600px]:bottom-[4.5%] @min-[600px]:left-1/2 @min-[600px]:w-[20%] @min-[600px]:-translate-x-1/2">
                <ActionButton onClick={reset} disabled={locked}>
                  {locked ? (
                    <>
                      <Clock className="size-4" aria-hidden="true" />
                      <span className="sr-only">Sonraki sandık: </span>
                      {formatRemaining(lockedFor)}
                    </>
                  ) : (
                    'Tekrar dene'
                  )}
                </ActionButton>
              </div>
            )}
          </div>
        </div>
      </section>

      <section aria-label="Sandıklardan çıkabilecek ödüller" className="flex flex-col gap-2 rounded-xl border border-border bg-card px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">İçinden neler çıkabilir?</span>
          <div className="flex items-center gap-2">
            <DetailButton onClick={() => setRules(true)} label="Oyun kuralları" />
            <span className="rounded-md bg-primary/10 px-2.5 py-1 text-xs font-semibold tabular-nums text-primary">
              {locked ? formatRemaining(lockedFor) : `${plays} hak`}
            </span>
          </div>
        </div>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {chests.map((chest, i) => (
            <li key={i} className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-foreground">{chest.name}</span>
              <span className="flex flex-wrap gap-1">
                {[...new Set(chest.rewards)]
                  .sort((a, b) => a - b)
                  .map((reward) => (
                    <span
                      key={reward}
                      className={cn(
                        'rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums',
                        reward === jackpot ? 'bg-gold/20 text-gold' : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {reward} KC
                    </span>
                  ))}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <p aria-live="polite" className="sr-only">
        {error || (revealed && picked !== null ? `${chests[picked]?.name}: ${won} Kanka Coin kazandın` : '')}
      </p>

      <DetailModal
        onClose={() => setRules(false)}
        content={
          rules
            ? {
                eyebrow: 'Mini oyun',
                title: 'Gizemli Sandıklar kuralları',
                image: '/images/mascots/jako-sandik.png',
                description: 'Üç sandıktan birini seç, içindeki ödül anında senin. Sandık türüne göre ödül aralığı değişir.',
                prizes: chests.map((chest) => ({ place: chest.name, prize: rewardRange(chest.rewards) })),
                rules: rulesFor(config.dailyPlays),
              }
            : null
        }
      />
    </article>
  )
}
