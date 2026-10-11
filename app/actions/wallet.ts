'use server'

import { rows, sql } from '@/lib/db'
import { credit, debit, getBalance, getMember, recordHistory } from '@/lib/member'

type WalletResult = { ok: true; balance: number } | { ok: false; error: string; balance?: number }

const REWARD_LIMITS: Record<string, { perClaim: number; perDay: number; label: string }> = {
  cark: { perClaim: 500, perDay: 3, label: 'Şans Çarkı' },
  sandik: { perClaim: 500, perDay: 3, label: 'Gizemli Sandık' },
  zar: { perClaim: 400, perDay: 3, label: 'Zar At' },
  gorev: { perClaim: 300, perDay: 12, label: 'Görev' },
  tahmin: { perClaim: 200, perDay: 10, label: 'Tahmin' },
}

const SPEND_SOURCES: Record<string, string> = { market: 'Puan marketi', etkinlik: 'Etkinlik' }

export type MiniGame = 'cark' | 'sandik' | 'zar'
export type MiniStatus = Record<MiniGame, number | null>

const WHEEL_COOLDOWN_HOURS = 6

/** Epoch ms when the next free play unlocks, or null when available now. */
async function miniNextAt(userId: string, game: MiniGame): Promise<number | null> {
  if (game === 'cark') {
    const r = await rows<{ next: string | null }>(sql`SELECT extract(epoch FROM max(created_at) + ${`${WHEEL_COOLDOWN_HOURS} hours`}::interval) * 1000 AS next
      FROM game_history WHERE user_id = ${userId} AND game = 'cark' AND mode = 'odul'`)
    const next = r[0]?.next ? Number(r[0].next) : null
    return next && next > Date.now() ? next : null
  }
  const dailyPlays = game === 'zar' ? 3 : 1
  const r = await rows<{ used: string; next: string }>(sql`SELECT
      (SELECT count(*) FROM game_history WHERE user_id = ${userId} AND game = ${game} AND mode = 'odul'
        AND created_at >= (date_trunc('day', now() AT TIME ZONE 'Europe/Istanbul') AT TIME ZONE 'Europe/Istanbul')) AS used,
      extract(epoch FROM ((date_trunc('day', now() AT TIME ZONE 'Europe/Istanbul') + interval '1 day') AT TIME ZONE 'Europe/Istanbul')) * 1000 AS next`)
  return Number(r[0]?.used ?? 0) >= dailyPlays ? Number(r[0].next) : null
}

export async function getMiniStatus(): Promise<MiniStatus> {
  const member = await getMember()
  if (!member) return { cark: null, sandik: null, zar: null }
  const [cark, sandik, zar] = await Promise.all([
    miniNextAt(member.id, 'cark'),
    miniNextAt(member.id, 'sandik'),
    miniNextAt(member.id, 'zar'),
  ])
  return { cark, sandik, zar }
}

export async function claimReward(source: string, amount: number): Promise<WalletResult> {
  const member = await getMember()
  if (!member) return { ok: false, error: 'Ödül almak için giriş yapmalısın.' }
  const limit = REWARD_LIMITS[source]
  if (!limit) return { ok: false, error: 'Geçersiz ödül.' }
  const value = Math.floor(Number(amount))
  if (!Number.isInteger(value) || value <= 0 || value > limit.perClaim) return { ok: false, error: 'Geçersiz ödül tutarı.' }

  if (source === 'cark' || source === 'sandik' || source === 'zar') {
    if (await miniNextAt(member.id, source)) {
      return { ok: false, error: `${limit.label} için hakkın henüz yenilenmedi.`, balance: await getBalance(member.id) }
    }
  }

  const today = await rows<{ c: string }>(sql`SELECT count(*) AS c FROM game_history
    WHERE user_id = ${member.id} AND game = ${source} AND mode = 'odul' AND created_at > date_trunc('day', now())`)
  if (Number(today[0]?.c ?? 0) >= limit.perDay) {
    return { ok: false, error: `${limit.label} için bugünkü hakkın doldu.`, balance: await getBalance(member.id) }
  }

  await credit(member.id, value)
  await recordHistory({ userId: member.id, userName: member.name, game: source, mode: 'odul', opponent: limit.label, stake: 0, result: 'win', delta: value })
  return { ok: true, balance: await getBalance(member.id) }
}

export async function spendKC(source: string, amount: number): Promise<WalletResult> {
  const member = await getMember()
  if (!member) return { ok: false, error: 'Bu işlem için giriş yapmalısın.' }
  const label = SPEND_SOURCES[source]
  if (!label) return { ok: false, error: 'Geçersiz işlem.' }
  const value = Math.floor(Number(amount))
  if (!Number.isInteger(value) || value <= 0 || value > 100000) return { ok: false, error: 'Geçersiz tutar.' }
  if (!(await debit(member.id, value))) return { ok: false, error: 'Yetersiz Kanka Coin.', balance: await getBalance(member.id) }
  await recordHistory({ userId: member.id, userName: member.name, game: source, mode: 'harcama', opponent: label, stake: value, result: 'loss', delta: -value })
  return { ok: true, balance: await getBalance(member.id) }
}
