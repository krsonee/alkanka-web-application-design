/**
 * Why a model call failed, in words the panel can show. Without this every failure read
 * "tekrar dene", including the ones no retry can fix (an empty AI Gateway balance).
 */
export type StudioFault = 'funds' | 'blocked' | 'busy' | 'slow' | null

type Link = { message?: unknown; statusCode?: unknown; type?: unknown; name?: unknown; responseBody?: unknown; cause?: unknown }

/** The gateway wraps the provider's answer, so the telling detail is often one or two causes deep. */
function chain(error: unknown): Link[] {
  const links: Link[] = []
  let at: unknown = error
  while (at && typeof at === 'object' && links.length < 6) {
    links.push(at as Link)
    at = (at as Link).cause
  }
  return links
}

export function studioFault(error: unknown): StudioFault {
  const links = chain(error)
  // The provider's own words can sit in the raw answer only ("rejected by provider content moderation").
  const raw = (l: Link) => (typeof l.responseBody === 'string' ? l.responseBody.slice(0, 600) : '')
  const text = links.map((l) => `${String(l.message ?? '')} ${String(l.type ?? '')} ${String(l.name ?? '')} ${raw(l)}`).join(' ')
  const codes = links.map((l) => Number(l.statusCode)).filter(Number.isFinite)

  if (codes.includes(402) || /insufficient[_ ](funds|balance|credit)|minimum balance|top up your credits/i.test(text)) return 'funds'
  if (/safety|policy|blocked|refus|moderat|rejected by provider/i.test(text)) return 'blocked'
  if (codes.includes(429) || /rate[_ ]?limit|too many requests|overloaded/i.test(text)) return 'busy'
  // Only the gateway's own answer counts: the converter has timeouts of its own that mean something else.
  if (codes.includes(504) || codes.includes(408) || /gateway time-?out/i.test(text)) return 'slow'
  return null
}

/**
 * `video` marks the calls the gateway only accepts above its minimum balance. Staff are told who
 * to ask; where to top up is the owner's business.
 */
export function faultMessage(fault: StudioFault, opts: { owner: boolean; video: boolean }): string | null {
  if (fault === 'funds') {
    const what = opts.video ? 'Video modeli çalışmadı: Vercel AI Gateway bakiyesi yetersiz' : 'Model çalışmadı: Vercel AI Gateway bakiyesi yetersiz'
    if (!opts.owner) return `${what}. Ana yöneticiye haber ver; kredi yüklenince tekrar dene. Bu denemeden ücret alınmadı.`
    const rule = opts.video ? ' Video üretimi için hesapta en az 10 $ kredi olması gerekiyor.' : ''
    return `${what}.${rule} Vercel → AI Gateway → "Top up" ile kredi yükle, sonra tekrar dene. Bu denemeden ücret alınmadı.`
  }
  if (fault === 'busy') return 'Model şu an çok yoğun. Birkaç dakika sonra tekrar dene.'
  if (fault === 'slow') return 'Model zamanında cevap vermedi. Biraz sonra tekrar dene.'
  return null
}
