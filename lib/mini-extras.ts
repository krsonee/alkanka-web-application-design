import { rows, sql } from '@/lib/db'

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

export async function grantExtraPlays(userId: string, game: ExtraGame, amount: number) {
  await ensure()
  await rows(sql`INSERT INTO mini_extra_plays (user_id, game, count) VALUES (${userId}, ${game}, ${amount})
    ON CONFLICT (user_id, game) DO UPDATE SET count = mini_extra_plays.count + ${amount}, updated_at = now()`)
}

/** Atomically spends one purchased play; false when none are left. */
export async function consumeExtraPlay(userId: string, game: ExtraGame): Promise<boolean> {
  await ensure()
  const r = await rows(sql`UPDATE mini_extra_plays SET count = count - 1, updated_at = now()
    WHERE user_id = ${userId} AND game = ${game} AND count > 0 RETURNING count`)
  return r.length > 0
}
