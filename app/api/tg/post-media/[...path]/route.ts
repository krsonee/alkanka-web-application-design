import { get } from '@vercel/blob'
import { NextResponse, type NextRequest } from 'next/server'
import { canPanel } from '@/lib/admin-auth'
import { MEDIA_PATH } from '@/lib/tg-posts-shared'

/** Shows post media to panel staff only; the files themselves stay private in Blob. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  if (!(await canPanel('telegram'))) return new NextResponse('Unauthorized', { status: 401 })
  const pathname = (await params).path.join('/')
  if (!MEDIA_PATH.test(pathname) || pathname.includes('..')) return new NextResponse('Not found', { status: 404 })

  try {
    const result = await get(pathname, { access: 'private', ifNoneMatch: request.headers.get('if-none-match') ?? undefined })
    if (!result) return new NextResponse('Not found', { status: 404 })
    const headers = { ETag: result.blob.etag, 'Cache-Control': 'private, max-age=31536000, immutable' }
    if (result.statusCode === 304) return new NextResponse(null, { status: 304, headers })
    return new NextResponse(result.stream, {
      headers: {
        ...headers,
        'Content-Type': result.blob.contentType,
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      },
    })
  } catch (error) {
    console.error('[tg-post-media]', error)
    return new NextResponse('Not found', { status: 404 })
  }
}
