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
  answerText,
  marketList,
  marketTitle,
  normalizeSet,
  prizeText,
  type Award,
  type LeagueSettings,
  type MatchResult,
  type PeriodKind,
  type Prize,
  type QuestionSet,
} from '@/lib/predictions-shared'
import { getFinalResult, getFixtures, type Fixture } from '@/lib/kankatv'

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
    const { weeklyKarne, karneText } = await import('@/lib/trust-extra')
    const { broadcastPodium } = await import('@/lib/telegram-bots')
    const list = await weeklyKarne()
    if (!list.length) return 'Son 7 günde karneye girecek veri yok.'
    const posted = await broadcastPodium((origin) => karneText(list, origin))
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

export async function createLeagueMatch(input: { league: string; home: string; away: string; kickoff: string; closesAt?: string; set?: QuestionSet | null }) {
  return guard(async () => {
    await addLeagueMatch({ ...input, set: input.set ?? undefined })
    await logPanel('community', 'Tahmin maçı eklendi', `${input.home} - ${input.away}`, `${input.league}${input.set ? ` · ${questionNames(normalizeSet(input.set))}` : ' · varsayılan sorular'}`)
  })
}

export async function editLeagueQuestions(id: number, set: QuestionSet) {
  return guard(async () => {
    await updateLeagueMarkets(Number(id), set)
    await logPanel('community', 'Tahmin maçının soruları değişti', `Maç #${id}`, questionNames(normalizeSet(set)))
    return 'Sorular kaydedildi.'
  })
}

export async function loadFixtures(day: string): Promise<{ ok: true; fixtures: Fixture[]; published: number[] } | { ok: false; error: string }> {
  if (!(await canPanel('community'))) return { ok: false, error: 'Oturum süresi doldu, tekrar giriş yap.' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return { ok: false, error: 'Geçerli bir tarih seç.' }
  const [fixtures, published] = await Promise.all([getFixtures(day), publishedFixtureIds()])
  return { ok: true, fixtures, published }
}

export async function publishFixtures(list: FixtureInput[]) {
  return guard(async () => {
    const added = await importLeagueFixtures(list)
    if (added) await logPanel('community', 'Fikstür maçları yayınlandı', null, `${added} maç`)
    return added ? `${added} maç varsayılan sorularla sitede yayınlandı.` : 'Seçilen maçlar zaten yayında veya başlamış.'
  })
}

export async function autoSettleMatches() {
  return guard(async () => {
    const r = await autoSettleLeague(getFinalResult)
    if (r.settled) await logPanel('community', 'Maçlar otomatik sonuçlandırıldı', null, `${r.settled} maç`)
    if (!r.checked) return 'Sonucu bekleyen fikstür maçı yok.'
    const waiting = r.waiting ? ` ${r.waiting} maçın korner, kart ya da ilk yarı verisi kaynakta yok; sonucunu elle gir.` : ''
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
    await logPanel('community', 'Maç sonucu girildi ve puanlandı', `Maç #${id}`, `${result.home}-${result.away} · ${r.picks} tahmin · ${r.winners} kazanan${paid ? ` · ${paid}` : ''}${voided}`)
    return `${r.picks} tahmin puanlandı, ${r.winners} kişi kazandı${paid ? ` (${paid} dağıtıldı)` : ''}.${voided}`
  })
}

export type LeagueSetup = {
  settings: LeagueSettings
  products: { id: string; name: string; sponsor: boolean }[]
  sites: { id: string; name: string }[]
  awards: Award[]
  paid: Partial<Record<PeriodKind, PaidPeriod>>
}

/** Everything the league screens need beyond the match list, read when they open. */
export async function loadLeagueSetup(): Promise<{ ok: true; data: LeagueSetup } | { ok: false; error: string }> {
  if (!(await canPanel('community'))) return { ok: false, error: 'Oturum süresi doldu, tekrar giriş yap.' }
  try {
    const [{ listProducts }, { siteOptions }, { listAwards }] = await Promise.all([import('@/lib/market'), import('@/lib/sites'), import('@/lib/prediction-awards')])
    const [settings, products, sites, awards, paid] = await Promise.all([
      getLeagueSettings(),
      listProducts({ includeInactive: true }).catch(() => []),
      siteOptions().catch(() => []),
      listAwards().catch(() => []),
      lastPaidPeriods().catch(() => ({})),
    ])
    return {
      ok: true,
      data: {
        settings,
        products: products.map((p) => ({ id: p.id, name: p.name, sponsor: p.kind === 'sponsor' })),
        sites: sites.map((s) => ({ id: String(s.id), name: s.name })),
        awards,
        paid,
      },
    }
  } catch (error) {
    console.error('[community] lig ayarları okunamadı', (error as Error).message)
    return { ok: false, error: 'Lig ayarları okunamadı.' }
  }
}

export async function saveLeagueDefaultSet(set: QuestionSet) {
  return guard(async () => {
    await saveLeagueDefaults(set)
    await logPanel('community', 'Varsayılan tahmin soruları değişti', null, questionNames(normalizeSet(set)))
    return 'Varsayılan sorular kaydedildi. Bundan sonra eklenen maçlar bu sorularla açılır.'
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

