import {
  BALL_R,
  BOARD_X,
  CHARGE_MAX,
  CAMP_LIMIT,
  COUNTDOWN_STEPS,
  FOOT,
  FX,
  GOAL_DEPTH,
  GOAL_TOP,
  GROUND,
  H,
  HEAD_R,
  METER_MAX,
  NET_H,
  POWERS,
  RIM_W,
  RIM_Y,
  TEAM,
  THREE_DIST,
  W,
  charAt,
  headR,
  headY,
  onGround,
  rimOf,
  timeLeft,
  type Ball,
  type NetEvent,
  type Player,
  type Sport,
  type World,
} from './engine'

type Kit = (typeof TEAM)['home']

/* ------------------------------ particles & camera ------------------------------ */

type Particle = { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string; shape: 0 | 1; rot: number; vr: number; g: number }

const CONFETTI = ['#e5b93e', '#ffffff', '#2f6fd1', '#ff6b5a', '#35c46a']

/** Render-only effects. Both host and guest drive it from the same event stream, so they look alike. */
export class Fx {
  parts: Particle[] = []
  shake = 0
  squash: [number, number] = [0, 0]
  private prevVy: [number, number] = [0, 0]
  private frame = 0

  private add(p: Omit<Particle, 'life' | 'rot' | 'vr'> & { rot?: number; vr?: number }) {
    if (this.parts.length > 420) this.parts.shift()
    this.parts.push({ rot: 0, vr: 0, ...p, life: p.max })
  }

  handle(ev: NetEvent) {
    const [name, v, x = W / 2, y = H / 2] = ev
    if (name === 'shake') this.shake = Math.max(this.shake, v)
    else if (name === 'fx') this.spawn(v, x, y)
  }

  spawn(code: number, x: number, y: number) {
    const r = Math.random
    if (code === FX.dust || code === FX.grass) {
      const color = code === FX.grass ? '#4caf50' : 'rgba(230,220,200,0.8)'
      for (let i = 0; i < 9; i++)
        this.add({ x, y, vx: (r() - 0.5) * 5, vy: -r() * 3.5, max: 22 + r() * 14, size: 2 + r() * 3, color, shape: code === FX.grass ? 1 : 0, g: 0.18 })
    } else if (code === FX.confetti) {
      for (let i = 0; i < 90; i++)
        this.add({
          x: x + (r() - 0.5) * 60,
          y,
          vx: (r() - 0.5) * 12,
          vy: -4 - r() * 9,
          max: 70 + r() * 50,
          size: 4 + r() * 4,
          color: CONFETTI[i % CONFETTI.length],
          shape: 1,
          vr: (r() - 0.5) * 0.4,
          g: 0.16,
        })
    } else if (code === FX.ice) {
      for (let i = 0; i < 26; i++)
        this.add({ x, y, vx: (r() - 0.5) * 8, vy: (r() - 0.7) * 8, max: 30 + r() * 20, size: 3 + r() * 4, color: i % 2 ? '#d9f3ff' : '#7fd3ff', shape: 1, vr: 0.2, g: 0.2 })
    } else if (code === FX.fire) {
      for (let i = 0; i < 28; i++)
        this.add({ x, y, vx: (r() - 0.5) * 9, vy: (r() - 0.6) * 8, max: 20 + r() * 18, size: 4 + r() * 6, color: i % 3 ? '#ff7a1a' : '#ffd166', shape: 0, g: -0.05 })
    } else if (code === FX.spark) {
      for (let i = 0; i < 22; i++) {
        const a = (i / 22) * Math.PI * 2
        this.add({ x, y, vx: Math.cos(a) * 5, vy: Math.sin(a) * 5, max: 22, size: 3, color: '#fff3c4', shape: 0, g: 0 })
      }
    } else if (code === FX.smoke) {
      for (let i = 0; i < 12; i++)
        this.add({ x, y, vx: (r() - 0.5) * 3, vy: -r() * 2, max: 30 + r() * 20, size: 6 + r() * 6, color: 'rgba(80,80,90,0.5)', shape: 0, g: -0.04 })
    }
  }

  /** Per-frame: trails behind special balls and landing squash. */
  update(ball: Ball, players: [Player, Player]) {
    this.frame++
    if (ball.fx === 1) {
      for (let i = 0; i < 3; i++)
        this.add({
          x: ball.x + (Math.random() - 0.5) * 10,
          y: ball.y + (Math.random() - 0.5) * 10,
          vx: -ball.vx * 0.08,
          vy: -0.6 - Math.random(),
          max: 16 + Math.random() * 10,
          size: 5 + Math.random() * 6,
          color: i ? '#ff7a1a' : '#ffd166',
          shape: 0,
          g: -0.04,
        })
    }
    for (const s of [0, 1] as const) {
      const p = players[s]
      const landed = this.prevVy[s] > 5 && onGround(p)
      if (landed) {
        this.squash[s] = Math.min(1, this.prevVy[s] / 12)
        this.spawn(FX.dust, p.x, GROUND)
      } else if (p.vy < -6) this.squash[s] = Math.max(this.squash[s] - 0.15, -0.6)
      else this.squash[s] *= 0.82
      this.prevVy[s] = p.vy
      if (p.frozen > 0 && this.frame % 6 === 0)
        this.add({ x: p.x + (Math.random() - 0.5) * 60, y: headY(p) - 30, vx: 0, vy: 0.6, max: 26, size: 2, color: '#e6f7ff', shape: 0, g: 0 })
    }
    for (const q of this.parts) {
      q.vy += q.g
      q.x += q.vx
      q.y += q.vy
      q.vx *= 0.98
      q.rot += q.vr
      q.life--
      if (q.shape === 1 && q.y > GROUND + 30) {
        q.y = GROUND + 30
        q.vy = 0
        q.vx *= 0.8
      }
    }
    this.parts = this.parts.filter((q) => q.life > 0)
    this.shake *= 0.86
    if (this.shake < 0.3) this.shake = 0
  }

  offset(): [number, number] {
    if (!this.shake) return [0, 0]
    return [(Math.random() - 0.5) * this.shake * 2, (Math.random() - 0.5) * this.shake * 2]
  }

  draw(ctx: CanvasRenderingContext2D) {
    for (const q of this.parts) {
      ctx.globalAlpha = Math.max(0, Math.min(1, q.life / q.max))
      ctx.fillStyle = q.color
      if (q.shape === 1) {
        ctx.save()
        ctx.translate(q.x, q.y)
        ctx.rotate(q.rot)
        ctx.fillRect(-q.size / 2, -q.size / 4, q.size, q.size / 2)
        ctx.restore()
      } else {
        ctx.beginPath()
        ctx.arc(q.x, q.y, q.size * (0.4 + 0.6 * (q.life / q.max)), 0, Math.PI * 2)
        ctx.fill()
      }
    }
    ctx.globalAlpha = 1
  }
}

/* ------------------------------ arena ------------------------------ */

function rand(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

export const ARENA_FILL: Record<Sport, string> = {
  futbol: 'linear-gradient(#0a1630, #1d4f5e 72%, #0b0d12 72%, #0b0d12 78.5%, #2f8a3e 78.5%)',
  basket: 'linear-gradient(#120d0a, #2a1a12 72%, #0b0d12 72%, #0b0d12 78.5%, #b97a43 78.5%)',
}

/** Painted once per match into an offscreen canvas. */
export function paintBackground(sport: Sport): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d')!
  const r = rand(sport === 'futbol' ? 7 : 11)

  const sky = ctx.createLinearGradient(0, 0, 0, GROUND)
  if (sport === 'futbol') {
    sky.addColorStop(0, '#070f22')
    sky.addColorStop(0.5, '#123a5c')
    sky.addColorStop(1, '#1d4f5e')
  } else {
    sky.addColorStop(0, '#120d0a')
    sky.addColorStop(0.6, '#2a1a12')
    sky.addColorStop(1, '#3a2416')
  }
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, W, H)

  // Stadium roof silhouette with floodlight rigs.
  ctx.fillStyle = 'rgba(0,0,0,0.45)'
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(W, 0)
  ctx.lineTo(W, 70)
  ctx.quadraticCurveTo(W / 2, 40, 0, 70)
  ctx.fill()
  for (const lx of [120, W / 2, W - 120]) {
    const glow = ctx.createRadialGradient(lx, 40, 4, lx, 40, 240)
    glow.addColorStop(0, 'rgba(255,248,220,0.5)')
    glow.addColorStop(1, 'rgba(255,248,220,0)')
    ctx.fillStyle = glow
    ctx.fillRect(lx - 240, 0, 480, 280)
    ctx.fillStyle = '#2b3240'
    ctx.fillRect(lx - 40, 22, 80, 30)
    ctx.fillStyle = '#fff8dc'
    for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) ctx.fillRect(lx - 34 + i * 18, 26 + j * 13, 14, 10)
  }

  const standTop = 90
  const standBottom = GROUND - 92
  const tiers = 7
  const crowd =
    sport === 'futbol'
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
  // Dimmed stands keep the ball readable against the crowd.
  ctx.fillStyle = sport === 'basket' ? 'rgba(10,6,4,0.5)' : 'rgba(4,10,20,0.28)'
  ctx.fillRect(0, standTop, W, standBottom - standTop)

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

  const vignette = ctx.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, W * 0.75)
  vignette.addColorStop(0, 'rgba(0,0,0,0)')
  vignette.addColorStop(1, 'rgba(0,0,0,0.35)')
  ctx.fillStyle = vignette
  ctx.fillRect(0, 0, W, H)
  return c
}

export function drawGoalOrHoop(ctx: CanvasRenderingContext2D, w: World, front: boolean, frame: number) {
  if (w.sport === 'futbol') {
    for (const side of [0, 1] as const) {
      const x0 = side === 0 ? 0 : W - GOAL_DEPTH
      const postX = side === 0 ? GOAL_DEPTH : W - GOAL_DEPTH
      if (!front) {
        // The net bulges toward the back wall after a goal.
        const s = w.netShake[side]
        const bulge = Math.sin(s * 0.4) * (s / 40) * 8 * (side === 0 ? -1 : 1)
        ctx.fillStyle = 'rgba(255,255,255,0.08)'
        ctx.fillRect(x0, GOAL_TOP, GOAL_DEPTH, GROUND - GOAL_TOP)
        ctx.strokeStyle = 'rgba(255,255,255,0.4)'
        ctx.lineWidth = 1
        for (let y = GOAL_TOP; y <= GROUND; y += 12) {
          const f = Math.sin(((y - GOAL_TOP) / (GROUND - GOAL_TOP)) * Math.PI)
          ctx.beginPath()
          ctx.moveTo(x0 + (side === 0 ? bulge * f : 0), y)
          ctx.lineTo(x0 + GOAL_DEPTH + (side === 1 ? bulge * f : 0), y)
          ctx.stroke()
        }
        for (let x = x0; x <= x0 + GOAL_DEPTH; x += 12) {
          ctx.beginPath()
          ctx.moveTo(x, GOAL_TOP)
          ctx.quadraticCurveTo(x + bulge * 0.6, (GOAL_TOP + GROUND) / 2, x, GROUND)
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
        if (w.p[side].shield > 0) drawShieldWall(ctx, postX - 11, GOAL_TOP + 4, 22, GROUND - GOAL_TOP - 4, w.p[side].shield, frame)
      }
    }
    return
  }
  for (const side of [0, 1] as const) {
    const bx = side === 0 ? BOARD_X : W - BOARD_X
    const rim = rimOf(side)
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
      const s = w.netShake[side]
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
      ctx.lineCap = 'round'
      ctx.strokeStyle = 'rgba(0,0,0,0.55)'
      ctx.lineWidth = 10
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
      if (w.p[side].shield > 0) drawShieldWall(ctx, rim.a - 10, RIM_Y - 18, RIM_W + 20, 16, w.p[side].shield, frame)
    }
  }
}

function drawShieldWall(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, left: number, frame: number) {
  const blink = left < 60 && Math.floor(frame / 5) % 2 === 0
  ctx.save()
  ctx.globalAlpha = blink ? 0.4 : 0.95
  ctx.fillStyle = '#6b7280'
  ctx.strokeStyle = '#2b2f36'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, 4)
  ctx.fill()
  ctx.stroke()
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'
  ctx.lineWidth = 1.5
  const brick = 14
  for (let row = 0, yy = y; yy < y + h; row++, yy += brick) {
    ctx.beginPath()
    ctx.moveTo(x, yy)
    ctx.lineTo(x + w, yy)
    ctx.stroke()
    for (let xx = x + (row % 2 ? brick / 2 : 0); xx < x + w; xx += brick) {
      ctx.beginPath()
      ctx.moveTo(xx, yy)
      ctx.lineTo(xx, Math.min(y + h, yy + brick))
      ctx.stroke()
    }
  }
  ctx.restore()
}

/* ------------------------------ actors ------------------------------ */

export function drawPlayer(
  ctx: CanvasRenderingContext2D,
  p: Player,
  kit: Kit,
  img: HTMLImageElement | undefined,
  label: string,
  sport: Sport,
  squash: number,
  frame: number,
) {
  const feet = p.y + FOOT
  const air = GROUND - feet
  const shadowW = 44 * Math.max(0.45, 1 - air / 260)
  ctx.fillStyle = 'rgba(0,0,0,0.35)'
  ctx.beginPath()
  ctx.ellipse(p.x, GROUND + 4, shadowW, 8, 0, 0, Math.PI * 2)
  ctx.fill()

  ctx.save()
  // Squash on landing, stretch while launching: anchored at the feet so the player never sinks into the pitch.
  const sx = 1 + squash * 0.16
  const sy = 1 - squash * 0.16
  ctx.translate(p.x, feet)
  ctx.scale(sx, sy)
  ctx.translate(-p.x, -feet)

  const hipY = p.y + HEAD_R + 16
  const kicking = p.kick > 5
  const swing = kicking ? Math.sin(((16 - p.kick) / 11) * Math.PI) * 1.5 : p.charge > 3 ? -0.5 * (p.charge / CHARGE_MAX) : 0
  const stride = onGround(p) && Math.abs(p.vx) > 0.5 ? Math.sin(p.run) * 0.55 : !onGround(p) ? 0.35 : 0
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
    ctx.roundRect(-7 + p.face * 2, legLen - 6, 22, 10, 5)
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

  drawLeg(kicking ? -swing : p.charge > 3 ? -swing : stride, false)

  const r = headR(p)
  const hy = headY(p)
  // Auras for active powers sit behind the head.
  if (p.armed) {
    const id = charAt(p.ch).power
    const pulse = 0.6 + 0.4 * Math.sin(frame * 0.3)
    const g = ctx.createRadialGradient(p.x, hy, r * 0.8, p.x, hy, r * 1.6)
    g.addColorStop(0, id === 'fire' ? `rgba(255,140,40,${0.7 * pulse})` : `rgba(214,236,255,${0.6 * pulse})`)
    g.addColorStop(1, 'rgba(255,140,40,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(p.x, hy, r * 1.6, 0, Math.PI * 2)
    ctx.fill()
  }
  if (p.grow > 0) {
    ctx.fillStyle = 'rgba(229,185,62,0.25)'
    ctx.beginPath()
    ctx.arc(p.x, hy, r + 8, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.save()
  ctx.beginPath()
  ctx.arc(p.x, hy, r, 0, Math.PI * 2)
  ctx.fillStyle = '#20232b'
  ctx.fill()
  if (img?.complete && img.naturalWidth) {
    ctx.clip()
    ctx.translate(p.x, hy)
    if (charAt(p.ch).facesLeft ? p.face === 1 : p.face === -1) ctx.scale(-1, 1)
    const s = img.naturalWidth
    ctx.drawImage(img, s * 0.13, s * 0.1, s * 0.76, s * 0.8, -r * 1.08, -r * 1.1, r * 2.16, r * 2.28)
  }
  ctx.restore()
  ctx.lineWidth = 3
  ctx.strokeStyle = p.shrink > 0 ? '#c4a1ff' : kit.jersey
  ctx.beginPath()
  ctx.arc(p.x, hy, r, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()

  if (p.frozen > 0) {
    const blink = p.frozen < 30 && Math.floor(frame / 4) % 2 === 0
    ctx.save()
    ctx.globalAlpha = blink ? 0.3 : 0.6
    ctx.fillStyle = '#a8e2ff'
    ctx.strokeStyle = '#e6f7ff'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.roundRect(p.x - r - 10, hy - r - 10, (r + 10) * 2, feet - hy + r + 12, 10)
    ctx.fill()
    ctx.stroke()
    ctx.globalAlpha = 0.8
    ctx.strokeStyle = '#ffffff'
    ctx.beginPath()
    ctx.moveTo(p.x - r, hy - r + 6)
    ctx.lineTo(p.x - r + 18, hy - r + 30)
    ctx.stroke()
    ctx.restore()
  }
  if (p.stun > 0) {
    for (let i = 0; i < 3; i++) {
      const a = frame * 0.18 + (i * Math.PI * 2) / 3
      drawStar(ctx, p.x + Math.cos(a) * (r + 6), hy - r - 4 + Math.sin(a) * 6, 6)
    }
  }

  ctx.font = '800 13px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  const tw = ctx.measureText(label).width + 14
  const ly = hy - r - 26
  ctx.fillStyle = 'rgba(0,0,0,0.55)'
  ctx.beginPath()
  ctx.roundRect(p.x - tw / 2, ly, tw, 18, 9)
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.fillText(label, p.x, ly + 13)

  if (p.charge > 3) {
    const bw = 56
    const fill = p.charge / CHARGE_MAX
    ctx.fillStyle = 'rgba(0,0,0,0.6)'
    ctx.beginPath()
    ctx.roundRect(p.x - bw / 2, ly - 10, bw, 7, 3.5)
    ctx.fill()
    ctx.fillStyle = fill >= 1 ? '#ff6b5a' : '#e5b93e'
    ctx.beginPath()
    ctx.roundRect(p.x - bw / 2, ly - 10, Math.max(7, bw * fill), 7, 3.5)
    ctx.fill()
  }
  if (p.camp > 90 && p.camp < CAMP_LIMIT) {
    ctx.font = '900 14px sans-serif'
    ctx.lineWidth = 4
    ctx.strokeStyle = '#111'
    const warn = `${sport === 'futbol' ? 'KALEDEN' : 'POTADAN'} ÇIK ${Math.ceil((CAMP_LIMIT - p.camp) / 60)}`
    ctx.strokeText(warn, p.x, ly - 18)
    ctx.fillStyle = '#ff6b5a'
    ctx.fillText(warn, p.x, ly - 18)
  }
}

function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.fillStyle = '#ffd166'
  ctx.beginPath()
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    const rr = i % 2 ? r * 0.45 : r
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr)
  }
  ctx.fill()
}

export function drawBall(ctx: CanvasRenderingContext2D, b: Ball, sport: Sport, viewer: number, frame: number) {
  const speed = Math.hypot(b.vx, b.vy)
  const ghost = b.fx === 2
  // A ghost shot is a faint shimmer to the defender; the shooter still sees a see-through ball.
  const alpha = ghost ? (b.owner === viewer ? 0.45 : 0.07 + 0.05 * Math.sin(frame * 0.5)) : 1
  ctx.save()
  ctx.globalAlpha = alpha
  if (speed > 7 && !ghost) {
    for (let i = 3; i >= 1; i--) {
      const a = (0.2 * (4 - i)) / 3
      ctx.fillStyle = b.fx === 1 ? `rgba(255,140,40,${a + 0.1})` : sport === 'futbol' ? `rgba(255,255,255,${a})` : `rgba(255,170,90,${a})`
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
  if (b.fx === 1) {
    const g = ctx.createRadialGradient(b.x, b.y, BALL_R * 0.5, b.x, b.y, BALL_R * 2.6)
    g.addColorStop(0, 'rgba(255,209,102,0.9)')
    g.addColorStop(1, 'rgba(255,122,26,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(b.x, b.y, BALL_R * 2.6, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.translate(b.x, b.y)
  ctx.rotate(b.rot)
  ctx.beginPath()
  ctx.arc(0, 0, BALL_R, 0, Math.PI * 2)
  if (sport === 'futbol') {
    const g = ctx.createRadialGradient(-5, -6, 2, 0, 0, BALL_R)
    g.addColorStop(0, b.fx === 1 ? '#fff1c2' : '#ffffff')
    g.addColorStop(1, b.fx === 1 ? '#ff8a2a' : '#cfd4da')
    ctx.fillStyle = g
    ctx.fill()
    ctx.clip()
    ctx.fillStyle = b.fx === 1 ? '#7a2a05' : '#16181d'
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
  ctx.save()
  ctx.globalAlpha = alpha
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
  ctx.restore()
}

/* ------------------------------ HUD ------------------------------ */

function portrait(ctx: CanvasRenderingContext2D, img: HTMLImageElement | undefined, x: number, y: number, r: number, ring: string, mirror: boolean) {
  ctx.save()
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fillStyle = '#20232b'
  ctx.fill()
  if (img?.complete && img.naturalWidth) {
    ctx.clip()
    ctx.translate(x, y)
    if (mirror) ctx.scale(-1, 1)
    const s = img.naturalWidth
    ctx.drawImage(img, s * 0.13, s * 0.1, s * 0.76, s * 0.8, -r * 1.08, -r * 1.1, r * 2.16, r * 2.28)
  }
  ctx.restore()
  ctx.strokeStyle = ring
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.stroke()
}

function meterBar(ctx: CanvasRenderingContext2D, p: Player, x: number, y: number, w: number, alignRight: boolean, frame: number) {
  const id = charAt(p.ch).power
  const fill = Math.min(1, p.meter / METER_MAX)
  const ready = fill >= 1
  ctx.fillStyle = 'rgba(8,10,14,0.8)'
  ctx.beginPath()
  ctx.roundRect(x, y, w, 12, 6)
  ctx.fill()
  const color = POWERS[id].color
  ctx.save()
  if (ready) {
    ctx.shadowColor = color
    ctx.shadowBlur = 8 + 6 * Math.sin(frame * 0.25)
  }
  ctx.fillStyle = color
  ctx.beginPath()
  const fw = Math.max(12, w * fill)
  ctx.roundRect(alignRight ? x + w - fw : x, y, fw, 12, 6)
  ctx.fill()
  ctx.restore()
  ctx.font = '800 10px sans-serif'
  ctx.textBaseline = 'middle'
  ctx.textAlign = alignRight ? 'right' : 'left'
  const text = p.armed ? `${POWERS[id].name.toUpperCase()} YÜKLÜ` : ready ? `${POWERS[id].name.toUpperCase()} HAZIR` : POWERS[id].name.toUpperCase()
  ctx.lineWidth = 3
  ctx.strokeStyle = 'rgba(0,0,0,0.85)'
  ctx.strokeText(text, alignRight ? x + w - 6 : x + 6, y + 6.5)
  ctx.fillStyle = '#ffffff'
  ctx.fillText(text, alignRight ? x + w - 6 : x + 6, y + 6.5)
}

export function drawHud(ctx: CanvasRenderingContext2D, w: World, names: [string, string], imgs: HTMLImageElement[], frame: number) {
  const panelW = 470
  const x = W / 2 - panelW / 2
  const y = 8
  const g = ctx.createLinearGradient(0, y, 0, y + 54)
  g.addColorStop(0, 'rgba(22,26,34,0.95)')
  g.addColorStop(1, 'rgba(8,10,14,0.95)')
  ctx.fillStyle = g
  ctx.strokeStyle = 'rgba(229,185,62,0.75)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.roundRect(x, y, panelW, 54, 14)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = TEAM.home.jersey
  ctx.beginPath()
  ctx.roundRect(x + 4, y + 4, 6, 46, 3)
  ctx.fill()
  ctx.fillStyle = TEAM.away.jersey
  ctx.beginPath()
  ctx.roundRect(x + panelW - 10, y + 4, 6, 46, 3)
  ctx.fill()

  portrait(ctx, imgs[w.p[0].ch], x + 36, y + 27, 20, TEAM.home.jersey, charAt(w.p[0].ch).facesLeft)
  portrait(ctx, imgs[w.p[1].ch], x + panelW - 36, y + 27, 20, TEAM.away.jersey, !charAt(w.p[1].ch).facesLeft)

  ctx.textBaseline = 'middle'
  ctx.font = '800 14px sans-serif'
  ctx.fillStyle = '#f2f2f2'
  ctx.textAlign = 'left'
  ctx.fillText(names[0].slice(0, 11), x + 64, y + 20)
  ctx.textAlign = 'right'
  ctx.fillText(names[1].slice(0, 11), x + panelW - 64, y + 20)
  ctx.font = '700 10px sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.textAlign = 'left'
  ctx.fillText(charAt(w.p[0].ch).title.toUpperCase(), x + 64, y + 37)
  ctx.textAlign = 'right'
  ctx.fillText(charAt(w.p[1].ch).title.toUpperCase(), x + panelW - 64, y + 37)

  // Score block.
  ctx.fillStyle = '#0b0d12'
  ctx.beginPath()
  ctx.roundRect(W / 2 - 62, y + 5, 124, 30, 8)
  ctx.fill()
  ctx.font = '900 26px sans-serif'
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'center'
  ctx.fillText(`${w.sc[0]}  -  ${w.sc[1]}`, W / 2, y + 21)
  const left = timeLeft(w)
  const ot = w.overtime
  ctx.font = '800 12px monospace'
  ctx.fillStyle = ot || left <= 10 ? '#ff6b5a' : '#e5b93e'
  const mm = Math.floor(left / 60)
  const ss = String(left % 60).padStart(2, '0')
  ctx.fillText(`${ot ? 'ALTIN ' : ''}${mm}:${ss}`, W / 2, y + 45)

  meterBar(ctx, w.p[0], x, y + 60, 200, false, frame)
  meterBar(ctx, w.p[1], x + panelW - 200, y + 60, 200, true, frame)
}

export function drawFlash(ctx: CanvasRenderingContext2D, text: string, t: number) {
  const k = Math.min(1, t / 10)
  const scale = 0.5 + 0.6 * k - 0.1 * Math.max(0, (t - 12) / 50)
  const fade = t > 65 ? Math.max(0, 1 - (t - 65) / 15) : 1
  ctx.save()
  ctx.globalAlpha = fade
  ctx.translate(W / 2, H / 2 - 40)
  ctx.rotate(-0.04)
  ctx.scale(scale, scale)
  ctx.font = '900 100px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  ctx.lineWidth = 16
  ctx.strokeStyle = '#111'
  ctx.strokeText(text, 0, 0)
  const g = ctx.createLinearGradient(0, -50, 0, 50)
  g.addColorStop(0, '#fff3c4')
  g.addColorStop(0.5, '#e5b93e')
  g.addColorStop(1, '#b8860b')
  ctx.fillStyle = g
  ctx.fillText(text, 0, 0)
  ctx.restore()
}

export function drawBanner(ctx: CanvasRenderingContext2D, w: World) {
  if (w.bannerT <= 0 || !w.banner) return
  const t = w.bannerT
  const appear = Math.min(1, (140 - Math.min(140, t)) / 8 + (t < 90 ? 1 : 0))
  const alpha = Math.min(1, t / 15) * Math.min(1, appear)
  const color = w.bannerSeat === 0 ? TEAM.home.jersey : w.bannerSeat === 1 ? TEAM.away.jersey : '#ff6b5a'
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.font = '900 22px sans-serif'
  const tw = ctx.measureText(w.banner).width + 40
  const by = 108
  ctx.fillStyle = 'rgba(8,10,14,0.85)'
  ctx.strokeStyle = color
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.roundRect(W / 2 - tw / 2, by, tw, 36, 18)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = color
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(w.banner, W / 2, by + 19)
  ctx.restore()
}

export function drawCountdown(ctx: CanvasRenderingContext2D, countdown: number) {
  if (countdown <= 0) return
  const n = Math.ceil(countdown / (COUNTDOWN_STEPS / 3))
  const t = countdown % (COUNTDOWN_STEPS / 3)
  const k = t / (COUNTDOWN_STEPS / 3)
  ctx.save()
  ctx.globalAlpha = Math.min(1, k * 3)
  ctx.translate(W / 2, H / 2 - 30)
  ctx.scale(0.8 + k * 0.5, 0.8 + k * 0.5)
  ctx.font = '900 120px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineWidth = 14
  ctx.lineJoin = 'round'
  ctx.strokeStyle = '#111'
  ctx.strokeText(String(n), 0, 0)
  ctx.fillStyle = '#ffffff'
  ctx.fillText(String(n), 0, 0)
  ctx.restore()
}

/** Slow-motion goal replay frame: letterbox bars and a tint so the moment reads as cinematic. */
export function drawSlowMo(ctx: CanvasRenderingContext2D, slow: number) {
  if (slow <= 0) return
  const k = Math.min(1, slow / 10)
  ctx.fillStyle = `rgba(0,0,0,${0.75 * k})`
  ctx.fillRect(0, 0, W, 26 * k)
  ctx.fillRect(0, H - 26 * k, W, 26 * k)
}

export { headR, headY }
