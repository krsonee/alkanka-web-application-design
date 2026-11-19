import { NextResponse, type NextRequest } from 'next/server'
import { hitByCode } from '@/lib/aff-links'
import { hitCampaign } from '@/lib/marketing'
import { BOT_UA } from '@/lib/marketing-shared'
import { getMember } from '@/lib/member'
import { SITE_URL } from '@/lib/seo'

export const dynamic = 'force-dynamic'

function sealed(res: NextResponse) {
  res.headers.set('X-Robots-Tag', 'noindex, nofollow')
  res.headers.set('Cache-Control', 'no-store')
  return res
}

/**
 * One resolver for every short code, whatever its kind: sponsor/outside links first, then campaign links.
 * The short link domain rewrites /{code} here (proxy.ts) and marks the request with x-alk-short.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const onShortDomain = request.headers.get('x-alk-short') === '1'
  const ip = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip')
  const isBot = BOT_UA.test(request.headers.get('user-agent') ?? '')
  const member = onShortDomain ? null : await getMember().catch(() => null)
  const src = request.nextUrl.searchParams.get('src') ?? request.cookies.get('alk_src')?.value ?? 'direkt'

  const aff = await hitByCode(code, { src, userId: member?.id ?? null, ip, bot: isBot }).catch((error) => {
    console.error('[l] kısa link çözülemedi', error)
    return null
  })
  if (aff) return sealed(NextResponse.redirect(aff.target, 302))

  const hit = await hitCampaign(code, ip, isBot).catch((error) => {
    console.error('[l] kampanya çözülemedi', error)
    return null
  })
  if (hit) {
    const target = new URL(hit.target, onShortDomain ? SITE_URL : request.url)
    target.searchParams.set('src', hit.code)
    target.searchParams.set('utm_source', hit.channel)
    target.searchParams.set('utm_medium', 'kampanya')
    target.searchParams.set('utm_campaign', hit.code)
    const res = NextResponse.redirect(target, 302)
    // A cookie set on the short domain never reaches the site; there the ?src= on the landing URL does the job.
    if (!onShortDomain && !request.cookies.get('alk_src')) {
      res.cookies.set('alk_src', hit.code, { maxAge: 60 * 60 * 24 * 30, path: '/', sameSite: 'lax', secure: true, httpOnly: true })
    }
    return sealed(res)
  }

  // Not a code: on the short domain it may be a site page typed on the wrong host.
  const fallback = onShortDomain ? new URL(`/${encodeURIComponent(code)}`, SITE_URL) : new URL('/', request.url)
  return sealed(NextResponse.redirect(fallback, 302))
}
