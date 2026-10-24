import 'server-only'
import { pool } from '@/lib/db'

const BUSY = 'İşlemin sürüyor kanka, birkaç saniye sonra tekrar dene.'
let ready: Promise<unknown> | null = null

function ensure() {
  ready ??= pool
    .query(`CREATE TABLE IF NOT EXISTS user_locks (key text PRIMARY KEY, until timestamptz NOT NULL)`)
    .catch((e) => {
      ready = null
      throw e
    })
  return ready
}

/**
 * Runs `fn` only if no other request holds the same key. Parallel duplicates (double taps, scripted bursts)
 * are rejected instead of queued, so "check then pay" flows can't be raced into paying twice.
 * The lock is a row rather than a held connection, so it never starves the pool; a crashed holder expires after 30s.
 */
export async function withUserLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  await ensure()
  const got = await pool.query(
    `INSERT INTO user_locks (key, until) VALUES ($1, now() + interval '30 seconds')
     ON CONFLICT (key) DO UPDATE SET until = EXCLUDED.until WHERE user_locks.until < now()
     RETURNING key`,
    [key],
  )
  if (!got.rowCount) throw new Error(BUSY)
  try {
    return await fn()
  } finally {
    await pool.query(`DELETE FROM user_locks WHERE key = $1`, [key]).catch(() => {})
  }
}
