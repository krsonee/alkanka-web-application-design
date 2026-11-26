import 'server-only'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import type { PoolClient } from 'pg'
import { pool, rows, sql } from '@/lib/db'
import { getSignupBonus } from '@/lib/site-texts'
import { isBanned } from '@/lib/members-admin'
import { applyCoins, ensureLedger, noteCoins } from '@/lib/wallet-ledger'

export const SIGNUP_BONUS = 250

export type Member = { id: string; name: string; email: string }

export async function getMember(): Promise<Member | null> {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) return null
    if (await isBanned(session.user.id)) return null
    return { id: session.user.id, name: session.user.name || 'Kanka', email: session.user.email }
  } catch (error) {
    console.error('[member] oturum okunamadı', error)
    return null
  }
}

const READ_MEMO_MS = 10_000
const READ_MEMO_MAX = 5_000
const readMemo = new Map<string, { at: number; member: Member | null }>()

function sessionCookie(cookie: string | null): string | null {
  if (!cookie) return null
  for (const part of cookie.split(';')) {
    const at = part.indexOf('=')
    if (at > 0 && part.slice(0, at).trim().endsWith('session_token')) return part.slice(at + 1).trim() || null
  }
  return null
}

/**
 * The signed-in member, for lists that every open page polls every few seconds (chat feed, lobby, live tables).
 * Each poll used to cost a session query and a ban query before any work; the answer is now reused for ten
 * seconds per session cookie, on this server instance.
 *
 * Only for showing shared lists. A sign-out or a ban reaches this up to ten seconds late, so anything that moves
 * coins, takes a seat, sends a message or writes at all must keep using getMember / requireMember.
 */
export async function getMemberForRead(): Promise<Member | null> {
  const token = sessionCookie((await headers()).get('cookie'))
  if (!token) return getMember()
  const hit = readMemo.get(token)
  if (hit && Date.now() - hit.at < READ_MEMO_MS) return hit.member
  const member = await getMember()
  if (readMemo.size >= READ_MEMO_MAX) readMemo.clear()
  readMemo.set(token, { at: Date.now(), member })
  return member
}

export async function requireMember(): Promise<Member> {
  const m = await getMember()
  if (!m) throw new Error('Bu işlem için giriş yapmalısın.')
  return m
}

export async function getBalance(userId: string): Promise<number> {
  // Read first. The upsert below rewrites the wallet row even when nothing changes, and the top bar asks for the
  // balance every 30 seconds for every open page: that was a database write per visitor per poll.
  const have = await rows<{ balance: number }>(sql`SELECT balance FROM wallets WHERE user_id = ${userId}`)
  if (have[0]) return Number(have[0].balance)
  const bonus = await getSignupBonus().catch(() => SIGNUP_BONUS)
  const r = await rows<{ balance: number; created: boolean }>(sql`
    INSERT INTO wallets (user_id, balance) VALUES (${userId}, ${bonus})
    ON CONFLICT (user_id) DO UPDATE SET user_id = EXCLUDED.user_id
    RETURNING balance, (xmax = 0) AS created`)
  const balance = Number(r[0]?.balance ?? 0)
  if (r[0]?.created && balance > 0) await noteCoins(userId, balance, 'Kayıt bonusu')
  return balance
}

/** Atomically removes KC; returns false when the balance is insufficient. `why` is what the panel's coin statement shows. */
export async function debit(userId: string, amount: number, why?: string): Promise<boolean> {
  if (!Number.isInteger(amount) || amount < 0) throw new Error('Geçersiz tutar.')
  await getBalance(userId)
  if (amount === 0) return true
  return (await applyCoins(userId, -amount, why, { min: 0 })) !== null
}

export async function credit(userId: string, amount: number, why?: string) {
  if (!Number.isInteger(amount) || amount <= 0) return
  await getBalance(userId)
  await applyCoins(userId, amount, why)
}

/**
 * Pays a reward exactly once. `claim` marks the reward as paid inside the transaction and reports whether
 * this call won it; the coins are committed together with that mark or not at all. A reward is therefore
 * never marked without being paid, and two runs at once cannot pay it twice: the second one waits on the
 * row and then finds it taken. Returns false when another run already paid it; throws when nothing was written.
 */
export async function creditClaimed(
  userId: string,
  amount: number,
  why: string,
  claim: (client: Pick<PoolClient, 'query'>) => Promise<boolean>,
): Promise<boolean> {
  const coins = Number.isInteger(amount) && amount > 0 ? amount : 0
  if (coins) {
    await getBalance(userId)
    await ensureLedger()
  }
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    if (!(await claim(client))) {
      await client.query('ROLLBACK')
      return false
    }
    if (coins && (await applyCoins(userId, coins, why, { client })) === null) throw new Error('Cüzdan bulunamadı.')
    await client.query('COMMIT')
    return true
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    client.release()
  }
}

/**
 * Takes a fee exactly once, together with what it pays for. `claim` writes that record inside the
 * transaction and reports whether this call made it; the coins leave with the record or not at all.
 * 'taken' means the record was already there (or could not be made), 'short' that the balance does not
 * cover the fee; in both cases nothing was written.
 */
export async function debitClaimed(
  userId: string,
  amount: number,
  why: string,
  claim: (client: Pick<PoolClient, 'query'>) => Promise<boolean>,
): Promise<'ok' | 'taken' | 'short'> {
  if (!Number.isInteger(amount) || amount < 0) throw new Error('Geçersiz tutar.')
  if (amount) {
    await getBalance(userId)
    await ensureLedger()
  }
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    if (!(await claim(client))) {
      await client.query('ROLLBACK')
      return 'taken'
    }
    if (amount && (await applyCoins(userId, -amount, why, { client, min: 0 })) === null) {
      await client.query('ROLLBACK')
      return 'short'
    }
    await client.query('COMMIT')
    return 'ok'
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    client.release()
  }
}

export type HistoryInput = {
  userId: string
  userName: string
  game: string
  mode: string
  opponent: string
  stake: number
  result: 'win' | 'loss' | 'draw' | 'refund'
  delta: number
  score?: number | null
  tableId?: string | null
  /** The player walked away, gave up or timed out before the game was over: the coins are still booked, but it is not a game played. */
  quit?: boolean
}

let quitColumn: Promise<boolean> | null = null

/** The column is added the first time a walked-away game is written; a failed attempt is tried again on the next one. */
function hasQuitColumn() {
  quitColumn ??= rows(sql`ALTER TABLE game_history ADD COLUMN IF NOT EXISTS quit boolean NOT NULL DEFAULT false`).then(
    () => true,
    () => {
      quitColumn = null
      return false
    },
  )
  return quitColumn
}

export async function recordHistory(h: HistoryInput) {
  if (h.quit && (await hasQuitColumn())) {
    await rows(sql`INSERT INTO game_history (user_id, user_name, game, mode, opponent, stake, result, delta, score, table_id, quit)
      VALUES (${h.userId}, ${h.userName}, ${h.game}, ${h.mode}, ${h.opponent}, ${h.stake}, ${h.result}, ${h.delta}, ${h.score ?? null}, ${h.tableId ?? null}, true)`)
    return
  }
  await rows(sql`INSERT INTO game_history (user_id, user_name, game, mode, opponent, stake, result, delta, score, table_id)
    VALUES (${h.userId}, ${h.userName}, ${h.game}, ${h.mode}, ${h.opponent}, ${h.stake}, ${h.result}, ${h.delta}, ${h.score ?? null}, ${h.tableId ?? null})`)
}

export type HistoryRow = {
  id: number
  userId: string
  userName: string
  game: string
  mode: string
  opponent: string
  stake: number
  result: string
  delta: number
  score: number | null
  createdAt: string
}

function mapHistory(r: Record<string, unknown>): HistoryRow {
  return {
    id: Number(r.id),
    userId: String(r.user_id),
    userName: String(r.user_name ?? ''),
    game: String(r.game),
    mode: String(r.mode),
    opponent: String(r.opponent ?? ''),
    stake: Number(r.stake),
    result: String(r.result),
    delta: Number(r.delta),
    score: r.score === null || r.score === undefined ? null : Number(r.score),
    createdAt: new Date(String(r.created_at)).toISOString(),
  }
}

export async function listHistory(opts: { userId?: string; game?: string; limit?: number } = {}) {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 500)
  const r = await rows(sql`SELECT * FROM game_history
    WHERE (${opts.userId ?? null}::text IS NULL OR user_id = ${opts.userId ?? null})
      AND (${opts.game ?? null}::text IS NULL OR game = ${opts.game ?? null})
    ORDER BY created_at DESC LIMIT ${limit}`)
  return r.map(mapHistory)
}

export async function historySummary(userId: string) {
  const r = await rows<{ played: string; wins: string; net: string | null }>(sql`
    SELECT count(*) FILTER (WHERE game <> 'turnuva' AND mode <> 'admin') AS played, count(*) FILTER (WHERE result = 'win' AND game <> 'turnuva' AND mode <> 'admin') AS wins, sum(delta) AS net
    FROM game_history WHERE user_id = ${userId}`)
  return { played: Number(r[0]?.played ?? 0), wins: Number(r[0]?.wins ?? 0), net: Number(r[0]?.net ?? 0) }
}
