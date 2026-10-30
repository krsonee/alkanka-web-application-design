'use client'

import { useEffect, useRef, useState, useSyncExternalStore, type PointerEvent as ReactPointerEvent } from 'react'
import { ChevronDown, ChevronUp, LogOut, RotateCw, Smartphone } from 'lucide-react'
import { DEFAULT_BOT_NAMES, pickBotNames } from '@/lib/games/bot-names'
import { cn } from '@/lib/utils'
import type { BilardoState } from '@/lib/pvp/rules'
import type { GameApi } from './stake-gate'
import type { Remote } from './remote'
import { playSound } from '@/lib/sound'
import { TableBrand } from './table-brand'
import { useDuelLink } from './duel-link'
import {
  BOT_LEVELS,
  FALLBACK_SEED,
  H,
  HEAD_X,
  MAX_FOULS,
  POCKETS,
  POCKET_HOLE,
  R,
  RAIL,
  W,
  canPlaceCue,
  fromState,
  isStill,
  legalFor,
  needsCall,
  newEvents,
  planShot,
  rack,
  resolveShot,
  seeded,
  startShot,
  stepShot,
  type Ball,
  type BotLevel,
  type Fouls,
  type Group,
  type Groups,
  type ShotEvents,
  type ShotInput,
  type Spin,
  type StepHooks,
} from '@/lib/games/bilardo'

const CW = W + RAIL * 2
const CH = H + RAIL * 2
const BALL_COLORS = ['#f5f1e6', '#f2c230', '#2559c9', '#d4382c', '#6b3fa0', '#ef7d22', '#1f8a4c', '#8a2432', '#141414']
const STRIKE_MS = 110
const PREVIEW_AIM_MS = 700
const PREVIEW_PULL_MS = 450
const PREVIEW_HOLD_MS = 150
const TABLE_PULL_RANGE = 260
const DROP_MS = 560
const PORTRAIT_QUERY = '(max-width: 767px) and (orientation: portrait)'
const LANDSCAPE_QUERY = '(max-height: 540px) and (orientation: landscape)'

type Layout = 'desktop' | 'portrait' | 'landscape'

/** Phones must be turned sideways: upright shows a rotate prompt, sideways gets a full-screen table. */
function usePhoneLayout(): Layout {
  return useSyncExternalStore(
    (cb) => {
      const ms = [PORTRAIT_QUERY, LANDSCAPE_QUERY].map((q) => window.matchMedia(q))
      ms.forEach((m) => m.addEventListener('change', cb))
      return () => ms.forEach((m) => m.removeEventListener('change', cb))
    },
    () => (window.matchMedia(PORTRAIT_QUERY).matches ? 'portrait' : window.matchMedia(LANDSCAPE_QUERY).matches ? 'landscape' : 'desktop'),
    () => 'desktop',
  )
}

/** Android browsers allow locking the orientation once in fullscreen; iOS ignores it and relies on the prompt. */
async function goLandscape() {
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen?.()
    const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }
    await o.lock?.('landscape')
  } catch {}
}
const avatarFor = (seat: number, online: boolean) => `/images/monopoly/pawn-${online ? seat + 1 : seat === 0 ? 1 : 3}.png`
const IN_HAND_MSG = 'Beyaz elinde: beyazı sürükleyip istediğin yere koy.'

type Vec3 = [number, number, number]
type Roll = { n: Vec3; m: Vec3 }
type SpinInput = { x: number; y: number }
type Drop = { id: number; x: number; y: number; p: number; t0: number }

const other = (s: number) => (s === 0 ? 1 : 0)
const clamp01 = (v: number) => Math.max(0, Math.min(1, v))

/** Rotates v around the in-plane unit axis (kx, ky, 0) by `a` radians (Rodrigues). */
function rotate(v: Vec3, kx: number, ky: number, a: number): Vec3 {
  const c = Math.cos(a)
  const s = Math.sin(a)
  const dot = kx * v[0] + ky * v[1]
  const x = v[0] * c + ky * v[2] * s + kx * dot * (1 - c)
  const y = v[1] * c - kx * v[2] * s + ky * dot * (1 - c)
  const z = v[2] * c + (kx * v[1] - ky * v[0]) * s
  const l = Math.hypot(x, y, z) || 1
  return [x / l, y / l, z / l]
}

const initialRoll = (id: number): Roll => (id > 8 ? { n: [1, 0, 0], m: [0, 0, 1] } : { n: [0, 0, 1], m: [1, 0, 0] })

/** Draws a marking on the ball surface that points along `v`, foreshortened as it rolls away. Returns true if it faces the viewer. */
function surfaceSpot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, v: Vec3, size: number, color: string) {
  if (v[2] <= -0.2) return false
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.ellipse(x + v[0] * r * 0.9, y + v[1] * r * 0.9, size * r * Math.max(0.18, v[2]), size * r, Math.atan2(v[1], v[0]), 0, Math.PI * 2)
  ctx.fill()
  return v[2] > 0.5
}

function drawBall(ctx: CanvasRenderingContext2D, b: { id: number; x: number; y: number }, roll: Roll, scale = 1) {
  const r = R * scale
  const { x, y, id } = b
  const shadow = ctx.createRadialGradient(x + 3, y + 4, r * 0.2, x + 3, y + 4, r * 1.25)
  shadow.addColorStop(0, 'rgba(0,0,0,0.45)')
  shadow.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = shadow
  ctx.beginPath()
  ctx.arc(x + 3, y + 4, r * 1.25, 0, Math.PI * 2)
  ctx.fill()

  ctx.save()
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.clip()
  const stripe = id > 8
  ctx.fillStyle = stripe ? BALL_COLORS[id - 8] : BALL_COLORS[id]
  ctx.fillRect(x - r, y - r, r * 2, r * 2)
  if (stripe) {
    const neg: Vec3 = [-roll.n[0], -roll.n[1], -roll.n[2]]
    surfaceSpot(ctx, x, y, r, roll.n, 0.66, BALL_COLORS[0])
    surfaceSpot(ctx, x, y, r, neg, 0.66, BALL_COLORS[0])
  }
  if (id === 0) {
    surfaceSpot(ctx, x, y, r, roll.n, 0.14, '#c0392b')
  } else {
    const p = stripe ? roll.m : roll.n
    if (surfaceSpot(ctx, x, y, r, p, 0.54, BALL_COLORS[0]) && scale > 0.6) {
      ctx.fillStyle = '#141414'
      ctx.font = `800 ${Math.round(10 * scale)}px system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(String(id), x + p[0] * r * 0.9, y + p[1] * r * 0.9 + 0.5)
    }
  }
  const shine = ctx.createRadialGradient(x - r * 0.4, y - r * 0.45, 1, x, y, r * 1.2)
  shine.addColorStop(0, 'rgba(255,255,255,0.65)')
  shine.addColorStop(0.3, 'rgba(255,255,255,0)')
  shine.addColorStop(1, 'rgba(0,0,0,0.4)')
  ctx.fillStyle = shine
  ctx.fillRect(x - r, y - r, r * 2, r * 2)
  ctx.restore()
}

/** Distance from (x, y) along direction (dx, dy) until it leaves the visible canvas (table plus rails). */
function distToCanvasEdge(x: number, y: number, dx: number, dy: number) {
  const tx = dx > 0 ? (W + RAIL - x) / dx : dx < 0 ? (-RAIL - x) / dx : Infinity
  const ty = dy > 0 ? (H + RAIL - y) / dy : dy < 0 ? (-RAIL - y) / dy : Infinity
  return Math.min(tx, ty)
}

function drawCue(ctx: CanvasRenderingContext2D, cx: number, cy: number, angle: number, back: number) {
  const ux = -Math.cos(angle)
  const uy = -Math.sin(angle)
  // Near a cushion the full stick would run off the canvas, so shorten it to stay visible.
  const room = distToCanvasEdge(cx, cy, ux, uy) - (R + back) - 6
  const len = Math.max(70, Math.min(300, room))
  const sx = cx + ux * (R + back)
  const sy = cy + uy * (R + back)
  const ex = cx + ux * (R + back + len)
  const ey = cy + uy * (R + back + len)
  ctx.save()
  // Keep the stick (and its shadow) inside the wooden frame so it never spills over the side panels.
  ctx.beginPath()
  ctx.roundRect(-RAIL + 4, -RAIL + 4, CW - 8, CH - 8, 22)
  ctx.clip()
  ctx.strokeStyle = 'rgba(0,0,0,0.2)'
  ctx.lineWidth = 8
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(sx + 4, sy + 6)
  ctx.lineTo(ex + 4, ey + 6)
  ctx.stroke()
  const stick = ctx.createLinearGradient(sx, sy, ex, ey)
  stick.addColorStop(0, '#2b6cb0')
  stick.addColorStop(0.012, '#f2e7cf')
  stick.addColorStop(0.05, '#f2e7cf')
  stick.addColorStop(0.06, '#c9a46a')
  stick.addColorStop(0.7, '#7a4a25')
  stick.addColorStop(0.72, '#e2b33c')
  stick.addColorStop(0.73, '#5a3520')
  stick.addColorStop(1, '#4a2b18')
  ctx.strokeStyle = stick
  ctx.lineWidth = 7
  ctx.beginPath()
  ctx.moveTo(sx, sy)
  ctx.lineTo(ex, ey)
  ctx.stroke()
  ctx.restore()
}

/** The static table (wood, felt, cushions, pockets, markings) is painted once and blitted every frame. */
function paintTable(dpr: number) {
  const c = document.createElement('canvas')
  c.width = CW * dpr
  c.height = CH * dpr
  const ctx = c.getContext('2d')!
  const css = getComputedStyle(document.documentElement)
  const felt = css.getPropertyValue('--felt').trim() || '#1b2a44'
  const wood = css.getPropertyValue('--wood').trim() || '#4a3020'
  const gold = css.getPropertyValue('--primary').trim() || '#e2b33c'
  ctx.scale(dpr, dpr)
  ctx.fillStyle = wood
  ctx.beginPath()
  ctx.roundRect(0, 0, CW, CH, 26)
  ctx.fill()
  ctx.save()
  ctx.beginPath()
  ctx.roundRect(0, 0, CW, CH, 26)
  ctx.clip()
  for (let y = 0; y < CH; y += 3) {
    const a = 0.05 + 0.05 * Math.sin(y * 0.37) * Math.sin(y * 0.071)
    ctx.fillStyle = a > 0.05 ? `rgba(255,220,170,${a.toFixed(3)})` : `rgba(0,0,0,${(0.1 - a).toFixed(3)})`
    ctx.fillRect(0, y, CW, 1.5)
  }
  const railShade = ctx.createLinearGradient(0, 0, 0, CH)
  railShade.addColorStop(0, 'rgba(255,255,255,0.14)')
  railShade.addColorStop(0.5, 'rgba(0,0,0,0)')
  railShade.addColorStop(1, 'rgba(0,0,0,0.35)')
  ctx.fillStyle = railShade
  ctx.fillRect(0, 0, CW, CH)
  ctx.restore()
  ctx.strokeStyle = gold
  ctx.globalAlpha = 0.5
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.roundRect(8, 8, CW - 16, CH - 16, 20)
  ctx.stroke()
  ctx.globalAlpha = 1
  ctx.translate(RAIL, RAIL)
  ctx.fillStyle = felt
  ctx.fillRect(0, 0, W, H)
  const nc = document.createElement('canvas')
  nc.width = nc.height = 96
  const nx = nc.getContext('2d')
  if (nx) {
    const img = nx.createImageData(96, 96)
    for (let i = 0; i < img.data.length; i += 4) {
      img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.random() * 255
      img.data[i + 3] = 14
    }
    nx.putImageData(img, 0, 0)
    const pattern = ctx.createPattern(nc, 'repeat')
    if (pattern) {
      ctx.fillStyle = pattern
      ctx.fillRect(0, 0, W, H)
    }
  }
  const light = ctx.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, W * 0.6)
  light.addColorStop(0, 'rgba(255,255,255,0.1)')
  light.addColorStop(1, 'rgba(0,0,0,0.34)')
  ctx.fillStyle = light
  ctx.fillRect(0, 0, W, H)
  const cushion = 10
  ;[
    [0, 0, W, cushion, 0, 0, 0, cushion],
    [0, H - cushion, W, cushion, 0, H, 0, H - cushion],
    [0, 0, cushion, H, 0, 0, cushion, 0],
    [W - cushion, 0, cushion, H, W, 0, W - cushion, 0],
  ].forEach(([x, y, w, h, x0, y0, x1, y1]) => {
    const cg = ctx.createLinearGradient(x0, y0, x1, y1)
    cg.addColorStop(0, 'rgba(0,0,0,0.45)')
    cg.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = cg
    ctx.fillRect(x, y, w, h)
  })
  ctx.save()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.globalAlpha = 0.05
  ctx.strokeStyle = gold
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.ellipse(W / 2, H / 2, 150, 70, 0, 0, Math.PI * 2)
  ctx.stroke()
  ctx.globalAlpha = 0.06
  ctx.fillStyle = gold
  ctx.font = '900 64px system-ui, sans-serif'
  ctx.fillText('AL KANKA', W / 2, H / 2 - 4)
  ctx.globalAlpha = 0.05
  ctx.font = '700 16px system-ui, sans-serif'
  ctx.fillText('alkanka.com', W / 2, H / 2 + 40)
  ctx.restore()
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'
  ctx.beginPath()
  ctx.moveTo(W * 0.25, 0)
  ctx.lineTo(W * 0.25, H)
  ctx.stroke()
  ctx.fillStyle = 'rgba(255,255,255,0.18)'
  ctx.beginPath()
  ctx.arc(W * 0.7, H / 2, 2.5, 0, Math.PI * 2)
  ctx.fill()
  POCKETS.forEach(([px, py], i) => {
    const pr = POCKET_HOLE[i]
    const pg = ctx.createRadialGradient(px, py, pr * 0.2, px, py, pr)
    pg.addColorStop(0, '#000000')
    pg.addColorStop(0.85, '#05070c')
    pg.addColorStop(1, '#10131a')
    ctx.fillStyle = pg
    ctx.beginPath()
    ctx.arc(px, py, pr, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = gold
    ctx.globalAlpha = 0.35
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(px, py, pr, 0, Math.PI * 2)
    ctx.stroke()
    ctx.globalAlpha = 1
  })
  ;[0.125, 0.25, 0.375, 0.625, 0.75, 0.875].forEach((f) => {
    ctx.fillStyle = gold
    ctx.beginPath()
    ctx.arc(W * f, -RAIL / 2, 3, 0, Math.PI * 2)
    ctx.arc(W * f, H + RAIL / 2, 3, 0, Math.PI * 2)
    ctx.fill()
  })
  ;[0.25, 0.5, 0.75].forEach((f) => {
    ctx.fillStyle = gold
    ctx.beginPath()
    ctx.arc(-RAIL / 2, H * f, 3, 0, Math.PI * 2)
    ctx.arc(W + RAIL / 2, H * f, 3, 0, Math.PI * 2)
    ctx.fill()
  })
  return { canvas: c, gold }
}

function castGuide(balls: Ball[], cue: Ball, angle: number) {
  const dx = Math.cos(angle)
  const dy = Math.sin(angle)
  let best: { t: number; ball: Ball } | null = null
  for (const b of balls) {
    if (b.in || b.id === 0) continue
    const fx = cue.x - b.x
    const fy = cue.y - b.y
    const bb = fx * dx + fy * dy
    const c = fx * fx + fy * fy - 4 * R * R
    const disc = bb * bb - c
    if (disc < 0) continue
    const t = -bb - Math.sqrt(disc)
    if (t > 0 && (!best || t < best.t)) best = { t, ball: b }
  }
  return best
}

const pocketAt = (x: number, y: number) => POCKETS.findIndex(([px, py], i) => Math.hypot(px - x, py - y) < POCKET_HOLE[i] + 34)

export function Bilardo({ finish, remote }: { finish?: GameApi['finish']; remote?: Remote<BilardoState> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const remoteRef = useRef(remote)
  remoteRef.current = remote
  const seat = remote?.seat ?? 0
  const oppSeat = other(seat)
  // Live aim mirror: the active player streams cue angle/pull over WebRTC so the rival watches the shot being lined up.
  const link = useDuelLink(remote && !remote.spectator && remote.id ? remote.id : '', seat === 0)
  const linkRef = useRef(link)
  linkRef.current = link
  const oppAim = useRef<{ a: number; back: number; x: number; y: number; t: number } | null>(null)
  link.onMessage.current = (msg) => {
    const m = msg as { type?: string; a?: number; back?: number; x?: number; y?: number }
    if (m?.type !== 'aim' || typeof m.a !== 'number' || typeof m.x !== 'number' || typeof m.y !== 'number') return
    oppAim.current = { a: m.a, back: Math.max(0, Math.min(1, Number(m.back) || 0)), x: m.x, y: m.y, t: performance.now() }
  }
  const [botName, setBotName] = useState(DEFAULT_BOT_NAMES[0])
  useEffect(() => {
    if (!remote) setBotName(pickBotNames(1)[0])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const oppName = remote ? remote.names[oppSeat] || 'Rakip' : botName
  const [flash, setFlash] = useState<{ id: number; text: string; tone: 'gold' | 'red' | 'plain' } | null>(null)
  const flashTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const showFlash = (text: string, tone: 'gold' | 'red' | 'plain' = 'plain') => {
    clearTimeout(flashTimer.current)
    setFlash({ id: performance.now(), text, tone })
    flashTimer.current = setTimeout(() => setFlash(null), 1500)
  }
  const shakeUntil = useRef(0)
  const breakFx = useRef(false)

  const startBalls = () =>
    remote ? (remote.state.balls.length ? remote.state.balls.map(fromState) : rack(seeded(FALLBACK_SEED))) : rack(Math.random)
  const balls = useRef<Ball[]>(startBalls())
  const rolls = useRef(new Map<number, Roll>())
  const drops = useRef<Drop[]>([])
  const pullRef = useRef(0)
  const game = useRef({
    turn: remote ? remote.state.turn : 0,
    shooter: 0,
    groups: (remote ? [remote.state.groups[0], remote.state.groups[1]] : [null, null]) as Groups,
    broken: remote ? (remote.state.broken ?? remote.state.seq > 0) : false,
    moving: false,
    over: false,
    replay: false,
    pending: false,
    failed: false,
    angle: Math.PI,
    lastSeq: remote?.state.seq ?? 0,
    ballInHand: remote ? !!remote.state.ballInHand : false,
    /** Set once the player confirms where the in-hand cue ball goes; reset on every shot. */
    placeDone: false,
    fouls: (remote?.state.fouls ? [remote.state.fouls[0], remote.state.fouls[1]] : [0, 0]) as Fouls,
    breakChoice: (remote?.state.breakChoice ?? null) as number | null,
    call: null as number | null,
    spin: { side: 0, follow: 0, applied: true } as Spin,
    ev: newEvents() as ShotEvents,
    strike: null as { t0: number; input: ShotInput; back: number } | null,
    preview: null as { t0: number; from: number; to: number; input: ShotInput } | null,
    pottedOrder: balls.current.filter((b) => b.in && b.id !== 0).map((b) => b.id),
  })

  const [keyPower, setKeyPowerState] = useState(0.6)
  const keyPowerRef = useRef(keyPower)
  const setKeyPower = (v: number) => {
    keyPowerRef.current = v
    setKeyPowerState(v)
  }
  const [spin, setSpinState] = useState<SpinInput>({ x: 0, y: 0 })
  const spinRef = useRef(spin)
  const setSpin = (v: SpinInput) => {
    spinRef.current = v
    setSpinState(v)
  }
  const [level, setLevelState] = useState<BotLevel>('orta')
  const levelRef = useRef(level)
  const setLevel = (v: BotLevel) => {
    levelRef.current = v
    setLevelState(v)
  }
  const layout = usePhoneLayout()
  const landscape = layout === 'landscape'
  const [spinOpen, setSpinOpen] = useState(false)
  const [aimLocked, setAimLocked] = useState(false)
  const lockedRef = useRef(false)
  const lock = (v: boolean) => {
    lockedRef.current = v
    setAimLocked(v)
  }

  /** The cue ball is movable before the break (behind the head string) and after a foul (anywhere). */
  const inHand = () => game.current.ballInHand || !game.current.broken
  const placingNow = () => {
    const g = game.current
    return inHand() && !g.placeDone && g.turn === seat && g.breakChoice === null && !g.over
  }
  const placeAllowed = (x: number, y: number) => canPlaceCue(balls.current, x, y, !game.current.broken)

  const mustCallNow = () => {
    const g = game.current
    return g.turn === seat && g.broken && needsCall(balls.current, g.groups, seat)
  }

  const turnMessage = (note: string) => {
    const g = game.current
    if (g.over) return note
    let tail: string
    if (g.breakChoice === oppSeat) tail = `${oppName} karar veriyor: yeniden dizmek mi, masayı kabul mü?`
    else if (g.turn !== seat) tail = `${oppName} oynuyor.`
    else if (g.breakChoice === seat) tail = 'Açılış kurala aykırı: toplar yeniden dizilip sen açabilir ya da masayı olduğu gibi kabul edebilirsin.'
    else if (!g.broken)
      tail = g.placeDone
        ? 'Açılış vuruşu sende: nişan al ve vur.'
        : 'Açılış sende: beyazı kesikli çizginin soluna istediğin yere koy, sonra "Yerleştirdim"e bas.'
    else if (g.ballInHand) tail = IN_HAND_MSG
    else if (mustCallNow()) tail = 'Siyah sırası: önce masada bir delik seç, sonra vur.'
    else tail = 'Sıra sende.'
    return note ? `${note} ${tail}` : tail
  }

  const snapshot = (message: string) => {
    const g = game.current
    return {
      turn: g.turn,
      busy: g.moving || !!g.strike || !!g.preview || g.pending,
      over: g.over,
      message,
      groups: [g.groups[0], g.groups[1]] as Groups,
      potted: [...g.pottedOrder],
      inTable: balls.current.filter((b) => !b.in).map((b) => b.id),
      ballInHand: inHand() && g.turn === seat,
      placing: placingNow(),
      call: g.call,
      mustCall: mustCallNow(),
      fouls: [g.fouls[0], g.fouls[1]] as Fouls,
      breakChoice: g.breakChoice,
    }
  }
  const [ui, setUi] = useState(() => snapshot(turnMessage(remote?.state.note ?? '')))
  const sync = (message?: string) => setUi((u) => snapshot(message ?? u.message))

  const keepPottedOrder = () => {
    const g = game.current
    const inIds = balls.current.filter((b) => b.in && b.id !== 0).map((b) => b.id)
    g.pottedOrder = [...g.pottedOrder.filter((id) => inIds.includes(id)), ...inIds.filter((id) => !g.pottedOrder.includes(id))]
  }

  function applyRemote(st: BilardoState) {
    const g = game.current
    const prevTurn = g.turn
    const wasBusy = g.moving || g.pending || g.replay
    g.lastSeq = st.seq
    balls.current = st.balls.length ? st.balls.map(fromState) : rack(seeded(FALLBACK_SEED))
    g.groups = [st.groups[0], st.groups[1]]
    g.turn = st.turn
    if (wasBusy && prevTurn !== st.turn) showFlash(st.turn === seat ? 'Sıra sende' : `Sıra: ${oppName}`, st.turn === seat ? 'gold' : 'plain')
    g.broken = st.broken ?? st.seq > 0
    g.ballInHand = !!st.ballInHand
    g.fouls = [st.fouls?.[0] ?? 0, st.fouls?.[1] ?? 0]
    g.breakChoice = st.breakChoice ?? null
    if (!g.broken) g.pottedOrder = []
    g.pending = false
    g.failed = false
    g.replay = false
    g.call = null
    keepPottedOrder()
    sync(turnMessage(st.note))
  }

  function shoot(input: ShotInput) {
    const g = game.current
    if (g.moving || g.strike || g.over || balls.current[0].in) return
    g.shooter = g.turn
    g.ballInHand = false
    g.placeDone = false
    breakFx.current = false
    g.strike = { t0: performance.now(), input, back: 14 + input.pow * 80 }
    sync(g.turn === seat ? 'Toplar yuvarlanıyor...' : `${oppName} vurdu...`)
  }

  /** Rival shots (bot or replayed online): swing the cue onto the line, pull back, then strike — so the player sees the move. */
  function previewShot(input: ShotInput) {
    const g = game.current
    if (g.moving || g.strike || g.over || balls.current[0].in) return
    const to = Math.atan2(input.dy, input.dx)
    let from = g.angle
    while (from - to > Math.PI) from -= Math.PI * 2
    while (to - from > Math.PI) from += Math.PI * 2
    g.preview = { t0: performance.now(), from, to, input }
    sync(`${oppName} nişan alıyor...`)
  }

  // Remote updates: replay the rival's shot from the current (previous) positions, otherwise snap to the server state.
  useEffect(() => {
    if (!remote) return
    const g = game.current
    const st = remote.state
    if (g.moving || g.strike || g.preview || st.seq <= g.lastSeq) return
    const shot = st.shot
    if (shot && shot.by !== seat && shot.seq === st.seq && st.seq === g.lastSeq + 1) {
      g.replay = true
      g.turn = shot.by
      if (typeof shot.cueX === 'number' && typeof shot.cueY === 'number') {
        balls.current[0].x = shot.cueX
        balls.current[0].y = shot.cueY
      }
      const dx = shot.dx ?? Math.cos(shot.angle ?? 0)
      const dy = shot.dy ?? Math.sin(shot.angle ?? 0)
      previewShot({ dx, dy, pow: shot.pow, spinX: shot.spinX ?? 0, spinY: shot.spinY ?? 0 })
      return
    }
    applyRemote(st)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remote?.state.seq])

  function settle() {
    const g = game.current
    g.moving = false
    const r0 = remoteRef.current
    if (r0) {
      const st = r0.state
      if (st.seq > g.lastSeq || g.failed) applyRemote(st)
      else sync('Sonuç onaylanıyor...')
      return
    }
    const r = resolveShot(balls.current, g.ev, { shooter: g.shooter, groups: g.groups, broken: g.broken, call: g.call, fouls: g.fouls })
    g.broken = true
    g.groups = r.groups
    g.fouls = r.fouls
    g.call = null
    keepPottedOrder()
    if (r.foul) playSound('error')
    if (r.illegalBreak) {
      g.turn = other(g.shooter)
      g.breakChoice = g.turn
      g.ballInHand = false
      sync(turnMessage(r.note))
      if (g.turn !== seat) setTimeout(() => chooseBreak(levelRef.current === 'kolay' ? 'accept' : 'rerack'), 1100)
      return
    }
    if (r.winner !== null) {
      g.over = true
      const won = r.winner === seat
      sync(`${r.note} ${won ? 'Masa senin!' : 'Masa rakibin.'}`)
      setTimeout(() => finish?.(won ? 'win' : 'lose', r.note), 1300)
      return
    }
    g.turn = r.keep ? g.shooter : other(g.shooter)
    g.ballInHand = r.ballInHand
    if (r.foul) showFlash(g.turn === seat ? 'Rakip faul yaptı · Beyaz sende' : 'Faul! · Beyaz rakipte', 'red')
    else if (r.keep) showFlash(g.turn === seat ? 'Top girdi · Devam' : `${oppName} devam ediyor`, 'gold')
    else showFlash(g.turn === seat ? 'Sıra sende' : `Sıra: ${oppName}`, g.turn === seat ? 'gold' : 'plain')
    sync(turnMessage(r.note))
    if (g.turn !== seat) setTimeout(botShot, 900)
  }

  function botShot() {
    const g = game.current
    if (g.over || g.turn === seat) return
    if (!g.broken) {
      // The bot also uses its break placement: a random spot behind the head string.
      for (let i = 0; i < 12; i++) {
        const x = HEAD_X - Math.random() * R * 6
        const y = H / 2 + (Math.random() - 0.5) * H * 0.5
        if (placeAllowed(x, y)) {
          balls.current[0].x = x
          balls.current[0].y = y
          break
        }
      }
    }
    const plan = planShot(balls.current, {
      seat: g.turn,
      groups: g.groups,
      broken: g.broken,
      ballInHand: g.ballInHand && g.broken,
      fouls: g.fouls,
      level: levelRef.current,
    })
    if (plan.cue) {
      balls.current[0].x = plan.cue.x
      balls.current[0].y = plan.cue.y
    }
    if (g.broken && needsCall(balls.current, g.groups, g.turn)) {
      g.call = plan.call
      sync(`${oppName} siyah için delik seçti.`)
    }
    previewShot(plan.input)
  }

  /** After an illegal break: re-rack so the chooser breaks, or accept the table as it lies. */
  function chooseBreak(choice: 'rerack' | 'accept') {
    const g = game.current
    if (g.breakChoice === null || g.over) return
    const r = remoteRef.current
    if (r) {
      g.pending = true
      sync('Karar gönderiliyor...')
      void r.send({ type: 'breakChoice', choice }).then((ok) => {
        if (!ok) applyRemote(remoteRef.current!.state)
      })
      return
    }
    g.breakChoice = null
    if (choice === 'rerack') {
      balls.current = rack(Math.random)
      rolls.current.clear()
      g.groups = [null, null]
      g.broken = false
      g.placeDone = false
      g.pottedOrder = []
    }
    sync(turnMessage(choice === 'rerack' ? 'Toplar yeniden dizildi.' : 'Masa kabul edildi.'))
    if (g.turn !== seat) setTimeout(botShot, 900)
  }

  const canAim = () => {
    const g = game.current
    const r = remoteRef.current
    return (
      !g.moving && !g.strike && !g.over && !g.pending && g.breakChoice === null && g.turn === seat && !balls.current[0].in && (!r || (!r.busy && !r.spectator))
    )
  }

  function fire(pow: number) {
    const g = game.current
    if (!canAim() || pow < 0.03) return
    if (mustCallNow() && g.call === null) {
      playSound('error')
      sync('Önce siyah için bir delik seç: masadaki deliklerden birine dokun.')
      return
    }
    const cue = balls.current[0]
    const input: ShotInput = { dx: Math.cos(g.angle), dy: Math.sin(g.angle), pow: clamp01(pow), spinX: spinRef.current.x, spinY: spinRef.current.y }
    const r = remoteRef.current
    if (r) {
      g.pending = true
      g.failed = false
      const placed = inHand() ? { cueX: cue.x, cueY: cue.y } : {}
      void r.send({ type: 'shot', ...input, ...placed, call: mustCallNow() ? g.call : null }).then((ok) => {
        if (ok) return
        g.failed = true
        if (!g.moving && !g.strike) applyRemote(remoteRef.current!.state)
      })
    }
    shoot(input)
    lock(false)
    setSpin({ x: 0, y: 0 })
  }

  // Render + physics loop.
  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    const dpr = Math.min(window.devicePixelRatio || 1, 3)
    canvas.width = CW * dpr
    canvas.height = CH * dpr
    const { canvas: bg, gold } = paintTable(dpr)
    let raf = 0
    let lastHitSound = 0
    let lastAimSent = { t: 0, a: 0, back: 0, x: 0, y: 0 }
    const rollOf = (id: number) => {
      let r = rolls.current.get(id)
      if (!r) rolls.current.set(id, (r = initialRoll(id)))
      return r
    }
    const hooks: StepHooks = {
      hit: (_a, _b, rel) => {
        const now = performance.now()
        if (!game.current.broken && !breakFx.current && rel > 4) {
          breakFx.current = true
          shakeUntil.current = now + 280
          showFlash('Açılış!', 'gold')
        }
        if (rel > 1.2 && now - lastHitSound > 45) {
          lastHitSound = now
          playSound('tile')
        }
      },
      pot: (b, p) => {
        playSound('pocket')
        drops.current.push({ id: b.id, x: b.x, y: b.y, p, t0: performance.now() })
        if (b.id !== 0 && !game.current.pottedOrder.includes(b.id)) game.current.pottedOrder.push(b.id)
      },
    }

    const draw = (now: number) => {
      const g = game.current
      const list = balls.current
      let previewBack = 0
      if (g.preview) {
        const p = g.preview
        const t = now - p.t0
        const swing = Math.min(1, t / PREVIEW_AIM_MS)
        const ease = swing < 0.5 ? 2 * swing * swing : 1 - (-2 * swing + 2) ** 2 / 2
        g.angle = p.from + (p.to - p.from) * ease
        const pull = Math.max(0, Math.min(1, (t - PREVIEW_AIM_MS) / PREVIEW_PULL_MS))
        previewBack = 14 + pull * p.input.pow * 80
        if (t >= PREVIEW_AIM_MS + PREVIEW_PULL_MS + PREVIEW_HOLD_MS) {
          g.angle = p.to
          g.preview = null
          shoot(p.input)
        }
      }
      if (g.strike && now - g.strike.t0 >= STRIKE_MS) {
        g.spin = startShot(list, g.strike.input)
        g.ev = newEvents()
        g.strike = null
        g.moving = true
        playSound('tile')
      }
      if (g.moving) {
        const prev = list.map((b) => [b.x, b.y])
        stepShot(list, g.spin, g.ev, hooks)
        list.forEach((b, i) => {
          const dx = b.x - prev[i][0]
          const dy = b.y - prev[i][1]
          const d = Math.hypot(dx, dy)
          if (d > 0.01 && !b.in) {
            const r = rollOf(b.id)
            r.n = rotate(r.n, -dy / d, dx / d, d / R)
            r.m = rotate(r.m, -dy / d, dx / d, d / R)
          }
        })
        if (isStill(list)) settle()
      }

      const shaking = now < shakeUntil.current ? (shakeUntil.current - now) / 280 : 0
      const ox = shaking ? (Math.random() - 0.5) * 6 * shaking : 0
      const oy = shaking ? (Math.random() - 0.5) * 6 * shaking : 0
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(bg, ox * dpr, oy * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, (RAIL + ox) * dpr, (RAIL + oy) * dpr)

      const cue = list[0]
      const aiming = canAim()
      const placingPhase = aiming && placingNow()
      const aimingShot = aiming && !placingPhase

      if (aiming && !g.broken && !cue.in) {
        ctx.save()
        ctx.fillStyle = gold
        ctx.globalAlpha = placingPhase ? 0.09 : 0.04
        ctx.fillRect(0, 0, HEAD_X, H)
        ctx.globalAlpha = placingPhase ? 0.85 : 0.4
        ctx.strokeStyle = gold
        ctx.lineWidth = 2
        ctx.setLineDash([8, 6])
        ctx.beginPath()
        ctx.moveTo(HEAD_X, 0)
        ctx.lineTo(HEAD_X, H)
        ctx.stroke()
        ctx.restore()
      }
      const mustCall = aiming && mustCallNow()
      if (mustCall || g.call !== null) {
        const pulse = 0.5 + 0.5 * Math.sin(now / 220)
        POCKETS.forEach(([px, py], i) => {
          if (g.call !== null && g.call !== i) return
          ctx.strokeStyle = gold
          ctx.globalAlpha = g.call === i ? 0.95 : 0.25 + pulse * 0.35
          ctx.lineWidth = g.call === i ? 4 : 2.5
          ctx.beginPath()
          ctx.arc(px, py, POCKET_HOLE[i] + 6 + (g.call === i ? 0 : pulse * 3), 0, Math.PI * 2)
          ctx.stroke()
        })
        ctx.globalAlpha = 1
      }

      if (inHand() && aiming && !cue.in) {
        const pulse = placingPhase ? 0.5 + 0.5 * Math.sin(now / 200) : 0
        ctx.save()
        ctx.setLineDash([4, 5])
        ctx.strokeStyle = gold
        ctx.lineWidth = 2.5
        ctx.beginPath()
        ctx.arc(cue.x, cue.y, R * (2.2 + pulse * 0.4), 0, Math.PI * 2)
        ctx.stroke()
        ctx.restore()
      }

      // The guide stays visible through the strike itself so the line never blinks out at full power.
      if (aimingShot || g.preview || g.strike) {
        if (g.preview || g.strike) ctx.globalAlpha = 0.6
        const hit = castGuide(list, cue, g.angle)
        const len = hit ? hit.t : 1400
        ctx.lineCap = 'round'
        const gx = cue.x + Math.cos(g.angle) * len
        const gy = cue.y + Math.sin(g.angle) * len
        ctx.save()
        ctx.beginPath()
        ctx.rect(0, 0, W, H)
        ctx.clip()
        ctx.setLineDash([6, 8])
        ctx.strokeStyle = 'rgba(255,255,255,0.55)'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(cue.x, cue.y)
        ctx.lineTo(gx, gy)
        ctx.stroke()
        ctx.setLineDash([])
        if (hit) {
          const wrongBall = aiming && g.broken && !legalFor(list, g.groups, seat)(hit.ball)
          ctx.strokeStyle = wrongBall ? 'rgba(239,68,68,0.95)' : 'rgba(255,255,255,0.75)'
          ctx.lineWidth = wrongBall ? 3 : 2
          ctx.beginPath()
          ctx.arc(gx, gy, R, 0, Math.PI * 2)
          ctx.stroke()
          if (wrongBall) {
            ctx.beginPath()
            ctx.arc(hit.ball.x, hit.ball.y, R + 5, 0, Math.PI * 2)
            ctx.stroke()
          }
          const nx = (hit.ball.x - gx) / (2 * R)
          const ny = (hit.ball.y - gy) / (2 * R)
          ctx.strokeStyle = gold
          ctx.lineWidth = 2.5
          ctx.beginPath()
          ctx.moveTo(hit.ball.x, hit.ball.y)
          ctx.lineTo(hit.ball.x + nx * 70, hit.ball.y + ny * 70)
          ctx.stroke()
          const ux = Math.cos(g.angle)
          const uy = Math.sin(g.angle)
          const dot = ux * nx + uy * ny
          const tx = ux - dot * nx
          const ty = uy - dot * ny
          ctx.strokeStyle = 'rgba(255,255,255,0.4)'
          ctx.lineWidth = 1.5
          ctx.beginPath()
          ctx.moveTo(gx, gy)
          ctx.lineTo(gx + tx * 40, gy + ty * 40)
          ctx.stroke()
        }
        ctx.restore()
        ctx.globalAlpha = 1
      }

      for (const b of list) if (!b.in) drawBall(ctx, b, rollOf(b.id))

      drops.current = drops.current.filter((d) => now - d.t0 < DROP_MS)
      for (const d of drops.current) {
        const t = (now - d.t0) / DROP_MS
        const [px, py] = POCKETS[d.p]
        // Slides to the pocket centre first, then sinks: shrinks and darkens as it falls.
        const slide = Math.min(1, t / 0.45)
        const ease = 1 - (1 - slide) * (1 - slide)
        const sink = Math.max(0, (t - 0.35) / 0.65)
        ctx.save()
        ctx.beginPath()
        ctx.arc(px, py, POCKET_HOLE[d.p], 0, Math.PI * 2)
        ctx.clip()
        ctx.globalAlpha = 1 - sink * sink
        drawBall(ctx, { id: d.id, x: d.x + (px - d.x) * ease, y: d.y + (py - d.y) * ease }, rollOf(d.id), 1 - sink * 0.6)
        ctx.fillStyle = `rgba(0,0,0,${sink * 0.7})`
        ctx.beginPath()
        ctx.arc(d.x + (px - d.x) * ease, d.y + (py - d.y) * ease, R * (1 - sink * 0.6), 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }

      if (g.strike) {
        const t = Math.min(1, (now - g.strike.t0) / STRIKE_MS)
        const ang = Math.atan2(g.strike.input.dy, g.strike.input.dx)
        drawCue(ctx, cue.x, cue.y, ang, g.strike.back * (1 - t * t))
      } else if (g.preview && !cue.in) {
        drawCue(ctx, cue.x, cue.y, g.angle, previewBack)
      } else if (aimingShot && !cue.in) {
        drawCue(ctx, cue.x, cue.y, g.angle, 14 + pullRef.current * 80)
        const sent = lastAimSent
        if (
          remoteRef.current &&
          now - sent.t > 60 &&
          (Math.abs(sent.a - g.angle) > 0.002 || Math.abs(sent.back - pullRef.current) > 0.01 || sent.x !== cue.x || sent.y !== cue.y)
        ) {
          lastAimSent = { t: now, a: g.angle, back: pullRef.current, x: cue.x, y: cue.y }
          linkRef.current.send({ type: 'aim', a: g.angle, back: pullRef.current, x: cue.x, y: cue.y })
        }
      } else if (!g.moving && remoteRef.current && !remoteRef.current.myTurn && oppAim.current && now - oppAim.current.t < 2500) {
        const o = oppAim.current
        const ghost = { ...cue, x: o.x, y: o.y }
        const hit = castGuide(list, ghost, o.a)
        const len = hit ? hit.t : 1400
        ctx.save()
        ctx.beginPath()
        ctx.rect(0, 0, W, H)
        ctx.clip()
        ctx.globalAlpha = 0.45
        ctx.setLineDash([6, 8])
        ctx.strokeStyle = 'rgba(255,255,255,0.8)'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(o.x, o.y)
        ctx.lineTo(o.x + Math.cos(o.a) * len, o.y + Math.sin(o.a) * len)
        ctx.stroke()
        ctx.restore()
        ctx.globalAlpha = 0.85
        drawCue(ctx, o.x, o.y, o.a, 14 + o.back * 80)
        ctx.globalAlpha = 1
      }

      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [landscape])

  const tablePoint = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    return { x: ((e.clientX - rect.left) / rect.width) * CW - RAIL, y: ((e.clientY - rect.top) / rect.height) * CH - RAIL }
  }
  const rotateAim = (delta: number) => {
    if (!canAim()) return
    game.current.angle += delta
    lock(true)
  }
  /** Points the cue at the pointer. Ignores positions on top of the cue ball, where atan2 swings wildly. */
  const aimAt = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const { x, y } = tablePoint(e)
    const cue = balls.current[0]
    if (Math.hypot(x - cue.x, y - cue.y) < R * 1.5) return
    game.current.angle = Math.atan2(y - cue.y, x - cue.x)
  }
  /** Moves the in-hand cue ball, sliding it along the head string instead of refusing when dragged past it. */
  const moveCueTo = (x: number, y: number) => {
    const kitchen = !game.current.broken
    const px = kitchen ? Math.min(x, HEAD_X) : x
    if (placeAllowed(px, y)) {
      balls.current[0].x = px
      balls.current[0].y = y
    }
  }
  const confirmPlacement = () => {
    const g = game.current
    if (!placingNow()) return
    g.placeDone = true
    playSound('tile')
    sync(turnMessage(''))
  }
  const placing = useRef<number | null>(null)
  const drag = useRef<{ id: number; x: number; y: number; moved: boolean; pull?: { x: number; y: number } } | null>(null)

  function onPointerDown(e: ReactPointerEvent<HTMLCanvasElement>) {
    e.currentTarget.focus({ preventScroll: true })
    if (!canAim()) return
    const g = game.current
    const pt = tablePoint(e)
    if (mustCallNow()) {
      const p = pocketAt(pt.x, pt.y)
      if (p >= 0) {
        g.call = p
        playSound('tile')
        sync('Delik seçildi. Şimdi nişan al ve vur.')
        return
      }
    }
    e.currentTarget.setPointerCapture(e.pointerId)
    const cue = balls.current[0]
    // Placement step: any touch on the table moves the cue ball there; afterwards it can still be dragged from close by.
    if (placingNow() || (inHand() && Math.hypot(pt.x - cue.x, pt.y - cue.y) < R * 3)) {
      placing.current = e.pointerId
      moveCueTo(pt.x, pt.y)
      return
    }
    // With the aim locked, dragging on the table pulls the cue back like a real stroke; release to shoot.
    if (lockedRef.current) {
      drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false, pull: pt }
      return
    }
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false }
    aimAt(e)
  }

  function onPointerMove(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (!canAim()) return
    if (placing.current === e.pointerId) {
      const pt = tablePoint(e)
      moveCueTo(pt.x, pt.y)
      return
    }
    const d = drag.current
    if (d && d.id === e.pointerId) {
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4) d.moved = true
      if (d.pull) {
        const pt = tablePoint(e)
        const a = game.current.angle
        const back = -((pt.x - d.pull.x) * Math.cos(a) + (pt.y - d.pull.y) * Math.sin(a))
        pullRef.current = clamp01(back / TABLE_PULL_RANGE)
        return
      }
      aimAt(e)
    } else if (!lockedRef.current && e.pointerType === 'mouse') {
      aimAt(e)
    }
  }

  function onPointerUp(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (placing.current === e.pointerId) {
      placing.current = null
      return
    }
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    drag.current = null
    if (d.pull) {
      const pow = pullRef.current
      pullRef.current = 0
      if (!d.moved) lock(false)
      else if (pow >= 0.03) fire(pow)
      return
    }
    // A drag always leaves the aim locked; a plain click toggles the lock.
    lock(d.moved ? true : !lockedRef.current)
  }

  // Keyboard works anywhere on the page, except while typing in a field.
  useEffect(() => {
    const held = new Set<string>()
    let raf = 0
    let last = 0
    let heldFor = 0
    const typing = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))
    const tick = (now: number) => {
      const dt = Math.min(50, now - (last || now))
      last = now
      heldFor += dt
      const dir = (held.has('right') ? 1 : 0) - (held.has('left') ? 1 : 0)
      if (dir && canAim()) {
        // Starts precise, then speeds up the longer the key is held.
        const base = held.has('fine') ? 0.15 : Math.min(2.4, 0.5 + heldFor / 600)
        game.current.angle += dir * base * (dt / 1000)
      }
      raf = dir ? requestAnimationFrame(tick) : 0
    }
    const down = (e: KeyboardEvent) => {
      if (typing(e.target) || e.metaKey || e.ctrlKey || e.altKey) return
      const k = e.key
      if (k === 'ArrowLeft' || k === 'a' || k === 'A') held.add('left')
      else if (k === 'ArrowRight' || k === 'd' || k === 'D') held.add('right')
      else if (k === 'ArrowUp' || k === 'w' || k === 'W') setKeyPower(Math.min(1, Math.round((keyPowerRef.current + 0.05) * 100) / 100))
      else if (k === 'ArrowDown' || k === 's' || k === 'S') setKeyPower(Math.max(0.05, Math.round((keyPowerRef.current - 0.05) * 100) / 100))
      else if (k === ' ' || k === 'Enter') {
        if (e.repeat) return e.preventDefault()
        fire(keyPowerRef.current)
      } else return
      held[e.shiftKey ? 'add' : 'delete']('fine')
      e.preventDefault()
      if ((held.has('left') || held.has('right')) && !raf) {
        last = 0
        heldFor = 0
        lock(true)
        raf = requestAnimationFrame(tick)
      }
    }
    const up = (e: KeyboardEvent) => {
      const k = e.key
      if (k === 'ArrowLeft' || k === 'a' || k === 'A') held.delete('left')
      if (k === 'ArrowRight' || k === 'd' || k === 'D') held.delete('right')
      if (k === 'Shift') held.delete('fine')
    }
    const clear = () => held.clear()
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', clear)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', clear)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const yourTurn = ui.turn === seat && !ui.busy && !ui.over
  const groupLabel = (g: Group | null) => (g === 'solid' ? 'Düz (1-7)' : g === 'stripe' ? 'Çizgili (9-15)' : 'Masa açık')
  const remaining = (g: Group | null) => (g ? [1, 2, 3, 4, 5, 6, 7].map((n) => (g === 'solid' ? n : n + 8)).filter((n) => ui.inTable.includes(n)) : [])
  const choosing = ui.breakChoice === seat && !ui.over && !ui.busy
  const hint = !yourTurn || choosing
    ? null
    : ui.placing
      ? ['Beyazı yerleştir: masada istediğin yere dokun ya da sürükle', 'Beyazı yerleştir']
      : ui.mustCall && ui.call === null
      ? ['Siyah için bir deliğe dokun', 'Delik seç']
      : ui.ballInHand
        ? ['Beyazı sürükle · Gücü çekip bırak', 'Beyazı koy']
        : aimLocked
          ? ['Nişan kilitli · Masada geri çekip bırak ya da güç çubuğu · Dokun: kilidi aç', 'Geri çek, bırak']
          : landscape
            ? ['', 'Nişan al · Soldaki gücü aşağı çek']
            : ['Nişan al · Alttaki gücü sağa çek, bırak', 'Nişan al']

  const canvasEl = (
    <div className="relative min-w-0" style={landscape ? { width: 'min(100%, calc((100svh - 1rem) * 1076 / 576))' } : undefined}>
      <canvas
        ref={canvasRef}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => ((drag.current = null), (placing.current = null), (pullRef.current = 0))}
        aria-label="Bilardo masası. Sürükleyerek nişan al, güç çubuğunu çekip bırakarak vur. Ok tuşlarıyla döndür, boşluk ile vur."
        className={cn(
          'block touch-none rounded-3xl shadow-2xl outline-none focus-visible:ring-2 focus-visible:ring-primary',
          'aspect-[1076/576] w-full',
          yourTurn ? 'cursor-crosshair' : 'cursor-wait',
        )}
      />
      <TableBrand className="rounded-3xl" center={false} corners={false} jako={false} plaque="left" />
      {flash && (
        <span
          key={flash.id}
          role="status"
          className={cn(
            'pointer-events-none absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 animate-in fade-in zoom-in-90 whitespace-nowrap rounded-full px-4 py-1.5 font-display text-sm font-extrabold uppercase tracking-wider shadow-xl duration-300 sm:text-base',
            flash.tone === 'gold' && 'bg-primary text-primary-foreground',
            flash.tone === 'red' && 'bg-destructive text-destructive-foreground',
            flash.tone === 'plain' && 'bg-card/90 text-foreground backdrop-blur-sm',
          )}
        >
          {flash.text}
        </span>
      )}
      {ui.placing && yourTurn && (
        <button
          type="button"
          onClick={confirmPlacement}
          className="absolute bottom-[12%] left-[13%] -translate-x-1/2 rounded-full bg-primary px-4 py-2 text-xs font-extrabold uppercase tracking-wider text-primary-foreground shadow-xl outline-none transition hover:brightness-110 focus-visible:ring-2 focus-visible:ring-ring active:scale-95 sm:text-sm"
        >
          Yerleştirdim
        </button>
      )}
      {hint && (
        <span
          className={cn(
            'pointer-events-none absolute left-1/2 top-2 max-w-[80%] -translate-x-1/2 truncate rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider shadow-md backdrop-blur-sm sm:top-3 sm:text-[11px]',
            aimLocked || ui.mustCall ? 'bg-primary text-primary-foreground' : 'bg-background/75 text-foreground',
          )}
        >
          <span className="md:hidden">{hint[1]}</span>
          <span className="hidden md:inline">{hint[0] || hint[1]}</span>
        </span>
      )}
      {choosing && (
        <div className="absolute inset-0 flex items-center justify-center rounded-3xl bg-background/60 p-4 backdrop-blur-sm">
          <div className="flex max-w-sm flex-col gap-3 rounded-2xl border border-primary/50 bg-card p-4 text-center shadow-2xl">
            <p className="font-display text-base font-extrabold text-foreground">Açılış kurala aykırı</p>
            <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
              {oppName} açılışta yeterince top banda göndermedi. Ne yapmak istersin?
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => chooseBreak('rerack')}
                className="flex-1 rounded-xl bg-primary px-3 py-2.5 text-sm font-bold text-primary-foreground transition hover:brightness-110"
              >
                Yeniden diz, ben açayım
              </button>
              <button
                type="button"
                onClick={() => chooseBreak('accept')}
                className="flex-1 rounded-xl bg-secondary px-3 py-2.5 text-sm font-bold text-foreground transition hover:bg-secondary/70"
              >
                Masayı kabul et
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  if (landscape) {
    return (
      <div className="fixed inset-0 z-50 flex items-stretch gap-2 bg-background py-2 pl-[max(0.5rem,env(safe-area-inset-left))] pr-[max(0.5rem,env(safe-area-inset-right))]">
        <PowerBar vertical disabled={!yourTurn || ui.placing} preset={keyPower} pullRef={pullRef} onRelease={fire} />
        <div className="relative flex min-w-0 flex-1 items-center justify-center">
          {canvasEl}
          {spinOpen && yourTurn && (
            <div className="absolute bottom-0 right-0 z-10 rounded-2xl border border-border bg-card p-2 shadow-2xl">
              <SpinPad value={spin} onChange={setSpin} />
            </div>
          )}
        </div>
        <aside className="flex w-40 shrink-0 flex-col gap-1.5 overflow-y-auto">
          <a
            href="/oyunlar"
            onClick={() => {
              if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {})
            }}
            className="flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-border bg-secondary px-2 text-xs font-bold text-foreground active:scale-95"
          >
            <LogOut className="size-4" aria-hidden="true" /> Oyundan çık
          </a>
          {[seat, oppSeat].map((s) => (
            <div
              key={s}
              className={cn(
                'flex min-w-0 items-center gap-1.5 rounded-lg border bg-card px-1.5 py-1',
                ui.turn === s && !ui.over ? 'border-primary' : 'border-border',
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={avatarFor(s, !!remote)} alt="" className="size-6 shrink-0 rounded-full bg-secondary object-cover" />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <div className="flex min-w-0 items-center justify-between gap-1">
                  <span className="truncate text-xs font-bold text-foreground">{s === seat ? 'Sen' : oppName}</span>
                  {ui.fouls[s] > 0 && (
                    <span className="shrink-0 text-[10px] font-bold tabular-nums text-destructive">F{ui.fouls[s]}/{MAX_FOULS}</span>
                  )}
                </div>
                <div className="flex min-w-0 flex-wrap gap-0.5">
                  {ui.groups[s] ? (
                    remaining(ui.groups[s]).length === 0 ? <BallChip n={8} /> : remaining(ui.groups[s]).map((n) => <BallChip key={n} n={n} />)
                  ) : (
                    <span className="text-[10px] text-muted-foreground">{groupLabel(null)}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
          {!remote && (
            <div role="radiogroup" aria-label="Bot seviyesi" className="flex gap-0.5 rounded-lg bg-secondary p-0.5">
              {BOT_LEVELS.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  role="radio"
                  aria-checked={level === l.id}
                  onClick={() => setLevel(l.id)}
                  className={cn(
                    'flex-1 rounded-md py-1 text-[10px] font-bold transition-colors',
                    level === l.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground',
                  )}
                >
                  {l.label}
                </button>
              ))}
            </div>
          )}
          <p className="line-clamp-3 text-[11px] font-semibold leading-snug text-foreground" aria-live="polite">
            {ui.message}
          </p>
          <SpinButton labeled value={spin} open={spinOpen && yourTurn} onToggle={() => setSpinOpen((o) => !o)} disabled={!yourTurn} />
          <AimStrip vertical disabled={!yourTurn || ui.placing} onRotate={rotateAim} />
        </aside>
      </div>
    )
  }

  return (
    <div className={cn('relative flex flex-col gap-3', layout === 'portrait' && 'max-h-[80svh] overflow-hidden')}>
      {layout === 'portrait' && (
        <div className="absolute inset-0 z-30 flex flex-col items-center gap-4 rounded-2xl border border-border bg-card px-6 pt-14 text-center">
          <span className="flex size-20 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Smartphone className="size-10 rotate-90" aria-hidden="true" />
          </span>
          <h2 className="font-display text-xl font-extrabold text-foreground text-balance">Telefonunu yan çevir</h2>
          <p className="max-w-xs text-sm leading-relaxed text-muted-foreground text-pretty">
            Bilardo yatay masada oynanır. Telefonu yan çevirdiğinde masa tam ekran açılır.
          </p>
          <button
            type="button"
            onClick={goLandscape}
            className="flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-md transition hover:brightness-110 active:scale-95"
          >
            <RotateCw className="size-4" aria-hidden="true" />
            Tam ekran yatay oyna
          </button>
          <p className="text-xs text-muted-foreground">iPhone&apos;da ekran döndürme kilidini kapatman yeterli.</p>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        {[seat, oppSeat].map((s) => (
          <div
            key={s}
            className={cn(
              'flex min-w-0 items-center gap-2.5 rounded-xl border bg-card px-2.5 py-2 transition-colors sm:px-3',
              ui.turn === s && !ui.over ? 'border-primary glow-gold' : 'border-border',
            )}
          >
            <span className={cn('relative size-9 shrink-0 overflow-hidden rounded-full bg-secondary ring-2', ui.turn === s && !ui.over ? 'ring-primary' : 'ring-border')}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={avatarFor(s, !!remote)} alt="" className="size-full object-cover" />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex min-w-0 items-center justify-between gap-2">
                <span className="truncate text-sm font-bold text-foreground">{s === seat ? 'Sen' : oppName}</span>
                {ui.fouls[s] > 0 && (
                  <span className="shrink-0 rounded-full bg-destructive/15 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-destructive">
                    Faul {ui.fouls[s]}/{MAX_FOULS}
                  </span>
                )}
              </div>
              <div className="flex min-w-0 flex-wrap items-center gap-1">
                {ui.groups[s] ? (
                  <>
                    {remaining(ui.groups[s]).map((n) => (
                      <BallChip key={n} n={n} />
                    ))}
                    {remaining(ui.groups[s]).length === 0 && <BallChip n={8} />}
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground">{groupLabel(null)}</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {!remote && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Bot seviyesi</span>
          <div role="radiogroup" aria-label="Bot seviyesi" className="flex gap-1 rounded-lg bg-secondary p-1">
            {BOT_LEVELS.map((l) => (
              <button
                key={l.id}
                type="button"
                role="radio"
                aria-checked={level === l.id}
                onClick={() => setLevel(l.id)}
                className={cn(
                  'rounded-md px-3 py-1 text-xs font-bold transition-colors',
                  level === l.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2 sm:gap-3">
        {canvasEl}
        <div
          className={cn(
            'flex flex-col gap-2 rounded-2xl border bg-card p-2 transition-colors sm:p-2.5',
            yourTurn ? 'border-primary/40' : 'border-border',
          )}
        >
          <div className="flex items-center gap-2 sm:gap-3">
            <SpinButton value={spin} open={spinOpen && yourTurn} onToggle={() => setSpinOpen((o) => !o)} disabled={!yourTurn} />
            <PowerBar disabled={!yourTurn || ui.placing} preset={keyPower} pullRef={pullRef} onRelease={fire} />
            <AimStrip compact disabled={!yourTurn} onRotate={rotateAim} />
            <button
              type="button"
              disabled={!yourTurn || ui.placing}
              onClick={() => fire(keyPowerRef.current)}
              className="hidden h-12 shrink-0 flex-col items-center justify-center rounded-xl bg-primary px-6 text-primary-foreground shadow-md outline-none transition hover:brightness-110 focus-visible:ring-2 focus-visible:ring-ring active:scale-95 disabled:opacity-40 disabled:hover:brightness-100 md:flex"
            >
              <span className="font-display text-sm font-extrabold uppercase leading-none tracking-wider">Vur</span>
              <span className="mt-1 text-[10px] font-bold tabular-nums leading-none opacity-80">%{Math.round(keyPower * 100)}</span>
            </button>
          </div>
          {spinOpen && yourTurn && (
            <div className="flex justify-center border-t border-border pt-2">
              <SpinPad value={spin} onChange={setSpin} />
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-semibold leading-relaxed text-foreground text-pretty" aria-live="polite">
          {ui.message}
        </p>
        <div className="flex shrink-0 flex-col gap-1.5 sm:items-end">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Sokulan toplar</span>
          <div className="flex min-h-8 flex-wrap items-center gap-1 rounded-full border border-border bg-background px-2 py-1 shadow-[inset_0_2px_6px_rgb(0_0_0/0.35)]">
            {ui.potted.length === 0 ? (
              <span className="px-1 text-xs text-muted-foreground">Henüz yok</span>
            ) : (
              ui.potted.map((n) => <BallChip key={n} n={n} />)
            )}
          </div>
        </div>
      </div>

      <KeyGuide />
    </div>
  )
}

/** Drag sideways to nudge the aim by tiny amounts — the precise control phones lack. */
function AimStrip({
  disabled,
  onRotate,
  compact,
  vertical,
}: {
  disabled: boolean
  onRotate: (delta: number) => void
  compact?: boolean
  vertical?: boolean
}) {
  const last = useRef<{ id: number; v: number } | null>(null)
  const [offset, setOffset] = useState(0)
  return (
    <div
      role="slider"
      tabIndex={-1}
      aria-label={vertical ? 'İnce nişan: yukarı aşağı sürükle' : 'İnce nişan: sağa sola sürükle'}
      aria-orientation={vertical ? 'vertical' : 'horizontal'}
      aria-valuenow={0}
      aria-disabled={disabled}
      onPointerDown={(e) => {
        if (disabled) return
        e.currentTarget.setPointerCapture(e.pointerId)
        last.current = { id: e.pointerId, v: vertical ? e.clientY : e.clientX }
      }}
      onPointerMove={(e) => {
        const l = last.current
        if (!l || l.id !== e.pointerId) return
        const v = vertical ? e.clientY : e.clientX
        const d = v - l.v
        l.v = v
        onRotate(d * 0.0016)
        setOffset((o) => (o + d) % 16)
      }}
      onPointerUp={() => (last.current = null)}
      onPointerCancel={() => (last.current = null)}
      className={cn(
        'relative flex touch-none select-none items-center justify-center overflow-hidden rounded-xl bg-secondary',
        vertical ? 'min-h-24 flex-1' : 'h-12',
        !vertical && (compact ? 'w-32 shrink-0' : 'min-w-0 flex-1'),
        disabled ? 'opacity-40' : vertical ? 'cursor-ns-resize' : 'cursor-ew-resize',
      )}
    >
      <div
        aria-hidden="true"
        className={vertical ? 'absolute inset-x-4 -bottom-4 -top-4' : 'absolute inset-y-3 -left-4 -right-4'}
        style={{
          backgroundImage: `repeating-linear-gradient(${vertical ? 180 : 90}deg, color-mix(in oklab, var(--foreground) 22%, transparent) 0 1px, transparent 1px 8px)`,
          transform: vertical ? `translateY(${offset}px)` : `translateX(${offset}px)`,
        }}
      />
      {vertical ? (
        <span className="relative flex flex-col items-center gap-1 rounded-lg border border-border bg-card px-2 py-1.5 text-muted-foreground shadow-md">
          <ChevronUp className="size-4" aria-hidden="true" />
          <span className="text-[10px] font-bold uppercase leading-tight tracking-wider text-foreground">
            İnce
            <br />
            nişan
          </span>
          <ChevronDown className="size-4" aria-hidden="true" />
        </span>
      ) : (
        <span className="relative rounded-md bg-secondary px-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">İnce nişan</span>
      )}
    </div>
  )
}

function BallChip({ n }: { n: number }) {
  return (
    <span
      className="flex size-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-tile-black shadow-sm ring-1 ring-foreground/40"
      style={{ background: n > 8 ? `linear-gradient(${BALL_COLORS[0]} 25%, ${BALL_COLORS[n - 8]} 25% 75%, ${BALL_COLORS[0]} 75%)` : BALL_COLORS[n] }}
      aria-label={`${n} numaralı top`}
    >
      <span className="flex size-3 items-center justify-center rounded-full bg-checker-light">{n}</span>
    </span>
  )
}

/** Horizontal cue-pull track: drag right to pull the cue back, release to strike. Dragging back to the start cancels. */
function PowerBar({
  disabled,
  preset,
  pullRef,
  onRelease,
  vertical,
}: {
  disabled: boolean
  preset: number
  pullRef: React.MutableRefObject<number>
  onRelease: (pow: number) => void
  vertical?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const active = useRef<{ id: number; y: number } | null>(null)
  const [pull, setPullState] = useState(0)
  const setPull = (v: number) => {
    pullRef.current = v
    setPullState(v)
  }
  const pulling = pull > 0
  const shown = pulling ? pull : preset
  const handlers = {
    onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => {
      if (disabled) return
      e.currentTarget.setPointerCapture(e.pointerId)
      active.current = { id: e.pointerId, y: vertical ? e.clientY : e.clientX }
      setPull(0)
    },
    onPointerMove: (e: ReactPointerEvent<HTMLDivElement>) => {
      const a = active.current
      if (!a || a.id !== e.pointerId) return
      const rect = ref.current?.getBoundingClientRect()
      const span = ((vertical ? rect?.height : rect?.width) ?? 240) * (vertical ? 0.6 : 0.75)
      setPull(clamp01(((vertical ? e.clientY : e.clientX) - a.y) / span))
    },
    onPointerUp: (e: ReactPointerEvent<HTMLDivElement>) => {
      const a = active.current
      if (!a || a.id !== e.pointerId) return
      active.current = null
      const v = pullRef.current
      setPull(0)
      if (!disabled) onRelease(v)
    },
    onPointerCancel: () => {
      active.current = null
      setPull(0)
    },
  }
  if (vertical) {
    return (
      <div
        ref={ref}
        role="slider"
        tabIndex={-1}
        aria-label="Vuruş gücü: aşağı çekip bırak"
        aria-orientation="vertical"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(shown * 100)}
        aria-disabled={disabled}
        {...handlers}
        className={cn(
          'relative w-12 shrink-0 touch-none select-none overflow-hidden rounded-xl bg-secondary',
          disabled ? 'opacity-40' : 'cursor-grab active:cursor-grabbing',
        )}
      >
        <div aria-hidden="true" className={cn('absolute inset-x-0 top-0 bg-primary', !pulling && 'transition-[height] duration-200')} style={{ height: `${pull * 100}%` }} />
        <span aria-hidden="true" className="absolute inset-x-2 h-0.5 -translate-y-1/2 rounded-full bg-foreground/50" style={{ top: `${preset * 100}%` }} />
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-between py-3">
          <span className={cn('text-[10px] font-bold uppercase', pulling ? 'text-primary-foreground' : 'text-muted-foreground')}>Güç</span>
          <span className="text-[10px] font-bold uppercase text-muted-foreground [writing-mode:vertical-rl]">
            {pulling ? (pull < 0.05 ? 'İptal' : 'Bırak') : 'Aşağı çek'}
          </span>
          <span className="rounded-md bg-card px-1 py-0.5 font-display text-xs font-extrabold tabular-nums text-foreground shadow-md ring-1 ring-border">
            %{Math.round(shown * 100)}
          </span>
        </div>
      </div>
    )
  }
  return (
    <div
      ref={ref}
      role="slider"
      tabIndex={-1}
      aria-label="Vuruş gücü: sağa çekip bırak"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(shown * 100)}
      aria-disabled={disabled}
      {...handlers}
      className={cn(
        'relative h-12 min-w-0 flex-1 touch-none select-none overflow-hidden rounded-xl bg-secondary',
        disabled ? 'opacity-40' : 'cursor-grab active:cursor-grabbing',
      )}
    >
      <div aria-hidden="true" className="absolute inset-0 flex justify-evenly">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="my-3 w-px bg-foreground/10" />
        ))}
      </div>
      <div
        aria-hidden="true"
        className={cn('absolute inset-y-0 left-0 bg-primary', !pulling && 'transition-[width] duration-200')}
        style={{ width: `${pull * 100}%` }}
      />
      <span
        aria-hidden="true"
        className="absolute inset-y-2 w-0.5 -translate-x-1/2 rounded-full bg-foreground/50"
        style={{ left: `${preset * 100}%` }}
      />
      <div className="pointer-events-none absolute inset-0 flex items-center justify-between gap-2 px-3">
        <span className={cn('truncate text-xs font-bold uppercase tracking-wider', pulling ? 'text-primary-foreground' : 'text-muted-foreground')}>
          {pulling ? (pull < 0.05 ? 'Bırakırsan iptal' : 'Bırak, vursun') : 'Güç · sağa çek'}
        </span>
        <span className={cn('font-display text-base font-extrabold tabular-nums', pulling && pull > 0.85 ? 'text-primary-foreground' : 'text-foreground')}>
          {Math.round(shown * 100)}
        </span>
      </div>
    </div>
  )
}

function spinLabel({ x, y }: SpinInput) {
  if (Math.hypot(x, y) < 0.12) return 'Ortadan'
  const v = y > 0.25 ? 'Üst' : y < -0.25 ? 'Alt' : ''
  const h = x > 0.25 ? 'Sağ' : x < -0.25 ? 'Sol' : ''
  return [v, h].filter(Boolean).join(' · ') || 'Hafif'
}

/** Cue-ball button in the shot dock; toggles the contact-point picker inline below the dock so it never covers the table. */
function SpinButton({
  value,
  open,
  onToggle,
  disabled,
  labeled,
}: {
  value: SpinInput
  open: boolean
  onToggle: () => void
  disabled: boolean
  /** Always show the "Falso" caption (narrow side panels), not only from the sm breakpoint. */
  labeled?: boolean
}) {
  return (
    <div className="relative shrink-0">
      <button
        type="button"
        aria-expanded={open}
        aria-label={`Falso: ${spinLabel(value)}. Değiştirmek için aç.`}
        disabled={disabled}
        onClick={onToggle}
        className={cn(
          'flex h-12 items-center gap-2.5 rounded-xl bg-secondary px-2 outline-none transition-colors hover:bg-secondary/70 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40 sm:pr-3',
          labeled && 'w-full pr-3',
          open && 'ring-2 ring-primary',
        )}
      >
        <span className="relative size-8 shrink-0 rounded-full bg-checker-light shadow-[inset_-3px_-4px_7px_rgb(0_0_0/0.25)]">
          <span
            aria-hidden="true"
            className="absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-destructive"
            style={{ left: `${50 + value.x * 50}%`, top: `${50 - value.y * 50}%` }}
          />
        </span>
        <span className={cn('flex-col items-start', labeled ? 'flex' : 'hidden sm:flex')}>
          <span className="text-[10px] font-bold uppercase leading-none tracking-wider text-muted-foreground">Falso</span>
          <span className="mt-1 text-xs font-semibold leading-none text-foreground">{spinLabel(value)}</span>
        </span>
      </button>
    </div>
  )
}

/** Cue-ball contact point picker: drag the tip marker anywhere on the ball to set english and follow/draw. */
function SpinPad({ value, onChange }: { value: SpinInput; onChange: (v: SpinInput) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const set = (clientX: number, clientY: number) => {
    const r = ref.current?.getBoundingClientRect()
    if (!r) return
    let x = ((clientX - r.left) / r.width) * 2 - 1
    let y = -(((clientY - r.top) / r.height) * 2 - 1)
    const d = Math.hypot(x, y)
    if (d > 0.8) ((x = (x / d) * 0.8), (y = (y / d) * 0.8))
    onChange({ x: Math.round(x * 20) / 20, y: Math.round(y * 20) / 20 })
  }
  const nudge = (dx: number, dy: number) => {
    let x = value.x + dx
    let y = value.y + dy
    const d = Math.hypot(x, y)
    if (d > 0.8) ((x = (x / d) * 0.8), (y = (y / d) * 0.8))
    onChange({ x, y })
  }
  return (
    <div className="flex items-center gap-3">
      <div
        ref={ref}
        role="slider"
        tabIndex={0}
        aria-label="Falso noktası"
        aria-valuetext={spinLabel(value)}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          set(e.clientX, e.clientY)
        }}
        onPointerMove={(e) => e.buttons && set(e.clientX, e.clientY)}
        onDoubleClick={() => onChange({ x: 0, y: 0 })}
        onKeyDown={(e) => {
          const map: Record<string, [number, number]> = { ArrowUp: [0, 0.1], ArrowDown: [0, -0.1], ArrowLeft: [-0.1, 0], ArrowRight: [0.1, 0] }
          const m = map[e.key]
          if (!m) return
          e.preventDefault()
          e.stopPropagation()
          nudge(m[0], m[1])
        }}
        className="relative size-20 shrink-0 cursor-crosshair touch-none rounded-full bg-checker-light shadow-[inset_-6px_-8px_14px_rgb(0_0_0/0.25),0_4px_10px_rgb(0_0_0/0.35)] outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <span aria-hidden="true" className="absolute inset-x-1/2 inset-y-2 w-px -translate-x-1/2 bg-checker-dark/20" />
        <span aria-hidden="true" className="absolute inset-x-2 inset-y-1/2 h-px -translate-y-1/2 bg-checker-dark/20" />
        <span
          aria-hidden="true"
          className="absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-destructive ring-2 ring-checker-light"
          style={{ left: `${50 + value.x * 50}%`, top: `${50 - value.y * 50}%` }}
        />
      </div>
      <div className="flex min-w-16 flex-col">
        <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Falso</span>
        <span className="text-sm font-semibold text-foreground">{spinLabel(value)}</span>
        {(value.x !== 0 || value.y !== 0) && (
          <button type="button" onClick={() => onChange({ x: 0, y: 0 })} className="self-start text-[11px] font-semibold text-primary hover:underline">
            Sıfırla
          </button>
        )}
      </div>
    </div>
  )
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex min-w-6 items-center justify-center rounded-md border border-b-2 border-border bg-secondary px-1.5 py-0.5 font-mono text-[11px] font-bold text-foreground">
      {children}
    </kbd>
  )
}

function KeyGuide() {
  const rows: { keys: React.ReactNode; label: string }[] = [
    { keys: <span className="text-xs font-semibold text-foreground">Fare</span>, label: 'İmleçle nişan al, tıklayınca nişan kilitlenir' },
    { keys: <span className="text-xs font-semibold text-foreground">Güç çubuğu</span>, label: 'Sağa çek, bırakınca vurur. Başa geri getirirsen iptal' },
    { keys: (<><Kbd>←</Kbd><Kbd>→</Kbd></>), label: 'İstekayı döndür (basılı tut, hızlanır)' },
    { keys: (<><Kbd>Shift</Kbd><span className="text-muted-foreground">+</span><Kbd>←→</Kbd></>), label: 'İnce ayar' },
    { keys: (<><Kbd>↑</Kbd><Kbd>↓</Kbd></>), label: 'Klavye vuruş gücü ±5 (çubuktaki çizgi)' },
    { keys: (<><Kbd>Boşluk</Kbd><Kbd>Enter</Kbd></>), label: 'Klavye gücüyle vur' },
    { keys: <span className="text-xs font-semibold text-foreground">Falso</span>, label: 'Alttaki beyaz topa dokun: üst = takip, alt = geri çekme' },
    { keys: <span className="text-xs font-semibold text-foreground">Siyah</span>, label: 'Grubun bitince siyahı atacağın deliğe dokunup seç' },
  ]
  return (
    <details className="group hidden rounded-2xl border border-border bg-card md:block">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-bold text-foreground">
        Tuş rehberi ve kurallar
        <span className="text-xs font-medium text-muted-foreground group-open:hidden">Göster</span>
        <span className="hidden text-xs font-medium text-muted-foreground group-open:inline">Gizle</span>
      </summary>
      <ul className="grid gap-x-6 gap-y-2.5 border-t border-border px-4 py-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center gap-3">
            <span className="flex shrink-0 items-center gap-1">{r.keys}</span>
            <span className="text-xs leading-relaxed text-muted-foreground">{r.label}</span>
          </li>
        ))}
      </ul>
      <p className="border-t border-border px-4 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
        Açılışta top düşmezse en az 4 top banda gitmeli. Açılıştan sonra masa açıktır, ilk sokulan top grubunu belirler. Açılışta düşen siyah yerine konur.
      </p>
    </details>
  )
}
