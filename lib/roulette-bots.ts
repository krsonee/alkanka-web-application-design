import { NAMES, SUFFIX } from '@/lib/ambient-tables'
import { RL_BET_MS, type RouletteBet } from '@/lib/casino'

/** Average seats at each Istanbul hour (0-23): empty before dawn, peaks in the evening. */
const SEATS_BY_HOUR = [9, 6, 3, 1.2, 0.4, 0.3, 0.8, 1.6, 2.5, 3.5, 4.5, 5.5, 6.5, 7, 7, 7.5, 8.5, 9.5, 11, 13, 15, 16, 15, 12.5]
const ISTANBUL_OFFSET_MS = 3 * 60 * 60 * 1000

/** Expected seat count for the current Istanbul time, interpolated between hours so the crowd changes gradually. */
function expectedSeats(nowMs: number) {
  const local = new Date(nowMs + ISTANBUL_OFFSET_MS)
  const hour = local.getUTCHours()
  const t = local.getUTCMinutes() / 60
  const base = SEATS_BY_HOUR[hour] * (1 - t) + SEATS_BY_HOUR[(hour + 1) % 24] * t
  const day = local.getUTCDay()
  const weekend = day === 0 || day === 6 || (day === 5 && hour >= 18)
  return base * (weekend ? 1.2 : 1)
}

function seatTarget(r: () => number, nowMs: number) {
  const expected = expectedSeats(nowMs)
  if (expected < 2 && r() > expected / 2) return 0
  const jitter = 0.7 + r() * 0.6
  return Math.max(0, Math.round(expected * jitter))
}

export type RouletteBot = { name: string; bets: RouletteBet[]; total: number; joinsAtMs: number }

function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const pick = <T,>(r: () => number, list: readonly T[]) => list[Math.floor(r() * list.length)]

const OUTSIDE: RouletteBet['kind'][] = ['red', 'black', 'even', 'odd', 'low', 'high']
const SMALL = [10, 10, 25, 25, 50, 50, 100] as const
const BIG = [100, 250, 250, 500, 1000] as const

function botBet(r: () => number, highRoller: boolean): RouletteBet {
  const amount = pick(r, highRoller ? BIG : SMALL)
  const roll = r()
  if (roll < 0.45) return { kind: pick(r, OUTSIDE), amount }
  if (roll < 0.65) return { kind: r() < 0.5 ? 'dozen' : 'column', value: 1 + Math.floor(r() * 3), amount }
  return { kind: 'number', value: Math.floor(r() * 37), amount: Math.max(10, Math.round(amount / 2 / 5) * 5) }
}

/**
 * House players for one round. Seeded by the round id so every viewer sees the same table, and they never touch
 * balances or the database. Real players keep their seats; bots only fill what is left up to the target size.
 */
export function roundBots(roundId: number, realCount: number, taken: Set<string>, nowMs = Date.now()): RouletteBot[] {
  const r = rng(roundId * 2654435761)
  const target = seatTarget(r, nowMs)
  const count = Math.max(0, target - realCount)
  const used = new Set(taken)
  const bots: RouletteBot[] = []
  for (let i = 0; i < count; i++) {
    let name = ''
    for (let tries = 0; tries < 20; tries++) {
      name = pick(r, NAMES) + pick(r, SUFFIX)
      if (!used.has(name)) break
    }
    used.add(name)
    const highRoller = r() < 0.2
    const merged = new Map<string, RouletteBet>()
    const spots = 1 + Math.floor(r() * 4)
    for (let s = 0; s < spots; s++) {
      const b = botBet(r, highRoller)
      const key = `${b.kind}:${b.value ?? ''}`
      const prev = merged.get(key)
      merged.set(key, prev ? { ...prev, amount: prev.amount + b.amount } : b)
    }
    const bets = [...merged.values()]
    bots.push({ name, bets, total: bets.reduce((a, b) => a + b.amount, 0), joinsAtMs: i < Math.ceil(count * 0.4) ? 0 : Math.floor(r() * RL_BET_MS * 0.8) })
  }
  return bots
}
