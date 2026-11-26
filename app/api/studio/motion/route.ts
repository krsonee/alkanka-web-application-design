import { NextResponse, type NextRequest } from 'next/server'
import { canPanel } from '@/lib/admin-auth'
import { prepareReel, type MotionKit } from '@/lib/motion/frame'
import { motionFont, motionPicture, renderMotion } from '@/lib/motion/render'
import {
  brandColors,
  cleanColors,
  cleanLook,
  cleanScenes,
  drawnSize,
  MOTION_FPS,
  MOTION_WEIGHTS,
  parseSize,
  toWeight,
  type MotionSpec,
} from '@/lib/motion/spec'
import { plainText } from '@/lib/motion/type'
import { logPanel } from '@/lib/panel-log'
import { rejectCrossSite } from '@/lib/same-origin'
import { addJob, getAsset, getBrand, readFile, storeFile } from '@/lib/studio'
import { cutOutLogo, trimClear } from '@/lib/studio-overlay'

export const maxDuration = 300

const EXPIRED = { error: 'Oturum süresi doldu, tekrar giriş yap.' }
/** The pictures of the live preview: small enough to travel, large enough for the preview box. */
const PREVIEW_PX = 640

type Brand = NonNullable<Awaited<ReturnType<typeof getBrand>>>

async function logoOf(brand: Brand | null) {
  if (!brand?.logo) return null
  const raw = await readFile(brand.logo).catch(() => null)
  return raw ? trimClear(await cutOutLogo(raw)).catch(() => raw) : null
}

/** `figure` is `mascot` for the brand kit's character, or the number of a picture in the provider library. */
async function figureOf(brand: Brand | null, figure: unknown) {
  if (figure === 'mascot') return brand?.mascot ? readFile(brand.mascot).catch(() => null) : null
  const id = Number.parseInt(String(figure ?? ''), 10)
  if (!Number.isFinite(id)) return null
  const asset = await getAsset(id)
  return asset ? readFile(asset.pathname).catch(() => null) : null
}

async function pictures(brand: Brand | null, figure: unknown, longest: number) {
  const [logo, character] = await Promise.all([logoOf(brand), figureOf(brand, figure)])
  return {
    logo: logo ? await motionPicture(logo, longest) : null,
    figure: character ? await motionPicture(character, longest) : null,
  }
}

const megabytes = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`

export async function POST(request: NextRequest) {
  const crossSite = rejectCrossSite(request)
  if (crossSite) return crossSite
  if (!(await canPanel('studio'))) return NextResponse.json(EXPIRED, { status: 401 })

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return NextResponse.json({ error: 'İstek okunamadı.' }, { status: 400 })
  const brandId = Number.parseInt(String(body.brandId ?? ''), 10)
  const brand = Number.isFinite(brandId) ? await getBrand(brandId) : null

  // The same cut-out logo and character the film is drawn with, so the preview shows what the file will.
  if (body.mode === 'kit') return NextResponse.json(await pictures(brand, body.figure, PREVIEW_PX))

  const asked = parseSize(body.size)
  if (!asked) return NextResponse.json({ error: 'Boyut 40 ile 2400 piksel arasında, "728x90" gibi yazılır.' }, { status: 400 })
  const scenes = cleanScenes(body.scenes)
  if (!scenes.length) return NextResponse.json({ error: 'En az bir mesaj yaz.' }, { status: 400 })
  const look = cleanLook(body.look)
  const weight = MOTION_WEIGHTS.find((w) => w.id === toWeight(body.quality)) ?? MOTION_WEIGHTS[0]
  const size = drawnSize(asked.width, asked.height)
  const spec: MotionSpec = {
    ...size,
    fps: MOTION_FPS,
    seed: Number.isFinite(Number(body.seed)) ? Math.abs(Math.floor(Number(body.seed))) : Date.now() % 100000,
    brand: brand?.name ?? '',
    look,
    colors: cleanColors(body.colors, brandColors(brand?.colors ?? [])),
    scenes,
  }

  try {
    const kit: MotionKit = { font: motionFont(look.font), ...(await pictures(brand, body.figure, Math.max(size.width, size.height))) }
    if (!prepareReel(spec, kit).segments.length) return NextResponse.json({ error: 'Bu boyuta sığan bir kurgu çıkmadı.' }, { status: 400 })
    const film = await renderMotion(spec, kit, weight.mb * 1024 * 1024)
    const pathname = await storeFile('gifs', film.gif, 'image/gif', 'gif')
    const sizeName = `${asked.width}x${asked.height}`
    const drawn = film.width === asked.width && film.height === asked.height ? '' : ` (${film.width}x${film.height} çizildi)`
    const about = `Kurgulu GIF · ${scenes.length} mesaj · ${film.seconds.toFixed(1).replace('.', ',')} sn · ${megabytes(film.gif.length)}${drawn}`
    const copy = scenes.map((scene) => plainText(scene.text)).join(' / ')
    const job = await addJob({ brandId: brand?.id ?? null, kind: 'gif', format: sizeName, prompt: `${about} · ${copy}`.slice(0, 600), pathname, clean: '', parentId: null, cost: 0 })
    await logPanel('studio', 'Kurgulu GIF üretildi', brand?.name ?? null, `Üretim #${job.id} · ${sizeName} · ${about}`)
    return NextResponse.json({ job: { ...job, brandName: brand?.name ?? '' }, about: { width: film.width, height: film.height, bytes: film.gif.length, seconds: film.seconds } })
  } catch (error) {
    console.error('Motion banner failed:', error)
    return NextResponse.json({ error: 'GIF oluşturulamadı, tekrar dene.' }, { status: 500 })
  }
}
