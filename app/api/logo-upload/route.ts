import { put } from '@vercel/blob'
import { NextResponse, type NextRequest } from 'next/server'
import { canPanelAny } from '@/lib/admin-auth'

const MAX_BYTES = 2 * 1024 * 1024
const TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/gif': 'gif',
}

export async function POST(request: NextRequest) {
  if (!(await canPanelAny(['logo', 'branding', 'sponsors']))) {
    return NextResponse.json({ error: 'Oturum süresi doldu, tekrar giriş yap.' }, { status: 401 })
  }

  const form = await request.formData()
  const file = form.get('file')
  const id = String(form.get('id') ?? 'logo').replace(/[^a-z0-9-]/gi, '').slice(0, 40) || 'logo'

  if (!(file instanceof File)) return NextResponse.json({ error: 'Dosya seçilmedi.' }, { status: 400 })
  const ext = TYPES[file.type]
  if (!ext) return NextResponse.json({ error: 'Sadece PNG, JPG, WEBP, SVG veya GIF yükleyebilirsin.' }, { status: 400 })
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'Dosya en fazla 2 MB olabilir.' }, { status: 400 })

  try {
    const blob = await put(`logos/${id}.${ext}`, file, {
      access: 'private',
      addRandomSuffix: true,
      contentType: file.type,
    })
    const name = blob.pathname.slice('logos/'.length)
    return NextResponse.json({ url: `/api/logo/${name}` })
  } catch (error) {
    console.error('Logo upload failed:', error)
    return NextResponse.json({ error: 'Yükleme başarısız oldu.' }, { status: 500 })
  }
}
