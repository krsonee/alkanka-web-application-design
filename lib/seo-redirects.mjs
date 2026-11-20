/**
 * Renamed or mistyped addresses, redirected permanently by next.config (plain .mjs so the config can import it).
 * The panel's broken-address list hides them: a hit logged before the redirect existed is not a problem any more.
 * @type {[source: string, destination: string][]}
 */
export const CODE_REDIRECTS = [
  ['/firsatlar', '/ozel-oranlar'],
  ['/firsatlar/:slug*', '/ozel-oranlar'],
  ['/biletler', '/tahminler'],
  ['/tahmin-ligi', '/tahminler'],
  ['/turnuva', '/turnuvalar'],
  ['/shop', '/market'],
  ['/shop/:path*', '/market'],
  ['/oyunlar/canli', '/oyunlar'],
  ['/oyunlar/sans-carki', '/oyunlar/cark'],
  ['/oyunlar/gizemli-sandik', '/oyunlar/sandik'],
  ['/oyunlar/zar-at', '/oyunlar/zar'],
  ['/oyunlar/jakopoly', '/oyunlar/monopoly'],
]

/** @param {string} path */
export function codeRedirected(path) {
  return CODE_REDIRECTS.some(([source]) => {
    const wildcard = source.indexOf('/:')
    return wildcard === -1 ? source === path : path.startsWith(`${source.slice(0, wildcard)}/`)
  })
}
