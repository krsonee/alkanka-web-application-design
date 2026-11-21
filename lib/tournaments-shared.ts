import type { ArenaGame } from './arena'
import { roundLabel, type Bracket, type PointRow } from './bracket'
import { hasOwn } from './has-own'

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

/**
 * `eleme`: knockout. `lig`: a fixture league, everyone meets everyone at tournament tables.
 * `puan`: a points league with no matches of its own, where the entrants' ordinary games of the
 * tournament's game earn points until the end time.
 */
export const TOURNAMENT_FORMATS = ['eleme', 'lig', 'puan'] as const
export type TournamentFormat = (typeof TOURNAMENT_FORMATS)[number]

export const FORMAT_LABEL: Record<TournamentFormat, string> = {
  eleme: 'Eleme (kaybeden elenir)',
  lig: 'Fikstürlü lig (herkes herkesle oynar)',
  puan: 'Puan ligi (herkes kendi oyunlarından puan toplar)',
}

export const FORMAT_SHORT: Record<TournamentFormat, string> = { eleme: 'Eleme', lig: 'Lig', puan: 'Puan ligi' }

export const isTournamentFormat = (v: unknown): v is TournamentFormat => TOURNAMENT_FORMATS.includes(v as TournamentFormat)

/** The stored format; anything unreadable is a knockout, as tournaments from before formats were. */
export const readFormat = (v: unknown): TournamentFormat => (isTournamentFormat(v) ? v : 'eleme')

/** How often a fixture league opens a round. `ardarda`: as soon as the round before it is over. */
export const LEAGUE_PACES = ['ardarda', 'gunluk', 'haftalik'] as const
export type LeaguePace = (typeof LEAGUE_PACES)[number]

export const PACE_LABEL: Record<LeaguePace, string> = {
  ardarda: 'Aynı oturumda: turlar art arda',
  gunluk: 'Her gün 1 tur',
  haftalik: 'Her hafta 1 tur',
}

export const PACE_SHORT: Record<LeaguePace, string> = { ardarda: 'turlar art arda', gunluk: 'her gün 1 tur', haftalik: 'her hafta 1 tur' }

const DAY_MS = 86_400_000
export const PACE_MS: Record<LeaguePace, number> = { ardarda: 0, gunluk: DAY_MS, haftalik: 7 * DAY_MS }

/**
 * Which finished games of the league's own game earn points in a points league. `pvp`: tables another
 * member sat at, whatever their size, even when bots filled the seats left over. `hepsi`: games
 * against bots only as well. No other game ever counts.
 */
export const POINT_SOURCES = ['pvp', 'hepsi'] as const
export type PointSource = (typeof POINT_SOURCES)[number]

export const SOURCE_LABEL: Record<PointSource, string> = {
  pvp: 'Sadece üyelere karşı oynanan masalar',
  hepsi: 'Üyelere ve bota karşı oynanan oyunlar',
}

/** What each source means, for the people who read the rules. */
export const SOURCE_TEXT: Record<PointSource, string> = {
  pvp: 'Masada senden başka en az bir üye olmalı; boş kalan koltuklara bot oturmuş olabilir. Sadece botlarla oynanan masa sayılmaz.',
  hepsi: 'Üyelere karşı ve sadece botlara karşı oynanan oyunların ikisi de sayılır.',
}

/** The `mode` values of the history rows each source counts. */
export const SOURCE_MODES: Record<PointSource, string[]> = { pvp: ['pvp'], hepsi: ['pvp', 'bot'] }

/** How many of a player's games count in a points league, from the first one on. 0: all of them. */
export const POINT_GAME_CAPS = [0, 10, 20, 30, 50, 100] as const

/** A league's own settings. A fixture league reads `pace` and `legs`, a points league `source` and `maxGames`. */
export type LeagueSettings = { pace: LeaguePace; legs: 1 | 2; source: PointSource; maxGames: number }

export const DEFAULT_LEAGUE: LeagueSettings = { pace: 'ardarda', legs: 1, source: 'pvp', maxGames: 0 }

export function cleanLeague(raw: unknown): LeagueSettings {
  const d = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const games = Number(d.maxGames)
  return {
    pace: LEAGUE_PACES.includes(d.pace as LeaguePace) ? (d.pace as LeaguePace) : DEFAULT_LEAGUE.pace,
    legs: Number(d.legs) === 2 ? 2 : 1,
    source: POINT_SOURCES.includes(d.source as PointSource) ? (d.source as PointSource) : DEFAULT_LEAGUE.source,
    maxGames: (POINT_GAME_CAPS as readonly number[]).includes(games) ? games : DEFAULT_LEAGUE.maxGames,
  }
}

/** Rounds a fixture league plays with this many players: one fewer than the field, rounded up to even, per leg. */
export const leagueRounds = (players: number, legs: number) => Math.max(0, players + (players % 2) - 1) * legs

/** When a round of a paced league opens. The first opens with the tournament, each later one a day or a week after the one before. */
export const roundOpensAt = (startsAt: string | Date, index: number, pace: LeaguePace) => new Date(new Date(startsAt).getTime() + index * PACE_MS[pace])

/** Minutes a paced league has to stay open after its last round opens, so that round can be played. */
export const LAST_ROUND_MINUTES = 60

/** The earliest end time a fixture league with these settings can have, or null when its rounds follow one another. */
export function earliestLeagueEnd(startsAt: string | Date, players: number, league: Pick<LeagueSettings, 'pace' | 'legs'>) {
  if (!PACE_MS[league.pace]) return null
  const last = roundOpensAt(startsAt, Math.max(0, leagueRounds(players, league.legs) - 1), league.pace)
  return new Date(last.getTime() + LAST_ROUND_MINUTES * 60_000)
}

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

/** Minutes a player has to sit down at a match once its table opens. The long ones are for leagues that open a round a day or a week. */
export const JOIN_MINUTES = [3, 5, 10, 15, 30, 60] as const
export const DEFAULT_JOIN_MINUTES = 5
export const cleanJoinMinutes = (v: unknown) => ((JOIN_MINUTES as readonly number[]).includes(Number(v)) ? Number(v) : DEFAULT_JOIN_MINUTES)

/**
 * How long one match is, for the games that can be played over more than one hand. `value` is the
 * table's `rounds` option; the first choice is what the game plays when nothing was picked.
 */
export type MatchLength = { value: number; label: string; hint: string }

const MATCH_LENGTHS: Record<string, MatchLength[]> = {
  tavla: [
    { value: 1, label: 'Tek el', hint: 'Eli alan maçı kazanır.' },
    { value: 3, label: '3 puanlık maç', hint: '3 puana ilk ulaşan maçı kazanır. Normal el 1, mars 2, ağır mars 3 puandır.' },
    { value: 5, label: '5 puanlık maç', hint: '5 puana ilk ulaşan maçı kazanır. Normal el 1, mars 2, ağır mars 3 puandır.' },
  ],
  okey: [
    { value: 0, label: 'Tek el', hint: 'Eli bitiren maçı kazanır. Deste biterse el yeniden dağıtılır.' },
    ...[10, 20, 30].map((n) => ({
      value: n,
      label: `${n} puandan düşüş`,
      hint: `İki oyuncu ${n} puanla başlar. Eli bitiren rakibinin puanını düşürür; puanı önce sıfıra inen maçı kaybeder.`,
    })),
  ],
}

export const matchLengths = (game: string): MatchLength[] => MATCH_LENGTHS[game] ?? []

/** The stored choice for this game, or null when the game has only one way to be played. */
export function cleanMatchLength(game: string, v: unknown): number | null {
  const choices = matchLengths(game)
  if (!choices.length) return null
  const picked = v === null || v === undefined || v === '' ? NaN : Number(v)
  return (choices.find((c) => c.value === picked) ?? choices[0]).value
}

export const matchLengthOf = (game: string, v: number | null | undefined) => matchLengths(game).find((c) => c.value === v) ?? null

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

export const isFinishReason = (v: unknown): v is FinishReason => typeof v === 'string' && hasOwn(FINISH_LABEL, v)

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

/** A shared table has no fixture league: everyone cannot meet everyone four at a time. A points league needs no fixtures. */
export const formatsFor = (game: string): readonly TournamentFormat[] => (isTableTournament(game) ? ['eleme', 'puan'] : TOURNAMENT_FORMATS)

/** Entrants a tournament needs at its start time: two for a duel, one full table otherwise. */
export const minEntrants = (seats: number) => Math.max(2, seats)

/** The same for a given format: a points league seats nobody, so two entrants are enough whatever the game. */
export const entrantsNeeded = (format: TournamentFormat, seats: number) => (format === 'puan' ? 2 : minEntrants(seats))

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
  /** The `rounds` option of every match table, or null when the game has no choice. See `matchLengths`. */
  matchLength: number | null
  finishedAt: string | null
  finishReason: FinishReason | null
  status: TournamentStatus
  format: TournamentFormat
  league: LeagueSettings
  /** A paced league between two rounds: when the next one opens. Null otherwise. */
  nextRoundAt: string | null
  /** Standing of a points league, best first: live while it runs, final once it is over. Null for other formats and before the start. */
  points: PointRow[] | null
  winner: string | null
  bracket: Bracket | null
  entries: TournamentEntry[]
  /** Player key (user id) to display name. */
  names: Record<string, string>
  liveMatches: LiveMatch[]
  currentRound: number | null
}

/** A tournament whose start time has passed is still expected to start for this long. */
const START_GRACE_MS = 10 * 60_000

/**
 * How quickly what the public sees of a tournament can change without the viewer doing anything.
 * `fast`: a match is being played or about to open. `slow`: a league that is only waiting for the day
 * of its next round, or a points league, which moves when its entrants finish their own games.
 * Null: nothing moves by itself. A league runs for days, so its pages must not ask as often as a live match.
 */
export function tournamentPulse(
  t: Pick<Tournament, 'status' | 'format' | 'startsAt' | 'nextRoundAt' | 'liveMatches'>,
  now: number,
  soonMs: number,
): 'fast' | 'slow' | null {
  if (t.status === 'kayit') {
    const until = Date.parse(t.startsAt) - now
    return until < soonMs && until > -START_GRACE_MS ? 'fast' : null
  }
  if (t.status !== 'basladi') return null
  if (t.format === 'puan') return 'slow'
  if (t.nextRoundAt && !t.liveMatches.length && Date.parse(t.nextRoundAt) - now > soonMs) return 'slow'
  return 'fast'
}

/** The quickest pulse among the listed tournaments. */
export function listPulse(list: Parameters<typeof tournamentPulse>[0][], now: number, soonMs: number) {
  const all = list.map((t) => tournamentPulse(t, now, soonMs))
  return all.includes('fast') ? 'fast' : all.includes('slow') ? 'slow' : null
}

export const MAX_TOURNAMENT_TEMPLATES = 30

/** How long a tournament opened from a template runs when the template was saved before it kept a length. */
export const DEFAULT_TOURNAMENT_MINUTES = 180
/** A week: longer than that is a typing mistake, not a tournament. */
export const MAX_TOURNAMENT_MINUTES = 7 * 24 * 60
/** A league can open a round a week: sixteen players over two legs take thirty of them. */
export const MAX_LEAGUE_MINUTES = 366 * 24 * 60
/** How long a points league runs when the form is switched to it. */
export const DEFAULT_POINTS_MINUTES = 7 * 24 * 60

/** The longest a tournament of this format may run, from start to end. */
export const maxTournamentMinutes = (format: TournamentFormat) => (format === 'eleme' ? MAX_TOURNAMENT_MINUTES : MAX_LEAGUE_MINUTES)

/**
 * A tournament's settings without its date, players or results. `startTime` is Istanbul time, HH:MM;
 * `lengthMinutes` is how long after the start the tournament closes.
 */
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
  lengthMinutes: number
  joinMinutes: number
  matchLength: number | null
  league: LeagueSettings
}

export const displayName = (t: Pick<Tournament, 'names'>, key: string | null) => (key ? (t.names[key] ?? key) : null)
