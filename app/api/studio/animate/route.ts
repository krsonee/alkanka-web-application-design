import { NextResponse, type NextRequest } from 'next/server'
import { canPanel } from '@/lib/admin-auth'
import { logPanel } from '@/lib/panel-log'
import { rejectCrossSite } from '@/lib/same-origin'
import { addJob, getBrand, getJob, readFile, storeFile } from '@/lib/studio'
import { makeGif, makeMotionSticker, makeVideo, videoToGif } from '@/lib/studio-animate'
import { cleanMotion, motionLabel } from '@/lib/studio-brief'
import { closeHold, holdBudget } from '@/lib/studio-budget'
import { brushOf } from '@/lib/studio-overlay'
import { makeStickerIcon, makeVideoSticker } from '@/lib/studio-telegram'
import { GIF_DURATIONS, gifCost, STICKER_MOTION_COST, toMotionQuality, VIDEO_DURATIONS, videoCost } from '@/lib/studio-types'

export const maxDuration = 300

/**
 * `gif` is the free light effect over a still banner, `aigif` a GIF cut from a generated clip.
 * `tgsticker` is the free wobble, `tgmotion` a sticker whose character is animated by the model.
 */
type Mode = 'gif' | 'aigif' | 'video' | 'tgsticker' | 'tgmotion' | 'tgicon'
const MODES: Mode[] = ['gif', 'aigif', 'video', 'tgsticker', 'tgmotion', 'tgicon']
const STICKER_MODES: Mode[] = ['tgsticker', 'tgmotion', 'tgicon']

const kb = (data: Buffer) => `${Math.max(1, Math.round(data.length / 1024))} KB`
const mb = (data: Buffer) => `${(data.length / 1024 / 1024).toFixed(1)} MB`

export async function POST(request: NextRequest) {
  const crossSite = rejectCrossSite(request)
  if (crossSite) return crossSite
  if (!(await canPanel('studio'))) return NextResponse.json({ error: 'Oturum süresi doldu, tekrar giriş yap.' }, { status: 401 })

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const jobId = Number.parseInt(String(body?.jobId ?? ''), 10)
  const source = Number.isFinite(jobId) ? await getJob(jobId) : null
  const mode: Mode = MODES.find((m) => m === body?.mode) ?? 'gif'
  const telegram = STICKER_MODES.includes(mode)

  if (!source || source.kind !== (telegram ? 'sticker' : 'banner')) {
    return NextResponse.json(
      { error: telegram ? 'Telegram çıktısı için bir sticker seç.' : 'Hareketlendirmek için bir banner seç.' },
      { status: 400 },
    )
  }

  // Older screens sent the motion as one line of text.
  const motion = cleanMotion(typeof body?.motion === 'string' ? { action: body.motion } : body?.motion)
  const audio = body?.audio === true
  const duration = VIDEO_DURATIONS.find((d) => d === Number(body?.duration)) ?? 6
  const gifSeconds = GIF_DURATIONS.find((d) => d === Number(body?.duration)) ?? GIF_DURATIONS[0]
  // Videos were always 1080p before the quality choice existed.
  const quality = toMotionQuality(body?.quality, mode === 'video' ? 'hd' : 'sd')
  const hd = quality === 'hd'
  const paid =
    mode === 'aigif'
      ? gifCost(gifSeconds, quality)
      : mode === 'video'
        ? videoCost(duration, audio, hd)
        : mode === 'tgmotion'
          ? STICKER_MOTION_COST
          : 0
  const held = await holdBudget(paid)
  if (held.error !== null) return NextResponse.json({ error: held.error }, { status: 409 })
  const hold = held.hold
  const onBilled = () => {
    hold.billed = true
  }

  try {
    const image = await readFile(source.pathname)
    // With the text-free original at hand, the model animates that and the logo and copy are printed
    // on the finished clip. Older jobs without it are animated as they are.
    const clip = async (seconds: number, sound: boolean) => {
      if (!source.cleanPathname) return makeVideo({ image, format: source.format, motion, duration: seconds, audio: sound, hd, brush: null, onBilled })
      const [clean, brand] = await Promise.all([readFile(source.cleanPathname), source.brandId ? getBrand(source.brandId) : null])
      return makeVideo({ image: clean, format: source.format, motion, duration: seconds, audio: sound, hd, brush: brushOf(brand, source.texts), onBilled })
    }
    const asked = motionLabel(motion)
    const made = async (): Promise<{ data: Buffer; contentType: string; ext: string; folder: string; label: string }> => {
      if (mode === 'gif') {
        return { data: await makeGif(image), contentType: 'image/gif', ext: 'gif', folder: 'gifs', label: 'Işık efektli GIF (görsel hareket etmez)' }
      }
      if (mode === 'aigif') {
        const data = await videoToGif(await clip(gifSeconds, false), quality)
        const about = `${gifSeconds} sn hareketli GIF · ${hd ? 'yüksek' : 'standart'} · ${mb(data)}`
        return { data, contentType: 'image/gif', ext: 'gif', folder: 'gifs', label: asked ? `${asked} · ${about}` : about }
      }
      if (mode === 'tgsticker') {
        const data = await makeVideoSticker(image)
        return { data, contentType: 'video/webm', ext: 'webm', folder: 'stickers', label: `Telegram hareketli sticker (sallanma) · ${kb(data)}` }
      }
      if (mode === 'tgmotion') {
        const data = await makeMotionSticker(image, motion, onBilled)
        const about = `Telegram hareketli sticker · ${kb(data)}`
        return { data, contentType: 'video/webm', ext: 'webm', folder: 'stickers', label: asked ? `${asked} · ${about}` : about }
      }
      if (mode === 'tgicon') {
        const data = await makeStickerIcon(image)
        return { data, contentType: 'image/webp', ext: 'webp', folder: 'stickers', label: `Telegram paket ikonu · ${kb(data)}` }
      }
      const data = await clip(duration, audio)
      const about = `${duration} sn video · ${hd ? '1080p' : '720p'}${audio ? ' · sesli' : ''}`
      return { data, contentType: 'video/mp4', ext: 'mp4', folder: 'videos', label: asked ? `${asked} · ${about}` : about }
    }
    const result = await made()
    const pathname = await storeFile(result.folder, result.data, result.contentType, result.ext)
    const job = await addJob({
      brandId: source.brandId,
      kind: mode === 'aigif' ? 'gif' : mode === 'tgmotion' ? 'tgsticker' : mode,
      format: telegram ? '1:1' : source.format,
      prompt: result.label,
      pathname,
      clean: '',
      parentId: source.id,
      cost: paid,
    })
    await closeHold(hold, 'recorded')
    await logPanel('studio', 'Hareketli içerik üretildi', source.brandName || null, `Üretim #${job.id} · ${result.label.slice(0, 200)}`)
    return NextResponse.json({ job: { ...job, brandName: source.brandName } })
  } catch (error) {
    console.error('Studio animation failed:', error)
    await closeHold(hold, 'failed', `Hareketli içerik kaydedilemedi (kaynak #${source.id}, ${mode})`)
    const message = error instanceof Error ? error.message : ''
    const blocked = /safety|policy|blocked|refus/i.test(message)
    return NextResponse.json(
      {
        error: blocked
          ? 'Model bu görseli hareketlendirmeyi reddetti. Farklı bir görselle dene.'
          : telegram && /sticker|dönüştürücü/i.test(message)
            ? message
            : 'Hareketlendirme başarısız oldu, tekrar dene.',
      },
      { status: 500 },
    )
  }
}
