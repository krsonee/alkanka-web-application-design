import { bracketChampion, isDecided, isRealMatch, passedOn, type Bracket } from './bracket'

/**
 * One entrant's run through a knockout. `reached` is the last round the player was named for.
 * `noShow` counts matches lost by never sitting down; those are losses but not played matches.
 */
export type PlayerStat = {
  key: string
  played: number
  wins: number
  losses: number
  noShow: number
  reached: number
  state: 'champion' | 'in' | 'out'
}

/** Every entrant of a knockout, the champion first, then whoever got furthest. `order` is the entry order. */
export function knockoutStats(bracket: Bracket, order: string[]): PlayerStat[] {
  const table = new Map<string, PlayerStat>()
  const row = (key: string) => {
    let s = table.get(key)
    if (!s) {
      s = { key, played: 0, wins: 0, losses: 0, noShow: 0, reached: 0, state: 'in' }
      table.set(key, s)
    }
    return s
  }
  for (const key of order) row(key)
  bracket.rounds.forEach((round, ri) => {
    for (const m of round) {
      const named = m.players.filter((p): p is string => Boolean(p))
      for (const p of named) row(p).reached = Math.max(row(p).reached, ri)
      if (!isRealMatch(m) || !isDecided(m)) continue
      const through = m.void ? [] : passedOn(m)
      for (const p of named) {
        const s = row(p)
        const absent = m.noShow?.includes(p) === true
        if (absent) s.noShow++
        else s.played++
        if (through.includes(p)) s.wins++
        else {
          s.losses++
          s.state = 'out'
        }
      }
    }
  })
  const champion = bracketChampion(bracket)
  if (champion) row(champion).state = 'champion'
  const place = (key: string) => {
    const i = order.indexOf(key)
    return i < 0 ? Number.MAX_SAFE_INTEGER : i
  }
  const weight = (s: PlayerStat) => (s.state === 'champion' ? 2 : s.state === 'in' ? 1 : 0)
  return [...table.values()].sort((a, b) => weight(b) - weight(a) || b.reached - a.reached || b.wins - a.wins || place(a.key) - place(b.key))
}
