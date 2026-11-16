'use server'

import { logPanel } from '@/lib/panel-log'
import { revalidatePath } from 'next/cache'
import { canPanel } from '@/lib/admin-auth'
import type { PanelModule } from '@/lib/panel-modules'
import { setContent } from '@/lib/content'
import { ARENA_GAMES, ARENA_META, isArenaGame, type ArenaSettings } from '@/lib/arena'
import { getArenaSettings } from '@/lib/arena-server'
import { cancelTable } from '@/lib/pvp/tables'
import {
  MAX_TOURNAMENT_PLAYERS,
  adminSetMatchWinner,
  cancelTournament,
  createTournament,
  deleteTournament,
  getTournament,
  removeEntry,
  startTournament,
  updateTournament,
  type TournamentInput,
} from '@/lib/tournaments'
import { deleteTournamentTemplate, saveTournamentTemplate } from '@/lib/tournament-templates'
import { MAX_TOURNAMENT_TEMPLATES, isTournamentFormat } from '@/lib/tournaments-shared'
import { MAX_LEAGUE_PLAYERS } from '@/lib/league'
import type { ActionState } from './actions'

const MAX_BET_OPTIONS = 8

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
    const current = await getArenaSettings()
    const value = {} as ArenaSettings
    for (const g of ARENA_GAMES) {
      const title = ARENA_META[g].title
      const tokens = String(form.get(`${g}:bets`) ?? '')
        .split(/[,\s]+/)
        .filter(Boolean)
      const bad = tokens.find((t) => !/^\d+$/.test(t) || Number(t) < 1 || Number(t) > 100000)
      if (bad !== undefined) return { message: `${title}: "${bad.slice(0, 20)}" geçerli bir bahis tutarı değil. 1 ile 100.000 arasında tam sayı yaz.` }
      const unique = [...new Set(tokens.map(Number))].sort((a, b) => a - b)
      if (!unique.length) return { message: `${title}: en az bir bahis tutarı gir.` }
      if (unique.length > MAX_BET_OPTIONS) return { message: `${title}: en fazla ${MAX_BET_OPTIONS} bahis tutarı girilebilir.` }
      const multiplier = Number(String(form.get(`${g}:multiplier`) ?? '').replace(',', '.'))
      if (!Number.isFinite(multiplier) || multiplier < 1 || multiplier > 20) return { message: `${title}: çarpan 1 ile 20 arasında olmalı.` }
      // The settings form has no commission or kanka-table field. Reading a missing field as 0 / off
      // closed player tables and zeroed the table cut for every game on each save.
      const hasCommission = form.has(`${g}:commission`)
      const commission = hasCommission ? Math.round(Number(form.get(`${g}:commission`))) : current[g].commission
      if (hasCommission && (!Number.isFinite(commission) || commission < 0 || commission > 30)) return { message: `${title}: komisyon %0 ile %30 arasında olmalı.` }
      const image = String(form.get(`${g}:image`) ?? '').trim().slice(0, 500)
      if (image && !/^(https:\/\/|\/)/.test(image)) return { message: `${title}: görsel adresi https:// veya / ile başlamalı.` }
      value[g] = {
        enabled: form.get(`${g}:enabled`) === 'on',
        pvpEnabled: form.has(`${g}:pvp`) ? form.get(`${g}:pvp`) === 'on' : current[g].pvpEnabled,
        bets: unique,
        multiplier: Math.round(multiplier * 100) / 100,
        commission,
        ...(image ? { image } : {}),
      }
    }
    const winRate = Math.round(Number(form.get('house:winRate') ?? 40))
    if (!Number.isFinite(winRate) || winRate < 0 || winRate > 100) return { message: 'Mini oyun kazanma oranı %0 ile %100 arasında olmalı.' }
    await setContent('arena:settings', value)
    await setContent('arena:house', { winRate })
    refresh()
    await logPanel('games', 'Oyun ayarları kaydedildi', null, `mini oyun kazanma oranı %${winRate}`)
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
    await logPanel('tournaments', id ? 'Turnuva güncellendi' : 'Turnuva oluşturuldu', input.title, `giriş ${input.entryFee} KC · ödül ${input.prizePool} KC · ${input.maxPlayers} kişi`)
    return { ok: true, message: id ? 'Turnuva güncellendi.' : 'Turnuva oluşturuldu.' }
  } catch (e) {
    return fail(e, 'Kaydedilemedi.')
  }
}

export async function keepTournamentTemplate(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    await requireAdmin('tournaments')
    const t = await getTournament(Number(form.get('id')))
    if (!t) return { message: 'Turnuva bulunamadı. Sayfayı yenile.' }
    const name = String(form.get('name') ?? '').trim().replace(/\s+/g, ' ').slice(0, 60)
    if (name.length < 3) return { message: 'Şablon adı en az 3 karakter olmalı.' }
    const result = await saveTournamentTemplate(name, t)
    if (result === 'full') return { message: `En fazla ${MAX_TOURNAMENT_TEMPLATES} şablon saklanır. Önce birini sil.` }
    revalidatePath('/panel')
    await logPanel('tournaments', result === 'updated' ? 'Turnuva şablonu güncellendi' : 'Turnuva şablonu kaydedildi', name, `kaynak: ${t.title}`)
    return { ok: true, message: result === 'updated' ? `"${name}" şablonu bu turnuvanın ayarlarıyla güncellendi.` : `"${name}" şablonu kaydedildi.` }
  } catch (e) {
    return fail(e, 'Şablon kaydedilemedi.')
  }
}

export async function dropTournamentTemplate(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    await requireAdmin('tournaments')
    const name = await deleteTournamentTemplate(Number(form.get('id')))
    if (!name) return { message: 'Şablon bulunamadı. Sayfayı yenile.' }
    revalidatePath('/panel')
    await logPanel('tournaments', 'Turnuva şablonu silindi', name)
    return { ok: true, message: `"${name}" şablonu silindi.` }
  } catch (e) {
    return fail(e, 'Şablon silinemedi.')
  }
}

export async function removeTournament(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    await requireAdmin('tournaments')
    await deleteTournament(Number(form.get('id')))
    refresh()
    await logPanel('tournaments', 'Turnuva silindi', `Turnuva #${Number(form.get('id'))}`, 'Kayıt ücretleri iade edildi')
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
    await logPanel('tournaments', 'Turnuva başlatıldı', `Turnuva #${Number(form.get('id'))}`)
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
    await logPanel('tournaments', 'Turnuva iptal edildi', `Turnuva #${Number(form.get('id'))}`, 'Kayıt ücretleri iade edildi')
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
    await logPanel('tournaments', 'Maç kazananı girildi', `Turnuva #${Number(form.get('id'))}`, `tur ${Number(form.get('round'))} · maç ${Number(form.get('match'))} · kazanan ${winner}`)
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
    await logPanel('tournaments', 'Turnuva katılımcısı çıkarıldı', `Kayıt #${Number(form.get('entryId'))}`, 'Ücreti iade edildi')
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
    await logPanel('games', 'Masa kapatıldı', String(form.get('id')), 'Bahisler iade edildi')
    return { ok: true, message: 'Masa kapatıldı, bahisler iade edildi.' }
  } catch (e) {
    return fail(e, 'Masa kapatılamadı.')
  }
}
