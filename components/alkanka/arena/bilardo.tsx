'use client'

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { cn } from '@/lib/utils'
import type { BilardoState } from '@/lib/pvp/rules'
import type { GameApi } from './stake-gate'
import type { Remote } from './remote'
import { playSound } from '@/lib/sound'
import { TableBrand } from './table-brand'
import {
  FALLBACK_SEED,
  H,
  POCKETS,
  POCKET_R,
  R,
  RAIL,
  W,
  canPlaceCue,
  fromState,
  groupOf,
  isStill,
  needsCall,
  newEvents,
  rack,
  resolveShot,
  seeded,
  startShot,
  stepShot,
  type Ball,
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
const DROP_MS = 320
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
    if (surfaceSpot(ctx, x, y, r, p, 0.46, BALL_COLORS[0]) && scale > 0.6) {
      ctx.fillStyle = '#141414'
      ctx.font = `bold ${Math.round(8 * scale)}px system-ui, sans-serif`
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

function drawCue(ctx: CanvasRenderingContext2D, cx: number, cy: number, angle: number, back: number) {
  const sx = cx - Math.cos(angle) * (R + back)
  const sy = cy - Math.sin(angle) * (R + back)
  const ex = cx - Math.cos(angle) * (R + back + 360)
  const ey = cy - Math.sin(angle) * (R + back + 360)
  ctx.save()
  ctx.strokeStyle = 'rgba(0,0,0,0.3)'
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
  stick.addColorStop(0.73, '#3a2214')
  stick.addColorStop(1, '#1d120a')
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
  ctx.globalAlpha = 0.1
  ctx.strokeStyle = gold
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.ellipse(W / 2, H / 2, 150, 70, 0, 0, Math.PI * 2)
  ctx.stroke()
  ctx.globalAlpha = 0.13
  ctx.fillStyle = gold
  ctx.font = '900 64px system-ui, sans-serif'
  ctx.fillText('AL KANKA', W / 2, H / 2 - 4)
  ctx.globalAlpha = 0.1
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
  for (const [px, py] of POCKETS) {
    const pg = ctx.createRadialGradient(px, py, POCKET_R * 0.2, px, py, POCKET_R * 1.15)
    pg.addColorStop(0, '#000000')
    pg.addColorStop(0.75, '#05070c')
    pg.addColorStop(1, 'rgba(5,7,12,0)')
    ctx.fillStyle = pg
    ctx.beginPath()
    ctx.arc(px, py, POCKET_R * 1.15, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = gold
    ctx.globalAlpha = 0.3
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(px, py, POCKET_R, 0, Math.PI * 2)
    ctx.stroke()
    ctx.globalAlpha = 1
  }
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

function clearPath(balls: Ball[], x1: number, y1: number, x2: number, y2: number, skip: number[]) {
  const dx = x2 - x1
  const dy = y2 - y1
  const len2 = dx * dx + dy * dy || 1
  for (const b of balls) {
    if (b.in || skip.includes(b.id)) continue
    const t = Math.max(0, Math.min(1, ((b.x - x1) * dx + (b.y - y1) * dy) / len2))
    if (Math.hypot(x1 + dx * t - b.x, y1 + dy * t - b.y) < R * 2.05) return false
  }
  return true
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

const pocketAt = (x: number, y: number) => POCKETS.findIndex(([px, py]) => Math.hypot(px - x, py - y) < POCKET_R * 2.6)

export function Bilardo({ finish, remote }: { finish?: GameApi['finish']; remote?: Remote<BilardoState> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const remoteRef = useRef(remote)
  remoteRef.current = remote
  const seat = remote?.seat ?? 0
  const oppSeat = other(seat)
  const oppName = remote ? remote.names[oppSeat] || 'Rakip' : 'Baykuş'

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
    call: null as number | null,
    spin: { side: 0, follow: 0, applied: true } as Spin,
    ev: newEvents() as ShotEvents,
    strike: null as { t0: number; input: ShotInput; back: number } | null,
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
  const [aimLocked, setAimLocked] = useState(false)
  const lockedRef = useRef(false)
  const lock = (v: boolean) => {
    lockedRef.current = v
    setAimLocked(v)
  }

  const mustCallNow = () => {
    const g = game.current
    return g.turn === seat && g.broken && needsCall(balls.current, g.groups, seat)
  }

  const turnMessage = (note: string) => {
    const g = game.current
    if (g.over) return note
    let tail: string
    if (g.turn !== seat) tail = `${oppName} oynuyor.`
    else if (g.ballInHand) tail = IN_HAND_MSG
    else if (!g.broken) tail = 'Açılış vuruşu sende.'
    else if (mustCallNow()) tail = 'Siyah sırası: önce masada bir delik seç, sonra vur.'
    else tail = 'Sıra sende.'
    return note ? `${note} ${tail}` : tail
  }

  const snapshot = (message: string) => {
    const g = game.current
    return {
      turn: g.turn,
      busy: g.moving || !!g.strike || g.pending,
      over: g.over,
      message,
      groups: [g.groups[0], g.groups[1]] as Groups,
      potted: [...g.pottedOrder],
      inTable: balls.current.filter((b) => !b.in).map((b) => b.id),
      ballInHand: g.ballInHand && g.turn === seat,
      call: g.call,
      mustCall: mustCallNow(),
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
    g.lastSeq = st.seq
    balls.current = st.balls.length ? st.balls.map(fromState) : rack(seeded(FALLBACK_SEED))
    g.groups = [st.groups[0], st.groups[1]]
    g.turn = st.turn
    g.broken = st.broken ?? st.seq > 0
    g.ballInHand = !!st.ballInHand
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
    g.strike = { t0: performance.now(), input, back: 14 + input.pow * 80 }
    sync(g.turn === seat ? 'Toplar yuvarlanıyor...' : `${oppName} vurdu...`)
  }

  // Remote updates: replay the rival's shot from the current (previous) positions, otherwise snap to the server state.
  useEffect(() => {
    if (!remote) return
    const g = game.current
    const st = remote.state
    if (g.moving || g.strike || st.seq <= g.lastSeq) return
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
      shoot({ dx, dy, pow: shot.pow, spinX: shot.spinX ?? 0, spinY: shot.spinY ?? 0 })
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
    const r = resolveShot(balls.current, g.ev, { shooter: g.shooter, groups: g.groups, broken: g.broken, call: g.call })
    g.broken = true
    g.groups = r.groups
    g.call = null
    keepPottedOrder()
    if (r.foul) playSound('error')
    if (r.winner !== null) {
      g.over = true
      const won = r.winner === seat
      sync(`${r.note} ${won ? 'Masa senin!' : 'Masa rakibin.'}`)
      setTimeout(() => finish?.(won ? 'win' : 'lose', r.note), 1300)
      return
    }
    g.turn = r.keep ? g.shooter : other(g.shooter)
    g.ballInHand = r.ballInHand
    sync(turnMessage(r.note))
    if (g.turn !== seat) setTimeout(botShot, 900)
  }

  function botShot() {
    const g = game.current
    if (g.over) return
    const list = balls.current
    const cue = list[0]
    const me = g.turn
    const mine = g.groups[me]
    if (!g.broken) {
      const apex = list.filter((b) => b.id !== 0 && !b.in).sort((a, b) => a.x - b.x)[0]
      const ang = Math.atan2(apex.y - cue.y + (Math.random() - 0.5) * 6, apex.x - cue.x)
      return shoot({ dx: Math.cos(ang), dy: Math.sin(ang), pow: 1, spinX: 0, spinY: 0 })
    }
    const onBlack = needsCall(list, g.groups, me)
    const legal = (b: Ball) => !b.in && b.id !== 0 && (onBlack ? b.id === 8 : mine === null ? b.id !== 8 : groupOf(b.id) === mine)
    if (g.ballInHand) {
      for (const t of list.filter(legal)) {
        const [px, py] = POCKETS.reduce((a, p) => (Math.hypot(p[0] - t.x, p[1] - t.y) < Math.hypot(a[0] - t.x, a[1] - t.y) ? p : a))
        const d = Math.hypot(px - t.x, py - t.y) || 1
        const x = t.x - ((px - t.x) / d) * R * 9
        const y = t.y - ((py - t.y) / d) * R * 9
        if (canPlaceCue(list, x, y)) {
          cue.x = x
          cue.y = y
          break
        }
      }
    }
    let best: { angle: number; score: number; dist: number; pocket: number } | null = null
    for (const t of list.filter(legal)) {
      POCKETS.forEach(([px, py], pocket) => {
        const tx = px - t.x
        const ty = py - t.y
        const td = Math.hypot(tx, ty)
        const gx = t.x - (tx / td) * R * 2
        const gy = t.y - (ty / td) * R * 2
        const ax = gx - cue.x
        const ay = gy - cue.y
        const ad = Math.hypot(ax, ay)
        const cos = (ax * tx + ay * ty) / (ad * td)
        if (cos < 0.35) return
        if (!clearPath(list, cue.x, cue.y, gx, gy, [0, t.id])) return
        if (!clearPath(list, t.x, t.y, px, py, [t.id])) return
        const score = cos * 2 - (ad + td) / 900
        if (!best || score > best.score) best = { angle: Math.atan2(ay, ax), score, dist: ad + td, pocket }
      })
    }
    const chosen = best as { angle: number; score: number; dist: number; pocket: number } | null
    if (onBlack) {
      const eight = list.find((b) => b.id === 8)!
      g.call =
        chosen?.pocket ??
        POCKETS.reduce((bi, p, i) => (Math.hypot(p[0] - eight.x, p[1] - eight.y) < Math.hypot(POCKETS[bi][0] - eight.x, POCKETS[bi][1] - eight.y) ? i : bi), 0)
      sync(`${oppName} siyah için delik seçti.`)
    }
    if (!chosen) {
      const near = list.filter(legal).sort((a, b) => Math.hypot(a.x - cue.x, a.y - cue.y) - Math.hypot(b.x - cue.x, b.y - cue.y))[0]
      const ang = (near ? Math.atan2(near.y - cue.y, near.x - cue.x) : Math.random() * Math.PI * 2) + (Math.random() - 0.5) * 0.05
      return shoot({ dx: Math.cos(ang), dy: Math.sin(ang), pow: 0.55, spinX: 0, spinY: 0 })
    }
    const ang = chosen.angle + (Math.random() - 0.5) * 0.028
    // A little draw keeps the bot's cue ball from following the object ball in.
    shoot({ dx: Math.cos(ang), dy: Math.sin(ang), pow: Math.min(0.95, 0.3 + chosen.dist / 1800), spinX: 0, spinY: -0.25 })
  }

  const canAim = () => {
    const g = game.current
    const r = remoteRef.current
    return !g.moving && !g.strike && !g.over && !g.pending && g.turn === seat && !balls.current[0].in && (!r || (!r.busy && !r.spectator))
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
      const placed = g.ballInHand ? { cueX: cue.x, cueY: cue.y } : {}
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
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = CW * dpr
    canvas.height = CH * dpr
    const { canvas: bg, gold } = paintTable(dpr)
    let raf = 0
    let lastHitSound = 0
    const rollOf = (id: number) => {
      let r = rolls.current.get(id)
      if (!r) rolls.current.set(id, (r = initialRoll(id)))
      return r
    }
    const hooks: StepHooks = {
      hit: (_a, _b, rel) => {
        const now = performance.now()
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

      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(bg, 0, 0)
      ctx.setTransform(dpr, 0, 0, dpr, RAIL * dpr, RAIL * dpr)

      const cue = list[0]
      const aiming = canAim()
      const mustCall = aiming && mustCallNow()
      if (mustCall || g.call !== null) {
        const pulse = 0.5 + 0.5 * Math.sin(now / 220)
        POCKETS.forEach(([px, py], i) => {
          if (g.call !== null && g.call !== i) return
          ctx.strokeStyle = gold
          ctx.globalAlpha = g.call === i ? 0.95 : 0.25 + pulse * 0.35
          ctx.lineWidth = g.call === i ? 4 : 2.5
          ctx.beginPath()
          ctx.arc(px, py, POCKET_R + 6 + (g.call === i ? 0 : pulse * 3), 0, Math.PI * 2)
          ctx.stroke()
        })
        ctx.globalAlpha = 1
      }

      if (g.ballInHand && aiming && !cue.in) {
        ctx.save()
        ctx.setLineDash([4, 5])
        ctx.strokeStyle = gold
        ctx.lineWidth = 2.5
        ctx.beginPath()
        ctx.arc(cue.x, cue.y, R * 2.2, 0, Math.PI * 2)
        ctx.stroke()
        ctx.restore()
      }

      if (aiming) {
        const hit = castGuide(list, cue, g.angle)
        const len = hit ? hit.t : 1400
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
          ctx.strokeStyle = 'rgba(255,255,255,0.75)'
          ctx.beginPath()
          ctx.arc(gx, gy, R, 0, Math.PI * 2)
          ctx.stroke()
          const nx = (hit.ball.x - gx) / (2 * R)
          const ny = (hit.ball.y - gy) / (2 * R)
          ctx.strokeStyle = gold
          ctx.lineWidth = 2.5
          ctx.beginPath()
          ctx.moveTo(hit.ball.x, hit.ball.y)
          ctx.lineTo(hit.ball.x + nx * 110, hit.ball.y + ny * 110)
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
          ctx.lineTo(gx + tx * 70, gy + ty * 70)
          ctx.stroke()
        }
        ctx.restore()
      }

      for (const b of list) if (!b.in) drawBall(ctx, b, rollOf(b.id))

      drops.current = drops.current.filter((d) => now - d.t0 < DROP_MS)
      for (const d of drops.current) {
        const t = (now - d.t0) / DROP_MS
        const [px, py] = POCKETS[d.p]
        ctx.globalAlpha = 1 - t * t
        drawBall(ctx, { id: d.id, x: d.x + (px - d.x) * t, y: d.y + (py - d.y) * t }, rollOf(d.id), 1 - t * 0.55)
        ctx.globalAlpha = 1
      }

      if (g.strike) {
        const t = Math.min(1, (now - g.strike.t0) / STRIKE_MS)
        const ang = Math.atan2(g.strike.input.dy, g.strike.input.dx)
        drawCue(ctx, cue.x, cue.y, ang, g.strike.back * (1 - t * t))
      } else if (aiming && !cue.in) {
        drawCue(ctx, cue.x, cue.y, g.angle, 14 + pullRef.current * 80)
      }

      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const tablePoint = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    return { x: ((e.clientX - rect.left) / rect.width) * CW - RAIL, y: ((e.clientY - rect.top) / rect.height) * CH - RAIL }
  }
  /** Points the cue at the pointer. Ignores positions on top of the cue ball, where atan2 swings wildly. */
  const aimAt = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const { x, y } = tablePoint(e)
    const cue = balls.current[0]
    if (Math.hypot(x - cue.x, y - cue.y) < R * 1.5) return
    game.current.angle = Math.atan2(y - cue.y, x - cue.x)
  }
  const placing = useRef<number | null>(null)
  const drag = useRef<{ id: number; x: number; y: number; moved: boolean } | null>(null)

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
    if (g.ballInHand && Math.hypot(pt.x - cue.x, pt.y - cue.y) < R * 3) {
      placing.current = e.pointerId
      return
    }
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false }
    aimAt(e)
  }

  function onPointerMove(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (!canAim()) return
    if (placing.current === e.pointerId) {
      const pt = tablePoint(e)
      if (canPlaceCue(balls.current, pt.x, pt.y)) {
        balls.current[0].x = pt.x
        balls.current[0].y = pt.y
      }
      return
    }
    const d = drag.current
    if (d && d.id === e.pointerId) {
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4) d.moved = true
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
  const hint = !yourTurn
    ? null
    : ui.mustCall && ui.call === null
      ? 'Siyah için bir deliğe dokun'
      : ui.ballInHand
        ? 'Beyazı sürükle · Gücü çekip bırak'
        : aimLocked
          ? 'Nişan kilitli · Gücü çekip bırak'
          : 'Nişan al · Sağdaki gücü aşağı çek, bırak'

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        {[seat, oppSeat].map((s) => (
          <div
            key={s}
            className={cn(
              'flex min-w-0 flex-col gap-2 rounded-xl border bg-card px-3 py-2.5 transition-colors sm:flex-row sm:items-center sm:justify-between sm:px-4',
              ui.turn === s && !ui.over ? 'border-primary glow-gold' : 'border-border',
            )}
          >
            <div className="flex min-w-0 flex-col">
              <span className="flex items-center gap-2 truncate text-sm font-bold text-foreground">
                {ui.turn === s && !ui.over && <span className="size-2 shrink-0 animate-pulse rounded-full bg-primary" aria-hidden="true" />}
                {s === seat ? 'Sen' : oppName}
              </span>
              <span className="text-xs text-muted-foreground">{groupLabel(ui.groups[s])}</span>
            </div>
            <div className="flex flex-wrap gap-1 sm:justify-end">
              {remaining(ui.groups[s]).map((n) => (
                <BallChip key={n} n={n} />
              ))}
              {ui.groups[s] && remaining(ui.groups[s]).length === 0 && <BallChip n={8} />}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-stretch gap-2 sm:gap-3">
        <div className="relative min-w-0 flex-1">
          <canvas
            ref={canvasRef}
            tabIndex={0}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={() => ((drag.current = null), (placing.current = null))}
            aria-label="Bilardo masası. Sürükleyerek nişan al, sağdaki güç çubuğunu aşağı çekip bırakarak vur. Ok tuşlarıyla döndür, boşluk ile vur."
            className={cn(
              'block aspect-[1076/576] w-full touch-none rounded-3xl shadow-2xl outline-none focus-visible:ring-2 focus-visible:ring-primary',
              yourTurn ? 'cursor-crosshair' : 'cursor-wait',
            )}
          />
          <TableBrand className="rounded-3xl" center={false} corners={false} jako={false} plaque="bottom" />
          <SpinControl value={spin} onChange={setSpin} disabled={!yourTurn} />
          {hint && (
            <span
              className={cn(
                'pointer-events-none absolute left-1/2 top-2 max-w-[70%] -translate-x-1/2 truncate rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider shadow-md backdrop-blur-sm sm:top-3 sm:text-[11px]',
                aimLocked || ui.mustCall ? 'bg-primary text-primary-foreground' : 'bg-background/75 text-foreground',
              )}
            >
              {hint}
            </span>
          )}
        </div>
        <PowerBar disabled={!yourTurn} preset={keyPower} pullRef={pullRef} onRelease={fire} />
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-semibold leading-relaxed text-foreground text-pretty" aria-live="polite">
          {ui.message}
        </p>
        <div className="flex shrink-0 flex-col gap-1.5 sm:items-end">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Sokulan toplar</span>
          <div className="flex min-h-6 flex-wrap items-center gap-1 rounded-full bg-secondary px-2 py-1">
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

function BallChip({ n }: { n: number }) {
  return (
    <span
      className="flex size-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-tile-black shadow-sm"
      style={{ background: n > 8 ? `linear-gradient(${BALL_COLORS[0]} 25%, ${BALL_COLORS[n - 8]} 25% 75%, ${BALL_COLORS[0]} 75%)` : BALL_COLORS[n] }}
      aria-label={`${n} numaralı top`}
    >
      <span className="flex size-3 items-center justify-center rounded-full bg-checker-light">{n}</span>
    </span>
  )
}

/** Vertical cue-pull bar: drag down to pull the cue back, release to strike. Dragging back to the top cancels. */
function PowerBar({
  disabled,
  preset,
  pullRef,
  onRelease,
}: {
  disabled: boolean
  preset: number
  pullRef: React.MutableRefObject<number>
  onRelease: (pow: number) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const active = useRef<{ id: number; y: number } | null>(null)
  const [pull, setPullState] = useState(0)
  const setPull = (v: number) => {
    pullRef.current = v
    setPullState(v)
  }
  const shown = pull > 0 ? pull : preset
  return (
    <div
      ref={ref}
      role="slider"
      tabIndex={-1}
      aria-label="Vuruş gücü: aşağı çekip bırak"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(shown * 100)}
      aria-disabled={disabled}
      onPointerDown={(e) => {
        if (disabled) return
        e.currentTarget.setPointerCapture(e.pointerId)
        active.current = { id: e.pointerId, y: e.clientY }
        setPull(0)
      }}
      onPointerMove={(e) => {
        const a = active.current
        if (!a || a.id !== e.pointerId) return
        const h = (ref.current?.getBoundingClientRect().height ?? 200) * 0.8
        setPull(clamp01((e.clientY - a.y) / h))
      }}
      onPointerUp={(e) => {
        const a = active.current
        if (!a || a.id !== e.pointerId) return
        active.current = null
        const v = pullRef.current
        setPull(0)
        if (!disabled) onRelease(v)
      }}
      onPointerCancel={() => {
        active.current = null
        setPull(0)
      }}
      className={cn(
        'flex w-11 shrink-0 touch-none select-none flex-col items-center gap-2 rounded-2xl border border-border bg-card px-1 py-2 sm:w-14',
        disabled ? 'opacity-40' : 'cursor-grab active:cursor-grabbing',
      )}
    >
      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Güç</span>
      <div className="relative w-3 flex-1 rounded-full bg-secondary">
        <div className="absolute inset-x-0 top-0 rounded-full bg-primary" style={{ height: `${pull * 100}%` }} />
        <div className="absolute -inset-x-1.5 h-0.5 rounded-full bg-foreground/60" style={{ top: `${preset * 100}%` }} aria-hidden="true" />
      </div>
      <span className="font-display text-xs font-bold tabular-nums text-foreground">{Math.round(shown * 100)}</span>
    </div>
  )
}

function spinLabel({ x, y }: SpinInput) {
  if (Math.hypot(x, y) < 0.12) return 'Ortadan'
  const v = y > 0.25 ? 'Üst' : y < -0.25 ? 'Alt' : ''
  const h = x > 0.25 ? 'Sağ' : x < -0.25 ? 'Sol' : ''
  return [v, h].filter(Boolean).join(' · ') || 'Hafif'
}

/** Small cue-ball icon on the table corner; opens the contact-point picker. */
function SpinControl({ value, onChange, disabled }: { value: SpinInput; onChange: (v: SpinInput) => void; disabled: boolean }) {
  const [open, setOpen] = useState(false)
  const show = open && !disabled
  return (
    <div className="absolute left-[4.5%] top-[9%] z-10 flex flex-col items-start gap-2">
      <button
        type="button"
        aria-expanded={show}
        aria-label={`Falso: ${spinLabel(value)}. Değiştirmek için aç.`}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="relative size-8 rounded-full bg-checker-light shadow-[inset_-4px_-5px_9px_rgb(0_0_0/0.25),0_3px_8px_rgb(0_0_0/0.45)] outline-none ring-primary focus-visible:ring-2 disabled:opacity-50 sm:size-10"
      >
        <span
          aria-hidden="true"
          className="absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-destructive sm:size-2.5"
          style={{ left: `${50 + value.x * 50}%`, top: `${50 - value.y * 50}%` }}
        />
      </button>
      {show && (
        <div className="rounded-2xl border border-border bg-card/95 p-3 shadow-xl backdrop-blur">
          <SpinPad value={value} onChange={onChange} />
        </div>
      )}
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
    { keys: <span className="text-xs font-semibold text-foreground">Güç çubuğu</span>, label: 'Aşağı çek, bırakınca vurur. Yukarı geri getirirsen iptal' },
    { keys: (<><Kbd>←</Kbd><Kbd>→</Kbd></>), label: 'İstekayı döndür (basılı tut, hızlanır)' },
    { keys: (<><Kbd>Shift</Kbd><span className="text-muted-foreground">+</span><Kbd>←→</Kbd></>), label: 'İnce ayar' },
    { keys: (<><Kbd>↑</Kbd><Kbd>↓</Kbd></>), label: 'Klavye vuruş gücü ±5 (çubuktaki çizgi)' },
    { keys: (<><Kbd>Boşluk</Kbd><Kbd>Enter</Kbd></>), label: 'Klavye gücüyle vur' },
    { keys: <span className="text-xs font-semibold text-foreground">Falso</span>, label: 'Masanın köşesindeki beyaz topa dokun: üst = takip, alt = geri çekme' },
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
