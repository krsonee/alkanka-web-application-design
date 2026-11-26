/** When a sponsor link may have its host swapped ("follow"). Shared by the panel form and the server. */

export function hostOfUrl(value: string) {
  try {
    return new URL(value.trim()).host.toLowerCase()
  } catch {
    return ''
  }
}

function bare(host: string) {
  return host.trim().toLowerCase().replace(/^www\./, '')
}

export function sameSite(a: string, b: string) {
  return Boolean(a) && Boolean(b) && bare(a) === bare(b)
}

/**
 * "follow" keeps a link's path and puts the sponsor's current host in front of it. That only works for a
 * link issued on the sponsor's own site: the same path on a tracking domain (go.aff.…) does not exist there.
 * Returns why the link cannot be followed, or null when it can.
 */
export function followFault(affUrl: string, currentHost: string | null) {
  const affHost = hostOfUrl(affUrl)
  if (!affHost) return null
  if (!currentHost) return 'Sponsorun güncel adresi girilmemiş. Önce giriş adresini gir ya da “Linki aynen kullan” seç.'
  if (sameSite(affHost, currentHost)) return null
  return `Bu link sponsorun sitesinde değil, ayrı bir takip adresinde (${affHost}; sponsorun adresi ${bare(currentHost)}). Alan adı değiştirilirse açılmaz: “Linki aynen kullan” seç.`
}
