import { get } from '@vercel/blob'
import { NextResponse, type NextRequest } from 'next/server'
import { canPanel } from '@/lib/admin-auth'
import { getMember } from '@/lib/member'
import { imageOwner, imageStatus } from '@/lib/withdrawals'

const notFound = () => new NextResponse('Not found', { status: 404 })

/** Approved screenshots are public; pending or rejected ones are visible only to the panel and the uploader. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params
  if (!/^[a-z0-9._-]+$/i.test(name)) return notFound()
  const path = `cekim/${name}`

  const status = await imageStatus(path).catch(() => null)
  if (!status) return notFound()
  const isPublic = status === 'approved'
  if (!isPublic) {
    const admin = await canPanel('community').catch(() => false)
    if (!admin) {
      const member = await getMember()
      if (!member || (await imageOwner(path)) !== member.id) return notFound()
    }
  }

  try {
    const result = await get(path, { access: 'private' })
    if (!result?.stream) return notFound()
    return new NextResponse(result.stream, {
      headers: {
        'Content-Type': result.blob.contentType,
        'Cache-Control': isPublic ? 'public, max-age=3600' : 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    console.error('[cekim] image fetch failed', error)
    return notFound()
  }
}
