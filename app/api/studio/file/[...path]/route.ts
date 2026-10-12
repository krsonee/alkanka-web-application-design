import { readFile } from 'fs/promises'
import { join } from 'path'
import { get } from '@vercel/blob'
import { NextResponse, type NextRequest } from 'next/server'
import { isAuthenticated } from '@/lib/admin-gate'
import { UPLOAD_DIR, UPLOAD_TYPES } from '@/lib/uploads'

const TYPES: Record<string, string> = { ...UPLOAD_TYPES, svg: 'image/svg+xml' }

export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  if (!(await isAuthenticated())) return new NextResponse('Unauthorized', { status: 401 })
  const { path } = await params
  if (path.length !== 2 || !path.every((p) => /^[a-z0-9._-]+$/i.test(p))) return new NextResponse('Not found', { status: 404 })

  const ext = path[1].split('.').pop()?.toLowerCase() ?? ''
  const contentType = TYPES[ext] ?? 'application/octet-stream'
  const headers: Record<string, string> = {
    'Cache-Control': 'private, max-age=31536000, immutable',
    'Content-Type': contentType,
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
  }
  if (request.nextUrl.searchParams.has('download')) {
    headers['Content-Disposition'] = `attachment; filename="alkanka-${path[1]}"`
  }

  try {
    const bytes = await readFile(join(UPLOAD_DIR, 'studio', path[0], path[1]))
    return new NextResponse(new Uint8Array(bytes), { headers })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.error('Studio file read failed:', error)
      return new NextResponse('Not found', { status: 404 })
    }
  }

  try {
    const result = await get(`studio/${path.join('/')}`, {
      access: 'private',
      ifNoneMatch: request.headers.get('if-none-match') ?? undefined,
    })
    if (!result) return new NextResponse('Not found', { status: 404 })
    if (result.statusCode === 304) return new NextResponse(null, { status: 304, headers: { ETag: result.blob.etag } })
    return new NextResponse(result.stream, {
      headers: { ...headers, 'Content-Type': result.blob.contentType, ETag: result.blob.etag },
    })
  } catch (error) {
    console.error('Studio file fetch failed:', error)
    return new NextResponse('Not found', { status: 404 })
  }
}
