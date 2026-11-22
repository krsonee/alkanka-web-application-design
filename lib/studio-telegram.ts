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
/** Side of the full-quality copy kept next to every sticker; downloads and animations start from it. */
const MASTER = 1024
const FPS = 30
const SECONDS = 2.8
const CLIP_SECONDS = '2.95'

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
 * Encoder settings from best to smallest. The first steps ask for a fixed, high quality with no size
 * target (`rate` 0); a simple sticker passes there untouched. A busy one drops to 24 frames a second
 * first, which gives every frame a quarter more of the 256 KB, and only then gives up sharpness.
 */
const QUALITY_STEPS = [
  { fps: 30, crf: 20, rate: '0' },
  { fps: 24, crf: 20, rate: '0' },
  { fps: 24, crf: 26, rate: '620k' },
  { fps: 24, crf: 32, rate: '520k' },
  { fps: 24, crf: 40, rate: '380k' },
  { fps: 20, crf: 48, rate: '260k' },
  { fps: 20, crf: 56, rate: '160k' },
] as const
type Step = (typeof QUALITY_STEPS)[number]

/** VP9 with transparency, no sound, no leftover tags from the source clip. */
const vp9 = (step: Step) => [
  '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-b:v', step.rate, '-crf', String(step.crf),
  '-deadline', 'good', '-cpu-used', '1', '-row-mt', '1', '-auto-alt-ref', '0', '-an', '-map_metadata', '-1',
  '-t', CLIP_SECONDS, '-r', String(step.fps),
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

/**
 * Encodes a video sticker at the best step of `QUALITY_STEPS` that fits Telegram's list. `inputs` are
 * the ffmpeg input arguments and `chain` the filter graph for a frame rate; it must end in `[out]`.
 */
async function encodeSticker(ffmpeg: string, dir: string, inputs: string[], chain: (fps: number) => string) {
  const out = path.join(dir, 'out.webm')
  for (const step of QUALITY_STEPS) {
    await run(ffmpeg, ['-y', '-loglevel', 'error', ...inputs, '-filter_complex', chain(step.fps), '-map', '[out]', ...vp9(step), out], {
      timeout: 180_000,
    })
    const data = await readFile(out)
    const fault = data.length > 2_000 ? stickerFault(await inspect(ffmpeg, out), data.length) : TOO_BIG
    if (!fault) return data
    if (fault !== TOO_BIG) throw new Error(`Hareketli sticker Telegram şartlarına uymadı: ${fault}.`)
  }
  throw new Error('Hareketli sticker 256 KB sınırına sığmadı. Daha sade bir hareket iste.')
}

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

const CLEAR = { r: 0, g: 0, b: 0, alpha: 0 }

/** The sticker scaled once, with the sharpest filter, into a transparent square of `side` pixels. */
const fitted = async (image: Buffer, side: number) =>
  sharp(await tight(image)).resize(side, side, { fit: 'contain', background: CLEAR, kernel: 'lanczos3' })

/**
 * The 512 px WEBP Telegram asks for. Saved without loss whenever that fits the 512 KB limit, which a
 * sticker nearly always does; only an unusually detailed one is compressed, as lightly as possible.
 */
export async function fitStaticSticker(image: Buffer) {
  const base = await fitted(image, SIZE)
  const tries = [
    { lossless: true, effort: 6 },
    { nearLossless: true, quality: 80, effort: 6 },
    { nearLossless: true, quality: 50, effort: 6 },
    ...[95, 88, 80, 70, 58, 45].map((quality) => ({ quality, alphaQuality: 100, effort: 6 })),
  ]
  for (const options of tries) {
    const out = await base.clone().webp(options).toBuffer()
    if (out.length <= TG_STATIC_MAX) return out
  }
  return base.webp({ quality: 35, alphaQuality: 90 }).toBuffer()
}

const STROKE = 9

/**
 * Puts an even white edge around a cut-out sticker and returns it as a square PNG of `side` pixels.
 * The edge is the sticker's own shape grown outwards, so it follows every curve and hides leftover
 * key colour.
 */
export async function outlineSticker(image: Buffer, side = SIZE) {
  const stroke = (STROKE * side) / SIZE
  const art = await (await fitted(image, Math.round(side - (stroke + 3) * 2))).png().toBuffer()
  const placed = await sharp({ create: { width: side, height: side, channels: 4, background: CLEAR } })
    .composite([{ input: art, gravity: 'centre' }])
    .png()
    .toBuffer()
  // A blurred mask cut off at a low level is the shape grown by about 1.5 sigma. Each step is its
  // own pipeline: sharp keeps only the last blur of a chain and runs threshold in a fixed place.
  const blurred = await sharp(placed).extractChannel('alpha').blur(stroke / 1.5).png().toBuffer()
  const hard = await sharp(blurred).threshold(18).png().toBuffer()
  const grown = await sharp(hard).blur((0.8 * side) / SIZE).extractChannel(0).png().toBuffer()
  const edge = await sharp({ create: { width: side, height: side, channels: 3, background: { r: 255, g: 255, b: 255 } } })
    .joinChannel(grown)
    .png()
    .toBuffer()
  return sharp(edge).composite([{ input: placed }]).png().toBuffer()
}

/**
 * The full-quality sticker: a transparent 1024 px PNG, with the white edge when `outline` is set.
 * The Telegram file is made from it, and so is every animation, so nothing is ever built on a
 * picture that was already shrunk and compressed.
 */
export async function stickerMaster(image: Buffer, outline: boolean) {
  return outline ? outlineSticker(image, MASTER) : (await fitted(image, MASTER)).png().toBuffer()
}

const RIM_SIDE = 256
const RIM_REACH = 2

/** True when a cut-out sticker carries a white edge all the way round, the way `outlineSticker` draws it. */
export async function whiteEdged(image: Buffer) {
  const { data, info } = await sharp(image)
    .ensureAlpha()
    .resize(RIM_SIDE, RIM_SIDE, { fit: 'inside' })
    .raw()
    .toBuffer({ resolveWithObject: true })
  const { width, height } = info
  const clear = (x: number, y: number) => x < 0 || y < 0 || x >= width || y >= height || data[(y * width + x) * 4 + 3] < 40
  let rim = 0
  let white = 0
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      if (data[i + 3] < 220) continue
      if (!clear(x - RIM_REACH, y) && !clear(x + RIM_REACH, y) && !clear(x, y - RIM_REACH) && !clear(x, y + RIM_REACH)) continue
      rim++
      if (Math.min(data[i], data[i + 1], data[i + 2]) > 225) white++
    }
  }
  return rim > 0 && white / rim > 0.75
}

const KEY_GREEN = { r: 0, g: 255, b: 0 }

/** The sticker back on a flat green square, the way the image model is asked to return stickers. */
export async function stickerOnGreen(image: Buffer) {
  const art = await (await fitted(image, Math.round(MASTER * 0.84))).png().toBuffer()
  return sharp({ create: { width: MASTER, height: MASTER, channels: 3, background: KEY_GREEN } })
    .composite([{ input: art, gravity: 'centre' }])
    .png()
    .toBuffer()
}

export const STICKER_FRAME = { width: 1280, height: 720 } as const
/**
 * Share of the frame height the sticker fills on the green frame. The rest is room to move: an arm
 * that is raised or a character that leans stays inside the frame instead of being cut by its edge.
 */
const ART_SHARE = 0.74

/**
 * The frame handed to the video model: the sticker in the middle of a flat green 16:9 frame, with
 * room around it to move. The green is keyed out again in `clipToVideoSticker`.
 */
export async function stickerGreenFrame(image: Buffer) {
  const { width, height } = STICKER_FRAME
  const art = await (await fitted(image, Math.round(height * ART_SHARE))).png().toBuffer()
  return sharp({ create: { width, height, channels: 3, background: KEY_GREEN } })
    .composite([{ input: art, gravity: 'centre' }])
    .png()
    .toBuffer()
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

/** Side of the square the clip is worked on: the full height of the frame the model is asked for. */
const WORK: number = STICKER_FRAME.height
/** Opacity from which a pixel counts as part of something drawn, not as a faint trace of the key. */
const SOLID = 24

/** Where the still sticker sits in the worked square: the place the character starts every clip from. */
async function stillShape(image: Buffer) {
  const art = await (await fitted(image, Math.round(WORK * ART_SHARE))).png().toBuffer()
  return sharp({ create: { width: WORK, height: WORK, channels: 4, background: CLEAR } })
    .composite([{ input: art, gravity: 'centre' }])
    .extractChannel('alpha')
    .raw()
    .toBuffer()
}

/**
 * Keeps, in every frame, only what is joined to the sticker and clears everything else. The sticker
 * is found by where it stood in the still picture and followed outwards from there, so an arm that
 * swings far out or a sign that tilts stays whole, while words, sparks or shapes the model painted
 * elsewhere on the green are not joined to it and go. Returns the box all frames together fill.
 */
function keepSticker(frames: Buffer, count: number, shape: Buffer): Box {
  const pixels = WORK * WORK
  const seen = new Uint8Array(pixels)
  const queue = new Int32Array(pixels)
  let left = WORK
  let top = WORK
  let right = -1
  let bottom = -1
  for (let f = 0; f < count; f++) {
    const base = f * pixels * 4
    const solid = (p: number) => frames[base + p * 4 + 3] > SOLID
    seen.fill(0)
    let head = 0
    let tail = 0
    for (let p = 0; p < pixels; p++) {
      if (shape[p] > 128 && solid(p)) {
        seen[p] = 1
        queue[tail++] = p
      }
    }
    const reach = (p: number) => {
      if (seen[p] || !solid(p)) return
      seen[p] = 1
      queue[tail++] = p
    }
    while (head < tail) {
      const p = queue[head++]
      const x = p % WORK
      if (x > 0) reach(p - 1)
      if (x < WORK - 1) reach(p + 1)
      if (p >= WORK) reach(p - WORK)
      if (p < pixels - WORK) reach(p + WORK)
    }
    if (tail > pixels * 0.95) throw new Error('Hareketli sticker üretilemedi: model yeşil zemini korumadı. Bir kez daha dene.')
    for (let p = 0; p < pixels; p++) {
      const alpha = base + p * 4 + 3
      if (!frames[alpha]) continue
      if (!seen[p]) {
        // The soft rim of the sticker is fainter than `SOLID` but touches a kept pixel; it stays.
        const x = p % WORK
        const rim =
          (x > 0 && seen[p - 1] === 1) || (x < WORK - 1 && seen[p + 1] === 1) || (p >= WORK && seen[p - WORK] === 1) || (p < pixels - WORK && seen[p + WORK] === 1)
        if (!rim) {
          frames[alpha] = 0
          continue
        }
      }
      if (frames[alpha] <= 12) continue
      const x = p % WORK
      const y = (p - x) / WORK
      if (x < left) left = x
      if (x > right) right = x
      if (y < top) top = y
      if (y > bottom) bottom = y
    }
  }
  if (right < 0) throw new Error('Hareketli sticker üretilemedi: videoda sticker bulunamadı. Bir kez daha dene.')
  const pad = 2
  const x0 = Math.max(0, left - pad)
  const y0 = Math.max(0, top - pad)
  return { left: x0, top: y0, width: Math.min(WORK, right + pad + 1) - x0, height: Math.min(WORK, bottom + pad + 1) - y0 }
}

/**
 * Turns the model's green-screen clip into a Telegram video sticker: the green removed, everything
 * that is not the sticker cleared (see `keepSticker`), cut to the space the moving sticker really
 * uses, longer side 512 px, VP9 with transparency, under 256 KB. The first three seconds play at
 * double speed and then backwards, so the three-second loop has no jump. `still` is the sticker the
 * clip was made from.
 */
export async function clipToVideoSticker(video: Buffer, still: Buffer) {
  if (!ffmpegPath) throw new Error('Video dönüştürücü bulunamadı.')
  const dir = await mkdtemp(path.join(tmpdir(), 'tgm-'))
  try {
    const input = path.join(dir, 'in.mp4')
    const raw = path.join(dir, 'frames.rgba')
    const cut = path.join(dir, 'cut.rgba')
    await writeFile(input, video)
    const key = await keyColour(ffmpegPath, input, dir)
    await run(
      ffmpegPath,
      [
        '-y', '-loglevel', 'error', '-i', input,
        '-vf',
        [
          `trim=0:3,setpts=(PTS-STARTPTS)/2,fps=${FPS},crop=ih:ih:(iw-ih)/2:0,scale=${WORK}:${WORK}:flags=lanczos`,
          `chromakey=${key}:0.16:0.07,despill=type=green:mix=0.7,format=rgba`,
        ].join(','),
        '-f', 'rawvideo', '-pix_fmt', 'rgba', raw,
      ],
      { timeout: 180_000 },
    )
    const frames = await readFile(raw)
    const frameBytes = WORK * WORK * 4
    const count = Math.floor(frames.length / frameBytes)
    if (count < 8) throw new Error('Hareketli sticker üretilemedi: model boş bir video döndürdü. Bir kez daha dene.')
    const box = keepSticker(frames, count, await stillShape(still))

    const rowBytes = box.width * 4
    const cropped = Buffer.allocUnsafe(count * box.height * rowBytes)
    for (let f = 0; f < count; f++) {
      for (let y = 0; y < box.height; y++) {
        const from = f * frameBytes + ((box.top + y) * WORK + box.left) * 4
        frames.copy(cropped, (f * box.height + y) * rowBytes, from, from + rowBytes)
      }
    }
    await writeFile(cut, cropped)

    const longer = Math.max(box.width, box.height)
    const width = box.width === longer ? SIZE : even((SIZE * box.width) / longer)
    const height = box.height === longer ? SIZE : even((SIZE * box.height) / longer)
    // Colour is scaled with its opacity folded in; otherwise the cleared pixels' colour leaks into
    // the rim and the sticker gets a dirty edge.
    const chain = (fps: number) =>
      [
        `[0:v]format=gbrap,premultiply=inplace=1,scale=${width}:${height}:flags=lanczos,unpremultiply=inplace=1,format=yuva420p,unsharp=3:3:0.5,split[fwd][src]`,
        '[src]reverse[back]',
        `[fwd][back]concat=n=2:v=1,fps=${fps},format=yuva420p[out]`,
      ].join(';')
    return await encodeSticker(
      ffmpegPath,
      dir,
      ['-f', 'rawvideo', '-pixel_format', 'rgba', '-video_size', `${box.width}x${box.height}`, '-framerate', String(FPS), '-i', cut],
      chain,
    )
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

export async function makeStickerIcon(image: Buffer) {
  const base = await fitted(image, 100)
  for (const quality of [100, 90, 75, 60, 45]) {
    const out = await base.clone().webp({ quality, alphaQuality: 100 }).toBuffer()
    if (out.length <= TG_ICON_MAX) return out
  }
  return base.webp({ quality: 30 }).toBuffer()
}

async function stickerFrames(image: Buffer, dir: string) {
  const inner = Math.round(SIZE * 0.86)
  const art = await (await fitted(image, inner)).png().toBuffer()
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
      .rotate(angle, { background: CLEAR })
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
    await sharp({ create: { width: SIZE, height: SIZE, channels: 4, background: CLEAR } })
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
    return await encodeSticker(
      ffmpegPath,
      dir,
      ['-framerate', String(FPS), '-i', path.join(dir, 'f%03d.png')],
      (fps) => `[0:v]fps=${fps},format=yuva420p[out]`,
    )
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}
