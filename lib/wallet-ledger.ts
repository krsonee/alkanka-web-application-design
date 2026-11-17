import 'server-only'
import { DatabaseError, type PoolClient } from 'pg'
import { pool } from '@/lib/db'
import { LEDGER_PAGE_SIZE, type LedgerPage } from '@/lib/wallet-ledger-shared'

const MIN_INT = -2147483648
const SOURCE_MAX = 80

let ready = false
let ensuring: Promise<void> | null = null

export function ensureLedger() {
  ensuring ??= pool
    .query(
      `CREATE TABLE IF NOT EXISTS wallet_ledger (
         id bigserial PRIMARY KEY, user_id text NOT NULL, delta int NOT NULL, balance_after int NOT NULL, source text,
         created_at timestamptz NOT NULL DEFAULT now());
       CREATE INDEX IF NOT EXISTS wallet_ledger_user ON wallet_ledger (user_id, id DESC)`,
    )
    .then(() => {
      ready = true
    })
    .catch((error) => {
      ensuring = null
      console.error('[wallet-ledger] tablo hazırlanamadı', error)
    })
  return ensuring
}

const LOGGED = `WITH w AS (
    UPDATE wallets SET balance = balance + $2::int, updated_at = now()
    WHERE user_id = $1::text AND balance + $2::int >= $3::int RETURNING balance
  )
  INSERT INTO wallet_ledger (user_id, delta, balance_after, source)
  SELECT $1::text, $2::int, balance, $4::text FROM w RETURNING balance_after AS balance`

const PLAIN = `UPDATE wallets SET balance = balance + $2::int, updated_at = now()
  WHERE user_id = $1::text AND balance + $2::int >= $3::int RETURNING balance`

const clip = (why: string | null | undefined) => (why ? why.trim().slice(0, SOURCE_MAX) || null : null)

/**
 * Changes a balance and writes the movement to the ledger in the same statement.
 * Returns the new balance, or null when the wallet is missing or the change would drop it below `min`.
 * A ledger problem never blocks the balance change: the plain update runs instead.
 */
export async function applyCoins(
  userId: string,
  delta: number,
  why: string | null | undefined,
  opts: { min?: number; client?: Pick<PoolClient, 'query'> } = {},
): Promise<number | null> {
  const min = opts.min ?? MIN_INT
  const balanceOf = (r: { rows: { balance: number }[] }) => (r.rows[0] ? Number(r.rows[0].balance) : null)

  if (opts.client) {
    // A failed statement would abort the caller's transaction, so the logged form runs only once the table is known to exist.
    if (!ready) void ensureLedger()
    return ready
      ? balanceOf(await opts.client.query(LOGGED, [userId, delta, min, clip(why)]))
      : balanceOf(await opts.client.query(PLAIN, [userId, delta, min]))
  }

  if (!ready) await ensureLedger()
  if (ready) {
    try {
      return balanceOf(await pool.query(LOGGED, [userId, delta, min, clip(why)]))
    } catch (error) {
      // Only an error the database itself reported proves the statement did nothing; anything else must not be retried.
      if (!(error instanceof DatabaseError)) throw error
      console.error('[wallet-ledger] hareket dökümsüz işlendi', error.message)
    }
  }
  return balanceOf(await pool.query(PLAIN, [userId, delta, min]))
}

/** Adds a ledger line for a balance change that another statement already made. Never throws. */
export async function noteCoins(userId: string, delta: number, why: string) {
  if (!delta) return
  try {
    if (!ready) await ensureLedger()
    if (!ready) return
    await pool.query(
      `INSERT INTO wallet_ledger (user_id, delta, balance_after, source)
       SELECT user_id, $2::int, balance, $3::text FROM wallets WHERE user_id = $1::text`,
      [userId, delta, clip(why)],
    )
  } catch (error) {
    console.error('[wallet-ledger] hareket yazılamadı', error)
  }
}

export async function listLedger(userId: string, page: number): Promise<LedgerPage> {
  await ensureLedger()
  const p = Math.max(0, Math.floor(Number(page) || 0))
  const [list, sum, first] = await Promise.all([
    pool.query<{ id: string; delta: number; balance_after: number; source: string | null; created_at: string }>(
      `SELECT id, delta, balance_after, source, created_at FROM wallet_ledger WHERE user_id = $1
       ORDER BY id DESC LIMIT $2 OFFSET $3`,
      [userId, LEDGER_PAGE_SIZE, p * LEDGER_PAGE_SIZE],
    ),
    pool.query<{ n: string; coins_in: string | null; coins_out: string | null }>(
      `SELECT count(*) AS n, sum(delta) FILTER (WHERE delta > 0) AS coins_in, sum(-delta) FILTER (WHERE delta < 0) AS coins_out
       FROM wallet_ledger WHERE user_id = $1`,
      [userId],
    ),
    pool.query<{ created_at: string }>(`SELECT created_at FROM wallet_ledger ORDER BY id LIMIT 1`),
  ])
  return {
    page: p,
    total: Number(sum.rows[0]?.n ?? 0),
    coinsIn: Number(sum.rows[0]?.coins_in ?? 0),
    coinsOut: Number(sum.rows[0]?.coins_out ?? 0),
    since: first.rows[0] ? new Date(first.rows[0].created_at).toISOString() : null,
    rows: list.rows.map((r) => ({
      id: Number(r.id),
      delta: Number(r.delta),
      balanceAfter: Number(r.balance_after),
      source: r.source,
      createdAt: new Date(r.created_at).toISOString(),
    })),
  }
}
