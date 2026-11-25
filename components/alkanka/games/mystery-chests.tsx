'use client'

/*
  Gizemli Sandık in its own room: a vault with three plinths, one chest on each (the middle one on the taller
  plinth; on phones the three stand as a triangle). Each chest's reward range is on a plate on its plinth. Jako,
  the keeper, stands at the lower right with the vault's key. What he says is over his head (beside him on
  phones, where the stage is 9 : 16).

  While they wait the chests stir now and then, light slides over their metal and their keyholes glow. The member
  does not choose a chest: there is one button, and Jako chooses. The ceiling lamp runs over the three chests,
  slows down and stops on one. As it slows Jako lifts the key and takes aim, then throws it: there is one key, the
  one in his wing, and from the frame of his clip where he lets go of it the key is a picture on the stage
  (chest-stage/key-flight.ts) that flies into the chest's keyhole, sinks into the lock and turns. The chest shakes
  and light leaks from under its lid. Then it is thrown open under turning rays, its coins spill onto the floor
  (mini-stage/room-fx.tsx), the win counts up across the top of the vault, the key tumbles back into Jako's wing
  as he reaches out for it, and the other two chests open one after the other to show what they held.

  Which chest is opened (by the chances set in the panel) and what each one held are decided on the server
  (playMini); the lamp only stops where the server said.
*/

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { Clock } from 'lucide-react'
import { playMini } from '@/app/actions/wallet'
import { CHEST_IDS } from '@/lib/rewards-shared'
import { pacedFrames } from '@/lib/paced-frames'
import { buzz, playSound } from '@/lib/sound'
import { usePrefersReducedMotion } from '@/lib/use-motion'
import { cn } from '@/lib/utils'
import { TableBrand } from '../arena/table-brand'
import { useCatalog } from '../catalog-context'
import { DetailButton, DetailModal } from '../detail-modal'
import { usePoints } from '../points-context'
import { catchKey, hideKey, holdKey, sinkKey, throwKey, twistKey, type KeyPose, type KeyRig } from './chest-stage/key-flight'
import type { MiniGameProps } from './lucky-wheel'
import { formatRemaining } from './mini-status'
import { CallerBubble, StageResult, StageShade, StageTitle } from './mini-stage/caller'
import { RoomFx, type RoomFxHandle, type Zone } from './mini-stage/room-fx'
import { burst } from './wheel-stage/burst'
import { JakoActor, type ActorCast, type ActorClock, type ActorState } from './wheel-stage/jako-actor'
import { ActionButton } from './wheel-stage/parts'

const rulesFor = (dailyPlays: number) => [
  `Günde ${dailyPlays} sandık hakkın var, haklar her gün 00:00’da yenilenir.`,
  'Her sandıkta garantili ödül vardır, boş sandık yoktur.',
  'Sandığı sen seçmezsin: “Sandığı aç” düğmesine basınca Jako üç sandıktan birini rastgele seçip açar.',
  'Her sandığın ödül aralığı üstünde yazar; değerli sandık daha seyrek çıkar.',
  'Kazanılan Kanka Coin anında bakiyene eklenir.',
  'Promo kod ödülleri hesabındaki “Kodlarım” alanına düşer, 7 gün geçerlidir.',
  'Bot, çoklu hesap veya otomasyon tespit edilirse ödüller iptal edilir.',
]

type Drawn = { ok: true; chest: number; prizes: number[]; points: number; balance: number } | { ok: false; error: string; balance?: number }

/** `chest` is the one that was opened, by its place in the list. */
export type ChestDraw = () => Promise<Drawn>

const serverDraw: ChestDraw = async () => {
  const res = await playMini('sandik')
  if (res.ok && res.game === 'sandik') return { ok: true, chest: res.chest, prizes: res.prizes, points: res.points, balance: res.balance }
  return { ok: false, error: res.ok ? 'Sandık açılamadı, tekrar dene.' : res.error, balance: res.balance }
}

/* 'choosing': the lamp is running over the chests; 'opening': it has stopped on one and the key is on its way */
type Phase = 'idle' | 'choosing' | 'opening' | 'opened'

/** The lamp moves on this often while it runs, for at least this long, and whatever the server takes. */
const RUN_MS = 85
const RUN_MIN_MS = 700
/** Its last steps onto the chest that was drawn: the lamp slows down, then rests on it. */
const SLOWING_MS = [130, 190, 270, 400]
/** How long the key's light takes to reach the lock when there is no clip to throw the key itself. */
const FLIGHT_MS = 340
/** The least a lock takes to give once the key is in it, however fast the server answers. */
const LOCK_MS = 620
/*
  The keeper's throw clip, in seconds: the key leaves his wing at RELEASE_S, he reaches out for it again at
  REACH_S and has it back at CAUGHT_S. Between RELEASE_S and CAUGHT_S the clip shows no key.
*/
const RELEASE_S = 1.625
const STANDING_S = 2.333
const REACH_S = 4.875
const CAUGHT_S = 5.583
/** How fast the clip's way back (the reach, the catch) is played once the chest is open. */
const CATCH_RATE = 2
/** The clip is given this long to reach RELEASE_S; with no clip on screen (the still picture) the key's light goes instead. */
const RELEASE_LIMIT_MS = 3600
const STILL_MS = 500
/** The key in Jako's wing, as fractions of his picture: how long it is, and where its tip is when he lets go. */
const KEY_LENGTH = 0.24
const KEY_TIP = { left: '1.04%', top: '45.2%' }
/** Where the key hangs in the still picture: the key's light starts there when no clip is on screen. */
const KEY_REST = { left: '34.6%', top: '81.2%' }
/** How long the key is once it has reached a chest, against the chest's width. */
const KEY_AT_LOCK = 0.36
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

/*
  The keeper: key in hand while waiting; for a chest he lifts it, takes aim and throws it, stands empty-handed
  while it is in the lock, then reaches out and catches it; the key held up over a win. No chest is empty. Each
  clip ends on the frame it began on. The picture is wide enough for his arm and the key at full stretch, which is
  why he stands so far right in it.
*/
const KEEPER: ActorCast = {
  still: '/images/chests/jako.webp',
  clips: { idle: '/video/chests/jako-idle.mp4', spin: '/video/chests/jako-spin.mp4', win: '/video/chests/jako-win.mp4' },
  frame: { width: 1156, height: 640 },
  mirrored: true,
  beats: { spin: { hold: STANDING_S, back: REACH_S }, win: { hold: 1.667, back: 1.667 } },
  backRate: CATCH_RATE,
}
/*
  Jako's picture on the stage; the key's tip is placed on the same box. On phones he is small enough for his arm
  at full stretch to stay clear of the button.
*/
const KEEPER_BOX =
  'pointer-events-none absolute bottom-0 left-[52%] z-[3] aspect-[1156/640] w-[63.6%] @min-[600px]:left-[62.41%] @min-[600px]:w-[54.19%]'

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
  /** The chest that was drawn, once the lamp has stopped on it. */
  const [picked, setPicked] = useState<number | null>(null)
  /** The chest the lamp is on while it runs. */
  const [eye, setEye] = useState<number | null>(null)
  const [contents, setContents] = useState<number[]>([])
  const [won, setWon] = useState(0)
  const [error, setError] = useState('')
  const [mood, setMood] = useState<ActorState>('idle')
  const [rules, setRules] = useState(false)
  /** The key is in the lock: the chest shakes harder and light leaks from under its lid. */
  const [turned, setTurned] = useState(false)
  /** The chests that were not chosen and have been opened to show what they held. */
  const [lifted, setLifted] = useState<number[]>([])
  const chestRefs = useRef<(HTMLDivElement | null)[]>([])
  const stageRef = useRef<HTMLDivElement>(null)
  const keeperRef = useRef<HTMLDivElement>(null)
  const tipRef = useRef<HTMLSpanElement>(null)
  const restRef = useRef<HTMLSpanElement>(null)
  const keyRef = useRef<HTMLImageElement>(null)
  /** Which of Jako's clips is on screen and how far into it, written by his player on every frame. */
  const clock = useRef<ActorClock>({ clip: null, time: 0 })
  const keyLoop = useRef<ReturnType<typeof pacedFrames> | null>(null)
  /** The key is in a lock: where, and how it went in. */
  const keyIn = useRef<KeyPose | null>(null)
  /** Counts the chests asked for: what is left of an earlier one's key stops when it sees a newer number. */
  const round = useRef(0)
  const fx = useRef<RoomFxHandle>(null)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const gone = useRef(false)
  /** A chest is being chosen or opened: the button does nothing until it is open. */
  const busy = useRef(false)

  useEffect(() => {
    gone.current = false
    return () => {
      gone.current = true
      timers.current.forEach(clearTimeout)
      keyLoop.current?.cancel()
    }
  }, [])

  /** The key's picture at the size it has in Jako's wing right now. */
  function keyRig(): KeyRig | null {
    const el = keyRef.current
    const width = keeperRef.current?.offsetWidth ?? 0
    return el && width ? { el, length: width * KEY_LENGTH } : null
  }

  /** Waits until `ready` says so, looking every frame, for at most `limit` ms. */
  function until(ready: () => boolean, limit: number) {
    return new Promise<boolean>((done) => {
      const started = performance.now()
      const check = () => {
        if (gone.current || ready()) done(true)
        else if (performance.now() - started >= limit) done(false)
        else setTimeout(check, 16)
      }
      check()
    })
  }

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

  /**
   * Jako chooses: the lamp runs over the chests, left to right and round again, until the server has answered, then
   * takes its last, slower steps onto the chest that was drawn and rests there.
   */
  async function choose(asked: Promise<Drawn>) {
    const answer: { res: Drawn | null } = { res: null }
    void asked.then((res) => {
      answer.res = res
    })
    const started = performance.now()
    /* where the lamp starts is for show only: where it stops is the server's */
    let at = Math.floor(Math.random() * chestCount)
    for (;;) {
      setEye(at % chestCount)
      playSound('tick', 0.45)
      await wait(RUN_MS)
      if (gone.current || (answer.res && performance.now() - started >= RUN_MIN_MS)) break
      at += 1
    }
    const drawn = answer.res ?? (await asked)
    if (!drawn.ok || gone.current) return drawn
    /* the lamp is about to settle: Jako lifts the key and takes aim */
    setMood('spin')
    /* at least two more steps, so the lamp is seen to slow down before it stops */
    let steps = (((drawn.chest - at) % chestCount) + chestCount) % chestCount
    if (steps < 2) steps += chestCount
    const gaps = SLOWING_MS.slice(-Math.min(steps, SLOWING_MS.length))
    for (let k = 0; k < steps && !gone.current; k++) {
      at += 1
      setEye(at % chestCount)
      playSound('tick', 0.7)
      await wait(gaps[Math.max(0, k - (steps - gaps.length))])
    }
    return drawn
  }

  /**
   * Jako throws the key: it leaves his wing at the frame of his clip where he lets go, flies into the chest's
   * keyhole, sinks into the lock and turns. With no clip on screen (the still picture) the key's light goes instead.
   */
  async function turnKey(index: number, mine: number) {
    const el = chestRefs.current[index]
    const [kx, ky] = keyholeOf(chests[index]?.id ?? '')
    const stale = () => gone.current || round.current !== mine
    let thrown = false
    const asked = performance.now()
    await until(() => {
      const { clip, time } = clock.current
      thrown = clip === 'spin' && time >= RELEASE_S && time < REACH_S
      /* the still picture never throws: it is not waited for */
      return thrown || (clip === null && performance.now() - asked >= STILL_MS)
    }, RELEASE_LIMIT_MS)
    if (stale()) return
    const lock = fx.current?.spot(el, kx, ky) ?? null
    const from = fx.current?.spot(tipRef.current, 0, 0) ?? null
    const key = keyRig()
    const loop = (keyLoop.current ??= pacedFrames(60))
    if (thrown && key && el && lock && from) {
      holdKey(key, from)
      playSound('chip', 0.5)
      let trail = 0
      const pose = await throwKey(loop, key, from, lock, stageRef.current?.offsetWidth ?? 0, (el.offsetWidth * KEY_AT_LOCK) / key.length, (tip) => {
        /* a spark off the key every few frames of its flight */
        if (++trail % 3 === 0) fx.current?.sparks(tip, 1, 0.25)
      })
      if (stale()) return
      await sinkKey(loop, key, pose)
      if (stale()) return
      keyIn.current = pose
    } else {
      await fx.current?.streak(fx.current.spot(restRef.current, 0, 0), lock, FLIGHT_MS)
      if (stale()) return
    }
    fx.current?.flash(lock, (el?.offsetWidth ?? 0) * 0.42)
    fx.current?.sparks(lock, 12, 0.6)
    playSound('tick')
    buzz(10)
    setTurned(true)
    await Promise.all([wait(LOCK_MS), keyIn.current && key ? twistKey(loop, key, keyIn.current) : null])
  }

  /** The chest is open: the key is pulled out of its lock and tumbles back into Jako's wing as he reaches out for it. */
  async function bringKeyBack(pose: KeyPose, mine: number) {
    const key = keyRig()
    if (!key) return
    const stale = () => gone.current || round.current !== mine
    const reaching = () => clock.current.clip !== 'spin' || clock.current.time >= REACH_S
    await until(reaching, 700)
    if (stale()) return
    const hand = fx.current?.spot(tipRef.current, 0, 0) ?? pose.tip
    playSound('chip', 0.4)
    await catchKey(keyLoop.current ?? pacedFrames(60), key, pose, hand, stageRef.current?.offsetWidth ?? 0, ((CAUGHT_S - REACH_S) * 1000) / CATCH_RATE)
    if (stale()) return
    /* his clip shows the key again from CAUGHT_S */
    await until(() => clock.current.clip !== 'spin' || clock.current.time >= CAUGHT_S, 260)
    if (!stale()) hideKey(key.el)
  }

  /** The one button: closes whatever stands open, lets Jako choose a chest and opens it. */
  async function open() {
    if (busy.current || locked || !canPlay()) return
    busy.current = true
    const mine = ++round.current
    timers.current.forEach(clearTimeout)
    timers.current = []
    /* a key still on its way back from the last chest is in his wing again */
    keyLoop.current?.cancel()
    keyIn.current = null
    hideKey(keyRef.current)
    setPicked(null)
    setEye(null)
    setPhase('choosing')
    setTurned(false)
    setLifted([])
    setError('')
    setMood('idle')
    playSound('chip')
    const res = await (reduced ? draw() : choose(draw()))
    if (gone.current) return
    if (!res.ok) {
      busy.current = false
      setPhase('idle')
      setEye(null)
      setMood('idle')
      setError(res.error)
      if (typeof res.balance === 'number') setBalance(res.balance)
      return
    }
    const index = Math.max(0, Math.min(chestCount - 1, res.chest))
    setPicked(index)
    setEye(null)
    setPhase('opening')
    if (!reduced) await turnKey(index, mine)
    if (gone.current) return
    busy.current = false
    setContents(res.prizes)
    setWon(res.points)
    setPhase('opened')
    setBalance(res.balance)
    setMood('win')
    playSound('win')
    const lodged = keyIn.current
    keyIn.current = null
    if (lodged) void bringKeyBack(lodged, mine)
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

  const revealed = phase === 'opened'
  const working = phase === 'choosing' || phase === 'opening'
  /** The chest under the lamp: the one it is passing while it runs, then the one that was drawn. */
  const lit = phase === 'choosing' ? eye : picked
  const plays = Math.max(1, playsLeft ?? 1)
  const says = error
    ? error
    : phase === 'choosing'
      ? 'Hangisini açsam… Dur, seçiyorum.'
      : phase === 'opening'
        ? turned
          ? 'Kilit dönüyor…'
          : `${shortName(chests[picked ?? 0]?.name ?? 'Bu')} sandık! Anahtar geliyor…`
        : revealed
          ? won >= jackpot
            ? 'Jackpot! Helal kanka.'
            : 'Helal kanka, cebe girdi.'
          : locked
            ? 'Bugünkü sandığını açtın, yarın yine gel.'
            : 'Düğmeye bas kanka, sandığı ben seçeyim.'

  return (
    <article className="flex min-w-0 flex-col gap-3">
      <section aria-labelledby="gizemli-sandik-baslik" className="@container min-w-0">
        <h3 id="gizemli-sandik-baslik" className="sr-only">
          Gizemli Sandık
        </h3>
        <div
          ref={stageRef}
          className="relative isolate aspect-[9/16] w-full overflow-hidden rounded-2xl border border-gold/25 bg-background @min-[600px]:aspect-[2/1] @min-[600px]:max-h-[600px]"
        >
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
            const isLit = lit === i
            const [kx, ky] = keyholeOf(chest.id)
            return (
              <div
                key={i}
                ref={(el) => {
                  chestRefs.current[i] = el
                }}
                role="img"
                aria-label={shownOpen ? `${chest.name}: ${amount} Kanka Coin` : `${chest.name}, ${rewardRange(chest.rewards)}`}
                className={cn('absolute aspect-square -translate-x-1/2', SPOTS[i] ?? SPOTS[0])}
              >
                {isLit && (
                  <>
                    {/* the lamp snaps from chest to chest while it runs, and settles in once it has stopped */}
                    <span
                      aria-hidden="true"
                      className={cn(
                        'pointer-events-none absolute bottom-[16%] left-1/2 h-[420%] w-[128%] origin-top -translate-x-1/2 bg-linear-to-b from-gold/35 via-gold/12 to-gold/5 mix-blend-plus-lighter [clip-path:polygon(41%_0,59%_0,100%_100%,0_100%)]',
                        phase !== 'choosing' && 'vault-beam',
                      )}
                    />
                    <span
                      aria-hidden="true"
                      className={cn(
                        'pointer-events-none absolute top-[74%] left-1/2 h-[20%] w-[124%] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(closest-side,color-mix(in_oklch,var(--gold)_50%,transparent),transparent)] mix-blend-plus-lighter',
                        phase !== 'choosing' && 'wheel-fade',
                      )}
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
                    'absolute inset-0 transition-[filter,scale]',
                    /* the lamp is quick while it runs: a chest must light and dim within one of its steps */
                    phase === 'choosing' ? 'duration-75' : 'duration-300',
                    waiting && 'chest-wait',
                    phase === 'choosing' && (isLit ? 'scale-[1.07] brightness-125' : 'brightness-[0.5] saturate-[0.6]'),
                    isPicked && phase === 'opening' && (turned ? 'chest-rattle-hard' : 'chest-rattle'),
                    !isPicked && (phase === 'opening' || (locked && !working)) && 'brightness-[0.45] saturate-[0.5]',
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
              </div>
            )
          })}

          <RoomFx ref={fx} zone={DUST} className="z-[2]" />
          <div ref={keeperRef} className={KEEPER_BOX}>
            <JakoActor cast={KEEPER} state={mood} armed={!locked} clock={clock} className="absolute inset-0" />
            <span ref={tipRef} aria-hidden="true" className="absolute" style={KEY_TIP} />
            <span ref={restRef} aria-hidden="true" className="absolute" style={KEY_REST} />
          </div>

          {/* the key once it has left Jako's wing: over him and the chests, placed by chest-stage/key-flight.ts */}
          <img
            ref={keyRef}
            src="/images/chests/key.webp"
            alt=""
            aria-hidden="true"
            draggable={false}
            className="pointer-events-none absolute top-0 left-0 z-[5] h-auto max-w-none origin-left opacity-0 drop-shadow-[0_0.3cqw_0.5cqw_rgb(0_0_0/0.55)] will-change-transform"
          />

          <div className="absolute right-[48%] bottom-[2.5%] left-[4%] z-[4] flex flex-col items-stretch gap-1.5 @min-[600px]:contents">
            <div className="flex justify-end @min-[600px]:absolute @min-[600px]:top-[37%] @min-[600px]:right-[2.5%] @min-[600px]:z-[4] @min-[600px]:w-[21%]">
              <CallerBubble tail="right" tone={error ? 'error' : 'plain'} className="@min-[600px]:hidden">
                {says}
              </CallerBubble>
              <CallerBubble tail="down" tone={error ? 'error' : 'plain'} className="hidden @min-[600px]:block">
                {says}
              </CallerBubble>
            </div>
            <div className="flex flex-col items-stretch @min-[600px]:absolute @min-[600px]:bottom-[4.5%] @min-[600px]:left-1/2 @min-[600px]:z-[4] @min-[600px]:w-[22%] @min-[600px]:-translate-x-1/2">
              <ActionButton onClick={open} disabled={working || locked}>
                {locked && !working ? (
                  <>
                    <Clock className="size-4" aria-hidden="true" />
                    <span className="sr-only">Sonraki sandık: </span>
                    {formatRemaining(lockedFor)}
                  </>
                ) : phase === 'choosing' ? (
                  'Jako seçiyor…'
                ) : phase === 'opening' ? (
                  'Sandık açılıyor…'
                ) : revealed ? (
                  'Yeni sandık aç'
                ) : (
                  'Sandığı aç'
                )}
              </ActionButton>
            </div>
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
              <span className="flex items-baseline gap-1.5 text-xs font-semibold text-foreground">
                {chest.name}
                {chest.odds && <span className="font-medium text-muted-foreground">{chest.odds}</span>}
              </span>
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
                description: 'Düğmeye bas, Jako üç sandıktan birini seçip açsın; içindeki ödül anında senin. Sandık türüne göre ödül aralığı değişir.',
                prizes: chests.map((chest) => ({ place: chest.name, prize: rewardRange(chest.rewards) })),
                rules: rulesFor(config.dailyPlays),
              }
            : null
        }
      />
    </article>
  )
}
