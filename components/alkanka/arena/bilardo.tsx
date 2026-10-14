'use client'

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Target } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { BallState, BilardoState } from '@/lib/pvp/rules'
import type { GameApi } from './stake-gate'
import type { Remote } from './remote'

const W = 1000
const H = 500
const RAIL = 38
const R = 12
const POCKET_R = 25
const MAX_SPEED = 30
const SUB = 8
const FRICTION = Math.pow(0.987, 1 / SUB)

const BALL_COLORS = ['#f5f1e6', '#f2c230', '#2559c9', '#d4382c', '#6b3fa0', '#ef7d22', '#1f8a4c', '#8a2432', '#141414']
const POCKETS = [
  [0, 0],
  [W / 2, -6],
  [W, 0],
  [0, H],
  [W / 2, H + 6],
  [W, H],
] as const

type Ball = { id: number; x: number; y: number; vx: number; vy: number; in: boolean }
type Group = 'solid' | 'stripe'
type Who = 'p' | 'b'

const groupOf = (id: number): Group | 'eight' | 'cue' => (id === 0 ? 'cue' : id === 8 ? 'eight' : id < 8 ? 'solid' : 'stripe')

function seeded(seedText: string) {
  let h = 2166136261
  for (let i = 0; i < seedText.length; i++) h = Math.imul(h ^ seedText.charCodeAt(i), 16777619)
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    return ((h ^= h >>> 16) >>> 0) / 4294967296
  }
}

const toState = (b: Ball): BallState => ({ id: b.id, x: b.x, y: b.y, vx: 0, vy: 0, inPocket: b.in })
const fromState = (b: BallState): Ball => ({ id: b.id, x: b.x, y: b.y, vx: 0, vy: 0, in: b.inPocket })

function rack(rand: () => number = Math.random): Ball[] {
  const balls: Ball[] = [{ id: 0, x: W * 0.25, y: H / 2, vx: 0, vy: 0, in: false }]
  const pool = [1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15]
    .map((id) => ({ id, k: rand() }))
    .sort((a, b) => a.k - b.k)
    .map((x) => x.id)
  const apexX = W * 0.7
  let k = 0
  for (let row = 0; row < 5; row++) {
    for (let i = 0; i <= row; i++) {
      const isEight = row === 2 && i === 1
      const id = isEight ? 8 : pool[k++]
      balls.push({ id, x: apexX + row * R * 1.75, y: H / 2 + (i - row / 2) * R * 2.02, vx: 0, vy: 0, in: false })
    }
  }
  return balls
}

function step(balls: Ball[], onHit: (a: Ball, b: Ball) => void, onPot: (b: Ball) => void) {
  for (let s = 0; s < SUB; s++) {
    for (const b of balls) {
      if (b.in) continue
      b.x += b.vx / SUB
      b.y += b.vy / SUB
      b.vx *= FRICTION
      b.vy *= FRICTION
      for (const [px, py] of POCKETS) {
        if (Math.hypot(b.x - px, b.y - py) < POCKET_R) {
          b.in = true
          b.vx = b.vy = 0
          onPot(b)
          break
        }
      }
      if (b.in) continue
      const nearPocketX = POCKETS.some(([px]) => Math.abs(b.x - px) < POCKET_R + 4)
      const nearPocketY = POCKETS.some(([, py]) => Math.abs(b.y - py) < POCKET_R + 4)
      if (b.x < R && !nearPocketY) ((b.x = R), (b.vx = -b.vx * 0.82))
      if (b.x > W - R && !nearPocketY) ((b.x = W - R), (b.vx = -b.vx * 0.82))
      if (b.y < R && !nearPocketX) ((b.y = R), (b.vy = -b.vy * 0.82))
      if (b.y > H - R && !nearPocketX) ((b.y = H - R), (b.vy = -b.vy * 0.82))
      b.x = Math.min(Math.max(b.x, -10), W + 10)
      b.y = Math.min(Math.max(b.y, -10), H + 10)
    }
    for (let i = 0; i < balls.length; i++) {
      const a = balls[i]
      if (a.in) continue
      for (let j = i + 1; j < balls.length; j++) {
        const b = balls[j]
        if (b.in) continue
        const dx = b.x - a.x
        const dy = b.y - a.y
        const d = Math.hypot(dx, dy)
        if (d === 0 || d >= R * 2) continue
        const nx = dx / d
        const ny = dy / d
        const overlap = (R * 2 - d) / 2
        a.x -= nx * overlap
        a.y -= ny * overlap
        b.x += nx * overlap
        b.y += ny * overlap
        const rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny
        if (rel <= 0) continue
        const imp = rel * 0.97
        a.vx -= imp * nx
        a.vy -= imp * ny
        b.vx += imp * nx
        b.vy += imp * ny
        onHit(a, b)
      }
    }
  }
  for (const b of balls) if (Math.hypot(b.vx, b.vy) < 0.06) b.vx = b.vy = 0
}

function clearPath(balls: Ball[], x1: number, y1: number, x2: number, y2: number, skip: number[]) {
  const dx = x2 - x1
  const dy = y2 - y1
  const len2 = dx * dx + dy * dy
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

export function Bilardo({ finish, remote }: { finish?: GameApi['finish']; remote?: Remote<BilardoState> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const feltNoise = useRef<CanvasPattern | null>(null)
  const seat = remote?.seat ?? 0
  const oppSeat = seat === 0 ? 1 : 0
  const remoteGroups = (st: BilardoState): Record<Who, Group | null> => ({ p: st.groups[seat], b: st.groups[oppSeat] })
  const balls = useRef<Ball[]>(
    remote && remote.state.balls.length ? remote.state.balls.map(fromState) : rack(remote ? seeded(remote.names.join('|') + (remote.id ?? '')) : Math.random),
  )
  const game = useRef({
    turn: (remote ? (remote.state.turn === seat ? 'p' : 'b') : 'p') as Who,
    groups: (remote ? remoteGroups(remote.state) : { p: null, b: null }) as Record<Who, Group | null>,
    moving: false,
    over: false,
    replay: false,
    angle: Math.PI,
    lastSeq: remote?.state.seq ?? 0,
    shot: { first: null as number | null, potted: [] as number[], angle: 0, pow: 0 },
  })
  const [power, setPower] = useState(60)
  const oppName = remote ? remote.names[oppSeat] || 'Rakip' : 'Rakip · Baykuş'
  const [ui, setUi] = useState({
    turn: game.current.turn,
    moving: false,
    message: remote ? (game.current.turn === 'p' ? 'Sıra sende. Nişan al ve vur.' : `${oppName} nişan alıyor...`) : 'Açılış vuruşu sende. İstekayı nişan al ve vur.',
    groups: { ...game.current.groups },
    potted: balls.current.filter((b) => b.in && b.id !== 0).map((b) => b.id),
  })

  useEffect(() => {
    if (!remote) return
    const g = game.current
    const st = remote.state
    if (g.moving || st.seq <= g.lastSeq) return
    g.lastSeq = st.seq
    if (st.shot && st.shot.by !== seat && st.shot.seq === st.seq) {
      // Replay the rival's shot from the synced positions, then snap to the authoritative result.
      g.replay = true
      g.turn = 'b'
      shoot(st.shot.angle, st.shot.pow * 100, true)
      return
    }
    balls.current = st.balls.map(fromState)
    g.groups = remoteGroups(st)
    g.turn = st.turn === seat ? 'p' : 'b'
    sync(g.turn === 'p' ? 'Sıra sende. Nişan al ve vur.' : `${oppName} nişan alıyor...`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remote?.state.seq])

  const sync = (message?: string) => {
    const g = game.current
    setUi((u) => ({
      turn: g.turn,
      moving: g.moving,
      message: message ?? u.message,
      groups: { ...g.groups },
      potted: balls.current.filter((b) => b.in && b.id !== 0).map((b) => b.id),
    }))
  }

  function shoot(angle: number, pow: number, replay = false) {
    const g = game.current
    const cue = balls.current[0]
    if (g.moving || g.over || cue.in) return
    if (remote && !replay && (g.turn !== 'p' || remote.busy)) return
    const speed = (pow / 100) * MAX_SPEED
    cue.vx = Math.cos(angle) * speed
    cue.vy = Math.sin(angle) * speed
    g.shot = { first: null, potted: [], angle, pow: pow / 100 }
    g.moving = true
    sync(g.turn === 'p' ? 'Toplar yuvarlanıyor...' : `${oppName} vurdu...`)
  }

  function sendShot(result: 'win' | 'lose' | null, keepTurn: boolean, note: string) {
    if (!remote) return
    const g = game.current
    const groups: [Group | null, Group | null] = [null, null]
    groups[seat] = g.groups.p
    groups[oppSeat] = g.groups.b
    void remote.send({ type: 'shot', angle: g.shot.angle, pow: g.shot.pow, balls: balls.current.map(toState), groups, keepTurn, result, note })
  }

  function botShot() {
    const g = game.current
    const list = balls.current
    const cue = list[0]
    const mine = g.groups.b
    const ownLeft = list.filter((b) => !b.in && groupOf(b.id) === mine)
    const targets = list.filter((b) => {
      if (b.in || b.id === 0) return false
      if (b.id === 8) return mine !== null && ownLeft.length === 0
      return mine === null || groupOf(b.id) === mine
    })
    let best: { angle: number; score: number; dist: number } | null = null
    for (const t of targets) {
      for (const [px, py] of POCKETS) {
        const tx = px - t.x
        const ty = py - t.y
        const td = Math.hypot(tx, ty)
        const gx = t.x - (tx / td) * R * 2
        const gy = t.y - (ty / td) * R * 2
        const ax = gx - cue.x
        const ay = gy - cue.y
        const ad = Math.hypot(ax, ay)
        const cos = (ax * tx + ay * ty) / (ad * td)
        if (cos < 0.35) continue
        if (!clearPath(list, cue.x, cue.y, gx, gy, [0, t.id])) continue
        if (!clearPath(list, t.x, t.y, px, py, [t.id])) continue
        const score = cos * 2 - (ad + td) / 900
        if (!best || score > best.score) best = { angle: Math.atan2(ay, ax), score, dist: ad + td }
      }
    }
    if (!best) {
      const near = targets.sort((a, b) => Math.hypot(a.x - cue.x, a.y - cue.y) - Math.hypot(b.x - cue.x, b.y - cue.y))[0]
      const angle = near ? Math.atan2(near.y - cue.y, near.x - cue.x) : Math.random() * Math.PI * 2
      return shoot(angle + (Math.random() - 0.5) * 0.05, 55)
    }
    const noise = (Math.random() - 0.5) * 0.028
    shoot(best.angle + noise, Math.min(95, 30 + best.dist / 18))
  }

  function settle() {
    const g = game.current
    if (remote && g.replay) {
      const st = remote.state
      g.replay = false
      g.moving = false
      balls.current = st.balls.map(fromState)
      g.groups = remoteGroups(st)
      g.turn = st.turn === seat ? 'p' : 'b'
      sync(st.note ? `${st.note}${g.turn === 'p' ? ' Sıra sende.' : ''}` : g.turn === 'p' ? 'Sıra sende.' : `${oppName} yine oynuyor.`)
      return
    }
    const list = balls.current
    const shooter = g.turn
    const other: Who = shooter === 'p' ? 'b' : 'p'
    const { first, potted } = g.shot
    const cue = list[0]
    const scratch = cue.in
    const myGroup = g.groups[shooter]
    const clearedBefore = myGroup !== null && list.filter((b) => groupOf(b.id) === myGroup && (!b.in || potted.includes(b.id))).length === 0

    if (potted.includes(8)) {
      g.over = true
      const won = clearedBefore && !scratch
      const playerWon = (shooter === 'p') === won
      sync(won ? (shooter === 'p' ? 'Siyahı deliğe yolladın!' : 'Rakip siyahı soktu.') : shooter === 'p' ? 'Siyah erken düştü.' : 'Rakip siyahı erken soktu!')
      if (remote) {
        sendShot(won ? 'win' : 'lose', false, won ? 'Siyah kurallı düştü.' : 'Siyah erken düştü.')
        return
      }
      setTimeout(() => finish?.(playerWon ? 'win' : 'lose', playerWon ? (won ? 'Grubunu temizleyip siyahı soktun.' : 'Rakip siyahı kuralsız soktu, masa senin.') : won ? 'Rakip grubunu temizleyip siyahı soktu.' : 'Siyahı grubunu bitirmeden soktun.'), 1100)
      return
    }

    let foul = scratch || first === null
    if (!foul && myGroup && first !== null) {
      const fg = groupOf(first)
      foul = fg !== myGroup && !(fg === 'eight' && clearedBefore)
    }
    if (!foul && !myGroup) {
      const firstPot = potted.find((id) => id !== 0 && id !== 8)
      if (firstPot) {
        const grp = groupOf(firstPot) as Group
        g.groups[shooter] = grp
        g.groups[other] = grp === 'solid' ? 'stripe' : 'solid'
      }
    }
    if (scratch) {
      cue.in = false
      cue.vx = cue.vy = 0
      let x = W * 0.25
      while (list.some((b) => b.id !== 0 && !b.in && Math.hypot(b.x - x, b.y - H / 2) < R * 2.2)) x += R * 2.5
      cue.x = x
      cue.y = H / 2
    }
    const group = g.groups[shooter]
    const keep = !foul && potted.some((id) => groupOf(id) === group)
    const label = (w: Who) => (w === 'p' ? 'Sende' : 'Rakipte')
    let msg: string
    if (scratch) msg = `Beyaz top düştü, faul. Sıra ${label(other).toLowerCase()}.`
    else if (first === null) msg = `Hiçbir topa değmedi, faul. Sıra ${label(other).toLowerCase()}.`
    else if (foul) msg = `Önce yanlış gruba vuruldu, faul. Sıra ${label(other).toLowerCase()}.`
    else if (keep) msg = shooter === 'p' ? 'Güzel! Sıra yine sende.' : 'Rakip soktu, yine o oynuyor.'
    else msg = `Top düşmedi. Sıra ${label(other).toLowerCase()}.`
    if (!keep) g.turn = other
    g.moving = false
    if (remote) {
      sync(keep ? 'Güzel! Sıra yine sende.' : `${msg.split('. Sıra')[0]}. Sıra ${oppName} oyuncusunda.`)
      sendShot(null, keep, scratch ? 'Beyaz düştü, faul.' : first === null ? 'Topa değmedi, faul.' : foul ? 'Yanlış gruba vuruş, faul.' : keep ? 'Rakip top soktu.' : '')
      return
    }
    sync(msg)
    if (g.turn === 'b') setTimeout(botShot, 1000)
  }

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    const css = getComputedStyle(document.documentElement)
    const felt = css.getPropertyValue('--felt').trim() || '#1b2a44'
    const wood = css.getPropertyValue('--wood').trim() || '#4a3020'
    const gold = css.getPropertyValue('--primary').trim() || '#e2b33c'
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const CW = W + RAIL * 2
    const CH = H + RAIL * 2
    canvas.width = CW * dpr
    canvas.height = CH * dpr
    let raf = 0
    let idleFrames = 0

    const draw = () => {
      const g = game.current
      if (g.moving) {
        step(
          balls.current,
          (a, b) => {
            if (g.shot.first === null) {
              if (a.id === 0) g.shot.first = b.id
              else if (b.id === 0) g.shot.first = a.id
            }
          },
          (b) => g.shot.potted.push(b.id),
        )
        const still = balls.current.every((b) => b.in || (b.vx === 0 && b.vy === 0))
        idleFrames = still ? idleFrames + 1 : 0
        if (idleFrames > 4) {
          idleFrames = 0
          settle()
        }
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, CW, CH)
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
      if (!feltNoise.current) {
        const nc = document.createElement('canvas')
        nc.width = 96
        nc.height = 96
        const nx = nc.getContext('2d')
        if (nx) {
          const img = nx.createImageData(96, 96)
          for (let i = 0; i < img.data.length; i += 4) {
            const v = Math.random() * 255
            img.data[i] = img.data[i + 1] = img.data[i + 2] = v
            img.data[i + 3] = 14
          }
          nx.putImageData(img, 0, 0)
          feltNoise.current = ctx.createPattern(nc, 'repeat')
        }
      }
      if (feltNoise.current) {
        ctx.fillStyle = feltNoise.current
        ctx.fillRect(0, 0, W, H)
      }
      const grad = ctx.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, W * 0.6)
      grad.addColorStop(0, 'rgba(255,255,255,0.08)')
      grad.addColorStop(1, 'rgba(0,0,0,0.32)')
      ctx.fillStyle = grad
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
      for (const [px, py] of POCKETS) {
        const pg = ctx.createRadialGradient(px, py, POCKET_R * 0.2, px, py, POCKET_R * 1.35)
        pg.addColorStop(0, '#000000')
        pg.addColorStop(0.7, '#05070c')
        pg.addColorStop(1, 'rgba(5,7,12,0)')
        ctx.fillStyle = pg
        ctx.beginPath()
        ctx.arc(px, py, POCKET_R * 1.35, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = gold
        ctx.globalAlpha = 0.35
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(px, py, POCKET_R + 1, 0, Math.PI * 2)
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

      const cue = balls.current[0]
      if (!g.moving && !g.over && g.turn === 'p' && !cue.in) {
        const hit = castGuide(balls.current, cue, g.angle)
        const len = hit ? hit.t : 1400
        const gx = cue.x + Math.cos(g.angle) * len
        const gy = cue.y + Math.sin(g.angle) * len
        ctx.setLineDash([6, 8])
        ctx.strokeStyle = 'rgba(255,255,255,0.55)'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(cue.x, cue.y)
        ctx.lineTo(gx, gy)
        ctx.stroke()
        ctx.setLineDash([])
        if (hit) {
          ctx.strokeStyle = 'rgba(255,255,255,0.7)'
          ctx.beginPath()
          ctx.arc(gx, gy, R, 0, Math.PI * 2)
          ctx.stroke()
          const nx = hit.ball.x - gx
          const ny = hit.ball.y - gy
          const nd = Math.hypot(nx, ny)
          ctx.strokeStyle = gold
          ctx.beginPath()
          ctx.moveTo(hit.ball.x, hit.ball.y)
          ctx.lineTo(hit.ball.x + (nx / nd) * 90, hit.ball.y + (ny / nd) * 90)
          ctx.stroke()
        }
      }

      for (const b of balls.current) {
        if (b.in) continue
        ctx.fillStyle = 'rgba(0,0,0,0.35)'
        ctx.beginPath()
        ctx.arc(b.x + 3, b.y + 4, R, 0, Math.PI * 2)
        ctx.fill()
        const stripe = b.id > 8
        ctx.save()
        ctx.beginPath()
        ctx.arc(b.x, b.y, R, 0, Math.PI * 2)
        ctx.clip()
        ctx.fillStyle = stripe ? BALL_COLORS[0] : BALL_COLORS[b.id]
        ctx.fillRect(b.x - R, b.y - R, R * 2, R * 2)
        if (stripe) {
          ctx.fillStyle = BALL_COLORS[b.id - 8]
          ctx.fillRect(b.x - R, b.y - R * 0.55, R * 2, R * 1.1)
        }
        const shine = ctx.createRadialGradient(b.x - R * 0.4, b.y - R * 0.45, 1, b.x, b.y, R * 1.2)
        shine.addColorStop(0, 'rgba(255,255,255,0.6)')
        shine.addColorStop(0.35, 'rgba(255,255,255,0)')
        shine.addColorStop(1, 'rgba(0,0,0,0.35)')
        ctx.fillStyle = shine
        ctx.fillRect(b.x - R, b.y - R, R * 2, R * 2)
        ctx.restore()
        if (b.id) {
          ctx.fillStyle = BALL_COLORS[0]
          ctx.beginPath()
          ctx.arc(b.x, b.y, R * 0.45, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = '#141414'
          ctx.font = 'bold 8px system-ui'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(String(b.id), b.x, b.y + 0.5)
        }
      }

      if (!g.moving && !g.over && g.turn === 'p' && !cue.in) {
        const back = 22 + (power / 100) * 40
        const sx = cue.x - Math.cos(g.angle) * back
        const sy = cue.y - Math.sin(g.angle) * back
        const ex = cue.x - Math.cos(g.angle) * (back + 340)
        const ey = cue.y - Math.sin(g.angle) * (back + 340)
        const stick = ctx.createLinearGradient(sx, sy, ex, ey)
        stick.addColorStop(0, '#f2e7cf')
        stick.addColorStop(0.04, '#f2e7cf')
        stick.addColorStop(0.05, '#2b6cb0')
        stick.addColorStop(0.07, '#c9a46a')
        stick.addColorStop(0.75, '#7a4a25')
        stick.addColorStop(1, '#1d120a')
        ctx.strokeStyle = stick
        ctx.lineWidth = 7
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(sx, sy)
        ctx.lineTo(ex, ey)
        ctx.stroke()
      }

      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [power])

  const canAim = () => {
    const g = game.current
    return !g.moving && !g.over && g.turn === 'p' && !balls.current[0].in
  }

  /** Points the cue at the pointer. Ignores positions on top of the cue ball, where atan2 swings wildly. */
  function aimAt(e: ReactPointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * (W + RAIL * 2) - RAIL
    const y = ((e.clientY - rect.top) / rect.height) * (H + RAIL * 2) - RAIL
    const cue = balls.current[0]
    if (Math.hypot(x - cue.x, y - cue.y) < R * 1.5) return
    game.current.angle = Math.atan2(y - cue.y, x - cue.x)
  }

  const drag = useRef<{ id: number; x: number; y: number; moved: boolean } | null>(null)
  const [aimLocked, setAimLocked] = useState(false)
  const lockedRef = useRef(false)
  const lock = (v: boolean) => {
    lockedRef.current = v
    setAimLocked(v)
  }

  function onPointerDown(e: ReactPointerEvent<HTMLCanvasElement>) {
    e.currentTarget.focus({ preventScroll: true })
    if (!canAim()) return
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false }
    aimAt(e)
  }

  function onPointerMove(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (!canAim()) return
    const d = drag.current
    if (d && d.id === e.pointerId) {
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4) d.moved = true
      aimAt(e)
    } else if (!lockedRef.current && e.pointerType === 'mouse') {
      aimAt(e)
    }
  }

  function onPointerUp(e: ReactPointerEvent<HTMLCanvasElement>) {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    drag.current = null
    // A drag always leaves the aim locked; a plain click toggles the lock.
    lock(d.moved ? true : !lockedRef.current)
  }

  const powerRef = useRef(power)
  powerRef.current = power

  // Keyboard works anywhere on the page (no need to click the table first), except while typing in a field.
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
        // Starts precise, then speeds up the longer the key is held, so full turns don't feel stuck.
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
      else if (k === 'ArrowUp' || k === 'w' || k === 'W') setPower((p) => Math.min(100, p + 5))
      else if (k === 'ArrowDown' || k === 's' || k === 'S') setPower((p) => Math.max(5, p - 5))
      else if (k === ' ' || k === 'Enter') {
        if (e.repeat) return e.preventDefault()
        if (canAim()) {
          shoot(game.current.angle, powerRef.current)
          lock(false)
        }
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

  const fire = () => {
    shoot(game.current.angle, power)
    lock(false)
  }

  const yourTurn = ui.turn === 'p' && !ui.moving
  const groupLabel = (g: Group | null) => (g === 'solid' ? 'Düz (1-7)' : g === 'stripe' ? 'Çizgili (9-15)' : 'Belirlenmedi')
  const remaining = (g: Group | null) => (g ? [1, 2, 3, 4, 5, 6, 7].map((n) => (g === 'solid' ? n : n + 8)).filter((n) => !ui.potted.includes(n)) : [])

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-2 sm:grid-cols-2">
        {(['p', 'b'] as const).map((w) => (
          <div key={w} className={cn('flex items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3', ui.turn === w ? 'border-primary glow-gold' : 'border-border')}>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-foreground">{w === 'p' ? 'Sen' : oppName}</span>
              <span className="text-xs text-muted-foreground">{groupLabel(ui.groups[w])}</span>
            </div>
            <div className="flex flex-wrap justify-end gap-1">
              {remaining(ui.groups[w]).map((n) => (
                <span
                  key={n}
                  className="flex size-5 items-center justify-center rounded-full text-[9px] font-bold text-tile-black"
                  style={{ background: n > 8 ? `linear-gradient(${BALL_COLORS[0]} 25%, ${BALL_COLORS[n - 8]} 25% 75%, ${BALL_COLORS[0]} 75%)` : BALL_COLORS[n] }}
                >
                  <span className="flex size-3 items-center justify-center rounded-full bg-checker-light">{n}</span>
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="relative">
        <canvas
          ref={canvasRef}
          tabIndex={0}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => (drag.current = null)}
          aria-label="Bilardo masası. İmleçle nişan al, tıklayarak nişanı kilitle. Sol-sağ ok tuşlarıyla döndür, yukarı-aşağı ile gücü ayarla, boşluk ile vur."
          className={cn('aspect-[1076/576] w-full touch-none rounded-3xl shadow-2xl outline-none focus-visible:ring-2 focus-visible:ring-primary', yourTurn ? 'cursor-crosshair' : 'cursor-wait')}
        />
        {yourTurn && (
          <span
            className={cn(
              'pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider shadow-md backdrop-blur-sm',
              aimLocked ? 'bg-primary text-primary-foreground' : 'bg-background/70 text-foreground',
            )}
          >
            {aimLocked ? 'Nişan kilitli · Boşluk ile vur' : 'Nişan al · Tıkla ve kilitle'}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center">
        <p className="flex-1 text-sm font-semibold text-foreground" aria-live="polite">
          {ui.message}
        </p>
        <label className="flex items-center gap-3 text-sm text-muted-foreground">
          Güç
          <input type="range" min={5} max={100} value={power} onChange={(e) => setPower(Number(e.target.value))} className="w-full flex-1 accent-primary sm:w-36 sm:flex-none" />
          <span className="w-9 font-display font-bold text-foreground">{power}</span>
        </label>
        <button
          onClick={fire}
          disabled={!yourTurn}
          className="flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold uppercase tracking-wide text-primary-foreground hover:brightness-110 disabled:opacity-40"
        >
          <Target className="size-4" aria-hidden="true" />
          {ui.turn === 'b' ? 'Rakip nişan alıyor' : 'Vur'}
        </button>
      </div>

      <KeyGuide />
    </div>
  )
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex min-w-6 items-center justify-center rounded-md border border-border border-b-2 bg-secondary px-1.5 py-0.5 font-mono text-[11px] font-bold text-foreground">
      {children}
    </kbd>
  )
}

function KeyGuide() {
  const rows: { keys: React.ReactNode; label: string }[] = [
    { keys: <span className="text-xs font-semibold text-foreground">Fare</span>, label: 'İmleçle nişan al, tıklayınca nişan kilitlenir' },
    { keys: <span className="text-xs font-semibold text-foreground">Sürükle</span>, label: 'Basılı tutup çevirerek istakayı her yöne döndür' },
    { keys: (<><Kbd>←</Kbd><Kbd>→</Kbd></>), label: 'İstakayı döndür (basılı tut, hızlanır)' },
    { keys: (<><Kbd>Shift</Kbd><span className="text-muted-foreground">+</span><Kbd>←→</Kbd></>), label: 'İnce ayar' },
    { keys: (<><Kbd>↑</Kbd><Kbd>↓</Kbd></>), label: 'Vuruş gücü ±5' },
    { keys: (<><Kbd>Boşluk</Kbd><Kbd>Enter</Kbd></>), label: 'Vur' },
  ]
  return (
    <details className="group hidden rounded-2xl border border-border bg-card md:block" open>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-bold text-foreground">
        Tuş rehberi
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
        Tuşlar masaya tıklamadan da çalışır. Sohbete yazarken devre dışı kalır. W A S D tuşları da kullanılabilir.
      </p>
    </details>
  )
}
