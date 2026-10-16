import { NextResponse, type NextRequest } from 'next/server'
import { canPanel } from '@/lib/admin-auth'
import { addJob, getJob, readFile, storeFile } from '@/lib/studio'
import { AI_GIF_SECONDS, makeGif, makeVideo, videoToGif } from '@/lib/studio-animate'
import { makeStickerIcon, makeVideoSticker } from '@/lib/studio-telegram'
import { VIDEO_DURATIONS, videoCost } from '@/lib/studio-types'

export const maxDuration = 300

type Mode = 'gif' | 'aigif' | 'video' | 'tgsticker' | 'tgicon'
const MODES: Mode[] = ['gif', 'aigif', 'video', 'tgsticker', 'tgicon']

export async function POST(request: NextRequest) {
  if (!(await canPanel('studio'))) return NextResponse.json({ error: 'Oturum süresi doldu, tekrar giriş yap.' }, { status: 401 })

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const jobId = Number.parseInt(String(body?.jobId ?? ''), 10)
  const source = Number.isFinite(jobId) ? await getJob(jobId) : null
  const mode: Mode = MODES.find((m) => m === body?.mode) ?? 'gif'
  const telegram = mode === 'tgsticker' || mode === 'tgicon'

  if (!source || source.kind !== (telegram ? 'sticker' : 'banner')) {
    return NextResponse.json(
      { error: telegram ? 'Telegram çıktısı için bir sticker seç.' : 'Hareketlendirmek için bir banner seç.' },
      { status: 400 },
    )
  }

  const duration = VIDEO_DURATIONS.find((d) => d === Number(body?.duration)) ?? 6
  const audio = body?.audio === true
  const motion = String(body?.motion ?? '').trim().slice(0, 600)

  try {
    const image = await readFile(source.pathname)
    const result =
      mode === 'gif'
        ? { data: await makeGif(image), contentType: 'image/gif', ext: 'gif', cost: 0, folder: 'gifs' }
        : mode === 'aigif'
          ? {
              data: await videoToGif(
                await makeVideo({ image, format: source.format, motion, duration: AI_GIF_SECONDS, audio: false }),
                source.format === '1:1',
              ),
              contentType: 'image/gif',
              ext: 'gif',
              cost: videoCost(AI_GIF_SECONDS, false),
              folder: 'gifs',
            }
        : mode === 'tgsticker'
          ? { data: await makeVideoSticker(image), contentType: 'video/webm', ext: 'webm', cost: 0, folder: 'stickers' }
          : mode === 'tgicon'
            ? { data: await makeStickerIcon(image), contentType: 'image/webp', ext: 'webp', cost: 0, folder: 'stickers' }
            : {
                data: await makeVideo({ image, format: source.format, motion, duration, audio }),
                contentType: 'video/mp4',
                ext: 'mp4',
                cost: videoCost(duration, audio),
                folder: 'videos',
              }
    const pathname = await storeFile(result.folder, result.data, result.contentType, result.ext)
    const prompt =
      mode === 'tgsticker'
        ? `Telegram hareketli sticker · ${Math.round(result.data.length / 1024)} KB`
        : mode === 'tgicon'
          ? `Telegram paket ikonu · ${Math.round(result.data.length / 1024)} KB`
          : motion ||
            (mode === 'gif' ? 'Işık ve parıltı efektli GIF' : mode === 'aigif' ? 'Yapay zeka hareketli GIF' : `${duration} sn video`)
    const job = await addJob({
      brandId: source.brandId,
      kind: mode === 'aigif' ? 'gif' : mode,
      format: telegram ? '1:1' : mode === 'video' && source.format === '1:1' ? '9:16' : source.format,
      prompt,
      pathname,
      clean: '',
      parentId: source.id,
      cost: result.cost,
    })
    return NextResponse.json({ job: { ...job, brandName: source.brandName } })
  } catch (error) {
    console.error('Studio animation failed:', error)
    const message = error instanceof Error ? error.message : ''
    const blocked = /safety|policy|blocked|refus/i.test(message)
    return NextResponse.json(
      {
        error: blocked
          ? 'Model bu görseli hareketlendirmeyi reddetti. Farklı bir görselle dene.'
          : telegram && message
            ? message
            : 'Hareketlendirme başarısız oldu, tekrar dene.',
      },
      { status: 500 },
    )
  }
}
