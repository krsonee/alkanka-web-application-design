import { NAMES, SUFFIX } from '@/lib/ambient-tables'
import { RL_BET_MS, type RouletteBet } from '@/lib/casino'

/** The table is topped up with house players until it holds about this many seats. */
const TARGET_MIN = 9
const TARGET_SPREAD = 8

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
export function roundBots(roundId: number, realCount: number, taken: Set<string>): RouletteBot[] {
  const r = rng(roundId * 2654435761)
  const target = TARGET_MIN + Math.floor(r() * TARGET_SPREAD)
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
