'use server'

import { revalidatePath } from 'next/cache'
import { canPanel } from '@/lib/panel-auth'
import { deleteContent, setContent } from '@/lib/content'
import {
  CATALOG_KEYS,
  cleanBonuses,
  cleanCampaigns,
  cleanEvents,
  cleanOrder,
  cleanPredictions,
} from '@/lib/catalog-shared'
import { driftMessage } from '@/lib/drift'
import { mergeRewards, type RewardConfig } from '@/lib/rewards-shared'

type Result = { ok: true; message: string } | { ok: false; error: string }
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

export async function saveRewards(input: RewardConfig): Promise<Result> {
  if (!(await canPanel('rewards'))) return { ok: false, error: 'Bu bölüm için yetkin yok.' }
  try {
    const clean = mergeRewards(input)
    const drift = driftMessage(input, clean, { labels: REWARD_LABELS, ignore: ['tone'] })
    if (drift) return { ok: false, error: drift }
    await setContent(CATALOG_KEYS.rewards, clean)
    revalidatePath('/', 'layout')
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
      (kind === 'campaigns' ? campaignDateError(items) : null) ??
      driftMessage(items, cleaned, {
        labels: CATALOG_LABELS,
        ignore: kind === 'campaigns' ? [...CATALOG_DERIVED, 'hoursLeft'] : CATALOG_DERIVED,
        blankOk: CATALOG_BLANK_OK,
        mustKeep: ['url', 'startsAt', 'endsAt', 'kickoffAt', 'closesAt'],
      })
    if (drift) return { ok: false, error: drift }
    await setContent(CATALOG_KEYS[kind], cleaned)
    revalidatePath('/', 'layout')
    return { ok: true, message: 'Kaydedildi, sitede hemen geçerli.' }
  } catch (error) {
    console.error(`[catalog:${kind}] kaydedilemedi`, error)
    return { ok: false, error: 'Kaydedilemedi.' }
  }
}

export async function saveCategoryOrder(input: unknown): Promise<Result> {
  if (!(await canPanel('catalog'))) return { ok: false, error: 'Bu bölüm için yetkin yok.' }
  try {
    await setContent(CATALOG_KEYS.order, cleanOrder(input))
    revalidatePath('/', 'layout')
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
    return { ok: true, message: 'Varsayılana döndürüldü.' }
  } catch (error) {
    console.error(`[catalog:${kind}] sıfırlanamadı`, error)
    return { ok: false, error: 'Sıfırlanamadı.' }
  }
}
