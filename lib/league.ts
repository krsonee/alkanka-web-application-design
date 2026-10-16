import type { Bracket, Match } from './bracket'

export const LEAGUE_WIN_POINTS = 3
export const MAX_LEAGUE_PLAYERS = 16

export type Standing = { key: string; played: number; wins: number; losses: number; points: number; remaining: number }

function shuffle<T>(list: T[]) {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Round-robin schedule (circle method): everyone meets everyone exactly once, byes are left out. */
export function createLeague(keys: string[]): Bracket {
  const players: (string | null)[] = shuffle(keys)
  if (players.length % 2) players.push(null)
  const n = players.length
  const rounds: Match[][] = []
  for (let r = 0; r < n - 1; r++) {
    const round: Match[] = []
    for (let i = 0; i < n / 2; i++) {
      const a = players[i]
      const b = players[n - 1 - i]
      if (a && b) round.push({ players: r % 2 ? [b, a] : [a, b], winner: null })
    }
    rounds.push(round)
    players.splice(1, 0, players.pop()!)
  }
  return { group: 2, rounds }
}

export function setLeagueWinner(b: Bracket, round: number, match: number, winner: string | null): Bracket {
  const m = b.rounds[round]?.[match]
  if (!m || (winner && !m.players.includes(winner))) return b
  return {
    group: b.group,
    rounds: b.rounds.map((r, ri) => r.map((x, mi) => (ri === round && mi === match ? { ...x, winner } : { ...x, players: [...x.players] }))),
  }
}

const allMatches = (b: Bracket) => b.rounds.flat().filter((m) => m.players.filter(Boolean).length === 2)

/** Sorted by points, then head-to-head points among the tied players, then registration order. */
export function leagueStandings(b: Bracket, order: string[] = []): Standing[] {
  const table = new Map<string, Standing>()
  const row = (key: string) => {
    if (!table.has(key)) table.set(key, { key, played: 0, wins: 0, losses: 0, points: 0, remaining: 0 })
    return table.get(key)!
  }
  const matches = allMatches(b)
  for (const m of matches) {
    for (const p of m.players as string[]) {
      const s = row(p)
      if (!m.winner) s.remaining++
      else {
        s.played++
        if (m.winner === p) {
          s.wins++
          s.points += LEAGUE_WIN_POINTS
        } else s.losses++
      }
    }
  }
  const headToHead = (key: string, group: Set<string>) =>
    matches.filter((m) => m.winner === key && m.players.every((p) => p && group.has(p))).length
  const rank = (key: string) => {
    const i = order.indexOf(key)
    return i < 0 ? Number.MAX_SAFE_INTEGER : i
  }
  const list = [...table.values()]
  return list.sort((x, y) => {
    if (y.points !== x.points) return y.points - x.points
    const tied = new Set(list.filter((s) => s.points === x.points).map((s) => s.key))
    const h = headToHead(y.key, tied) - headToHead(x.key, tied)
    return h || rank(x.key) - rank(y.key)
  })
}

export function leagueChampion(b: Bracket | null, order: string[] = []) {
  if (!b) return null
  const matches = allMatches(b)
  if (!matches.length || matches.some((m) => !m.winner)) return null
  return leagueStandings(b, order)[0]?.key ?? null
}
