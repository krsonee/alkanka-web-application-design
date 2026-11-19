import 'server-only'
import { getContent, setContent } from '@/lib/content'
import { MAX_BOOK_GAMES, MAX_BOOK_TEAMS, MAX_PINS, cleanNames, cleanPin, gameKey, normalizeBook, sameName, type LeagueBook } from '@/lib/prediction-book-shared'

export const LEAGUE_BOOK_KEY = 'prediction_book'

export async function getLeagueBook(): Promise<LeagueBook> {
  return normalizeBook(await getContent<Partial<LeagueBook>>(LEAGUE_BOOK_KEY).catch(() => null))
}

/** Pins a league to the top of the picker, or takes it off. */
export async function setLeaguePin(input: unknown, on: boolean) {
  const pin = cleanPin(input)
  if (!pin) throw new Error('Lig bulunamadı.')
  const book = await getLeagueBook()
  const rest = book.pins.filter((p) => !(p.sport === pin.sport && p.id === pin.id))
  if (on && rest.length >= MAX_PINS) throw new Error(`En fazla ${MAX_PINS} lig sabitlenebilir. Önce birini kaldır.`)
  await setContent(LEAGUE_BOOK_KEY, { ...book, pins: on ? [...rest, pin] : rest })
}

/** Files the teams of an e-sport match under its game, so the next match can pick them from a list. Never fails the match. */
export async function rememberTeams(game: string, names: string[]) {
  const book = await getLeagueBook()
  const key = gameKey(book, game)
  if (!key) return
  if (!book.teams[key] && Object.keys(book.teams).length >= MAX_BOOK_GAMES) return
  const merged = cleanNames([...(book.teams[key] ?? []), ...names], MAX_BOOK_TEAMS)
  if (merged.length === (book.teams[key]?.length ?? 0)) return
  await setContent(LEAGUE_BOOK_KEY, normalizeBook({ ...book, teams: { ...book.teams, [key]: merged } }))
}

export async function forgetTeam(game: string, name: string) {
  const book = await getLeagueBook()
  const key = gameKey(book, game)
  const left = (book.teams[key] ?? []).filter((n) => !sameName(n, name))
  const teams = { ...book.teams, [key]: left }
  if (!left.length) delete teams[key]
  await setContent(LEAGUE_BOOK_KEY, { ...book, teams })
}
