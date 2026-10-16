import 'server-only'
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import ffmpegPath from 'ffmpeg-static'
import sharp from 'sharp'

const run = promisify(execFile)

export const TG_STATIC_MAX = 512 * 1024
export const TG_VIDEO_MAX = 256 * 1024
export const TG_ICON_MAX = 32 * 1024
const SIZE = 512
const FPS = 30
const SECONDS = 2.8

export async function fitStaticSticker(image: Buffer) {
  const base = sharp(image).resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  for (const quality of [92, 82, 70, 58, 45]) {
    const out = await base.clone().webp({ quality, alphaQuality: 90 }).toBuffer()
    if (out.length <= TG_STATIC_MAX) return out
  }
  return base.webp({ quality: 35 }).toBuffer()
}

export async function makeStickerIcon(image: Buffer) {
  const base = sharp(image).resize(100, 100, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  for (const quality of [90, 75, 60, 45]) {
    const out = await base.clone().webp({ quality }).toBuffer()
    if (out.length <= TG_ICON_MAX) return out
  }
  return base.webp({ quality: 30 }).toBuffer()
}

async function stickerFrames(image: Buffer, dir: string) {
  const inner = Math.round(SIZE * 0.86)
  const art = await sharp(image)
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()
  const total = Math.round(FPS * SECONDS)
  for (let i = 0; i < total; i++) {
    const t = i / total
    const wave = Math.sin(t * 2 * Math.PI)
    const scale = 1 + 0.06 * Math.max(0, Math.sin(t * 4 * Math.PI))
    const angle = 5 * wave
    const lift = Math.round(-14 * Math.abs(Math.sin(t * 2 * Math.PI)))
    const size = Math.round(inner * scale)
    const rotated = await sharp(art)
      .resize(size, size)
      .rotate(angle, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer()
    const meta = await sharp(rotated).metadata()
    const rw = meta.width ?? size
    const rh = meta.height ?? size
    const crop =
      rw > SIZE || rh > SIZE
        ? await sharp(rotated)
            .extract({
              left: Math.max(0, Math.floor((rw - SIZE) / 2)),
              top: Math.max(0, Math.floor((rh - SIZE) / 2)),
              width: Math.min(SIZE, rw),
              height: Math.min(SIZE, rh),
            })
            .png()
            .toBuffer()
        : rotated
    const cm = await sharp(crop).metadata()
    const left = Math.max(0, Math.round((SIZE - (cm.width ?? SIZE)) / 2))
    const top = Math.min(Math.max(0, Math.round((SIZE - (cm.height ?? SIZE)) / 2) + lift), SIZE - (cm.height ?? SIZE))
    await sharp({ create: { width: SIZE, height: SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: crop, left, top: Math.max(0, top) }])
      .png()
      .toFile(path.join(dir, `f${String(i).padStart(3, '0')}.png`))
  }
}

export async function makeVideoSticker(image: Buffer) {
  if (!ffmpegPath) throw new Error('Video dönüştürücü bulunamadı.')
  const dir = await mkdtemp(path.join(tmpdir(), 'tgs-'))
  try {
    await stickerFrames(image, dir)
    const out = path.join(dir, 'out.webm')
    for (const crf of [34, 42, 50, 58]) {
      await run(
        ffmpegPath,
        [
          '-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(dir, 'f%03d.png'),
          '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-b:v', '0', '-crf', String(crf),
          '-deadline', 'good', '-cpu-used', '4', '-an', '-t', '3', '-r', String(FPS), out,
        ],
        { timeout: 120_000 },
      )
      const data = await readFile(out)
      if (data.length <= TG_VIDEO_MAX) return data
    }
    throw new Error('Hareketli sticker 256 KB sınırına sığmadı.')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}
