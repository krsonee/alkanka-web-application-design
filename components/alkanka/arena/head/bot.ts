import {
  FOOT,
  GOAL_DEPTH,
  GROUND,
  HEAD_R,
  METER_MAX,
  W,
  charAt,
  headY,
  noKeys,
  onGround,
  predictBall,
  statsOf,
  type BotLevel,
  type Keys,
  type World,
} from './engine'

export type BotMemory = {
  decideIn: number
  targetX: number
  kickCd: number
  kickHeld: boolean
  jumpCd: number
  powerWait: number
  cornerFor: number
  escapeTo: number | null
  escapeFor: number
}

export const newBotMemory = (): BotMemory => ({
  decideIn: 0,
  targetX: W / 2,
  kickCd: 0,
  kickHeld: false,
  jumpCd: 0,
  powerWait: -1,
  cornerFor: 0,
  escapeTo: null,
  escapeFor: 0,
})

/** react: steps between re-plans, noise: aim error in px, kick: chance to take a shot, slack: chance to idle a step. */
const LEVEL: Record<BotLevel, { react: number; noise: number; kick: number; slack: number; power: number; look: number }> = {
  easy: { react: 18, noise: 90, kick: 0.3, slack: 0.38, power: 300, look: 24 },
  mid: { react: 11, noise: 52, kick: 0.5, slack: 0.22, power: 180, look: 40 },
  hard: { react: 4, noise: 14, kick: 0.92, slack: 0.04, power: 40, look: 70 },
}

/**
 * Predictive bot: forecasts the ball, picks the earliest point it can reach on the far side of the ball
 * (so contact pushes the ball toward the rival goal), and defends its goal when a shot is coming.
 */
export function botInput(w: World, seat: 0 | 1, level: BotLevel, m: BotMemory): { keys: Keys; power: boolean } {
  const L = LEVEL[level]
  const k = noKeys()
  const me = w.p[seat]
  const rival = w.p[seat === 0 ? 1 : 0]
  const ball = w.ball
  const dir = seat === 1 ? -1 : 1
  const ownGoalX = seat === 1 ? W : 0
  const speed = 5.1 + 0.38 * statsOf(me).speed
  const path = predictBall(ball, w.sport, L.look)
  const lo = HEAD_R + GOAL_DEPTH * 0.6
  const hi = W - lo

  if (m.kickCd > 0) m.kickCd--
  if (m.jumpCd > 0) m.jumpCd--

  if (--m.decideIn <= 0) {
    m.decideIn = L.react
    const towardOwn = Math.sign(ball.vx) === -dir && Math.abs(ball.vx) > 2.5
    const ballBehind = (ball.x - me.x) * dir < -10
    let target: number | null = null

    if (towardOwn && ballBehind) {
      // Shot coming at goal with the bot on the wrong side: race back to the goal side of the ball.
      const pt = path[Math.min(path.length - 1, 18)]
      target = pt.x - dir * 50
    } else {
      for (let t = 4; t < path.length; t += 2) {
        const pt = path[t]
        if (pt.y < GROUND - FOOT - HEAD_R - 100) continue
        const want = pt.x - dir * 26
        if (Math.abs(want - me.x) <= speed * t + 10) {
          target = want
          break
        }
      }
      if (target === null) target = path[path.length - 1].x - dir * 26
    }
    // Goalkeeping: when the rival is clearly first to the ball, drop between the ball and the own goal instead of chasing.
    const rivalFirst = Math.abs(rival.x - ball.x) + 40 < Math.abs(me.x - ball.x)
    if (level !== 'easy' && rivalFirst && !ballBehind) target = ball.x - dir * Math.min(200, Math.abs(ball.x - ownGoalX) * 0.45)
    // The easy bot drifts home when the ball is deep in the other half.
    if (level === 'easy' && (ball.x - W / 2) * dir > 120) target = (target + (ownGoalX - dir * 220)) / 2
    target += (Math.random() - 0.5) * L.noise

    // Anti stalemate: pinning the ball in a corner for too long sends the bot out to open play.
    const inCorner = (ball.x < 130 || ball.x > W - 130) && ball.y > GROUND - 150 && Math.abs(ball.x - me.x) < 140
    m.cornerFor = inCorner ? m.cornerFor + L.react : 0
    if (m.escapeTo === null && m.cornerFor > (w.sport === 'basket' ? 50 : 110)) {
      m.escapeTo = W * (0.35 + Math.random() * 0.3)
      m.escapeFor = 70
      m.cornerFor = 0
    }
    m.targetX = Math.max(lo, Math.min(hi, target))
  }

  let targetX = m.targetX
  if (m.escapeTo !== null) {
    targetX = m.escapeTo
    if (--m.escapeFor <= 0) m.escapeTo = null
  }

  const slacking = Math.random() < L.slack
  if (!slacking) {
    if (me.x < targetX - 10) k.right = true
    else if (me.x > targetX + 10) k.left = true
    else if (me.face !== dir && Math.abs(ball.x - me.x) < 140) {
      // Turn to face the rival goal before contact.
      if (dir === 1) k.right = true
      else k.left = true
    }
  }

  const hy = headY(me)
  // Running back past a low ball would shove it into the own net: hop over it instead, or wait if it is right at the line.
  const behind = (ball.x - me.x) * dir < 0
  const runningBack = (k.left && dir === 1) || (k.right && dir === -1)
  const lowBall = ball.y > hy - 10
  if (behind && runningBack && lowBall && Math.abs(ball.x - me.x) < 120) {
    const nearOwnLine = Math.abs(ball.x - ownGoalX) < GOAL_DEPTH + 90
    if (nearOwnLine && level !== 'hard') {
      k.left = false
      k.right = false
    } else if (onGround(me) && m.jumpCd <= 0) {
      k.jump = true
      m.jumpCd = 26
    }
  }
  // Jump when the forecast puts the ball over the head within reach.
  if (onGround(me) && m.jumpCd <= 0) {
    for (let t = 8; t <= 18 && t < path.length; t += 2) {
      const pt = path[t]
      if (Math.abs(pt.x - me.x) < 58 && pt.y < hy - 18 && pt.y > hy - 125) {
        if (level !== 'easy' || Math.random() < 0.6) k.jump = true
        m.jumpCd = 22
        break
      }
    }
  }

  // Kick: one-step press, released next step, so it is a crisp tap and never a stuck charge.
  if (m.kickHeld) m.kickHeld = false
  else if (m.kickCd <= 0) {
    const ahead = (ball.x - me.x) * dir
    const low = ball.y > hy + 4
    const volley = !onGround(me) && ball.y > hy - 10
    if (ahead > 4 && ahead < 78 && (low || volley)) {
      if (Math.random() < L.kick) {
        k.kick = true
        m.kickHeld = true
      }
      m.kickCd = 18
    }
  }

  let power = false
  if (me.meter >= METER_MAX && !me.armed) {
    if (m.powerWait < 0) m.powerWait = Math.floor(L.power * (0.5 + Math.random()))
    if (m.powerWait > 0) m.powerWait--
    else {
      const id = charAt(me.ch).power
      const ballNear = Math.abs(ball.x - me.x) < 260
      const ballOwnHalf = (ball.x - W / 2) * dir < 0
      const ok =
        id === 'fire' || id === 'ghost'
          ? ballNear
          : id === 'shield'
            ? ballOwnHalf && Math.sign(ball.vx) === -dir
            : id === 'giant'
              ? ballNear
              : Math.abs(ball.x - rival.x) < 260 || ballOwnHalf
      if (ok) {
        power = true
        m.powerWait = -1
      }
    }
  }
  return { keys: k, power }
}
