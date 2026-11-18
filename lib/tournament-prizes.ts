import { bracketChampion, isDecided, isRealMatch, passedOn, type Bracket } from './bracket'
import { MAX_LEAGUE_PLAYERS, leagueStandings } from './league'
import { MAX_TOURNAMENT_PLAYERS, TABLE_PASS, type TournamentFormat } from './tournaments-shared'

type Format = TournamentFormat

export const MAX_PRIZE_KC = 10_000_000
/** The pool is stored as a 32-bit number, and a place deep in a big bracket is paid to hundreds of players. */
export const MAX_PRIZE_POOL_KC = 1_000_000_000

/** A knockout bracket only fills without byes at these sizes; a league needs an even field so nobody sits a week out. */
const KNOCKOUT_SIZES = [2, 4, 8, 16, 32, 64, 128, 256, 512, 1024]

/** `seats` is the table size: 2 for a duel, more at shared tables, where the field has to fill whole tables. */
export function playerOptions(format: Format, seats = 2): number[] {
  if (format === 'eleme') return KNOCKOUT_SIZES.filter((n) => n >= seats)
  // Nobody is paired in a points league, so its field is only a ceiling on the entries.
  if (format === 'puan') return KNOCKOUT_SIZES
  return Array.from({ length: MAX_LEAGUE_PLAYERS / 2 }, (_, i) => (i + 1) * 2)
}

export const isPlayerCount = (format: Format, n: number, seats = 2) => playerOptions(format, seats).includes(n)

/** Nearest allowed size that still fits `n` players, for tournaments opened before the rule existed. */
export function snapPlayers(format: Format, n: number, seats = 2) {
  const options = playerOptions(format, seats)
  return options.find((o) => o >= n) ?? options[options.length - 1]
}

export const playerRuleText = (format: Format, seats = 2) =>
  format === 'eleme'
    ? `${seats > 2 ? `${seats} kişilik masalarda oynanan turnuvada` : 'Eleme turnuvasında'} kontenjan ${playerOptions(format, seats).join(', ')} olabilir.`
    : format === 'puan'
      ? `Puan liginde kontenjan ${playerOptions(format).join(', ')} olabilir.`
      : `Fikstürlü ligde kontenjan 2 ile ${MAX_LEAGUE_PLAYERS} arasında çift sayı olabilir.`

/** `count` is how many players can finish in that place: a knockout has no match to split the losing semi-finalists. */
export type PrizePlace = { label: string; hint: string; count: number }

const TABLE_ORDINALS = ['ikinci', 'üçüncü', 'dördüncü', 'beşinci', 'altıncı', 'yedinci', 'sekizinci']

const ROUND_NAMES = ['yarı final', 'çeyrek final']

/**
 * Every place a prize can be written for: each player of a league, and in a knockout the final ranked
 * player by player followed by one shared place for the players each earlier round puts out.
 */
export function prizePlaces(format: Format, maxPlayers: number, seats = 2): PrizePlace[] {
  if (format !== 'eleme') {
    const most = format === 'lig' ? MAX_LEAGUE_PLAYERS : MAX_TOURNAMENT_PLAYERS
    return Array.from({ length: Math.max(1, Math.min(most, maxPlayers)) }, (_, i) => ({
      label: `${i + 1}.`,
      hint: i === 0 ? 'şampiyon' : 'puan durumuna göre',
      count: 1,
    }))
  }
  const shared = seats > 2
  const pass = shared ? TABLE_PASS : 1
  const places: PrizePlace[] = [{ label: '1.', hint: 'şampiyon', count: 1 }]
  // The final is ranked seat by seat; the rounds before it only say who went through.
  for (let i = 1; i < seats; i++) {
    places.push({ label: `${i + 1}.`, hint: shared ? `final masasında ${TABLE_ORDINALS[i - 1] ?? `${i + 1}.`}` : 'finalde kaybeden', count: 1 })
  }
  let taken = seats
  for (let back = 1, tables = seats / pass; tables * pass < maxPlayers; back++, tables *= seats / pass) {
    const count = tables * (seats - pass)
    const name = ROUND_NAMES[back - 1]
    const round = name ? (shared ? `${name} masalarında` : `${name}de`) : `son ${tables * seats} turunda`
    places.push({ label: `${taken + 1}.-${taken + count}.`, hint: `${round} elenenler, kişi başı`, count })
    taken += count
  }
  return places
}

/** Whole KC per place, cut to the places this tournament has, with empty trailing places dropped. */
export function cleanPrizes(raw: unknown, format: Format, maxPlayers: number, seats = 2): number[] {
  const list = Array.isArray(raw) ? raw : []
  const prizes = prizePlaces(format, maxPlayers, seats).map((_, i) => {
    const n = Math.round(Number(list[i]))
    return Number.isFinite(n) && n > 0 ? Math.min(MAX_PRIZE_KC, n) : 0
  })
  while (prizes.length && prizes[prizes.length - 1] === 0) prizes.pop()
  return prizes
}

/** The most the tournament can pay out, reached when every prize place is filled. */
export function prizeTotal(format: Format, maxPlayers: number, prizes: number[], seats = 2) {
  return prizePlaces(format, maxPlayers, seats).reduce((sum, place, i) => sum + (prizes[i] ?? 0) * place.count, 0)
}

/** Tournaments from before ranking prizes paid the whole pool to the champion. */
export const effectivePrizes = (t: { prizes: number[]; prizePool: number }) =>
  t.prizes.length ? t.prizes : t.prizePool > 0 ? [t.prizePool] : []

/**
 * `place` is the prize place the player is listed under. A match written off for everybody at it has no
 * single owner for its places: those players split the prizes of `places` in `split` equal parts.
 */
export type Placement = { key: string; place: number; split?: number; places?: number[] }

/** Everyone who sat down at one of their matches at least once. A bye is not a match. */
function attended(bracket: Bracket) {
  const seen = new Set<string>()
  for (const match of bracket.rounds.flat()) {
    if (!isRealMatch(match) || !isDecided(match)) continue
    for (const key of match.players) if (key && !match.noShow?.includes(key)) seen.add(key)
  }
  return seen
}

/**
 * Final ranking as prize-place indexes. The final is ranked player by player; losers of an earlier round
 * share a place; a bye has no loser. A player who never sat down at any match has no place, so no prize
 * can be collected by only registering.
 */
export function tournamentPlacements(format: Format, bracket: Bracket | null, order: string[] = []): Placement[] {
  if (!bracket) return []
  // A points league is ranked by its closing table; only a player with a counted game has a place.
  if (format === 'puan') return (bracket.table ?? []).flatMap((row, place) => (row.played > 0 ? [{ key: row.key, place }] : []))
  const present = attended(bracket)
  if (format === 'lig') {
    return leagueStandings(bracket, order).flatMap((s, place) => (present.has(s.key) ? [{ key: s.key, place }] : []))
  }
  const seats = bracket.seats ?? 2
  const pass = bracket.seats ? Math.max(1, bracket.pass ?? 1) : 1
  const last = bracket.rounds.length - 1
  const champion = bracketChampion(bracket)
  const out: Placement[] = champion ? [{ key: champion, place: 0 }] : []
  for (let r = last; r >= 0; r--) {
    for (const match of bracket.rounds[r]) {
      if (!isRealMatch(match) || !isDecided(match)) continue
      const players = match.players.filter((p): p is string => Boolean(p))
      if (r === last) {
        if (match.void) {
          const places = players.slice(1).map((_, i) => i + 1)
          for (const key of players) if (present.has(key)) out.push({ key, place: 1, places, split: players.length })
          continue
        }
        const ranked = (match.rank ?? players).filter((key) => key !== match.winner)
        ranked.forEach((key, i) => {
          if (present.has(key)) out.push({ key, place: i + 1 })
        })
        continue
      }
      const place = seats - 1 + (last - r)
      const through = passedOn(match)
      const places = Array.from({ length: Math.max(1, players.length - pass) }, () => place)
      for (const key of players) {
        if (through.includes(key) || !present.has(key)) continue
        out.push(match.void ? { key, place, places, split: players.length } : { key, place })
      }
    }
  }
  return out
}

/** Knockout players nobody has put out yet. When the clock stops the tournament they are still in it together. */
export function stillIn(bracket: Bracket | null): string[] {
  if (!bracket) return []
  const out = new Set<string>()
  for (const match of bracket.rounds.flat()) {
    if (!isRealMatch(match) || !isDecided(match)) continue
    const through = passedOn(match)
    for (const key of match.players) if (key && !through.includes(key)) out.add(key)
  }
  const entrants = (bracket.rounds[0] ?? []).flatMap((m) => m.players).filter((p): p is string => Boolean(p))
  return entrants.filter((key) => !out.has(key))
}

export type Payout = { key: string; place: number; amount: number; label: string; shared?: boolean }

/**
 * Who is owed what once the tournament is over. Places without a prize are left out.
 * `cut` is a knockout stopped by its end time before a champion was found: the players still in it
 * split, in equal parts, the prizes of the top places they would have filled between them.
 */
export function tournamentPayouts(
  t: { format: Format; maxPlayers: number; prizes: number[]; prizePool: number; tableSize?: number },
  bracket: Bracket | null,
  order: string[] = [],
  cut = false,
): Payout[] {
  const prizes = effectivePrizes(t)
  const places = prizePlaces(t.format, t.maxPlayers, bracket?.seats ?? t.tableSize ?? 2)
  const out: Payout[] = tournamentPlacements(t.format, bracket, order).flatMap(({ key, place, split, places: shared }) => {
    const sum = (shared ?? [place]).reduce((total, p) => total + (prizes[p] ?? 0), 0)
    const amount = Math.floor(sum / (split ?? 1))
    return amount > 0 ? [{ key, place, amount, label: places[place]?.label ?? `${place + 1}.` }] : []
  })
  if (!cut || t.format !== 'eleme' || !bracket || out.some((p) => p.place === 0)) return out
  const left = stillIn(bracket)
  if (!left.length) return out
  const seats = places.flatMap((place, i) => Array.from({ length: place.count }, () => prizes[i] ?? 0))
  const share = Math.floor(seats.slice(0, left.length).reduce((sum, amount) => sum + amount, 0) / left.length)
  if (share > 0) for (const key of left) out.push({ key, place: -1, amount: share, label: 'paylaşım', shared: true })
  return out
}
