import { NextResponse, type NextRequest } from 'next/server'
import { getSiteLink, isSponsor, logClick } from '@/lib/growth'
import { getMember } from '@/lib/member'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: Promise<{ site: string }> }) {
  const { site } = await params
  if (!isSponsor(site)) return NextResponse.redirect(new URL('/sponsorlar', request.url))

  const src = request.nextUrl.searchParams.get('src') ?? request.cookies.get('alk_src')?.value ?? 'direkt'
  const [link, member] = await Promise.all([getSiteLink(site).catch(() => null), getMember()])
  if (!link) return NextResponse.redirect(new URL(`/siteler/${site}`, request.url))

  await logClick(site, src, member?.id ?? null).catch((error) => console.error('[git] tıklama kaydedilemedi', error))

  const target = new URL(link.url)
  if (!target.searchParams.has('utm_source')) {
    target.searchParams.set('utm_source', 'alkanka')
    target.searchParams.set('utm_medium', src.replace(/[^a-z0-9_-]/gi, '').slice(0, 32) || 'direkt')
  }
  const res = NextResponse.redirect(target, 302)
  res.headers.set('X-Robots-Tag', 'noindex, nofollow')
  return res
}
