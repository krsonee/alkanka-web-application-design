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
 * has not sat down yet: after that moment the match is forfeited. `seated` says the member has opened the table.
 */
export type MyMatch = { tableId: string; tournamentId: number; game: string; title: string; round: string; joinBy: string | null; seated: boolean; shared?: boolean }

/** Straight to the table: the game page opens the room named in `masa` without its stake screen. */
export const matchHref = (m: Pick<MyMatch, 'game' | 'tableId'>) => `/oyunlar/${m.game}?masa=${m.tableId}`

/**
 * What a tournament table carries about its tournament, so the table screen needs no extra query.
 * Tables opened before the time rules existed have no `joinBy`; none of those rules apply to them.
 * `pass` is set on a shared table: how many of its players go through, one at the final.
 */
export type TableTour = { title: string; round: string; league: boolean; joinBy?: string; pass?: number }

/** Minutes a player has to sit down at a match once its table opens. */
export const JOIN_MINUTES = [3, 5, 10, 15] as const
export const DEFAULT_JOIN_MINUTES = 5
export const cleanJoinMinutes = (v: unknown) => ((JOIN_MINUTES as readonly number[]).includes(Number(v)) ? Number(v) : DEFAULT_JOIN_MINUTES)

/** The shortest tournament the panel accepts, from start to end. */
export const MIN_TOURNAMENT_MINUTES = 10

/** How a tournament table closed when it was not simply played to the end. */
export type MatchEnd = 'gelmedi' | 'sure' | 'pes' | 'panel' | 'bitis' | 'iptal'

/**
 * The mode on the history rows of a tournament match. A result written from the panel is kept apart:
 * it shows in the member's history, but nobody played it, so nothing that counts played or won games
 * picks it up (those queries leave the literal 'admin' out).
 */
export const matchHistoryMode = (how?: MatchEnd | null) => (how === 'panel' ? 'admin' : 'turnuva')

export const MATCH_END_LABEL: Record<MatchEnd, string> = {
  gelmedi: 'hükmen, masaya gelmedi',
  sure: 'hükmen, hamle süresi',
  pes: 'pes',
  panel: 'sonucu yönetim girdi',
  bitis: 'turnuva süresi doldu',
  iptal: 'turnuva iptal',
}

/**
 * One tournament table as the panel lists it. `arrived`: the player opened the table. `out`: the player
 * left a shared table before it finished. `started`: everyone due had sat down, so the move clock ran.
 */
export type MatchRecord = {
  tableId: string
  round: number
  roundName: string
  match: number
  seats: number
  status: 'oynaniyor' | 'bitti' | 'iptal'
  players: { id: string; name: string; arrived: boolean; winner: boolean; out: MatchEnd | null }[]
  how: MatchEnd | null
  started: boolean
  moves: number
  openedAt: string
  closedAt: string | null
  joinBy: string | null
}

/** Why a tournament closed. The first two are finished tournaments, the rest are cancellations. */
export type FinishReason = 'tamam' | 'sure' | 'kayit-yok' | 'oynanmadi' | 'gec' | 'oyun' | 'panel'

export const FINISH_LABEL: Record<FinishReason, string> = {
  tamam: 'Bütün maçlar oynandı',
  sure: 'Bitiş saati geldi',
  'kayit-yok': 'Başlangıç saatinde yeterli kayıt yoktu',
  oynanmadi: 'Hiçbir maç oynanmadı',
  gec: 'Başlangıç saati kaçtı, bitiş saati de geçmişti',
  oyun: 'Bu oyunda ya da bu düzende turnuva oynanamıyor',
  panel: 'Panelden iptal edildi',
}

export const isFinishReason = (v: unknown): v is FinishReason => typeof v === 'string' && v in FINISH_LABEL

/** Why a tournament was cancelled, in the words players read. */
export const CANCEL_TEXT: Partial<Record<FinishReason, string>> = {
  'kayit-yok': 'Başlangıç saatinde yeterli kayıt olmadığı için turnuva iptal edildi (birebir oyunlarda en az 2, masa oyunlarında en az 4 kayıt gerekir).',
  oynanmadi: 'Hiçbir maç oynanmadığı için turnuva iptal edildi.',
  gec: 'Turnuva saatinde başlatılamadığı için iptal edildi.',
  oyun: 'Bu oyunda turnuva düzenlenemediği için turnuva iptal edildi.',
  panel: 'Turnuva yönetim tarafından iptal edildi.',
}

/** Tournament games played one against one. */
export const DUEL_TOURNAMENT_GAMES: readonly string[] = ['tavla', 'okey', 'bilardo', 'kafa-topu', 'kafa-basketbolu']
/** Tournament games played at shared tables: with two players they are too long, too dull or not playable at all. */
export const TABLE_TOURNAMENT_GAMES: readonly string[] = ['okey101', 'batak', 'pisti', 'monopoly']

/** Seats at a shared tournament table, and how many of them go through to the next round. The final has one winner. */
export const TABLE_SEATS = 4
export const TABLE_PASS = 2

/** Players per tournament table for this game, or null when the game has no tournaments. */
export const tournamentSeats = (game: string): number | null =>
  DUEL_TOURNAMENT_GAMES.includes(game) ? 2 : TABLE_TOURNAMENT_GAMES.includes(game) ? TABLE_SEATS : null

export const canHostTournament = (game: string) => tournamentSeats(game) !== null
export const isTableTournament = (game: string) => (tournamentSeats(game) ?? 2) > 2

/** A shared table has no league: everyone cannot meet everyone four at a time. */
export const formatsFor = (game: string): readonly TournamentFormat[] => (isTableTournament(game) ? ['eleme'] : TOURNAMENT_FORMATS)

/** Entrants a tournament needs at its start time: two for a duel, one full table otherwise. */
export const minEntrants = (seats: number) => Math.max(2, seats)

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
  /** Players per table: 2 for a duel, 4 at shared tables. A running tournament keeps the size it started with. */
  tableSize: number
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
