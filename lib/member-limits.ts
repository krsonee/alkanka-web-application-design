import 'server-only'
import { pool } from '@/lib/db'

export type MemberLimit = {
  userId: string
  userName: string
  userEmail: string
  dailyWinLimit: number | null
  dailyGameLimit: number | null
  marketBan: boolean
  marketSpendLimit: number | null
  note: string
  updatedBy: string
  updatedAt: string
}

export type LimitInput = {
  dailyWinLimit: number | null
  dailyGameLimit: number | null
  marketBan: boolean
  marketSpendLimit: number | null
  note: string
}

const TODAY = `date_trunc('day', now() AT TIME ZONE 'Europe/Istanbul') AT TIME ZONE 'Europe/Istanbul'`

/** Shown to members instead of the real reason; restrictions stay hidden. */
const PLAY_BLOCKED = 'Şu an yeni oyun açılamıyor. Biraz sonra tekrar dene.'
const BUY_BLOCKED = 'Bu ürün şu an alınamıyor. Biraz sonra tekrar dene.'

type Row = {
  user_id: string
  user_name: string | null
  user_email: string | null
  daily_win_limit: number | null
  daily_game_limit: number | null
  market_ban: boolean
  market_spend_limit: number | null
  note: string | null
  updated_by: string | null
  updated_at: string
}

const toLimit = (r: Row): MemberLimit => ({
  userId: r.user_id,
  userName: r.user_name ?? '',
  userEmail: r.user_email ?? '',
  dailyWinLimit: r.daily_win_limit,
  dailyGameLimit: r.daily_game_limit,
  marketBan: !!r.market_ban,
  marketSpendLimit: r.market_spend_limit,
  note: r.note ?? '',
  updatedBy: r.updated_by ?? '',
  updatedAt: new Date(r.updated_at).toISOString(),
})

async function limitFor(userId: string): Promise<MemberLimit | null> {
  try {
    const r = await pool.query<Row>(`SELECT * FROM member_limits WHERE user_id = $1`, [userId])
    return r.rows[0] ? toLimit(r.rows[0]) : null
  } catch (error) {
    console.error('[member-limits] okunamadı', error)
    return null
  }
}

async function todayGames(userId: string) {
  const r = await pool.query<{ played: string; net: string | null }>(
    `SELECT count(*) AS played, sum(delta) AS net FROM game_history
     WHERE user_id = $1 AND game <> 'market' AND mode <> 'turnuva' AND created_at >= ${TODAY}`,
    [userId],
  )
  return { played: Number(r.rows[0]?.played ?? 0), net: Number(r.rows[0]?.net ?? 0) }
}

/** Throws a neutral error when the member has reached their hidden daily game limit. */
export async function assertCanPlay(userId: string) {
  const limit = await limitFor(userId)
  if (!limit || limit.dailyGameLimit === null) return
  const { played } = await todayGames(userId)
  if (played >= limit.dailyGameLimit) throw new Error(PLAY_BLOCKED)
}

/**
 * Returns the payout to credit after applying the hidden daily win limit.
 * The member's net gain for the day (Turkey time) never exceeds the limit; the stake is always returned.
 */
export async function capPayout(userId: string, stake: number, payout: number) {
  if (payout <= stake) return payout
  const limit = await limitFor(userId)
  if (!limit || limit.dailyWinLimit === null) return payout
  const { net } = await todayGames(userId)
  const room = Math.max(0, limit.dailyWinLimit - Math.max(0, net))
  return Math.min(payout, stake + room)
}

/** Throws a neutral error for a market ban or when the hidden daily spend limit would be exceeded. */
export async function assertCanBuy(userId: string, price: number) {
  const limit = await limitFor(userId)
  if (!limit) return
  if (limit.marketBan) throw new Error(BUY_BLOCKED)
  if (limit.marketSpendLimit === null) return
  const r = await pool.query<{ spent: string | null }>(
    `SELECT sum(-delta) AS spent FROM game_history WHERE user_id = $1 AND game = 'market' AND created_at >= ${TODAY}`,
    [userId],
  )
  if (Number(r.rows[0]?.spent ?? 0) + price > limit.marketSpendLimit) throw new Error(BUY_BLOCKED)
}

export async function listLimits(): Promise<MemberLimit[]> {
  const r = await pool.query<Row>(`SELECT * FROM member_limits ORDER BY updated_at DESC LIMIT 500`)
  return r.rows.map(toLimit)
}

export async function findMember(query: string) {
  const q = query.trim().toLowerCase()
  if (q.length < 2) return []
  const r = await pool.query<{ id: string; name: string | null; email: string }>(
    `SELECT id, name, email FROM "user" WHERE lower(email) = $1 OR lower(name) LIKE $2 OR lower(email) LIKE $2 ORDER BY name LIMIT 10`,
    [q, `%${q.replace(/[%_]/g, '')}%`],
  )
  return r.rows.map((u) => ({ id: String(u.id), name: u.name ?? '', email: u.email }))
}

const cleanInt = (v: number | null) => (v === null || !Number.isFinite(v) || v < 0 ? null : Math.floor(Math.min(v, 100_000_000)))

export async function saveLimit(userId: string, input: LimitInput, by: string) {
  const u = await pool.query<{ name: string | null; email: string }>(`SELECT name, email FROM "user" WHERE id = $1`, [userId])
  if (!u.rows[0]) throw new Error('Üye bulunamadı.')
  const dailyWin = cleanInt(input.dailyWinLimit)
  const dailyGame = cleanInt(input.dailyGameLimit)
  const spend = cleanInt(input.marketSpendLimit)
  const ban = !!input.marketBan
  const note = String(input.note ?? '').slice(0, 300)
  if (dailyWin === null && dailyGame === null && spend === null && !ban) {
    await pool.query(`DELETE FROM member_limits WHERE user_id = $1`, [userId])
    return
  }
  await pool.query(
    `INSERT INTO member_limits (user_id, user_name, user_email, daily_win_limit, daily_game_limit, market_ban, market_spend_limit, note, updated_by, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, now())
     ON CONFLICT (user_id) DO UPDATE SET user_name = EXCLUDED.user_name, user_email = EXCLUDED.user_email,
       daily_win_limit = EXCLUDED.daily_win_limit, daily_game_limit = EXCLUDED.daily_game_limit, market_ban = EXCLUDED.market_ban,
       market_spend_limit = EXCLUDED.market_spend_limit, note = EXCLUDED.note, updated_by = EXCLUDED.updated_by, updated_at = now()`,
    [userId, u.rows[0].name ?? '', u.rows[0].email, dailyWin, dailyGame, ban, spend, note, by],
  )
}

export async function removeLimit(userId: string) {
  await pool.query(`DELETE FROM member_limits WHERE user_id = $1`, [userId])
}
