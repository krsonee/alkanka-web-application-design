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

/**
 * The game name on history rows for entry fees, refunds and prizes. Queries that count played games
 * leave this name out (as the literal 'turnuva'); the matches themselves are logged under the real game.
 */
export const TOURNAMENT_MONEY_GAME = 'turnuva'

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

/**
 * A tournament table the member is seated at and still has to play. `joinBy` is set while the member
 * has not sat down yet: after that moment the match is forfeited.
 */
export type MyMatch = { tableId: string; tournamentId: number; game: string; title: string; round: string; joinBy: string | null }

/** Straight to the table: the game page opens the room named in `masa` without its stake screen. */
export const matchHref = (m: Pick<MyMatch, 'game' | 'tableId'>) => `/oyunlar/${m.game}?masa=${m.tableId}`

/**
 * What a tournament table carries about its tournament, so the table screen needs no extra query.
 * Tables opened before the time rules existed have no `joinBy`; none of those rules apply to them.
 */
export type TableTour = { title: string; round: string; league: boolean; joinBy?: string }

/** Minutes a player has to sit down at a match once its table opens. */
export const JOIN_MINUTES = [3, 5, 10, 15] as const
export const DEFAULT_JOIN_MINUTES = 5
export const cleanJoinMinutes = (v: unknown) => ((JOIN_MINUTES as readonly number[]).includes(Number(v)) ? Number(v) : DEFAULT_JOIN_MINUTES)

/** The shortest tournament the panel accepts, from start to end. */
export const MIN_TOURNAMENT_MINUTES = 10

/** How a tournament table closed when it was not simply played to the end. */
export type MatchEnd = 'gelmedi' | 'sure' | 'pes' | 'panel' | 'bitis' | 'iptal'

export const MATCH_END_LABEL: Record<MatchEnd, string> = {
  gelmedi: 'hükmen, masaya gelmedi',
  sure: 'hükmen, hamle süresi',
  pes: 'pes etti',
  panel: 'sonucu yönetim girdi',
  bitis: 'turnuva süresi doldu',
  iptal: 'turnuva iptal',
}

/** Why a tournament closed. The first two are finished tournaments, the rest are cancellations. */
export type FinishReason = 'tamam' | 'sure' | 'kayit-yok' | 'oynanmadi' | 'gec' | 'oyun' | 'panel'

export const FINISH_LABEL: Record<FinishReason, string> = {
  tamam: 'Bütün maçlar oynandı',
  sure: 'Bitiş saati geldi',
  'kayit-yok': 'Başlangıç saatinde 2 kişiden az kayıt vardı',
  oynanmadi: 'Hiçbir maç oynanmadı',
  gec: 'Başlangıç saati kaçtı, bitiş saati de geçmişti',
  oyun: 'Bu oyun turnuvada birebir oynanamıyor',
  panel: 'Panelden iptal edildi',
}

export const isFinishReason = (v: unknown): v is FinishReason => typeof v === 'string' && v in FINISH_LABEL

/** Games that cannot be played by two players, so a tournament cannot pair them. */
const NOT_HEAD_TO_HEAD: readonly string[] = ['batak']
export const canHostTournament = (game: string) => !NOT_HEAD_TO_HEAD.includes(game)

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
  /** Open matches close and the result is written at this moment. Null on tournaments from before end times. */
  endsAt: string | null
  joinMinutes: number
  finishedAt: string | null
  finishReason: FinishReason | null
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
