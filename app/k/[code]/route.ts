import { NextResponse, type NextRequest } from 'next/server'
import { hitCampaign } from '@/lib/marketing'
import { BOT_UA } from '@/lib/marketing-shared'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const ip = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip')
  const isBot = BOT_UA.test(request.headers.get('user-agent') ?? '')
  const hit = await hitCampaign(code, ip, isBot).catch((error) => {
    console.error('[k] kampanya çözülemedi', error)
    return null
  })
  if (!hit) return NextResponse.redirect(new URL('/', request.url))

  const target = new URL(hit.target, request.url)
  target.searchParams.set('src', hit.code)
  target.searchParams.set('utm_source', hit.channel)
  target.searchParams.set('utm_medium', 'kampanya')
  target.searchParams.set('utm_campaign', hit.code)

  const res = NextResponse.redirect(target, 302)
  if (!request.cookies.get('alk_src')) {
    res.cookies.set('alk_src', hit.code, { maxAge: 60 * 60 * 24 * 30, path: '/', sameSite: 'lax', secure: true, httpOnly: true })
  }
  res.headers.set('X-Robots-Tag', 'noindex, nofollow')
  res.headers.set('Cache-Control', 'no-store')
  return res
}
