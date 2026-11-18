/**
 * `void`: nobody sat down in time, so the match has no winner and nobody advances from it.
 * `noShow`: the players who lost this match by never sitting down.
 * At a shared table (`Bracket.seats`): `pass` are the players who go through, best first, `rank` is the
 * whole table from best to worst, and `bye` marks a table with so few players that all of them go through unplayed.
 */
export type Match = {
  players: (string | null)[]
  winner: string | null
  void?: boolean
  noShow?: string[]
  pass?: string[]
  rank?: string[]
  bye?: boolean
}

/**
 * `group` matches of one round feed one match of the next. A duel bracket sends one winner up.
 * A shared-table bracket has `seats` players at a table and sends `pass` of them up; its final has one winner.
 */
export type Bracket = { group: number; rounds: Match[][]; seats?: number; pass?: number }

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

/**
 * Seats the entrants at shared tables. The fewest tables that hold everyone are used and the players are
 * dealt round them one by one, so the tables differ by one player at most.
 */
export function createTableBracket(names: string[], seats: number, pass: number): Bracket {
  const group = seats / pass
  let tables = 1
  while (tables * seats < names.length) tables *= group
  const empty = (): Match => ({ players: Array.from({ length: seats }, () => null), winner: null })
  const first = Array.from({ length: tables }, empty)
  shuffle(names).forEach((name, i) => {
    first[i % tables].players[Math.floor(i / tables)] = name
  })
  const rounds: Match[][] = [first]
  let count = tables
  while (count > 1) {
    count /= group
    rounds.push(Array.from({ length: count }, empty))
  }
  return normalizeBracket({ group, seats, pass, rounds })
}

const named = (m: Match) => m.players.filter((p): p is string => Boolean(p))

/** Played at a table rather than passed by a bye: two or more players are named for it. */
export const isRealMatch = (m: Match) => !m.bye && named(m).length >= 2

/** Played, forfeited or written off: nothing more will happen at this match. */
export const isDecided = (m: Match) => m.winner !== null || m.void === true

/** The players who leave this match for the next round. */
export const passedOn = (m: Match) => m.pass ?? (m.winner ? [m.winner] : [])

export function normalizeBracket(b: Bracket): Bracket {
  const rounds = b.rounds.map((r) => r.map((m) => ({ ...m, players: [...m.players] })))
  const dead = rounds.map((r) => r.map(() => false))
  const table = Boolean(b.seats)
  const pass = table ? Math.max(1, b.pass ?? 1) : 1
  rounds.forEach((round, ri) => {
    const final = ri === rounds.length - 1
    round.forEach((m, mi) => {
      let sourcesSettled = true
      if (ri > 0) {
        const src = rounds[ri - 1].slice(mi * b.group, mi * b.group + b.group)
        m.players = table ? src.flatMap((s) => Array.from({ length: pass }, (_, i) => passedOn(s)[i] ?? null)) : src.map((s) => s.winner)
        sourcesSettled = src.every((s, si) => s.winner !== null || s.void === true || dead[ri - 1][mi * b.group + si])
      }
      const real = named(m)
      if (m.winner && !real.includes(m.winner)) m.winner = null
      if (table) {
        // Too few players to be worth a table: all of them go through. At the final that is a lone player, the champion.
        const free = sourcesSettled && real.length > 0 && real.length <= (final ? 1 : pass)
        if (free) {
          m.bye = true
          m.winner = real[0]
          m.pass = real
          delete m.rank
        } else if (m.bye) {
          delete m.bye
          m.winner = null
        }
        if (!m.winner) {
          delete m.pass
          delete m.rank
        } else if (!m.bye) {
          m.pass = (m.pass ?? [m.winner]).filter((p) => real.includes(p)).slice(0, final ? 1 : pass)
          if (m.rank) m.rank = m.rank.filter((p) => real.includes(p))
        }
      } else if (sourcesSettled && real.length === 1) m.winner = real[0]
      // A write-off only stands while the players it was written for are still the ones named here.
      if (m.void && (real.length < 2 || m.winner || m.bye)) delete m.void
      if (m.noShow) {
        const gone = m.noShow.filter((p) => real.includes(p))
        if (gone.length && isDecided(m)) m.noShow = gone
        else delete m.noShow
      }
      if (sourcesSettled && real.length === 0) dead[ri][mi] = true
    })
  })
  return { ...b, rounds }
}

const copy = (b: Bracket): Bracket => ({ ...b, rounds: b.rounds.map((r) => r.map((m) => ({ ...m, players: [...m.players] }))) })

/** `noShow` names the players who lost by not sitting down; it is kept with the result. */
export function setMatchWinner(b: Bracket, round: number, match: number, winner: string | null, noShow: string[] = []): Bracket {
  const next = copy(b)
  const m = next.rounds[round]?.[match]
  if (!m) return b
  if (winner && !m.players.includes(winner)) return b
  m.winner = winner
  delete m.void
  delete m.pass
  delete m.rank
  if (winner && noShow.length) m.noShow = noShow
  else delete m.noShow
  return normalizeBracket(next)
}

/**
 * Writes the result of a shared table. `rank` is everyone who was named for the table, best first;
 * `through` are the players who finished it and go on, best first. A player who gave up, ran out of
 * time or never sat down is in `rank` but never in `through`.
 */
export function setTableResult(b: Bracket, round: number, match: number, rank: string[], through: string[], noShow: string[] = []): Bracket {
  const next = copy(b)
  const m = next.rounds[round]?.[match]
  if (!m || !through.length || through.some((p) => !m.players.includes(p))) return b
  const final = round === next.rounds.length - 1
  m.winner = through[0]
  m.pass = through.slice(0, final ? 1 : Math.max(1, b.pass ?? 1))
  const listed = rank.filter((p) => m.players.includes(p))
  m.rank = [...listed, ...named(m).filter((p) => !listed.includes(p))]
  delete m.void
  delete m.bye
  if (noShow.length) m.noShow = noShow
  else delete m.noShow
  return normalizeBracket(next)
}

/** Closes a match without a winner: its players are out and the next round gets nobody from here. */
export function voidMatch(b: Bracket, round: number, match: number, noShow: string[] = []): Bracket {
  const next = copy(b)
  const m = next.rounds[round]?.[match]
  if (!m || !isRealMatch(m) || m.winner) return b
  m.void = true
  if (noShow.length) m.noShow = noShow
  else delete m.noShow
  return normalizeBracket(next)
}

/**
 * The round being played: the first one with a match still to decide, once every earlier round is
 * settled. -1 when nothing is left to play or an earlier round is still waiting.
 */
export function openRound(b: Bracket) {
  const index = b.rounds.findIndex((round) => round.some((m) => isRealMatch(m) && !isDecided(m)))
  if (index < 0) return -1
  const earlierOpen = b.rounds.slice(0, index).some((round) => round.some((m) => !isDecided(m) && m.players.some(Boolean)))
  return earlierOpen ? -1 : index
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
