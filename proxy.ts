import { NextResponse, type NextRequest } from 'next/server'

/** First-touch attribution: ?src=sms or ?utm_source=mail on any landing is kept for 30 days. */
export function proxy(request: NextRequest) {
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
  matcher: ['/((?!api|git|_next/static|_next/image|images|favicon|sw.js|manifest|.*\\.(?:png|jpg|jpeg|svg|webp|gif|ico)$).*)'],
}
