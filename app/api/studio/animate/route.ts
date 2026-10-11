import { NextResponse, type NextRequest } from 'next/server'
import { isAdmin } from '@/lib/admin-auth'
import { addJob, getJob, readFile, storeFile } from '@/lib/studio'
import { makeGif, makeVideo } from '@/lib/studio-animate'
import { VIDEO_DURATIONS, videoCost } from '@/lib/studio-types'

export const maxDuration = 300

export async function POST(request: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Oturum süresi doldu, tekrar giriş yap.' }, { status: 401 })

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const jobId = Number.parseInt(String(body?.jobId ?? ''), 10)
  const source = Number.isFinite(jobId) ? await getJob(jobId) : null
  if (!source || source.kind !== 'banner') {
    return NextResponse.json({ error: 'Hareketlendirmek için bir banner seç.' }, { status: 400 })
  }

  const mode = body?.mode === 'video' ? 'video' : 'gif'
  const duration = VIDEO_DURATIONS.find((d) => d === Number(body?.duration)) ?? 6
  const audio = body?.audio === true
  const motion = String(body?.motion ?? '').trim().slice(0, 600)

  try {
    const image = await readFile(source.pathname)
    const result =
      mode === 'gif'
        ? { data: await makeGif(image), contentType: 'image/gif', ext: 'gif', cost: 0 }
        : {
            data: await makeVideo({ image, format: source.format, motion, duration, audio }),
            contentType: 'video/mp4',
            ext: 'mp4',
            cost: videoCost(duration, audio),
          }
    const pathname = await storeFile(mode === 'gif' ? 'gifs' : 'videos', result.data, result.contentType, result.ext)
    const job = await addJob({
      brandId: source.brandId,
      kind: mode,
      format: mode === 'video' && source.format === '1:1' ? '9:16' : source.format,
      prompt: motion || (mode === 'gif' ? 'Parlama efektli hareketli banner' : `${duration} sn video`),
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
      { error: blocked ? 'Model bu görseli hareketlendirmeyi reddetti. Farklı bir görselle dene.' : 'Hareketlendirme başarısız oldu, tekrar dene.' },
      { status: 500 },
    )
  }
}
