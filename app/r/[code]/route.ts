import { NextResponse, type NextRequest } from 'next/server'
import { hitByCode } from '@/lib/aff-links'
import { getMember } from '@/lib/member'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const member = await getMember().catch(() => null)
  const src = request.nextUrl.searchParams.get('src') ?? request.cookies.get('alk_src')?.value ?? 'direkt'
  const ip = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip')
  const hit = await hitByCode(code, { src, userId: member?.id ?? null, ip }).catch((error) => {
    console.error('[r] kısa link çözülemedi', error)
    return null
  })
  if (!hit) return NextResponse.redirect(new URL('/sponsorlar', request.url))
  const res = NextResponse.redirect(hit.target, 302)
  res.headers.set('X-Robots-Tag', 'noindex, nofollow')
  res.headers.set('Cache-Control', 'no-store')
  return res
}
