import { ARENA_GAMES, ARENA_META, MINI_GAME_TITLES, type ArenaGame, type MiniGame } from '@/lib/arena'

/** How an event orders its entrants once it ends. `none` is run by hand: nothing is ranked or paid. */
export const EVENT_RANKS = ['none', 'draw', 'wins', 'coins', 'plays'] as const
export type EventRank = (typeof EVENT_RANKS)[number]

export const RANK_LABEL: Record<EventRank, string> = {
  none: 'Otomatik sıralama yok (elle yürütülür)',
  draw: 'Çekiliş · katılanlar arasından rastgele',
  wins: 'En çok oyun kazanan',
  coins: 'Oyunlardan en çok KC kazanan',
  plays: 'En çok oyun oynayan',
}

export const RANK_SHORT: Record<EventRank, string> = { none: 'Elle', draw: 'Çekiliş', wins: 'Galibiyet', coins: 'Kazanılan KC', plays: 'Oynanan oyun' }
export const SCORE_UNIT: Record<EventRank, string> = { none: '', draw: '', wins: 'galibiyet', coins: 'KC', plays: 'oyun' }

export const isScored = (rank: EventRank) => rank === 'wins' || rank === 'coins' || rank === 'plays'

/** Games whose history rows can feed an event score. */
export const EVENT_GAMES: string[] = [...ARENA_GAMES, ...Object.keys(MINI_GAME_TITLES)]
/** Table, casino and free daily plays count; purchases, refunds, tournament matches and staff corrections never do. */
export const EVENT_MODES = ['pvp', 'bot', 'masa', 'odul']

export const eventGameLabel = (game: string) =>
  !game ? 'Tüm oyunlar' : (ARENA_META[game as ArenaGame]?.title ?? MINI_GAME_TITLES[game as MiniGame] ?? game)

export const EVENT_GAME_OPTIONS = [{ value: '', label: 'Tüm oyunlar' }, ...EVENT_GAMES.map((g) => ({ value: g, label: eventGameLabel(g) }))]

export type EventPayout = { rank: string; kc: number }

export const MAX_PRIZE_PLACE = 500
export const MAX_EVENT_PRIZE = 1_000_000

/** "3", "3." or "4-10" as an inclusive place range. */
export function placeRange(text: unknown): [number, number] | null {
  const m = /^(\d{1,4})\.?(?:\s*-\s*(\d{1,4})\.?)?$/.exec(String(text ?? '').trim())
  if (!m) return null
  const from = Number(m[1])
  const to = m[2] ? Number(m[2]) : from
  return from >= 1 && to >= from && to <= MAX_PRIZE_PLACE ? [from, to] : null
}

/** Prize amounts are typed the Turkish way: "5.000" and "5000 KC" both mean five thousand. */
export function parseKc(text: unknown) {
  if (typeof text === 'number') return Math.round(text)
  const digits = String(text ?? '').replace(/kc/gi, '').replace(/[.\s]/g, '')
  return /^\d+$/.test(digits) ? Number(digits) : Number.NaN
}

/** What is wrong with the prize lines, in words; null when they can be paid as written. */
export function payoutError(raw: unknown): string | null {
  const list = Array.isArray(raw) ? raw : []
  const taken: [number, number][] = []
  for (const [i, line] of list.entries()) {
    const p = (line ?? {}) as { rank?: unknown; kc?: unknown }
    const range = placeRange(p.rank)
    if (!range) return `${i + 1}. ödül satırında sıra "${String(p.rank ?? '').slice(0, 20)}" okunamadı. "1" ya da "2-10" gibi yaz (en fazla ${MAX_PRIZE_PLACE}. sıra).`
    const kc = parseKc(p.kc)
    if (!Number.isFinite(kc) || kc <= 0) return `${i + 1}. ödül satırında KC tutarı yok ya da sıfır.`
    if (kc > MAX_EVENT_PRIZE) return `${i + 1}. ödül satırında tutar çok yüksek (kişi başı en fazla ${MAX_EVENT_PRIZE.toLocaleString('tr-TR')} KC).`
    if (taken.some(([a, b]) => range[0] <= b && range[1] >= a)) return `${i + 1}. ödül satırındaki sıra başka bir satırla çakışıyor.`
    taken.push(range)
  }
  return null
}

/** Valid, non-overlapping prize lines in place order; anything else is dropped. */
export function cleanPayouts(raw: unknown): EventPayout[] {
  const out: { from: number; to: number; kc: number }[] = []
  for (const line of Array.isArray(raw) ? raw : []) {
    const p = (line ?? {}) as { rank?: unknown; kc?: unknown }
    const range = placeRange(p.rank)
    const kc = parseKc(p.kc)
    if (!range || !Number.isFinite(kc) || kc <= 0 || kc > MAX_EVENT_PRIZE) continue
    if (out.some((o) => range[0] <= o.to && range[1] >= o.from)) continue
    out.push({ from: range[0], to: range[1], kc })
  }
  return out
    .sort((a, b) => a.from - b.from)
    .slice(0, 40)
    .map((o) => ({ rank: o.from === o.to ? String(o.from) : `${o.from}-${o.to}`, kc: o.kc }))
}

export function prizeForPlace(payouts: EventPayout[], place: number) {
  for (const p of payouts) {
    const range = placeRange(p.rank)
    if (range && place >= range[0] && place <= range[1]) return p.kc
  }
  return 0
}

export const lastPrizePlace = (payouts: EventPayout[]) => payouts.reduce((max, p) => Math.max(max, placeRange(p.rank)?.[1] ?? 0), 0)

/** The most the event can pay, reached when every prize place is filled. */
export const payoutTotal = (payouts: EventPayout[]) =>
  payouts.reduce((sum, p) => {
    const range = placeRange(p.rank)
    return range ? sum + p.kc * (range[1] - range[0] + 1) : sum
  }, 0)

/** Prize lines the way the site lists them: "2.-10." and "1.000 KC". */
export const payoutRows = (payouts: EventPayout[]) =>
  payouts.map((p) => {
    const [from, to] = placeRange(p.rank) ?? [0, 0]
    return { place: from === to ? `${from}.` : `${from}.-${to}.`, prize: `${p.kc.toLocaleString('tr-TR')} KC` }
  })

export type EventPhase = 'undated' | 'upcoming' | 'live' | 'ended'

export function eventPhase(e: { startsAt?: string; endsAt?: string }, now: number): EventPhase {
  const start = Date.parse(e.startsAt ?? '')
  const end = Date.parse(e.endsAt ?? '')
  if (Number.isFinite(start) && now < start) return 'upcoming'
  if (!Number.isFinite(end)) return 'undated'
  return now < end ? 'live' : 'ended'
}

export type EventBoardRow = { place: number; name: string; score: number; prize: number; me: boolean }
export type EventBoard = {
  rank: EventRank
  settled: boolean
  entrants: number
  top: EventBoardRow[]
  me: { place: number; score: number; prize: number } | null
}
