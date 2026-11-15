import 'server-only'
import { pool } from '@/lib/db'
import { appSecrets } from '@/lib/secrets'

export type KeyedGame = 'rulet' | 'blackjack'

type Epoch = { startsAt: number; firstRound: number | null }

/**
 * Skew Protection keeps an open tab on the deployment it loaded from for up to 12 hours, and a deployment from
 * before the rotation only knows the original secret. Rounds move to the rotated secret after that window, so
 * two deployments never deal different cards for the same round.
 *
 * This handles one switch, from the original secret to the current one. Rotating again needs a new epoch.
 */
const SWITCH_DELAY = '12 hours 15 minutes'
/** Around the switch every request asks the database, so all instances agree on the first rotated round. */
const SWITCH_WINDOW_MS = 60_000
const RETRY_MS = 60_000

/** Only production starts and completes the switch. Previews and local runs share its database and follow it. */
const leads = process.env.VERCEL_ENV === 'production'

const epochs = new Map<KeyedGame, Epoch>()
const missedAt = new Map<KeyedGame, number>()

async function read(game: KeyedGame): Promise<(Epoch & { due: boolean }) | null> {
  try {
    const r = await pool.query(`SELECT starts_at, from_round, now() >= starts_at AS due FROM key_epochs WHERE name = $1`, [game])
    const row = r.rows[0]
    if (!row) return null
    return {
      startsAt: new Date(row.starts_at).getTime(),
      firstRound: row.from_round === null ? null : Number(row.from_round),
      due: Boolean(row.due),
    }
  } catch (error) {
    if ((error as { code?: string }).code === '42P01') return null
    throw error
  }
}

/**
 * Call before dealing. `nextRound` names the first round that may use the rotated secret; it must lie far
 * enough ahead that no request already in flight can reach it.
 */
export async function loadGameKey(game: KeyedGame, nextRound: () => Promise<number> | number) {
  if (appSecrets().length < 2) return
  const known = epochs.get(game)
  if (known && (known.firstRound !== null || Date.now() < known.startsAt - SWITCH_WINDOW_MS)) return
  if (!known && Date.now() - (missedAt.get(game) ?? 0) < RETRY_MS) return

  let row = await read(game)
  if (!row && leads) {
    await pool.query(`CREATE TABLE IF NOT EXISTS key_epochs (name text PRIMARY KEY, starts_at timestamptz NOT NULL, from_round bigint)`)
    await pool.query(`INSERT INTO key_epochs (name, starts_at) VALUES ($1, now() + interval '${SWITCH_DELAY}') ON CONFLICT (name) DO NOTHING`, [game])
    row = await read(game)
  }
  if (row && leads && row.due && row.firstRound === null) {
    await pool.query(`UPDATE key_epochs SET from_round = $2 WHERE name = $1 AND from_round IS NULL`, [game, await nextRound()])
    row = await read(game)
  }
  if (row) epochs.set(game, { startsAt: row.startsAt, firstRound: row.firstRound })
  else missedAt.set(game, Date.now())
}

export function usesRotatedKey(game: KeyedGame, roundId: number) {
  const first = epochs.get(game)?.firstRound
  return first != null && roundId >= first
}

/** The secret a round is dealt from: the original one until the switch, the current one from then on. */
export function gameSecret(game: KeyedGame, roundId: number) {
  const secrets = appSecrets()
  return (usesRotatedKey(game, roundId) ? secrets[0] : secrets.at(-1)) ?? null
}
