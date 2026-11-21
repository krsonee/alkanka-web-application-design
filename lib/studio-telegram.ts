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

type Box = { left: number; top: number; width: number; height: number }

const even = (n: number) => Math.max(2, Math.round(n / 2) * 2)

/** Box around every pixel whose last channel is above `floor`; null when nothing is. */
function boxOf(data: Buffer, width: number, height: number, channels: number, floor: number): Box | null {
  let left = width
  let top = height
  let right = -1
  let bottom = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * channels + channels - 1] <= floor) continue
      if (x < left) left = x
      if (x > right) right = x
      if (y < top) top = y
      if (y > bottom) bottom = y
    }
  }
  return right < 0 ? null : { left, top, width: right - left + 1, height: bottom - top + 1 }
}

/**
 * The picture without its empty border. Telegram shows every sticker in the same square, so art
 * that floats in the middle of its canvas comes out small in the chat.
 */
async function tight(image: Buffer) {
  const { data, info } = await sharp(image).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const box = boxOf(data, info.width, info.height, info.channels, 12)
  const whole = !box || (box.width === info.width && box.height === info.height)
  const picture = sharp(data, { raw: info })
  return (whole ? picture : picture.extract(box)).png().toBuffer()
}

/**
 * Encoder settings from best to smallest. `crf` caps the quality and `rate` the size, so a simple
 * sticker stays sharp and a busy one still spends nearly the whole 256 KB instead of half of it.
 */
const QUALITY_STEPS = [
  { crf: 18, rate: '640k' },
  { crf: 24, rate: '540k' },
  { crf: 32, rate: '420k' },
  { crf: 42, rate: '300k' },
  { crf: 54, rate: '180k' },
] as const

/** VP9 with transparency, no sound, no leftover tags from the source clip. */
const vp9 = (step: (typeof QUALITY_STEPS)[number], seconds: string) => [
  '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-b:v', step.rate, '-crf', String(step.crf),
  '-deadline', 'good', '-cpu-used', '2', '-row-mt', '1', '-an', '-map_metadata', '-1',
  '-t', seconds, '-r', String(FPS),
]

type VideoFacts = { webm: boolean; codec: string; width: number; height: number; seconds: number; fps: number; audio: boolean }

/** Reads a finished file back through ffmpeg's stream report; it exits non-zero when given no output. */
async function inspect(ffmpeg: string, file: string): Promise<VideoFacts> {
  const report = await run(ffmpeg, ['-hide_banner', '-i', file]).then(
    (r) => r.stderr,
    (error: { stderr?: string }) => String(error.stderr ?? ''),
  )
  const video = /Video: (\w+).*?\b(\d{2,4})x(\d{2,4})\b/.exec(report)
  const time = /Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/.exec(report)
  const fps = /(\d+(?:\.\d+)?) fps/.exec(report)
  return {
    webm: /matroska,webm/.test(report),
    codec: video?.[1] ?? '',
    width: Number(video?.[2] ?? 0),
    height: Number(video?.[3] ?? 0),
    seconds: time ? Number(time[1]) * 3600 + Number(time[2]) * 60 + Number(time[3]) : 0,
    fps: Number(fps?.[1] ?? 0),
    audio: /Audio:/.test(report),
  }
}

/**
 * Telegram's published list for a video sticker, checked on the file that is about to be handed
 * out: WEBM, VP9, no sound, one side exactly 512 px and the other no larger, at most 3 seconds,
 * 30 fps and 256 KB. Returns what is wrong, or null.
 */
function stickerFault(facts: VideoFacts, bytes: number) {
  if (!facts.webm || facts.codec !== 'vp9') return 'dosya WEBM / VP9 değil'
  if (facts.audio) return 'dosyada ses var'
  const longer = Math.max(facts.width, facts.height)
  if (longer !== SIZE) return `uzun kenar ${longer} px, 512 px olmalı`
  if (!facts.seconds || facts.seconds > 3) return `süre ${facts.seconds.toFixed(2)} sn, en fazla 3 sn olmalı`
  if (!facts.fps || facts.fps > 30) return `${facts.fps} kare/sn, en fazla 30 olmalı`
  if (bytes > TG_VIDEO_MAX) return TOO_BIG
  return null
}

const TOO_BIG = '256 KB sınırına sığmadı'

/** "512x484 · 2,9 sn" for the label of a finished video sticker. */
export async function videoStickerFacts(data: Buffer) {
  if (!ffmpegPath) return ''
  const dir = await mkdtemp(path.join(tmpdir(), 'tgf-'))
  try {
    const file = path.join(dir, 'sticker.webm')
    await writeFile(file, data)
    const facts = await inspect(ffmpegPath, file)
    return facts.width ? `${facts.width}x${facts.height} · ${facts.seconds.toFixed(1).replace('.', ',')} sn` : ''
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

export async function fitStaticSticker(image: Buffer) {
  const base = sharp(await tight(image)).resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
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
  const art = await sharp(await tight(image)).resize(inner, inner, { fit: 'contain', background: CLEAR }).png().toBuffer()
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
  const art = await sharp(await tight(image))
    .resize(Math.round(height * ART_SHARE), Math.round(height * ART_SHARE), { fit: 'contain', background: CLEAR })
    .png()
    .toBuffer()
  return sharp({ create: { width, height, channels: 3, background: KEY_GREEN } })
    .composite([{ input: art, gravity: 'centre' }])
    .png()
    .toBuffer()
}

/** Share of the frame height the sticker fills on the green frame. */
const ART_SHARE = 0.9
/** How far, in pixels of the finished sticker, the character may move outside its still shape. */
const MOVE_ROOM = 14

/**
 * The part of the finished sticker the character may show in: its own still shape, grown by
 * `MOVE_ROOM`, as a 512 px grey picture. The model sometimes paints words, sparks or a glow on the
 * green; they are not green, so the key keeps them, and only this shape can cut them away.
 */
export async function stickerShape(image: Buffer) {
  const inner = Math.round(SIZE * ART_SHARE)
  const art = await sharp(await tight(image)).resize(inner, inner, { fit: 'contain', background: CLEAR }).png().toBuffer()
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
    // Only the part of the frame the character can be in is kept, and it is scaled until its longer
    // side is 512 px: Telegram wants one side at exactly 512 and the sticker to fill it.
    const square = await sharp(shape).resize(SIZE, SIZE, { fit: 'fill' }).extractChannel(0).png().toBuffer()
    const grey = await sharp(square).raw().toBuffer()
    const box = boxOf(grey, SIZE, SIZE, 1, 8) ?? { left: 0, top: 0, width: SIZE, height: SIZE }
    const longer = Math.max(box.width, box.height)
    const width = box.width === longer ? SIZE : even((SIZE * box.width) / longer)
    const height = box.height === longer ? SIZE : even((SIZE * box.height) / longer)
    await writeFile(mask, await sharp(square).extract(box).resize(width, height, { fit: 'fill' }).png().toBuffer())
    const key = await keyColour(ffmpegPath, input, dir)
    const keyed = [
      `[0:v]trim=0:3,setpts=(PTS-STARTPTS)/2,fps=${FPS},crop=ih:ih:(iw-ih)/2:0`,
      `chromakey=${key}:0.16:0.07,despill=type=green:mix=0.7`,
      `crop=iw*${box.width}/${SIZE}:ih*${box.height}/${SIZE}:iw*${box.left}/${SIZE}:ih*${box.top}/${SIZE}`,
      `scale=${width}:${height}:flags=lanczos,unsharp=3:3:0.6,format=yuva420p,split[colour][keyed]`,
    ].join(',')
    const filter = [
      keyed,
      '[keyed]alphaextract[seen]',
      '[1:v]format=gray[shape]',
      '[seen][shape]blend=all_mode=multiply:shortest=1[alpha]',
      '[colour][alpha]alphamerge,split[fwd][src]',
      '[src]reverse[back]',
      '[fwd][back]concat=n=2:v=1,format=yuva420p[out]',
    ].join(';')
    for (const step of QUALITY_STEPS) {
      await run(
        ffmpegPath,
        [
          '-y', '-loglevel', 'error', '-i', input, '-loop', '1', '-framerate', String(FPS), '-i', mask,
          '-filter_complex', filter,
          '-map', '[out]', ...vp9(step, '2.95'), out,
        ],
        { timeout: 180_000 },
      )
      const data = await readFile(out)
      const fault = data.length > 2_000 ? stickerFault(await inspect(ffmpegPath, out), data.length) : TOO_BIG
      if (!fault) return data
      if (fault !== TOO_BIG) throw new Error(`Hareketli sticker Telegram şartlarına uymadı: ${fault}.`)
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
  const art = await sharp(await tight(image))
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
    for (const step of QUALITY_STEPS) {
      await run(
        ffmpegPath,
        [
          '-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(dir, 'f%03d.png'),
          ...vp9(step, '2.95'), out,
        ],
        { timeout: 120_000 },
      )
      const data = await readFile(out)
      const fault = stickerFault(await inspect(ffmpegPath, out), data.length)
      if (!fault) return data
      if (fault !== TOO_BIG) throw new Error(`Hareketli sticker Telegram şartlarına uymadı: ${fault}.`)
    }
    throw new Error('Hareketli sticker 256 KB sınırına sığmadı.')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}
