import 'server-only'
import { rows, sql } from '@/lib/db'

let ready: Promise<void> | null = null

function ensurePicks() {
  ready ??= (async () => {
    await rows(sql`CREATE TABLE IF NOT EXISTS catalog_prediction_picks (
      prediction_id text NOT NULL,
      user_id text NOT NULL,
      option_id text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (prediction_id, user_id))`)
  })().catch((e) => {
    ready = null
    throw e
  })
  return ready
}

/** Stores the member's pick once; returns false when they already picked this match. */
export async function savePredictionPick(predictionId: string, userId: string, optionId: string): Promise<boolean> {
  await ensurePicks()
  const r = await rows<{ prediction_id: string }>(sql`INSERT INTO catalog_prediction_picks (prediction_id, user_id, option_id)
    VALUES (${predictionId}, ${userId}, ${optionId})
    ON CONFLICT (prediction_id, user_id) DO NOTHING
    RETURNING prediction_id`)
  return r.length > 0
}

export async function getUserPredictionPicks(userId: string): Promise<Record<string, string>> {
  await ensurePicks()
  const r = await rows<{ prediction_id: string; option_id: string }>(
    sql`SELECT prediction_id, option_id FROM catalog_prediction_picks WHERE user_id = ${userId}`,
  )
  return Object.fromEntries(r.map((x) => [x.prediction_id, x.option_id]))
}

export async function getPredictionVoteCounts(): Promise<Record<string, Record<string, number>>> {
  await ensurePicks()
  const r = await rows<{ prediction_id: string; option_id: string; n: string }>(
    sql`SELECT prediction_id, option_id, count(*) AS n FROM catalog_prediction_picks GROUP BY prediction_id, option_id`,
  )
  const out: Record<string, Record<string, number>> = {}
  for (const x of r) (out[x.prediction_id] ??= {})[x.option_id] = Number(x.n)
  return out
}
