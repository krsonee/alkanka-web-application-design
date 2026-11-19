/** The panel's own shortlist for adding matches: pinned leagues and the e-sport teams it has used. No server imports. */

import { SPORT_IDS, type Sport } from '@/lib/predictions-shared'

export type LeaguePin = { sport: Sport; id: number; name: string; country: string }

export type LeagueBook = {
  pins: LeaguePin[]
  /** E-sport game name to the team names used under it. */
  teams: Record<string, string[]>
}

export const MAX_PINS = 40
export const MAX_BOOK_GAMES = 12
export const MAX_BOOK_TEAMS = 80
export const MAX_BOOK_NAME = 60
/** How many leagues the picker reads from the feed in one go. */
export const MAX_LEAGUES_AT_ONCE = 8

export const EMPTY_BOOK: LeagueBook = { pins: [], teams: {} }

const text = (v: unknown) => String(v ?? '').trim().replace(/\s+/g, ' ').slice(0, MAX_BOOK_NAME)

// Turkish lower-casing turns "I" into "ı", which would keep "NAVI" and "navi" apart; both i's are folded into one.
const fold = (s: string) => s.trim().toLocaleLowerCase('tr').replace(/ı/g, 'i')

export const sameName = (a: string, b: string) => fold(a) === fold(b)

export function cleanPin(raw: unknown): LeaguePin | null {
  if (!raw || typeof raw !== 'object') return null
  const p = raw as Partial<LeaguePin>
  const id = Number(p.id)
  const name = text(p.name)
  if (!SPORT_IDS.includes(p.sport as Sport) || !Number.isSafeInteger(id) || id <= 0 || !name) return null
  return { sport: p.sport as Sport, id, name, country: text(p.country) }
}

/** Names without blanks or repeats, in the order they were given. */
export function cleanNames(list: unknown, max = MAX_BOOK_TEAMS): string[] {
  const out: string[] = []
  for (const v of Array.isArray(list) ? list : []) {
    const name = text(v)
    if (name && !out.some((x) => sameName(x, name))) out.push(name)
    if (out.length >= max) break
  }
  return out
}

export function normalizeBook(raw: unknown): LeagueBook {
  const b = (raw && typeof raw === 'object' ? raw : {}) as Partial<LeagueBook>
  const pins: LeaguePin[] = []
  for (const p of Array.isArray(b.pins) ? b.pins : []) {
    const pin = cleanPin(p)
    if (pin && !pins.some((x) => x.sport === pin.sport && x.id === pin.id)) pins.push(pin)
    if (pins.length >= MAX_PINS) break
  }
  const teams: LeagueBook['teams'] = {}
  for (const [game, list] of Object.entries(b.teams && typeof b.teams === 'object' ? b.teams : {})) {
    const key = text(game)
    const names = cleanNames(list)
    if (!key || !names.length || Object.keys(teams).length >= MAX_BOOK_GAMES) continue
    teams[key] = names.sort((x, y) => x.localeCompare(y, 'tr'))
  }
  return { pins, teams }
}

/** The key a game's teams are filed under, matching an existing one whatever its letter case. */
export function gameKey(book: LeagueBook, game: string) {
  const name = text(game)
  return Object.keys(book.teams).find((k) => sameName(k, name)) ?? name
}
