import { NextResponse, type NextRequest } from 'next/server'
import sharp from 'sharp'
import { isAdmin } from '@/lib/admin-auth'
import { addAsset, storeFile } from '@/lib/studio'

const MAX_BYTES = 8 * 1024 * 1024
const TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/gif']

export async function POST(request: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Oturum süresi doldu, tekrar giriş yap.' }, { status: 401 })

  const form = await request.formData()
  const target = form.get('target') === 'logo' ? 'logo' : 'asset'
  const provider = String(form.get('provider') ?? '').trim().slice(0, 60)
  const game = String(form.get('game') ?? '').trim().slice(0, 80)
  const files = form.getAll('file').filter((f): f is File => f instanceof File).slice(0, 20)

  if (!files.length) return NextResponse.json({ error: 'Dosya seçilmedi.' }, { status: 400 })
  if (target === 'asset' && !provider) return NextResponse.json({ error: 'Sağlayıcı adı gerekli.' }, { status: 400 })

  const saved: string[] = []
  for (const file of files) {
    if (!TYPES.includes(file.type)) return NextResponse.json({ error: `${file.name}: desteklenmeyen format.` }, { status: 400 })
    if (file.size > MAX_BYTES) return NextResponse.json({ error: `${file.name}: en fazla 8 MB.` }, { status: 400 })
    try {
      const png = await sharp(Buffer.from(await file.arrayBuffer()), { density: 300 })
        .resize({ width: target === 'logo' ? 800 : 1536, height: target === 'logo' ? 400 : 1536, fit: 'inside', withoutEnlargement: target !== 'logo' })
        .png()
        .toBuffer()
      const pathname = await storeFile(target === 'logo' ? 'logos' : 'assets', png, 'image/png', 'png')
      if (target === 'asset') await addAsset(provider, game, pathname)
      saved.push(pathname)
    } catch (error) {
      console.error('Studio upload failed:', error)
      return NextResponse.json({ error: `${file.name}: yüklenemedi.` }, { status: 500 })
    }
  }
  return NextResponse.json({ pathnames: saved })
}
