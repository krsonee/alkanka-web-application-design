'use server'

import { revalidatePath } from 'next/cache'
import { isAdmin } from '@/lib/admin-auth'
import { setContent } from '@/lib/content'
import { ARENA_GAMES, ARENA_META, isArenaGame, type ArenaSettings } from '@/lib/arena'
import { createBracket, setMatchWinner, bracketChampion } from '@/lib/bracket'
import {
  TOURNAMENT_STATUSES,
  createTournament,
  deleteTournament,
  getTournament,
  removeEntry,
  setTournamentState,
  updateTournament,
  type TournamentInput,
  type TournamentStatus,
} from '@/lib/tournaments'
import type { ActionState } from './actions'

async function requireAdmin() {
  if (!(await isAdmin())) throw new Error('Oturum süresi doldu, tekrar giriş yap.')
}

function refresh() {
  revalidatePath('/turnuvalar')
  revalidatePath('/oyunlar', 'layout')
  revalidatePath('/panel')
}

function fail(e: unknown, fallback: string): ActionState {
  return { message: e instanceof Error ? e.message : fallback }
}

function int(form: FormData, name: string, min: number, max: number) {
  const n = Math.round(Number(form.get(name)))
  if (!Number.isFinite(n) || n < min || n > max) throw new Error(`${name} ${min} ile ${max} arasında olmalı.`)
  return n
}

export async function saveArenaSettings(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    await requireAdmin()
    const value = {} as ArenaSettings
    for (const g of ARENA_GAMES) {
      const bets = String(form.get(`${g}:bets`) ?? '')
        .split(/[,\s]+/)
        .map((v) => Math.round(Number(v)))
        .filter((v) => Number.isFinite(v) && v > 0 && v <= 100000)
      const unique = [...new Set(bets)].sort((a, b) => a - b).slice(0, 6)
      if (!unique.length) return { message: `${ARENA_META[g].title}: en az bir bahis tutarı gir.` }
      const multiplier = Number(String(form.get(`${g}:multiplier`) ?? '').replace(',', '.'))
      if (!Number.isFinite(multiplier) || multiplier < 1 || multiplier > 20) return { message: `${ARENA_META[g].title}: çarpan 1 ile 20 arasında olmalı.` }
      value[g] = { enabled: form.get(`${g}:enabled`) === 'on', bets: unique, multiplier: Math.round(multiplier * 100) / 100 }
    }
    await setContent('arena:settings', value)
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
  return {
    game,
    title,
    description: String(form.get('description') ?? '').trim().slice(0, 400),
    entryFee: int(form, 'entryFee', 0, 100000),
    prizePool: int(form, 'prizePool', 0, 10000000),
    prizeNote: String(form.get('prizeNote') ?? '').trim().slice(0, 120),
    maxPlayers: int(form, 'maxPlayers', 2, 256),
    startsAt,
  }
}

export async function saveTournament(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    await requireAdmin()
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
    await requireAdmin()
    await deleteTournament(Number(form.get('id')))
    refresh()
    return { ok: true, message: 'Silindi.' }
  } catch (e) {
    return fail(e, 'Silinemedi.')
  }
}

export async function changeTournamentStatus(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    await requireAdmin()
    const t = await getTournament(Number(form.get('id')))
    if (!t) return { message: 'Turnuva bulunamadı.' }
    const status = String(form.get('status')) as TournamentStatus
    if (!TOURNAMENT_STATUSES.includes(status)) return { message: 'Geçersiz durum.' }
    let bracket = t.bracket
    if (status === 'basladi' && !bracket) {
      if (t.entries.length < 2) return { message: 'Başlatmak için en az 2 katılımcı gerekli.' }
      bracket = createBracket(t.entries.map((e) => e.nickname), ARENA_META[t.game].group)
    }
    if (status === 'kayit') bracket = null
    await setTournamentState(t.id, status, bracket, status === 'kayit' ? null : bracketChampion(bracket) ?? t.winner)
    refresh()
    return { ok: true, message: status === 'basladi' ? 'Eşleşmeler oluşturuldu, turnuva başladı.' : 'Durum güncellendi.' }
  } catch (e) {
    return fail(e, 'Güncellenemedi.')
  }
}

export async function reshuffleBracket(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    await requireAdmin()
    const t = await getTournament(Number(form.get('id')))
    if (!t) return { message: 'Turnuva bulunamadı.' }
    if (t.entries.length < 2) return { message: 'En az 2 katılımcı gerekli.' }
    const bracket = createBracket(t.entries.map((e) => e.nickname), ARENA_META[t.game].group)
    await setTournamentState(t.id, 'basladi', bracket, null)
    refresh()
    return { ok: true, message: 'Eşleşmeler yeniden çekildi.' }
  } catch (e) {
    return fail(e, 'Çekilemedi.')
  }
}

export async function pickMatchWinner(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    await requireAdmin()
    const t = await getTournament(Number(form.get('id')))
    if (!t?.bracket) return { message: 'Önce turnuvayı başlat.' }
    const winner = String(form.get('winner') ?? '') || null
    const bracket = setMatchWinner(t.bracket, Number(form.get('round')), Number(form.get('match')), winner)
    const champion = bracketChampion(bracket)
    await setTournamentState(t.id, champion ? 'bitti' : 'basladi', bracket, champion)
    refresh()
    return { ok: true, message: champion ? `Şampiyon: ${champion}` : 'Kaydedildi.' }
  } catch (e) {
    return fail(e, 'Kaydedilemedi.')
  }
}

export async function kickEntry(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    await requireAdmin()
    await removeEntry(Number(form.get('entryId')))
    refresh()
    return { ok: true, message: 'Katılımcı çıkarıldı.' }
  } catch (e) {
    return fail(e, 'Çıkarılamadı.')
  }
}
