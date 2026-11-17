import type { ArenaGame } from './arena'
import { roundLabel, type Bracket } from './bracket'

export const TOURNAMENT_STATUSES = ['kayit', 'basladi', 'bitti', 'iptal'] as const
export type TournamentStatus = (typeof TOURNAMENT_STATUSES)[number]

export const STATUS_LABEL: Record<TournamentStatus, string> = {
  kayit: 'Kayıtlar açık',
  basladi: 'Devam ediyor',
  bitti: 'Tamamlandı',
  iptal: 'İptal edildi',
}

export const MAX_TOURNAMENT_PLAYERS = 1024

export const TOURNAMENT_FORMATS = ['eleme', 'lig'] as const
export type TournamentFormat = (typeof TOURNAMENT_FORMATS)[number]

export const FORMAT_LABEL: Record<TournamentFormat, string> = {
  eleme: 'Eleme (kaybeden elenir)',
  lig: 'Lig (herkes herkesle, puanlı)',
}

export const FORMAT_SHORT: Record<TournamentFormat, string> = { eleme: 'Eleme', lig: 'Lig' }

export const isTournamentFormat = (v: unknown): v is TournamentFormat => TOURNAMENT_FORMATS.includes(v as TournamentFormat)

export type TournamentEntry = { id: number; userId: string | null; nickname: string; telegram: string; createdAt: string }

export type LiveMatch = { tableId: string; round: number; match: number; players: string[]; status: string }

/** Rounds are stored from 0 and read from 1. A knockout names its last three rounds. */
export const roundName = (league: boolean, index: number, total: number) =>
  league || total < 1 ? `${index + 1}. tur` : roundLabel(index, total)

/** A tournament table the member is seated at and still has to play. */
export type MyMatch = { tableId: string; tournamentId: number; game: string; title: string; round: string }

/** Straight to the table: the game page opens the room named in `masa` without its stake screen. */
export const matchHref = (m: Pick<MyMatch, 'game' | 'tableId'>) => `/oyunlar/${m.game}?masa=${m.tableId}`

/** What a tournament table carries about its tournament, so the table screen needs no extra query. */
export type TableTour = { title: string; round: string; league: boolean }

export type Tournament = {
  id: number
  game: ArenaGame
  title: string
  description: string
  rules: string
  entryFee: number
  prizePool: number
  /** KC per finishing place, best first. Empty on older tournaments, where the champion takes the whole pool. */
  prizes: number[]
  prizeNote: string
  maxPlayers: number
  startsAt: string
  status: TournamentStatus
  format: TournamentFormat
  winner: string | null
  bracket: Bracket | null
  entries: TournamentEntry[]
  /** Player key (user id) to display name. */
  names: Record<string, string>
  liveMatches: LiveMatch[]
  currentRound: number | null
}

export const MAX_TOURNAMENT_TEMPLATES = 30

/** A tournament's settings without its date, players or results. `startTime` is Istanbul time, HH:MM. */
export type TournamentTemplate = {
  id: number
  name: string
  game: ArenaGame
  format: TournamentFormat
  title: string
  description: string
  rules: string
  entryFee: number
  prizePool: number
  prizes: number[]
  prizeNote: string
  maxPlayers: number
  startTime: string
}

export const displayName = (t: Pick<Tournament, 'names'>, key: string | null) => (key ? (t.names[key] ?? key) : null)
