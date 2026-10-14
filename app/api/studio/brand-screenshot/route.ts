import { NextResponse, type NextRequest } from 'next/server'
import { canPanel } from '@/lib/admin-auth'
import { extractBrandFromScreenshot } from '@/lib/brand-extract'

export const maxDuration = 120

const MAX_BYTES = 10 * 1024 * 1024
const TYPES = ['image/png', 'image/jpeg', 'image/webp']

export async function POST(request: NextRequest) {
  if (!(await canPanel('studio'))) return NextResponse.json({ error: 'Oturum süresi doldu, tekrar giriş yap.' }, { status: 401 })

  const form = await request.formData()
  const file = form.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'Ekran görüntüsü seç.' }, { status: 400 })
  if (!TYPES.includes(file.type)) return NextResponse.json({ error: 'PNG, JPG veya WEBP yükle.' }, { status: 400 })
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'Dosya 10 MB sınırını aşıyor.' }, { status: 400 })

  try {
    const brand = await extractBrandFromScreenshot(Buffer.from(await file.arrayBuffer()), String(form.get('domain') ?? ''))
    return NextResponse.json({
      brand,
      message: brand.warnings.join(' ') || 'Marka bilgileri ekran görüntüsünden çıkarıldı.',
    })
  } catch (error) {
    console.error('Screenshot brand extract failed:', error)
    return NextResponse.json({ error: 'Ekran görüntüsü işlenemedi, başka bir görüntü dene.' }, { status: 500 })
  }
}
