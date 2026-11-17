import 'server-only'
import dns from 'node:dns/promises'
import { listSites } from '@/lib/sites'
import type { LinkCheck, SponsorSite } from '@/lib/sites-shared'

const TIMEOUT_MS = 6000
const LOOKUP_MS = 3000
const DEADLINE_MS = 25_000
const PARALLEL = 8
const MAX_SITES = 120
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'

/** Only public https hosts: the address is typed in the panel and must not be a way to probe anything else. */
function publicTarget(raw: string): URL | null {
  try {
    const url = new URL(raw.trim())
    const host = url.hostname.toLowerCase()
    if (url.protocol !== 'https:' || url.username || url.password) return null
    if (!host.includes('.') || host.startsWith('[') || /^[\d.]+$/.test(host)) return null
    if (/(^|\.)(localhost|local|internal|lan|home|corp)$/.test(host)) return null
    return url
  } catch {
    return null
  }
}

/** Loopback, private, link-local and other addresses that are not a site on the open internet. */
export function isPrivateAddress(address: string) {
  const text = address.toLowerCase()
  const mapped = text.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  const v4 = mapped ? mapped[1] : /^\d+\.\d+\.\d+\.\d+$/.test(text) ? text : null
  if (v4) {
    const [a, b] = v4.split('.').map(Number)
    return (
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19))
    )
  }
  return text === '::' || text === '::1' || /^f[cd]/.test(text) || /^fe[89ab]/.test(text) || text.startsWith('::ffff:')
}

/**
 * A public-looking name can still point at a private address. A name that does not resolve is left
 * to the request itself, which reports it as unreachable.
 */
async function pointsInside(host: string) {
  try {
    const found = await Promise.race([
      dns.lookup(host, { all: true }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('lookup timeout')), LOOKUP_MS)),
    ])
    return found.some((entry) => isPrivateAddress(entry.address))
  } catch {
    return false
  }
}

function targetOf(site: SponsorSite) {
  const entry = site.entryUrl.trim()
  const main = site.url.trim()
  return entry && entry !== '#' ? entry : main && main !== '#' ? main : ''
}

function hostMatches(host: string, domain: string) {
  return host === domain || host.endsWith(`.${domain}`)
}

async function checkOne(site: SponsorSite): Promise<LinkCheck> {
  const base = { id: site.id, name: site.name }
  const raw = targetOf(site)
  if (!raw) return { ...base, target: null, state: 'none', code: null, ms: null, note: 'Giriş ya da site adresi girilmemiş; sitedeki buton bir yere gitmiyor.' }
  const url = publicTarget(raw)
  if (!url) return { ...base, target: raw, state: 'none', code: null, ms: null, note: 'Adres https:// ile başlayan açık bir site adresi değil; kontrol edilmedi.' }
  if (await pointsInside(url.hostname)) {
    return { ...base, target: raw, state: 'none', code: null, ms: null, note: 'Bu alan adı açık internetteki bir siteye çıkmıyor; kontrol edilmedi.' }
  }

  const domain = site.domain.trim().toLowerCase()
  const mismatch = domain && !hostMatches(url.hostname.toLowerCase(), domain) ? ` Adres, yazılı alan adıyla (${domain}) uyuşmuyor.` : ''
  const started = Date.now()
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'manual',
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'user-agent': UA, accept: 'text/html,*/*;q=0.8', 'accept-language': 'tr-TR,tr;q=0.9' },
    })
    await res.body?.cancel().catch(() => {})
    const ms = Date.now() - started
    const done = { ...base, target: url.toString(), code: res.status, ms }
    if (res.status >= 200 && res.status < 300) return { ...done, state: 'ok', note: `Açılıyor.${mismatch}`.trim() }
    if (res.status >= 300 && res.status < 400) {
      let to = ''
      try {
        to = new URL(res.headers.get('location') ?? '', url).hostname.toLowerCase()
      } catch {}
      const same = to && (to === url.hostname.toLowerCase() || to === `www.${url.hostname.toLowerCase()}` || `www.${to}` === url.hostname.toLowerCase())
      if (same) return { ...done, state: 'ok', note: `Açılıyor (aynı sitede yönleniyor).${mismatch}` }
      return { ...done, state: 'redirect', note: `${to || 'Başka bir adrese'} yönlendiriyor. Sponsor adres değiştirmiş olabilir; güncel adresi yaz.${mismatch}` }
    }
    if ([401, 403, 406, 429, 451, 503].includes(res.status)) {
      return { ...done, state: 'blocked', note: `Site, sunucumuzdan gelen isteği geri çevirdi (HTTP ${res.status}). Yurt dışını ya da otomatik istekleri engelliyor olabilir; adresi kendi tarayıcından aç.${mismatch}` }
    }
    return { ...done, state: 'down', note: `Sayfa hata veriyor (HTTP ${res.status}).${mismatch}` }
  } catch (error) {
    const ms = Date.now() - started
    const timedOut = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')
    return timedOut
      ? { ...base, target: url.toString(), state: 'timeout', code: null, ms, note: `${TIMEOUT_MS / 1000} saniyede cevap gelmedi. Site yavaş ya da sunucumuza kapalı olabilir; kendi tarayıcından dene.${mismatch}` }
      : { ...base, target: url.toString(), state: 'down', code: null, ms, note: `Adres açılmadı: alan adı bulunamadı ya da bağlantı reddedildi.${mismatch}` }
  }
}

/** Opens each published sponsor's outgoing address once, without following redirects. Nothing is stored. */
export async function checkSiteLinks(): Promise<LinkCheck[]> {
  const sites = (await listSites()).filter((site) => site.active).slice(0, MAX_SITES)
  const out: LinkCheck[] = new Array(sites.length)
  const deadline = Date.now() + DEADLINE_MS
  let next = 0
  async function worker() {
    while (next < sites.length) {
      const i = next
      next += 1
      const site = sites[i]
      out[i] =
        Date.now() > deadline
          ? { id: site.id, name: site.name, target: targetOf(site) || null, state: 'none', code: null, ms: null, note: 'Süre yetmedi; bu sponsor kontrol edilmedi. Tekrar dene.' }
          : await checkOne(site)
    }
  }
  await Promise.all(Array.from({ length: Math.min(PARALLEL, sites.length) }, worker))
  return out
}
