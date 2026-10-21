import { get } from '@vercel/blob'
import { NextResponse, type NextRequest } from 'next/server'
import { canPanel } from '@/lib/admin-auth'
import { getMember } from '@/lib/member'
import { proofAccess } from '@/lib/trust-extra'

const notFound = () => new NextResponse('Not found', { status: 404 })

/** Proof screenshots can hold account details, so only the panel and the uploader may open them. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params
  if (!/^[a-z0-9._-]+$/i.test(name)) return notFound()
  const path = `kanit/${name}`
  const access = await proofAccess(path).catch(() => null)
  if (!access) return notFound()
  const admin = await canPanel('community').catch(() => false)
  if (!admin) {
    const member = await getMember()
    if (!member || member.id !== access.userId) return notFound()
  }
  try {
    const result = await get(path, { access: 'private' })
    if (!result?.stream) return notFound()
    return new NextResponse(result.stream, {
      headers: { 'Content-Type': result.blob.contentType, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' },
    })
  } catch {
    return notFound()
  }
}
