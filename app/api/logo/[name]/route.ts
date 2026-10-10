import { get } from '@vercel/blob'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params
  if (!/^[a-z0-9._-]+$/i.test(name)) return new NextResponse('Not found', { status: 404 })

  try {
    const result = await get(`logos/${name}`, {
      access: 'private',
      ifNoneMatch: request.headers.get('if-none-match') ?? undefined,
    })
    if (!result) return new NextResponse('Not found', { status: 404 })

    // Logos are public site content and each upload gets a unique name, so they can be cached long-term.
    const headers = {
      ETag: result.blob.etag,
      'Cache-Control': 'public, max-age=31536000, immutable',
    }
    if (result.statusCode === 304) return new NextResponse(null, { status: 304, headers })

    return new NextResponse(result.stream, {
      headers: {
        ...headers,
        'Content-Type': result.blob.contentType,
        'X-Content-Type-Options': 'nosniff',
        // SVGs may contain scripts; this keeps them inert when opened directly.
        'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      },
    })
  } catch (error) {
    console.error('Logo fetch failed:', error)
    return new NextResponse('Not found', { status: 404 })
  }
}
