import { neon } from '@neondatabase/serverless'
import { NextResponse, type NextRequest } from 'next/server'

const SITE_ORIGIN = 'https://alkanka.com'
const SITE_HOSTS = new Set(['alkanka.com', 'www.alkanka.com'])
const PANEL_HOST = 'alkanka.shop'
const PANEL_HOSTS = new Set([PANEL_HOST, `www.${PANEL_HOST}`])

const PANEL_ROBOTS = 'User-agent: *\nAllow: /\n'

function isPanelPath(pathname: string) {
  return pathname === '/panel' || pathname.startsWith('/panel/')
}

/** Panel lives only on alkanka.shop; alkanka.com never serves it. Other hosts (previews) are unchanged. */
function routeByHost(request: NextRequest): NextResponse | null {
  const host = (request.headers.get('host') ?? '').split(':')[0].toLowerCase()
  const { pathname, search } = request.nextUrl

  if (PANEL_HOSTS.has(host)) {
    if (host !== PANEL_HOST) return NextResponse.redirect(`https://${PANEL_HOST}${pathname}${search}`, 308)
    // Crawlable on purpose so Google can read the X-Robots-Tag noindex header set in next.config.
    if (pathname === '/robots.txt') return new NextResponse(PANEL_ROBOTS, { headers: { 'Content-Type': 'text/plain' } })
    if (pathname === '/') return NextResponse.rewrite(new URL(`/panel${search}`, request.url))
    if (isPanelPath(pathname)) return null
    return NextResponse.redirect(`${SITE_ORIGIN}${pathname}${search}`, 308)
  }

  if (SITE_HOSTS.has(host) && isPanelPath(pathname)) {
    return NextResponse.rewrite(new URL('/__panel-not-found', request.url))
  }

  return null
}

const SITE_KEY_TTL = 60_000
const siteKeyCache = new Map<string, { ok: boolean; at: number }>()

/** The root loading.tsx streams pages, so a missing sponsor can only get a real 404 status here. Fails open on DB errors. */
async function siteExists(key: string): Promise<boolean> {
  const hit = siteKeyCache.get(key)
  if (hit && Date.now() - hit.at < SITE_KEY_TTL) return hit.ok
  try {
    const query = neon(process.env.DATABASE_URL!)
    const found = /^\d+$/.test(key)
      ? await query`SELECT 1 FROM sites WHERE active AND slug IS NOT NULL AND btrim(slug) <> '' AND (id::text = ${key} OR slug = ${key}) LIMIT 1`
      : await query`SELECT 1 FROM sites WHERE active AND slug = ${key} LIMIT 1`
    const ok = found.length > 0
    if (siteKeyCache.size > 500) siteKeyCache.clear()
    siteKeyCache.set(key, { ok, at: Date.now() })
    return ok
  } catch {
    return true
  }
}

const REDIRECT_TTL = 60_000
let redirectCache: { map: Map<string, string>; at: number } | null = null

/** Panel-managed 301s for renamed/removed URLs. One small table, cached per instance; fails open. */
async function findRedirect(pathname: string): Promise<string | null> {
  if (!process.env.DATABASE_URL) return null
  if (!redirectCache || Date.now() - redirectCache.at > REDIRECT_TTL) {
    try {
      const query = neon(process.env.DATABASE_URL)
      const list = (await query`SELECT from_path, to_path FROM seo_redirects`) as { from_path: string; to_path: string }[]
      redirectCache = { map: new Map(list.map((r) => [r.from_path, r.to_path])), at: Date.now() }
    } catch {
      redirectCache = { map: new Map(), at: Date.now() }
    }
  }
  let path = pathname
  try {
    path = decodeURIComponent(pathname)
  } catch {}
  return redirectCache.map.get(path.replace(/\/+$/, '') || '/') ?? null
}

/** First-touch attribution: ?src=sms or ?utm_source=mail on any landing is kept for 30 days. */
export async function proxy(request: NextRequest) {
  const routed = routeByHost(request)
  if (routed) return routed

  const target = await findRedirect(request.nextUrl.pathname)
  if (target) return NextResponse.redirect(new URL(target, request.url), 301)

  const siteMatch = request.nextUrl.pathname.match(/^\/siteler\/([^/]+)\/?$/)
  if (siteMatch && process.env.DATABASE_URL) {
    const key = decodeURIComponent(siteMatch[1]).slice(0, 120)
    if (!(await siteExists(key))) {
      const headers = new Headers(request.headers)
      headers.set('x-alk-path', request.nextUrl.pathname)
      return NextResponse.rewrite(new URL('/__site-not-found', request.url), { request: { headers } })
    }
  }

  const params = request.nextUrl.searchParams
  const raw = params.get('src') ?? params.get('utm_source')
  const forwarded = new Headers(request.headers)
  forwarded.set('x-alk-path', request.nextUrl.pathname)
  const res = NextResponse.next({ request: { headers: forwarded } })
  if (raw && !request.cookies.get('alk_src')) {
    const src = raw.toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 32)
    if (src) res.cookies.set('alk_src', src, { maxAge: 60 * 60 * 24 * 30, path: '/', sameSite: 'lax', secure: true, httpOnly: true })
  }
  return res
}

export const config = {
  matcher: ['/((?!api|git|r/|_next/static|_next/image|images|favicon|sw.js|manifest|.*\\.(?:png|jpg|jpeg|svg|webp|gif|ico)$).*)'],
}
