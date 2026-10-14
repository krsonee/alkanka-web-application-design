import 'server-only'
import { pool } from '@/lib/db'

export const RATE_LIMIT_MESSAGE = 'Çok hızlı işlem yapıyorsun, birkaç saniye bekle.'

/**
 * Fixed-window counter stored in Postgres so it holds across serverless instances.
 * Fails open: a database hiccup must never lock members out of the site.
 */
export async function hitRateLimit(key: string, max: number, windowSeconds: number): Promise<boolean> {
  try {
    const r = await pool.query<{ hits: number }>(
      `INSERT INTO rate_hits (key, window_start, hits) VALUES ($1, now(), 1)
       ON CONFLICT (key) DO UPDATE SET
         hits = CASE WHEN rate_hits.window_start < now() - make_interval(secs => $2) THEN 1 ELSE rate_hits.hits + 1 END,
         window_start = CASE WHEN rate_hits.window_start < now() - make_interval(secs => $2) THEN now() ELSE rate_hits.window_start END
       RETURNING hits`,
      [key, windowSeconds],
    )
    if (Math.random() < 0.01) void pool.query(`DELETE FROM rate_hits WHERE window_start < now() - interval '1 day'`).catch(() => {})
    return Number(r.rows[0]?.hits ?? 0) > max
  } catch (error) {
    console.error('[rate-limit] check failed', error)
    return false
  }
}

export async function assertRateLimit(key: string, max: number, windowSeconds: number) {
  if (await hitRateLimit(key, max, windowSeconds)) throw new Error(RATE_LIMIT_MESSAGE)
}
