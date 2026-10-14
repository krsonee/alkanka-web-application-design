'use server'

import { revalidatePath } from 'next/cache'
import { pool } from '@/lib/db'
import { credit, debit, getBalance, getMember, recordHistory } from '@/lib/member'
import { getArenaSettings } from '@/lib/arena-server'
import { ARENA_META, isArenaGame } from '@/lib/arena'
import { bjAct, bjDeal, bjPayout, bjPublic, betLabel, betReturn, validBet, type BjState, type RouletteBet } from '@/lib/casino'
import { actOnTable, cancelTable, claimTimeout, createTable, joinTable } from '@/lib/pvp/tables'
import { joinTournament, leaveTournament } from '@/lib/tournaments'
import { placeLiveBets } from '@/lib/roulette-live'
import { assertCanPlay, capPayout } from '@/lib/member-limits'
import { assertRateLimit } from '@/lib/rate-limit'
import { actAtTable as bjLiveAct, readyAtTable as bjLiveReady, joinBlackjack as bjLiveJoin } from '@/lib/blackjack-live'

type Fail = { ok: false; error: string }
const fail = (error: unknown): Fail => ({ ok: false, error: error instanceof Error ? error.message : 'Bir hata oluştu.' })

async function member() {
  const m = await getMember()
  if (!m) throw new Error('Bu işlem için giriş yapmalısın.')
  await assertRateLimit(`game:${m.id}`, 40, 10)
  return m
}

/* ---------------- Bot tables (solo sessions) ---------------- */

const CLIENT_SETTLED = ['tavla', 'okey', 'bilardo', 'kafa-topu', 'kafa-basketbolu']
const MIN_WIN_SECONDS: Record<string, number> = { tavla: 60, okey: 45, bilardo: 40, 'kafa-topu': 50, 'kafa-basketbolu': 50 }

export async function startBotGame(game: string, stake: number) {
  try {
    const m = await member()
    if (!isArenaGame(game) || !CLIENT_SETTLED.includes(game)) throw new Error('Geçersiz oyun.')
    const s = (await getArenaSettings())[game]
    if (!s.enabled) throw new Error('Bu oyun şu an kapalı.')
    if (!s.bets.includes(stake)) throw new Error('Geçersiz bahis.')
    await assertCanPlay(m.id)
    await pool.query(`UPDATE solo_sessions SET status = 'terk' WHERE user_id = $1 AND game = $2 AND status = 'acik'`, [m.id, game])
    if (!(await debit(m.id, stake))) throw new Error('Yetersiz Kanka Coin.')
    const r = await pool.query(`INSERT INTO solo_sessions (user_id, game, stake, status) VALUES ($1,$2,$3,'acik') RETURNING id`, [m.id, game, stake])
    return { ok: true as const, sessionId: String(r.rows[0].id), balance: await getBalance(m.id) }
  } catch (e) {
    return fail(e)
  }
}

export async function finishBotGame(sessionId: string, result: 'win' | 'loss' | 'draw', score?: { for: number; against: number }) {
  try {
    const m = await member()
    const r = await pool.query(
      `UPDATE solo_sessions SET status = 'bitti', state = $3::jsonb WHERE id = $1 AND user_id = $2 AND status = 'acik'
       RETURNING game, stake, extract(epoch FROM now() - created_at) AS secs`,
      [sessionId, m.id, JSON.stringify({ result, score: score ?? null })],
    )
    const row = r.rows[0]
    if (!row) throw new Error('Oyun oturumu bulunamadı.')
    const game = String(row.game) as keyof typeof ARENA_META
    const stake = Number(row.stake)
    let final = result
    if (final === 'win' && Number(row.secs) < (MIN_WIN_SECONDS[game] ?? 30)) final = 'loss'
    const s = (await getArenaSettings())[game]
    const payout = await capPayout(m.id, stake, final === 'win' ? Math.floor(stake * s.multiplier) : final === 'draw' ? stake : 0)
    if (payout) await credit(m.id, payout)
    await recordHistory({
      userId: m.id,
      userName: m.name,
      game,
      mode: 'bot',
      opponent: 'Alkanka Bot',
      stake,
      result: final,
      delta: payout - stake,
      score: score ? score.for : null,
    })
    return { ok: true as const, result: final, payout, balance: await getBalance(m.id) }
  } catch (e) {
    return fail(e)
  }
}

/* ---------------- Blackjack (server RNG) ---------------- */

async function settleBlackjack(m: { id: string; name: string }, id: string, state: BjState, stake: number) {
  const payout = await capPayout(m.id, state.bet, bjPayout(state))
  if (payout) await credit(m.id, payout)
  const result = state.result === 'push' ? 'draw' : state.result === 'loss' ? 'loss' : 'win'
  await recordHistory({ userId: m.id, userName: m.name, game: 'blackjack', mode: 'bot', opponent: 'Krupiye', stake: state.bet, result, delta: payout - state.bet, tableId: id })
  void stake
}

export async function blackjackDeal(stake: number) {
  try {
    const m = await member()
    const s = (await getArenaSettings()).blackjack
    if (!s.enabled) throw new Error('Blackjack şu an kapalı.')
    if (!s.bets.includes(stake)) throw new Error('Geçersiz bahis.')
    await assertCanPlay(m.id)
    if (!(await debit(m.id, stake))) throw new Error('Yetersiz Kanka Coin.')
    const state = bjDeal(stake)
    const r = await pool.query(`INSERT INTO solo_sessions (user_id, game, stake, status, state) VALUES ($1,'blackjack',$2,$3,$4::jsonb) RETURNING id`, [
      m.id,
      stake,
      state.phase === 'done' ? 'bitti' : 'acik',
      JSON.stringify(state),
    ])
    const id = String(r.rows[0].id)
    if (state.phase === 'done') await settleBlackjack(m, id, state, stake)
    return { ok: true as const, id, hand: bjPublic(state), balance: await getBalance(m.id) }
  } catch (e) {
    return fail(e)
  }
}

export async function blackjackAct(id: string, action: 'hit' | 'stand' | 'double') {
  try {
    const m = await member()
    const r = await pool.query(`SELECT * FROM solo_sessions WHERE id = $1 AND user_id = $2 AND game = 'blackjack' AND status = 'acik'`, [id, m.id])
    const row = r.rows[0]
    if (!row) throw new Error('El bulunamadı.')
    const prev = row.state as BjState
    if (action === 'double') {
      if (prev.player.length !== 2) throw new Error('Sadece ilk iki kartta ikiye katlayabilirsin.')
      if (!(await debit(m.id, prev.bet))) throw new Error('İkiye katlamak için yeterli KC yok.')
    }
    const state = bjAct(prev, action)
    const upd = await pool.query(`UPDATE solo_sessions SET state = $3::jsonb, status = $4 WHERE id = $1 AND user_id = $2 AND status = 'acik' RETURNING id`, [
      id,
      m.id,
      JSON.stringify(state),
      state.phase === 'done' ? 'bitti' : 'acik',
    ])
    if (!upd.rowCount) {
      if (action === 'double') await credit(m.id, prev.bet)
      throw new Error('El zaten bitti.')
    }
    if (state.phase === 'done') await settleBlackjack(m, id, state, Number(row.stake))
    return { ok: true as const, id, hand: bjPublic(state), balance: await getBalance(m.id) }
  } catch (e) {
    return fail(e)
  }
}

export async function joinBlackjackTable(bet: number, prefer?: number | null) {
  try {
    const m = await member()
    const s = (await getArenaSettings()).blackjack
    if (!s.enabled) throw new Error('Blackjack şu an kapalı.')
    await assertCanPlay(m.id)
    const preferred = Number.isInteger(prefer) && prefer! > 0 ? prefer! : null
    const res = await bjLiveJoin(m, bet, s.bets, preferred)
    return { ok: true as const, ...res }
  } catch (e) {
    return fail(e)
  }
}

export async function readyBlackjackTable() {
  try {
    const m = await member()
    const res = await bjLiveReady(m)
    return { ok: true as const, ...res }
  } catch (e) {
    return fail(e)
  }
}

export async function actBlackjackTable(action: 'hit' | 'stand' | 'double') {
  try {
    const m = await member()
    if (!['hit', 'stand', 'double'].includes(action)) throw new Error('Geçersiz hamle.')
    const res = await bjLiveAct(m, action)
    return { ok: true as const, ...res }
  } catch (e) {
    return fail(e)
  }
}

/* ---------------- Roulette (server RNG) ---------------- */

export async function spinRoulette(bets: RouletteBet[]) {
  try {
    const m = await member()
    const s = (await getArenaSettings()).rulet
    if (!s.enabled) throw new Error('Rulet şu an kapalı.')
    if (!Array.isArray(bets) || bets.length === 0 || bets.length > 20) throw new Error('En az bir bahis koy.')
    const max = Math.max(...s.bets)
    if (!bets.every(validBet) || bets.some((b) => b.amount > max)) throw new Error('Geçersiz bahis.')
    const total = bets.reduce((a, b) => a + b.amount, 0)
    await assertCanPlay(m.id)
    if (!(await debit(m.id, total))) throw new Error('Yetersiz Kanka Coin.')
    const n = Math.floor(Math.random() * 37)
    const returned = await capPayout(m.id, total, bets.reduce((a, b) => a + betReturn(b, n), 0))
    if (returned) await credit(m.id, returned)
    await recordHistory({
      userId: m.id,
      userName: m.name,
      game: 'rulet',
      mode: 'bot',
      opponent: `Sayı ${n} - ${bets.map(betLabel).join(', ').slice(0, 60)}`,
      stake: total,
      result: returned > total ? 'win' : returned === total ? 'draw' : 'loss',
      delta: returned - total,
      score: n,
    })
    return { ok: true as const, number: n, returned, total, balance: await getBalance(m.id) }
  } catch (e) {
    return fail(e)
  }
}

export async function placeLiveRouletteBets(bets: RouletteBet[]) {
  try {
    const m = await member()
    const s = (await getArenaSettings()).rulet
    if (!s.enabled) throw new Error('Rulet şu an kapalı.')
    await assertCanPlay(m.id)
    const r = await placeLiveBets(m, bets, Math.max(...s.bets))
    return { ok: true as const, ...r }
  } catch (e) {
    return fail(e)
  }
}

/* ---------------- Player tables ---------------- */

export async function openTable(game: string, stake: number, options?: { seats?: number; team?: boolean; bots?: number }) {
  try {
    const m = await member()
    await assertCanPlay(m.id)
    const id = await createTable(m, game, stake, options)
    revalidatePath('/oyunlar/masalar')
    return { ok: true as const, id }
  } catch (e) {
    return fail(e)
  }
}

export async function sitAtTable(id: string) {
  try {
    const m = await member()
    await assertCanPlay(m.id)
    await joinTable(m, id)
    return { ok: true as const }
  } catch (e) {
    return fail(e)
  }
}

export async function closeTable(id: string) {
  try {
    const m = await member()
    await cancelTable(id, { byUser: m.id })
    return { ok: true as const }
  } catch (e) {
    return fail(e)
  }
}

export async function inviteToTable(id: string) {
  try {
    const m = await member()
    const { headers } = await import('next/headers')
    const { sendTableInvite } = await import('@/lib/table-invite')
    const h = await headers()
    const host = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? h.get('x-forwarded-host') ?? h.get('host') ?? 'alkanka.com'
    return await sendTableInvite(m, id, `https://${host}`)
  } catch (e) {
    return fail(e)
  }
}

export async function playMove(id: string, version: number, action: { type: string; [k: string]: unknown }) {
  try {
    await actOnTable(await member(), id, version, action)
    return { ok: true as const }
  } catch (e) {
    return fail(e)
  }
}

export async function claimTableTimeout(id: string) {
  try {
    await claimTimeout(await member(), id)
    return { ok: true as const }
  } catch (e) {
    return fail(e)
  }
}

/* ---------------- Tournaments ---------------- */

export async function enterTournament(id: number) {
  try {
    await joinTournament(await member(), id)
    revalidatePath('/turnuvalar')
    return { ok: true as const }
  } catch (e) {
    return fail(e)
  }
}

export async function exitTournament(id: number) {
  try {
    await leaveTournament(await member(), id)
    revalidatePath('/turnuvalar')
    return { ok: true as const }
  } catch (e) {
    return fail(e)
  }
}
