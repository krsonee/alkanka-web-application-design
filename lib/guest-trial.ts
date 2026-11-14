/**
 * Guests may play one hand against the bot without an account. Only games whose rules run in the
 * browser are offered: nothing is written on the server and no KC moves, so there is nothing to
 * abuse. The membership prompt comes after the hand, where the reward would be.
 */
export const GUEST_TRIAL_GAMES = ['tavla', 'bilardo', 'kafa-topu', 'kafa-basketbolu'] as const

export const isGuestTrialGame = (game: string) => (GUEST_TRIAL_GAMES as readonly string[]).includes(game)

/** Game pages a guest can stay on: the lobby there handles the membership prompt itself. */
export function isGuestTrialPath(pathname: string) {
  return GUEST_TRIAL_GAMES.some((g) => pathname === `/oyunlar/${g}`)
}

const USED_KEY = 'alkanka:guest-trial-used'

/** The device has already spent its free hand. It is a courtesy limit, not a security one: a trial hand pays nothing. */
export function guestTrialUsed() {
  try {
    return window.localStorage.getItem(USED_KEY) === '1'
  } catch {
    return false
  }
}

export function markGuestTrialUsed() {
  try {
    window.localStorage.setItem(USED_KEY, '1')
  } catch {
    // Storage blocked: the guest can simply try again.
  }
}
