import { NextResponse, type NextRequest } from 'next/server'
import { getSiteLink, isSponsor, logClick } from '@/lib/growth'
import { sponsorTarget } from '@/lib/sponsor-catalog'
import { getMember } from '@/lib/member'
import { SITE_URL } from '@/lib/seo'

function internal(path: string) {
  return new URL(path, `${SITE_URL}/`)
}

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: Promise<{ site: string }> }) {
  const { site } = await params
  if (!(await isSponsor(site))) return NextResponse.redirect(internal('/sponsorlar'))

  const src = request.nextUrl.searchParams.get('src') ?? request.cookies.get('alk_src')?.value ?? 'direkt'
  const [override, listed, member] = await Promise.all([
    getSiteLink(site).catch(() => null),
    sponsorTarget(site),
    getMember(),
  ])
  const href = override?.url || listed
  if (!href) return NextResponse.redirect(internal(`/siteler/${site}`))

  await logClick(site, src, member?.id ?? null).catch((error) => console.error('[git] tıklama kaydedilemedi', error))

  const target = new URL(href)
  if (!target.searchParams.has('utm_source')) {
    target.searchParams.set('utm_source', 'alkanka')
    target.searchParams.set('utm_medium', src.replace(/[^a-z0-9_-]/gi, '').slice(0, 32) || 'direkt')
  }
  const res = NextResponse.redirect(target, 302)
  res.headers.set('X-Robots-Tag', 'noindex, nofollow')
  return res
}
