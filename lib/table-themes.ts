import type { CSSProperties } from 'react'

export type ThemeGame = 'okey' | '101' | 'tavla' | 'bilardo' | 'batak'
export const THEME_GAMES: ThemeGame[] = ['okey', '101', 'tavla', 'bilardo', 'batak']

export type ThemeCategory = 'std' | 'fan' | 'hero' | 'car' | 'nat'
export const THEME_CATEGORIES: Record<ThemeCategory, string> = {
  std: 'Düz Masa',
  fan: 'Taraftar',
  hero: 'Süper Kahraman',
  car: 'Modifiye Araba',
  nat: 'Doğa & Hayvan',
}

export type ThemeRarity = 'S' | 'N' | 'R' | 'E' | 'L'
export const THEME_RARITY: Record<ThemeRarity, string> = { S: 'Standart', N: 'Sıradan', R: 'Nadir', E: 'Epik', L: 'Efsanevi' }

export type TableTheme = {
  id: string
  cat: ThemeCategory
  name: string
  rarity: ThemeRarity
  felt: string
  ac: string
  ac2: string
  pattern: string | null
  ambient: string | null
}

type Row = [string, ThemeCategory, string, ThemeRarity, string, string, string, string?, string?]

const ROWS: Row[] = [
  ['std1', 'std', 'Klasik Yeşil', 'S', '#145a3a', '#d6b46a', '#0e3a25'],
  ['std2', 'std', 'Gece Mavisi', 'S', '#16305a', '#d6b46a', '#0c1c38'],
  ['std3', 'std', 'Bordo Kulüp', 'S', '#5a1622', '#e0c07a', '#3a0e16'],
  ['std4', 'std', 'Gece Siyahı', 'S', '#1c1d21', '#c9ccd2', '#2a2c31'],
  ['std5', 'std', 'Turnuva Grisi', 'S', '#3a4048', '#e1b94c', '#22262c'],
  ['std6', 'std', 'Kıraathane', 'S', '#4a3020', '#e3c38a', '#2a1a10'],
  ['fan1', 'fan', 'Sarı-Kırmızı Aslanlar', 'L', '#5b1419', '#e3b23c', '#9b1c24', 'halves', 'flare'],
  ['fan2', 'fan', 'Sarı-Lacivert Kanaryalar', 'E', '#11285a', '#f0cc35', '#11285a', 'barsV', 'sweep'],
  ['fan3', 'fan', 'Siyah-Beyaz Kartallar', 'E', '#1b1c1f', '#e9e9e9', '#111214', 'pin', 'flash'],
  ['fan4', 'fan', 'Bordo-Mavi Fırtına', 'R', '#4b1126', '#86c3ec', '#6d1632', 'sash', 'pulse'],
  ['fan5', 'fan', 'Kırmızı-Beyaz Boğalar', 'R', '#3e1013', '#f2f2f2', '#c4161f', 'horns', 'flare'],
  ['fan6', 'fan', 'Yeşil-Beyaz Timsahlar', 'R', '#103d27', '#f0f0f0', '#1d7c49', 'hoopsThin', 'drift'],
  ['fan7', 'fan', 'Beyaz Kraliyet', 'L', '#16223b', '#d7b46a', '#f3f3f3', 'rays', 'spin'],
  ['fan8', 'fan', 'Ay-Yıldız Milli', 'L', '#b00f1d', '#ffffff', '#e30a17', 'flag', 'wave'],
  ['hero1', 'hero', 'Gece Bekçisi', 'L', '#14181f', '#d8b24c', '#2b3039', 'grid', 'search'],
  ['hero2', 'hero', 'Ağ Örücü', 'E', '#142f68', '#d63c41', '#142f68', 'web', 'pulse'],
  ['hero3', 'hero', 'Demir Zırh', 'E', '#3b1012', '#e2ae4b', '#8c1c1c', 'hex', 'reactor'],
  ['hero4', 'hero', 'Gök Gürültüsü', 'R', '#1a2332', '#a2cdf0', '#b83a2c', 'bolt', 'flash'],
  ['hero5', 'hero', 'Yeşil Dev', 'R', '#1d3316', '#92d85e', '#4c2b6c', 'scales', 'pulse'],
  ['hero6', 'hero', 'Kalkan Kaptan', 'R', '#16295a', '#e6e9ef', '#b3212b', 'rings', 'spin'],
  ['hero7', 'hero', 'Amazon Prensesi', 'E', '#571417', '#e3b558', '#1e3b7b', 'rays', 'sweep'],
  ['hero8', 'hero', 'Buz Kraliçesi', 'L', '#123050', '#c3e5fa', '#e9f4fb', 'frost', 'twinkle'],
  ['car1', 'car', 'Tokyo Drift', 'L', '#1b1d24', '#ea4a70', '#e9e9ee', 'speed', 'neon'],
  ['car2', 'car', 'Çöl Canavarı', 'E', '#3a2517', '#e08b3d', '#262626', 'topo', 'heat'],
  ['car3', 'car', 'Neon Tuner', 'E', '#17142d', '#aa78ff', '#43d2e6', 'synth', 'neon'],
  ['car4', 'car', 'Orman Rallisi', 'R', '#13306a', '#efcb3b', '#f4f4f4', 'chev', 'sweep'],
  ['car5', 'car', 'Hiper Turuncu', 'E', '#19191d', '#ff8b22', '#2c2c30', 'race', 'pulse'],
  ['car6', 'car', 'Modifiye Şahin', 'R', '#2a2f36', '#d9d9de', '#c2202a', 'carbonX', 'sweep'],
  ['car7', 'car', 'Çamur Kralı', 'N', '#3a2c1d', '#c9a35a', '#5b4630', 'tread'],
  ['car8', 'car', 'Gece Pisti', 'L', '#0f1420', '#4fd2ff', '#e8eef6', 'check', 'head'],
  ['nat1', 'nat', 'Savan Kralı', 'E', '#4a3317', '#e0b25a', '#7a4b1c', 'grass', 'heat'],
  ['nat2', 'nat', 'Ay Kurdu', 'L', '#151b2a', '#c9d4e6', '#3b4a66', 'moon', 'moon'],
  ['nat3', 'nat', 'Dağ Kartalı', 'R', '#2d3330', '#d9c08a', '#5a4a30', 'chev', 'drift'],
  ['nat4', 'nat', 'Orman Kaplanı', 'E', '#14321f', '#e39a3c', '#1d1d1d', 'tiger', 'sweep'],
  ['nat5', 'nat', 'Derin Mavi', 'R', '#0d2b45', '#6fd0e6', '#0b3a5c', 'waves', 'caustic'],
  ['nat6', 'nat', 'Kuzey Işıkları', 'L', '#0f1d2b', '#7ee6b6', '#6a7bff', 'aurora', 'aurora'],
  ['nat7', 'nat', 'Bambu Pandası', 'N', '#1f3a24', '#d8e7c6', '#1b1b1b', 'bamboo'],
  ['nat8', 'nat', 'Mercan Resifi', 'R', '#0f3a4a', '#ff8c73', '#2bb3b0', 'dots', 'caustic'],
]

export const TABLE_THEMES: TableTheme[] = ROWS.map(([id, cat, name, rarity, felt, ac, ac2, pattern, ambient]) => ({
  id,
  cat,
  name,
  rarity,
  felt,
  ac,
  ac2,
  pattern: pattern ?? null,
  ambient: ambient ?? null,
}))

const BY_ID = new Map(TABLE_THEMES.map((t) => [t.id, t]))
export const getTableTheme = (id: string | null | undefined) => (id ? BY_ID.get(id) ?? null : null)
export const isThemeId = (id: unknown): id is string => typeof id === 'string' && BY_ID.has(id)

export const arenaThemeGame = (game: string): ThemeGame | null =>
  game === 'okey101' ? '101' : game === 'okey' || game === 'tavla' || game === 'bilardo' || game === 'batak' ? game : null

export type ThemeSource = 'free' | 'shop' | 'task'
export const THEME_SOURCE: Record<ThemeSource, string> = { free: 'Ücretsiz', shop: 'Mağaza', task: 'Görev ödülü' }
export const RARITY_PRICE: Record<ThemeRarity, number> = { S: 0, N: 500, R: 1000, E: 1750, L: 3000 }
export const RARITY_RANK: Record<ThemeRarity, number> = { S: 0, N: 1, R: 2, E: 3, L: 4 }
export const TASK_THEME_IDS = ['car7', 'nat3', 'hero4', 'hero2', 'nat4', 'hero8', 'nat6', 'car8', 'nat5']
export const MAX_THEME_LEVEL = 21
const BASE_LEVEL: Record<ThemeRarity, number> = { S: 1, N: 3, R: 5, E: 8, L: 11 }

export type ThemeOffer = { id: string; source: ThemeSource; price: number; minLevel: number; active: boolean }

/** Defaults the panel can override: Düz Masa is free, a few themes are task-only, the rest sell by rarity. */
export const DEFAULT_OFFERS: Record<string, ThemeOffer> = (() => {
  const seen = new Map<string, number>()
  const out: Record<string, ThemeOffer> = {}
  for (const t of TABLE_THEMES) {
    const key = `${t.cat}:${t.rarity}`
    const n = seen.get(key) ?? 0
    seen.set(key, n + 1)
    const source: ThemeSource = t.cat === 'std' ? 'free' : TASK_THEME_IDS.includes(t.id) ? 'task' : 'shop'
    const level = t.cat === 'std' ? n + 1 : BASE_LEVEL[t.rarity] + n + (source === 'task' ? 1 : 0)
    out[t.id] = { id: t.id, source, price: source === 'shop' ? RARITY_PRICE[t.rarity] : 0, minLevel: Math.min(MAX_THEME_LEVEL, level), active: true }
  }
  return out
})()

export type ThemeLock = { kind: 'shop'; price: number } | { kind: 'task' } | { kind: 'off' } | { kind: 'level'; level: number }

/** Why a member can't use a theme yet (null = usable). Owned themes stay usable even if the shop pulls them. */
export function themeLock(offer: ThemeOffer | undefined, owned: boolean, level: number): ThemeLock | null {
  if (!offer) return { kind: 'off' }
  if (!owned && offer.source !== 'free') {
    if (offer.source === 'task') return { kind: 'task' }
    return offer.active ? { kind: 'shop', price: offer.price } : { kind: 'off' }
  }
  if (!owned && !offer.active) return { kind: 'off' }
  if (level < offer.minLevel) return { kind: 'level', level: offer.minLevel }
  return null
}

export type ThemeState = {
  picks: Partial<Record<ThemeGame, string>>
  owned: string[]
  level: number
  levelNames: string[]
  catalog: Record<string, ThemeOffer>
  signedIn: boolean
}

export const themeArt = (t: TableTheme) => (t.cat === 'hero' || t.cat === 'car' || t.cat === 'nat' ? `/images/table-themes/art-${t.id}.webp` : null)
export const themeLogo = (t: TableTheme) => (t.cat === 'fan' ? `/images/table-themes/logo-${t.id}.webp` : null)

const hex = (h: string) => {
  const s = h.replace('#', '')
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16))
}
const toHex = (a: number[]) => '#' + a.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')
export const mixHex = (a: string, b: string, t: number) => {
  const A = hex(a)
  const B = hex(b)
  return toHex(A.map((v, i) => v * (1 - t) + B[i] * t))
}
export const rgba = (c: string, a: number) => {
  const [r, g, b] = hex(c)
  return `rgba(${r},${g},${b},${a})`
}
const luminance = (h: string) => {
  const c = hex(h).map((v) => {
    v /= 255
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}
const contrast = (a: string, b: string) => {
  const x = luminance(a)
  const y = luminance(b)
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}
export const bestContrast = (bg: string, cands: string[]) => cands.slice().sort((p, q) => contrast(bg, q) - contrast(bg, p))[0]

/** CSS custom properties consumed by the `[data-tt]` overrides in globals.css. */
export function themeVars(t: TableTheme): CSSProperties {
  return {
    '--tt-felt': t.felt,
    '--tt-felt-hi': mixHex(t.felt, '#ffffff', 0.12),
    '--tt-felt-lo': mixHex(t.felt, '#000000', 0.42),
    '--tt-ac': t.ac,
    '--tt-ac2': t.ac2,
    '--tt-ink': bestContrast(t.ac, ['#14110e', '#ffffff']),
  } as CSSProperties
}

/** Felt print for each theme, mirroring the approved preview (cqw units, sized against the decor container). */
export function patternCSS(t: TableTheme): string {
  const a = t.ac
  const b = t.ac2
  const A = rgba
  switch (t.pattern) {
    case 'halves': return `linear-gradient(90deg,${A(a, .13)} 0,${A(a, .05)} 38%,transparent 62%),linear-gradient(90deg,transparent 40%,${A(b, .12)} 100%)`
    case 'barsV': return `repeating-linear-gradient(90deg,${A(a, .16)} 0 3cqw,${A(b, .22)} 3cqw 6cqw)`
    case 'pin': return `repeating-linear-gradient(90deg,${A(a, .18)} 0 .35cqw,transparent .35cqw 3.4cqw)`
    case 'sash': return `linear-gradient(118deg,transparent 34%,${A(a, .24)} 34% 44%,${A(b, .32)} 44% 54%,transparent 54%)`
    case 'hoopsThin': return `repeating-linear-gradient(0deg,${A(a, .16)} 0 .45cqw,transparent .45cqw 2.4cqw)`
    case 'horns': return `repeating-linear-gradient(0deg,${A(b, .2)} 0 2.6cqw,${A(a, .07)} 2.6cqw 5.2cqw),radial-gradient(120% 60% at 50% 0,${A(a, .12)},transparent 60%)`
    case 'flag': return `repeating-linear-gradient(100deg,rgba(255,255,255,.05) 0 4cqw,rgba(0,0,0,.08) 4cqw 8cqw),radial-gradient(70% 90% at 35% 45%,rgba(255,255,255,.12),transparent 70%)`
    case 'rays': return `repeating-conic-gradient(from 0deg at 50% 42%,${A(a, .13)} 0 5deg,transparent 5deg 15deg)`
    case 'grid': return `linear-gradient(${A(a, .14)} 1px,transparent 1px) 0 0/3cqw 3cqw,linear-gradient(90deg,${A(a, .14)} 1px,transparent 1px) 0 0/3cqw 3cqw`
    case 'web': return `repeating-radial-gradient(circle at 50% 42%,transparent 0 2.6cqw,${A(a, .24)} 2.6cqw 2.75cqw),repeating-conic-gradient(from 0deg at 50% 42%,${A(a, .22)} 0 .5deg,transparent .5deg 22.5deg)`
    case 'hex': return `radial-gradient(circle at 50% 0,transparent 1.2cqw,${A(a, .18)} 1.25cqw 1.4cqw,transparent 1.45cqw) 0 0/2.8cqw 2.4cqw,radial-gradient(circle at 50% 100%,transparent 1.2cqw,${A(a, .18)} 1.25cqw 1.4cqw,transparent 1.45cqw) 1.4cqw 1.2cqw/2.8cqw 2.4cqw`
    case 'bolt': return `repeating-linear-gradient(60deg,transparent 0 3cqw,${A(a, .18)} 3cqw 3.3cqw),repeating-linear-gradient(-60deg,transparent 0 3cqw,${A(b, .16)} 3cqw 3.3cqw)`
    case 'scales': return `radial-gradient(circle at 50% 100%,transparent 1.1cqw,${A(a, .2)} 1.15cqw 1.32cqw,transparent 1.37cqw) 0 0/2.6cqw 1.3cqw`
    case 'rings': return `repeating-radial-gradient(circle at 50% 42%,${A(a, .16)} 0 .5cqw,transparent .5cqw 3cqw)`
    case 'frost': return `repeating-linear-gradient(45deg,${A(a, .16)} 0 1px,transparent 1px 2.2cqw),repeating-linear-gradient(-45deg,${A(a, .16)} 0 1px,transparent 1px 2.2cqw)`
    case 'speed': return `repeating-linear-gradient(0deg,transparent 0 2.6cqw,${A(a, .18)} 2.6cqw 2.75cqw),linear-gradient(90deg,${A(a, .14)},transparent 45%)`
    case 'topo': return `repeating-radial-gradient(ellipse 140% 60% at 30% 120%,transparent 0 2cqw,${A(a, .18)} 2cqw 2.25cqw)`
    case 'synth': return `linear-gradient(${A(a, .24)} 1px,transparent 1px) 0 0/100% 3cqw,linear-gradient(90deg,${A(b, .22)} 1px,transparent 1px) 0 0/4cqw 100%`
    case 'chev': return `linear-gradient(135deg,${A(a, .15)} 25%,transparent 25%) -1.5cqw 0/3cqw 3cqw,linear-gradient(225deg,${A(a, .15)} 25%,transparent 25%) -1.5cqw 0/3cqw 3cqw`
    case 'race': return `linear-gradient(90deg,transparent 41%,${A(a, .34)} 41% 46%,transparent 46% 54%,${A(a, .34)} 54% 59%,transparent 59%)`
    case 'carbonX': return `repeating-linear-gradient(45deg,${A(a, .09)} 0 .6cqw,transparent .6cqw 1.2cqw),repeating-linear-gradient(-45deg,${A(b, .09)} 0 .6cqw,transparent .6cqw 1.2cqw)`
    case 'tread': return `repeating-linear-gradient(60deg,${A(a, .16)} 0 1cqw,transparent 1cqw 2.4cqw),repeating-linear-gradient(-60deg,${A(a, .11)} 0 1cqw,transparent 1cqw 2.4cqw)`
    case 'check': return `conic-gradient(${A(b, .12)} 25%,transparent 0 50%,${A(b, .12)} 0 75%,transparent 0) 0 0/2.4cqw 2.4cqw`
    case 'grass': return `repeating-linear-gradient(80deg,transparent 0 1.4cqw,${A(a, .13)} 1.4cqw 1.6cqw),linear-gradient(0deg,${A(b, .3)},transparent 45%)`
    case 'moon': return `radial-gradient(circle at 80% 22%,${A(a, .34)} 0 4cqw,${A(a, .1)} 4.2cqw 9cqw,transparent 16cqw)`
    case 'tiger': return `repeating-linear-gradient(105deg,transparent 0 3cqw,${A(b, .4)} 3cqw 3.8cqw,transparent 3.8cqw 5.5cqw,${A(b, .26)} 5.5cqw 5.9cqw)`
    case 'waves': return `repeating-radial-gradient(ellipse 50% 30% at 50% 110%,transparent 0 1.8cqw,${A(a, .18)} 1.8cqw 2cqw)`
    case 'aurora': return `linear-gradient(170deg,transparent 15%,${A(a, .24)} 28%,transparent 40%,${A(b, .22)} 52%,transparent 66%)`
    case 'bamboo': return `repeating-linear-gradient(90deg,transparent 0 4cqw,${A(a, .15)} 4cqw 4.8cqw),repeating-linear-gradient(0deg,transparent 0 6cqw,${A(a, .18)} 6cqw 6.25cqw)`
    case 'dots': return `radial-gradient(circle,${A(a, .3)} 0 .35cqw,transparent .4cqw) 0 0/2.6cqw 2.6cqw,radial-gradient(circle,${A(b, .3)} 0 .25cqw,transparent .3cqw) 1.3cqw 1.3cqw/2.6cqw 2.6cqw`
    default: return 'none'
  }
}
