/** `kampanya` covers both sponsor campaigns and sponsor bonuses: they share the `/kampanyalar/[id]` page. */
export type RecordKind = 'turnuva' | 'tahmin' | 'market' | 'kampanya'

const BASE: Record<RecordKind, string> = { turnuva: '/turnuvalar', tahmin: '/tahminler', market: '/market', kampanya: '/kampanyalar' }
const CODE: Record<RecordKind, string> = { turnuva: 'turnuva', tahmin: 'mac', market: 'urun', kampanya: 'kampanya' }

/** Tournaments and league matches are numbered; products, campaigns and bonuses carry a text id. */
export const hasNumericId = (kind: RecordKind) => kind === 'turnuva' || kind === 'tahmin'

export const isRecordKind = (value: unknown): value is RecordKind => typeof value === 'string' && value in BASE

/** The record's own page on the site. */
export function recordPath(kind: RecordKind, id: string | number) {
  return `${BASE[kind]}/${encodeURIComponent(String(id))}`
}

/** What its short link is called, before a number is added for a taken code. Kept short so the number still fits. */
export function recordCodeBase(kind: RecordKind, id: string | number) {
  const tail = String(id)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${CODE[kind]}-${tail}`.slice(0, 28).replace(/-+$/, '')
}

export const TOURNAMENT_FILTER_PARAM = 'durum'
export const LEAGUE_TAB_PARAM = 'sekme'
export const MARKET_KIND_PARAM = 'tur'
