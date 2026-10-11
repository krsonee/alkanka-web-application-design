import { NextResponse, type NextRequest } from 'next/server'
import sharp from 'sharp'
import { isAdmin } from '@/lib/admin-auth'
import { addAsset, storeFile } from '@/lib/studio'

export const maxDuration = 120

const MAX_BYTES = 8 * 1024 * 1024
const TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/gif']
const PRIVATE_HOST = /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[?::1\]?$|\[?f[cd])/i

type Source = { name: string; type: string; size: number; read: () => Promise<Buffer> }

async function fromUrl(raw: string): Promise<Source> {
  const url = new URL(raw)
  if (!/^https?:$/.test(url.protocol) || PRIVATE_HOST.test(url.hostname)) throw new Error('Geçersiz link')
  const res = await fetch(url, { signal: AbortSignal.timeout(15000), headers: { 'User-Agent': 'Mozilla/5.0 AlkankaStudio' } })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = Buffer.from(await res.arrayBuffer())
  const type = (res.headers.get('content-type') ?? '').split(';')[0].trim()
  return { name: url.pathname.split('/').pop() || url.hostname, type: TYPES.includes(type) ? type : 'image/png', size: data.length, read: async () => data }
}

export async function POST(request: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Oturum süresi doldu, tekrar giriş yap.' }, { status: 401 })

  const form = await request.formData()
  const target = form.get('target') === 'logo' ? 'logo' : 'asset'
  const provider = String(form.get('provider') ?? '').trim().slice(0, 60)
  const game = String(form.get('game') ?? '').trim().slice(0, 80)
  const files: Source[] = form
    .getAll('file')
    .filter((f): f is File => f instanceof File)
    .map((f) => ({ name: f.name, type: f.type, size: f.size, read: async () => Buffer.from(await f.arrayBuffer()) }))
  const urls = String(form.get('urls') ?? '')
    .split(/\s+/)
    .filter((u) => /^https?:\/\//i.test(u))

  if (!files.length && !urls.length) return NextResponse.json({ error: 'Dosya veya link eklenmedi.' }, { status: 400 })
  if (target === 'asset' && !provider) return NextResponse.json({ error: 'Sağlayıcı adı gerekli.' }, { status: 400 })

  const saved: string[] = []
  const failed: string[] = []
  const sources: (Source | string)[] = [...files, ...urls].slice(0, 30)

  for (const entry of sources) {
    const label = typeof entry === 'string' ? entry : entry.name
    try {
      const source = typeof entry === 'string' ? await fromUrl(entry) : entry
      if (!TYPES.includes(source.type)) throw new Error('desteklenmeyen format')
      if (source.size > MAX_BYTES) throw new Error('en fazla 8 MB')
      const png = await sharp(await source.read(), { density: 300 })
        .resize({ width: target === 'logo' ? 800 : 1536, height: target === 'logo' ? 400 : 1536, fit: 'inside', withoutEnlargement: target !== 'logo' })
        .png()
        .toBuffer()
      const pathname = await storeFile(target === 'logo' ? 'logos' : 'assets', png, 'image/png', 'png')
      if (target === 'asset') await addAsset(provider, game, pathname)
      saved.push(pathname)
    } catch (error) {
      console.error('Studio upload failed:', label, error)
      failed.push(label.slice(0, 80))
    }
  }

  if (!saved.length) return NextResponse.json({ error: `Hiçbiri eklenemedi: ${failed.join(', ')}` }, { status: 400 })
  return NextResponse.json({ pathnames: saved, failed })
}
