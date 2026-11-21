'use server'

import { logPanel } from '@/lib/panel-log'
import { revalidatePath } from 'next/cache'
import { canPanel } from '@/lib/admin-auth'
import { deleteComplaint, deleteReview, setReviewStatus, updateComplaint, type Complaint } from '@/lib/community'
import {
  addLeagueMatch,
  autoSettleLeague,
  deleteLeagueMatch,
  getLeagueSettings,
  importLeagueFixtures,
  lastPaidPeriods,
  leaguePicks,
  publishedFixtureIds,
  saveLeagueDefaults,
  saveLeaguePrizes,
  setLeagueAuto,
  settleLeagueMatch,
  updateLeagueMarkets,
  type FixtureInput,
  type PaidPeriod,
} from '@/lib/predictions'
import {
  MARKETS,
  PERIOD_LABEL,
  SPORTS,
  answerText,
  marketList,
  marketTitle,
  normalizeSet,
  parseSport,
  prizeText,
  type Award,
  type Board,
  type LeagueSettings,
  type MatchResult,
  type PeriodKind,
  type Prize,
  type QuestionSet,
} from '@/lib/predictions-shared'
import { getFeedCountries, getFeedLeagues, getLeagueFixtures, getSportResult, isFeedSport, type FeedCountry, type FeedLeague, type FeedTeam, type LeagueFixtures } from '@/lib/kankatv'
import { forgetTeam, getLeagueBook, rememberTeams, setLeaguePin } from '@/lib/prediction-book'
import { EMPTY_BOOK, MAX_LEAGUES_AT_ONCE, type LeagueBook, type LeaguePin } from '@/lib/prediction-book-shared'

import type { PickListData } from '@/components/panel/pick-list'

type Result = { ok: true; message?: string } | { ok: false; error: string }

async function guard(fn: () => Promise<string | void>): Promise<Result> {
  if (!(await canPanel('community'))) return { ok: false, error: 'Oturum süresi doldu, tekrar giriş yap.' }
  try {
    const message = await fn()
    revalidatePath('/panel')
    revalidatePath('/guven')
    revalidatePath('/tahminler')
    return { ok: true, message: message || undefined }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'İşlem başarısız.' }
  }
}

export async function moderateReview(id: number, status: 'approved' | 'rejected', note = '') {
  return guard(async () => {
    const reason = status === 'rejected' ? String(note ?? '').trim().slice(0, 300) : ''
    await setReviewStatus(id, status, reason)
    await logPanel('community', status === 'approved' ? 'Yorum yayınlandı' : 'Yorum reddedildi', `Yorum #${id}`, reason || null)
    return status === 'rejected' && reason ? 'Yorum reddedildi, sebep üyeye mesajla bildirildi.' : undefined
  })
}

export async function decideReviewProof(id: number, ok: boolean) {
  return guard(async () => {
    const { decideProof } = await import('@/lib/trust-extra')
    await decideProof(id, ok)
    await logPanel('community', ok ? 'Yorum kanıtı onaylandı' : 'Yorum kanıtı reddedildi', `Yorum #${id}`)
    return ok ? 'Yorum doğrulandı, rozet ve KP verildi.' : 'Kanıt reddedildi.'
  })
}

export async function postKarneNow() {
  return guard(async () => {
    const { weeklyKarne, karneNotice } = await import('@/lib/trust-extra')
    const { broadcastPodium } = await import('@/lib/telegram-bots')
    const list = await weeklyKarne()
    if (!list.length) return 'Son 7 günde karneye girecek veri yok.'
    const posted = await broadcastPodium((origin) => karneNotice(list, origin))
    if (posted) await logPanel('community', 'Haftalık karne gönderildi', null, `${posted} kanal`)
    return posted ? `Karne ${posted} kanala gönderildi.` : 'Bağlı aktif kanal bulunamadı.'
  })
}

export async function removeReview(id: number) {
  return guard(async () => {
    await deleteReview(id)
    await logPanel('community', 'Yorum silindi', `Yorum #${id}`)
    return 'Yorum silindi.'
  })
}

export async function removeComplaint(id: number) {
  return guard(async () => {
    await deleteComplaint(id)
    await logPanel('community', 'Şikâyet kaldırıldı', `Şikâyet #${id}`)
    return 'Şikâyet kaldırıldı.'
  })
}

export async function answerComplaint(id: number, status: Complaint['status'], reply: string) {
  return guard(async () => {
    const message = await updateComplaint(id, status, reply)
    await logPanel('community', 'Şikâyet yanıtlandı', `Şikâyet #${id}`, `${status}${reply ? ` · ${String(reply).slice(0, 200)}` : ''}`)
    return message
  })
}

// --- Prediction league ---------------------------------------------------

const questionNames = (set: QuestionSet) => marketList(set).map((id) => marketTitle(id, set.markets[id])).join(', ')

export async function createLeagueMatch(input: {
  league: string
  home: string
  away: string
  kickoff: string
  closesAt?: string
  set?: QuestionSet | null
  sport?: string
  bestOf?: number
  boardId?: number | null
}) {
  return guard(async () => {
    await addLeagueMatch({ ...input, set: input.set ?? undefined })
    // E-sport teams come from no feed, so the ones typed here are kept for the next match.
    if (parseSport(input.sport) === 'esports') {
      await rememberTeams(input.league, [input.home, input.away]).catch((e) => console.error('[community] takım listesi yazılamadı', (e as Error).message))
    }
    const sport = SPORTS[parseSport(input.sport)].label
    await logPanel(
      'community',
      'Tahmin maçı eklendi',
      `${input.home} - ${input.away}`,
      `${sport} · ${input.league}${input.set ? ` · ${questionNames(normalizeSet({ ...input.set, sport: parseSport(input.sport), bestOf: input.bestOf }))}` : ' · varsayılan sorular'}`,
    )
  })
}

export async function editLeagueQuestions(id: number, set: QuestionSet) {
  return guard(async () => {
    await updateLeagueMarkets(Number(id), set)
    await logPanel('community', 'Tahmin maçının soruları değişti', `Maç #${id}`, questionNames(normalizeSet(set)))
    return 'Sorular kaydedildi.'
  })
}

type Loaded<T> = ({ ok: true } & T) | { ok: false; error: string }

const EXPIRED = { ok: false as const, error: 'Oturum süresi doldu, tekrar giriş yap.' }
const FEED_DOWN = { ok: false as const, error: 'Maç kaynağına ulaşılamadı. Biraz sonra tekrar dene ya da maçı elle ekle.' }
const NO_FEED = { ok: false as const, error: 'Bu sporun maçları kaynakta yok; maçı elle ekle.' }

export async function loadFeedCountries(sport: string): Promise<Loaded<{ countries: FeedCountry[] }>> {
  if (!(await canPanel('community'))) return EXPIRED
  if (!isFeedSport(sport)) return NO_FEED
  const countries = await getFeedCountries(sport)
  return countries ? { ok: true, countries } : FEED_DOWN
}

export async function loadFeedLeagues(sport: string, countryId: number): Promise<Loaded<{ leagues: FeedLeague[] }>> {
  if (!(await canPanel('community'))) return EXPIRED
  if (!isFeedSport(sport)) return NO_FEED
  if (!Number.isSafeInteger(countryId) || countryId <= 0) return { ok: false, error: 'Ülke bulunamadı.' }
  const leagues = await getFeedLeagues(sport, countryId)
  return leagues ? { ok: true, leagues } : FEED_DOWN
}

/** The upcoming games of the chosen leagues. A league the feed cannot read is named instead of failing the rest. */
export async function loadLeagueFixtures(sport: string, leagueIds: number[]): Promise<Loaded<{ groups: LeagueFixtures[]; published: number[]; missing: number[] }>> {
  if (!(await canPanel('community'))) return EXPIRED
  if (!isFeedSport(sport)) return NO_FEED
  const ids = [...new Set((Array.isArray(leagueIds) ? leagueIds : []).map(Number).filter((n) => Number.isSafeInteger(n) && n > 0))].slice(0, MAX_LEAGUES_AT_ONCE)
  if (!ids.length) return { ok: false, error: 'En az bir lig seç.' }
  const [found, published] = await Promise.all([Promise.all(ids.map((id) => getLeagueFixtures(sport, id))), publishedFixtureIds()])
  const groups = found.filter((g): g is LeagueFixtures => g !== null)
  if (!groups.length) return FEED_DOWN
  return { ok: true, groups, published, missing: ids.filter((_, i) => !found[i]) }
}

/** The sides of one league, for picking the teams of a hand-added match from a list. */
export async function loadLeagueTeams(sport: string, leagueId: number): Promise<Loaded<{ teams: FeedTeam[] }>> {
  if (!(await canPanel('community'))) return EXPIRED
  if (!isFeedSport(sport)) return NO_FEED
  const found = Number.isSafeInteger(leagueId) && leagueId > 0 ? await getLeagueFixtures(sport, leagueId) : null
  return found ? { ok: true, teams: found.teams } : FEED_DOWN
}

export async function pinLeague(pin: LeaguePin, on: boolean) {
  return guard(async () => {
    await setLeaguePin(pin, Boolean(on))
    return on ? `${pin.name} sabitlendi.` : `${pin.name} sabitlerden çıkarıldı.`
  })
}

export async function removeBookTeam(game: string, name: string) {
  return guard(async () => {
    await forgetTeam(String(game), String(name))
    return `${name} listeden çıkarıldı.`
  })
}

export async function publishFixtures(list: FixtureInput[], boardId?: number | null) {
  return guard(async () => {
    const added = await importLeagueFixtures(list, boardId)
    const own = (Array.isArray(list) ? list : []).filter((f) => f.set).length
    if (added) await logPanel('community', 'Fikstür maçları yayınlandı', null, `${added} maç${own ? ` · ${own} maça özel soru seçildi` : ''}`)
    return added ? `${added} maç sitede yayınlandı.` : 'Seçilen maçlar zaten yayında veya başlamış.'
  })
}

export async function autoSettleMatches() {
  return guard(async () => {
    const r = await autoSettleLeague(getSportResult)
    if (r.settled) await logPanel('community', 'Maçlar otomatik sonuçlandırıldı', null, `${r.settled} maç`)
    if (!r.checked) return 'Sonucu bekleyen fikstür maçı yok.'
    const waiting = r.waiting ? ` ${r.waiting} maçın korner, kart, ilk yarı ya da ilk set verisi kaynakta yok; sonucunu elle gir.` : ''
    return `${r.checked} maç kontrol edildi, ${r.settled} tanesi sonuçlandırıldı.${waiting}`
  })
}

export async function removeLeagueMatch(id: number) {
  return guard(async () => {
    await deleteLeagueMatch(id)
    await logPanel('community', 'Tahmin maçı silindi', `Maç #${id}`)
  })
}

const OUTCOME_MARK: Record<string, string> = { hit: 'doğru', near: 'taraf doğru', miss: 'yanlış', void: 'iptal' }

export async function loadLeaguePicks(matchId: number): Promise<PickListData> {
  if (!(await canPanel('community'))) return { ok: false, error: 'Oturum süresi doldu, tekrar giriş yap.' }
  try {
    const { total, set, home, away, picks } = await leaguePicks(Number(matchId))
    const ids = marketList(set)
    const scored = picks.filter((p) => p.points !== null)
    const summary = scored.length
      ? `${scored.filter((p) => (p.points ?? 0) > 0).length} kişi puan aldı, ${scored.filter((p) => p.bonus).length} kişi bütün soruları bildi, ${scored.filter((p) => !p.points).length} kişinin tahmini tutmadı.`
      : undefined
    return {
      ok: true,
      total,
      summary,
      rows: picks.map((p) => {
        const earned = [`${p.points ?? 0} puan`, p.kc ? `${p.kc.toLocaleString('tr-TR')} KC` : '', p.kp ? `${p.kp.toLocaleString('tr-TR')} KP` : '', p.bonus ? 'bonus' : ''].filter(Boolean).join(' · ')
        return {
          userId: p.userId,
          name: p.name,
          pick: ids
            .map((id) => `${MARKETS[id].short}: ${answerText(id, p.answers[id], { home, away }, set.markets[id])}${p.outcomes?.[id] ? ` (${OUTCOME_MARK[p.outcomes[id]!]})` : ''}`)
            .join(' · '),
          note: p.points === null ? 'Sonuç bekleniyor' : earned,
          at: p.at,
        }
      }),
    }
  } catch (error) {
    console.error('[community] tahmin listesi okunamadı', (error as Error).message)
    return { ok: false, error: 'Liste okunamadı.' }
  }
}

export async function finishLeagueMatch(id: number, result: MatchResult) {
  return guard(async () => {
    const r = await settleLeagueMatch(Number(id), result)
    const paid = [r.kc ? `${r.kc.toLocaleString('tr-TR')} KC` : '', r.kp ? `${r.kp.toLocaleString('tr-TR')} KP` : '', r.gifts ? `${r.gifts} bonus ödülü` : ''].filter(Boolean).join(', ')
    const voided = r.voided.length ? ` İptal edilen soru: ${r.voided.map((v) => MARKETS[v].label).join(', ')}.` : ''
    const failed = r.failed ? ` ${r.failed} üyenin ödülü yazılamadı; bir sonraki maç sonuçlandırılırken kendiliğinden yeniden denenir.` : ''
    await logPanel('community', 'Maç sonucu girildi ve puanlandı', `Maç #${id}`, `${result.home}-${result.away} · ${r.picks} tahmin · ${r.winners} kazanan${paid ? ` · ${paid}` : ''}${voided}${r.failed ? ` · ${r.failed} ödül yazılamadı` : ''}`)
    return `${r.picks} tahmin puanlandı, ${r.winners} kişi kazandı${paid ? ` (${paid} ${r.failed ? 'kazanıldı' : 'dağıtıldı'})` : ''}.${voided}${failed}`
  })
}

export async function saveLeagueBoard(input: { id?: number | null; name: string; general: boolean; places: Prize[] }) {
  return guard(async () => {
    const { saveBoard } = await import('@/lib/prediction-boards')
    const { board, created } = await saveBoard(input)
    const detail = [board.general ? 'genel lige de sayılır' : 'sadece kendi tablosu', board.places.length ? board.places.map((p, i) => `${i + 1}. ${prizeText(p)}`).join(' · ') : 'ödülsüz'].join(' · ')
    await logPanel('community', created ? 'Özel tahmin ligi açıldı' : 'Özel tahmin ligi güncellendi', board.name, detail.slice(0, 400))
    return created ? `"${board.name}" açıldı. Maç eklerken ya da takvimden yayınlarken bu ligi seç.` : `"${board.name}" kaydedildi.`
  })
}

export async function closeLeagueBoard(id: number) {
  return guard(async () => {
    const { closeBoard } = await import('@/lib/prediction-boards')
    const { board, winners } = await closeBoard(Number(id))
    await logPanel('community', 'Özel tahmin ligi kapatıldı', board.name, winners.length ? winners.map((w) => `${w.place}. ${w.name}: ${prizeText(w.prize)}`).join(' · ').slice(0, 400) : 'ödül dağıtılmadı')
    if (!board.places.length) return `"${board.name}" kapatıldı. Tablosu sitede 14 gün daha görünür.`
    return winners.length ? `"${board.name}" kapatıldı, ${winners.length} kişiye ödülü dağıtıldı.` : `"${board.name}" kapatıldı. Puan alan üye olmadığı için ödül dağıtılmadı.`
  })
}

export async function removeLeagueBoard(id: number) {
  return guard(async () => {
    const { deleteBoard } = await import('@/lib/prediction-boards')
    const { name, moved } = await deleteBoard(Number(id))
    await logPanel('community', 'Özel tahmin ligi silindi', name, moved ? `${moved} maç genel lige döndü` : undefined)
    return moved ? `"${name}" silindi, ${moved} maçı genel lige döndü.` : `"${name}" silindi.`
  })
}

export async function moveLeagueMatch(matchId: number, boardId: number | null) {
  return guard(async () => {
    const { setMatchBoard } = await import('@/lib/prediction-boards')
    await setMatchBoard(Number(matchId), boardId)
    await logPanel('community', 'Tahmin maçının ligi değişti', `Maç #${matchId}`, boardId ? `Özel lig #${boardId}` : 'Genel lig')
    return 'Maçın ligi değişti.'
  })
}

export type LeagueSetup = {
  settings: LeagueSettings
  boards: Board[]
  products: { id: string; name: string; sponsor: boolean }[]
  sites: { id: string; name: string }[]
  awards: Award[]
  paid: Partial<Record<PeriodKind, PaidPeriod>>
  book: LeagueBook
}

/** Everything the league screens need beyond the match list, read when they open. */
export async function loadLeagueSetup(): Promise<{ ok: true; data: LeagueSetup } | { ok: false; error: string }> {
  if (!(await canPanel('community'))) return { ok: false, error: 'Oturum süresi doldu, tekrar giriş yap.' }
  try {
    const [{ listProducts }, { siteOptions }, { listAwards }] = await Promise.all([import('@/lib/market'), import('@/lib/sites'), import('@/lib/prediction-awards')])
    const [settings, boards, products, sites, awards, paid, book] = await Promise.all([
      getLeagueSettings(),
      import('@/lib/prediction-boards').then((m) => m.listBoards()),
      listProducts({ includeInactive: true }).catch(() => []),
      siteOptions().catch(() => []),
      listAwards().catch(() => []),
      lastPaidPeriods().catch(() => ({})),
      getLeagueBook().catch(() => EMPTY_BOOK),
    ])
    return {
      ok: true,
      data: {
        settings,
        boards,
        products: products.map((p) => ({ id: p.id, name: p.name, sponsor: p.kind === 'sponsor' })),
        sites: sites.map((s) => ({ id: String(s.id), name: s.name })),
        awards,
        paid,
        book,
      },
    }
  } catch (error) {
    console.error('[community] lig ayarları okunamadı', (error as Error).message)
    return { ok: false, error: 'Lig ayarları okunamadı.' }
  }
}

export async function saveLeagueDefaultSet(set: QuestionSet, sportInput: string = 'football') {
  return guard(async () => {
    const sport = parseSport(sportInput)
    await saveLeagueDefaults(set, sport)
    await logPanel('community', 'Varsayılan tahmin soruları değişti', SPORTS[sport].label, questionNames(normalizeSet({ ...set, sport })))
    return `${SPORTS[sport].label} şablonu kaydedildi. Bundan sonra eklenen ${SPORTS[sport].label.toLocaleLowerCase('tr')} maçları bu sorularla açılır.`
  })
}

export async function saveLeaguePeriodPrizes(kind: PeriodKind, on: boolean, places: Prize[]) {
  return guard(async () => {
    const period = kind === 'month' ? 'month' : 'week'
    await saveLeaguePrizes(period, { on: Boolean(on), places })
    const detail = on ? places.map((p, i) => `${i + 1}. ${prizeText(p)}`).join(' · ') : 'kapatıldı'
    await logPanel('community', `${PERIOD_LABEL[period]} lig ödülleri değişti`, null, detail.slice(0, 400))
    return on ? `${PERIOD_LABEL[period]} ödüller açık. Dönem bitince ilk ${places.length} sıraya kendiliğinden dağıtılır.` : `${PERIOD_LABEL[period]} ödüller kapatıldı.`
  })
}

export async function saveLeagueAuto(on: boolean) {
  return guard(async () => {
    await setLeagueAuto(Boolean(on))
    await logPanel('community', on ? 'Otomatik puanlama açıldı' : 'Otomatik puanlama kapatıldı')
    return on ? 'Takvimden eklenen maçlar bitince kendiliğinden puanlanacak.' : 'Otomatik puanlama kapatıldı.'
  })
}

export async function settleAward(id: number, delivered: boolean, note: string) {
  return guard(async () => {
    const { resolveAward } = await import('@/lib/prediction-awards')
    const award = await resolveAward(Number(id), Boolean(delivered), String(note ?? ''))
    await logPanel('community', delivered ? 'Tahmin ödülü teslim edildi' : 'Tahmin ödülü iptal edildi', award.userName, `${award.title} · ${prizeText(award.prize)}${note ? ` · ${String(note).slice(0, 200)}` : ''}`)
    return delivered ? 'Ödül teslim edildi olarak işaretlendi, üyeye mesaj gitti.' : 'Ödül iptal edildi, üyeye sebebiyle mesaj gitti.'
  })
}

