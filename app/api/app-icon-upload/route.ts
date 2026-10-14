import { put } from '@vercel/blob'
import sharp from 'sharp'
import { revalidatePath } from 'next/cache'
import { NextResponse, type NextRequest } from 'next/server'
import { canPanel } from '@/lib/admin-auth'
import { getBranding, ICON_SIZES, updateBranding } from '@/lib/branding'

const MAX_BYTES = 4 * 1024 * 1024
const TYPES = new Set(['image/png', 'image/jpeg', 'image/webp'])

export async function POST(request: NextRequest) {
  if (!(await canPanel('branding'))) {
    return NextResponse.json({ error: 'Oturum süresi doldu, tekrar giriş yap.' }, { status: 401 })
  }
  const form = await request.formData()
  const file = form.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'Dosya seçilmedi.' }, { status: 400 })
  if (!TYPES.has(file.type)) return NextResponse.json({ error: 'Uygulama ikonu PNG, JPG veya WEBP olmalı.' }, { status: 400 })
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'Dosya en fazla 4 MB olabilir.' }, { status: 400 })

  try {
    const input = Buffer.from(await file.arrayBuffer())
    const meta = await sharp(input).metadata()
    if (!meta.width || !meta.height || meta.width < 192 || meta.height < 192) {
      return NextResponse.json({ error: 'İkon en az 192x192 piksel olmalı (önerilen 512x512 kare).' }, { status: 400 })
    }
    const icons: Record<string, string> = {}
    for (const size of ICON_SIZES) {
      const png = await sharp(input)
        .resize(size, size, { fit: 'cover', position: 'centre' })
        .flatten({ background: '#0b0e17' })
        .png()
        .toBuffer()
      const blob = await put(`app-icons/icon-${size}.png`, png, { access: 'private', addRandomSuffix: true, contentType: 'image/png' })
      icons[`${size}`] = blob.pathname
    }
    const current = await getBranding()
    await updateBranding({ icons, iconVersion: (current.iconVersion ?? 0) + 1 })
    revalidatePath('/', 'layout')
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('App icon upload failed:', error)
    return NextResponse.json({ error: 'İkon işlenemedi. Başka bir görsel dene.' }, { status: 500 })
  }
}
