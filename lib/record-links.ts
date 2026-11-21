import { slugify } from '@/lib/seo'

/**
 * `kampanya` covers both sponsor campaigns and sponsor bonuses: they share the `/kampanyalar/[id]` page.
 * `lig` is a special prediction league.
 */
export type RecordKind = 'turnuva' | 'tahmin' | 'lig' | 'market' | 'kampanya'

export const LEAGUE_HOME = '/tahminler'
const LEAGUES = `${LEAGUE_HOME}/lig`
const GENERAL_LEAGUE = 'genel'

const BASE: Record<RecordKind, string> = { turnuva: '/turnuvalar', tahmin: LEAGUE_HOME, lig: LEAGUES, market: '/market', kampanya: '/kampanyalar' }
const CODE: Record<RecordKind, string> = { turnuva: 'turnuva', tahmin: 'mac', lig: 'lig', market: 'urun', kampanya: 'kampanya' }

/** Tournaments, league matches and special leagues are numbered; products, campaigns and bonuses carry a text id. */
export const hasNumericId = (kind: RecordKind) => kind === 'turnuva' || kind === 'tahmin' || kind === 'lig'

export const isRecordKind = (value: unknown): value is RecordKind => typeof value === 'string' && value in BASE

/**
 * The record's own page on the site. A special league also wears its name (`/tahminler/lig/3-test-ligi`);
 * the number in front is what finds it, so a renamed league keeps its old links.
 */
export function recordPath(kind: RecordKind, id: string | number, name?: string) {
  const tail = kind === 'lig' && name ? slugify(name) : ''
  return `${BASE[kind]}/${encodeURIComponent(String(id))}${tail ? `-${tail}` : ''}`
}

/** The page of one prediction league; 0 stands for the general league. */
export const leaguePath = (id: number, name?: string) => (id === 0 ? `${LEAGUES}/${GENERAL_LEAGUE}` : recordPath('lig', id, name))

/** Which league the last part of a `/tahminler/lig/...` address names, or null when it names none. */
export function leagueOfPath(segment: string): number | null {
  if (segment === GENERAL_LEAGUE) return 0
  const numbered = /^([1-9]\d{0,9})(?:-|$)/.exec(segment)
  return numbered ? Number(numbered[1]) : null
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
export const LEAGUE_TABLE_PARAM = 'tablo'
export const LEAGUE_SPORT_PARAM = 'spor'
export const MARKET_KIND_PARAM = 'tur'

/** What the league table's periods and the sports are called in an address. */
export const LEAGUE_TABLE_ADDRESS = { week: 'hafta', month: 'ay', all: 'tum' } as const
export const LEAGUE_SPORT_ADDRESS = { football: 'futbol', basketball: 'basketbol', volleyball: 'voleybol', tennis: 'tenis', esports: 'espor' } as const

/** The key an address word stands for, or undefined for a word the map does not know. */
export function fromAddress<K extends string>(map: Record<K, string>, word: string | undefined): K | undefined {
  return (Object.keys(map) as K[]).find((key) => map[key] === word)
}
