import 'server-only'
import { randomUUID } from 'node:crypto'
import { pool } from '@/lib/db'

/** Longest one payout may hold the gate. A server that dies mid-payout frees the member after this. */
const LEASE_SECONDS = 20
/** Longer than the lease, so a gate left behind by a dead server is always outwaited. */
const WAIT_MS = 25_000

export const BOT_GATE_BUSY = 'Sonuç şu an işlenemedi. Birkaç saniye sonra tekrar dene.'

let ready: Promise<unknown> | null = null
function ensureGate() {
  ready ??= pool
    .query(`CREATE TABLE IF NOT EXISTS bot_payout_gates (user_id text PRIMARY KEY, token text NOT NULL, until timestamptz NOT NULL)`)
    .catch((error) => {
      ready = null
      throw error
    })
  return ready
}

async function take(userId: string, token: string) {
  const r = await pool.query(
    `INSERT INTO bot_payout_gates (user_id, token, until) VALUES ($1, $2, now() + make_interval(secs => $3))
     ON CONFLICT (user_id) DO UPDATE SET token = EXCLUDED.token, until = EXCLUDED.until
       WHERE bot_payout_gates.until < now()
     RETURNING user_id`,
    [userId, token, LEASE_SECONDS],
  )
  return r.rowCount === 1
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Runs `work` while no other bot payout is being decided for these members.
 *
 * The daily bot ceilings are read from game_history and the win is written there afterwards. Results that
 * arrived together each read the history before any of them had written, so each found the whole day's room
 * free and the ceiling paid out several times over. Inside the gate the read, the coins and the history row
 * of one result are finished before the next result reads.
 *
 * The gate is a row with an expiry rather than a database lock held on a connection: a held lock keeps one
 * pool connection busy while the work asks for a second one, and ten payouts at once would have taken every
 * connection of the pool and waited on each other.
 *
 * `whenBusy` says what happens when the gate cannot be had in time. 'fail' throws before `work` starts, for
 * callers that have written nothing yet and can be asked again. 'run' does the work anyway, for callers that
 * already closed the game: there a ceiling paid slightly over is the smaller harm than a winner left unpaid.
 */
export async function withBotPayoutGate<T>(userIds: string[], work: () => Promise<T>, whenBusy: 'fail' | 'run' = 'fail'): Promise<T> {
  // Always in the same order, so two tables sharing two winners cannot each hold one and wait for the other.
  const ids = [...new Set(userIds)].sort()
  if (!ids.length) return work()
  const token = randomUUID()
  const deadline = Date.now() + WAIT_MS
  const held: string[] = []
  try {
    try {
      await ensureGate()
      for (const id of ids) {
        for (let wait = 40; !(await take(id, token)); wait = Math.min(400, wait * 1.5)) {
          if (Date.now() > deadline) throw new Error(BOT_GATE_BUSY)
          await pause(wait + Math.random() * wait)
        }
        held.push(id)
      }
    } catch (error) {
      if (whenBusy !== 'run') throw error
      console.error('[bot-gate] kapı alınamadı, ödeme kapısız yapılıyor', ids, error)
    }
    return await work()
  } finally {
    if (held.length) {
      // The token keeps a payout that overran its lease from opening a gate someone else now holds.
      await pool.query(`DELETE FROM bot_payout_gates WHERE user_id = ANY($1::text[]) AND token = $2`, [held, token]).catch(() => {})
    }
  }
}
