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

/** First-touch attribution: ?src=sms or ?utm_source=mail on any landing is kept for 30 days. */
export function proxy(request: NextRequest) {
  const routed = routeByHost(request)
  if (routed) return routed

  const params = request.nextUrl.searchParams
  const raw = params.get('src') ?? params.get('utm_source')
  const res = NextResponse.next()
  if (raw && !request.cookies.get('alk_src')) {
    const src = raw.toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 32)
    if (src) res.cookies.set('alk_src', src, { maxAge: 60 * 60 * 24 * 30, path: '/', sameSite: 'lax', secure: true, httpOnly: true })
  }
  return res
}

export const config = {
  matcher: ['/((?!api|git|r/|_next/static|_next/image|images|favicon|sw.js|manifest|.*\\.(?:png|jpg|jpeg|svg|webp|gif|ico)$).*)'],
}
