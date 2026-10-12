import { randomBytes } from 'crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { isAuthenticated } from '@/lib/admin-gate'
import { detectImageType, MAX_UPLOAD_BYTES, writeImageFile } from '@/lib/uploads'

export async function POST(request: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'Oturum süresi doldu, tekrar giriş yap.' }, { status: 401 })
  }

  const form = await request.formData()
  const file = form.get('file')
  const id = String(form.get('id') ?? form.get('name') ?? 'logo').replace(/[^a-z0-9-]/gi, '').slice(0, 40) || 'logo'

  if (!(file instanceof File)) return NextResponse.json({ error: 'Dosya seçilmedi.' }, { status: 400 })
  if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: 'Dosya en fazla 8 MB olabilir.' }, { status: 400 })

  const bytes = new Uint8Array(await file.arrayBuffer())
  const ext = detectImageType(bytes)
  if (!ext) return NextResponse.json({ error: 'Sadece PNG, JPG, WEBP veya GIF yükleyebilirsin.' }, { status: 400 })

  try {
    const url = await writeImageFile(`${id}-${randomBytes(4).toString('hex')}.${ext}`, bytes)
    return NextResponse.json({ url })
  } catch (error) {
    console.error('Logo upload failed:', error)
    return NextResponse.json({ error: 'Yükleme başarısız oldu.' }, { status: 500 })
  }
}
