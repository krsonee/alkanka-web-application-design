import type { PoolClient } from 'pg'
import { pool, rows, sql } from '@/lib/db'

export type ExtraGame = 'cark' | 'sandik' | 'zar'

let ready: Promise<unknown> | null = null

function ensure() {
  ready ??= rows(sql`CREATE TABLE IF NOT EXISTS mini_extra_plays (
      user_id text NOT NULL,
      game text NOT NULL,
      count int NOT NULL DEFAULT 0,
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, game))`).catch((e) => {
    ready = null
    throw e
  })
  return ready
}

export async function extraPlays(userId: string, game: ExtraGame): Promise<number> {
  await ensure()
  const [r] = await rows<{ count: number }>(sql`SELECT count FROM mini_extra_plays WHERE user_id = ${userId} AND game = ${game}`)
  return Math.max(0, Number(r?.count ?? 0))
}

/**
 * Adds purchased plays and returns how many the member now holds. `db` is the connection of a transaction
 * that is already open, so the plays are saved together with whatever else that transaction writes.
 */
export async function grantExtraPlays(userId: string, game: ExtraGame, amount: number, db: Pick<PoolClient, 'query'> = pool): Promise<number> {
  await ensure()
  const r = await db.query<{ count: number }>(
    `INSERT INTO mini_extra_plays (user_id, game, count) VALUES ($1, $2, $3)
     ON CONFLICT (user_id, game) DO UPDATE SET count = mini_extra_plays.count + EXCLUDED.count, updated_at = now() RETURNING count`,
    [userId, game, amount],
  )
  return Number(r.rows[0]?.count ?? amount)
}

/** Atomically spends one purchased play; false when none are left. */
export async function consumeExtraPlay(userId: string, game: ExtraGame): Promise<boolean> {
  await ensure()
  const r = await rows(sql`UPDATE mini_extra_plays SET count = count - 1, updated_at = now()
    WHERE user_id = ${userId} AND game = ${game} AND count > 0 RETURNING count`)
  return r.length > 0
}
