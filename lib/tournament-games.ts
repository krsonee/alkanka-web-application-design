import { normalizeRules, rulesToList } from '@/lib/games/batak'
import { monoRulesToList, normalizeMonoRules } from '@/lib/games/monopoly'
import { normalizePapazRules, papazRulesToList } from '@/lib/games/papaz'
import { normalizePistiRules, normalizeTarget, pistiRulesToList } from '@/lib/games/pisti'
import type { TableOptions } from '@/lib/pvp/rules'

/**
 * The table a tournament match is played at, with the game's standard rules and nobody in a team:
 * two seats for a duel, `seats` at a shared table. Whoever opens the table says how many of the seats
 * are left to bots. The same options rebuild the board when a drawn duel is replayed.
 * Two-seat setups for the shared-table games stay for tournaments that started as duels before the change.
 */
export function tournamentTable(game: string, seats: number): TableOptions {
  const base: TableOptions = { seats, team: false, bots: 0 }
  if (game === 'tavla' || game === 'okey101') return { ...base, rounds: 1 }
  if (game === 'batak') return seats > 2 ? { ...base, rounds: 1, variant: 'klasik', extras: rulesToList(normalizeRules(undefined, 'klasik')) } : base
  if (game === 'pisti') return { ...base, variant: String(normalizeTarget(undefined)), extras: pistiRulesToList(normalizePistiRules(undefined)) }
  if (game === 'papaz') return { ...base, extras: papazRulesToList(normalizePapazRules(undefined)) }
  if (game === 'monopoly') return { ...base, rounds: 30, extras: monoRulesToList(normalizeMonoRules(undefined)) }
  return base
}
