import {
  BONUSES,
  CAMPAIGNS,
  EVENTS,
  PREDICTIONS,
  type Bonus,
  type Campaign,
  type EventItem,
  type Prediction,
} from '@/components/alkanka/data'
import { DEFAULT_REWARDS, mergeRewards, type RewardConfig } from './rewards-shared'

export type Catalog = {
  rewards: RewardConfig
  events: EventItem[]
  predictions: Prediction[]
  campaigns: Campaign[]
  bonuses: Bonus[]
  order: CategoryOrder
}

export type CategoryOrder = { campaignTags: string[]; bonusTypes: string[] }

export const CATALOG_KEYS = {
  rewards: 'rewards:mini',
  events: 'catalog:events',
  predictions: 'catalog:predictions',
  campaigns: 'catalog:campaigns',
  bonuses: 'catalog:bonuses',
  order: 'catalog:order',
} as const

export const DEFAULT_ORDER: CategoryOrder = { campaignTags: [], bonusTypes: [] }

export const DEFAULT_CATALOG: Catalog = {
  rewards: DEFAULT_REWARDS,
  events: EVENTS,
  predictions: PREDICTIONS,
  campaigns: CAMPAIGNS,
  bonuses: BONUSES,
  order: DEFAULT_ORDER,
}

export function cleanOrder(raw: unknown): CategoryOrder {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const names = (v: unknown) =>
    Array.from(new Set((Array.isArray(v) ? v : []).map((s) => (typeof s === 'string' ? s.trim().slice(0, 20) : '')).filter(Boolean))).slice(0, 40)
  return { campaignTags: names(r.campaignTags), bonusTypes: names(r.bonusTypes) }
}

/** Saved order first, then any category the panel hasn't ranked yet in its natural order. */
export function sortByOrder(values: string[], order: string[]): string[] {
  const unique = Array.from(new Set(values))
  return [...order.filter((v) => unique.includes(v)), ...unique.filter((v) => !order.includes(v))]
}

export const EVENT_KINDS: EventItem['kind'][] = ['Günlük', 'Haftalık', 'Aylık']
export const BONUS_TYPES: Bonus['type'][] = ['Hoş geldin', 'Yatırım', 'Kayıp', 'Freespin', 'Deneme']

const MAX_ITEMS = 40

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const num = (v: unknown, min: number, max: number) => {
  const n = Number(v)
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min
}
const int = (v: unknown, min: number, max: number) => Math.round(num(v, min, max))
const lines = (v: unknown, max = 12) =>
  (Array.isArray(v) ? v : []).map((s) => str(s, 240)).filter(Boolean).slice(0, max)
const slug = (v: unknown, i: number, prefix: string) => {
  const s = str(v, 40).replace(/[^a-z0-9-]/gi, '')
  return s || `${prefix}-${i + 1}`
}
const image = (v: unknown) => {
  const s = str(v, 400)
  return s.startsWith('/') || s.startsWith('https://') ? s : '/images/banner-events.png'
}
const list = (v: unknown) => (Array.isArray(v) ? v.slice(0, MAX_ITEMS) : [])
const unique = <T extends { id: string }>(items: T[]) => {
  const seen = new Set<string>()
  return items.map((it) => {
    let id = it.id
    for (let n = 2; seen.has(id); n++) id = `${it.id}-${n}`
    seen.add(id)
    return { ...it, id }
  })
}

export function cleanEvents(raw: unknown): EventItem[] {
  return unique(
    list(raw).map((e: Record<string, unknown>, i) => ({
      id: slug(e.id, i, 'etkinlik'),
      kind: EVENT_KINDS.includes(e.kind as EventItem['kind']) ? (e.kind as EventItem['kind']) : 'Haftalık',
      title: str(e.title, 80) || 'Yeni etkinlik',
      subtitle: str(e.subtitle, 120),
      hoursLeft: num(e.hoursLeft, 0, 24 * 365),
      participants: int(e.participants, 0, 10_000_000),
      entry: int(e.entry, 0, 1_000_000),
      prize: str(e.prize, 80),
      image: image(e.image),
      description: str(e.description, 800),
      steps: lines(e.steps),
      rules: lines(e.rules),
      prizes: (Array.isArray(e.prizes) ? e.prizes : [])
        .map((p: Record<string, unknown>) => ({ place: str(p?.place, 30), prize: str(p?.prize, 80) }))
        .filter((p) => p.place && p.prize)
        .slice(0, 12),
    })),
  )
}

export function cleanPredictions(raw: unknown): Prediction[] {
  return unique(
    list(raw).map((p: Record<string, unknown>, i) => ({
      id: slug(p.id, i, 'tahmin'),
      league: str(p.league, 60),
      home: str(p.home, 40) || 'Ev sahibi',
      away: str(p.away, 40) || 'Deplasman',
      kickoff: str(p.kickoff, 40),
      reward: int(p.reward, 0, 100000),
      options: (Array.isArray(p.options) && p.options.length ? p.options : [{}, {}, {}])
        .slice(0, 3)
        .map((o: Record<string, unknown>, j) => ({
          id: ['1', 'x', '2'][j],
          label: str(o?.label, 20) || ['Ev', 'Beraberlik', 'Deplasman'][j],
          votes: int(o?.votes, 0, 10_000_000),
        })),
    })),
  )
}

export function cleanCampaigns(raw: unknown): Campaign[] {
  return unique(
    list(raw).map((c: Record<string, unknown>, i) => ({
      id: slug(c.id, i, 'kampanya'),
      sponsorId: str(c.sponsorId, 40),
      title: str(c.title, 80) || 'Yeni kampanya',
      description: str(c.description, 400),
      ends: str(c.ends, 40),
      image: image(c.image),
      tag: str(c.tag, 20) || 'Kampanya',
      hoursLeft: num(c.hoursLeft, 0, 24 * 365),
    })),
  )
}

export function cleanBonuses(raw: unknown): Bonus[] {
  return unique(
    list(raw).map((b: Record<string, unknown>, i) => ({
      id: slug(b.id, i, 'bonus'),
      sponsorId: str(b.sponsorId, 40),
      type: BONUS_TYPES.includes(b.type as Bonus['type']) ? (b.type as Bonus['type']) : 'Hoş geldin',
      title: str(b.title, 80) || 'Yeni bonus',
      amount: str(b.amount, 60),
      wager: str(b.wager, 40),
      code: str(b.code, 30) || undefined,
    })),
  )
}

/** Saved lists replace the defaults wholesale; an unsaved list keeps the built-in content. */
export function mergeCatalog(all: Record<string, unknown>): Catalog {
  const pick = <T,>(key: string, clean: (v: unknown) => T[], fallback: T[]) =>
    Array.isArray(all[key]) ? clean(all[key]) : fallback
  return {
    rewards: mergeRewards(all[CATALOG_KEYS.rewards]),
    events: pick(CATALOG_KEYS.events, cleanEvents, EVENTS),
    predictions: pick(CATALOG_KEYS.predictions, cleanPredictions, PREDICTIONS),
    campaigns: pick(CATALOG_KEYS.campaigns, cleanCampaigns, CAMPAIGNS),
    bonuses: pick(CATALOG_KEYS.bonuses, cleanBonuses, BONUSES),
    order: cleanOrder(all[CATALOG_KEYS.order]),
  }
}
