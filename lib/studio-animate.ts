import 'server-only'
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { experimental_generateVideo as generateVideo } from 'ai'
import ffmpegPath from 'ffmpeg-static'
import sharp from 'sharp'
import { motionText, type Motion } from '@/lib/studio-brief'
import { buildOverlay, type Brush } from '@/lib/studio-overlay'
import { clipToVideoSticker, stickerGreenFrame, STICKER_FRAME } from '@/lib/studio-telegram'
import { STICKER_CLIP_SECONDS, type MotionQuality } from '@/lib/studio-types'

const run = promisify(execFile)
const VIDEO_MODEL = 'google/veo-3.1-lite-generate-001'
const GIF_FRAMES = 28
const GIF_DELAY_MS = 55

function seeded(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return s / 2147483647
  }
}

type Sparkle = { x: number; y: number; size: number; phase: number }

function sparkleField(width: number, height: number): Sparkle[] {
  const rand = seeded(width * 31 + height)
  return Array.from({ length: 9 }, () => ({
    x: Math.round(width * (0.06 + rand() * 0.88)),
    y: Math.round(height * (0.06 + rand() * 0.88)),
    size: Math.round(Math.min(width, height) * (0.025 + rand() * 0.035)),
    phase: rand(),
  }))
}

function star({ x, y, size }: Sparkle, opacity: number) {
  const s = size
  const k = s * 0.18
  return `<path d="M${x} ${y - s} L${x + k} ${y - k} L${x + s} ${y} L${x + k} ${y + k} L${x} ${y + s} L${x - k} ${y + k} L${x - s} ${y} L${x - k} ${y - k} Z" fill="#fff" opacity="${opacity.toFixed(3)}" filter="url(#glow)"/>`
}

// Banner pixels never move: every effect is a light overlay, so logos and text stay perfectly sharp.
function effectOverlay(width: number, height: number, t: number, sparkles: Sparkle[]) {
  const band = Math.round(width * 0.28)
  const sweep = t < 0.55 ? t / 0.55 : -1
  const sweepX = Math.round(-band * 2 + sweep * (width + band * 4))
  const pulse = 0.5 - 0.5 * Math.cos(t * 2 * Math.PI)
  const stars = sparkles
    .map((sp) => {
      const local = (t + sp.phase) % 1
      const opacity = local < 0.35 ? Math.sin((local / 0.35) * Math.PI) : 0
      return opacity > 0.02 ? star({ ...sp, size: Math.round(sp.size * (0.6 + opacity * 0.4)) }, opacity * 0.95) : ''
    })
    .join('')
  const edge = Math.round(Math.min(width, height) * 0.05)
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <defs>
        <linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".45"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <filter id="soft"><feGaussianBlur stdDeviation="${Math.round(edge / 2)}"/></filter>
      </defs>
      <rect x="${edge / 2}" y="${edge / 2}" width="${width - edge}" height="${height - edge}" fill="none" stroke="#fff" stroke-width="${edge}" opacity="${(0.08 + pulse * 0.22).toFixed(3)}" filter="url(#soft)"/>
      ${sweep >= 0 ? `<rect x="${sweepX}" y="${-height}" width="${band}" height="${height * 3}" fill="url(#g)" transform="rotate(20 ${width / 2} ${height / 2})"/>` : ''}
      ${stars}
    </svg>`,
  )
}

export async function makeGif(image: Buffer) {
  const base = await sharp(image).resize({ width: 720, height: 720, fit: 'inside' }).png().toBuffer()
  const { width = 720, height = 720 } = await sharp(base).metadata()
  const sparkles = sparkleField(width, height)
  const frames: Buffer[] = []
  for (let i = 0; i < GIF_FRAMES; i++) {
    const overlay = effectOverlay(width, height, i / GIF_FRAMES, sparkles)
    frames.push(await sharp(base).composite([{ input: overlay }]).png().toBuffer())
  }
  return sharp(frames, { join: { animated: true } })
    .gif({ delay: Array(GIF_FRAMES).fill(GIF_DELAY_MS), loop: 0, effort: 7 })
    .toBuffer()
}

const GIF_SHAPE = {
  sd: { fps: 15, width: 560, colors: 256 },
  hd: { fps: 18, width: 720, colors: 256 },
} as const

export async function videoToGif(video: Buffer, quality: MotionQuality = 'sd') {
  const shape = GIF_SHAPE[quality]
  if (!ffmpegPath) throw new Error('Video dönüştürücü bulunamadı.')
  const dir = await mkdtemp(path.join(tmpdir(), 'aigif-'))
  try {
    const input = path.join(dir, 'in.mp4')
    const output = path.join(dir, 'out.gif')
    await writeFile(input, video)
    await run(ffmpegPath, [
      '-y',
      '-i',
      input,
      '-vf',
      `fps=${shape.fps},scale=${shape.width}:-2:flags=lanczos,split[a][b];[a]palettegen=max_colors=${shape.colors}:stats_mode=full[p];[b][p]paletteuse=dither=sierra2_4a`,
      '-loop',
      '0',
      output,
    ])
    return await readFile(output)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

type Rect = { left: number; top: number; width: number; height: number }

/** Fits the picture into the clip's frame. `art` is where the picture itself sits inside that frame. */
async function toVideoFrame(image: Buffer, format: string, hd: boolean) {
  const [long, short] = hd ? [1920, 1080] : [1280, 720]
  const [width, height] = format === '9:16' ? [short, long] : [long, short]
  if (format === '16:9' || format === '9:16') {
    const frame = await sharp(image).resize(width, height, { fit: 'cover' }).png().toBuffer()
    return { frame, width, height, art: { left: 0, top: 0, width, height } satisfies Rect }
  }
  // The model only renders 16:9 and 9:16. A square banner goes in as the middle of a wide frame,
  // padded with a blurred copy of itself, and the finished clip is cut back to that square.
  const art: Rect = { left: (width - height) / 2, top: 0, width: height, height }
  const backdrop = await sharp(image).resize(width, height, { fit: 'cover' }).blur(40).modulate({ brightness: 0.6 }).png().toBuffer()
  const front = await sharp(image).resize(art.width, art.height, { fit: 'cover' }).png().toBuffer()
  const frame = await sharp(backdrop).composite([{ input: front, left: art.left, top: art.top }]).png().toBuffer()
  return { frame, width, height, art }
}

/** Reads the frame size from ffmpeg's stream report; it exits non-zero when given no output file. */
async function videoSize(ffmpeg: string, file: string) {
  const report = await run(ffmpeg, ['-hide_banner', '-i', file]).then(
    (r) => r.stderr,
    (error: { stderr?: string }) => String(error.stderr ?? ''),
  )
  const match = /Video:.*?\b(\d{3,5})x(\d{3,5})\b/.exec(report)
  return match ? { width: Number(match[1]), height: Number(match[2]) } : null
}

const even = (n: number) => Math.round(n / 2) * 2

/**
 * Re-encodes the model's clip: cuts it down to `crop` when the picture only fills part of the
 * frame, then burns the still, transparent `overlay` over every frame, so logo and copy stay
 * pixel-sharp while the scene moves. `frame` is the size that was requested from the model.
 */
async function finishClip(video: Buffer, frame: { width: number; height: number }, crop: Rect | null, overlay: Buffer | null) {
  if (!ffmpegPath) throw new Error('Video dönüştürücü bulunamadı.')
  const dir = await mkdtemp(path.join(tmpdir(), 'stamp-'))
  try {
    const input = path.join(dir, 'in.mp4')
    const layer = path.join(dir, 'overlay.png')
    const output = path.join(dir, 'out.mp4')
    await writeFile(input, video)
    // The model may return a size other than the one requested, so the cut and the layer are fitted
    // to the real clip. (ffmpeg's scale2ref cannot do this: with a still image it emits no frames.)
    const real = (await videoSize(ffmpegPath, input)) ?? frame
    const scale = real.width / frame.width
    const cut = crop && {
      width: even(crop.width * scale),
      height: even(crop.height * scale),
      left: Math.round(crop.left * scale),
      top: Math.round(crop.top * scale),
    }
    const size = cut ?? real
    if (overlay) await writeFile(layer, await sharp(overlay).resize(size.width, size.height, { fit: 'fill' }).png().toBuffer())
    const cropped = cut ? `[0:v]crop=${cut.width}:${cut.height}:${cut.left}:${cut.top}` : ''
    const filter = !overlay
      ? `${cropped}[out]`
      : cut
        ? `${cropped}[cut];[cut][1:v]overlay=0:0:format=auto[out]`
        : '[0:v][1:v]overlay=0:0:format=auto[out]'
    await run(ffmpegPath, [
      '-y',
      '-i',
      input,
      ...(overlay ? ['-i', layer] : []),
      '-filter_complex',
      filter,
      '-map',
      '[out]',
      '-map',
      '0:a?',
      '-c:v',
      'libx264',
      '-preset',
      'medium',
      '-crf',
      '17',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'copy',
      '-movflags',
      '+faststart',
      output,
    ])
    const stamped = await readFile(output)
    // ffmpeg exits 0 even when it encoded nothing; never hand back a file that cannot play.
    if (stamped.length < 10_000) throw new Error('Video son haline getirilemedi.')
    return stamped
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

export async function makeVideo({
  image,
  format,
  motion,
  duration,
  audio,
  hd,
  brush,
  onBilled,
}: {
  /** Called once the model has returned the clip, which is the point the job costs money. */
  onBilled?: () => void
  /** The text-free, logo-free picture when `brush` is set; otherwise the finished banner. */
  image: Buffer
  format: string
  motion: Motion
  duration: number
  audio: boolean
  hd: boolean
  /** Logo and copy to print over the finished clip. Null animates `image` as it is. */
  brush: Brush | null
}) {
  const { frame, width, height, art } = await toVideoFrame(image, format, hd)
  const padded = art.width < width || art.height < height
  const { video } = await generateVideo({
    model: VIDEO_MODEL,
    prompt: {
      image: new Uint8Array(frame),
      text: [
        'Animate this advertising key visual into a short, premium, eye-catching promo clip. It is the first frame; the picture itself (its characters, objects and layout) stays what it is.',
        motionText(motion, padded),
        padded
          ? 'Only the sharp square in the middle is the picture; the soft areas on both sides are padding that is cut off afterwards. Keep the camera locked on that square: no panning, no tilting, no zooming out.'
          : '',
        brush
          ? 'Do not add any text, letters, numbers, logos or watermarks. Any writing already in the picture must stay static and unchanged.'
          : 'CRITICAL: keep every logo, headline, number and button text perfectly static, sharp and unchanged. Do not add new text.',
      ]
        .filter(Boolean)
        .join('\n'),
    },
    resolution: hd ? '1920x1080' : '1280x720',
    duration,
    generateAudio: audio,
  })
  onBilled?.()
  const clip = Buffer.from(video.uint8Array)
  const overlay = brush ? await buildOverlay(art.width, art.height, brush, image) : null
  return padded || overlay ? finishClip(clip, { width, height }, padded ? art : null, overlay) : clip
}

/**
 * A Telegram video sticker whose character really moves: the cut-out sticker is animated on a green
 * screen by the video model, and the green is removed again afterwards.
 */
export async function makeMotionSticker(image: Buffer, motion: Motion, onBilled?: () => void) {
  const { video } = await generateVideo({
    model: VIDEO_MODEL,
    prompt: {
      image: new Uint8Array(await stickerGreenFrame(image)),
      text: [
        'This is a sticker on a green screen. Animate the sticker itself, as a short, lively reaction sticker.',
        motion.action
          ? motionText(motion, true)
          : 'The character blinks, breathes and makes one small, friendly gesture.\nThe camera is locked off and does not move.',
        'Every part of the sticker stays in the picture, whole, for the entire clip: the character, every object next to it, its outline and all of its writing. Nothing fades out, disappears, melts, gets cut off or turns into something else.',
        'The sticker keeps its size and stays in the middle. It must stay completely inside the frame and never touch the frame edges; there is free green space around it for the movement.',
        'Any writing on the sticker keeps the same letters in the same place and stays readable in every frame.',
        'The background is a green screen: it MUST stay perfectly flat, solid pure green (#00FF00) in every frame, edge to edge. No shadows on the background, no floor, no gradients.',
        'Nothing new may appear on the green: no words, letters, titles or banners, no copies of the writing on the sticker, no lightning, sparks, glow, smoke, confetti, particles or new objects.',
      ].join('\n'),
    },
    resolution: `${STICKER_FRAME.width}x${STICKER_FRAME.height}`,
    duration: STICKER_CLIP_SECONDS,
    generateAudio: false,
  })
  onBilled?.()
  return clipToVideoSticker(Buffer.from(video.uint8Array), image)
}
