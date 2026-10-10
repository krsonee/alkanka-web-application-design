import type { ArenaGame } from './arena'
import type { Bracket } from './bracket'

export const TOURNAMENT_STATUSES = ['kayit', 'basladi', 'bitti', 'iptal'] as const
export type TournamentStatus = (typeof TOURNAMENT_STATUSES)[number]

export const STATUS_LABEL: Record<TournamentStatus, string> = {
  kayit: 'Kayıtlar açık',
  basladi: 'Devam ediyor',
  bitti: 'Tamamlandı',
  iptal: 'İptal edildi',
}

export const MAX_TOURNAMENT_PLAYERS = 500

export type TournamentEntry = { id: number; userId: string | null; nickname: string; telegram: string; createdAt: string }

export type LiveMatch = { tableId: string; round: number; match: number; players: string[]; status: string }

export type Tournament = {
  id: number
  game: ArenaGame
  title: string
  description: string
  rules: string
  entryFee: number
  prizePool: number
  prizeNote: string
  maxPlayers: number
  startsAt: string
  status: TournamentStatus
  winner: string | null
  bracket: Bracket | null
  entries: TournamentEntry[]
  /** Player key (user id) to display name. */
  names: Record<string, string>
  liveMatches: LiveMatch[]
  currentRound: number | null
}

export const displayName = (t: Pick<Tournament, 'names'>, key: string | null) => (key ? (t.names[key] ?? key) : null)
