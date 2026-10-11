import 'server-only'
import { experimental_generateVideo as generateVideo } from 'ai'
import sharp from 'sharp'

const VIDEO_MODEL = 'google/veo-3.1-lite-generate-001'
const GIF_FRAMES = 18
const GIF_DELAY_MS = 70

function shineOverlay(width: number, height: number, progress: number) {
  const band = Math.round(width * 0.32)
  const x = Math.round(-band * 2 + progress * (width + band * 4))
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".42"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs><rect x="${x}" y="${-height}" width="${band}" height="${height * 3}" fill="url(#g)" transform="rotate(20 ${width / 2} ${height / 2})"/></svg>`,
  )
}

export async function makeGif(image: Buffer) {
  const base = await sharp(image).resize({ width: 720, height: 720, fit: 'inside' }).png().toBuffer()
  const { width = 720, height = 720 } = await sharp(base).metadata()
  const frames: Buffer[] = []
  for (let i = 0; i < GIF_FRAMES; i++) {
    const t = i / GIF_FRAMES
    const scale = 1.025 + 0.025 * Math.sin(t * 2 * Math.PI)
    const w = Math.round(width * scale)
    const h = Math.round(height * scale)
    const zoomed = await sharp(base)
      .resize(w, h)
      .extract({ left: Math.floor((w - width) / 2), top: Math.floor((h - height) / 2), width, height })
      .png()
      .toBuffer()
    const shine = t < 0.6 ? [{ input: shineOverlay(width, height, t / 0.6) }] : []
    frames.push(await sharp(zoomed).composite(shine).png().toBuffer())
  }
  return sharp(frames, { join: { animated: true } })
    .gif({ delay: Array(GIF_FRAMES).fill(GIF_DELAY_MS), loop: 0, effort: 7 })
    .toBuffer()
}

async function toVideoFrame(image: Buffer, format: string) {
  const [w, h] = format === '16:9' ? [1280, 720] : [720, 1280]
  if (format === '16:9' || format === '9:16') {
    return sharp(image).resize(w, h, { fit: 'cover' }).png().toBuffer()
  }
  const backdrop = await sharp(image).resize(w, h, { fit: 'cover' }).blur(40).modulate({ brightness: 0.6 }).png().toBuffer()
  const front = await sharp(image).resize(w, h, { fit: 'inside' }).png().toBuffer()
  return sharp(backdrop).composite([{ input: front, gravity: 'center' }]).png().toBuffer()
}

export async function makeVideo({
  image,
  format,
  motion,
  duration,
  audio,
}: {
  image: Buffer
  format: string
  motion: string
  duration: number
  audio: boolean
}) {
  const frame = await toVideoFrame(image, format)
  const { video } = await generateVideo({
    model: VIDEO_MODEL,
    prompt: {
      image: new Uint8Array(frame),
      text: [
        'Animate this advertising banner into a short, premium, eye-catching promo clip.',
        motion || 'Subtle cinematic motion: light sweeps, sparkles and glints, gentle camera push-in, the character moves slightly.',
        'CRITICAL: keep every logo, headline, number and button text perfectly static, sharp and unchanged. Do not add new text.',
      ].join('\n'),
    },
    duration,
    generateAudio: audio,
  })
  return Buffer.from(video.uint8Array)
}
