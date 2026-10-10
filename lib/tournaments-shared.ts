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

export type Tournament = {
  id: number
  game: ArenaGame
  title: string
  description: string
  entryFee: number
  prizePool: number
  prizeNote: string
  maxPlayers: number
  startsAt: string
  status: TournamentStatus
  winner: string | null
  bracket: Bracket | null
  entries: { id: number; nickname: string; telegram: string; createdAt: string }[]
}
