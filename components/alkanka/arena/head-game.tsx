'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import NextImage from 'next/image'
import { ArrowBigUp, ChevronLeft, ChevronRight, Footprints, Loader2, Maximize2, Minimize2, Smartphone } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TableBrand } from './table-brand'
import type { DuelLink } from './duel-link'
import { playSound } from '@/lib/sound'

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

type Player = { x: number; y: number; vx: number; vy: number; face: 1 | -1; kick: number; run: number }
type Ball = { x: number; y: number; vx: number; vy: number; rot: number }
type Keys = { left: boolean; right: boolean; jump: boolean; kick: boolean }
const noKeys = (): Keys => ({ left: false, right: false, jump: false, kick: false })

const GOAL_TOP = GROUND - 176
const GOAL_DEPTH = 74
const RIM_Y = 236
const RIM_W = 70
const BOARD_X = 40
const rimLeft = () => ({ a: BOARD_X + 8, b: BOARD_X + 8 + RIM_W })
const rimRight = () => ({ a: W - BOARD_X - 8 - RIM_W, b: W - BOARD_X - 8 })

const TEAM = {
  home: { jersey: '#e5b93e', trim: '#1a1a1a', shorts: '#16181d', boot: '#e5b93e' },
  away: { jersey: '#2f6fd1', trim: '#ffffff', shorts: '#0f2a56', boot: '#ffffff' },
}

function resetPositions(p1: Player, p2: Player, ball: Ball, serveTo: 0 | 1) {
  Object.assign(p1, { x: 230, y: GROUND - FOOT, vx: 0, vy: 0, face: 1, kick: 0 })
  Object.assign(p2, { x: W - 230, y: GROUND - FOOT, vx: 0, vy: 0, face: -1, kick: 0 })
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
  if (k.kick && p.kick <= 0) p.kick = 16
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

function stepBall(ball: Ball, sport: Sport) {
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
  if (ball.y > GROUND - BALL_R) {
    ball.y = GROUND - BALL_R
    ball.vy *= sport === 'basket' ? -0.78 : -0.62
    ball.vx *= 0.97
    if (Math.abs(ball.vy) < 1.2) ball.vy = 0
  }
  if (ball.y < BALL_R) {
    ball.y = BALL_R
    ball.vy = Math.abs(ball.vy) * 0.7
  }
  if (ball.x < BALL_R) {
    ball.x = BALL_R
    ball.vx = Math.max(2, Math.abs(ball.vx) * 0.8)
  }
  if (ball.x > W - BALL_R) {
    ball.x = W - BALL_R
    ball.vx = -Math.max(2, Math.abs(ball.vx) * 0.8)
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
        } else if (ball.y > GOAL_TOP) {
          ball.y = GOAL_TOP + BALL_R + 4
          ball.vy = Math.abs(ball.vy) * 0.5
        }
      }
      collideCircle(ball, postX, GOAL_TOP, 5, 0, 0, 0.6)
    }
  } else {
    for (const side of [0, 1] as const) {
      const bx = side === 0 ? BOARD_X : W - BOARD_X
      if (ball.y > RIM_Y - 112 && ball.y < RIM_Y + 18 && Math.abs(ball.x - bx) < BALL_R + 5) {
        ball.x = side === 0 ? bx + BALL_R + 5 : bx - BALL_R - 5
        ball.vx = (side === 0 ? 1 : -1) * Math.max(1.5, Math.abs(ball.vx) * 0.7)
      }
      const rim = side === 0 ? rimLeft() : rimRight()
      collideCircle(ball, rim.a, RIM_Y, 4, 0, 0, 0.55)
      collideCircle(ball, rim.b, RIM_Y, 4, 0, 0, 0.55)
    }
  }
}

function hitBall(ball: Ball, p: Player, sport: Sport) {
  const footX = p.x + p.face * 26
  const footY = p.y + FOOT - 10
  if (p.kick > 5 && Math.hypot(ball.x - footX, ball.y - footY) < BALL_R + 34) {
    const power = sport === 'futbol' ? 16 : 11.5
    ball.vx = p.face * power + p.vx * 0.4
    ball.vy = sport === 'futbol' ? -8.5 : -15
    ball.x = footX + p.face * (BALL_R + 4)
    p.kick = 5
    return
  }
  const head = collideCircle(ball, p.x, p.y, HEAD_R, p.vx, p.vy, 0.9)
  if (head) {
    if (head.ny < -0.85 && Math.abs(ball.vx) < 1.2) ball.vx += p.face * 2.2
    if (!onGround(p) && head.ny < 0) ball.vy -= 1.5
    return
  }
  collideCircle(ball, p.x, p.y + HEAD_R + 14, 16, p.vx, p.vy, 0.5)
  collideCircle(ball, p.x, p.y + FOOT - 8, 12, p.vx, p.vy, 0.4)
}

function botKeys(bot: Player, ball: Ball, sport: Sport): Keys {
  const k = noKeys()
  const home = sport === 'futbol' ? W - 160 : W - 200
  const threat = ball.vx > 3 && ball.x > W * 0.45
  const targetX = threat ? Math.min(home, Math.max(ball.x + 40, home - 120)) : ball.x + 34
  if (bot.x < targetX - 12) k.right = true
  else if (bot.x > targetX + 12) k.left = true
  const dx = ball.x - bot.x
  if (Math.abs(dx) < 110 && ball.y < bot.y - 20 && ball.vy > -3 && ball.y > bot.y - 220) k.jump = true
  if (dx < 0 && dx > -80 && ball.y > bot.y + 10) k.kick = Math.random() < 0.35
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
  }
  ctx.fillStyle = 'rgba(255,255,255,0.1)'
  ctx.font = '900 46px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText('ALKANKA', W / 2, H - 10)
  return c
}

function drawGoalOrHoop(ctx: CanvasRenderingContext2D, sport: Sport, front: boolean) {
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
    } else {
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'
      ctx.lineWidth = 1.5
      for (let i = 0; i <= 6; i++) {
        const x = rim.a + (i * RIM_W) / 6
        const xb = rim.a + RIM_W / 2 + (x - rim.a - RIM_W / 2) * 0.55
        ctx.beginPath()
        ctx.moveTo(x, RIM_Y)
        ctx.lineTo(xb, RIM_Y + 46)
        ctx.stroke()
      }
      for (let j = 1; j <= 3; j++) {
        const y = RIM_Y + j * 14
        const shrink = 1 - (j * 14 * 0.45) / 46
        ctx.beginPath()
        ctx.moveTo(rim.a + (RIM_W * (1 - shrink)) / 2, y)
        ctx.lineTo(rim.b - (RIM_W * (1 - shrink)) / 2, y)
        ctx.stroke()
      }
      ctx.strokeStyle = '#e8501f'
      ctx.lineWidth = 6
      ctx.lineCap = 'round'
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
}

function drawBall(ctx: CanvasRenderingContext2D, b: Ball, sport: Sport) {
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
}

function drawScoreboard(ctx: CanvasRenderingContext2D, names: [string, string], sc: [number, number], left: number) {
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
  ctx.fillStyle = left <= 10 ? '#ff6b5a' : '#e5b93e'
  ctx.fillText(`0:${String(left).padStart(2, '0')}`, W / 2, 49)
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
  'pointer-events-auto flex touch-none select-none items-center justify-center rounded-full border-2 border-foreground/45 bg-background/25 text-foreground shadow-md backdrop-blur-[2px] transition-transform active:scale-90 active:border-primary active:bg-primary/70 active:text-primary-foreground'

const OVERLAY_PAD =
  'pointer-events-auto flex touch-none select-none items-center justify-center rounded-full border-2 border-foreground/45 bg-background/25 text-foreground shadow-md backdrop-blur-[2px] transition-transform'
const OVERLAY_PAD_ON = 'scale-90 border-primary bg-primary/70 text-primary-foreground'

/** One touch zone for left/right so sliding the thumb across switches direction without lifting it. */
function DirectionPad({ k1, size, onPress }: { k1: React.RefObject<Keys>; size: string; onPress?: () => void }) {
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
        <ChevronLeft className="size-7" />
      </span>
      <span className={cn(OVERLAY_PAD, size, dir === 1 && OVERLAY_PAD_ON)} aria-hidden="true">
        <ChevronRight className="size-7" />
      </span>
    </div>
  )
}

/**
 * Translucent buttons on touch screens: arrows bottom-left, jump/kick bottom-right.
 * In full landscape they sit at the screen corners so they cover less of the goal mouths.
 */
function OverlayControls({ k1, full, onPress }: { k1: React.RefObject<Keys>; full?: boolean; onPress?: () => void }) {
  const size = 'size-14 landscape:size-16'
  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-end justify-between p-2.5 lg:hidden',
        full &&
          'pb-[max(0.75rem,env(safe-area-inset-bottom))] pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))]',
      )}
    >
      <DirectionPad k1={k1} size={size} onPress={onPress} />
      <div className="flex items-end gap-2.5">
        <button type="button" className={cn(OVERLAY_BTN, size)} aria-label="Zıpla" {...bindKey(k1, 'jump', onPress)}>
          <ArrowBigUp className="size-7" aria-hidden="true" />
        </button>
        <button type="button" className={cn(OVERLAY_BTN, size, 'mb-5 border-primary/80')} aria-label="Şut" {...bindKey(k1, 'kick', onPress)}>
          <Footprints className="size-7" aria-hidden="true" />
        </button>
      </div>
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
  const needRotate = touch && portrait && !over
  const fullLandscape = touch && !portrait && started && !over && !minimized
  const pausedRef = useRef(false)
  pausedRef.current = needRotate

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
    const p1: Player = { x: 0, y: 0, vx: 0, vy: 0, face: 1, kick: 0, run: 0 }
    const p2: Player = { x: 0, y: 0, vx: 0, vy: 0, face: -1, kick: 0, run: 0 }
    const ball: Ball = { x: 0, y: 0, vx: 0, vy: 0, rot: 0 }
    resetPositions(p1, p2, ball, 0)
    const sc: [number, number] = [0, 0]
    let pause = 70
    let raf = 0
    let last = performance.now()
    let acc = 0
    let elapsed = 0
    let ended = false
    let prevBallY = ball.y
    let flash = ''
    let flashT = 0
    let stuckFrames = 0
    let anchor = { x: ball.x, y: ball.y }
    let left = MATCH_SECONDS
    let remoteKeys: Keys = noKeys()
    let sentKeys = ''
    let frameNo = 0

    if (mode !== 'bot' && linkRef.current) {
      linkRef.current.onMessage.current = (raw) => {
        const msg = raw as { t: string; [k: string]: unknown }
        if (mode === 'host' && msg.t === 'k') remoteKeys = { ...noKeys(), ...(msg.k as Partial<Keys>) }
        if (mode !== 'guest') return
        if (msg.t === 's') {
          Object.assign(p1, msg.p1)
          Object.assign(p2, msg.p2)
          Object.assign(ball, msg.b)
          const next = msg.sc as [number, number]
          if (next[0] !== sc[0] || next[1] !== sc[1]) {
            playSound('goal')
            setAnnounce(`${next[0]} - ${next[1]}`)
          }
          sc[0] = next[0]
          sc[1] = next[1]
          left = msg.l as number
          flash = msg.f as string
          flashT = msg.ft as number
        } else if (msg.t === 'end' && !ended) {
          const fin = msg.sc as [number, number]
          ended = true
          setOver(true)
          endRef.current({ for: fin[1], against: fin[0] })
        }
      }
    }

    function goal(scorer: 0 | 1, pts: number) {
      sc[scorer] += pts
      playSound('goal')
      setAnnounce(`${sc[0]} - ${sc[1]}`)
      flash = sport === 'futbol' ? 'GOL!' : 'BASKET!'
      flashT = 0
      pause = 80
      resetPositions(p1, p2, ball, scorer === 0 ? 1 : 0)
    }

    function step() {
      if (flash) {
        flashT++
        if (flashT > 70) flash = ''
      }
      const k2now = mode === 'host' && linkRef.current?.status === 'open' ? remoteKeys : botKeys(p2, ball, sport)
      if (pause > 0) {
        pause--
        stepPlayer(p1, noKeys(), sport)
        stepPlayer(p2, noKeys(), sport)
        return
      }
      elapsed += STEP_MS
      stepPlayer(p1, k1.current, sport)
      stepPlayer(p2, k2now, sport)
      separatePlayers(p1, p2)
      prevBallY = ball.y
      stepBall(ball, sport)
      hitBall(ball, p1, sport)
      hitBall(ball, p2, sport)

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
        }
      }

      if (sport === 'futbol') {
        if (ball.x < GOAL_DEPTH - BALL_R * 0.5 && ball.y > GOAL_TOP + 8) goal(1, 1)
        else if (ball.x > W - GOAL_DEPTH + BALL_R * 0.5 && ball.y > GOAL_TOP + 8) goal(0, 1)
      } else if (prevBallY < RIM_Y && ball.y >= RIM_Y && ball.vy > 0) {
        const L = rimLeft()
        const R = rimRight()
        if (ball.x > L.a + 3 && ball.x < L.b - 3) goal(1, 2)
        else if (ball.x > R.a + 3 && ball.x < R.b - 3) goal(0, 2)
      }
    }

    function frame(now: number) {
      acc += Math.min(80, now - last)
      last = now
      if (pausedRef.current) {
        acc = 0
        k1.current = noKeys()
      }
      frameNo++
      const net = linkRef.current
      if (mode === 'guest') {
        acc = 0
        const keys = JSON.stringify(k1.current)
        if (keys !== sentKeys || frameNo % 10 === 0) {
          sentKeys = keys
          net?.send({ t: 'k', k: k1.current })
        }
      } else {
        let steps = 0
        while (acc >= STEP_MS && steps < 5) {
          step()
          acc -= STEP_MS
          steps++
        }
        if (steps === 5) acc = 0
        left = Math.max(0, MATCH_SECONDS - Math.floor(elapsed / 1000))
        if (mode === 'host') net?.send({ t: 's', p1, p2, b: ball, sc, l: left, f: flash, ft: flashT })
      }
      const c = ctx!
      c.drawImage(bg, 0, 0)
      drawGoalOrHoop(c, sport, false)
      drawPlayer(c, p1, TEAM.home, homeImg, namesRef.current[0])
      drawPlayer(c, p2, TEAM.away, awayImg, namesRef.current[1])
      drawBall(c, ball, sport)
      drawGoalOrHoop(c, sport, true)
      drawScoreboard(c, namesRef.current, sc, left)
      if (flash) drawFlash(c, flash, flashT)
      if (mode !== 'guest' && left <= 0 && !ended) {
        ended = true
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
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/80 text-center backdrop-blur-sm">
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
              className="absolute left-2 top-2 flex size-9 items-center justify-center rounded-full border border-foreground/30 bg-background/40 text-foreground backdrop-blur-sm"
              aria-label="Tam ekrandan çık"
            >
              <Minimize2 className="size-4" aria-hidden="true" />
            </button>
          )}
        </div>
        {fullLandscape && <OverlayControls k1={k1} full onPress={enterFullscreen} />}
      </div>
      <p className="hidden text-center text-xs text-muted-foreground lg:block">
        A / D veya ok tuşları ile hareket, W / yukarı ile zıpla, S / boşluk ile şut
      </p>
    </div>
  )
}
