import 'server-only'
import { pool } from '@/lib/db'

/**
 * Indexes for the lookups every open page repeats. `game_history` and `game_tables` only had their `id` index, so a
 * member's game count, the lobby and the live-table list each read the whole table: unnoticeable with a few hundred
 * rows, tens of milliseconds per request once the tables hold a busy site's history. `game_tables_open_idx` only
 * covers tables still waiting or in play, so it stays a few kilobytes however many finished tables pile up.
 */
export const HOT_INDEXES = [
  { name: 'game_history_user_idx', table: 'game_history', on: '(user_id, created_at DESC)' },
  { name: 'game_tables_open_idx', table: 'game_tables', on: `(status, updated_at DESC) WHERE status IN ('bekliyor','oynaniyor')` },
  { name: 'kp_events_source_idx', table: 'kp_events', on: '(source, created_at)' },
] as const

/** Building an index holds back writes to its table; if the table is busy, give up and try again on a later run. */
const LOCK_WAIT_MS = 3000

export async function buildHotIndexes() {
  const seen = await pool.query<{ name: string }>(
    `SELECT c.relname::text AS name FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = ANY($1::text[])`,
    [HOT_INDEXES.flatMap((index) => [index.name, index.table])],
  )
  const have = new Set(seen.rows.map((r) => r.name))
  const built: string[] = []
  const failed: string[] = []
  for (const index of HOT_INDEXES) {
    if (have.has(index.name) || !have.has(index.table)) continue
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query(`SET LOCAL lock_timeout = '${LOCK_WAIT_MS}ms'`)
      await client.query(`CREATE INDEX IF NOT EXISTS ${index.name} ON ${index.table} ${index.on}`)
      await client.query('COMMIT')
      built.push(index.name)
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {})
      failed.push(index.name)
      console.error('[hot-indexes] dizin kurulamadı', index.name, (error as Error).message)
    } finally {
      client.release()
    }
  }
  return { built, failed }
}

let ready: Promise<void> | null = null

/** Once per server instance: one catalog read when every index is already there. */
export function ensureHotIndexes() {
  ready ??= buildHotIndexes().then(
    ({ failed }) => {
      if (failed.length) ready = null
    },
    (error) => {
      ready = null
      throw error
    },
  )
  return ready
}
