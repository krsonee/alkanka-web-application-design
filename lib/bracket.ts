/**
 * `void`: neither player sat down in time, so the match has no winner and nobody advances from it.
 * `noShow`: the players who lost this match by never sitting down.
 */
export type Match = { players: (string | null)[]; winner: string | null; void?: boolean; noShow?: string[] }
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

/** Two players are named for this match, so it is played at a table rather than passed by a bye. */
export const isRealMatch = (m: Match) => m.players.filter(Boolean).length === 2

/** Played, forfeited or written off: nothing more will happen at this match. */
export const isDecided = (m: Match) => m.winner !== null || m.void === true

export function normalizeBracket(b: Bracket): Bracket {
  const rounds = b.rounds.map((r) => r.map((m) => ({ ...m, players: [...m.players] })))
  const dead = rounds.map((r) => r.map(() => false))
  rounds.forEach((round, ri) => {
    round.forEach((m, mi) => {
      let sourcesSettled = true
      if (ri > 0) {
        const src = rounds[ri - 1].slice(mi * b.group, mi * b.group + b.group)
        m.players = src.map((s) => s.winner)
        sourcesSettled = src.every((s, si) => s.winner !== null || s.void === true || dead[ri - 1][mi * b.group + si])
      }
      const real = m.players.filter((p): p is string => Boolean(p))
      if (m.winner && !real.includes(m.winner)) m.winner = null
      // A write-off only stands while both of its players are still the ones named here.
      if (m.void && (real.length !== 2 || m.winner)) delete m.void
      if (m.noShow) {
        const gone = m.noShow.filter((p) => real.includes(p))
        if (gone.length && isDecided(m)) m.noShow = gone
        else delete m.noShow
      }
      if (sourcesSettled && real.length === 0) dead[ri][mi] = true
      if (sourcesSettled && real.length === 1) m.winner = real[0]
    })
  })
  return { group: b.group, rounds }
}

const copy = (b: Bracket): Bracket => ({ group: b.group, rounds: b.rounds.map((r) => r.map((m) => ({ ...m, players: [...m.players] }))) })

/** `noShow` names the players who lost by not sitting down; it is kept with the result. */
export function setMatchWinner(b: Bracket, round: number, match: number, winner: string | null, noShow: string[] = []): Bracket {
  const next = copy(b)
  const m = next.rounds[round]?.[match]
  if (!m) return b
  if (winner && !m.players.includes(winner)) return b
  m.winner = winner
  delete m.void
  if (winner && noShow.length) m.noShow = noShow
  else delete m.noShow
  return normalizeBracket(next)
}

/** Closes a match without a winner: both players are out and the next round gets nobody from here. */
export function voidMatch(b: Bracket, round: number, match: number, noShow: string[] = []): Bracket {
  const next = copy(b)
  const m = next.rounds[round]?.[match]
  if (!m || !isRealMatch(m) || m.winner) return b
  m.void = true
  if (noShow.length) m.noShow = noShow
  else delete m.noShow
  return normalizeBracket(next)
}

export function bracketChampion(b: Bracket | null) {
  if (!b) return null
  return b.rounds[b.rounds.length - 1]?.[0]?.winner ?? null
}

/**
 * Nothing is left to play. A knockout usually ends with a champion, but ends without one when the
 * last players standing were written off together.
 */
export function bracketOver(b: Bracket | null) {
  if (!b) return false
  return !b.rounds.some((round) => round.some((m) => isRealMatch(m) && !isDecided(m)))
}

/** Somebody beat somebody. A tournament where this never happened was not played at all. */
export function anyWin(b: Bracket | null) {
  return Boolean(b?.rounds.some((round) => round.some((m) => isRealMatch(m) && m.winner !== null)))
}

export function roundLabel(index: number, total: number) {
  const fromEnd = total - index
  if (fromEnd === 1) return 'Final'
  if (fromEnd === 2) return 'Yarı final'
  if (fromEnd === 3) return 'Çeyrek final'
  return `${index + 1}. tur`
}
