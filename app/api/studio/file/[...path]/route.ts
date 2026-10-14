import { get } from '@vercel/blob'
import { NextResponse, type NextRequest } from 'next/server'
import { canPanel } from '@/lib/admin-auth'

export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  if (!(await canPanel('studio'))) return new NextResponse('Unauthorized', { status: 401 })
  const { path } = await params
  if (path.length !== 2 || !path.every((p) => /^[a-z0-9._-]+$/i.test(p))) return new NextResponse('Not found', { status: 404 })

  try {
    const result = await get(`studio/${path.join('/')}`, {
      access: 'private',
      ifNoneMatch: request.headers.get('if-none-match') ?? undefined,
    })
    if (!result) return new NextResponse('Not found', { status: 404 })
    const headers: Record<string, string> = { ETag: result.blob.etag, 'Cache-Control': 'private, max-age=31536000, immutable' }
    if (result.statusCode === 304) return new NextResponse(null, { status: 304, headers })
    if (request.nextUrl.searchParams.has('download')) {
      headers['Content-Disposition'] = `attachment; filename="alkanka-${path[1]}"`
    }
    return new NextResponse(result.stream, {
      headers: {
        ...headers,
        'Content-Type': result.blob.contentType,
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      },
    })
  } catch (error) {
    console.error('Studio file fetch failed:', error)
    return new NextResponse('Not found', { status: 404 })
  }
}
