'use server'

import { logPanel } from '@/lib/panel-log'
import { revalidatePath } from 'next/cache'
import { canPanel } from '@/lib/panel-auth'
import { deleteContent, getContent, setContent } from '@/lib/content'
import { isAllowedImage } from '@/lib/site-registry'
import { TEXTS_KEY, legacyEventTexts } from '@/lib/site-texts-shared'
import type { EventCardInput } from '@/lib/event-cards'
import {
  CATALOG_KEYS,
  EVENT_KINDS,
  cleanBonuses,
  cleanCampaigns,
  cleanEvents,
  cleanOrder,
  cleanPredictions,
} from '@/lib/catalog-shared'
import { driftMessage } from '@/lib/drift'
import { SCORE_UNIT, cleanPayouts, isScored, payoutError, payoutTotal } from '@/lib/event-rules'
import type { PickListData } from '@/components/panel/pick-list'
import { mergeRewards, type RewardConfig } from '@/lib/rewards-shared'

type Result = { ok: true; message: string } | { ok: false; error: string }
const KIND_LABEL: Record<string, string> = { events: 'Etkinlikler', predictions: 'Tahminler', campaigns: 'Kampanyalar', bonuses: 'Bonuslar', rewards: 'Mini oyun ödülleri' }
type ListKind = 'events' | 'predictions' | 'campaigns' | 'bonuses'

const CLEANERS: Record<ListKind, (raw: unknown) => unknown[]> = {
  events: cleanEvents,
  predictions: cleanPredictions,
  campaigns: cleanCampaigns,
  bonuses: cleanBonuses,
}

const REWARD_LABELS = {
  cooldownHours: 'Çark bekleme süresi (saat)',
  'wheel.segments.#.points': 'Çark dilimi puanı',
  'wheel.segments.#.short': 'Çark dilimi kısa adı',
  'wheel.segments.#.label': 'Çark dilimi adı',
  'chest.dailyPlays': 'Sandık günlük hak',
  'chest.chests.#.rewards': 'Sandık ödülleri',
  'chest.chests.#.name': 'Sandık adı',
  'chest.chests.#.odds': 'Sandık şans yazısı',
  'dice.dailyPlays': 'Zar günlük hak',
  jackpot: 'Düşeş ödülü',
  doubleX: 'Çift zar çarpanı',
  highMin: 'Yüksek zar alt sınırı',
  highX: 'Yüksek zar çarpanı',
  lowX: 'Düşük zar çarpanı',
}

const CATALOG_LABELS = {
  title: 'Başlık',
  subtitle: 'Alt başlık',
  description: 'Açıklama',
  entry: 'Bilet fiyatı',
  participants: 'Katılımcı sayısı',
  hoursLeft: 'Kalan süre (saat)',
  rank: 'Sıralama türü',
  game: 'Sayılan oyun',
  payouts: 'Otomatik ödül',
  prize: 'Ödül yazısı',
  steps: 'Nasıl katılınır',
  rules: 'Kurallar',
  prizes: 'Ödül sıralaması',
  place: 'Ödül sırası',
  image: 'Görsel linki',
  reward: 'Tahmin ödülü',
  home: 'Ev sahibi takım',
  away: 'Deplasman takımı',
  match: 'Maç adı',
  votes: 'Oy sayısı',
  tag: 'Etiket',
  link: 'Link',
  href: 'Link',
  url: 'Yönlendirme linki (https:// ile başlamalı)',
  startsAt: 'Başlangıç tarihi',
  endsAt: 'Bitiş tarihi',
  kickoffAt: 'Maç tarihi',
  closesAt: 'Tahmin bitiş tarihi',
  league: 'Lig',
  kickoff: 'Başlama yazısı',
  wager: 'Çevrim',
  options: 'Seçenekler',
  label: 'Seçenek adı',
  sponsorId: 'Sponsor',
  amount: 'Tutar',
  code: 'Kod',
}

/** Fields the cleaner derives or rewrites itself, so they never count as a typing mistake. */
const CATALOG_DERIVED = ['id', 'ends', 'kind', 'type', 'status', 'startsAt', 'endsAt', 'closesAt', 'kickoffAt', 'resolvedAt', 'result', 'winner']
const CATALOG_BLANK_OK = ['image', 'tag', 'subtitle', 'description', 'prize', 'link', 'href', 'ends', 'code', 'match', 'league', 'kickoff', 'wager', 'amount', 'label']

function campaignDateError(items: unknown): string | null {
  if (!Array.isArray(items)) return null
  for (const [i, raw] of items.entries()) {
    const c = (raw ?? {}) as { startsAt?: unknown; endsAt?: unknown; title?: unknown }
    const start = Date.parse(String(c.startsAt ?? ''))
    const end = Date.parse(String(c.endsAt ?? ''))
    if (Number.isFinite(start) && Number.isFinite(end) && end <= start) {
      return `${i + 1}. satır · "${String(c.title ?? '').slice(0, 40)}": bitiş tarihi başlangıçtan önce. Bu kampanya sitede hiç görünmez. Hiçbir şey kaydedilmedi.`
    }
  }
  return null
}

/**
 * An automated event pays real coins the moment its end date passes, so a save is refused when the
 * prize lines cannot be paid as written or when it would settle an event straight away by mistake.
 */
async function eventError(items: unknown): Promise<string | null> {
  if (!Array.isArray(items)) return null
  const { getCatalog } = await import('@/lib/catalog')
  const stored = (await getCatalog({ includeHidden: true })).events
  const now = Date.now()
  for (const [i, raw] of items.entries()) {
    const e = (raw ?? {}) as Record<string, unknown>
    const where = `${i + 1}. satır · "${String(e.title ?? '').slice(0, 40)}"`
    const start = Date.parse(String(e.startsAt ?? ''))
    const end = Date.parse(String(e.endsAt ?? ''))
    if (Number.isFinite(start) && Number.isFinite(end) && end <= start) return `${where}: bitiş tarihi başlangıçtan önce. Hiçbir şey kaydedilmedi.`
    const problem = payoutError(e.payouts)
    if (problem) return `${where}: ${problem} Hiçbir şey kaydedilmedi.`
    const rank = String(e.rank ?? 'none')
    if (rank === 'none') continue
    if (!Number.isFinite(end)) return `${where}: otomatik sıralama için bitiş tarihi gerekli; ödüller o tarihte dağıtılır. Hiçbir şey kaydedilmedi.`
    if (!cleanPayouts(e.payouts).length) return `${where}: otomatik sıralama seçili ama "Otomatik ödül" satırı yok. En az bir satır yaz (örnek: 1 | 5000). Hiçbir şey kaydedilmedi.`
    const before = stored.find((s) => s.id === String(e.id ?? ''))
    const unchanged = before && (before.rank ?? 'none') !== 'none' && Date.parse(before.endsAt ?? '') === end
    if (end <= now && !unchanged) return `${where}: bitiş tarihi geçmişte. Böyle kaydedilirse etkinlik hemen sonuçlanır ve ödüller dağıtılır. İleri bir bitiş tarihi gir. Hiçbir şey kaydedilmedi.`
  }
  return null
}

const kc = (n: number) => `${n.toLocaleString('tr-TR')} KC`

export async function loadEventBoard(eventId: string): Promise<PickListData> {
  if (!(await canPanel('catalog'))) return { ok: false, error: 'Bu bölüm için yetkin yok.' }
  try {
    const { eventAdminBoard } = await import('@/lib/event-entries')
    const board = await eventAdminBoard(String(eventId).slice(0, 80))
    if (!board) return { ok: false, error: 'Bu etkinlik henüz kaydedilmemiş. Önce listeyi kaydet.' }
    const scored = isScored(board.rank)
    const state =
      board.rank === 'none'
        ? 'Otomatik sıralama kapalı: bu etkinlikte kazananı ve ödülü sen belirlersin.'
        : board.settled
          ? board.unpaid
            ? `Sonuçlandı; ${board.unpaid} ödül ödenmeyi bekliyor, bir dakika içinde kendiliğinden ödenir.`
            : 'Sonuçlandı ve ödüller ödendi. Yeni tur açmak için bitiş tarihini ileri bir tarihe alıp kaydet.'
          : board.phase === 'ended'
            ? 'Süre doldu. Sitede ziyaretçi varken ödüller bir dakika içinde kendiliğinden dağıtılır; beklemek istemezsen "Şimdi sonuçlandır"a bas.'
            : board.phase === 'upcoming'
              ? 'Henüz başlamadı.'
              : 'Devam ediyor. Bitiş tarihinde sıralama dondurulur ve ödüller kendiliğinden dağıtılır.'
    return {
      ok: true,
      total: board.entrants,
      closed: board.settled && !board.unpaid,
      summary: `${board.round}. tur · ${board.entrants} katılımcı. ${state}`,
      rows: board.rows.map((r) => ({
        userId: r.userId,
        name: r.name,
        pick: scored ? `${r.score.toLocaleString('tr-TR')} ${SCORE_UNIT[board.rank]}` : board.settled ? 'Çekilişte çıktı' : 'Katıldı',
        note: board.settled
          ? r.prize > 0
            ? `${r.place}. sıra · ${kc(r.prize)} ${r.paid ? 'ödendi' : 'ödeme bekliyor'}`
            : `${r.place}. sıra · ödül yok`
          : r.place === null
            ? board.rank === 'draw'
              ? 'Çekilişi bekliyor'
              : '-'
            : r.prize > 0
              ? `${r.place}. sıra · şu an ${kc(r.prize)}`
              : `${r.place}. sıra`,
        at: r.joinedAt ?? undefined,
      })),
    }
  } catch (error) {
    console.error('[catalog] etkinlik sıralaması okunamadı', (error as Error).message)
    return { ok: false, error: 'Liste okunamadı.' }
  }
}

export async function settleEventNow(eventId: string): Promise<Result> {
  if (!(await canPanel('catalog'))) return { ok: false, error: 'Bu bölüm için yetkin yok.' }
  try {
    const id = String(eventId).slice(0, 80)
    const { settleEvent } = await import('@/lib/event-entries')
    const r = await settleEvent(id, 'panel')
    if (!r.ok) return r
    revalidatePath('/', 'layout')
    const waiting = r.unpaid ? ` ${r.unpaid} ödül sırada, bir dakika içinde kendiliğinden ödenir.` : ''
    if (r.already) return { ok: true, message: r.paid ? `Bu tur zaten sonuçlanmıştı; bekleyen ${r.paid} ödül ödendi.${waiting}` : `Bu tur zaten sonuçlandı, ödenmemiş ödül yok.${waiting}` }
    await logPanel('catalog', 'Etkinlik sonuçlandırıldı', id, `${r.entrants} katılımcı · ${r.winners} ödül · ${r.paid} ödendi`)
    return { ok: true, message: `${r.entrants} katılımcı sıralandı, ${r.winners} kişi ödül kazandı, ${r.paid} ödül ödendi.${waiting}` }
  } catch (error) {
    console.error('[catalog] etkinlik sonuçlandırılamadı', (error as Error).message)
    return { ok: false, error: 'Sonuçlandırılamadı. Ödenen ödül tekrar ödenmez; birazdan yeniden dene.' }
  }
}

export async function saveRewards(input: RewardConfig): Promise<Result> {
  if (!(await canPanel('rewards'))) return { ok: false, error: 'Bu bölüm için yetkin yok.' }
  try {
    const clean = mergeRewards(input)
    const drift = driftMessage(input, clean, { labels: REWARD_LABELS, ignore: ['tone'] })
    if (drift) return { ok: false, error: drift }
    await setContent(CATALOG_KEYS.rewards, clean)
    revalidatePath('/', 'layout')
    await logPanel('rewards', 'Mini oyun ödülleri kaydedildi')
    return { ok: true, message: 'Ödüller kaydedildi, sitede hemen geçerli.' }
  } catch (error) {
    console.error('[rewards] kaydedilemedi', error)
    return { ok: false, error: 'Kaydedilemedi.' }
  }
}

export async function saveCatalogList(kind: ListKind, items: unknown): Promise<Result> {
  if (!(await canPanel('catalog'))) return { ok: false, error: 'Bu bölüm için yetkin yok.' }
  const clean = CLEANERS[kind]
  if (!clean) return { ok: false, error: 'Geçersiz bölüm.' }
  try {
    const cleaned = clean(items)
    const drift =
      (kind === 'campaigns' ? campaignDateError(items) : kind === 'events' ? await eventError(items) : null) ??
      driftMessage(items, cleaned, {
        labels: CATALOG_LABELS,
        // Event prize lines are checked line by line above; the cleaner only rewrites how the place is spelled.
        ignore: kind === 'campaigns' ? [...CATALOG_DERIVED, 'hoursLeft'] : kind === 'events' ? [...CATALOG_DERIVED, 'hoursLeft', 'payouts'] : CATALOG_DERIVED,
        blankOk: CATALOG_BLANK_OK,
        mustKeep: ['url', 'startsAt', 'endsAt', 'kickoffAt', 'closesAt'],
      })
    if (drift) return { ok: false, error: drift }
    await setContent(CATALOG_KEYS[kind], cleaned)
    if (kind === 'events') await dropLegacyEventTexts()
    revalidatePath('/', 'layout')
    const prizes = kind === 'events' ? cleanEvents(items).reduce((sum, e) => sum + ((e.rank ?? 'none') === 'none' ? 0 : payoutTotal(e.payouts ?? [])), 0) : 0
    await logPanel('catalog', 'İçerik listesi kaydedildi', KIND_LABEL[kind] ?? kind, `${Array.isArray(items) ? items.length : 0} kayıt${prizes ? ` · otomatik etkinlik ödülleri en fazla ${kc(prizes)}` : ''}`)
    return { ok: true, message: 'Kaydedildi, sitede hemen geçerli.' }
  } catch (error) {
    console.error(`[catalog:${kind}] kaydedilemedi`, error)
    return { ok: false, error: 'Kaydedilemedi.' }
  }
}

/**
 * The saved events already carry whatever the old per-event text rows said (the panel reads them
 * laid over the list), so the rows are removed here; left in place they would undo the next edit.
 */
async function dropLegacyEventTexts() {
  const saved = await getContent<Record<string, string>>(TEXTS_KEY)
  const legacy = legacyEventTexts(saved)
  if (!saved || !Object.keys(legacy).length) return
  await setContent(TEXTS_KEY, Object.fromEntries(Object.entries(saved).filter(([key]) => !(key in legacy))))
}

const CARD_LIMITS = { title: 80, subtitle: 120, prize: 80 } as const
const CARD_LABELS: Record<keyof typeof CARD_LIMITS, string> = { title: 'Başlık', subtitle: 'Alt yazı', prize: 'Ödül yazısı' }

const trIso = (ms: number) => `${new Date(ms + 3 * 3_600_000).toISOString().slice(0, 16)}:00+03:00`

/**
 * The card face of every event, in site order: what "Site yazıları → Etkinlik kartları" edits.
 * `known` is the list the screen was showing, so a save cannot wipe an event added elsewhere meanwhile.
 * Texts, image and order need only the texts permission, as the old text rows did; adding or
 * removing an event changes what members can join and stays with the content calendar permission.
 */
export async function saveEventCards(cards: EventCardInput[], known: string[]): Promise<Result> {
  const [texts, catalog] = await Promise.all([canPanel('texts'), canPanel('catalog')])
  if (!texts && !catalog) return { ok: false, error: 'Bu bölüm için yetkin yok.' }
  try {
    if (!Array.isArray(cards) || !Array.isArray(known)) return { ok: false, error: 'Geçersiz liste.' }
    const { getCatalog } = await import('@/lib/catalog')
    const stored = (await getCatalog({ includeHidden: true })).events
    const before = new Set(known.map(String))
    if (stored.length !== before.size || stored.some((e) => !before.has(e.id))) {
      return { ok: false, error: 'Etkinlik listesi bu arada başka bir ekrandan değişmiş. Sayfayı yenileyip tekrar dene. Hiçbir şey kaydedilmedi.' }
    }
    const kept = new Set<string>()
    const now = Date.now()
    const next: unknown[] = []
    let added = 0
    for (const [i, raw] of cards.slice(0, 40).entries()) {
      const card = (raw ?? {}) as Partial<EventCardInput>
      const text = (key: keyof typeof CARD_LIMITS) => String(card[key] ?? '').trim()
      const where = `${i + 1}. kart`
      if (!text('title')) return { ok: false, error: `${where}: başlık boş olamaz. Hiçbir şey kaydedilmedi.` }
      for (const key of Object.keys(CARD_LIMITS) as (keyof typeof CARD_LIMITS)[]) {
        if (text(key).length > CARD_LIMITS[key]) {
          return { ok: false, error: `${where}: ${CARD_LABELS[key]} en fazla ${CARD_LIMITS[key]} karakter olabilir (yazdığın ${text(key).length}). Hiçbir şey kaydedilmedi.` }
        }
      }
      const image = String(card.image ?? '').trim()
      if (image && !isAllowedImage(image)) return { ok: false, error: `${where}: görsel /images/ ile ya da https:// ile başlamalı. Hiçbir şey kaydedilmedi.` }
      const face = {
        kind: EVENT_KINDS.includes(card.kind as (typeof EVENT_KINDS)[number]) ? card.kind : 'Haftalık',
        title: text('title'),
        subtitle: text('subtitle'),
        prize: text('prize'),
        image: image || '/images/banner-events.png',
      }
      const id = String(card.id ?? '')
      const current = id && !kept.has(id) ? stored.find((e) => e.id === id) : undefined
      if (current) {
        kept.add(id)
        next.push({ ...current, ...face })
        continue
      }
      added++
      next.push({
        ...face,
        id: `etkinlik-${now.toString(36)}${added > 1 ? `-${added}` : ''}`,
        startsAt: trIso(now),
        endsAt: trIso(now + 7 * 86_400_000),
        participants: 0,
        entry: 0,
        rank: 'none',
        game: '',
        payouts: [],
        description: '',
        steps: [],
        rules: [],
        prizes: [],
      })
    }
    const removed = stored.filter((e) => !kept.has(e.id))
    if ((added || removed.length) && !catalog) {
      return { ok: false, error: 'Etkinlik eklemek ve silmek için "İçerik takvimi" yetkisi gerekir. Yazı, görsel ve sıra değişikliği yapabilirsin. Hiçbir şey kaydedilmedi.' }
    }
    const problem = await eventError(next)
    if (problem) return { ok: false, error: problem }
    await setContent(CATALOG_KEYS.events, cleanEvents(next))
    await dropLegacyEventTexts()
    revalidatePath('/', 'layout')
    revalidatePath('/panel')
    const detail = [`${next.length} kart`, added ? `${added} eklendi` : '', removed.length ? `silinen: ${removed.map((e) => e.title).join(', ').slice(0, 200)}` : ''].filter(Boolean).join(' · ')
    await logPanel('texts', 'Etkinlik kartları kaydedildi', null, detail)
    return { ok: true, message: added ? 'Etkinlik eklendi. Ücretsiz ve 7 günlük açıldı; tarih, ücret ve ödülleri İçerik takvimi → Etkinlik & bilet sekmesinden ayarla.' : removed.length ? 'Etkinlik silindi.' : 'Kaydedildi, sitede hemen geçerli.' }
  } catch (error) {
    console.error('[catalog:event-cards] kaydedilemedi', error)
    return { ok: false, error: 'Kaydedilemedi.' }
  }
}

export async function loadPredictionPicks(predictionId: string): Promise<PickListData> {
  if (!(await canPanel('catalog'))) return { ok: false, error: 'Bu bölüm için yetkin yok.' }
  try {
    const id = String(predictionId).slice(0, 80)
    const [{ listPredictionPicks }, { getCatalog }] = await Promise.all([import('@/lib/prediction-picks'), import('@/lib/catalog')])
    const [{ total, picks }, catalog] = await Promise.all([listPredictionPicks(id), getCatalog({ includeHidden: true })])
    const options = catalog.predictions.find((p) => p.id === id)?.options ?? []
    const label = (optionId: string) => options.find((o) => o.id === optionId)?.label ?? 'Silinmiş seçenek'
    const tally = new Map<string, number>()
    for (const p of picks) tally.set(label(p.optionId), (tally.get(label(p.optionId)) ?? 0) + 1)
    return {
      ok: true,
      total,
      summary: [...tally].map(([name, n]) => `${name}: ${n} üye`).join(' · ') || undefined,
      rows: picks.map((p) => ({ userId: p.userId, name: p.name, pick: label(p.optionId), at: p.at })),
    }
  } catch (error) {
    console.error('[catalog] tahmin listesi okunamadı', (error as Error).message)
    return { ok: false, error: 'Liste okunamadı.' }
  }
}

export async function saveCategoryOrder(input: unknown): Promise<Result> {
  if (!(await canPanel('catalog'))) return { ok: false, error: 'Bu bölüm için yetkin yok.' }
  try {
    await setContent(CATALOG_KEYS.order, cleanOrder(input))
    revalidatePath('/', 'layout')
    await logPanel('catalog', 'Kategori sıralaması kaydedildi')
    return { ok: true, message: 'Sıralama kaydedildi, sitede hemen geçerli.' }
  } catch (error) {
    console.error('[catalog:order] kaydedilemedi', error)
    return { ok: false, error: 'Kaydedilemedi.' }
  }
}

export async function resetCatalog(kind: ListKind | 'rewards'): Promise<Result> {
  if (!(await canPanel(kind === 'rewards' ? 'rewards' : 'catalog'))) return { ok: false, error: 'Bu bölüm için yetkin yok.' }
  try {
    await deleteContent(CATALOG_KEYS[kind])
    revalidatePath('/', 'layout')
    await logPanel(kind === 'rewards' ? 'rewards' : 'catalog', 'Varsayılana döndürüldü', KIND_LABEL[kind] ?? kind)
    return { ok: true, message: 'Varsayılana döndürüldü.' }
  } catch (error) {
    console.error(`[catalog:${kind}] sıfırlanamadı`, error)
    return { ok: false, error: 'Sıfırlanamadı.' }
  }
}
