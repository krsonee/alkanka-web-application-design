import { chatMediaSource } from '@/lib/telegram-chat'

export const dynamic = 'force-dynamic'

const FALLBACK_TYPE = { photo: 'image/jpeg', video: 'video/mp4', animation: 'video/mp4' } as const

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id)
  if (!Number.isInteger(id) || id <= 0) return new Response('Bulunamadı', { status: 404 })
  try {
    const source = await chatMediaSource(id)
    if (!source) return new Response('Bulunamadı', { status: 404 })
    const file = await fetch(source.url)
    if (!file.ok || !file.body) return new Response('Medya alınamadı', { status: 502 })
    return new Response(file.body, {
      headers: {
        'content-type': file.headers.get('content-type')?.startsWith('application/octet') ? FALLBACK_TYPE[source.type] : (file.headers.get('content-type') ?? FALLBACK_TYPE[source.type]),
        'cache-control': 'public, max-age=86400, s-maxage=604800, immutable',
        'x-content-type-options': 'nosniff',
      },
    })
  } catch (error) {
    console.error('[chat-media]', error)
    return new Response('Medya alınamadı', { status: 502 })
  }
}
