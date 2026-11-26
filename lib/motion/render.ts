import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import ffmpegPath from 'ffmpeg-static'
import opentype, { type Font } from 'opentype.js'
import sharp from 'sharp'
import { drawBackdrop, drawFrame, prepareReel, type MotionKit, type Picture } from './frame'
import { MOTION_FONTS, type MotionFontId, type MotionSpec } from './spec'

const FONT_DIR = path.join(process.cwd(), 'assets', 'studio-fonts')
const fonts = new Map<MotionFontId, Font>()

export function motionFont(id: MotionFontId): Font {
  let font = fonts.get(id)
  if (!font) {
    const file = MOTION_FONTS.find((f) => f.id === id)?.file ?? MOTION_FONTS[0].file
    const data = readFileSync(path.join(FONT_DIR, file))
    font = opentype.parse(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength))
    fonts.set(id, font)
  }
  return font
}

/**
 * A logo or a character as the film draws it: empty edges cut away and scaled to the largest size any
 * scene shows it at, so that every frame decodes a small picture instead of the uploaded original.
 */
export async function motionPicture(image: Buffer, longest: number): Promise<Picture | null> {
  try {
    const trimmed = await sharp(image).ensureAlpha().trim({ threshold: 4 }).toBuffer({ resolveWithObject: true }).catch(() => null)
    const source = trimmed && trimmed.info.width > 4 && trimmed.info.height > 4 ? trimmed.data : image
    const { data, info } = await sharp(source)
      .resize({ width: Math.round(longest), height: Math.round(longest), fit: 'inside', withoutEnlargement: true })
      .png()
      .toBuffer({ resolveWithObject: true })
    return { href: `data:image/png;base64,${data.toString('base64')}`, ratio: info.width / info.height }
  } catch {
    return null
  }
}

function run(args: string[], feed?: (write: (chunk: Buffer) => Promise<void>) => Promise<void>) {
  return new Promise<void>((resolve, reject) => {
    if (!ffmpegPath) return reject(new Error('Video dönüştürücü bulunamadı.'))
    const child = spawn(ffmpegPath, args, { stdio: [feed ? 'pipe' : 'ignore', 'ignore', 'pipe'] })
    let report = ''
    child.stderr?.on('data', (chunk: Buffer) => {
      report = (report + chunk.toString()).slice(-2000)
    })
    child.on('error', reject)
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg ${code}: ${report}`))))
    if (!feed || !child.stdin) return
    const stdin = child.stdin
    stdin.on('error', () => {})
    const write = (chunk: Buffer) => new Promise<void>((done) => (stdin.write(chunk) ? done() : stdin.once('drain', () => done())))
    feed(write).then(
      () => stdin.end(),
      (error) => {
        child.kill('SIGKILL')
        reject(error)
      },
    )
  })
}

export type MotionFile = { gif: Buffer; width: number; height: number; seconds: number; fps: number }

const BATCH = 6

/**
 * Frame rates a GIF can hold exactly (its frame times are whole hundredths of a second) and the sizes
 * tried at each, from the best file down. The first one inside the weight limit is kept.
 */
const LADDER: { fps: number; scale: number }[] = [
  { fps: 25, scale: 1 },
  { fps: 20, scale: 1 },
  { fps: 50 / 3, scale: 1 },
  { fps: 12.5, scale: 1 },
  { fps: 12.5, scale: 0.85 },
  { fps: 12.5, scale: 0.7 },
  { fps: 10, scale: 0.7 },
  { fps: 10, scale: 0.55 },
]

/**
 * Draws every frame of the film once and packs them into a looping GIF with a palette made for this
 * film. `maxBytes` is the weight the file may have; a film too heavy for it is given fewer frames a
 * second, then fewer pixels, never fewer colours.
 */
export async function renderMotion(spec: MotionSpec, kit: MotionKit, maxBytes = Number.POSITIVE_INFINITY): Promise<MotionFile> {
  const reel = prepareReel(spec, kit)
  if (!reel.segments.length) throw new Error('Kurgu boş: en az bir mesaj yaz.')
  const { width, height, fps } = spec
  const frames = Math.max(1, Math.round(reel.duration * fps))
  const backdrop = await sharp(Buffer.from(drawBackdrop(spec))).removeAlpha().raw().toBuffer()
  const dir = await mkdtemp(path.join(tmpdir(), 'motion-'))
  try {
    const film = path.join(dir, 'film.mkv')
    const out = path.join(dir, 'out.gif')
    const draw = (i: number) =>
      sharp(backdrop, { raw: { width, height, channels: 3 } })
        .composite([{ input: Buffer.from(drawFrame(reel, i / fps)) }])
        .removeAlpha()
        .raw()
        .toBuffer()
    // The frames go through a lossless film on disk: holding them all in memory for the palette pass would not fit.
    await run(['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${width}x${height}`, '-r', String(fps), '-i', 'pipe:0', '-c:v', 'libx264rgb', '-preset', 'ultrafast', '-crf', '0', film], async (write) => {
      for (let i = 0; i < frames; i += BATCH) {
        const batch = await Promise.all(Array.from({ length: Math.min(BATCH, frames - i) }, (_, k) => draw(i + k)))
        for (const frame of batch) await write(frame)
      }
    })
    const steps = LADDER.filter((step) => step.fps <= fps + 0.01)
    let best: MotionFile | null = null
    for (const step of steps) {
      const w = Math.max(2, Math.round((width * step.scale) / 2) * 2)
      const h = Math.max(2, Math.round((height * step.scale) / 2) * 2)
      const shape = [step.fps < fps - 0.01 ? `fps=${step.fps.toFixed(4)}` : '', step.scale < 1 ? `scale=${w}:${h}:flags=lanczos` : ''].filter(Boolean)
      const chain = `${shape.length ? `${shape.join(',')},` : ''}split[a][b];[a]palettegen=max_colors=256:stats_mode=full:reserve_transparent=0[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`
      await run(['-y', '-loglevel', 'error', '-i', film, '-filter_complex', chain, '-loop', '0', out])
      best = { gif: await readFile(out), width: w, height: h, seconds: frames / fps, fps: step.fps }
      if (best.gif.length <= maxBytes) break
    }
    if (!best) throw new Error('GIF oluşturulamadı.')
    return best
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

/** One frame as a PNG, for a still preview or a contact sheet. */
export async function renderStill(spec: MotionSpec, kit: MotionKit, time: number) {
  const reel = prepareReel(spec, kit)
  const backdrop = await sharp(Buffer.from(drawBackdrop(spec))).png().toBuffer()
  return sharp(backdrop).composite([{ input: Buffer.from(drawFrame(reel, time)) }]).png().toBuffer()
}
