import { getContent } from '@/lib/content'

export const AMBIENT_KEY = 'ambient_tables'

export type AmbientSettings = {
  enabled: boolean
  /** Istanbul local hour the busy window opens (0-23). */
  startHour: number
  /** Istanbul local hour the busy window closes (0-24). Smaller than start means it wraps past midnight. */
  endHour: number
  /** Busy tables shown per game lobby. */
  perGame: number
}

export const AMBIENT_DEFAULTS: AmbientSettings = { enabled: true, startHour: 12, endHour: 2, perGame: 3 }

export function normalizeAmbient(v: Partial<AmbientSettings> | null | undefined): AmbientSettings {
  const hour = (n: unknown, max: number, d: number) => {
    const x = Math.round(Number(n))
    return Number.isFinite(x) ? Math.min(max, Math.max(0, x)) : d
  }
  return {
    enabled: v?.enabled ?? AMBIENT_DEFAULTS.enabled,
    startHour: hour(v?.startHour, 23, AMBIENT_DEFAULTS.startHour),
    endHour: hour(v?.endHour, 24, AMBIENT_DEFAULTS.endHour),
    perGame: hour(v?.perGame, 8, AMBIENT_DEFAULTS.perGame),
  }
}

// Lobbies poll every few seconds; memoizing keeps this from adding a DB read per poll.
let cache: { at: number; value: AmbientSettings } | null = null
export async function getAmbientSettings(): Promise<AmbientSettings> {
  if (cache && Date.now() - cache.at < 60_000) return cache.value
  const value = normalizeAmbient(await getContent<Partial<AmbientSettings>>(AMBIENT_KEY))
  cache = { at: Date.now(), value }
  return value
}
export function clearAmbientCache() {
  cache = null
}

const NAMES = [
  'Emre', 'Burak', 'Serkan', 'Mert', 'Onur', 'Kaan', 'Tolga', 'Hakan', 'Volkan', 'Cem', 'Murat', 'Ozan', 'Ufuk', 'Barış',
  'Yasin', 'Furkan', 'Enes', 'Oğuz', 'Selim', 'Kerem', 'Arda', 'Batu', 'Erdem', 'Gökhan', 'Sinan', 'Tarık', 'Umut', 'Deniz',
  'Ayşe', 'Elif', 'Zeynep', 'Merve', 'Esra', 'Buse', 'Ceren', 'Derya', 'Gizem', 'Seda', 'Melis', 'İrem', 'Damla', 'Ece',
]
const SUFFIX = ['', '', '', '34', '06', '35', '_tr', '07', '16', '61', 'kral', '01', '42', '55', 'reis', '27']
const SEATS: Record<string, number> = { okey: 4, okey101: 4, batak: 4, papaz: 4, monopoly: 4, pisti: 2, tavla: 2, bilardo: 2 }
const STAKES = [25, 50, 50, 100, 100, 250, 250, 500, 1000, 2500]
const SLOT_MS = 9 * 60_000

function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function hash(str: string) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619)
  return h >>> 0
}

function istanbulHour(now: number) {
  return Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: 'Europe/Istanbul' }).format(now)) % 24
}
export function inWindow(s: AmbientSettings, now = Date.now()) {
  if (!s.enabled || s.perGame === 0 || s.startHour === s.endHour) return false
  const h = istanbulHour(now)
  return s.startHour < s.endHour ? h >= s.startHour && h < s.endHour : h >= s.startHour || h < s.endHour
}

/**
 * Busy-looking tables, derived purely from the clock. Each table lives for one ~9 minute slot so the
 * list changes naturally, and every visitor sees the same tables without anything being stored.
 */
export function ambientTables(game: string, s: AmbientSettings, now = Date.now()) {
  if (!inWindow(s, now)) return []
  const slot = Math.floor(now / SLOT_MS)
  const seats = SEATS[game] ?? 2
  const h = istanbulHour(now)
  const peak = h >= 20 || h < 1 ? 1 : 0
  const count = Math.min(8, s.perGame + peak)
  return Array.from({ length: count }, (_, i) => {
    // Staggered slots so tables don't all swap at the same moment.
    const own = slot + (i % 3 === 0 ? 0 : i % 3 === 1 ? 0.33 : 0.66)
    const tableSlot = Math.floor((now + (own - slot) * SLOT_MS) / SLOT_MS)
    const r = rng(hash(`${game}:${tableSlot}:${i}`))
    const used = new Set<string>()
    const players = Array.from({ length: seats }, (_, seat) => {
      let name = ''
      do name = NAMES[Math.floor(r() * NAMES.length)] + SUFFIX[Math.floor(r() * SUFFIX.length)]
      while (used.has(name))
      used.add(name)
      return { id: `amb-${tableSlot}-${i}-${seat}`, name, seat }
    })
    return {
      id: `amb-${game}-${tableSlot}-${i}`,
      game,
      stake: STAKES[Math.floor(r() * STAKES.length)],
      seats,
      team: seats === 4 && game === 'okey' && r() < 0.4,
      bots: 0,
      variant: game === 'pisti' ? (r() < 0.5 ? '101' : '151') : null,
      winners: [],
      spectator: false,
      status: 'oynaniyor' as const,
      players,
      version: 0,
      winnerId: null,
      tournamentId: null,
      roundNo: null,
      updatedAt: new Date(now).toISOString(),
      seat: -1,
      turn: null,
      state: null,
      ambient: true,
    }
  })
}
