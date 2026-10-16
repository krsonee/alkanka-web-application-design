'use server'

import { revalidatePath } from 'next/cache'
import { canPanel } from '@/lib/admin-auth'
import type { PanelModule } from '@/lib/panel-modules'
import { setContent } from '@/lib/content'
import { pool } from '@/lib/db'
import { credit, debit, recordHistory } from '@/lib/member'
import { ARENA_GAMES, ARENA_META, isArenaGame, type ArenaSettings } from '@/lib/arena'
import { cancelTable } from '@/lib/pvp/tables'
import {
  MAX_TOURNAMENT_PLAYERS,
  adminSetMatchWinner,
  cancelTournament,
  createTournament,
  deleteTournament,
  removeEntry,
  startTournament,
  updateTournament,
  type TournamentInput,
} from '@/lib/tournaments'
import { isTournamentFormat } from '@/lib/tournaments-shared'
import { MAX_LEAGUE_PLAYERS } from '@/lib/league'
import type { ActionState } from './actions'

async function requireAdmin(module: PanelModule) {
  if (!(await canPanel(module))) throw new Error('Oturum süresi doldu, tekrar giriş yap.')
}

function refresh() {
  revalidatePath('/turnuvalar')
  revalidatePath('/oyunlar', 'layout')
  revalidatePath('/panel')
}

function fail(e: unknown, fallback: string): ActionState {
  return { message: e instanceof Error ? e.message : fallback }
}

function int(form: FormData, name: string, label: string, min: number, max: number) {
  const n = Math.round(Number(form.get(name)))
  if (!Number.isFinite(n) || n < min || n > max) throw new Error(`${label} ${min} ile ${max} arasında olmalı.`)
  return n
}

export async function saveArenaSettings(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    await requireAdmin('games')
    const value = {} as ArenaSettings
    for (const g of ARENA_GAMES) {
      const title = ARENA_META[g].title
      const bets = String(form.get(`${g}:bets`) ?? '')
        .split(/[,\s]+/)
        .map((v) => Math.round(Number(v)))
        .filter((v) => Number.isFinite(v) && v > 0 && v <= 100000)
      const unique = [...new Set(bets)].sort((a, b) => a - b).slice(0, 6)
      if (!unique.length) return { message: `${title}: en az bir bahis tutarı gir.` }
      const multiplier = Number(String(form.get(`${g}:multiplier`) ?? '').replace(',', '.'))
      if (!Number.isFinite(multiplier) || multiplier < 1 || multiplier > 20) return { message: `${title}: çarpan 1 ile 20 arasında olmalı.` }
      const commission = Math.round(Number(form.get(`${g}:commission`) ?? 0))
      if (!Number.isFinite(commission) || commission < 0 || commission > 30) return { message: `${title}: komisyon %0 ile %30 arasında olmalı.` }
      value[g] = {
        enabled: form.get(`${g}:enabled`) === 'on',
        pvpEnabled: form.get(`${g}:pvp`) === 'on',
        bets: unique,
        multiplier: Math.round(multiplier * 100) / 100,
        commission,
      }
    }
    const winRate = Math.round(Number(form.get('house:winRate') ?? 40))
    if (!Number.isFinite(winRate) || winRate < 0 || winRate > 100) return { message: 'Mini oyun kazanma oranı %0 ile %100 arasında olmalı.' }
    await setContent('arena:settings', value)
    await setContent('arena:house', { winRate })
    refresh()
    return { ok: true, message: 'Oyun ayarları kaydedildi.' }
  } catch (e) {
    return fail(e, 'Kaydedilemedi.')
  }
}

function readTournament(form: FormData): TournamentInput {
  const game = String(form.get('game'))
  if (!isArenaGame(game)) throw new Error('Oyun seç.')
  const title = String(form.get('title') ?? '').trim().slice(0, 80)
  if (title.length < 3) throw new Error('Turnuva adı en az 3 karakter olmalı.')
  const startsRaw = String(form.get('startsAt') ?? '')
  const offset = Number(form.get('tz') ?? 0)
  const local = new Date(`${startsRaw}:00Z`)
  if (Number.isNaN(local.getTime())) throw new Error('Başlangıç tarihi geçersiz.')
  const startsAt = new Date(local.getTime() + (Number.isFinite(offset) ? offset : 0) * 60000).toISOString()
  const rawFormat = form.get('format')
  const format = isTournamentFormat(rawFormat) ? rawFormat : 'eleme'
  const maxPlayers = int(form, 'maxPlayers', 'Kişi sayısı', 2, MAX_TOURNAMENT_PLAYERS)
  if (format === 'lig' && maxPlayers > MAX_LEAGUE_PLAYERS) {
    throw new Error(`Lig formatında en fazla ${MAX_LEAGUE_PLAYERS} oyuncu olabilir (herkes herkesle oynar).`)
  }
  return {
    format,
    game,
    title,
    description: String(form.get('description') ?? '').trim().slice(0, 400),
    rules: String(form.get('rules') ?? '').trim().slice(0, 2000),
    entryFee: int(form, 'entryFee', 'Katılım ücreti', 0, 100000),
    prizePool: int(form, 'prizePool', 'Ödül havuzu', 0, 10000000),
    prizeNote: String(form.get('prizeNote') ?? '').trim().slice(0, 120),
    maxPlayers,
    startsAt,
  }
}

export async function saveTournament(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    await requireAdmin('tournaments')
    const input = readTournament(form)
    const id = Number(form.get('id'))
    if (id) await updateTournament(id, input)
    else await createTournament(input)
    refresh()
    return { ok: true, message: id ? 'Turnuva güncellendi.' : 'Turnuva oluşturuldu.' }
  } catch (e) {
    return fail(e, 'Kaydedilemedi.')
  }
}

export async function removeTournament(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    await requireAdmin('tournaments')
    await deleteTournament(Number(form.get('id')))
    refresh()
    return { ok: true, message: 'Turnuva silindi, kayıt ücretleri iade edildi.' }
  } catch (e) {
    return fail(e, 'Silinemedi.')
  }
}

export async function beginTournament(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    await requireAdmin('tournaments')
    await startTournament(Number(form.get('id')))
    refresh()
    return { ok: true, message: 'Turnuva başladı. Tüm eşleşmeler aynı anda açıldı.' }
  } catch (e) {
    return fail(e, 'Başlatılamadı.')
  }
}

export async function stopTournament(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    await requireAdmin('tournaments')
    await cancelTournament(Number(form.get('id')))
    refresh()
    return { ok: true, message: 'Turnuva iptal edildi, kayıt ücretleri iade edildi.' }
  } catch (e) {
    return fail(e, 'İptal edilemedi.')
  }
}

export async function pickMatchWinner(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    await requireAdmin('tournaments')
    const winner = String(form.get('winner') ?? '')
    if (!winner) return { message: 'Kazananı seç.' }
    await adminSetMatchWinner(Number(form.get('id')), Number(form.get('round')), Number(form.get('match')), winner)
    refresh()
    return { ok: true, message: 'Maç sonucu girildi, tur ilerletildi.' }
  } catch (e) {
    return fail(e, 'Kaydedilemedi.')
  }
}

export async function kickEntry(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    await requireAdmin('tournaments')
    await removeEntry(Number(form.get('entryId')))
    refresh()
    return { ok: true, message: 'Katılımcı çıkarıldı, ücreti iade edildi.' }
  } catch (e) {
    return fail(e, 'Çıkarılamadı.')
  }
}

export async function adminCancelTable(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    await requireAdmin('games')
    await cancelTable(String(form.get('id')), { admin: true })
    refresh()
    return { ok: true, message: 'Masa kapatıldı, bahisler iade edildi.' }
  } catch (e) {
    return fail(e, 'Masa kapatılamadı.')
  }
}

export async function adjustMemberBalance(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    await requireAdmin('games')
    const email = String(form.get('email') ?? '').trim().toLowerCase()
    const amount = Math.round(Number(form.get('amount')))
    if (!email) return { message: 'Üye e-postası gir.' }
    if (!Number.isFinite(amount) || amount === 0 || Math.abs(amount) > 1000000) return { message: 'Geçerli bir tutar gir (örn. 500 veya -200).' }
    const u = await pool.query('SELECT id, name FROM "user" WHERE lower(email) = $1', [email])
    const user = u.rows[0]
    if (!user) return { message: 'Bu e-postaya ait üye bulunamadı.' }
    if (amount > 0) await credit(user.id, amount)
    else if (!(await debit(user.id, -amount))) return { message: 'Üyenin bakiyesi yetersiz.' }
    await recordHistory({ userId: user.id, userName: user.name, game: 'panel', mode: 'admin', opponent: 'Panel düzenlemesi', stake: 0, result: amount > 0 ? 'win' : 'loss', delta: amount })
    refresh()
    return { ok: true, message: `${user.name}: ${amount > 0 ? '+' : ''}${amount} KC uygulandı.` }
  } catch (e) {
    return fail(e, 'Uygulanamadı.')
  }
}
