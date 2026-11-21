import 'server-only'
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
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

const CLEAR = { r: 0, g: 0, b: 0, alpha: 0 }
const STROKE = 9

/**
 * Puts an even white edge around a cut-out sticker and returns it as a 512 px PNG. The edge is the
 * sticker's own shape grown outwards, so it follows every curve and hides leftover key colour.
 */
export async function outlineSticker(image: Buffer) {
  const inner = SIZE - (STROKE + 3) * 2
  const art = await sharp(image).resize(inner, inner, { fit: 'contain', background: CLEAR }).png().toBuffer()
  const placed = await sharp({ create: { width: SIZE, height: SIZE, channels: 4, background: CLEAR } })
    .composite([{ input: art, gravity: 'centre' }])
    .png()
    .toBuffer()
  // A blurred mask cut off at a low level is the shape grown by about 1.5 sigma. Each step is its
  // own pipeline: sharp keeps only the last blur of a chain and runs threshold in a fixed place.
  const blurred = await sharp(placed).extractChannel('alpha').blur(STROKE / 1.5).png().toBuffer()
  const hard = await sharp(blurred).threshold(18).png().toBuffer()
  const grown = await sharp(hard).blur(0.8).extractChannel(0).png().toBuffer()
  const edge = await sharp({ create: { width: SIZE, height: SIZE, channels: 3, background: { r: 255, g: 255, b: 255 } } })
    .joinChannel(grown)
    .png()
    .toBuffer()
  return sharp(edge).composite([{ input: placed }]).png().toBuffer()
}

export const STICKER_FRAME = { width: 1280, height: 720 } as const
const KEY_GREEN = { r: 0, g: 255, b: 0 }

/**
 * The frame handed to the video model: the sticker in the middle of a flat green 16:9 frame, with
 * room around it to move. The green is keyed out again in `clipToVideoSticker`.
 */
export async function stickerGreenFrame(image: Buffer) {
  const { width, height } = STICKER_FRAME
  const art = await sharp(image)
    .resize(Math.round(height * ART_SHARE), Math.round(height * ART_SHARE), { fit: 'contain', background: CLEAR })
    .png()
    .toBuffer()
  return sharp({ create: { width, height, channels: 3, background: KEY_GREEN } })
    .composite([{ input: art, gravity: 'centre' }])
    .png()
    .toBuffer()
}

/** Share of the frame height the sticker fills on the green frame. */
const ART_SHARE = 0.8
/** How far, in pixels of the finished sticker, the character may move outside its still shape. */
const MOVE_ROOM = 14

/**
 * The part of the finished sticker the character may show in: its own still shape, grown by
 * `MOVE_ROOM`, as a 512 px grey picture. The model sometimes paints words, sparks or a glow on the
 * green; they are not green, so the key keeps them, and only this shape can cut them away.
 */
export async function stickerShape(image: Buffer) {
  const inner = Math.round(SIZE * ART_SHARE)
  const art = await sharp(image).ensureAlpha().resize(inner, inner, { fit: 'contain', background: CLEAR }).png().toBuffer()
  const placed = await sharp({ create: { width: SIZE, height: SIZE, channels: 4, background: CLEAR } })
    .composite([{ input: art, gravity: 'centre' }])
    .png()
    .toBuffer()
  // Same growing trick as `outlineSticker`: blur, cut off low, then soften the new edge.
  const blurred = await sharp(placed).extractChannel('alpha').blur(MOVE_ROOM / 1.5).png().toBuffer()
  const hard = await sharp(blurred).threshold(18).png().toBuffer()
  return sharp(hard).blur(4).extractChannel(0).png().toBuffer()
}

const hex = (n: number) => Math.round(n).toString(16).padStart(2, '0')

/** The clip's real background colour: video compression never returns the exact green it was given. */
async function keyColour(ffmpeg: string, input: string, dir: string) {
  const still = path.join(dir, 'first.png')
  await run(ffmpeg, ['-y', '-loglevel', 'error', '-i', input, '-frames:v', '1', still], { timeout: 60_000 })
  const { data, info } = await sharp(still).extract({ left: 8, top: 8, width: 48, height: 48 }).raw().toBuffer({ resolveWithObject: true })
  const sum = [0, 0, 0]
  for (let i = 0; i < data.length; i += info.channels) for (let c = 0; c < 3; c++) sum[c] += data[i + c]
  const pixels = data.length / info.channels
  const [r, g, b] = sum.map((total) => total / pixels)
  // A corner that is not green means the model painted over the background; key on pure green then.
  return g - Math.max(r, b) > 60 ? `0x${hex(r)}${hex(g)}${hex(b)}` : '0x00ff00'
}

/**
 * Turns the model's green-screen clip into a Telegram video sticker: the middle square, the green
 * removed, 512 px, 30 fps, VP9 with transparency, under 256 KB. The first three seconds play at
 * double speed and then backwards, so the three-second loop has no jump. `shape` (see
 * `stickerShape`) limits the picture to where the character can be.
 */
export async function clipToVideoSticker(video: Buffer, shape: Buffer) {
  if (!ffmpegPath) throw new Error('Video dönüştürücü bulunamadı.')
  const dir = await mkdtemp(path.join(tmpdir(), 'tgm-'))
  try {
    const input = path.join(dir, 'in.mp4')
    const mask = path.join(dir, 'shape.png')
    const out = path.join(dir, 'out.webm')
    await writeFile(input, video)
    await writeFile(mask, shape)
    const key = await keyColour(ffmpegPath, input, dir)
    const keyed = [
      `[0:v]trim=0:3,setpts=(PTS-STARTPTS)/2,fps=${FPS},crop=ih:ih:(iw-ih)/2:0`,
      `chromakey=${key}:0.16:0.07,despill=type=green:mix=0.7`,
      `scale=${SIZE}:${SIZE}:flags=lanczos,format=yuva420p,split[colour][keyed]`,
    ].join(',')
    const filter = [
      keyed,
      '[keyed]alphaextract[seen]',
      `[1:v]scale=${SIZE}:${SIZE},format=gray[shape]`,
      '[seen][shape]blend=all_mode=multiply:shortest=1[alpha]',
      '[colour][alpha]alphamerge,split[fwd][src]',
      '[src]reverse[back]',
      '[fwd][back]concat=n=2:v=1,format=yuva420p[out]',
    ].join(';')
    for (const crf of [36, 44, 52, 60]) {
      await run(
        ffmpegPath,
        [
          '-y', '-loglevel', 'error', '-i', input, '-loop', '1', '-framerate', String(FPS), '-i', mask,
          '-filter_complex', filter,
          '-map', '[out]', '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-b:v', '0', '-crf', String(crf),
          '-deadline', 'good', '-cpu-used', '4', '-an', '-t', '2.95', '-r', String(FPS), out,
        ],
        { timeout: 180_000 },
      )
      const data = await readFile(out)
      if (data.length > 2_000 && data.length <= TG_VIDEO_MAX) return data
    }
    throw new Error('Hareketli sticker 256 KB sınırına sığmadı. Daha sade bir hareket iste.')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
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
