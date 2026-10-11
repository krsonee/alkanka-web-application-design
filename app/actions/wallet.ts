'use server'

import { rows, sql } from '@/lib/db'
import { credit, debit, getBalance, getMember, recordHistory } from '@/lib/member'

type WalletResult = { ok: true; balance: number } | { ok: false; error: string; balance?: number }

const REWARD_LIMITS: Record<string, { perClaim: number; perDay: number; label: string }> = {
  cark: { perClaim: 500, perDay: 3, label: 'Şans Çarkı' },
  sandik: { perClaim: 500, perDay: 3, label: 'Gizemli Sandık' },
  gorev: { perClaim: 300, perDay: 12, label: 'Görev' },
  tahmin: { perClaim: 200, perDay: 10, label: 'Tahmin' },
}

const SPEND_SOURCES: Record<string, string> = { market: 'Puan marketi', etkinlik: 'Etkinlik' }

export async function claimReward(source: string, amount: number): Promise<WalletResult> {
  const member = await getMember()
  if (!member) return { ok: false, error: 'Ödül almak için giriş yapmalısın.' }
  const limit = REWARD_LIMITS[source]
  if (!limit) return { ok: false, error: 'Geçersiz ödül.' }
  const value = Math.floor(Number(amount))
  if (!Number.isInteger(value) || value <= 0 || value > limit.perClaim) return { ok: false, error: 'Geçersiz ödül tutarı.' }

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
