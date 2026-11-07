import { createHash } from 'node:crypto'
import { getTableRow } from '@/lib/pvp/tables'

/** The other seated human at a live duel table, or null when `userId` is not seated there. */
export async function opponentOf(room: string, userId: string) {
  const t = await getTableRow(room)
  if (!t || t.status === 'iptal' || t.status === 'bitti') return null
  const humans = t.players.filter((p) => !p.bot)
  if (!humans.some((p) => p.id === userId)) return null
  return humans.find((p) => p.id !== userId)?.id ?? null
}

/** Postgres LISTEN/NOTIFY channel that delivers duel frames addressed to `userId` at `room`. */
export function duelChannel(room: string, userId: string) {
  return `duel_${createHash('sha1').update(`${room}|${userId}`).digest('hex')}`
}
