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

const INK = '#0b0d12'
const GOLD = '#e5b93e'

/* ------------------------------ particles ------------------------------ */

type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  max: number
  size: number
  color: string
  /** 0 dot, 1 confetti strip, 2 expanding impact ring */
  shape: 0 | 1 | 2
  rot: number
  vr: number
  g: number
}

const CONFETTI = [GOLD, '#ffffff', '#2f6fd1', '#ff6b5a', '#35c46a']

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
      for (let i = 0; i < 110; i++)
        this.add({
          x: x + (r() - 0.5) * 80,
          y,
          vx: (r() - 0.5) * 13,
          vy: -4 - r() * 10,
          max: 80 + r() * 60,
          size: 4 + r() * 4,
          color: CONFETTI[i % CONFETTI.length],
          shape: 1,
          vr: (r() - 0.5) * 0.4,
          g: 0.15,
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
    } else if (code === FX.kickHit || code === FX.headHit) {
      // Contact punch: a quick ring plus a few streaks so every touch has weight.
      this.add({ x, y, vx: 0, vy: 0, max: 12, size: code === FX.kickHit ? 14 : 11, color: code === FX.kickHit ? '#ffffff' : '#fff3c4', shape: 2, g: 0 })
      for (let i = 0; i < 6; i++) {
        const a = r() * Math.PI * 2
        this.add({ x, y, vx: Math.cos(a) * 4.5, vy: Math.sin(a) * 4.5, max: 10 + r() * 6, size: 2.2, color: '#ffffff', shape: 0, g: 0 })
      }
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
      const k = Math.max(0, Math.min(1, q.life / q.max))
      ctx.globalAlpha = k
      if (q.shape === 2) {
        ctx.strokeStyle = q.color
        ctx.lineWidth = 4 * k
        ctx.beginPath()
        ctx.arc(q.x, q.y, q.size * (1 + (1 - k) * 2.4), 0, Math.PI * 2)
        ctx.stroke()
        continue
      }
      ctx.fillStyle = q.color
      if (q.shape === 1) {
        ctx.save()
        ctx.translate(q.x, q.y)
        ctx.rotate(q.rot)
        ctx.fillRect(-q.size / 2, -q.size / 4, q.size, q.size / 2)
        ctx.restore()
      } else {
        ctx.beginPath()
        ctx.arc(q.x, q.y, q.size * (0.4 + 0.6 * k), 0, Math.PI * 2)
        ctx.fill()
      }
    }
    ctx.globalAlpha = 1
  }
}

/* ------------------------------ arena ------------------------------ */

/** Stands take the top ~28%, the pitch the bottom ~67%: the action is the star, the crowd is the backdrop. */
const STAND_TOP = 0
const BOARD_Y = 150
const BOARD_H = 30
const FIELD_TOP = BOARD_Y + BOARD_H
const LAMPS = [150, 375, 585, 810]

/** Visible canvas height. Wide phones crop the top of the stands so the pitch fills the screen edge to edge. */
let VIEW_H = H
export function setViewHeight(h: number) {
  VIEW_H = h
}
/** How far the world is shifted up so the cropped part is the top of the stands, never the pitch. */
export const viewShift = () => VIEW_H - H

function rand(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

function canvas(w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

/** Fill for the letterbox bars beside the canvas, so a wide screen continues the stadium instead of showing black. */
export const ARENA_FILL: Record<Sport, string> = {
  futbol: 'linear-gradient(#05080f, #0d1526 27.8%, #07090d 27.8%, #07090d 33.3%, #24692f 33.3%, #3a9446)',
  basket: 'linear-gradient(#0b0806, #1b130d 27.8%, #07090d 27.8%, #07090d 33.3%, #a56a37 33.3%, #c98d52)',
}

/** Ground-plane perspective: things on the far touchline converge toward the centre, the near side spreads out. */
const px = (x: number, y: number) => W / 2 + (x - W / 2) * (1 + (0.28 * (y - GROUND)) / (H - FIELD_TOP))

type CrowdRow = { idle: HTMLCanvasElement; cheer: HTMLCanvasElement; y: number; h: number }
export type ArenaArt = { back: HTMLCanvasElement; rows: CrowdRow[]; glow: HTMLCanvasElement; pitch: HTMLCanvasElement; vignette: HTMLCanvasElement }

const SKIN = ['#f1c9a5', '#e0ac7e', '#c68a5a', '#8d5a3b', '#5e3b26']

function paintCrowdRow(width: number, rh: number, seed: number, cheer: boolean, sport: Sport): HTMLCanvasElement {
  const head = 14
  const c = canvas(width, rh + head)
  const ctx = c.getContext('2d')!
  const r = rand(seed)
  const step = rh * 0.62
  const homeKit = [TEAM.home.jersey, TEAM.home.jersey, '#14171f', TEAM.home.jersey, '#f2f2f2']
  const awayKit = [TEAM.away.jersey, TEAM.away.jersey, '#f2f2f2', '#0f2a56', TEAM.away.jersey]
  const neutral = sport === 'basket' ? ['#e8742a', '#7c2d12'] : ['#d64545', '#3a3f4b']
  for (let x = step / 2; x < width; x += step) {
    if (r() < 0.07) continue
    const homeSide = x < width / 2
    const own = r() < 0.78
    const pool = r() < 0.12 ? neutral : homeSide === own ? homeKit : awayKit
    const shirt = pool[Math.floor(r() * pool.length)]
    const skin = SKIN[Math.floor(r() * SKIN.length)]
    const cx = x + (r() - 0.5) * step * 0.3
    const base = head + rh
    const bw = rh * 0.52
    const bh = rh * 0.6
    const hr = rh * 0.19
    const hy = base - bh - hr * 0.7
    if (cheer) {
      // Arms up; some hold a scarf stretched between the hands.
      ctx.strokeStyle = skin
      ctx.lineWidth = Math.max(2, rh * 0.12)
      ctx.lineCap = 'round'
      const spread = bw * 0.75
      ctx.beginPath()
      ctx.moveTo(cx - bw * 0.4, base - bh + 3)
      ctx.lineTo(cx - spread, hy - hr * 1.6)
      ctx.moveTo(cx + bw * 0.4, base - bh + 3)
      ctx.lineTo(cx + spread, hy - hr * 1.6)
      ctx.stroke()
      if (r() < 0.3) {
        ctx.fillStyle = homeSide ? GOLD : TEAM.away.jersey
        ctx.fillRect(cx - spread, hy - hr * 1.9, spread * 2, rh * 0.16)
        ctx.fillStyle = homeSide ? INK : '#ffffff'
        ctx.fillRect(cx - spread, hy - hr * 1.9 + rh * 0.05, spread * 2, rh * 0.05)
      }
    }
    ctx.fillStyle = shirt
    ctx.beginPath()
    ctx.roundRect(cx - bw / 2, base - bh, bw, bh + 2, [bw * 0.45, bw * 0.45, 0, 0])
    ctx.fill()
    ctx.fillStyle = skin
    ctx.beginPath()
    ctx.arc(cx, hy, hr, 0, Math.PI * 2)
    ctx.fill()
    if (r() < 0.35) {
      // Hair or a beanie in the team colour.
      ctx.fillStyle = r() < 0.4 ? shirt : '#1c140f'
      ctx.beginPath()
      ctx.arc(cx, hy - hr * 0.15, hr, Math.PI, 0)
      ctx.fill()
    }
  }
  return c
}

/** Everything static is painted once per match; only the crowd bob, flags, LED boards and flashes animate per frame. */
export function paintArena(sport: Sport): ArenaArt {
  const futbol = sport === 'futbol'
  const back = canvas(W, H)
  const b = back.getContext('2d')!

  const sky = b.createLinearGradient(0, 0, 0, BOARD_Y)
  sky.addColorStop(0, futbol ? '#04070e' : '#0a0705')
  sky.addColorStop(1, futbol ? '#121c30' : '#22170f')
  b.fillStyle = sky
  b.fillRect(0, 0, W, BOARD_Y)

  // Concrete tiers behind the fans so the bobbing crowd never reveals the sky. Rows grow toward the pitch for depth.
  const rows: CrowdRow[] = []
  let y = STAND_TOP + 2
  for (let i = 0; i < 10; i++) {
    const h = Math.round(11 + i * 0.8)
    rows.push({ idle: paintCrowdRow(W, h, 31 + i * 7 + (futbol ? 0 : 100), false, sport), cheer: paintCrowdRow(W, h, 31 + i * 7 + (futbol ? 0 : 100), true, sport), y, h })
    b.fillStyle = i % 2 ? '#141a26' : '#10151f'
    if (!futbol) b.fillStyle = i % 2 ? '#1f1711' : '#19120d'
    b.fillRect(0, y, W, h)
    b.fillStyle = 'rgba(255,255,255,0.05)'
    b.fillRect(0, y + h - 2, W, 2)
    y += h
  }
  // Tunnel/stair aisles split the stand into blocks.
  b.fillStyle = futbol ? '#0a0e16' : '#120c08'
  for (const ax of [240, 480, 720]) b.fillRect(ax - 7, STAND_TOP, 14, BOARD_Y - STAND_TOP)

  const glow = canvas(W, H)
  const g = glow.getContext('2d')!
  for (const lx of LAMPS) {
    const beam = g.createLinearGradient(0, 0, 0, GROUND)
    beam.addColorStop(0, 'rgba(255,246,220,0.12)')
    beam.addColorStop(1, 'rgba(255,246,220,0)')
    g.fillStyle = beam
    g.beginPath()
    g.moveTo(lx - 30, 0)
    g.lineTo(lx + 30, 0)
    g.lineTo(lx + 200, GROUND)
    g.lineTo(lx - 200, GROUND)
    g.closePath()
    g.fill()
  }

  const pitch = canvas(W, H)
  const p = pitch.getContext('2d')!
  if (futbol) paintGrass(p)
  else paintCourt(p)

  const vignette = canvas(W, H)
  const v = vignette.getContext('2d')!
  const vg = v.createRadialGradient(W / 2, H * 0.6, H * 0.35, W / 2, H * 0.6, W * 0.72)
  vg.addColorStop(0, 'rgba(0,0,0,0)')
  vg.addColorStop(1, 'rgba(0,0,0,0.4)')
  v.fillStyle = vg
  v.fillRect(0, 0, W, H)

  return { back, rows, glow, pitch, vignette }
}

function strokePath(ctx: CanvasRenderingContext2D, pts: [number, number][], close = false) {
  ctx.beginPath()
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
  if (close) ctx.closePath()
  ctx.stroke()
}

function paintGrass(ctx: CanvasRenderingContext2D) {
  const base = ctx.createLinearGradient(0, FIELD_TOP, 0, H)
  base.addColorStop(0, '#256b30')
  base.addColorStop(1, '#3a9446')
  ctx.fillStyle = base
  ctx.fillRect(0, FIELD_TOP, W, H - FIELD_TOP)
  // Mowing stripes follow the ground perspective: light and dark bands, like a freshly cut match pitch.
  const stripe = 80
  for (let i = -3; i < W / stripe + 3; i++) {
    const x0 = i * stripe
    ctx.fillStyle = i % 2 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.09)'
    ctx.beginPath()
    ctx.moveTo(px(x0, FIELD_TOP), FIELD_TOP)
    ctx.lineTo(px(x0 + stripe, FIELD_TOP), FIELD_TOP)
    ctx.lineTo(px(x0 + stripe, H), H)
    ctx.lineTo(px(x0, H), H)
    ctx.fill()
  }
  // Floodlight pools on the grass under each light bank.
  for (const lx of LAMPS) {
    const pool = ctx.createRadialGradient(lx, 410, 10, lx, 410, 230)
    pool.addColorStop(0, 'rgba(255,250,225,0.13)')
    pool.addColorStop(1, 'rgba(255,250,225,0)')
    ctx.fillStyle = pool
    ctx.fillRect(lx - 230, FIELD_TOP, 460, H - FIELD_TOP)
  }
  // Fine grass grain so the pitch is not a flat fill.
  const grain = rand(7)
  for (let i = 0; i < 2600; i++) {
    ctx.fillStyle = grain() < 0.5 ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.05)'
    ctx.fillRect(grain() * W, FIELD_TOP + grain() * (H - FIELD_TOP), 1.5, 2.5)
  }
  const far = FIELD_TOP + 10
  ctx.strokeStyle = 'rgba(255,255,255,0.82)'
  ctx.lineWidth = 2.5
  ctx.lineJoin = 'round'
  strokePath(ctx, [
    [px(GOAL_DEPTH, far), far],
    [px(W - GOAL_DEPTH, far), far],
  ])
  strokePath(ctx, [
    [W / 2, far],
    [W / 2, H],
  ])
  // Every marking is centred on the GROUND row — the line the goals stand on and the players run along —
  // so the goal mouth sits in the middle of its box and kick-off happens on the centre spot.
  ctx.beginPath()
  ctx.ellipse(W / 2, GROUND, 150, 68, 0, 0, Math.PI * 2)
  ctx.stroke()
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.beginPath()
  ctx.ellipse(W / 2, GROUND, 5, 2.5, 0, 0, Math.PI * 2)
  ctx.fill()
  for (const side of [0, 1] as const) {
    const m = (x: number) => (side === 0 ? x : W - x)
    strokePath(ctx, [
      [px(m(GOAL_DEPTH), far), far],
      [px(m(GOAL_DEPTH), H), H],
    ])
    const box = (d: number, half: number) => {
      const y0 = GROUND - half
      const y1 = GROUND + half * 0.45
      strokePath(ctx, [
        [px(m(GOAL_DEPTH), y0), y0],
        [px(m(GOAL_DEPTH + d), y0), y0],
        [px(m(GOAL_DEPTH + d), y1), y1],
        [px(m(GOAL_DEPTH), y1), y1],
      ])
    }
    box(170, 150)
    box(66, 62)
    ctx.beginPath()
    ctx.ellipse(m(GOAL_DEPTH + 120), GROUND, 4, 2, 0, 0, Math.PI * 2)
    ctx.fill()
    // Penalty arc ("D") outside the big box, on the ground plane.
    ctx.beginPath()
    for (let i = 0; i <= 16; i++) {
      const a = -0.92 + (i / 16) * 1.84
      const wx = m(GOAL_DEPTH + 120 + Math.cos(a) * 82)
      const yy = GROUND + Math.sin(a) * 52 * (a > 0 ? 0.45 : 1)
      if (Math.cos(a) * 82 + 120 < 172) continue
      const x = px(wx, yy)
      ctx.lineTo(x, yy)
    }
    ctx.stroke()
  }
  const shade = ctx.createLinearGradient(0, FIELD_TOP, 0, FIELD_TOP + 28)
  shade.addColorStop(0, 'rgba(0,0,0,0.45)')
  shade.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = shade
  ctx.fillRect(0, FIELD_TOP, W, 28)
  ctx.fillStyle = 'rgba(255,255,255,0.09)'
  ctx.font = '900 40px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText('ALKANKA', W / 2, H - 12)
}

function paintCourt(ctx: CanvasRenderingContext2D) {
  const base = ctx.createLinearGradient(0, FIELD_TOP, 0, H)
  base.addColorStop(0, '#a56a37')
  base.addColorStop(1, '#c98d52')
  ctx.fillStyle = base
  ctx.fillRect(0, FIELD_TOP, W, H - FIELD_TOP)
  ctx.strokeStyle = 'rgba(60,30,10,0.16)'
  ctx.lineWidth = 1
  for (let x = -64; x < W + 64; x += 30)
    strokePath(ctx, [
      [px(x, FIELD_TOP), FIELD_TOP],
      [px(x, H), H],
    ])
  const sheen = ctx.createRadialGradient(W / 2, 430, 10, W / 2, 430, 420)
  sheen.addColorStop(0, 'rgba(255,238,205,0.22)')
  sheen.addColorStop(1, 'rgba(255,238,205,0)')
  ctx.fillStyle = sheen
  ctx.fillRect(0, FIELD_TOP, W, H - FIELD_TOP)

  const far = FIELD_TOP + 12
  const hoopL = BOARD_X + 8 + RIM_W / 2
  for (const side of [0, 1] as const) {
    const m = (x: number) => (side === 0 ? x : W - x)
    const color = side === 0 ? TEAM.away.jersey : TEAM.home.jersey
    ctx.fillStyle = side === 0 ? 'rgba(15,42,86,0.55)' : 'rgba(150,100,20,0.5)'
    ctx.beginPath()
    ctx.moveTo(px(m(12), 300), 300)
    ctx.lineTo(px(m(210), 300), 300)
    ctx.lineTo(px(m(210), 526), 526)
    ctx.lineTo(px(m(12), 526), 526)
    ctx.fill()
    // Three-point arc on the floor plane, crossing the physics line exactly at the ground row.
    ctx.strokeStyle = color
    ctx.lineWidth = 3
    const pts: [number, number][] = []
    for (let i = 0; i <= 24; i++) {
      const a = -Math.PI / 2 + (i / 24) * Math.PI
      const wx = m(hoopL + Math.cos(a) * THREE_DIST)
      const yy = GROUND + Math.sin(a) * (a < 0 ? 132 : 54)
      pts.push([px(wx, yy), yy])
    }
    strokePath(ctx, pts)
    ctx.fillStyle = color
    ctx.font = '900 16px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('3', px(m(hoopL + THREE_DIST + 18), GROUND - 4), GROUND - 4)
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'
  ctx.lineWidth = 2.5
  strokePath(ctx, [
    [px(12, far), far],
    [px(W - 12, far), far],
  ])
  strokePath(ctx, [
    [W / 2, far],
    [W / 2, H],
  ])
  ctx.beginPath()
  ctx.ellipse(W / 2, 400, 96, 46, 0, 0, Math.PI * 2)
  ctx.stroke()
  const shade = ctx.createLinearGradient(0, FIELD_TOP, 0, FIELD_TOP + 24)
  shade.addColorStop(0, 'rgba(0,0,0,0.45)')
  shade.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = shade
  ctx.fillRect(0, FIELD_TOP, W, 24)
  ctx.fillStyle = 'rgba(255,255,255,0.1)'
  ctx.font = '900 40px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText('ALKANKA', W / 2, H - 12)
}

const BOARD_LABELS = ['ALKANKA', 'KANKA COIN', 'JAKO', 'ALKANKA ARENA'] as const

/**
 * Draws the living stadium. excite 0..1 drives how hard the crowd bounces, whether they raise their arms,
 * flag waving and camera flashes; goalSeat turns the LED ribbon into a goal celebration in the scorer's colour.
 */
export function drawArena(ctx: CanvasRenderingContext2D, art: ArenaArt, sport: Sport, frame: number, excite: number, goalSeat: number) {
  ctx.drawImage(art.back, 0, 0)

  const segs = 24
  const segW = W / segs
  // A Mexican wave rolls around the stand all match long; it runs faster when the crowd is excited.
  const span = W + 500
  const waveX = ((frame * (3 + excite * 4)) % span) - 250
  art.rows.forEach((row, i) => {
    const rh = row.h + 14
    for (let s = 0; s < segs; s++) {
      const phase = i * 1.3 + s * 2.1
      const amp = (0.8 + excite * 5) * (row.h / 18)
      const waveK = Math.max(0, 1 - Math.abs(s * segW + segW / 2 - waveX) / 110)
      const bob = -Math.max(0, Math.sin(frame * (0.09 + excite * 0.1) + phase)) * amp - waveK * row.h * 0.8
      const cheering = waveK > 0.35 || excite > 0.85 || (excite > 0.5 && (s + i) % 3 !== 0)
      ctx.drawImage(cheering ? row.cheer : row.idle, s * segW, 0, segW, rh, s * segW, row.y - 14 + bob, segW, rh)
    }
  })
  // Flags waving in the lower tiers, team-coloured per end.
  const flags = [90, 300, 420, 540, 660, 870]
  flags.forEach((fx0, i) => {
    const home = fx0 < W / 2
    const top = 46 + (i % 3) * 26
    const fw = 36
    const fh = 21
    ctx.strokeStyle = '#c9ced6'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(fx0, top)
    ctx.lineTo(fx0, top + 50)
    ctx.stroke()
    const speed = 0.12 + excite * 0.15
    const wave = (k: number) => Math.sin(frame * speed + i + k * 0.9) * (2 + excite * 4) * (k / 6)
    ctx.fillStyle = home ? GOLD : TEAM.away.jersey
    ctx.beginPath()
    ctx.moveTo(fx0, top)
    for (let k = 1; k <= 6; k++) ctx.lineTo(fx0 + (fw * k) / 6, top + wave(k))
    for (let k = 6; k >= 0; k--) ctx.lineTo(fx0 + (fw * k) / 6, top + fh + wave(k))
    ctx.fill()
    ctx.fillStyle = home ? INK : '#ffffff'
    ctx.beginPath()
    ctx.moveTo(fx0, top + fh * 0.4)
    for (let k = 1; k <= 6; k++) ctx.lineTo(fx0 + (fw * k) / 6, top + fh * 0.4 + wave(k))
    for (let k = 6; k >= 0; k--) ctx.lineTo(fx0 + (fw * k) / 6, top + fh * 0.6 + wave(k))
    ctx.fill()
  })
  // Keep the stands a touch darker than the pitch so the ball and players always pop.
  // Depth: the back rows fade into the dark, the front rows catch the floodlights.
  const depth = ctx.createLinearGradient(0, STAND_TOP, 0, BOARD_Y)
  depth.addColorStop(0, sport === 'basket' ? 'rgba(8,5,3,0.62)' : 'rgba(3,6,14,0.62)')
  depth.addColorStop(1, sport === 'basket' ? 'rgba(8,5,3,0.1)' : 'rgba(3,6,14,0.08)')
  ctx.fillStyle = depth
  ctx.fillRect(0, STAND_TOP, W, BOARD_Y - STAND_TOP)
  if (excite > 0.35) {
    const n = Math.floor(excite * 5)
    for (let i = 0; i < n; i++) {
      if (Math.random() > 0.5) continue
      const fx0 = Math.random() * W
      const fy = STAND_TOP + 8 + Math.random() * (BOARD_Y - STAND_TOP - 16)
      const f = ctx.createRadialGradient(fx0, fy, 0, fx0, fy, 9)
      f.addColorStop(0, 'rgba(255,255,255,0.95)')
      f.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = f
      ctx.fillRect(fx0 - 9, fy - 9, 18, 18)
    }
  }
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ctx.drawImage(art.glow, 0, 0)
  ctx.restore()

  drawBoards(ctx, frame, goalSeat, sport)
  ctx.drawImage(art.pitch, 0, 0)
}

function drawBoards(ctx: CanvasRenderingContext2D, frame: number, goalSeat: number, sport: Sport) {
  ctx.fillStyle = '#050609'
  ctx.fillRect(0, BOARD_Y, W, BOARD_H)
  ctx.font = '900 16px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const pw = 160
  if (goalSeat >= 0) {
    const kit = goalSeat === 0 ? TEAM.home : TEAM.away
    const blink = Math.floor(frame / 6) % 2 === 0
    const word = sport === 'futbol' ? 'GOOOOL' : 'BASKET'
    const off = (frame * 4) % pw
    for (let x = -off; x < W; x += pw) {
      ctx.fillStyle = blink ? kit.jersey : '#ffffff'
      ctx.fillRect(x + 2, BOARD_Y + 3, pw - 4, BOARD_H - 6)
      ctx.fillStyle = blink ? kit.trim === '#ffffff' ? '#ffffff' : INK : kit.jersey
      ctx.fillText(word, x + pw / 2, BOARD_Y + BOARD_H / 2 + 1)
    }
  } else {
    const off = frame * 1.2
    const j0 = Math.floor(off / pw)
    for (let j = j0; j * pw - off < W; j++) {
      const x = j * pw - off
      const k = ((j % BOARD_LABELS.length) + BOARD_LABELS.length) % BOARD_LABELS.length
      const gold = k % 2 === 0
      ctx.fillStyle = gold ? GOLD : '#11141b'
      ctx.fillRect(x + 2, BOARD_Y + 3, pw - 4, BOARD_H - 6)
      ctx.fillStyle = gold ? INK : GOLD
      ctx.fillText(BOARD_LABELS[k], x + pw / 2, BOARD_Y + BOARD_H / 2 + 1)
    }
  }
  // LED pixel grain and a top highlight sell the screen.
  ctx.fillStyle = 'rgba(0,0,0,0.22)'
  for (let y = BOARD_Y + 4; y < BOARD_Y + BOARD_H - 3; y += 3) ctx.fillRect(0, y, W, 1)
  ctx.fillStyle = 'rgba(255,255,255,0.25)'
  ctx.fillRect(0, BOARD_Y, W, 1.5)
}

/* ------------------------------ goals & hoops ------------------------------ */

export function drawGoalOrHoop(ctx: CanvasRenderingContext2D, w: World, front: boolean, frame: number) {
  if (w.sport === 'futbol') {
    for (const side of [0, 1] as const) drawGoal(ctx, w, side, front, frame)
    return
  }
  for (const side of [0, 1] as const) drawHoop(ctx, w, side, front, frame)
}

/** A goal with depth: the far frame sits up and toward the centre (perspective), the net is a diamond mesh between. */
function drawGoal(ctx: CanvasRenderingContext2D, w: World, side: 0 | 1, front: boolean, frame: number) {
  // The back frame sits just inside the screen edge so the whole goal (back post included) is always visible.
  const wall = side === 0 ? 6 : W - 6
  const postX = side === 0 ? GOAL_DEPTH : W - GOAL_DEPTH
  const dx = side === 0 ? 12 : -12
  const dy = -20
  const s = w.netShake[side]
  const bulge = Math.sin(s * 0.4) * (s / 40) * 10 * (side === 0 ? -1 : 1)
  if (!front) {
    const x0 = Math.min(wall, postX + dx)
    const x1 = Math.max(wall, postX + dx)
    const inside = ctx.createLinearGradient(wall, 0, postX, 0)
    inside.addColorStop(0, 'rgba(0,0,0,0.45)')
    inside.addColorStop(1, 'rgba(0,0,0,0.12)')
    ctx.fillStyle = inside
    ctx.fillRect(x0, GOAL_TOP + dy, x1 - x0, GROUND - GOAL_TOP - dy)
    ctx.save()
    ctx.beginPath()
    ctx.rect(x0, GOAL_TOP + dy, x1 - x0, GROUND - GOAL_TOP - dy)
    ctx.clip()
    ctx.translate(bulge, 0)
    ctx.strokeStyle = 'rgba(255,255,255,0.38)'
    ctx.lineWidth = 1
    const hgt = GROUND - GOAL_TOP - dy
    for (let k = -hgt; k < x1 - x0 + hgt; k += 11) {
      ctx.beginPath()
      ctx.moveTo(x0 + k, GOAL_TOP + dy)
      ctx.lineTo(x0 + k + hgt, GROUND)
      ctx.moveTo(x0 + k + hgt, GOAL_TOP + dy)
      ctx.lineTo(x0 + k, GROUND)
      ctx.stroke()
    }
    ctx.restore()
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#aab2bd'
    ctx.lineWidth = 6
    strokePath(ctx, [
      [wall, GROUND],
      [wall, GOAL_TOP + dy],
      [postX + dx, GOAL_TOP + dy],
      [postX + dx, GROUND + dy],
    ])
    ctx.lineWidth = 3
    strokePath(ctx, [
      [postX + dx, GROUND + dy],
      [postX, GROUND],
    ])
    ctx.lineCap = 'butt'
    return
  }
  // Faint near-side mesh so a ball in the net reads as "inside".
  ctx.strokeStyle = 'rgba(255,255,255,0.13)'
  ctx.lineWidth = 1
  for (let x = Math.min(wall, postX); x <= Math.max(wall, postX); x += 14) {
    ctx.beginPath()
    ctx.moveTo(x + bulge * 0.4, GOAL_TOP)
    ctx.lineTo(x + bulge * 0.4, GROUND)
    ctx.stroke()
  }
  for (let y = GOAL_TOP; y <= GROUND; y += 14) {
    ctx.beginPath()
    ctx.moveTo(wall, y)
    ctx.lineTo(postX, y)
    ctx.stroke()
  }
  ctx.fillStyle = 'rgba(0,0,0,0.35)'
  ctx.beginPath()
  ctx.ellipse(postX, GROUND + 3, 12, 4, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.lineCap = 'round'
  ctx.strokeStyle = '#e8ebef'
  ctx.lineWidth = 7
  strokePath(ctx, [
    [postX, GOAL_TOP],
    [postX + dx, GOAL_TOP + dy],
  ])
  const bar = ctx.createLinearGradient(0, GOAL_TOP - 5, 0, GOAL_TOP + 5)
  bar.addColorStop(0, '#ffffff')
  bar.addColorStop(1, '#b9c0c9')
  ctx.strokeStyle = bar
  ctx.lineWidth = 10
  strokePath(ctx, [
    [wall, GOAL_TOP],
    [postX, GOAL_TOP],
  ])
  const post = ctx.createLinearGradient(postX - 5, 0, postX + 5, 0)
  post.addColorStop(0, '#9aa3ad')
  post.addColorStop(0.45, '#ffffff')
  post.addColorStop(1, '#c3c9d1')
  ctx.strokeStyle = post
  strokePath(ctx, [
    [postX, GOAL_TOP],
    [postX, GROUND + 1],
  ])
  ctx.lineCap = 'butt'
  if (w.p[side].shield > 0) drawShieldWall(ctx, postX - 11, GOAL_TOP + 4, 22, GROUND - GOAL_TOP - 4, w.p[side].shield, frame)
}

function drawHoop(ctx: CanvasRenderingContext2D, w: World, side: 0 | 1, front: boolean, frame: number) {
  const bx = side === 0 ? BOARD_X : W - BOARD_X
  const rim = rimOf(side)
  if (!front) {
    const poleX = side === 0 ? 8 : W - 24
    const pole = ctx.createLinearGradient(poleX, 0, poleX + 16, 0)
    pole.addColorStop(0, '#1d2128')
    pole.addColorStop(0.5, '#4a515d')
    pole.addColorStop(1, '#1d2128')
    ctx.fillStyle = pole
    ctx.fillRect(poleX, RIM_Y - 74, 16, GROUND - RIM_Y + 74)
    ctx.fillStyle = side === 0 ? TEAM.away.jersey : GOLD
    ctx.beginPath()
    ctx.roundRect(poleX - 4, GROUND - 120, 24, 118, 6)
    ctx.fill()
    ctx.fillStyle = '#2b2f36'
    ctx.fillRect(side === 0 ? poleX : bx, RIM_Y - 74, Math.abs(bx - poleX), 8)
    const glass = ctx.createLinearGradient(0, RIM_Y - 116, 0, RIM_Y + 18)
    glass.addColorStop(0, 'rgba(230,240,255,0.5)')
    glass.addColorStop(1, 'rgba(200,220,245,0.2)')
    ctx.fillStyle = glass
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.roundRect(bx - 6, RIM_Y - 116, 12, 134, 3)
    ctx.fill()
    ctx.stroke()
    ctx.strokeStyle = '#e8501f'
    ctx.lineWidth = 3
    ctx.strokeRect(side === 0 ? bx + 6 : bx - 6 - 26, RIM_Y - 44, 26, 30)
    return
  }
  const s = w.netShake[side]
  const sway = Math.sin(s * 0.55) * (s / 40) * 7
  const len = NET_H + s * 0.25
  ctx.strokeStyle = 'rgba(255,255,255,0.92)'
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
  strokePath(ctx, [
    [rim.a, RIM_Y],
    [rim.b, RIM_Y],
  ])
  ctx.strokeStyle = '#ff5a1f'
  ctx.lineWidth = 7
  strokePath(ctx, [
    [rim.a, RIM_Y],
    [rim.b, RIM_Y],
  ])
  ctx.lineCap = 'butt'
  if (w.p[side].shield > 0) drawShieldWall(ctx, rim.a - 10, RIM_Y - 18, RIM_W + 20, 16, w.p[side].shield, frame)
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

const stickers = new WeakMap<HTMLImageElement, HTMLCanvasElement | null>()

/**
 * Turns a portrait on a flat dark backdrop into a cut-out "sticker": the backdrop is flood-filled away from the
 * edges (so dark fur inside the silhouette is kept), then a thick ink outline is drawn around what remains.
 */
function sticker(img: HTMLImageElement): HTMLCanvasElement | null {
  if (stickers.has(img)) return stickers.get(img) ?? null
  if (!img.complete || !img.naturalWidth) return null
  const S = 192
  const pad = 10
  const src = canvas(S, S)
  const sc = src.getContext('2d', { willReadFrequently: true })!
  sc.drawImage(img, 0, 0, S, S)
  let data: ImageData
  try {
    data = sc.getImageData(0, 0, S, S)
  } catch {
    stickers.set(img, null)
    return null
  }
  const d = data.data
  const bg = [d[0], d[1], d[2]]
  const close = (i: number, ref: number[], tol: number) =>
    Math.abs(d[i] - ref[0]) + Math.abs(d[i + 1] - ref[1]) + Math.abs(d[i + 2] - ref[2]) < tol
  const gone = new Uint8Array(S * S)
  const stack: number[] = []
  for (let i = 0; i < S; i++) stack.push(i, (S - 1) * S + i, i * S, i * S + S - 1)
  while (stack.length) {
    const k = stack.pop()!
    if (gone[k]) continue
    const i = k * 4
    // Within a tight band of the backdrop colour, so near-black fur that touches the backdrop survives.
    if (!close(i, bg, 34)) continue
    gone[k] = 1
    const x = k % S
    const y = (k / S) | 0
    if (x > 0) stack.push(k - 1)
    if (x < S - 1) stack.push(k + 1)
    if (y > 0) stack.push(k - S)
    if (y < S - 1) stack.push(k + S)
  }
  for (let k = 0; k < S * S; k++) {
    if (gone[k]) d[k * 4 + 3] = 0
    else {
      // Soften the cut edge by one pixel.
      const x = k % S
      const y = (k / S) | 0
      const edge = (x > 0 && gone[k - 1]) || (x < S - 1 && gone[k + 1]) || (y > 0 && gone[k - S]) || (y < S - 1 && gone[k + S])
      if (edge) d[k * 4 + 3] = 150
    }
  }
  sc.putImageData(data, 0, 0)
  const out = canvas(S + pad * 2, S + pad * 2)
  const oc = out.getContext('2d')!
  const ink = canvas(S, S)
  const ic = ink.getContext('2d')!
  ic.drawImage(src, 0, 0)
  ic.globalCompositeOperation = 'source-in'
  ic.fillStyle = INK
  ic.fillRect(0, 0, S, S)
  for (let a = 0; a < 16; a++) {
    const t = (a / 16) * Math.PI * 2
    oc.drawImage(ink, pad + Math.cos(t) * 5, pad + Math.sin(t) * 5)
  }
  oc.drawImage(src, pad, pad)
  stickers.set(img, out)
  return out
}

export type PlayerLook = {
  kit: Kit
  img?: HTMLImageElement
  /** Extra height for the name tag when the two players stand close, so their tags never overlap. */
  lift?: number
  /** The local player gets a "SEN" tag so it is obvious which body is yours. */
  me: boolean
  label: string
  sport: Sport
  squash: number
  frame: number
  cheer: boolean
  number: number
}

export function drawPlayer(ctx: CanvasRenderingContext2D, p: Player, o: PlayerLook) {
  const { kit, frame } = o
  const feet = p.y + FOOT
  const air = GROUND - feet
  const grounded = onGround(p)
  const shadowW = 40 * Math.max(0.45, 1 - air / 260)
  ctx.fillStyle = 'rgba(0,0,0,0.38)'
  ctx.beginPath()
  ctx.ellipse(p.x, GROUND + 4, shadowW, 7, 0, 0, Math.PI * 2)
  ctx.fill()

  ctx.save()
  // Squash on landing, stretch while launching: anchored at the feet so the player never sinks into the pitch.
  ctx.translate(p.x, feet)
  ctx.scale(1 + o.squash * 0.16, 1 - o.squash * 0.16)
  ctx.translate(-p.x, -feet)

  const moving = grounded && Math.abs(p.vx) > 0.5
  const bob = !grounded ? 0 : moving ? -Math.abs(Math.sin(p.run)) * 2.4 : Math.sin(frame * 0.08 + p.ch * 1.7) * 1.3
  const f = p.face
  const hipY = p.y + HEAD_R + 12 + bob * 0.4
  const legLen = feet - hipY
  const kicking = p.kick > 5
  const charging = p.charge > 3
  const swing = kicking ? Math.sin(((16 - p.kick) / 11) * Math.PI) * 2.1 : charging ? -0.9 * (p.charge / CHARGE_MAX) : 0
  const stride = moving ? Math.sin(p.run) * 0.85 : !grounded ? 0.5 : 0

  const drawLeg = (angle: number, back: boolean) => {
    ctx.save()
    ctx.translate(p.x + (back ? -f * 5 : f * 5), hipY)
    ctx.rotate(angle * f)
    ctx.fillStyle = back ? '#c79b72' : '#e2b98f'
    ctx.fillRect(-3.5, 0, 7, legLen - 6)
    ctx.fillStyle = back ? kit.shorts : kit.jersey
    ctx.fillRect(-4, legLen - 12, 8, 7)
    // Oversized boot, toe pointing where the player faces.
    ctx.save()
    ctx.scale(f, 1)
    ctx.fillStyle = kit.boot
    ctx.strokeStyle = INK
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.roundRect(-8, legLen - 7, 25, 11, [4, 7, 5, 4])
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = INK
    ctx.fillRect(-8, legLen + 2, 25, 2)
    ctx.fillStyle = kit.boot === '#ffffff' ? TEAM.away.jersey : INK
    ctx.fillRect(1, legLen - 5, 2, 5)
    ctx.fillRect(6, legLen - 5, 2, 5)
    ctx.restore()
    ctx.restore()
  }
  drawLeg(-stride, true)

  const torsoTop = p.y + HEAD_R - 12 + bob
  const shoulderY = torsoTop + 6
  const armAngle = o.cheer ? -2.5 + Math.sin(frame * 0.3) * 0.25 : moving ? Math.sin(p.run + Math.PI) * 0.5 : !grounded ? -1.2 : 0.25
  const drawArm = (sideSign: number, angle: number) => {
    ctx.save()
    ctx.translate(p.x + sideSign * 14, shoulderY)
    ctx.rotate(angle * sideSign)
    ctx.fillStyle = kit.jersey
    ctx.strokeStyle = INK
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.roundRect(-3.5, -2, 7, 9, 3)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#e2b98f'
    ctx.beginPath()
    ctx.roundRect(-3, 6, 6, 9, 3)
    ctx.fill()
    ctx.restore()
  }
  drawArm(-f, o.cheer ? armAngle : -armAngle)

  ctx.fillStyle = kit.shorts
  ctx.strokeStyle = INK
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.roundRect(p.x - 14, p.y + HEAD_R + 5 + bob * 0.6, 28, 11, [2, 2, 4, 4])
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = kit.jersey
  ctx.beginPath()
  ctx.moveTo(p.x - 16, torsoTop + 4)
  ctx.quadraticCurveTo(p.x, torsoTop - 4, p.x + 16, torsoTop + 4)
  ctx.lineTo(p.x + 13, p.y + HEAD_R + 9 + bob)
  ctx.lineTo(p.x - 13, p.y + HEAD_R + 9 + bob)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = kit.trim
  ctx.fillRect(p.x - 13.5, p.y + HEAD_R + 5 + bob, 27, 2.5)
  ctx.font = '900 10px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = kit.trim
  ctx.fillText(String(o.number), p.x, torsoTop + 11)

  drawLeg(kicking || charging ? -swing : stride, false)
  drawArm(f, o.cheer ? armAngle : armAngle)

  const r = headR(p)
  const hy = headY(p) + bob
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

  const cut = o.img ? sticker(o.img) : null
  if (cut) {
    // Big cut-out head, no badge circle: the portrait itself is the character.
    ctx.save()
    ctx.translate(p.x, hy)
    if (charAt(p.ch).facesLeft ? f === 1 : f === -1) ctx.scale(-1, 1)
    const size = r * 2.75
    ctx.drawImage(cut, -size / 2, -size * 0.52, size, size)
    ctx.restore()
    if (p.shrink > 0) {
      ctx.strokeStyle = '#c4a1ff'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.arc(p.x, hy, r + 6, 0, Math.PI * 2)
      ctx.stroke()
    }
  } else {
    ctx.save()
    ctx.beginPath()
    ctx.arc(p.x, hy, r, 0, Math.PI * 2)
    ctx.fillStyle = '#20232b'
    ctx.fill()
    ctx.lineWidth = 5
    ctx.strokeStyle = INK
    ctx.stroke()
    ctx.restore()
  }
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
    ctx.restore()
  }
  if (p.stun > 0) {
    for (let i = 0; i < 3; i++) {
      const a = frame * 0.18 + (i * Math.PI * 2) / 3
      drawStar(ctx, p.x + Math.cos(a) * (r + 6), hy - r - 4 + Math.sin(a) * 6, 6)
    }
  }

  // Ownership marker: a team-coloured pointer, plus a bold "SEN" tag on your own player.
  const my = hy - r - 18 - (o.lift ?? 0)
  ctx.fillStyle = kit.jersey
  ctx.strokeStyle = INK
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(p.x - 8, my - 10)
  ctx.lineTo(p.x + 8, my - 10)
  ctx.lineTo(p.x, my)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  ctx.font = o.me ? '900 18px sans-serif' : '800 16px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const tag = o.me ? 'SEN' : o.label.slice(0, 12)
  const tw = ctx.measureText(tag).width + 20
  const ty = my - 36
  ctx.fillStyle = o.me ? kit.jersey : 'rgba(8,10,14,0.85)'
  ctx.strokeStyle = o.me ? INK : kit.jersey
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.roundRect(p.x - tw / 2, ty, tw, 26, 13)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = o.me ? (kit.jersey === GOLD ? INK : '#ffffff') : '#ffffff'
  ctx.fillText(tag, p.x, ty + 14)

  if (charging) {
    const bw = 70
    const fill = Math.min(1, p.charge / CHARGE_MAX)
    const by = ty - 14
    ctx.fillStyle = 'rgba(0,0,0,0.7)'
    ctx.beginPath()
    ctx.roundRect(p.x - bw / 2 - 2, by - 2, bw + 4, 11, 5.5)
    ctx.fill()
    const g = ctx.createLinearGradient(p.x - bw / 2, 0, p.x + bw / 2, 0)
    g.addColorStop(0, GOLD)
    g.addColorStop(1, '#ff5a3c')
    ctx.fillStyle = fill >= 1 ? '#ff5a3c' : g
    ctx.beginPath()
    ctx.roundRect(p.x - bw / 2, by, Math.max(7, bw * fill), 7, 3.5)
    ctx.fill()
    if (fill >= 1) {
      ctx.font = '900 12px sans-serif'
      ctx.lineWidth = 3
      ctx.strokeStyle = INK
      ctx.strokeText('GÜÇLÜ ŞUT', p.x, by - 9)
      ctx.fillStyle = '#ffffff'
      ctx.fillText('GÜÇLÜ ŞUT', p.x, by - 9)
    }
  }
  if (p.camp > 90 && p.camp < CAMP_LIMIT) {
    ctx.font = '900 14px sans-serif'
    ctx.lineWidth = 4
    ctx.strokeStyle = '#111'
    const warn = `${o.sport === 'futbol' ? 'KALEDEN' : 'POTADAN'} ÇIK ${Math.ceil((CAMP_LIMIT - p.camp) / 60)}`
    ctx.strokeText(warn, p.x, ty - 26)
    ctx.fillStyle = '#ff6b5a'
    ctx.fillText(warn, p.x, ty - 26)
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
  ctx.fillStyle = 'rgba(0,0,0,0.32)'
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
  ctx.strokeStyle = INK
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.stroke()
  ctx.strokeStyle = ring
  ctx.lineWidth = 2
  ctx.stroke()
}

/** Power meter as a ring that fills around the HUD portrait (no percentages); it pulses once the power is ready. */
function meterRing(ctx: CanvasRenderingContext2D, p: Player, x: number, y: number, r: number, frame: number) {
  const id = charAt(p.ch).power
  const fill = Math.min(1, p.meter / METER_MAX)
  const ready = fill >= 1 || p.armed
  const color = POWERS[id].color
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineWidth = 5
  ctx.strokeStyle = 'rgba(5,6,9,0.85)'
  ctx.beginPath()
  ctx.arc(x, y, r + 5, 0, Math.PI * 2)
  ctx.stroke()
  if (ready) {
    ctx.shadowColor = color
    ctx.shadowBlur = 12 + 8 * Math.sin(frame * 0.25)
  }
  ctx.strokeStyle = color
  ctx.beginPath()
  ctx.arc(x, y, r + 5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0.02, fill))
  ctx.stroke()
  ctx.restore()
}

/** Readable "power ready" pill hanging under the scoreboard, only shown when it actually matters. */
function readyPill(ctx: CanvasRenderingContext2D, p: Player, x: number, y: number, frame: number) {
  const id = charAt(p.ch).power
  const ready = p.meter >= METER_MAX || p.armed
  if (!ready) return
  const color = POWERS[id].color
  const text = `${POWERS[id].name.toUpperCase()} ${p.armed ? 'YÜKLÜ' : 'HAZIR'}`
  ctx.save()
  ctx.font = '900 15px sans-serif'
  const tw = ctx.measureText(text).width + 26
  ctx.globalAlpha = 0.85 + 0.15 * Math.sin(frame * 0.25)
  ctx.fillStyle = color
  ctx.strokeStyle = INK
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.roundRect(x - tw / 2, y, tw, 26, 13)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = INK
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, x, y + 14)
  ctx.restore()
}

/** Broadcast-style scoreboard: team blocks in kit colours, a central clock, power meters hanging underneath. */
export function drawHud(ctx: CanvasRenderingContext2D, w: World, names: [string, string], imgs: HTMLImageElement[], frame: number) {
  const blockW = 214
  const scoreW = 50
  const clockW = 86
  const total = blockW * 2 + scoreW * 2 + clockW
  const x = W / 2 - total / 2
  const y = 8
  const h = 46

  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.5)'
  ctx.shadowBlur = 12
  ctx.shadowOffsetY = 3
  ctx.fillStyle = INK
  ctx.beginPath()
  ctx.roundRect(x - 3, y - 3, total + 6, h + 6, 12)
  ctx.fill()
  ctx.restore()

  const block = (seat: 0 | 1) => {
    const kit = seat === 0 ? TEAM.home : TEAM.away
    const bx = seat === 0 ? x : x + total - blockW
    const g = ctx.createLinearGradient(0, y, 0, y + h)
    g.addColorStop(0, kit.jersey)
    g.addColorStop(1, seat === 0 ? '#b88d22' : '#1f4f9e')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.roundRect(bx, y, blockW, h, seat === 0 ? [10, 0, 0, 10] : [0, 10, 10, 0])
    ctx.fill()
    const p = w.p[seat]
    const px0 = seat === 0 ? bx + 28 : bx + blockW - 28
    portrait(ctx, imgs[p.ch], px0, y + h / 2, 17, '#ffffff', seat === 0 ? charAt(p.ch).facesLeft : !charAt(p.ch).facesLeft)
    meterRing(ctx, p, px0, y + h / 2, 17, frame)
    const tx = seat === 0 ? bx + 54 : bx + blockW - 54
    const dark = seat === 0
    ctx.textAlign = seat === 0 ? 'left' : 'right'
    ctx.textBaseline = 'middle'
    ctx.font = '900 15px sans-serif'
    ctx.fillStyle = dark ? INK : '#ffffff'
    ctx.fillText(names[seat].slice(0, 12).toUpperCase(), tx, y + 18)
    ctx.font = '700 10px sans-serif'
    ctx.fillStyle = dark ? 'rgba(11,13,18,0.7)' : 'rgba(255,255,255,0.75)'
    ctx.fillText(charAt(p.ch).title.toUpperCase(), tx, y + 33)
    const sx = seat === 0 ? x + blockW : x + blockW + scoreW + clockW
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(sx, y, scoreW, h)
    ctx.fillStyle = INK
    ctx.font = '900 30px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(String(w.sc[seat]), sx + scoreW / 2, y + h / 2 + 2)
    readyPill(ctx, p, seat === 0 ? bx + blockW / 2 : bx + blockW / 2, y + h + 8, frame)
  }
  block(0)
  block(1)

  const cx = x + blockW + scoreW
  ctx.fillStyle = INK
  ctx.fillRect(cx, y, clockW, h)
  const left = timeLeft(w)
  const ot = w.overtime
  const urgent = ot || left <= 10
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = '800 21px monospace'
  ctx.fillStyle = urgent && Math.floor(frame / 20) % 2 === 0 ? '#ff6b5a' : '#ffffff'
  ctx.fillText(`${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`, cx + clockW / 2, y + 19)
  ctx.font = '800 9px sans-serif'
  ctx.fillStyle = ot ? '#ff6b5a' : GOLD
  ctx.fillText(ot ? 'ALTIN GOL' : 'ALKANKA LİG', cx + clockW / 2, y + 36)
}

/** Goal / basket splash: a team-coloured band sweeps across with the word and the scorer's name. */
export function drawFlash(ctx: CanvasRenderingContext2D, text: string, t: number, seat = -1, sub = '') {
  const k = Math.min(1, t / 10)
  const scale = 0.5 + 0.6 * k - 0.1 * Math.max(0, (t - 12) / 50)
  const fade = t > 65 ? Math.max(0, 1 - (t - 65) / 15) : 1
  ctx.save()
  ctx.globalAlpha = fade
  // A thin strip over the stands, so the pitch (and the ball in the net) stays visible during the celebration.
  const bandY = 112
  if (seat >= 0) {
    const kit = seat === 0 ? TEAM.home : TEAM.away
    const sweep = Math.min(1, t / 8)
    ctx.save()
    ctx.translate(W / 2, bandY)
    ctx.fillStyle = 'rgba(5,6,9,0.8)'
    ctx.fillRect((-W / 2) * sweep, -34, W * sweep, 68)
    ctx.fillStyle = kit.jersey
    ctx.fillRect((-W / 2) * sweep, -34, W * sweep, 4)
    ctx.fillRect((-W / 2) * sweep, 30, W * sweep, 4)
    ctx.restore()
  }
  ctx.translate(W / 2, bandY)
  ctx.scale(scale, scale)
  ctx.font = '900 54px sans-serif'
  ctx.textAlign = sub ? 'right' : 'center'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  ctx.lineWidth = 10
  ctx.strokeStyle = '#111'
  const tx = sub ? -8 : 0
  ctx.strokeText(text, tx, 2)
  const g = ctx.createLinearGradient(0, -27, 0, 27)
  g.addColorStop(0, '#fff3c4')
  g.addColorStop(0.5, GOLD)
  g.addColorStop(1, '#b8860b')
  ctx.fillStyle = g
  ctx.fillText(text, tx, 2)
  if (sub) {
    ctx.font = '900 24px sans-serif'
    ctx.textAlign = 'left'
    ctx.lineWidth = 6
    ctx.strokeText(sub.toUpperCase(), 8, 4)
    ctx.fillStyle = '#ffffff'
    ctx.fillText(sub.toUpperCase(), 8, 4)
  }
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
  // Power call-outs float above the player who used it; match-wide notices (overtime) stay centred.
  if (w.bannerSeat === 0 || w.bannerSeat === 1) {
    const p = w.p[w.bannerSeat]
    const bx = Math.min(W - tw / 2 - 8, Math.max(tw / 2 + 8, p.x))
    const by = Math.max(FIELD_TOP - 40, headY(p) - headR(p) - 110) - (90 - Math.min(90, t)) * 0.3
    ctx.fillStyle = color
    ctx.strokeStyle = INK
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.roundRect(bx - tw / 2, by, tw, 36, 18)
    ctx.fill()
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(bx - 8, by + 36)
    ctx.lineTo(bx + 8, by + 36)
    ctx.lineTo(Math.min(W - 8, Math.max(8, p.x)), by + 48)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = color === GOLD || color === TEAM.home.jersey ? INK : '#ffffff'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(w.banner.toUpperCase(), bx, by + 19)
    ctx.restore()
    return
  }
  const by = 118 + (H - VIEW_H)
  ctx.fillStyle = 'rgba(8,10,14,0.88)'
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
  ctx.translate(W / 2, VIEW_H / 2 + 10)
  ctx.fillStyle = 'rgba(5,6,9,0.6)'
  ctx.beginPath()
  ctx.arc(0, 0, 86, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = GOLD
  ctx.lineWidth = 5
  ctx.beginPath()
  ctx.arc(0, 0, 86, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k)
  ctx.stroke()
  ctx.scale(0.8 + k * 0.4, 0.8 + k * 0.4)
  ctx.font = '900 110px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineWidth = 12
  ctx.lineJoin = 'round'
  ctx.strokeStyle = '#111'
  ctx.strokeText(String(n), 0, 6)
  ctx.fillStyle = '#ffffff'
  ctx.fillText(String(n), 0, 6)
  ctx.restore()
}

/** Slow-motion goal replay frame: letterbox bars plus a blinking TEKRAR tag so the moment reads as a broadcast replay. */
export function drawSlowMo(ctx: CanvasRenderingContext2D, slow: number, frame: number) {
  if (slow <= 0) return
  const k = Math.min(1, slow / 10)
  ctx.fillStyle = `rgba(0,0,0,${0.8 * k})`
  const vh = VIEW_H
  ctx.fillRect(0, 0, W, 30 * k)
  ctx.fillRect(0, vh - 30 * k, W, 30 * k)
  ctx.save()
  ctx.globalAlpha = k
  ctx.fillStyle = 'rgba(5,6,9,0.85)'
  ctx.beginPath()
  ctx.roundRect(16, vh - 62, 104, 26, 13)
  ctx.fill()
  if (Math.floor(frame / 15) % 2 === 0) {
    ctx.fillStyle = '#ff3b30'
    ctx.beginPath()
    ctx.arc(32, vh - 49, 5, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.font = '900 13px sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#ffffff'
  ctx.fillText('TEKRAR', 44, vh - 48)
  ctx.font = '800 15px sans-serif'
  ctx.textAlign = 'right'
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.fillText('Geçmek için dokun / boşluk', W - 20, vh - 48)
  ctx.restore()
}

export { headR, headY }
