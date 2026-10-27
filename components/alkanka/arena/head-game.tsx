'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import NextImage from 'next/image'
import { ArrowBigUp, ChevronLeft, ChevronRight, Footprints, Loader2, Maximize2, Minimize2, Settings2, Smartphone, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TableBrand } from './table-brand'
import type { DuelLink } from './duel-link'
import { playSound, setSoundMuted, startCrowdAmbience, useSoundMuted, type SoundName } from '@/lib/sound'

export type Sport = 'futbol' | 'basket'
/** `bot`: solo vs AI. `host`: seat 0 runs physics and streams it. `guest`: seat 1 sends keys and renders the host's stream. */
export type HeadMode = 'bot' | 'host' | 'guest'
export type HeadScore = { for: number; against: number }

const W = 960
const H = 540
const GROUND = 482
const G = 0.6
const HEAD_R = 40
const FOOT = HEAD_R + 30
const BALL_R = 17
const MATCH_SECONDS = 60
const STEP_MS = 1000 / 60
/** Golden-goal extra time played when regulation ends level. */
const OVERTIME_SECONDS = 15
/** Steps (3 s) a player may stand inside their own goal before being pushed out. */
const CAMP_LIMIT = 180
const SHOT_CLOCK_STEPS = 720
/** Steps (0.5 s) of holding kick for a full-power shot. */
const CHARGE_MAX = 30
/** Steps (15 s) the host waits for a rival who turned their phone upright. */
const RIVAL_HOLD_STEPS = 15 * 60

type Player = {
  x: number
  y: number
  vx: number
  vy: number
  face: 1 | -1
  kick: number
  run: number
  charge: number
  power: number
  camp: number
}
type Ball = { x: number; y: number; vx: number; vy: number; rot: number }
type Keys = { left: boolean; right: boolean; jump: boolean; kick: boolean }
const noKeys = (): Keys => ({ left: false, right: false, jump: false, kick: false })
/** Sounds plus haptic pulses: `h0`/`h1` vibrate one seat's phone, `hb` vibrates both. */
type EventName = SoundName | 'h0' | 'h1' | 'hb'
type NetEvent = [EventName, number]
type Emit = (name: EventName, v?: number) => void
type RemoteMe = Pick<Player, 'x' | 'y' | 'vx' | 'vy' | 'face' | 'kick' | 'power'> & { kn: number }
const clamp = (v: unknown, lo: number, hi: number) => Math.max(lo, Math.min(hi, Number(v) || 0))

/* --------------------------- control preferences --------------------------- */

type BotLevel = 'easy' | 'mid' | 'hard'
type ControlPrefs = { size: 's' | 'm' | 'l'; opacity: 'low' | 'mid' | 'high'; haptics: boolean; bot: BotLevel }
const PREFS_KEY = 'alkanka:head-controls'
const DEFAULT_PREFS: ControlPrefs = { size: 'm', opacity: 'mid', haptics: true, bot: 'mid' }
let prefs = DEFAULT_PREFS
let prefsLoaded = false
const prefListeners = new Set<() => void>()

function readPrefs() {
  if (!prefsLoaded && typeof window !== 'undefined') {
    prefsLoaded = true
    try {
      prefs = { ...DEFAULT_PREFS, ...JSON.parse(window.localStorage.getItem(PREFS_KEY) ?? '{}') }
    } catch {
      prefs = DEFAULT_PREFS
    }
  }
  return prefs
}

function setPrefs(patch: Partial<ControlPrefs>) {
  prefs = { ...readPrefs(), ...patch }
  window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
  prefListeners.forEach((l) => l())
}

function usePrefs() {
  return useSyncExternalStore(
    (l) => {
      prefListeners.add(l)
      return () => prefListeners.delete(l)
    },
    readPrefs,
    () => DEFAULT_PREFS,
  )
}

function playEvents(list: NetEvent[], seat: 0 | 1) {
  for (const [name, v] of list) {
    if (name === 'hb' || name === 'h0' || name === 'h1') {
      if ((name === 'hb' || name === `h${seat}`) && readPrefs().haptics) navigator.vibrate?.(v)
    } else playSound(name, v)
  }
}

const GOAL_TOP = GROUND - 176
const GOAL_DEPTH = 74
const RIM_Y = 236
const RIM_W = 84
const NET_H = 52
const BOARD_X = 40
/** A basket counts 3 when the shooter's last touch was this far from the hoop centre. */
const THREE_DIST = 330
/** Steps between bot decisions; a slower reaction makes an easier opponent. */
const BOT_REACT: Record<BotLevel, number> = { easy: 14, mid: 7, hard: 1 }
const rimLeft = () => ({ a: BOARD_X + 8, b: BOARD_X + 8 + RIM_W })
const rimRight = () => ({ a: W - BOARD_X - 8 - RIM_W, b: W - BOARD_X - 8 })

const ARENA_FILL: Record<Sport, string> = {
  futbol: 'linear-gradient(#0a1630, #1d4f5e 72%, #0b0d12 72%, #0b0d12 78.5%, #2f8a3e 78.5%)',
  basket: 'linear-gradient(#120d0a, #2a1a12 72%, #0b0d12 72%, #0b0d12 78.5%, #b97a43 78.5%)',
}

const TEAM = {
  home: { jersey: '#e5b93e', trim: '#1a1a1a', shorts: '#16181d', boot: '#e5b93e' },
  away: { jersey: '#2f6fd1', trim: '#ffffff', shorts: '#0f2a56', boot: '#ffffff' },
}

function resetPositions(p1: Player, p2: Player, ball: Ball, serveTo: 0 | 1) {
  Object.assign(p1, { x: 230, y: GROUND - FOOT, vx: 0, vy: 0, face: 1, kick: 0, charge: 0, power: 1, camp: 0 })
  Object.assign(p2, { x: W - 230, y: GROUND - FOOT, vx: 0, vy: 0, face: -1, kick: 0, charge: 0, power: 1, camp: 0 })
  Object.assign(ball, { x: W / 2, y: 150, vx: serveTo === 0 ? -1.2 : 1.2, vy: 0 })
}

function onGround(p: Player) {
  return p.y >= GROUND - FOOT - 0.5
}

function stepPlayer(p: Player, k: Keys, sport: Sport) {
  const target = (k.right ? 6.2 : 0) - (k.left ? 6.2 : 0)
  p.vx += (target - p.vx) * (onGround(p) ? 0.45 : 0.25)
  if (Math.abs(p.vx) < 0.05) p.vx = 0
  if (target) p.face = target > 0 ? 1 : -1
  if (k.jump && onGround(p)) p.vy = -13.4
  // Hold to charge, release to shoot: a tap is a normal shot, a half-second hold up to 35% harder.
  if (k.kick) p.charge = Math.min(CHARGE_MAX, p.charge + 1)
  else if (p.charge > 0) {
    if (p.kick <= 0) {
      p.kick = 16
      p.power = 1 + 0.35 * (p.charge / CHARGE_MAX)
    }
    p.charge = 0
  }
  if (p.kick > 0) p.kick--
  p.vy += G
  p.x += p.vx
  p.y += p.vy
  if (p.y > GROUND - FOOT) {
    p.y = GROUND - FOOT
    p.vy = 0
  }
  if (onGround(p) && p.vx) p.run += Math.abs(p.vx) * 0.12
  const margin = sport === 'futbol' ? GOAL_DEPTH * 0.55 : 24
  p.x = Math.max(HEAD_R + margin, Math.min(W - HEAD_R - margin, p.x))
}

/** Anti camping: 3 s inside your own goal (or under your own hoop) and the referee pushes you back out to open play. */
function campRule(p: Player, side: 0 | 1, sport: Sport, emit: Emit) {
  const out = side === 0 ? 1 : -1
  const zone = sport === 'futbol' ? GOAL_DEPTH + HEAD_R * 0.6 : BOARD_X + 8 + RIM_W + 20
  if (p.camp >= CAMP_LIMIT) {
    p.x += out * 7
    p.vx = 0
    if (side === 0 ? p.x > zone + 150 : p.x < W - zone - 150) p.camp = 0
    return
  }
  const inGoal = side === 0 ? p.x < zone : p.x > W - zone
  if (inGoal) {
    p.camp++
    if (p.camp === CAMP_LIMIT) emit('whistle', 0.7)
  } else p.camp = Math.max(0, p.camp - 2)
}

function blendPlayer(out: Player, a: Player, b: Player, t: number) {
  Object.assign(out, b)
  if (Math.hypot(b.x - a.x, b.y - a.y) > 150) return
  out.x = a.x + (b.x - a.x) * t
  out.y = a.y + (b.y - a.y) * t
}

function blendBall(out: Ball, a: Ball, b: Ball, t: number) {
  Object.assign(out, b)
  if (Math.hypot(b.x - a.x, b.y - a.y) > 150) return
  out.x = a.x + (b.x - a.x) * t
  out.y = a.y + (b.y - a.y) * t
  out.rot = a.rot + (b.rot - a.rot) * t
}

function separatePlayers(a: Player, b: Player) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const min = HEAD_R * 1.9
  if (Math.abs(dx) < min && Math.abs(dy) < HEAD_R * 1.6) {
    if (dy < -HEAD_R && b.vy > 0) {
      b.y = a.y - HEAD_R * 1.6
      b.vy = -6
      return
    }
    if (dy > HEAD_R && a.vy > 0) {
      a.y = b.y - HEAD_R * 1.6
      a.vy = -6
      return
    }
    const push = (min - Math.abs(dx)) / 2
    const s = dx >= 0 ? 1 : -1
    a.x -= push * s
    b.x += push * s
  }
}

function collideCircle(ball: Ball, cx: number, cy: number, r: number, pvx = 0, pvy = 0, bounce = 0.85) {
  const dx = ball.x - cx
  const dy = ball.y - cy
  const dist = Math.hypot(dx, dy) || 0.001
  const min = r + BALL_R
  if (dist >= min) return null
  const nx = dx / dist
  const ny = dy / dist
  ball.x = cx + nx * min
  ball.y = cy + ny * min
  const rvx = ball.vx - pvx
  const rvy = ball.vy - pvy
  const dot = rvx * nx + rvy * ny
  if (dot < 0) {
    ball.vx -= (1 + bounce) * dot * nx
    ball.vy -= (1 + bounce) * dot * ny
  }
  ball.vx += pvx * 0.3
  ball.vy += Math.min(0, pvy) * 0.3
  return { nx, ny }
}

function stepBall(ball: Ball, sport: Sport, emit: Emit) {
  ball.vy += 0.42
  ball.vx *= 0.996
  ball.x += ball.vx
  ball.y += ball.vy
  ball.rot += ball.vx / BALL_R
  const sp = Math.hypot(ball.vx, ball.vy)
  if (sp > 24) {
    ball.vx *= 24 / sp
    ball.vy *= 24 / sp
  }
  const speed = Math.min(24, sp)
  if (ball.y > GROUND - BALL_R) {
    const impact = ball.vy
    ball.y = GROUND - BALL_R
    ball.vy *= sport === 'basket' ? -0.78 : -0.62
    ball.vx *= 0.97
    if (Math.abs(ball.vy) < 1.2) ball.vy = 0
    if (impact > 2.5) emit(sport === 'basket' ? 'dribble' : 'bounce', impact / 14)
  }
  if (ball.y < BALL_R) {
    ball.y = BALL_R
    ball.vy = Math.abs(ball.vy) * 0.7
  }
  if (ball.x < BALL_R || ball.x > W - BALL_R) {
    if (Math.abs(ball.vx) > 3) emit('bounce', Math.abs(ball.vx) / 16)
    const side = ball.x < BALL_R ? 1 : -1
    ball.x = side === 1 ? BALL_R : W - BALL_R
    ball.vx = side * Math.max(2, Math.abs(ball.vx) * 0.8)
  }
  if (sport === 'futbol') {
    for (const side of [0, 1] as const) {
      const x0 = side === 0 ? 0 : W - GOAL_DEPTH
      const x1 = side === 0 ? GOAL_DEPTH : W
      const postX = side === 0 ? GOAL_DEPTH : W - GOAL_DEPTH
      if (ball.x > x0 - BALL_R && ball.x < x1 + BALL_R && Math.abs(ball.y - GOAL_TOP) < BALL_R + 4) {
        if (ball.vy >= 0 && ball.y < GOAL_TOP) {
          ball.y = GOAL_TOP - BALL_R - 4
          ball.vy = -Math.abs(ball.vy) * 0.55
          ball.vx += side === 0 ? 0.6 : -0.6
          if (speed > 2.5) emit('post', speed / 14)
        } else if (ball.y > GOAL_TOP) {
          ball.y = GOAL_TOP + BALL_R + 4
          ball.vy = Math.abs(ball.vy) * 0.5
          if (speed > 2.5) emit('post', speed / 14)
        }
      }
      if (collideCircle(ball, postX, GOAL_TOP, 5, 0, 0, 0.6) && speed > 2.5) emit('post', speed / 14)
    }
  } else {
    for (const side of [0, 1] as const) {
      const bx = side === 0 ? BOARD_X : W - BOARD_X
      // The gap between backboard and wall is narrower than the ball, so treat it as solid instead of letting the ball wedge in.
      const behindBoard = side === 0 ? ball.x < bx + BALL_R + 5 : ball.x > bx - BALL_R - 5
      if (ball.y > RIM_Y - 112 && ball.y < RIM_Y + 18 && behindBoard) {
        ball.x = side === 0 ? bx + BALL_R + 5 : bx - BALL_R - 5
        ball.vx = (side === 0 ? 1 : -1) * Math.max(1.5, Math.abs(ball.vx) * 0.7)
        if (speed > 2) emit('board', speed / 14)
      }
      const rim = side === 0 ? rimLeft() : rimRight()
      const rimHit = collideCircle(ball, rim.a, RIM_Y, 4, 0, 0, 0.55) || collideCircle(ball, rim.b, RIM_Y, 4, 0, 0, 0.55)
      if (rimHit && speed > 2) emit('rim', speed / 14)
      // A ball rising into the net from below is turned back down, so it can never drop through the hoop afterwards.
      if (ball.vy < 0 && ball.x > rim.a && ball.x < rim.b && ball.y > RIM_Y && ball.y - BALL_R < RIM_Y + NET_H) {
        ball.y = RIM_Y + NET_H + BALL_R
        ball.vy = Math.abs(ball.vy) * 0.35
        if (speed > 2) emit('rim', speed / 20)
      }
    }
  }
}

/** Returns true when the player touched the ball this step. */
function hitBall(ball: Ball, p: Player, sport: Sport, emit: Emit, seat: 0 | 1): boolean {
  const footX = p.x + p.face * 26
  const footY = p.y + FOOT - 10
  if (p.kick > 5 && Math.hypot(ball.x - footX, ball.y - footY) < BALL_R + 34) {
    const power = (sport === 'futbol' ? 16 : 11.5) * p.power
    const lift = 1 + (p.power - 1) * 0.6
    ball.vx = p.face * power + p.vx * 0.4
    ball.vy = (sport === 'futbol' ? -8.5 : -15) * lift
    ball.x = footX + p.face * (BALL_R + 4)
    p.kick = 5
    emit('kick', 0.55 + (p.power - 1) * 1.3)
    emit(seat === 0 ? 'h0' : 'h1', p.power > 1.2 ? 35 : 18)
    p.power = 1
    return true
  }
  const rel = Math.hypot(ball.vx - p.vx, ball.vy - p.vy)
  const head = collideCircle(ball, p.x, p.y, HEAD_R, p.vx, p.vy, 0.9)
  if (head) {
    if (head.ny < -0.85 && Math.abs(ball.vx) < 1.2) ball.vx += p.face * 2.2
    if (!onGround(p) && head.ny < 0) ball.vy -= 1.5
    if (rel > 3) emit('header', rel / 16)
    return true
  }
  const body = collideCircle(ball, p.x, p.y + HEAD_R + 14, 16, p.vx, p.vy, 0.5)
  const foot = collideCircle(ball, p.x, p.y + FOOT - 8, 12, p.vx, p.vy, 0.4)
  return !!(body || foot)
}

function botKeys(bot: Player, ball: Ball, sport: Sport, level: BotLevel): Keys {
  const k = noKeys()
  const home = sport === 'futbol' ? W - 160 : W - 200
  const threat = level !== 'easy' && ball.vx > 3 && ball.x > W * 0.45
  const targetX = threat ? Math.min(home, Math.max(ball.x + 40, home - 120)) : ball.x + 34
  if (bot.x < targetX - 12) k.right = true
  else if (bot.x > targetX + 12) k.left = true
  const dx = ball.x - bot.x
  if (Math.abs(dx) < 110 && ball.y < bot.y - 20 && ball.vy > -3 && ball.y > bot.y - 220) k.jump = level !== 'easy' || Math.random() < 0.55
  if (dx < 0 && dx > -80 && ball.y > bot.y + 10) k.kick = Math.random() < (level === 'easy' ? 0.15 : 0.35)
  if (dx > 0 && Math.abs(dx) < 50) k.right = true
  return k
}

/* ------------------------------ rendering ------------------------------ */

function rand(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

function paintBackground(sport: Sport): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d')!
  const r = rand(sport === 'futbol' ? 7 : 11)

  const sky = ctx.createLinearGradient(0, 0, 0, GROUND)
  if (sport === 'futbol') {
    sky.addColorStop(0, '#0a1630')
    sky.addColorStop(0.5, '#123a5c')
    sky.addColorStop(1, '#1d4f5e')
  } else {
    sky.addColorStop(0, '#120d0a')
    sky.addColorStop(0.6, '#2a1a12')
    sky.addColorStop(1, '#3a2416')
  }
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, W, H)

  for (const lx of [120, W - 120]) {
    const glow = ctx.createRadialGradient(lx, 40, 4, lx, 40, 220)
    glow.addColorStop(0, 'rgba(255,248,220,0.55)')
    glow.addColorStop(1, 'rgba(255,248,220,0)')
    ctx.fillStyle = glow
    ctx.fillRect(lx - 220, 0, 440, 260)
    ctx.fillStyle = '#2b3240'
    ctx.fillRect(lx - 40, 22, 80, 30)
    ctx.fillStyle = '#fff8dc'
    for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) ctx.fillRect(lx - 34 + i * 18, 26 + j * 13, 14, 10)
  }

  const standTop = 90
  const standBottom = GROUND - 92
  const tiers = 7
  const crowd = sport === 'futbol'
    ? ['#e5b93e', '#2f6fd1', '#f2f2f2', '#d64545', '#1f2937', '#e5b93e', '#2f6fd1']
    : ['#e5b93e', '#e8742a', '#f2f2f2', '#7c2d12', '#1f2937', '#2f6fd1']
  for (let t = 0; t < tiers; t++) {
    const y = standTop + ((standBottom - standTop) / tiers) * t
    const h = (standBottom - standTop) / tiers
    ctx.fillStyle = t % 2 ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.22)'
    ctx.fillRect(0, y, W, h)
    for (let x = 6; x < W; x += 15) {
      if (r() < 0.12) continue
      const cx = x + r() * 4
      const cy = y + h * 0.55
      ctx.fillStyle = crowd[Math.floor(r() * crowd.length)]
      ctx.beginPath()
      ctx.roundRect(cx - 5, cy, 10, h * 0.45, 3)
      ctx.fill()
      ctx.fillStyle = r() < 0.5 ? '#e0b48a' : '#8d5a3b'
      ctx.beginPath()
      ctx.arc(cx, cy - 2, 4, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  // The orange ball got lost in the warm crowd, so the stands are dimmed to push them into the background.
  if (sport === 'basket') {
    ctx.fillStyle = 'rgba(10,6,4,0.5)'
    ctx.fillRect(0, standTop, W, standBottom - standTop)
  }

  const boardY = GROUND - 92
  ctx.fillStyle = '#0b0d12'
  ctx.fillRect(0, boardY, W, 34)
  for (let i = 0; i < 8; i++) {
    const x = i * 120
    ctx.fillStyle = i % 2 ? '#e5b93e' : '#14171f'
    ctx.fillRect(x + 2, boardY + 3, 116, 28)
    ctx.fillStyle = i % 2 ? '#14171f' : '#e5b93e'
    ctx.font = '800 15px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(i % 2 ? 'KANKA COIN' : 'ALKANKA', x + 60, boardY + 18)
  }

  const fieldTop = boardY + 34
  if (sport === 'futbol') {
    for (let i = 0; i < 12; i++) {
      ctx.fillStyle = i % 2 ? '#2f8a3e' : '#3a9a48'
      ctx.beginPath()
      const x0 = i * 80
      ctx.moveTo(x0, fieldTop)
      ctx.lineTo(x0 + 80, fieldTop)
      ctx.lineTo(x0 + 80 + (x0 + 80 - W / 2) * 0.25, H)
      ctx.lineTo(x0 + (x0 - W / 2) * 0.25, H)
      ctx.fill()
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.75)'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(W / 2, fieldTop)
    ctx.lineTo(W / 2, H)
    ctx.stroke()
    ctx.beginPath()
    ctx.ellipse(W / 2, GROUND + 14, 120, 26, 0, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(0, GROUND)
    ctx.lineTo(W, GROUND)
    ctx.stroke()
  } else {
    for (let i = 0; i < 20; i++) {
      ctx.fillStyle = i % 2 ? '#b97a43' : '#c88a50'
      ctx.fillRect(i * 48, fieldTop, 48, H - fieldTop)
    }
    ctx.fillStyle = 'rgba(255,255,255,0.06)'
    ctx.fillRect(0, fieldTop, W, 10)
    ctx.fillStyle = 'rgba(160,40,20,0.55)'
    ctx.fillRect(0, GROUND - 2, 190, H - GROUND + 2)
    ctx.fillRect(W - 190, GROUND - 2, 190, H - GROUND + 2)
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(0, GROUND)
    ctx.lineTo(W, GROUND)
    ctx.moveTo(W / 2, GROUND)
    ctx.lineTo(W / 2, H)
    ctx.stroke()
    ctx.beginPath()
    ctx.ellipse(W / 2, GROUND + 22, 70, 16, 0, 0, Math.PI * 2)
    ctx.stroke()
    // Each team's three-point line, in its jersey colour: shoot from behind it for 3.
    const hoopL = BOARD_X + 8 + RIM_W / 2
    const lines = [
      [W - hoopL - THREE_DIST, TEAM.home.jersey],
      [hoopL + THREE_DIST, TEAM.away.jersey],
    ] as const
    ctx.font = '900 16px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    for (const [x, color] of lines) {
      ctx.strokeStyle = color
      ctx.lineWidth = 3
      ctx.setLineDash([10, 8])
      ctx.beginPath()
      ctx.moveTo(x, fieldTop)
      ctx.lineTo(x + (x - W / 2) * 0.25, H)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = color
      ctx.fillText('3', x + (x < W / 2 ? -14 : 14), fieldTop + 22)
    }
  }
  ctx.fillStyle = 'rgba(255,255,255,0.1)'
  ctx.font = '900 46px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText('ALKANKA', W / 2, H - 10)
  return c
}

function drawGoalOrHoop(ctx: CanvasRenderingContext2D, sport: Sport, front: boolean, shake: readonly [number, number] = [0, 0]) {
  if (sport === 'futbol') {
    for (const side of [0, 1] as const) {
      const x0 = side === 0 ? 0 : W - GOAL_DEPTH
      const postX = side === 0 ? GOAL_DEPTH : W - GOAL_DEPTH
      if (!front) {
        ctx.fillStyle = 'rgba(255,255,255,0.08)'
        ctx.fillRect(x0, GOAL_TOP, GOAL_DEPTH, GROUND - GOAL_TOP)
        ctx.strokeStyle = 'rgba(255,255,255,0.4)'
        ctx.lineWidth = 1
        for (let y = GOAL_TOP; y <= GROUND; y += 12) {
          ctx.beginPath()
          ctx.moveTo(x0, y)
          ctx.lineTo(x0 + GOAL_DEPTH, y)
          ctx.stroke()
        }
        for (let x = x0; x <= x0 + GOAL_DEPTH; x += 12) {
          ctx.beginPath()
          ctx.moveTo(x, GOAL_TOP)
          ctx.lineTo(x, GROUND)
          ctx.stroke()
        }
      } else {
        ctx.fillStyle = '#f5f5f5'
        ctx.strokeStyle = '#9aa3ad'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.roundRect(x0, GOAL_TOP - 5, GOAL_DEPTH, 10, 4)
        ctx.fill()
        ctx.stroke()
        ctx.beginPath()
        ctx.roundRect(postX - 5, GOAL_TOP - 5, 10, GROUND - GOAL_TOP + 5, 4)
        ctx.fill()
        ctx.stroke()
      }
    }
    return
  }
  for (const side of [0, 1] as const) {
    const bx = side === 0 ? BOARD_X : W - BOARD_X
    const rim = side === 0 ? rimLeft() : rimRight()
    if (!front) {
      ctx.fillStyle = '#2b2f36'
      const poleX = side === 0 ? 10 : W - 22
      ctx.fillRect(poleX, RIM_Y - 70, 12, GROUND - RIM_Y + 70)
      ctx.fillRect(side === 0 ? poleX : bx, RIM_Y - 70, Math.abs(bx - poleX), 8)
      ctx.fillStyle = 'rgba(220,235,255,0.35)'
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.roundRect(bx - 5, RIM_Y - 112, 10, 130, 3)
      ctx.fill()
      ctx.stroke()
      ctx.strokeStyle = '#e8501f'
      ctx.lineWidth = 3
      ctx.strokeRect(side === 0 ? bx + 5 : bx - 5 - 26, RIM_Y - 44, 26, 30)
    } else {
      // After a basket the net swings and stretches for a moment.
      const s = shake[side]
      const sway = Math.sin(s * 0.55) * (s / 40) * 7
      const len = NET_H + s * 0.25
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'
      ctx.lineWidth = 1.8
      for (let i = 0; i <= 7; i++) {
        const x = rim.a + (i * RIM_W) / 7
        const xb = rim.a + RIM_W / 2 + (x - rim.a - RIM_W / 2) * 0.55 + sway
        ctx.beginPath()
        ctx.moveTo(x, RIM_Y)
        ctx.lineTo(xb, RIM_Y + len)
        ctx.stroke()
      }
      for (let j = 1; j <= 3; j++) {
        const f = j / 4
        const y = RIM_Y + len * f
        const inset = (RIM_W * 0.45 * f) / 2
        ctx.beginPath()
        ctx.moveTo(rim.a + inset + sway * f, y)
        ctx.lineTo(rim.b - inset + sway * f, y)
        ctx.stroke()
      }
      ctx.strokeStyle = 'rgba(0,0,0,0.55)'
      ctx.lineWidth = 10
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(rim.a, RIM_Y)
      ctx.lineTo(rim.b, RIM_Y)
      ctx.stroke()
      ctx.strokeStyle = '#ff5a1f'
      ctx.lineWidth = 7
      ctx.beginPath()
      ctx.moveTo(rim.a, RIM_Y)
      ctx.lineTo(rim.b, RIM_Y)
      ctx.stroke()
      ctx.lineCap = 'butt'
    }
  }
}

function drawPlayer(
  ctx: CanvasRenderingContext2D,
  p: Player,
  kit: (typeof TEAM)['home'],
  img: HTMLImageElement | null,
  label: string,
  sport: Sport,
) {
  const shadowW = 44 * Math.max(0.45, 1 - (GROUND - FOOT - p.y) / 260)
  ctx.fillStyle = 'rgba(0,0,0,0.35)'
  ctx.beginPath()
  ctx.ellipse(p.x, GROUND + 4, shadowW, 8, 0, 0, Math.PI * 2)
  ctx.fill()

  const hipY = p.y + HEAD_R + 16
  const kicking = p.kick > 5
  const swing = kicking ? Math.sin(((16 - p.kick) / 11) * Math.PI) * 1.4 : 0
  const stride = onGround(p) && Math.abs(p.vx) > 0.5 ? Math.sin(p.run) * 0.5 : 0
  const legLen = FOOT - HEAD_R - 16

  const drawLeg = (angle: number, back: boolean) => {
    ctx.save()
    ctx.translate(p.x + (back ? -p.face * 6 : p.face * 6), hipY)
    ctx.rotate(angle * p.face)
    ctx.fillStyle = back ? '#c9a27a' : '#e2b98f'
    ctx.fillRect(-4, 0, 8, legLen - 4)
    ctx.fillStyle = back ? '#d7d7d7' : '#fff'
    ctx.fillRect(-5, legLen - 12, 10, 8)
    ctx.fillStyle = kit.boot
    ctx.strokeStyle = '#111'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.roundRect(-7 + p.face * 2, legLen - 6, 22 * (p.face === 1 ? 1 : 1), 10, 5)
    ctx.fill()
    ctx.stroke()
    ctx.restore()
  }
  drawLeg(-stride, true)

  ctx.fillStyle = kit.jersey
  ctx.strokeStyle = 'rgba(0,0,0,0.6)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.roundRect(p.x - 17, p.y + HEAD_R - 8, 34, 26, 8)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = kit.trim
  ctx.fillRect(p.x - 17, p.y + HEAD_R + 8, 34, 3)
  ctx.fillStyle = kit.shorts
  ctx.beginPath()
  ctx.roundRect(p.x - 15, p.y + HEAD_R + 12, 30, 10, 3)
  ctx.fill()

  drawLeg(kicking ? -swing : stride, false)

  ctx.save()
  ctx.beginPath()
  ctx.arc(p.x, p.y, HEAD_R, 0, Math.PI * 2)
  ctx.fillStyle = '#20232b'
  ctx.fill()
  if (img?.complete && img.naturalWidth) {
    ctx.clip()
    ctx.translate(p.x, p.y)
    if (p.face === -1) ctx.scale(-1, 1)
    const s = img.naturalWidth
    ctx.drawImage(img, s * 0.13, s * 0.1, s * 0.76, s * 0.8, -HEAD_R * 1.08, -HEAD_R * 1.1, HEAD_R * 2.16, HEAD_R * 2.28)
  }
  ctx.restore()
  ctx.lineWidth = 3
  ctx.strokeStyle = kit.jersey
  ctx.beginPath()
  ctx.arc(p.x, p.y, HEAD_R, 0, Math.PI * 2)
  ctx.stroke()

  ctx.font = '800 13px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  const tw = ctx.measureText(label).width + 14
  ctx.fillStyle = 'rgba(0,0,0,0.55)'
  ctx.beginPath()
  ctx.roundRect(p.x - tw / 2, p.y - HEAD_R - 26, tw, 18, 9)
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.fillText(label, p.x, p.y - HEAD_R - 13)

  if (p.charge > 3) {
    const bw = 56
    const fill = p.charge / CHARGE_MAX
    ctx.fillStyle = 'rgba(0,0,0,0.6)'
    ctx.beginPath()
    ctx.roundRect(p.x - bw / 2, p.y - HEAD_R - 36, bw, 7, 3.5)
    ctx.fill()
    ctx.fillStyle = fill >= 1 ? '#ff6b5a' : '#e5b93e'
    ctx.beginPath()
    ctx.roundRect(p.x - bw / 2, p.y - HEAD_R - 36, Math.max(7, bw * fill), 7, 3.5)
    ctx.fill()
  }
  if (p.camp > 90 && p.camp < CAMP_LIMIT) {
    ctx.font = '900 14px sans-serif'
    ctx.lineWidth = 4
    ctx.strokeStyle = '#111'
    const warn = `${sport === 'futbol' ? 'KALEDEN' : 'POTADAN'} ÇIK ${Math.ceil((CAMP_LIMIT - p.camp) / 60)}`
    ctx.strokeText(warn, p.x, p.y - HEAD_R - 44)
    ctx.fillStyle = '#ff6b5a'
    ctx.fillText(warn, p.x, p.y - HEAD_R - 44)
  }
}

function drawBall(ctx: CanvasRenderingContext2D, b: Ball, sport: Sport) {
  const speed = Math.hypot(b.vx, b.vy)
  if (speed > 7) {
    for (let i = 3; i >= 1; i--) {
      const a = (0.2 * (4 - i)) / 3
      ctx.fillStyle = sport === 'futbol' ? `rgba(255,255,255,${a})` : `rgba(255,170,90,${a})`
      ctx.beginPath()
      ctx.arc(b.x - b.vx * i * 1.3, b.y - b.vy * i * 1.3, BALL_R * (1 - i * 0.12), 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.fillStyle = 'rgba(0,0,0,0.3)'
  const sw = BALL_R * Math.max(0.4, 1 - (GROUND - b.y) / 300)
  ctx.beginPath()
  ctx.ellipse(b.x, GROUND + 3, sw, 5, 0, 0, Math.PI * 2)
  ctx.fill()

  ctx.save()
  ctx.translate(b.x, b.y)
  ctx.rotate(b.rot)
  ctx.beginPath()
  ctx.arc(0, 0, BALL_R, 0, Math.PI * 2)
  if (sport === 'futbol') {
    const g = ctx.createRadialGradient(-5, -6, 2, 0, 0, BALL_R)
    g.addColorStop(0, '#ffffff')
    g.addColorStop(1, '#cfd4da')
    ctx.fillStyle = g
    ctx.fill()
    ctx.clip()
    ctx.fillStyle = '#16181d'
    const pent = (cx: number, cy: number, r: number) => {
      ctx.beginPath()
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5
        ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r)
      }
      ctx.fill()
    }
    pent(0, 0, 6)
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5
      pent(Math.cos(a) * 15, Math.sin(a) * 15, 5)
    }
  } else {
    const g = ctx.createRadialGradient(-5, -6, 2, 0, 0, BALL_R)
    g.addColorStop(0, '#f59a52')
    g.addColorStop(1, '#c4521b')
    ctx.fillStyle = g
    ctx.fill()
    ctx.strokeStyle = '#2a1206'
    ctx.lineWidth = 1.8
    ctx.beginPath()
    ctx.moveTo(-BALL_R, 0)
    ctx.lineTo(BALL_R, 0)
    ctx.moveTo(0, -BALL_R)
    ctx.lineTo(0, BALL_R)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(-BALL_R * 1.1, 0, BALL_R * 0.8, -0.9, 0.9)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(BALL_R * 1.1, 0, BALL_R * 0.8, Math.PI - 0.9, Math.PI + 0.9)
    ctx.stroke()
  }
  ctx.restore()
  ctx.strokeStyle = 'rgba(0,0,0,0.6)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.arc(b.x, b.y, BALL_R, 0, Math.PI * 2)
  ctx.stroke()
  if (sport === 'basket') {
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(b.x, b.y, BALL_R + 2, 0, Math.PI * 2)
    ctx.stroke()
  }
}

function drawScoreboard(
  ctx: CanvasRenderingContext2D,
  names: [string, string],
  sc: [number, number],
  left: number,
  overtime: boolean,
  sport: Sport,
) {
  const w = 300
  const x = W / 2 - w / 2
  ctx.fillStyle = 'rgba(8,10,14,0.88)'
  ctx.strokeStyle = 'rgba(229,185,62,0.7)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.roundRect(x, 10, w, 46, 10)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = TEAM.home.jersey
  ctx.fillRect(x + 8, 18, 6, 30)
  ctx.fillStyle = TEAM.away.jersey
  ctx.fillRect(x + w - 14, 18, 6, 30)
  ctx.textBaseline = 'middle'
  ctx.font = '700 13px sans-serif'
  ctx.fillStyle = '#e6e6e6'
  ctx.textAlign = 'left'
  ctx.fillText(names[0].slice(0, 10), x + 20, 33)
  ctx.textAlign = 'right'
  ctx.fillText(names[1].slice(0, 10), x + w - 20, 33)
  ctx.textAlign = 'center'
  ctx.font = '900 26px sans-serif'
  ctx.fillStyle = '#ffffff'
  ctx.fillText(`${sc[0]} - ${sc[1]}`, W / 2, 29)
  ctx.font = '700 11px monospace'
  ctx.fillStyle = overtime || left <= 10 ? '#ff6b5a' : '#e5b93e'
  const ot = sport === 'futbol' ? 'ALTIN GOL ' : 'ALTIN BASKET '
  ctx.fillText(`${overtime ? ot : ''}0:${String(left).padStart(2, '0')}`, W / 2, 49)
}

function drawFlash(ctx: CanvasRenderingContext2D, text: string, t: number) {
  const k = Math.min(1, t / 12)
  const scale = 0.6 + 0.5 * k - 0.1 * Math.max(0, (t - 12) / 40)
  ctx.save()
  ctx.translate(W / 2, H / 2 - 40)
  ctx.scale(scale, scale)
  ctx.font = '900 96px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineWidth = 10
  ctx.strokeStyle = '#111'
  ctx.strokeText(text, 0, 0)
  ctx.fillStyle = '#e5b93e'
  ctx.fillText(text, 0, 0)
  ctx.restore()
}

/* ------------------------------ controls ------------------------------ */

/** Hides the browser bars on Android once the player touches a control in landscape (needs a user gesture). */
function enterFullscreen() {
  if (document.fullscreenElement || !window.matchMedia('(pointer: coarse) and (orientation: landscape)').matches) return
  document.documentElement.requestFullscreen?.({ navigationUI: 'hide' }).catch(() => {})
}

function bindKey(keys: React.RefObject<Keys>, k: keyof Keys, onPress?: () => void) {
  return {
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault()
      e.currentTarget.setPointerCapture(e.pointerId)
      keys.current[k] = true
      onPress?.()
    },
    onPointerUp: () => (keys.current[k] = false),
    onPointerCancel: () => (keys.current[k] = false),
    onLostPointerCapture: () => (keys.current[k] = false),
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  }
}

const OVERLAY_BTN =
  'pointer-events-auto flex touch-none select-none items-center justify-center rounded-full border-2 border-foreground/35 bg-background/15 text-foreground shadow-md backdrop-blur-[2px] transition-transform active:scale-90 active:border-primary active:bg-primary/70 active:text-primary-foreground active:opacity-100'

const OVERLAY_PAD =
  'pointer-events-auto flex touch-none select-none items-center justify-center rounded-full border-2 border-foreground/35 bg-background/15 text-foreground shadow-md backdrop-blur-[2px] transition-transform'
const OVERLAY_PAD_ON = 'scale-90 border-primary bg-primary/70 text-primary-foreground opacity-100'

const BTN_SIZE: Record<ControlPrefs['size'], string> = {
  s: 'size-14 landscape:size-16',
  m: 'size-16 landscape:size-20',
  l: 'size-20 landscape:size-24',
}
const ICON_SIZE: Record<ControlPrefs['size'], string> = { s: 'size-6', m: 'size-7', l: 'size-8' }
const BTN_OPACITY: Record<ControlPrefs['opacity'], string> = { low: 'opacity-40', mid: 'opacity-75', high: 'opacity-100' }

/** One touch zone for left/right so sliding the thumb across switches direction without lifting it. */
function DirectionPad({ k1, size, icon, onPress }: { k1: React.RefObject<Keys>; size: string; icon: string; onPress?: () => void }) {
  const [dir, setDir] = useState<-1 | 0 | 1>(0)
  const aim = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const right = e.clientX > r.left + r.width / 2
    k1.current.left = !right
    k1.current.right = right
    setDir(right ? 1 : -1)
  }
  const release = () => {
    k1.current.left = false
    k1.current.right = false
    setDir(0)
  }
  return (
    <div
      role="group"
      aria-label="Sola ve sağa hareket"
      className="pointer-events-auto flex touch-none select-none gap-2.5"
      onPointerDown={(e) => {
        e.preventDefault()
        e.currentTarget.setPointerCapture(e.pointerId)
        aim(e)
        onPress?.()
      }}
      onPointerMove={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) aim(e)
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      onContextMenu={(e) => e.preventDefault()}
    >
      <span className={cn(OVERLAY_PAD, size, dir === -1 && OVERLAY_PAD_ON)} aria-hidden="true">
        <ChevronLeft className={icon} />
      </span>
      <span className={cn(OVERLAY_PAD, size, dir === 1 && OVERLAY_PAD_ON)} aria-hidden="true">
        <ChevronRight className={icon} />
      </span>
    </div>
  )
}

/**
 * Translucent buttons on touch screens: arrows bottom-left, jump/kick bottom-right.
 * In full landscape they sit at the screen corners so they cover less of the goal mouths.
 */
function OverlayControls({ k1, full, onPress }: { k1: React.RefObject<Keys>; full?: boolean; onPress?: () => void }) {
  const p = usePrefs()
  const size = cn(BTN_SIZE[p.size], BTN_OPACITY[p.opacity])
  const icon = ICON_SIZE[p.size]
  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-end justify-between p-2.5 lg:hidden',
        full &&
          'pb-[max(0.75rem,env(safe-area-inset-bottom))] pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))]',
      )}
    >
      <DirectionPad k1={k1} size={size} icon={icon} onPress={onPress} />
      <div className="flex items-end gap-2.5">
        <button type="button" className={cn(OVERLAY_BTN, size)} aria-label="Zıpla" {...bindKey(k1, 'jump', onPress)}>
          <ArrowBigUp className={icon} aria-hidden="true" />
        </button>
        <button
          type="button"
          className={cn(OVERLAY_BTN, size, 'mb-5 border-primary/80')}
          aria-label="Şut, basılı tutarak güç doldur"
          {...bindKey(k1, 'kick', onPress)}
        >
          <Footprints className={icon} aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: readonly (readonly [T, string])[]
  onChange: (v: T) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      <div role="group" aria-label={label} className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
        {options.map(([v, text]) => (
          <button
            key={v}
            type="button"
            aria-pressed={value === v}
            onClick={() => onChange(v)}
            className={cn(
              'rounded-md px-2 py-1.5 text-xs font-bold transition-colors',
              value === v ? 'bg-primary text-primary-foreground shadow-sm' : 'text-foreground hover:bg-background/60',
            )}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  )
}

function ToggleRow({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="flex items-center justify-between gap-3 py-0.5 text-sm font-semibold text-foreground"
    >
      {label}
      <span className={cn('relative h-5 w-9 shrink-0 rounded-full transition-colors', on ? 'bg-primary' : 'bg-muted')}>
        <span
          className={cn(
            'absolute left-0.5 top-0.5 size-4 rounded-full bg-background shadow transition-transform',
            on && 'translate-x-4',
          )}
        />
      </span>
    </button>
  )
}

const SIZE_OPTIONS = [['s', 'Küçük'], ['m', 'Orta'], ['l', 'Büyük']] as const
const OPACITY_OPTIONS = [['low', 'Silik'], ['mid', 'Orta'], ['high', 'Net']] as const
const BOT_OPTIONS = [['easy', 'Kolay'], ['mid', 'Orta'], ['hard', 'Zor']] as const

function ControlSettings({ pauses, onClose }: { pauses: boolean; onClose: () => void }) {
  const p = usePrefs()
  const muted = useSoundMuted()
  return (
    <div
      role="dialog"
      aria-label="Kontrol ayarları"
      className="absolute left-2 top-12 z-30 flex max-h-[calc(100%-3.5rem)] w-60 flex-col gap-3 overflow-y-auto rounded-xl border border-primary/30 bg-card/95 p-3 text-card-foreground shadow-xl backdrop-blur-sm"
    >
      <div className="flex items-center justify-between">
        <p className="font-display text-sm font-black uppercase tracking-tight">Kontrol ayarları</p>
        <button type="button" onClick={onClose} aria-label="Ayarları kapat" className="rounded-md p-1 text-muted-foreground hover:text-foreground">
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
      <Segmented label="Tuş boyutu" value={p.size} options={SIZE_OPTIONS} onChange={(size) => setPrefs({ size })} />
      <Segmented label="Tuş görünürlüğü" value={p.opacity} options={OPACITY_OPTIONS} onChange={(opacity) => setPrefs({ opacity })} />
      {pauses && <Segmented label="Bot seviyesi" value={p.bot} options={BOT_OPTIONS} onChange={(bot) => setPrefs({ bot })} />}
      <ToggleRow label="Titreşim" on={p.haptics} onChange={(haptics) => setPrefs({ haptics })} />
      <ToggleRow label="Ses ve tribün" on={!muted} onChange={(on) => setSoundMuted(!on)} />
      {pauses && <p className="text-xs leading-relaxed text-muted-foreground">Ayarlar açıkken maç durur.</p>}
    </div>
  )
}

function useMedia(query: string) {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(query)
      m.addEventListener('change', cb)
      return () => m.removeEventListener('change', cb)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}

const PHONE_PORTRAIT = '(pointer: coarse) and (orientation: portrait)'

function requestLandscape() {
  const el = document.documentElement
  const orientation = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }
  el.requestFullscreen?.()
    .then(() => orientation.lock?.('landscape'))
    .catch(() => {})
}

function RotatePrompt({ sport, paused }: { sport: Sport; paused: boolean }) {
  return (
    <div
      role="alert"
      className="flex min-h-[60dvh] flex-col items-center justify-center gap-5 rounded-2xl border border-primary/30 bg-card px-6 py-8 text-center shadow-xl"
    >
      <div className="relative">
        <NextImage
          src="/images/mascots/jako-duyuru.png"
          alt="Jako maskot"
          width={160}
          height={160}
          className="size-36 animate-[jako-bob_1.6s_ease-in-out_infinite] object-contain drop-shadow-xl"
        />
        <span className="absolute -bottom-1 -right-3 flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
          <Smartphone className="size-6 animate-[phone-rotate_2s_ease-in-out_infinite]" aria-hidden="true" />
        </span>
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-balance font-display text-2xl font-black uppercase tracking-tight text-foreground">
          {paused ? 'Maç durdu kanka!' : 'Telefonu yan çevir kanka!'}
        </p>
        <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
          {paused
            ? 'Dik tutunca saha sığmıyor. Telefonu tekrar yan çevir, maç kaldığı yerden devam etsin.'
            : `${sport === 'futbol' ? 'Kafa topu' : 'Kafa basketbolu'} yatay ekranda çok daha rahat oynanır. Telefonu yan çevirdiğin an maç başlar.`}
        </p>
      </div>
      <button
        type="button"
        onClick={requestLandscape}
        className="flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-md transition-transform active:scale-95"
      >
        <Maximize2 className="size-4" aria-hidden="true" />
        Tam ekran yatay aç
      </button>
    </div>
  )
}

/**
 * Head soccer / head basketball. Solo against the bot, or a live 1v1 where the host simulates
 * and the guest mirrors the host's frames over a peer-to-peer data channel.
 */
export function HeadGame({
  sport,
  mode,
  onEnd,
  names = ['Sen', 'Bot'],
  link,
}: {
  sport: Sport
  mode: HeadMode
  onEnd: (score: HeadScore) => void
  names?: [string, string]
  link?: DuelLink
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const linkRef = useRef(link)
  linkRef.current = link
  const linkReady = mode === 'bot' || link?.status === 'open'
  const linkLost = mode !== 'bot' && link?.status === 'lost'
  const k1 = useRef<Keys>(noKeys())
  const k2 = useRef<Keys>(noKeys())
  const [announce, setAnnounce] = useState('0 - 0')
  const endRef = useRef(onEnd)
  endRef.current = onEnd
  const namesRef = useRef(names)
  namesRef.current = names

  const touch = useMedia('(pointer: coarse)')
  const portrait = useMedia('(orientation: portrait)')
  const [started, setStarted] = useState(false)
  const [over, setOver] = useState(false)
  const [minimized, setMinimized] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [rivalHold, setRivalHold] = useState(false)
  const needRotate = touch && portrait && !over
  const fullLandscape = touch && !portrait && started && !over && !minimized
  const pausedRef = useRef(false)
  pausedRef.current = needRotate || (mode === 'bot' && settingsOpen)

  useEffect(() => {
    if (linkReady && !needRotate && !window.matchMedia(PHONE_PORTRAIT).matches) setStarted(true)
  }, [needRotate, linkReady])

  useEffect(() => {
    if (!over) return
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {})
  }, [over])

  // A held thumb outside the buttons used to trigger Android text selection and the Google "tap to define" sheet mid-match.
  useEffect(() => {
    if (!touch || !started || over) return
    const s = document.documentElement.style as CSSStyleDeclaration & { webkitUserSelect: string; webkitTouchCallout: string }
    const prev = [s.userSelect, s.webkitUserSelect, s.webkitTouchCallout]
    s.userSelect = 'none'
    s.webkitUserSelect = 'none'
    s.webkitTouchCallout = 'none'
    const block = (e: Event) => e.preventDefault()
    document.addEventListener('contextmenu', block)
    document.addEventListener('selectstart', block)
    window.getSelection()?.removeAllRanges()
    return () => {
      ;[s.userSelect, s.webkitUserSelect, s.webkitTouchCallout] = prev
      document.removeEventListener('contextmenu', block)
      document.removeEventListener('selectstart', block)
    }
  }, [touch, started, over])

  useEffect(() => {
    const map1: Record<string, keyof Keys> = { KeyA: 'left', KeyD: 'right', KeyW: 'jump', KeyS: 'kick', Space: 'kick' }
    const map2: Record<string, keyof Keys> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'jump', ArrowDown: 'kick' }
    const solo: Record<string, keyof Keys> = { ...map2, ...map1 }
    const handle = (down: boolean) => (e: KeyboardEvent) => {
      if (solo[e.code]) {
        k1.current[solo[e.code]] = down
        e.preventDefault()
      }
    }
    const kd = handle(true)
    const ku = handle(false)
    const blur = () => {
      k1.current = noKeys()
    }
    window.addEventListener('keydown', kd)
    window.addEventListener('keyup', ku)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', kd)
      window.removeEventListener('keyup', ku)
      window.removeEventListener('blur', blur)
    }
  }, [mode])

  useEffect(() => {
    if (!started) return
    const ctx = canvas.current?.getContext('2d')
    if (!ctx) return
    const bg = paintBackground(sport)
    const loadImg = (src: string) => {
      const i = new Image()
      i.crossOrigin = 'anonymous'
      i.src = src
      return i
    }
    const homeImg = loadImg('/images/sprites/head-jako.png')
    const awayImg = loadImg('/images/sprites/head-rival.png')
    const fresh = (face: 1 | -1): Player => ({ x: 0, y: 0, vx: 0, vy: 0, face, kick: 0, run: 0, charge: 0, power: 1, camp: 0 })
    const p1 = fresh(1)
    const p2 = fresh(-1)
    const ball: Ball = { x: 0, y: 0, vx: 0, vy: 0, rot: 0 }
    resetPositions(p1, p2, ball, 0)
    const sc: [number, number] = [0, 0]
    let pause = 70
    let raf = 0
    let last = performance.now()
    let acc = 0
    let elapsed = 0
    let ended = false
    let overtime = false
    let prevBallY = ball.y
    let flash = ''
    let flashT = 0
    let stuckFrames = 0
    let anchor = { x: ball.x, y: ball.y }
    let left = MATCH_SECONDS
    let remoteKeys: Keys = noKeys()
    let remotePaused = false
    let rivalHoldSteps = 0
    let shownHold = false
    // Host: the guest moves its own player locally and reports the result, so their controls never wait on the network.
    let remoteMe: RemoteMe | null = null
    let remoteQ = -1
    let hostKn = 0
    let resets = 0
    // Guest: jitter buffer of host frames, rendered a short adaptive delay behind the host clock.
    const buf: { ht: number; p1: Player; b: Ball }[] = []
    let clockOffset: number | null = null
    let jitter = 0
    let lastHt = -Infinity
    let guestResets = -1
    let hostFrozen = false
    let hostPause = false
    let kickNo = 0
    let sendQ = 0
    let frameNo = 0
    let events: NetEvent[] = []
    let shot: { seat: 0 | 1; x: number } | null = null
    let clockSeat = -1
    let clockSteps = 0
    const netShake: [number, number] = [0, 0]
    let botK = noKeys()
    let botWait = 0
    const emit: Emit = (name, v = 1) => {
      events.push([name, v])
    }
    const seat: 0 | 1 = mode === 'guest' ? 1 : 0
    let crowdOn = true
    const stopCrowd = startCrowdAmbience(sport === 'futbol' ? 0.05 : 0.035)
    const quietCrowd = () => {
      if (!crowdOn) return
      crowdOn = false
      stopCrowd()
    }
    const showHold = (v: boolean) => {
      if (v === shownHold) return
      shownHold = v
      setRivalHold(v)
    }
    playEvents([['whistle', 1]], seat)

    if (mode !== 'bot' && linkRef.current) {
      linkRef.current.onMessage.current = (raw) => {
        const msg = raw as { t: string; [k: string]: unknown }
        if (mode === 'host' && msg.t === 'k') {
          const q = typeof msg.q === 'number' ? msg.q : -1
          // Relay requests can overlap; drop key packets older than the newest one (a reloaded guest restarts at 0).
          if (q >= 0 && q <= remoteQ && remoteQ - q < 600) return
          remoteQ = q
          remoteKeys = { ...noKeys(), ...(msg.k as Partial<Keys>) }
          remotePaused = !!msg.pz
          if (msg.me && msg.rs === resets) remoteMe = msg.me as RemoteMe
        }
        if (mode !== 'guest') return
        if (msg.t === 's') {
          const now = performance.now()
          const ht = Number(msg.ht) || 0
          const sample = now - ht
          if (clockOffset === null || sample < clockOffset) clockOffset = sample
          else clockOffset += (sample - clockOffset) * 0.002
          jitter = Math.max(sample - clockOffset, jitter * 0.98)
          const entry = { ht, p1: msg.p1 as Player, b: msg.b as Ball }
          let i = buf.length
          while (i > 0 && buf[i - 1].ht > ht) i--
          buf.splice(i, 0, entry)
          if (buf.length > 40) buf.splice(0, buf.length - 40)
          if (ht < lastHt) return
          lastHt = ht
          hostFrozen = !!msg.hz
          hostPause = !!msg.pa
          const hostMe = msg.p2 as Player
          // After a goal or reset the host's word wins; otherwise only a large drift snaps the local player back.
          if (msg.rs !== guestResets || Math.hypot(hostMe.x - p2.x, hostMe.y - p2.y) > 260) {
            guestResets = msg.rs as number
            Object.assign(p2, hostMe)
          }
          const next = msg.sc as [number, number]
          if (next[0] !== sc[0] || next[1] !== sc[1]) setAnnounce(`${next[0]} - ${next[1]}`)
          if (next[0] > sc[0]) netShake[1] = 40
          if (next[1] > sc[1]) netShake[0] = 40
          sc[0] = next[0]
          sc[1] = next[1]
          left = msg.l as number
          flash = msg.f as string
          flashT = msg.ft as number
          overtime = !!msg.ot
          playEvents((msg.ev as NetEvent[] | undefined) ?? [], seat)
          showHold(!!msg.pz)
        } else if (msg.t === 'end' && !ended) {
          const fin = msg.sc as [number, number]
          ended = true
          quietCrowd()
          playSound('whistleEnd')
          setOver(true)
          endRef.current({ for: fin[1], against: fin[0] })
        }
      }
    }

    function goal(scorer: 0 | 1, pts: number, label = 'GOL!') {
      sc[scorer] += pts
      emit(sport === 'futbol' ? 'net' : 'swish')
      emit('whistle')
      emit('cheer')
      emit('hb', 80)
      setAnnounce(`${sc[0]} - ${sc[1]}`)
      flash = overtime ? (sport === 'futbol' ? 'ALTIN GOL!' : 'ALTIN BASKET!') : label
      flashT = 0
      pause = 80
      shot = null
      // The conceding side gets the ball, like possession changing after a score.
      resetPositions(p1, p2, ball, scorer === 0 ? 1 : 0)
      resets++
    }

    function basket(scorer: 0 | 1, hoop: 0 | 1, rim: { a: number; b: number }) {
      const cx = (rim.a + rim.b) / 2
      const shooter = scorer === 0 ? p1 : p2
      const three = shot?.seat === scorer && Math.abs(shot.x - cx) > THREE_DIST
      const dunk = !three && Math.hypot(shooter.x - cx, shooter.y - RIM_Y) < 120
      netShake[hoop] = 40
      if (dunk) {
        emit('board', 0.9)
        emit('rim', 0.8)
      }
      goal(scorer, three ? 3 : 2, three ? 'ÜÇLÜK!' : dunk ? 'SMAÇ!' : 'BASKET!')
    }

    function step() {
      if (flash) {
        flashT++
        if (flashT > 70) flash = ''
      }
      let k2now: Keys
      if (mode === 'host' && linkRef.current?.status === 'open') {
        // Kicks arrive as a counter in the guest's own state, so a quick tap lost between packets still lands.
        k2now = { ...remoteKeys, kick: false }
        p2.charge = 0
        const me = remoteMe
        if (me && pause <= 0) {
          remoteMe = null
          const margin = sport === 'futbol' ? GOAL_DEPTH * 0.55 : 24
          p2.x = clamp(me.x, HEAD_R + margin, W - HEAD_R - margin)
          p2.y = clamp(me.y, -400, GROUND - FOOT)
          p2.vx = clamp(me.vx, -7, 7)
          p2.vy = clamp(me.vy, -14, 30)
          p2.face = me.face === -1 ? -1 : 1
          if (me.kn !== hostKn) {
            hostKn = me.kn
            p2.kick = clamp(me.kick, 8, 16)
            p2.power = clamp(me.power, 1, 1.35)
          }
        }
      } else {
        if (botWait-- <= 0) {
          const level = readPrefs().bot
          botK = botKeys(p2, ball, sport, level)
          botWait = BOT_REACT[level]
        }
        k2now = botK
      }
      if (pause > 0) {
        pause--
        stepPlayer(p1, noKeys(), sport)
        stepPlayer(p2, noKeys(), sport)
        return
      }
      elapsed += STEP_MS
      stepPlayer(p1, k1.current, sport)
      stepPlayer(p2, k2now, sport)
      campRule(p1, 0, sport, emit)
      campRule(p2, 1, sport, emit)
      separatePlayers(p1, p2)
      prevBallY = ball.y
      stepBall(ball, sport, emit)
      if (hitBall(ball, p1, sport, emit, 0)) shot = { seat: 0, x: p1.x }
      if (hitBall(ball, p2, sport, emit, 1)) shot = { seat: 1, x: p2.x }

      // Shot clock: whoever last touched the ball has 12 s to score, otherwise the ball goes to the rival.
      if (sport === 'basket') {
        const holder = shot?.seat ?? -1
        if (holder !== clockSeat) {
          clockSeat = holder
          clockSteps = 0
        } else if (holder !== -1 && ++clockSteps >= SHOT_CLOCK_STEPS) {
          emit('whistle', 0.9)
          flash = 'ATIŞ SÜRESİ!'
          flashT = 0
          pause = 60
          shot = null
          clockSeat = -1
          clockSteps = 0
          resetPositions(p1, p2, ball, holder === 0 ? 1 : 0)
          resets++
          return
        }
      }

      // Unjam: a ball that barely moves while airborne (head-rest, crossbar, wedged against a wall) gets dropped back in.
      if (Math.hypot(ball.x - anchor.x, ball.y - anchor.y) > 8) {
        anchor = { x: ball.x, y: ball.y }
        stuckFrames = 0
      } else if (ball.y < GROUND - BALL_R - 4 || ball.x < BALL_R + 30 || ball.x > W - BALL_R - 30) {
        stuckFrames++
        if (stuckFrames > 100) {
          Object.assign(ball, { x: W / 2, y: 120, vx: (Math.random() - 0.5) * 3, vy: 0 })
          anchor = { x: ball.x, y: ball.y }
          stuckFrames = 0
          shot = null
        }
      }

      if (sport === 'futbol') {
        if (ball.x < GOAL_DEPTH - BALL_R * 0.5 && ball.y > GOAL_TOP + 8) goal(1, 1)
        else if (ball.x > W - GOAL_DEPTH + BALL_R * 0.5 && ball.y > GOAL_TOP + 8) goal(0, 1)
      } else if (prevBallY < RIM_Y && ball.y >= RIM_Y && ball.vy > 0) {
        const L = rimLeft()
        const R = rimRight()
        if (ball.x > L.a + 3 && ball.x < L.b - 3) basket(1, 0, L)
        else if (ball.x > R.a + 3 && ball.x < R.b - 3) basket(0, 1, R)
      }
    }

    function frame(now: number) {
      acc += Math.min(80, now - last)
      last = now
      frameNo++
      const net = linkRef.current
      // A rival who turns their phone upright freezes the match on both screens, for at most 15 s.
      let rivalPaused = false
      if (mode === 'host') {
        const online = net?.status === 'open'
        rivalPaused = online && remotePaused && rivalHoldSteps < RIVAL_HOLD_STEPS
        rivalHoldSteps = online && remotePaused ? rivalHoldSteps + 1 : 0
        showHold(rivalPaused)
      }
      if (pausedRef.current || rivalPaused) {
        acc = 0
        if (pausedRef.current) k1.current = noKeys()
      }
      if (mode === 'guest') {
        // Own player: simulated right here with zero input lag; the host takes this state as the truth.
        if (pausedRef.current || hostFrozen) acc = 0
        let steps = 0
        while (acc >= STEP_MS && steps < 5) {
          const before = p2.kick
          stepPlayer(p2, hostPause ? noKeys() : k1.current, sport)
          campRule(p2, 1, sport, () => {})
          if (before <= 0 && p2.kick > 0) kickNo++
          acc -= STEP_MS
          steps++
        }
        if (steps === 5) acc = 0
        net?.send({
          t: 'k',
          q: sendQ++,
          k: k1.current,
          pz: pausedRef.current,
          rs: guestResets,
          me: { x: p2.x, y: p2.y, vx: p2.vx, vy: p2.vy, face: p2.face, kick: p2.kick, power: p2.power, kn: kickNo },
        })
        // Rival and ball: replayed from the jitter buffer a little behind the host clock, so bursty packets still look smooth.
        if (buf.length && clockOffset !== null) {
          const delay = Math.min(350, Math.max(45, jitter + 20))
          const target = now - clockOffset - delay
          while (buf.length > 2 && buf[1].ht <= target) buf.shift()
          const a = buf[0]
          const b = buf[1] ?? a
          const t = b.ht > a.ht ? Math.max(0, Math.min(1, (target - a.ht) / (b.ht - a.ht))) : 1
          blendPlayer(p1, a.p1, b.p1, t)
          blendBall(ball, a.b, b.b, t)
        }
        const ghost = { ...p1 }
        separatePlayers(ghost, p2)
      } else {
        let steps = 0
        while (acc >= STEP_MS && steps < 5) {
          step()
          acc -= STEP_MS
          steps++
        }
        if (steps === 5) acc = 0
        left = Math.max(0, MATCH_SECONDS + (overtime ? OVERTIME_SECONDS : 0) - Math.floor(elapsed / 1000))
        if (!ended && left <= 0 && sc[0] === sc[1] && !overtime) {
          overtime = true
          left = OVERTIME_SECONDS
          flash = 'UZATMA!'
          flashT = 0
          pause = 90
          resetPositions(p1, p2, ball, Math.random() < 0.5 ? 0 : 1)
          resets++
          emit('whistle')
        }
        const out = events
        events = []
        playEvents(out, seat)
        if (mode === 'host')
          net?.send({
            t: 's',
            ht: now,
            rs: resets,
            pa: pause > 0,
            hz: pausedRef.current || rivalPaused,
            p1,
            p2,
            b: ball,
            sc,
            l: left,
            f: flash,
            ft: flashT,
            ot: overtime,
            ev: out,
            pz: pausedRef.current,
          })
      }
      if (netShake[0] > 0) netShake[0]--
      if (netShake[1] > 0) netShake[1]--
      const c = ctx!
      c.drawImage(bg, 0, 0)
      drawGoalOrHoop(c, sport, false)
      drawPlayer(c, p1, TEAM.home, homeImg, namesRef.current[0], sport)
      drawPlayer(c, p2, TEAM.away, awayImg, namesRef.current[1], sport)
      drawBall(c, ball, sport)
      drawGoalOrHoop(c, sport, true, netShake)
      drawScoreboard(c, namesRef.current, sc, left, overtime, sport)
      if (flash) drawFlash(c, flash, flashT)
      // Golden goal ends the match once its celebration has played out.
      if (mode !== 'guest' && !ended && (left <= 0 || (overtime && sc[0] !== sc[1] && !flash))) {
        ended = true
        quietCrowd()
        playSound('whistleEnd')
        if (mode === 'host') for (let i = 0; i < 3; i++) net?.send({ t: 'end', sc })
        setOver(true)
        endRef.current({ for: sc[0], against: sc[1] })
        return
      }
      if (ended) return
      raf = requestAnimationFrame(frame)
    }
    const onVis = () => {
      last = performance.now()
      k1.current = noKeys()
    }
    document.addEventListener('visibilitychange', onVis)
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      quietCrowd()
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [sport, mode, started])

  return (
    <div className="flex flex-col gap-3">
      <p className="sr-only" aria-live="polite">
        Skor {announce}
      </p>
      {needRotate && <RotatePrompt sport={sport} paused={started} />}
      <div
        className={cn(
          needRotate && 'hidden',
          fullLandscape &&
            'fixed inset-0 z-[70] flex items-center justify-center bg-background pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]',
        )}
        // On phones wider than 16:9 the side bars continue the arena (stands above, floor below) instead of showing black.
        style={fullLandscape ? { background: ARENA_FILL[sport] } : undefined}
      >
        <div
          className={cn(
            'relative overflow-hidden rounded-2xl border border-primary/30 bg-background shadow-xl',
            fullLandscape && 'aspect-video h-full max-w-full rounded-none border-0',
          )}
        >
          <canvas
            ref={canvas}
            width={W}
            height={H}
            className={cn('block aspect-video w-full touch-none select-none', fullLandscape && 'h-full')}
            aria-label={sport === 'futbol' ? 'Kafa topu sahası' : 'Kafa basketbolu sahası'}
          />
          {!fullLandscape && <OverlayControls k1={k1} />}
          <TableBrand center={false} corners={false} jako={false} plaque="bottom" />
          {mode !== 'bot' && !over && (!started || linkLost) && (
            <div
              className={cn(
                'flex flex-col items-center justify-center gap-2 text-center',
                touch && !portrait && !started ? 'fixed inset-0 z-[80] bg-background' : 'absolute inset-0 bg-background/80 backdrop-blur-sm',
              )}
            >
              <Loader2 className="size-6 animate-spin text-primary" aria-hidden="true" />
              <p className="font-semibold text-foreground">{linkLost ? 'Bağlantı koptu, yeniden bağlanılıyor…' : 'Rakibine bağlanılıyor…'}</p>
              <p className="max-w-xs text-xs text-muted-foreground">
                {mode === 'host' && linkLost ? 'Bağlantı dönene kadar rakibinin yerine bot oynuyor.' : 'İkiniz de masadayken maç otomatik başlar.'}
              </p>
            </div>
          )}
          {fullLandscape && (
            <button
              type="button"
              onClick={() => setMinimized(true)}
              className="absolute left-2 top-2 z-20 flex size-9 items-center justify-center rounded-full border border-foreground/30 bg-background/40 text-foreground backdrop-blur-sm"
              aria-label="Tam ekrandan çık"
            >
              <Minimize2 className="size-4" aria-hidden="true" />
            </button>
          )}
          {!over && (
            <button
              type="button"
              onClick={() => setSettingsOpen((o) => !o)}
              aria-expanded={settingsOpen}
              aria-label="Kontrol ayarları"
              className={cn(
                'absolute top-2 z-20 flex size-9 items-center justify-center rounded-full border border-foreground/30 bg-background/40 text-foreground backdrop-blur-sm',
                fullLandscape ? 'left-13' : 'left-2',
              )}
            >
              <Settings2 className="size-4" aria-hidden="true" />
            </button>
          )}
          {settingsOpen && !over && <ControlSettings pauses={mode === 'bot'} onClose={() => setSettingsOpen(false)} />}
          {rivalHold && !over && (
            <div role="status" className="pointer-events-none absolute inset-x-0 top-16 z-20 flex justify-center px-4">
              <p className="text-pretty rounded-full bg-background/85 px-4 py-2 text-center text-xs font-bold text-foreground shadow-md backdrop-blur-sm">
                Rakibin telefonu dik çevirdi, maç bekliyor. 15 sn içinde dönmezse maç devam eder.
              </p>
            </div>
          )}
        </div>
        {fullLandscape && <OverlayControls k1={k1} full onPress={enterFullscreen} />}
      </div>
      <p className="hidden text-center text-xs text-muted-foreground lg:block">
        A / D veya ok tuşları ile hareket, W / yukarı ile zıpla, S / boşluk ile şut (basılı tut, güçlü şut)
      </p>
    </div>
  )
}
