import { get } from '@vercel/blob'
import { NextResponse, type NextRequest } from 'next/server'
import { getBranding, ICON_SIZES, type IconSize } from '@/lib/branding'

const FALLBACK: Record<IconSize, string> = { 512: '/icon-512.png', 192: '/icon-192.png', 180: '/apple-icon.png' }

export async function GET(request: NextRequest, { params }: { params: Promise<{ size: string }> }) {
  const size = Number((await params).size) as IconSize
  if (!ICON_SIZES.includes(size)) return new NextResponse('Not found', { status: 404 })

  const pathname = (await getBranding()).icons?.[`${size}`]
  if (!pathname) return NextResponse.redirect(new URL(FALLBACK[size], request.url))

  try {
    const result = await get(pathname, { access: 'private', ifNoneMatch: request.headers.get('if-none-match') ?? undefined })
    if (!result) return NextResponse.redirect(new URL(FALLBACK[size], request.url))
    const headers = { ETag: result.blob.etag, 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400' }
    if (result.statusCode === 304) return new NextResponse(null, { status: 304, headers })
    return new NextResponse(result.stream, { headers: { ...headers, 'Content-Type': 'image/png', 'X-Content-Type-Options': 'nosniff' } })
  } catch (error) {
    console.error('App icon fetch failed:', error)
    return NextResponse.redirect(new URL(FALLBACK[size], request.url))
  }
}
