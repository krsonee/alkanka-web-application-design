import { isDecided, isRealMatch, type Bracket } from './bracket'
import { MAX_LEAGUE_PLAYERS, leagueStandings } from './league'

type Format = 'eleme' | 'lig'

export const MAX_PRIZE_KC = 10_000_000
const MAX_LEAGUE_PRIZE_PLACES = 8

/** A knockout bracket only fills without byes at these sizes; a league needs an even field so nobody sits a week out. */
const KNOCKOUT_SIZES = [2, 4, 8, 16, 32, 64, 128, 256, 512, 1024]

export function playerOptions(format: Format): number[] {
  if (format === 'eleme') return KNOCKOUT_SIZES
  return Array.from({ length: MAX_LEAGUE_PLAYERS / 2 }, (_, i) => (i + 1) * 2)
}

export const isPlayerCount = (format: Format, n: number) => playerOptions(format).includes(n)

/** Nearest allowed size that still fits `n` players, for tournaments opened before the rule existed. */
export function snapPlayers(format: Format, n: number) {
  const options = playerOptions(format)
  return options.find((o) => o >= n) ?? options[options.length - 1]
}

export const playerRuleText = (format: Format) =>
  format === 'eleme'
    ? `Eleme turnuvasında kontenjan ${KNOCKOUT_SIZES.join(', ')} olabilir.`
    : `Lig turnuvasında kontenjan 2 ile ${MAX_LEAGUE_PLAYERS} arasında çift sayı olabilir.`

/** `count` is how many players can finish in that place: a knockout has no match to split the losing semi-finalists. */
export type PrizePlace = { label: string; hint: string; count: number }

export function prizePlaces(format: Format, maxPlayers: number): PrizePlace[] {
  if (format === 'lig') {
    return Array.from({ length: Math.max(1, Math.min(MAX_LEAGUE_PRIZE_PLACES, maxPlayers)) }, (_, i) => ({
      label: `${i + 1}.`,
      hint: i === 0 ? 'şampiyon' : 'puan durumuna göre',
      count: 1,
    }))
  }
  const places: PrizePlace[] = [
    { label: '1.', hint: 'şampiyon', count: 1 },
    { label: '2.', hint: 'finalde kaybeden', count: 1 },
  ]
  if (maxPlayers > 2) places.push({ label: '3.-4.', hint: 'yarı finalde elenenler, kişi başı', count: 2 })
  if (maxPlayers > 4) places.push({ label: '5.-8.', hint: 'çeyrek finalde elenenler, kişi başı', count: 4 })
  return places
}

/** Whole KC per place, cut to the places this tournament has, with empty trailing places dropped. */
export function cleanPrizes(raw: unknown, format: Format, maxPlayers: number): number[] {
  const list = Array.isArray(raw) ? raw : []
  const prizes = prizePlaces(format, maxPlayers).map((_, i) => {
    const n = Math.round(Number(list[i]))
    return Number.isFinite(n) && n > 0 ? Math.min(MAX_PRIZE_KC, n) : 0
  })
  while (prizes.length && prizes[prizes.length - 1] === 0) prizes.pop()
  return prizes
}

/** The most the tournament can pay out, reached when every prize place is filled. */
export function prizeTotal(format: Format, maxPlayers: number, prizes: number[]) {
  return prizePlaces(format, maxPlayers).reduce((sum, place, i) => sum + (prizes[i] ?? 0) * place.count, 0)
}

/** Tournaments from before ranking prizes paid the whole pool to the champion. */
export const effectivePrizes = (t: { prizes: number[]; prizePool: number }) =>
  t.prizes.length ? t.prizes : t.prizePool > 0 ? [t.prizePool] : []

/** `split` is how many players share the one prize of this place: two when a match was written off for both. */
export type Placement = { key: string; place: number; split?: number }

/** Everyone who sat down at one of their matches at least once. A bye is not a match. */
function attended(bracket: Bracket) {
  const seen = new Set<string>()
  for (const match of bracket.rounds.flat()) {
    if (!isRealMatch(match) || !isDecided(match)) continue
    for (const key of match.players as string[]) if (!match.noShow?.includes(key)) seen.add(key)
  }
  return seen
}

/**
 * Final ranking as prize-place indexes. Knockout losers of the same round share a place; a bye has no loser.
 * A player who never sat down at any match has no place, so no prize can be collected by only registering.
 */
export function tournamentPlacements(format: Format, bracket: Bracket | null, order: string[] = []): Placement[] {
  if (!bracket) return []
  const present = attended(bracket)
  if (format === 'lig') {
    return leagueStandings(bracket, order).flatMap((s, place) => (present.has(s.key) ? [{ key: s.key, place }] : []))
  }
  const last = bracket.rounds.length - 1
  const champion = bracket.rounds[last]?.[0]?.winner
  const out: Placement[] = champion ? [{ key: champion, place: 0 }] : []
  for (let r = last; r >= 0; r--) {
    for (const match of bracket.rounds[r]) {
      if (!isRealMatch(match) || !isDecided(match)) continue
      const place = last - r + 1
      for (const key of match.players as string[]) {
        if (key === match.winner || !present.has(key)) continue
        out.push(match.void ? { key, place, split: 2 } : { key, place })
      }
    }
  }
  return out
}

/** Knockout players nobody has beaten yet. When the clock stops the tournament they are still in it together. */
export function stillIn(bracket: Bracket | null): string[] {
  if (!bracket) return []
  const out = new Set<string>()
  for (const match of bracket.rounds.flat()) {
    if (!isRealMatch(match) || !isDecided(match)) continue
    for (const key of match.players as string[]) if (key !== match.winner) out.add(key)
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
  t: { format: Format; maxPlayers: number; prizes: number[]; prizePool: number },
  bracket: Bracket | null,
  order: string[] = [],
  cut = false,
): Payout[] {
  const prizes = effectivePrizes(t)
  const places = prizePlaces(t.format, t.maxPlayers)
  const out: Payout[] = tournamentPlacements(t.format, bracket, order).flatMap(({ key, place, split }) => {
    const amount = Math.floor((prizes[place] ?? 0) / (split ?? 1))
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
