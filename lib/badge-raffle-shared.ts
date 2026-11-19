export const MAX_RAFFLE_WINNERS = 50

/** Stands for "every badge that is not a role" wherever a list of badge ids is expected. */
export const ALL_BADGES = '*'

export type RaffleRow = { id: number; badgeName: string; userName: string; prize: number; note: string | null; drawnAt: string }
