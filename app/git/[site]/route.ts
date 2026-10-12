import { NextResponse, type NextRequest } from 'next/server'
import { publicSiteById, sponsorTarget } from '@/lib/sites'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: Promise<{ site: string }> }) {
  const { site } = await params
  const listed = await publicSiteById(site).catch(() => null)
  if (!listed) return NextResponse.redirect(new URL('/sponsorlar', request.url))
  const href = await sponsorTarget(site).catch(() => null)
  if (!href) return NextResponse.redirect(new URL(`/siteler/${site}`, request.url))

  const src = request.nextUrl.searchParams.get('src') ?? request.cookies.get('alk_src')?.value ?? 'direkt'
  const target = new URL(href)
  if (!target.searchParams.has('utm_source')) {
    target.searchParams.set('utm_source', 'alkanka')
    target.searchParams.set('utm_medium', src.replace(/[^a-z0-9_-]/gi, '').slice(0, 32) || 'direkt')
  }
  const res = NextResponse.redirect(target, 302)
  res.headers.set('X-Robots-Tag', 'noindex, nofollow')
  return res
}
