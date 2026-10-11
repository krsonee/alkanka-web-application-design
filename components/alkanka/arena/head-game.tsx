'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowBigUp, ChevronLeft, ChevronRight, Footprints } from 'lucide-react'

export type Sport = 'futbol' | 'basket'
export type HeadMode = 'bot' | 'local'
export type HeadScore = { for: number; against: number }

const W = 960
const H = 540
const GROUND = 470
const G = 0.55
const HEAD_R = 36
const BALL_R = 15
const MATCH_SECONDS = 60

type Player = { x: number; y: number; vx: number; vy: number; face: 1 | -1; kick: number }
type Ball = { x: number; y: number; vx: number; vy: number }
type Keys = { left: boolean; right: boolean; jump: boolean; kick: boolean }
const noKeys = (): Keys => ({ left: false, right: false, jump: false, kick: false })

const GOAL_TOP = 300
const GOAL_DEPTH = 64
const RIM_Y = 220
const RIM_W = 64
const BOARD_X = 46
const rimLeft = () => ({ a: BOARD_X + 10, b: BOARD_X + 10 + RIM_W })
const rimRight = () => ({ a: W - BOARD_X - 10 - RIM_W, b: W - BOARD_X - 10 })

function resetPositions(p1: Player, p2: Player, ball: Ball, serveTo: 0 | 1) {
  Object.assign(p1, { x: 220, y: GROUND - HEAD_R, vx: 0, vy: 0, face: 1, kick: 0 })
  Object.assign(p2, { x: W - 220, y: GROUND - HEAD_R, vx: 0, vy: 0, face: -1, kick: 0 })
  Object.assign(ball, { x: W / 2, y: 160, vx: serveTo === 0 ? -1.5 : 1.5, vy: 0 })
}

function stepPlayer(p: Player, k: Keys) {
  const speed = 5.6
  p.vx = (k.right ? speed : 0) - (k.left ? speed : 0)
  if (p.vx) p.face = p.vx > 0 ? 1 : -1
  if (k.jump && p.y >= GROUND - HEAD_R - 0.5) p.vy = -12.5
  if (k.kick && p.kick <= 0) p.kick = 14
  if (p.kick > 0) p.kick--
  p.vy += G
  p.x += p.vx
  p.y += p.vy
  if (p.y > GROUND - HEAD_R) {
    p.y = GROUND - HEAD_R
    p.vy = 0
  }
  p.x = Math.max(HEAD_R + 8, Math.min(W - HEAD_R - 8, p.x))
}

function collideCircle(ball: Ball, cx: number, cy: number, r: number, pvx = 0, pvy = 0, bounce = 0.9) {
  const dx = ball.x - cx
  const dy = ball.y - cy
  const dist = Math.hypot(dx, dy)
  const min = r + BALL_R
  if (dist >= min || dist === 0) return false
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
  ball.vx += pvx * 0.35
  ball.vy += pvy * 0.35
  return true
}

function stepBall(ball: Ball, sport: Sport) {
  ball.vy += 0.38
  ball.vx *= 0.995
  ball.x += ball.vx
  ball.y += ball.vy
  const sp = Math.hypot(ball.vx, ball.vy)
  if (sp > 22) {
    ball.vx *= 22 / sp
    ball.vy *= 22 / sp
  }
  if (ball.y > GROUND - BALL_R) {
    ball.y = GROUND - BALL_R
    ball.vy *= -0.72
    ball.vx *= 0.97
    if (Math.abs(ball.vy) < 1) ball.vy = 0
  }
  if (ball.y < BALL_R) {
    ball.y = BALL_R
    ball.vy = Math.abs(ball.vy) * 0.7
  }
  if (ball.x < BALL_R) {
    ball.x = BALL_R
    ball.vx = Math.abs(ball.vx) * 0.8
  }
  if (ball.x > W - BALL_R) {
    ball.x = W - BALL_R
    ball.vx = -Math.abs(ball.vx) * 0.8
  }
  if (sport === 'futbol') {
    for (const side of [0, 1] as const) {
      const barX0 = side === 0 ? 0 : W - GOAL_DEPTH - 6
      const barX1 = side === 0 ? GOAL_DEPTH + 6 : W
      if (ball.x > barX0 - BALL_R && ball.x < barX1 + BALL_R && Math.abs(ball.y - GOAL_TOP) < BALL_R + 4) {
        ball.y = ball.vy > 0 ? GOAL_TOP - BALL_R - 4 : GOAL_TOP + BALL_R + 4
        ball.vy *= -0.6
      }
    }
  } else {
    for (const side of [0, 1] as const) {
      const bx = side === 0 ? BOARD_X : W - BOARD_X
      if (ball.y > RIM_Y - 110 && ball.y < RIM_Y + 20 && Math.abs(ball.x - bx) < BALL_R + 4) {
        ball.x = side === 0 ? bx + BALL_R + 4 : bx - BALL_R - 4
        ball.vx = (side === 0 ? 1 : -1) * Math.abs(ball.vx) * 0.7
      }
      const rim = side === 0 ? rimLeft() : rimRight()
      collideCircle(ball, rim.a, RIM_Y, 4, 0, 0, 0.6)
      collideCircle(ball, rim.b, RIM_Y, 4, 0, 0, 0.6)
    }
  }
}

function hitBall(ball: Ball, p: Player) {
  if (collideCircle(ball, p.x, p.y, HEAD_R, p.vx, p.vy)) return
  const footX = p.x + p.face * 22
  const footY = p.y + HEAD_R + 6
  if (p.kick > 6 && Math.hypot(ball.x - footX, ball.y - footY) < BALL_R + 26) {
    ball.vx = p.face * 15
    ball.vy = -9
  } else collideCircle(ball, p.x, p.y + HEAD_R + 4, 14, p.vx, p.vy, 0.6)
}

function botKeys(bot: Player, ball: Ball, sport: Sport): Keys {
  const k = noKeys()
  const defendX = sport === 'futbol' ? W - 150 : W - 190
  const threat = ball.vx > 2 && ball.x > W / 2
  const targetX = threat ? Math.max(ball.x + 30, defendX - 80) : ball.x + 28
  if (bot.x < targetX - 10) k.right = true
  else if (bot.x > targetX + 10) k.left = true
  const near = Math.abs(ball.x - bot.x) < 90
  if (near && ball.y < bot.y - 30 && ball.vy > -2) k.jump = true
  if (Math.abs(ball.x - (bot.x - 24)) < 40 && ball.y > GROUND - 70) k.kick = Math.random() < 0.3
  return k
}

function drawField(ctx: CanvasRenderingContext2D, sport: Sport, css: Record<string, string>) {
  ctx.fillStyle = css.bg
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = css.card
  for (let i = 0; i < 24; i++) ctx.fillRect(i * 40 + 6, 60 + ((i * 37) % 30), 24, 26)
  ctx.fillStyle = css.ad
  ctx.fillRect(0, GROUND - 70, W, 24)
  ctx.fillStyle = css.primary
  ctx.font = '700 15px sans-serif'
  ctx.textAlign = 'center'
  for (let x = 120; x < W; x += 240) ctx.fillText('ALKANKA  -  KANKA COIN', x, GROUND - 53)
  if (sport === 'futbol') {
    for (let i = 0; i < 12; i++) {
      ctx.fillStyle = i % 2 ? css.grass : css.grass2
      ctx.fillRect(i * 80, GROUND - 46, 80, H - GROUND + 46)
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(W / 2, GROUND - 46)
    ctx.lineTo(W / 2, H)
    ctx.stroke()
  } else {
    ctx.fillStyle = css.wood
    ctx.fillRect(0, GROUND - 46, W, H - GROUND + 46)
    ctx.strokeStyle = 'rgba(0,0,0,0.18)'
    ctx.lineWidth = 1
    for (let x = 0; x < W; x += 48) {
      ctx.beginPath()
      ctx.moveTo(x, GROUND - 46)
      ctx.lineTo(x, H)
      ctx.stroke()
    }
  }
  ctx.fillStyle = 'rgba(255,255,255,0.12)'
  ctx.font = '700 64px sans-serif'
  ctx.fillText('ALKANKA', W / 2, H - 16)
  ctx.fillStyle = css.line
  ctx.fillRect(0, GROUND, W, 3)

  if (sport === 'futbol') {
    for (const side of [0, 1] as const) {
      const x0 = side === 0 ? 0 : W - GOAL_DEPTH
      ctx.fillStyle = 'rgba(255,255,255,0.08)'
      ctx.fillRect(x0, GOAL_TOP, GOAL_DEPTH, GROUND - GOAL_TOP)
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'
      ctx.lineWidth = 1
      for (let y = GOAL_TOP; y < GROUND; y += 14) {
        ctx.beginPath()
        ctx.moveTo(x0, y)
        ctx.lineTo(x0 + GOAL_DEPTH, y)
        ctx.stroke()
      }
      ctx.fillStyle = '#f5f5f5'
      ctx.fillRect(side === 0 ? 0 : W - GOAL_DEPTH - 6, GOAL_TOP - 4, GOAL_DEPTH + 6, 8)
      ctx.fillRect(side === 0 ? GOAL_DEPTH : W - GOAL_DEPTH - 6, GOAL_TOP, 6, GROUND - GOAL_TOP)
    }
  } else {
    for (const side of [0, 1] as const) {
      const bx = side === 0 ? BOARD_X : W - BOARD_X
      ctx.fillStyle = '#9ca3af'
      ctx.fillRect(side === 0 ? bx - 14 : bx + 6, RIM_Y - 40, 8, GROUND - RIM_Y + 40)
      ctx.fillStyle = 'rgba(255,255,255,0.85)'
      ctx.fillRect(bx - 4, RIM_Y - 110, 8, 130)
      const rim = side === 0 ? rimLeft() : rimRight()
      ctx.strokeStyle = css.primary
      ctx.lineWidth = 5
      ctx.beginPath()
      ctx.moveTo(rim.a, RIM_Y)
      ctx.lineTo(rim.b, RIM_Y)
      ctx.stroke()
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'
      ctx.lineWidth = 1.5
      for (let i = 0; i <= 4; i++) {
        const x = rim.a + (i * RIM_W) / 4
        ctx.beginPath()
        ctx.moveTo(x, RIM_Y)
        ctx.lineTo(rim.a + RIM_W / 2 + (x - rim.a - RIM_W / 2) * 0.55, RIM_Y + 40)
        ctx.stroke()
      }
    }
  }
}

function drawPlayer(ctx: CanvasRenderingContext2D, p: Player, color: string, img: HTMLImageElement | null, label: string) {
  ctx.save()
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.roundRect(p.x - 18, p.y + HEAD_R - 6, 36, 26, 8)
  ctx.fill()
  ctx.fillStyle = '#111'
  const kickOffset = p.kick > 6 ? p.face * 16 : 0
  ctx.beginPath()
  ctx.ellipse(p.x + p.face * 10 + kickOffset, p.y + HEAD_R + 22, 14, 7, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(p.x, p.y, HEAD_R, 0, Math.PI * 2)
  ctx.closePath()
  ctx.fillStyle = color
  ctx.fill()
  if (img?.complete && img.naturalWidth) {
    ctx.save()
    ctx.clip()
    if (p.face === -1) {
      ctx.translate(p.x * 2, 0)
      ctx.scale(-1, 1)
    }
    ctx.drawImage(img, p.x - HEAD_R * 1.25, p.y - HEAD_R * 1.15, HEAD_R * 2.5, HEAD_R * 2.5)
    ctx.restore()
  } else {
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.arc(p.x + p.face * 12, p.y - 6, 9, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#111'
    ctx.beginPath()
    ctx.arc(p.x + p.face * 15, p.y - 6, 4, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.lineWidth = 3
  ctx.strokeStyle = color
  ctx.beginPath()
  ctx.arc(p.x, p.y, HEAD_R, 0, Math.PI * 2)
  ctx.stroke()
  ctx.fillStyle = '#fff'
  ctx.font = '700 13px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(label, p.x, p.y - HEAD_R - 10)
  ctx.restore()
}

function drawBall(ctx: CanvasRenderingContext2D, b: Ball, sport: Sport, css: Record<string, string>) {
  ctx.save()
  ctx.beginPath()
  ctx.arc(b.x, b.y, BALL_R, 0, Math.PI * 2)
  ctx.fillStyle = sport === 'futbol' ? '#f8f8f8' : css.orange
  ctx.fill()
  ctx.strokeStyle = '#111'
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.beginPath()
  if (sport === 'futbol') {
    ctx.fillStyle = '#111'
    ctx.arc(b.x, b.y, 5, 0, Math.PI * 2)
    ctx.fill()
  } else {
    ctx.moveTo(b.x - BALL_R, b.y)
    ctx.lineTo(b.x + BALL_R, b.y)
    ctx.moveTo(b.x, b.y - BALL_R)
    ctx.lineTo(b.x, b.y + BALL_R)
    ctx.stroke()
  }
  ctx.restore()
}

function readCss() {
  const s = getComputedStyle(document.documentElement)
  const v = (n: string, f: string) => s.getPropertyValue(n).trim() || f
  return {
    bg: v('--background', '#111'),
    card: v('--card', '#1b1d24'),
    ad: v('--secondary', '#222'),
    primary: v('--primary', '#e5b93e'),
    grass: v('--felt', '#1f6b3a'),
    grass2: 'color-mix(in oklch, ' + v('--felt', '#1f6b3a') + ' 85%, black)',
    wood: v('--wood', '#8a5a2b'),
    line: 'rgba(255,255,255,0.6)',
    orange: '#e8742a',
  }
}

function TouchPad({ keys, side }: { keys: React.RefObject<Keys>; side: 'left' | 'right' }) {
  const bind = (k: keyof Keys) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault()
      keys.current[k] = true
    },
    onPointerUp: () => (keys.current[k] = false),
    onPointerLeave: () => (keys.current[k] = false),
    onPointerCancel: () => (keys.current[k] = false),
  })
  const btn = 'flex size-12 touch-none select-none items-center justify-center rounded-full border border-primary/50 bg-background/70 text-foreground active:bg-primary active:text-primary-foreground'
  return (
    <div className={side === 'left' ? 'flex gap-2' : 'flex flex-row-reverse gap-2'}>
      <button type="button" className={btn} aria-label="Sola" {...bind('left')}>
        <ChevronLeft className="size-5" aria-hidden="true" />
      </button>
      <button type="button" className={btn} aria-label="Sağa" {...bind('right')}>
        <ChevronRight className="size-5" aria-hidden="true" />
      </button>
      <button type="button" className={btn} aria-label="Zıpla" {...bind('jump')}>
        <ArrowBigUp className="size-5" aria-hidden="true" />
      </button>
      <button type="button" className={btn} aria-label="Şut" {...bind('kick')}>
        <Footprints className="size-5" aria-hidden="true" />
      </button>
    </div>
  )
}

/**
 * Head soccer / head basketball. In "bot" mode the left player faces the bot,
 * in "local" mode two people share one device (WASD + arrows, or touch pads).
 */
export function HeadGame({
  sport,
  mode,
  onEnd,
  names = ['Sen', mode === 'bot' ? 'Bot' : 'Kanka 2'],
}: {
  sport: Sport
  mode: HeadMode
  onEnd: (score: HeadScore) => void
  names?: [string, string]
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const k1 = useRef<Keys>(noKeys())
  const k2 = useRef<Keys>(noKeys())
  const [score, setScore] = useState<[number, number]>([0, 0])
  const [time, setTime] = useState(MATCH_SECONDS)
  const [flash, setFlash] = useState('')
  const endRef = useRef(onEnd)
  endRef.current = onEnd

  useEffect(() => {
    const map1: Record<string, keyof Keys> = { KeyA: 'left', KeyD: 'right', KeyW: 'jump', KeyS: 'kick', Space: 'kick' }
    const map2: Record<string, keyof Keys> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'jump', ArrowDown: 'kick' }
    const solo: Record<string, keyof Keys> = { ...map2, ...map1 }
    const handle = (down: boolean) => (e: KeyboardEvent) => {
      const m1 = mode === 'bot' ? solo : map1
      if (m1[e.code]) {
        k1.current[m1[e.code]] = down
        e.preventDefault()
      } else if (mode === 'local' && map2[e.code]) {
        k2.current[map2[e.code]] = down
        e.preventDefault()
      }
    }
    const kd = handle(true)
    const ku = handle(false)
    window.addEventListener('keydown', kd)
    window.addEventListener('keyup', ku)
    return () => {
      window.removeEventListener('keydown', kd)
      window.removeEventListener('keyup', ku)
    }
  }, [mode])

  useEffect(() => {
    const ctx = canvas.current?.getContext('2d')
    if (!ctx) return
    const css = readCss()
    const jako = new Image()
    jako.crossOrigin = 'anonymous'
    jako.src = '/images/mascots/jako.png'
    const rival = new Image()
    rival.crossOrigin = 'anonymous'
    rival.src = '/images/mascots/jako-uzgun.png'
    const p1: Player = { x: 0, y: 0, vx: 0, vy: 0, face: 1, kick: 0 }
    const p2: Player = { x: 0, y: 0, vx: 0, vy: 0, face: -1, kick: 0 }
    const ball: Ball = { x: 0, y: 0, vx: 0, vy: 0 }
    resetPositions(p1, p2, ball, 0)
    const sc: [number, number] = [0, 0]
    let pause = 60
    let raf = 0
    let last = performance.now()
    let acc = 0
    const started = performance.now()
    let ended = false
    let prevBallY = ball.y

    function goal(scorer: 0 | 1, pts: number) {
      sc[scorer] += pts
      setScore([sc[0], sc[1]])
      setFlash(sport === 'futbol' ? 'GOL!' : pts === 3 ? 'ÜÇLÜK!' : 'BASKET!')
      setTimeout(() => setFlash(''), 900)
      pause = 70
      resetPositions(p1, p2, ball, scorer === 0 ? 1 : 0)
    }

    function step() {
      const k2now = mode === 'bot' ? botKeys(p2, ball, sport) : k2.current
      stepPlayer(p1, k1.current)
      stepPlayer(p2, k2now)
      if (pause > 0) {
        pause--
        return
      }
      prevBallY = ball.y
      stepBall(ball, sport)
      hitBall(ball, p1)
      hitBall(ball, p2)
      if (sport === 'futbol') {
        if (ball.x < GOAL_DEPTH - 4 && ball.y > GOAL_TOP + 6) goal(1, 1)
        else if (ball.x > W - GOAL_DEPTH + 4 && ball.y > GOAL_TOP + 6) goal(0, 1)
      } else {
        const crossed = prevBallY < RIM_Y && ball.y >= RIM_Y && ball.vy > 0
        if (crossed) {
          const L = rimLeft()
          const R = rimRight()
          if (ball.x > L.a + 4 && ball.x < L.b - 4) goal(1, 2)
          else if (ball.x > R.a + 4 && ball.x < R.b - 4) goal(0, 2)
        }
      }
    }

    function frame(now: number) {
      acc += Math.min(100, now - last)
      last = now
      while (acc >= 1000 / 60) {
        step()
        acc -= 1000 / 60
      }
      const left = Math.max(0, MATCH_SECONDS - Math.floor((now - started) / 1000))
      setTime(left)
      drawField(ctx!, sport, css)
      drawPlayer(ctx!, p1, css.primary, jako, names[0])
      drawPlayer(ctx!, p2, '#4b8fd6', rival, names[1])
      drawBall(ctx!, ball, sport, css)
      if (left <= 0 && !ended) {
        ended = true
        endRef.current({ for: sc[0], against: sc[1] })
        return
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
    // names are display only; restarting the match on rename is not wanted
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sport, mode])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-2.5">
        <span className="min-w-0 truncate text-sm font-bold text-primary">{names[0]}</span>
        <div className="flex items-center gap-3">
          <span className="font-display text-2xl font-bold tabular-nums text-foreground" aria-live="polite">
            {score[0]} - {score[1]}
          </span>
          <span className="rounded-md bg-secondary px-2 py-1 font-mono text-sm tabular-nums text-foreground" aria-label="Kalan süre">
            {time}s
          </span>
        </div>
        <span className="min-w-0 truncate text-right text-sm font-bold text-foreground">{names[1]}</span>
      </div>
      <div className="relative overflow-hidden rounded-2xl border border-primary/30">
        <canvas ref={canvas} width={W} height={H} className="block aspect-video w-full" aria-label={sport === 'futbol' ? 'Kafa topu sahası' : 'Kafa basketbolu sahası'} />
        {flash && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="pop-in font-display text-5xl font-bold text-primary drop-shadow-lg sm:text-7xl">{flash}</span>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between gap-3 md:hidden">
        <TouchPad keys={k1} side="left" />
        {mode === 'local' && <TouchPad keys={k2} side="right" />}
      </div>
      <p className="hidden text-center text-xs text-muted-foreground md:block">
        {mode === 'local'
          ? '1. oyuncu: A / D hareket, W zıpla, S şut  -  2. oyuncu: ok tuşları, aşağı ok şut'
          : 'A / D veya ok tuşları ile hareket, W / yukarı ile zıpla, S / boşluk ile şut'}
      </p>
    </div>
  )
}
