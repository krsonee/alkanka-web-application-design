import { NextResponse, type NextRequest } from 'next/server'
import { hitPrimaryForSite } from '@/lib/aff-links'
import { getSiteLink, logClick } from '@/lib/growth'
import { getMember } from '@/lib/member'
import { publicSiteById, sponsorTarget } from '@/lib/sites'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: Promise<{ site: string }> }) {
  const { site } = await params
  const listed = await publicSiteById(site).catch(() => null)
  if (!listed) return NextResponse.redirect(new URL('/sponsorlar', request.url))
  const member = await getMember().catch(() => null)
  const src = request.nextUrl.searchParams.get('src') ?? request.cookies.get('alk_src')?.value ?? 'direkt'
  const ip = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip')

  const aff = await hitPrimaryForSite(Number(listed.recordId), { src, userId: member?.id ?? null, ip }).catch(() => null)
  if (aff) {
    await logClick(listed.recordId, src, member?.id ?? null).catch((error) => console.error('[git] tıklama kaydedilemedi', error))
    const res = NextResponse.redirect(aff.target, 302)
    res.headers.set('X-Robots-Tag', 'noindex, nofollow')
    res.headers.set('Cache-Control', 'no-store')
    return res
  }

  const entry = await getSiteLink(listed.id).catch(() => null)
  const href = entry?.url ?? (await sponsorTarget(site).catch(() => null))
  if (!href) return NextResponse.redirect(new URL(`/siteler/${listed.id}`, request.url))

  await logClick(listed.recordId, src, member?.id ?? null).catch((error) => console.error('[git] tıklama kaydedilemedi', error))
  const target = new URL(href)
  if (!target.searchParams.has('utm_source')) {
    target.searchParams.set('utm_source', 'alkanka')
    target.searchParams.set('utm_medium', src.replace(/[^a-z0-9_-]/gi, '').slice(0, 32) || 'direkt')
  }
  const res = NextResponse.redirect(target, 302)
  res.headers.set('X-Robots-Tag', 'noindex, nofollow')
  return res
}
