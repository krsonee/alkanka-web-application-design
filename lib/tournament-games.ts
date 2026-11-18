import { normalizeRules, rulesToList } from '@/lib/games/batak'
import { monoRulesToList, normalizeMonoRules } from '@/lib/games/monopoly'
import { normalizePapazRules, papazRulesToList } from '@/lib/games/papaz'
import { normalizePistiRules, normalizeTarget, pistiRulesToList } from '@/lib/games/pisti'
import type { TableOptions } from '@/lib/pvp/rules'
import { cleanMatchLength } from '@/lib/tournaments-shared'

/**
 * The table a tournament match is played at, with the game's standard rules and nobody in a team:
 * two seats for a duel, `seats` at a shared table. Whoever opens the table says how many of the seats
 * are left to bots. The same options rebuild the board when a drawn duel is replayed.
 * Two-seat setups for the shared-table games stay for tournaments that started as duels before the change.
 * `length` is the tournament's match length; a game without that choice ignores it.
 */
export function tournamentTable(game: string, seats: number, length?: number | null): TableOptions {
  const base: TableOptions = { seats, team: false, bots: 0 }
  const rounds = cleanMatchLength(game, length)
  if (rounds !== null) return { ...base, rounds }
  if (game === 'okey101') return { ...base, rounds: 1 }
  if (game === 'batak') return seats > 2 ? { ...base, rounds: 1, variant: 'klasik', extras: rulesToList(normalizeRules(undefined, 'klasik')) } : base
  if (game === 'pisti') return { ...base, variant: String(normalizeTarget(undefined)), extras: pistiRulesToList(normalizePistiRules(undefined)) }
  if (game === 'papaz') return { ...base, extras: papazRulesToList(normalizePapazRules(undefined)) }
  if (game === 'monopoly') return { ...base, rounds: 30, extras: monoRulesToList(normalizeMonoRules(undefined)) }
  return base
}
