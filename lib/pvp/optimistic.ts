import { isWinningHand, okeyFrom } from '@/components/alkanka/arena/okey-engine'
import type { OkeyState } from '@/lib/pvp/rules'

type Action = { type: string; [k: string]: unknown }
type OkeyView = OkeyState & { handCounts?: number[] }

/**
 * The table as it will look once the server accepts this move, for the moves whose result the player's own
 * view already decides. Null means the result depends on something hidden or random, so wait for the server.
 */
export function optimisticState(game: string, seat: number, state: unknown, action: Action): unknown | null {
  if (game !== 'okey' || action.type !== 'discard' || seat < 0) return null
  const s = state as OkeyView | null
  if (!s || s.kind !== 'okey' || s.turn !== seat || s.phase !== 'discard') return null
  const tile = s.hands[seat]?.find((t) => t.id === action.tileId)
  if (!tile || tile.id === s.takenId) return null
  const rest = s.hands[seat].filter((t) => t.id !== tile.id)
  // A closing tile ends the hand and reveals it, which only the server can settle.
  if (isWinningHand(rest, okeyFrom(s.indicator))) return null
  const n = s.seats ?? s.hands.length
  return {
    ...s,
    hands: s.hands.map((h, i) => (i === seat ? rest : h)),
    discards: s.discards.map((d, i) => (i === seat ? [...d, tile] : d)),
    handCounts: s.handCounts?.map((c, i) => (i === seat ? c - 1 : c)),
    turn: (seat + 1) % n,
    phase: 'draw',
    takenId: null,
  }
}
