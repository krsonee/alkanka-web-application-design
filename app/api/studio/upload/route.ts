import { NextResponse, type NextRequest } from 'next/server'
import sharp from 'sharp'
import { canPanel, isPanelOwner } from '@/lib/admin-auth'
import { logPanel } from '@/lib/panel-log'
import { rejectCrossSite } from '@/lib/same-origin'
import { addAsset, storeFile } from '@/lib/studio'
import { sortAsset } from '@/lib/studio-sort'

export const maxDuration = 120

const MAX_BYTES = 8 * 1024 * 1024
/** The screen sends a large selection as several small requests; this is the most one request may carry. */
const MAX_PER_REQUEST = 30
/** Pictures worked on side by side, each of which may hold a database connection for the cap. */
const SIDE_BY_SIDE = 4
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
  const crossSite = rejectCrossSite(request)
  if (crossSite) return crossSite
  if (!(await canPanel('studio'))) return NextResponse.json({ error: 'Oturum süresi doldu, tekrar giriş yap.' }, { status: 401 })

  const form = await request.formData()
  const rawTarget = form.get('target')
  const target = rawTarget === 'logo' ? 'logo' : rawTarget === 'mascot' ? 'mascot' : 'asset'
  const folder = target === 'logo' ? 'logos' : target === 'mascot' ? 'mascots' : 'assets'
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
  let unlabelled = 0
  const all: (Source | string)[] = [...files, ...urls]
  const sources = all.slice(0, MAX_PER_REQUEST)
  // Anything past the limit is reported, not dropped in silence.
  for (const extra of all.slice(MAX_PER_REQUEST)) failed.push((typeof extra === 'string' ? extra : extra.name).slice(0, 80))
  const figures = target === 'asset' ? await isPanelOwner() : false

  async function take(entry: Source | string) {
    const label = typeof entry === 'string' ? entry : entry.name
    try {
      const source = typeof entry === 'string' ? await fromUrl(entry) : entry
      if (!TYPES.includes(source.type)) throw new Error('desteklenmeyen format')
      if (source.size > MAX_BYTES) throw new Error('en fazla 8 MB')
      const png = await sharp(await source.read(), { density: 300 })
        .resize({ width: target === 'logo' ? 800 : 1536, height: target === 'logo' ? 400 : 1536, fit: 'inside', withoutEnlargement: target !== 'logo' })
        .png()
        .toBuffer()
      const pathname = await storeFile(folder, png, 'image/png', 'png')
      if (target === 'asset') {
        const sorted = await sortAsset(png, figures)
        if (!sorted) unlabelled += 1
        await addAsset(provider, game, pathname, sorted)
      }
      saved.push(pathname)
    } catch (error) {
      console.error('Studio upload failed:', label, error)
      failed.push(label.slice(0, 80))
    }
  }

  for (let at = 0; at < sources.length; at += SIDE_BY_SIDE) {
    await Promise.all(sources.slice(at, at + SIDE_BY_SIDE).map(take))
  }

  if (!saved.length) return NextResponse.json({ error: `Hiçbiri eklenemedi: ${failed.join(', ')}`, failed }, { status: 400 })
  await logPanel(
    'studio',
    'Stüdyoya dosya yüklendi',
    target === 'asset' ? [provider, game].filter(Boolean).join(' · ') : null,
    `${saved.length} dosya${failed.length ? ` · ${failed.length} eklenemedi` : ''}${unlabelled ? ` · ${unlabelled} etiketlenemedi` : ''}`,
  )
  return NextResponse.json({ pathnames: saved, failed, unlabelled })
}
