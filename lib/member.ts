import 'server-only'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { rows, sql } from '@/lib/db'

export const SIGNUP_BONUS = 250

export type Member = { id: string; name: string; email: string }

export async function getMember(): Promise<Member | null> {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) return null
    return { id: session.user.id, name: session.user.name || 'Kanka', email: session.user.email }
  } catch (error) {
    console.error('[member] oturum okunamadı', error)
    return null
  }
}

export async function requireMember(): Promise<Member> {
  const m = await getMember()
  if (!m) throw new Error('Bu işlem için giriş yapmalısın.')
  return m
}

export async function getBalance(userId: string): Promise<number> {
  const r = await rows<{ balance: number }>(sql`
    INSERT INTO wallets (user_id, balance) VALUES (${userId}, ${SIGNUP_BONUS})
    ON CONFLICT (user_id) DO UPDATE SET user_id = EXCLUDED.user_id
    RETURNING balance`)
  return r[0]?.balance ?? 0
}

/** Atomically removes KC; returns false when the balance is insufficient. */
export async function debit(userId: string, amount: number): Promise<boolean> {
  if (!Number.isInteger(amount) || amount < 0) throw new Error('Geçersiz tutar.')
  await getBalance(userId)
  if (amount === 0) return true
  const r = await rows(sql`UPDATE wallets SET balance = balance - ${amount}, updated_at = now()
    WHERE user_id = ${userId} AND balance >= ${amount} RETURNING balance`)
  return r.length > 0
}

export async function credit(userId: string, amount: number) {
  if (!Number.isInteger(amount) || amount <= 0) return
  await getBalance(userId)
  await rows(sql`UPDATE wallets SET balance = balance + ${amount}, updated_at = now() WHERE user_id = ${userId}`)
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
}

export async function recordHistory(h: HistoryInput) {
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
    SELECT count(*) AS played, count(*) FILTER (WHERE result = 'win') AS wins, sum(delta) AS net
    FROM game_history WHERE user_id = ${userId}`)
  return { played: Number(r[0]?.played ?? 0), wins: Number(r[0]?.wins ?? 0), net: Number(r[0]?.net ?? 0) }
}
