export type LinkKind = 'sponsor' | 'sayfa' | 'dis' | 'git'

export const LINK_KINDS: { id: LinkKind; label: string; hint: string }[] = [
  { id: 'sponsor', label: 'Sponsor linki', hint: 'Sponsorun verdiği affiliate linki, bizim kısa adresimizin arkasında' },
  { id: 'sayfa', label: 'Kendi sayfamız', hint: 'Sitemizin bir sayfasına getiren kampanya linki' },
  { id: 'dis', label: 'Dış link', hint: 'Sponsora bağlı olmayan, başka bir adrese giden kısa link' },
  { id: 'git', label: 'Git düğmesi', hint: 'Sitedeki sponsor kartlarında duran "Git" düğmesi' },
]

export const linkKindLabel = (kind: LinkKind) => LINK_KINDS.find((k) => k.id === kind)?.label ?? kind

export type LinkRow = {
  key: string
  kind: LinkKind
  code: string
  path: string
  name: string
  target: string | null
  siteId: number | null
  siteName: string | null
  source: string
  active: boolean
  clicks: number
  uniques: number
  /** Git düğmesi tıklamalarında ağ izi tutulmaz: tekil sayı sadece giriş yapmış üyelerden gelir. */
  uniqueBasis: 'ziyaretci' | 'uye'
  /** Kayıt sadece kendi sayfamıza getiren linklerde ölçülür; diğerlerinde null. */
  signups: number | null
  lastClick: string | null
  /** Aynı kod hem sponsor/dış linkte hem kampanya linkinde var. */
  clash: boolean
  note: string | null
}

export type LinkReport = { from: string; to: string; siteId: number | null; shortDomain: string; rows: LinkRow[] }

/** One sponsor's affiliate earnings in one currency, all periods together; rejected records are left out. */
export type SiteEarning = { siteId: number; currency: string; pending: number; claimed: number; paid: number }

export function earningsBySite(list: { siteId: number; currency: string; status: 'pending' | 'claimed' | 'paid' | 'rejected'; amount: number }[]): SiteEarning[] {
  const out = new Map<string, SiteEarning>()
  for (const e of list) {
    if (e.status === 'rejected') continue
    const key = `${e.siteId}:${e.currency}`
    const row = out.get(key) ?? { siteId: e.siteId, currency: e.currency, pending: 0, claimed: 0, paid: 0 }
    row[e.status] += e.amount
    out.set(key, row)
  }
  return [...out.values()]
}

export const LINK_RANGES = [
  { id: '1', label: 'Bugün', days: 1 },
  { id: '7', label: 'Son 7 gün', days: 7 },
  { id: '30', label: 'Son 30 gün', days: 30 },
  { id: '90', label: 'Son 90 gün', days: 90 },
] as const

const MAIN_HOSTS = new Set(['alkanka.com', 'www.alkanka.com', 'alkanka.shop', 'www.alkanka.shop'])

/** Empty string clears the setting. Throws a readable message on anything that is not a bare host name. */
export function cleanShortDomain(value: string) {
  const host = value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/+$/, '')
  if (!host) return ''
  if (host.length > 120 || !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/.test(host)) {
    throw new Error('Sadece alan adını yaz, örneğin alk.link (https:// ve / olmadan).')
  }
  if (MAIN_HOSTS.has(host)) throw new Error('Bu alan adı sitenin ya da panelin kendi adresi. Kısa linkler için ayrı bir alan adı gerekir.')
  if (host.endsWith('.vercel.app')) throw new Error('vercel.app adresi kısa link alan adı olamaz. Kendi alan adını yaz.')
  return host
}

/** proxy.ts never sees paths that start like this (its matcher skips them), so such a code cannot sit at the root. */
const ROOT_BLOCKED = /^(api|git|images|favicon|manifest)/

/** The address people actually share. On the short domain the code sits at the root: alk.link/kod */
export function shortUrl(row: Pick<LinkRow, 'kind' | 'code' | 'path' | 'clash'>, siteUrl: string, shortDomain: string) {
  if (shortDomain && row.kind !== 'git') {
    const needsPrefix = ROOT_BLOCKED.test(row.code) || (row.kind === 'sayfa' && row.clash)
    return needsPrefix ? `https://${shortDomain}${row.path}` : `https://${shortDomain}/${row.code}`
  }
  return `${siteUrl.replace(/\/+$/, '')}${row.path}`
}

function cell(value: string | number | null) {
  let text = value === null ? '' : String(value)
  // A cell starting with = + - @ runs as a formula in Excel.
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return `"${text.replace(/"/g, '""')}"`
}

/** Semicolon separated with a BOM: opens in Turkish Excel with the right columns and letters. */
export function linksCsv(rows: LinkRow[], siteUrl: string, shortDomain: string) {
  const head = ['Tür', 'Ad', 'Kısa link', 'Hedef', 'Sponsor', 'Kaynak', 'Durum', 'Tıklama', 'Tekil', 'Tekil ölçümü', 'Kayıt', 'Son tıklama']
  const lines = rows.map((r) =>
    [
      linkKindLabel(r.kind),
      r.name,
      shortUrl(r, siteUrl, shortDomain),
      r.target,
      r.siteName,
      r.source,
      r.active ? 'Açık' : 'Kapalı',
      r.clicks,
      r.uniques,
      r.uniqueBasis === 'uye' ? 'Sadece üyeler' : 'Ziyaretçi',
      r.signups,
      r.lastClick,
    ]
      .map(cell)
      .join(';'),
  )
  return `\uFEFF${[head.map(cell).join(';'), ...lines].join('\r\n')}\r\n`
}
