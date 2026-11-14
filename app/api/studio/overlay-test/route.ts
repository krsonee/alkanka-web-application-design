import { readFile, writeFile } from 'node:fs/promises'
import sharp from 'sharp'
import { listBrands } from '@/lib/studio'
import { makeVideo } from '@/lib/studio-animate'
import { runGeneration } from '@/lib/studio-generate'
import { brushOf } from '@/lib/studio-overlay'

// TEMPORARY: local end-to-end check of the studio pipeline. Removed before commit.
export const maxDuration = 300

const TEXTS = { headline: '%500 FREESPİN BONUSU', subline: 'İlk yatırımına özel, bugün son gün', cta: 'HEMEN KATIL' }

export async function GET(request: Request) {
  if (process.env.NODE_ENV === 'production') return new Response('not found', { status: 404 })
  const q = new URL(request.url).searchParams
  const brand = (await listBrands())[0] ?? null
  const format = q.get('format') ?? '1:1'
  try {
    if (q.get('mode') === 'video') {
      const clean = await readFile(`/tmp/studio/clean-${format.replace(':', 'x')}.png`)
      const started = Date.now()
      const video = await makeVideo({ image: clean, format, motion: '', duration: 4, audio: false, hd: true, brush: brushOf(brand, TEXTS) })
      await writeFile(`/tmp/studio/video-${format.replace(':', 'x')}.mp4`, video)
      return Response.json({ ok: true, bytes: video.length, seconds: Math.round((Date.now() - started) / 1000) })
    }
    const started = Date.now()
    const result = await runGeneration({
      kind: 'banner',
      format,
      category: 'Slot / freespin',
      prompt: 'Zeus karakteri şimşek tutuyor, arkada altın paralar ve mor bulutlar, sinematik ışık',
      brand,
      references: [],
      revisionOf: null,
      texts: TEXTS,
      size: q.get('size') === '1K' ? '1K' : '2K',
    })
    await writeFile(`/tmp/studio/final-${format.replace(':', 'x')}.png`, result.data)
    if (result.clean) await writeFile(`/tmp/studio/clean-${format.replace(':', 'x')}.png`, result.clean)
    const meta = await sharp(result.data).metadata()
    return Response.json({ ok: true, brand: brand?.name, width: meta.width, height: meta.height, bytes: result.data.length, seconds: Math.round((Date.now() - started) / 1000) })
  } catch (error) {
    return Response.json({ ok: false, error: String((error as Error).message), cause: String((error as { cause?: unknown }).cause ?? '') }, { status: 500 })
  }
}
