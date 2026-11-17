import type { Bracket } from './bracket'
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

export type Placement = { key: string; place: number }

/** Final ranking as prize-place indexes. Knockout losers of the same round share a place; a bye has no loser. */
export function tournamentPlacements(format: Format, bracket: Bracket | null, order: string[] = []): Placement[] {
  if (!bracket) return []
  if (format === 'lig') return leagueStandings(bracket, order).map((s, place) => ({ key: s.key, place }))
  const last = bracket.rounds.length - 1
  const champion = bracket.rounds[last]?.[0]?.winner
  if (!champion) return []
  const out: Placement[] = [{ key: champion, place: 0 }]
  for (let r = last; r >= 0; r--) {
    for (const match of bracket.rounds[r]) {
      const real = match.players.filter((p): p is string => Boolean(p))
      if (real.length !== 2 || !match.winner) continue
      for (const key of real) if (key !== match.winner) out.push({ key, place: last - r + 1 })
    }
  }
  return out
}

/** Who is owed what once the tournament is over. Places without a prize are left out. */
export function tournamentPayouts(t: { format: Format; maxPlayers: number; prizes: number[]; prizePool: number }, bracket: Bracket | null, order: string[] = []) {
  const prizes = effectivePrizes(t)
  const places = prizePlaces(t.format, t.maxPlayers)
  return tournamentPlacements(t.format, bracket, order).flatMap(({ key, place }) => {
    const amount = prizes[place] ?? 0
    return amount > 0 ? [{ key, place, amount, label: places[place]?.label ?? `${place + 1}.` }] : []
  })
}
