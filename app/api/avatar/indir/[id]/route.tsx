import { ImageResponse } from 'next/og'
import { NextResponse, type NextRequest } from 'next/server'
import { getMember } from '@/lib/member'
import { downloadableAvatar } from '@/lib/avatars'
import { imageDataUrl } from '@/lib/image-source'

export const runtime = 'nodejs'

const SIZE = 1024

/**
 * Telegram crops profile photos to a circle, so the AL KANKA marks sit in the
 * corners: invisible on the round avatar, but the file always carries the brand.
 */
function Mark({ style }: { style: React.CSSProperties }) {
  return (
    <div style={{ position: 'absolute', display: 'flex', fontSize: 26, fontWeight: 800, letterSpacing: 4, color: 'rgba(255,255,255,0.78)', textShadow: '0 1px 3px rgba(0,0,0,0.55)', ...style }}>
      AL KANKA
    </div>
  )
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const member = await getMember()
  if (!member) return NextResponse.json({ error: 'Giriş yapmalısın.' }, { status: 401 })
  const { id } = await params
  const avatar = await downloadableAvatar(member.id, id)
  if (!avatar) return NextResponse.json({ error: 'Bu avatar henüz senin değil.' }, { status: 403 })
  const data = await imageDataUrl(avatar.src, req.nextUrl.origin)
  if (!data) return NextResponse.json({ error: 'Görsel yüklenemedi.' }, { status: 500 })

  const image = new ImageResponse(
    (
      <div style={{ width: SIZE, height: SIZE, display: 'flex', position: 'relative', background: '#0b0f14' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={data} width={SIZE} height={SIZE} alt="" style={{ width: SIZE, height: SIZE, objectFit: 'cover' }} />
        <Mark style={{ top: 28, left: 30, fontSize: 20, letterSpacing: 3, color: 'rgba(255,255,255,0.55)' }} />
        <Mark style={{ bottom: 30, right: 34 }} />
        <div style={{ position: 'absolute', bottom: 70, right: 36, display: 'flex', fontSize: 15, letterSpacing: 2, color: 'rgba(255,255,255,0.5)' }}>
          alkanka · Jako
        </div>
      </div>
    ),
    { width: SIZE, height: SIZE },
  )
  const headers = new Headers(image.headers)
  headers.set('Content-Disposition', `attachment; filename="alkanka-${avatar.id}.png"`)
  headers.set('Cache-Control', 'private, no-store')
  return new Response(image.body, { status: 200, headers })
}
