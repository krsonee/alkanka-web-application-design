import { monoRulesToList, normalizeMonoRules } from '@/lib/games/monopoly'
import { normalizePapazRules, papazRulesToList } from '@/lib/games/papaz'
import { normalizePistiRules, normalizeTarget, pistiRulesToList } from '@/lib/games/pisti'
import type { TableOptions } from '@/lib/pvp/rules'
import { canHostTournament } from './tournaments-shared'

/**
 * The table a tournament match is played at: always two seats, no bots, the game's standard rules.
 * Null for a game that cannot be played by two. The same options rebuild the board when a draw is replayed.
 */
export function tournamentTable(game: string): TableOptions | null {
  if (!canHostTournament(game)) return null
  const base: TableOptions = { seats: 2, team: false, bots: 0 }
  if (game === 'tavla' || game === 'okey101') return { ...base, rounds: 1 }
  if (game === 'pisti') return { ...base, variant: String(normalizeTarget(undefined)), extras: pistiRulesToList(normalizePistiRules(undefined)) }
  if (game === 'papaz') return { ...base, extras: papazRulesToList(normalizePapazRules(undefined)) }
  if (game === 'monopoly') return { ...base, rounds: 30, extras: monoRulesToList(normalizeMonoRules(undefined)) }
  return base
}
