import { chestShares, diceReward, mergeRewards, wheelBigIndices, type RewardConfig } from './rewards-shared'

export type MiniGameId = 'cark' | 'zar' | 'sandik'
export const MINI_GAME_IDS: MiniGameId[] = ['cark', 'zar', 'sandik']
export const MINI_GAME_LABEL: Record<MiniGameId, string> = { cark: 'Şans çarkı', zar: 'Zar at', sandik: 'Gizemli sandık' }

/** What the last 7 days looked like for one game; plays bought with coins are counted too. */
export type MiniPlayStats = Record<MiniGameId, { plays: number; paid: number; players: number }>
export const EMPTY_MINI_STATS: MiniPlayStats = {
  cark: { plays: 0, paid: 0, players: 0 },
  zar: { plays: 0, paid: 0, players: 0 },
  sandik: { plays: 0, paid: 0, players: 0 },
}
export const STATS_DAYS = 7

export type MiniForecast = {
  /** Average coins one play pays; `low` and `high` differ only where the outcome depends on a choice. */
  perPlay: { low: number; high: number }
  /** Free plays one member gets in a day. */
  freePlays: number
}

const mean = (list: number[]) => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : 0)

/** The server rolls up to this many times until the dice match the decided outcome (`playMini`). */
const DICE_TRIES = 200

/**
 * Average payout per play, following the draw in `playMini` step by step: the house win rate first decides
 * "big" or "small", then the prize is picked evenly inside that half.
 */
export function forecastRewards(raw: RewardConfig, winRate: number): Record<MiniGameId, MiniForecast> {
  const config = mergeRewards(raw)
  const p = Math.min(100, Math.max(0, Number(winRate) || 0)) / 100

  const segments = config.wheel.segments
  const bigSet = wheelBigIndices(segments)
  const all = segments.map((s) => s.points)
  const bigPoints = segments.filter((_, i) => bigSet.has(i)).map((s) => s.points)
  const smallPoints = segments.filter((_, i) => !bigSet.has(i)).map((s) => s.points)
  const wheel = p * mean(bigPoints.length ? bigPoints : all) + (1 - p) * mean(smallPoints.length ? smallPoints : all)

  const rolls: { points: number; big: boolean }[] = []
  for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) rolls.push(diceReward(a, b, config.dice))
  const diceWhen = (big: boolean) => {
    const match = rolls.filter((r) => r.big === big).map((r) => r.points)
    const other = rolls.filter((r) => r.big !== big).map((r) => r.points)
    if (!match.length) return mean(other)
    const missed = Math.pow(1 - match.length / rolls.length, DICE_TRIES)
    return (1 - missed) * mean(match) + missed * mean(other)
  }
  const dice = p * diceWhen(true) + (1 - p) * diceWhen(false)

  /* the chest is drawn by its weight first, then its prize the same way as the others */
  const shares = chestShares(config.chest.chests)
  const chest = config.chest.chests.reduce((sum, item, i) => {
    const split = Math.floor(item.rewards.length / 2)
    return sum + shares[i] * (p * mean(item.rewards.slice(split)) + (1 - p) * mean(item.rewards.slice(0, split)))
  }, 0)

  return {
    cark: { perPlay: { low: wheel, high: wheel }, freePlays: 24 / config.wheel.cooldownHours },
    zar: { perPlay: { low: dice, high: dice }, freePlays: config.dice.dailyPlays },
    sandik: { perPlay: { low: chest, high: chest }, freePlays: config.chest.dailyPlays },
  }
}
