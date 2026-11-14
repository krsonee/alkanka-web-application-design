import 'server-only'
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { experimental_generateVideo as generateVideo } from 'ai'
import ffmpegPath from 'ffmpeg-static'
import sharp from 'sharp'
import { buildOverlay, type Brush } from '@/lib/studio-overlay'

const run = promisify(execFile)
const VIDEO_MODEL = 'google/veo-3.1-lite-generate-001'
const GIF_FRAMES = 28
const GIF_DELAY_MS = 55
export const AI_GIF_SECONDS = 4

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

export async function videoToGif(video: Buffer, squareCrop: boolean) {
  if (!ffmpegPath) throw new Error('Video dönüştürücü bulunamadı.')
  const dir = await mkdtemp(path.join(tmpdir(), 'aigif-'))
  try {
    const input = path.join(dir, 'in.mp4')
    const output = path.join(dir, 'out.gif')
    await writeFile(input, video)
    const crop = squareCrop ? 'crop=min(iw\\,ih):min(iw\\,ih),' : ''
    await run(ffmpegPath, [
      '-y',
      '-i',
      input,
      '-vf',
      `${crop}fps=14,scale=540:-2:flags=lanczos,split[a][b];[a]palettegen=max_colors=192:stats_mode=diff[p];[b][p]paletteuse=dither=sierra2_4a`,
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
  const [width, height] = format === '16:9' ? [long, short] : [short, long]
  if (format === '16:9' || format === '9:16') {
    const frame = await sharp(image).resize(width, height, { fit: 'cover' }).png().toBuffer()
    return { frame, width, height, art: { left: 0, top: 0, width, height } satisfies Rect }
  }
  // Square banners become a vertical clip: the square sits in the middle of a blurred copy of itself.
  const backdrop = await sharp(image).resize(width, height, { fit: 'cover' }).blur(40).modulate({ brightness: 0.6 }).png().toBuffer()
  const front = await sharp(image).resize(width, height, { fit: 'inside' }).png().toBuffer()
  const meta = await sharp(front).metadata()
  const art: Rect = {
    left: Math.round((width - (meta.width ?? width)) / 2),
    top: Math.round((height - (meta.height ?? width)) / 2),
    width: meta.width ?? width,
    height: meta.height ?? width,
  }
  const frame = await sharp(backdrop).composite([{ input: front, left: art.left, top: art.top }]).png().toBuffer()
  return { frame, width, height, art }
}

/** Burns a still, transparent layer over every frame, so logo and copy stay pixel-sharp while the scene moves. */
async function burnOverlay(video: Buffer, overlay: Buffer) {
  if (!ffmpegPath) throw new Error('Video dönüştürücü bulunamadı.')
  const dir = await mkdtemp(path.join(tmpdir(), 'stamp-'))
  try {
    const input = path.join(dir, 'in.mp4')
    const layer = path.join(dir, 'overlay.png')
    const output = path.join(dir, 'out.mp4')
    await Promise.all([writeFile(input, video), writeFile(layer, overlay)])
    await run(ffmpegPath, [
      '-y',
      '-i',
      input,
      '-i',
      layer,
      '-filter_complex',
      // scale2ref matches the layer to whatever size the model actually returned.
      '[1:v][0:v]scale2ref[layer][base];[base][layer]overlay=format=auto[out]',
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
    return await readFile(output)
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
}: {
  /** The text-free, logo-free picture when `brush` is set; otherwise the finished banner. */
  image: Buffer
  format: string
  motion: string
  duration: number
  audio: boolean
  hd: boolean
  /** Logo and copy to print over the finished clip. Null animates `image` as it is. */
  brush: Brush | null
}) {
  const { frame, width, height, art } = await toVideoFrame(image, format, hd)
  const { video } = await generateVideo({
    model: VIDEO_MODEL,
    prompt: {
      image: new Uint8Array(frame),
      text: [
        'Animate this advertising key visual into a short, premium, eye-catching promo clip.',
        motion || 'Subtle cinematic motion: light sweeps, sparkles and glints, gentle camera push-in, the character moves slightly.',
        brush
          ? 'Do not add any text, letters, numbers, logos or watermarks. Any writing already in the picture must stay static and unchanged.'
          : 'CRITICAL: keep every logo, headline, number and button text perfectly static, sharp and unchanged. Do not add new text.',
      ].join('\n'),
    },
    resolution: hd ? '1920x1080' : '1280x720',
    duration,
    generateAudio: audio,
  })
  const clip = Buffer.from(video.uint8Array)
  const layer = brush ? await buildOverlay(art.width, art.height, brush) : null
  if (!layer) return clip
  const overlay = await sharp({ create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: layer, left: art.left, top: art.top }])
    .png()
    .toBuffer()
  return burnOverlay(clip, overlay)
}
