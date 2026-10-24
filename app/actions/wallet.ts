'use server'

import { randomInt } from 'node:crypto'
import { getContent } from '@/lib/content'
import { getCatalog, getHidden, getRewardConfig } from '@/lib/catalog'
import { isHidden } from '@/lib/hidden-shared'
import { diceReward, wheelBigIndices, type RewardConfig } from '@/lib/rewards-shared'
import { rows, sql } from '@/lib/db'
import { credit, debit, getBalance, getMember, recordHistory } from '@/lib/member'
import { hitRateLimit, RATE_LIMIT_MESSAGE } from '@/lib/rate-limit'
import { withUserLock } from '@/lib/user-lock'

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
export type MiniStatus = Record<MiniGame, number | null> & { hidden?: MiniGame[] }

/** Epoch ms when the next free play unlocks, or null when available now. */
async function miniNextAt(userId: string, game: MiniGame, config: RewardConfig): Promise<number | null> {
  if (game === 'cark') {
    const r = await rows<{ next: string | null }>(sql`SELECT extract(epoch FROM max(created_at) + ${`${config.wheel.cooldownHours} hours`}::interval) * 1000 AS next
      FROM game_history WHERE user_id = ${userId} AND game = 'cark' AND mode = 'odul'`)
    const next = r[0]?.next ? Number(r[0].next) : null
    return next && next > Date.now() ? next : null
  }
  const dailyPlays = game === 'zar' ? config.dice.dailyPlays : config.chest.dailyPlays
  const r = await rows<{ used: string; next: string }>(sql`SELECT
      (SELECT count(*) FROM game_history WHERE user_id = ${userId} AND game = ${game} AND mode = 'odul'
        AND created_at >= (date_trunc('day', now() AT TIME ZONE 'Europe/Istanbul') AT TIME ZONE 'Europe/Istanbul')) AS used,
      extract(epoch FROM ((date_trunc('day', now() AT TIME ZONE 'Europe/Istanbul') + interval '1 day') AT TIME ZONE 'Europe/Istanbul')) * 1000 AS next`)
  return Number(r[0]?.used ?? 0) >= dailyPlays ? Number(r[0].next) : null
}

export async function getMiniStatus(): Promise<MiniStatus> {
  const [member, hiddenMap] = await Promise.all([getMember(), getHidden()])
  const hidden = (hiddenMap.mini ?? []) as MiniGame[]
  if (!member) return { cark: null, sandik: null, zar: null, hidden }
  const config = await getRewardConfig()
  const [cark, sandik, zar] = await Promise.all([
    miniNextAt(member.id, 'cark', config),
    miniNextAt(member.id, 'sandik', config),
    miniNextAt(member.id, 'zar', config),
  ])
  return { cark, sandik, zar, hidden }
}

/**
 * Prediction reward. The amount comes from the server catalog, never from the client,
 * and each prediction pays at most once per member.
 */
export async function claimPrediction(matchId: string, optionId: string): Promise<WalletResult> {
  const member = await getMember()
  if (!member) return { ok: false, error: 'Ödül almak için giriş yapmalısın.' }
  if (await hitRateLimit(`reward:${member.id}`, 10, 60)) return { ok: false, error: RATE_LIMIT_MESSAGE }
  const limit = REWARD_LIMITS.tahmin
  const { predictions } = await getCatalog()
  const match = predictions.find((p) => p.id === String(matchId))
  if (!match || !match.options.some((o) => o.id === String(optionId))) return { ok: false, error: 'Geçersiz tahmin.' }
  const value = Math.min(limit.perClaim, Math.max(0, Math.round(Number(match.reward) / 5)))
  if (!value) return { ok: false, error: 'Bu tahmin için ödül yok.' }
  const ref = `tahmin:${match.id}`

  try {
    return await withUserLock(`reward:${member.id}:tahmin`, async (): Promise<WalletResult> => {
      const r = await rows<{ today: string; done: string }>(sql`SELECT
          count(*) FILTER (WHERE created_at >= (date_trunc('day', now() AT TIME ZONE 'Europe/Istanbul') AT TIME ZONE 'Europe/Istanbul')) AS today,
          count(*) FILTER (WHERE table_id = ${ref}) AS done
        FROM game_history WHERE user_id = ${member.id} AND game = 'tahmin' AND mode = 'odul'`)
      if (Number(r[0]?.done ?? 0) > 0) return { ok: false, error: 'Bu maç için zaten tahmin yaptın.', balance: await getBalance(member.id) }
      if (Number(r[0]?.today ?? 0) >= limit.perDay) {
        return { ok: false, error: `${limit.label} için bugünkü hakkın doldu.`, balance: await getBalance(member.id) }
      }
      await credit(member.id, value)
      await recordHistory({ userId: member.id, userName: member.name, game: 'tahmin', mode: 'odul', opponent: limit.label, stake: 0, result: 'win', delta: value, tableId: ref })
      return { ok: true, balance: await getBalance(member.id) }
    })
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Bir hata oluştu.' }
  }
}

/* ---------- House mini games: outcome decided on the server ---------- */

const pickFrom = <T,>(arr: readonly T[]) => arr[randomInt(arr.length)]

export async function getHouseWinRate() {
  const saved = await getContent<{ winRate?: number }>('arena:house').catch(() => null)
  const rate = Number(saved?.winRate)
  return Number.isFinite(rate) && rate >= 0 && rate <= 100 ? rate : 40
}

export type MiniOutcome =
  | { game: 'cark'; index: number; points: number; segments: RewardConfig['wheel']['segments'] }
  | { game: 'zar'; dice: [number, number]; points: number }
  | { game: 'sandik'; prizes: number[]; points: number }

export async function playMini(game: MiniGame, chest = 0): Promise<({ ok: true; balance: number } & MiniOutcome) | { ok: false; error: string; balance?: number }> {
  const member = await getMember()
  if (!member) return { ok: false, error: 'Oynamak için giriş yapmalısın.' }
  if (await hitRateLimit(`mini:${member.id}`, 6, 30)) return { ok: false, error: RATE_LIMIT_MESSAGE }
  const limit = REWARD_LIMITS[game]
  if (!limit) return { ok: false, error: 'Geçersiz oyun.' }
  try {
    return await withUserLock(`mini:${member.id}`, () => playMiniLocked(member, game, chest, limit.label))
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Bir hata oluştu.' }
  }
}

async function playMiniLocked(
  member: { id: string; name: string },
  game: MiniGame,
  chest: number,
  label: string,
): Promise<({ ok: true; balance: number } & MiniOutcome) | { ok: false; error: string; balance?: number }> {
  const limit = { label }
  if (isHidden(await getHidden(), 'mini', game)) return { ok: false, error: `${limit.label} şu an kapalı.` }
  const config = await getRewardConfig()
  if (await miniNextAt(member.id, game, config)) {
    return { ok: false, error: `${limit.label} için hakkın henüz yenilenmedi.`, balance: await getBalance(member.id) }
  }
  const big = randomInt(100) < (await getHouseWinRate())

  let outcome: MiniOutcome
  if (game === 'cark') {
    const segments = config.wheel.segments
    const bigSet = wheelBigIndices(segments)
    const all = segments.map((_, i) => i)
    const pool = all.filter((i) => bigSet.has(i) === big)
    const index = pickFrom(pool.length ? pool : all)
    outcome = { game, index, points: segments[index].points, segments }
  } else if (game === 'zar') {
    let a = 1
    let b = 1
    for (let i = 0; i < 200; i++) {
      a = 1 + randomInt(6)
      b = 1 + randomInt(6)
      if (diceReward(a, b, config.dice).big === big) break
    }
    outcome = { game, dice: [a, b], points: diceReward(a, b, config.dice).points }
  } else {
    const chests = config.chest.chests
    const c = Math.max(0, Math.min(chests.length - 1, Math.floor(Number(chest)) || 0))
    const prizes = chests.map((ch) => pickFrom(ch.rewards))
    const pool = chests[c].rewards
    const split = Math.floor(pool.length / 2)
    prizes[c] = pickFrom(big ? pool.slice(split) : pool.slice(0, split))
    outcome = { game, prizes, points: prizes[c] }
  }

  await credit(member.id, outcome.points)
  await recordHistory({ userId: member.id, userName: member.name, game, mode: 'odul', opponent: limit.label, stake: 0, result: big ? 'win' : 'draw', delta: outcome.points })
  return { ok: true, balance: await getBalance(member.id), ...outcome }
}

export async function spendKC(source: string, amount: number): Promise<WalletResult> {
  const member = await getMember()
  if (!member) return { ok: false, error: 'Bu işlem için giriş yapmalısın.' }
  if (await hitRateLimit(`spend:${member.id}`, 10, 60)) return { ok: false, error: RATE_LIMIT_MESSAGE }
  const label = SPEND_SOURCES[source]
  if (!label) return { ok: false, error: 'Geçersiz işlem.' }
  const value = Math.floor(Number(amount))
  if (!Number.isInteger(value) || value <= 0 || value > 100000) return { ok: false, error: 'Geçersiz tutar.' }
  if (!(await debit(member.id, value))) return { ok: false, error: 'Yetersiz Kanka Coin.', balance: await getBalance(member.id) }
  await recordHistory({ userId: member.id, userName: member.name, game: source, mode: 'harcama', opponent: label, stake: value, result: 'loss', delta: -value })
  return { ok: true, balance: await getBalance(member.id) }
}
