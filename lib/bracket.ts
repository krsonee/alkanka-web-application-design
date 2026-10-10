export type Match = { players: (string | null)[]; winner: string | null }
export type Bracket = { group: number; rounds: Match[][] }

function shuffle<T>(list: T[]) {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function createBracket(names: string[], group: number): Bracket {
  let size = group
  while (size < names.length) size *= group
  const seeded = shuffle(names)
  const slots: (string | null)[] = Array.from({ length: size }, () => null)
  // Spread byes so no table starts empty: fill one player per table first, then the rest.
  const tables = size / group
  seeded.forEach((name, i) => {
    const table = i % tables
    const seat = Math.floor(i / tables)
    slots[table * group + seat] = name
  })
  const rounds: Match[][] = []
  let count = tables
  rounds.push(Array.from({ length: count }, (_, t) => ({ players: slots.slice(t * group, t * group + group), winner: null })))
  while (count > 1) {
    count /= group
    rounds.push(Array.from({ length: count }, () => ({ players: Array.from({ length: group }, () => null), winner: null })))
  }
  return normalizeBracket({ group, rounds })
}

export function normalizeBracket(b: Bracket): Bracket {
  const rounds = b.rounds.map((r) => r.map((m) => ({ players: [...m.players], winner: m.winner })))
  const dead = rounds.map((r) => r.map(() => false))
  rounds.forEach((round, ri) => {
    round.forEach((m, mi) => {
      let sourcesSettled = true
      if (ri > 0) {
        const src = rounds[ri - 1].slice(mi * b.group, mi * b.group + b.group)
        m.players = src.map((s) => s.winner)
        sourcesSettled = src.every((s, si) => s.winner !== null || dead[ri - 1][mi * b.group + si])
      }
      const real = m.players.filter((p): p is string => Boolean(p))
      if (m.winner && !real.includes(m.winner)) m.winner = null
      if (sourcesSettled && real.length === 0) dead[ri][mi] = true
      if (sourcesSettled && real.length === 1) m.winner = real[0]
    })
  })
  return { group: b.group, rounds }
}

export function setMatchWinner(b: Bracket, round: number, match: number, winner: string | null): Bracket {
  const next = { group: b.group, rounds: b.rounds.map((r) => r.map((m) => ({ ...m, players: [...m.players] }))) }
  const m = next.rounds[round]?.[match]
  if (!m) return b
  if (winner && !m.players.includes(winner)) return b
  m.winner = winner
  return normalizeBracket(next)
}

export function bracketChampion(b: Bracket | null) {
  if (!b) return null
  return b.rounds[b.rounds.length - 1]?.[0]?.winner ?? null
}

export function roundLabel(index: number, total: number) {
  const fromEnd = total - index
  if (fromEnd === 1) return 'Final'
  if (fromEnd === 2) return 'Yarı final'
  if (fromEnd === 3) return 'Çeyrek final'
  return `${index + 1}. tur`
}
