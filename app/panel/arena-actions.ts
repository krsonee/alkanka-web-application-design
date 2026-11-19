'use server'

import { logPanel } from '@/lib/panel-log'
import { revalidatePath } from 'next/cache'
import { canPanel } from '@/lib/admin-auth'
import type { PanelModule } from '@/lib/panel-modules'
import { setContent } from '@/lib/content'
import { ARENA_GAMES, ARENA_META, MAX_COMMISSION, isArenaGame, usesCommission, usesMultiplier, type ArenaSettings } from '@/lib/arena'
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
  updateRunningTournament,
  updateTournament,
  type TournamentInput,
} from '@/lib/tournaments'
import { deleteTournamentTemplate, saveTournamentTemplate } from '@/lib/tournament-templates'
import { listTournamentMatches } from '@/lib/tournament-matches'
import {
  FORMAT_SHORT,
  MAX_TOURNAMENT_TEMPLATES,
  MIN_TOURNAMENT_MINUTES,
  PACE_SHORT,
  SOURCE_LABEL,
  canHostTournament,
  cleanJoinMinutes,
  cleanLeague,
  cleanMatchLength,
  earliestLeagueEnd,
  formatsFor,
  isTournamentFormat,
  leagueRounds,
  matchLengthOf,
  maxTournamentMinutes,
  tournamentSeats,
  type MatchRecord,
} from '@/lib/tournaments-shared'
import { MAX_LEAGUE_PLAYERS } from '@/lib/league'
import { MAX_PRIZE_KC, MAX_PRIZE_POOL_KC, cleanPrizes, isPlayerCount, playerRuleText, prizePlaces, prizeTotal } from '@/lib/tournament-prizes'
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
    const changes: string[] = []
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
      // A game that pays from the pot or by its own odds never reads the multiplier: its field is locked
      // in the form and the saved value stays as it is.
      const hasMultiplier = usesMultiplier(g) && form.has(`${g}:multiplier`)
      const multiplier = hasMultiplier ? Number(String(form.get(`${g}:multiplier`) ?? '').replace(',', '.')) : current[g].multiplier
      if (hasMultiplier && (!Number.isFinite(multiplier) || multiplier < 1 || multiplier > 20)) return { message: `${title}: çarpan 1 ile 20 arasında olmalı.` }
      // A field the form did not send keeps its saved value. Reading a missing field as 0 / off
      // closed player tables and zeroed the table cut for every game on each save.
      const hasCommission = usesCommission(g) && form.has(`${g}:commission`)
      const commission = hasCommission ? Math.round(Number(String(form.get(`${g}:commission`) ?? '').replace(',', '.'))) : current[g].commission
      if (hasCommission && (!Number.isFinite(commission) || commission < 0 || commission > MAX_COMMISSION)) return { message: `${title}: masa payı %0 ile %${MAX_COMMISSION} arasında olmalı.` }
      if (multiplier !== current[g].multiplier) changes.push(`${title} çarpan ${current[g].multiplier} → ${Math.round(multiplier * 100) / 100}`)
      if (commission !== current[g].commission) changes.push(`${title} masa payı %${current[g].commission} → %${commission}`)
      if (unique.join() !== current[g].bets.join()) changes.push(`${title} bahisler ${unique.join(', ')}`)
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
    await logPanel('games', 'Oyun ayarları kaydedildi', null, [...changes, `mini oyun kazanma oranı %${winRate}`].join(' · ').slice(0, 600))
    return { ok: true, message: 'Oyun ayarları kaydedildi. Çarpan ve masa payı bundan sonra biten maçlarda geçerli olur.' }
  } catch (e) {
    return fail(e, 'Kaydedilemedi.')
  }
}

/** A `datetime-local` value typed in the form's time zone, as a moment. Null when the field is empty or unreadable. */
function formTime(form: FormData, name: string) {
  const raw = String(form.get(name) ?? '').trim()
  if (!raw) return null
  const offset = Number(form.get('tz') ?? 0)
  const local = new Date(`${raw}:00Z`)
  if (Number.isNaN(local.getTime())) return null
  return new Date(local.getTime() + (Number.isFinite(offset) ? offset : 0) * 60000)
}

/** A start a minute or two in the past is a form that sat open; anything older would start or cancel the tournament on the spot. */
const START_SLACK_MS = 2 * 60_000

function readEnd(form: FormData, from: Date, label: string) {
  const end = formTime(form, 'endsAt')
  if (!end) throw new Error('Bitiş saatini gir. Turnuva o saatte, bitmemiş maçlar olsa da kapanır.')
  if (end.getTime() < from.getTime() + MIN_TOURNAMENT_MINUTES * 60_000) throw new Error(`Bitiş saati ${label} en az ${MIN_TOURNAMENT_MINUTES} dakika sonra olmalı.`)
  return end.toISOString()
}

const readTexts = (form: FormData) => ({
  description: String(form.get('description') ?? '').trim().slice(0, 400),
  prizeNote: String(form.get('prizeNote') ?? '').trim().slice(0, 120),
})

function readTournament(form: FormData): TournamentInput {
  const game = String(form.get('game'))
  if (!isArenaGame(game)) throw new Error('Oyun seç.')
  if (!canHostTournament(game)) throw new Error(`${ARENA_META[game].title} oyununda turnuva açılmıyor. Listeden başka bir oyun seç.`)
  const seats = tournamentSeats(game) ?? 2
  const title = String(form.get('title') ?? '').trim().slice(0, 80)
  if (title.length < 3) throw new Error('Turnuva adı en az 3 karakter olmalı.')
  const start = formTime(form, 'startsAt')
  if (!start) throw new Error('Başlangıç tarihi geçersiz.')
  if (start.getTime() < Date.now() - START_SLACK_MS) throw new Error('Başlangıç saati geçmişte. İleri bir saat seç; hemen başlatmak için kaydettikten sonra "Kayıtları kapat ve başlat"a bas.')
  const startsAt = start.toISOString()
  const endsAt = readEnd(form, start, 'başlangıçtan')
  const rawFormat = form.get('format')
  const format = isTournamentFormat(rawFormat) ? rawFormat : 'eleme'
  if (!formatsFor(game).includes(format)) throw new Error(`${ARENA_META[game].title} ${seats} kişilik ortak masalarda oynanıyor; bu oyunda fikstürlü lig yok. Düzeni eleme ya da puan ligi seç.`)
  const maxPlayers = int(form, 'maxPlayers', 'Kişi sayısı', 2, MAX_TOURNAMENT_PLAYERS)
  if (format === 'lig' && maxPlayers > MAX_LEAGUE_PLAYERS) {
    throw new Error(`Fikstürlü ligde en fazla ${MAX_LEAGUE_PLAYERS} oyuncu olabilir (herkes herkesle oynar).`)
  }
  if (!isPlayerCount(format, maxPlayers, seats)) throw new Error(playerRuleText(format, seats))
  const league = cleanLeague({ pace: form.get('pace'), legs: form.get('legs'), source: form.get('source'), maxGames: form.get('maxGames') })
  // A league can run for months, so a mistyped year would keep it open; a knockout keeps the rule it always had.
  const longest = maxTournamentMinutes(format)
  if (format !== 'eleme' && Date.parse(endsAt) - start.getTime() > longest * 60_000) {
    throw new Error(`Lig başlangıçtan en fazla ${Math.round(longest / 1440)} gün sonra bitebilir. Bitiş tarihini kontrol et.`)
  }
  // A league that opens a round a day or a week must stay open until its last round has been played.
  const earliest = format === 'lig' ? earliestLeagueEnd(start, maxPlayers, league) : null
  if (earliest && Date.parse(endsAt) < earliest.getTime()) {
    throw new Error(
      `Bu lig ${leagueRounds(maxPlayers, league.legs)} tur sürer ve ${PACE_SHORT[league.pace]} açılır. Bitiş en erken ${istanbulText(earliest)} olmalı; yoksa son turlar oynanmadan lig kapanır.`,
    )
  }
  // The form only sends the places a prize was added for; the rest pay nothing.
  const prizes = cleanPrizes(
    prizePlaces(format, maxPlayers, seats).map((_, i) => (form.get(`prize${i}`) == null ? 0 : int(form, `prize${i}`, 'Sıralama ödülü', 0, MAX_PRIZE_KC))),
    format,
    maxPlayers,
    seats,
  )
  if (prizeTotal(format, maxPlayers, prizes, seats) > MAX_PRIZE_POOL_KC) {
    throw new Error(`Toplam ödül havuzu en fazla ${MAX_PRIZE_POOL_KC.toLocaleString('tr-TR')} KC olabilir. Kişi başı yazılan sıralarda tutar o sıradaki oyuncu sayısıyla çarpılır.`)
  }
  return {
    format,
    game,
    title,
    ...readTexts(form),
    rules: String(form.get('rules') ?? '').trim().slice(0, 2000),
    entryFee: int(form, 'entryFee', 'Katılım ücreti', 0, 100000),
    prizes,
    maxPlayers,
    startsAt,
    endsAt,
    joinMinutes: cleanJoinMinutes(form.get('joinMinutes')),
    matchLength: cleanMatchLength(game, form.get('matchLength')),
    league,
  }
}

const istanbulText = (at: Date) =>
  new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(at)

/** The format as the panel's log names it, with the choices that belong to it. */
function formatText(t: TournamentInput) {
  const league = cleanLeague(t.league)
  if (t.format === 'lig') return `${FORMAT_SHORT.lig} (${PACE_SHORT[league.pace]}, ${league.legs === 2 ? 'çift devre' : 'tek devre'})`
  if (t.format === 'puan') return `${FORMAT_SHORT.puan} (${SOURCE_LABEL[league.source].toLocaleLowerCase('tr')}, ${league.maxGames ? `ilk ${league.maxGames} oyun` : 'oyun sınırı yok'})`
  return FORMAT_SHORT.eleme
}

const CLOSED_MESSAGE = 'Bu turnuva bitmiş ya da iptal edilmiş, artık değiştirilemez.'

/** The tournament as the log names it. A deleted one has only its number left. */
async function tournamentLabel(id: number) {
  const t = await getTournament(id).catch(() => null)
  return t ? `${t.title} (#${id})` : `Turnuva #${id}`
}

/** The tournament's tables for the panel's match list. Read when the list is opened, not with the page. */
export async function loadTournamentMatches(id: number): Promise<{ matches?: MatchRecord[]; message?: string }> {
  try {
    await requireAdmin('tournaments')
    return { matches: await listTournamentMatches(Number(id)) }
  } catch (e) {
    return { message: e instanceof Error ? e.message : 'Maçlar okunamadı.' }
  }
}

export async function saveTournament(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    await requireAdmin('tournaments')
    const id = Number(form.get('id'))
    const current = id ? await getTournament(id) : null
    if (id && !current) return { message: 'Turnuva bulunamadı. Sayfayı yenile.' }
    if (current && current.status !== 'kayit' && current.status !== 'basladi') return { message: CLOSED_MESSAGE }
    if (current?.status === 'basladi') {
      // Players are already paired and fees are paid: the game, the field, the fee and the prizes stay as they are.
      // An end time left as it was is not checked again: a text can be fixed in the tournament's last minutes too.
      const typed = formTime(form, 'endsAt')
      const kept = typed && current.endsAt && Math.abs(typed.getTime() - Date.parse(current.endsAt)) < 60_000
      const input = { endsAt: kept ? current.endsAt! : readEnd(form, new Date(), 'şu andan'), ...readTexts(form) }
      if (!(await updateRunningTournament(id, input))) return { message: CLOSED_MESSAGE }
      refresh()
      await logPanel('tournaments', 'Devam eden turnuva güncellendi', current.title, `bitiş ${input.endsAt}`)
      return { ok: true, message: 'Bitiş saati, açıklama ve ödül notu kaydedildi. Başlamış turnuvada başka bir şey değişmez.' }
    }
    const input = readTournament(form)
    if (!id) await createTournament(input)
    else if (!(await updateTournament(id, input))) return { message: 'Turnuva az önce başladı ya da kapandı, değişiklikler kaydedilmedi. Sayfayı yenile.' }
    refresh()
    await logPanel('tournaments', id ? 'Turnuva güncellendi' : 'Turnuva oluşturuldu', input.title, `${formatText(input)} · giriş ${input.entryFee} KC · sıralama ödülleri ${input.prizes.length ? input.prizes.join(' / ') : 'yok'} KC · ${input.maxPlayers} kişi · bitiş ${input.endsAt} · maça giriş ${input.joinMinutes} dk${matchLengthOf(input.game, input.matchLength) ? ` · maç: ${matchLengthOf(input.game, input.matchLength)?.label}` : ''}`)
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
    const label = await tournamentLabel(Number(form.get('id')))
    await deleteTournament(Number(form.get('id')))
    refresh()
    await logPanel('tournaments', 'Turnuva silindi', label, 'Kayıt ücretleri iade edildi')
    return { ok: true, message: 'Turnuva silindi, kayıt ücretleri iade edildi.' }
  } catch (e) {
    return fail(e, 'Silinemedi.')
  }
}

export async function beginTournament(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    await requireAdmin('tournaments')
    const id = Number(form.get('id'))
    await startTournament(id)
    refresh()
    await logPanel('tournaments', 'Turnuva başlatıldı', await tournamentLabel(id))
    const started = await getTournament(id).catch(() => null)
    if (started?.format === 'puan') return { ok: true, message: 'Puan ligi başladı. Kayıtlı oyuncuların bundan sonra bitirdiği oyunlar puan tablosuna yazılır.' }
    return { ok: true, message: started?.format === 'lig' ? 'Lig başladı. İlk turun maçları açıldı.' : 'Turnuva başladı. Tüm eşleşmeler aynı anda açıldı.' }
  } catch (e) {
    return fail(e, 'Başlatılamadı.')
  }
}

export async function stopTournament(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    await requireAdmin('tournaments')
    await cancelTournament(Number(form.get('id')))
    refresh()
    await logPanel('tournaments', 'Turnuva iptal edildi', await tournamentLabel(Number(form.get('id'))), 'Kayıt ücretleri iade edildi')
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
    const id = Number(form.get('id'))
    const said = await adminSetMatchWinner(id, Number(form.get('round')), Number(form.get('match')), winner)
    refresh()
    await logPanel('tournaments', 'Maç kazananı girildi', await tournamentLabel(id), `${said.round} · ${said.players.join(' - ')} · kazanan ${said.winner}`)
    return { ok: true, message: `Sonuç girildi: ${said.winner} kazandı.` }
  } catch (e) {
    return fail(e, 'Kaydedilemedi.')
  }
}

export async function kickEntry(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    await requireAdmin('tournaments')
    const gone = await removeEntry(Number(form.get('entryId')))
    refresh()
    await logPanel('tournaments', 'Turnuva katılımcısı çıkarıldı', gone.title, gone.fee > 0 ? `${gone.name} · ${gone.fee} KC iade edildi` : `${gone.name} · ücret ödememişti`)
    return { ok: true, message: gone.fee > 0 ? `${gone.name} çıkarıldı, ${gone.fee} KC ücreti iade edildi.` : `${gone.name} çıkarıldı.` }
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
