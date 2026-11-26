import 'server-only'
import { generateText, jsonSchema, Output } from 'ai'
import sharp, { type Sharp } from 'sharp'
import { closeHold, holdBudget } from '@/lib/studio-budget'
import {
  cleanLook,
  DEFAULT_COLORS,
  DEFAULT_LOOK,
  EFFECTS,
  hex,
  luminance,
  mix,
  MOTION_FONTS,
  PACES,
  REVEALS,
  saturation,
  TEXTURES,
  TRANSITIONS,
  type MotionColors,
  type MotionLook,
  type PaceId,
} from './spec'

/**
 * Reading an example banner. Only its manner is taken: how it cuts, how the copy comes in, how fast it
 * runs, what its surface and colours are. None of its words, its logo or its pictures are kept, so a
 * film made after it shares the manner and nothing else.
 */

const MODEL = 'google/gemini-3.5-flash'
export const MOTION_STUDY_COST = 0.003
const SHOTS = 16

export type Study = { look: MotionLook; colors: MotionColors; note: string; seconds: number; sheet: Buffer; read: boolean }

type Shot = { png: Buffer; small: { data: Buffer; channels: number } }

/**
 * An example arrives as the file itself, or as frames the browser already picked out of it: a GIF too
 * heavy for one request is sampled on the screen and only its frames are sent.
 */
export type ExampleSource = { file: Buffer } | { shots: Buffer[]; seconds: number }

async function shotOf(frame: Sharp): Promise<Shot> {
  const png = await frame.clone().png().toBuffer()
  const { data, info } = await frame.clone().resize({ width: 96, height: 96, fit: 'inside' }).raw().toBuffer({ resolveWithObject: true })
  return { png, small: { data, channels: info.channels } }
}

const flat = (image: Buffer, page = 0) => sharp(image, { page }).flatten({ background: '#000000' })

async function sample(source: ExampleSource) {
  if ('shots' in source) {
    const picked = source.shots.slice(0, SHOTS)
    const meta = picked.length ? await sharp(picked[0]).metadata() : null
    const width = meta?.width ?? 0
    const height = meta?.height ?? 0
    if (width < 8 || height < 8) throw new Error('Bu dosya okunamadı.')
    const frames: Shot[] = []
    for (const png of picked) frames.push(await shotOf(flat(png).resize(width, height, { fit: 'fill' })))
    return { shots: frames, width, height, seconds: Math.max(0, Math.min(120, source.seconds)) }
  }
  const meta = await sharp(source.file, { animated: true }).metadata()
  const pages = meta.pages ?? 1
  const width = meta.width ?? 0
  const height = meta.pageHeight ?? meta.height ?? 0
  if (width < 8 || height < 8) throw new Error('Bu dosya okunamadı.')
  const seconds = pages > 1 ? (meta.delay ?? []).reduce((sum, ms) => sum + ms, 0) / 1000 : 0
  const count = Math.min(SHOTS, pages)
  const frames: Shot[] = []
  for (let i = 0; i < count; i++) frames.push(await shotOf(flat(source.file, count === 1 ? 0 : Math.round((i * (pages - 1)) / (count - 1)))))
  return { shots: frames, width, height, seconds }
}

/** Every sampled frame on one sheet, in order, for the model to read the film from. */
async function contactSheet(frames: Shot[], width: number, height: number) {
  const strip = width / height >= 2.2
  const cols = strip ? 2 : width / height < 0.6 ? Math.min(frames.length, 8) : 4
  const cell = strip ? 520 : width / height < 0.6 ? 110 : 250
  const w = cell
  const h = Math.max(8, Math.round((cell * height) / width))
  const gap = 6
  const tiles = await Promise.all(
    frames.map(async (shot, i) => ({
      input: await sharp(shot.png).resize(w, h, { fit: 'fill' }).png().toBuffer(),
      left: (i % cols) * (w + gap),
      top: Math.floor(i / cols) * (h + gap),
    })),
  )
  const rows = Math.ceil(frames.length / cols)
  return sharp({ create: { width: cols * (w + gap) - gap, height: rows * (h + gap) - gap, channels: 3, background: '#ff00ff' } })
    .composite(tiles)
    .webp({ quality: 82 })
    .toBuffer()
}

type Bucket = { r: number; g: number; b: number; n: number }

/** The colours the film is made of, counted from its frames rather than asked of a model. */
export function measuredColors(frames: { data: Buffer; channels: number }[]): MotionColors {
  const buckets = new Map<number, Bucket>()
  let total = 0
  for (const { data, channels } of frames) {
    for (let p = 0; p + 2 < data.length; p += channels) {
      const key = ((data[p] >> 3) << 10) | ((data[p + 1] >> 3) << 5) | (data[p + 2] >> 3)
      const bucket = buckets.get(key)
      if (bucket) {
        bucket.r += data[p]
        bucket.g += data[p + 1]
        bucket.b += data[p + 2]
        bucket.n++
      } else buckets.set(key, { r: data[p], g: data[p + 1], b: data[p + 2], n: 1 })
      total++
    }
  }
  if (!total) return DEFAULT_COLORS
  const seen = [...buckets.values()].map((b) => ({ color: hex(b.r / b.n, b.g / b.n, b.b / b.n), share: b.n / total })).sort((a, b) => b.share - a.share)
  const lively = (color: string) => saturation(color) > 0.5 && luminance(color) > 0.42
  const pale = (color: string) => luminance(color) > 0.88 && saturation(color) < 0.18
  // The backdrop is what the film shows most of, once its flashes and its copy are set aside.
  const ground = seen.filter((s) => !lively(s.color) && !pale(s.color))
  const main = ground[0]?.color
  if (!main) return DEFAULT_COLORS
  const near = ground.filter((s) => s.share > 0.004 && Math.abs(luminance(s.color) - luminance(main)) < 0.3).map((s) => s.color)
  const byLight = [...near].sort((a, b) => luminance(a) - luminance(b))
  const light = luminance(main) > 0.55
  const deep = byLight[Math.floor(byLight.length * 0.15)] ?? main
  const mid = byLight[Math.floor(byLight.length * 0.85)] ?? main
  const accent = seen.find((s) => lively(s.color) && s.share > 0.002)?.color
  return {
    deep: light ? mid : deep,
    mid: light ? mix(mid, '#ffffff', 0.2) : mid === deep ? mix(deep, '#ffffff', 0.14) : mid,
    text: light ? '#101828' : '#ffffff',
    accent: accent ?? DEFAULT_COLORS.accent,
  }
}

type Answer = { transition: string; reveal: string; texture: string; effect: string; font: string; logoIntro: boolean; messages: number; note: string }

const ids = (list: readonly { id: string }[]) => list.map((item) => item.id)

const schema = jsonSchema<Answer>({
  type: 'object',
  properties: {
    transition: { type: 'string', enum: ids(TRANSITIONS) },
    reveal: { type: 'string', enum: ids(REVEALS) },
    texture: { type: 'string', enum: ids(TEXTURES) },
    effect: { type: 'string', enum: ids(EFFECTS) },
    font: { type: 'string', enum: ids(MOTION_FONTS) },
    logoIntro: { type: 'boolean' },
    messages: { type: 'integer', description: 'How many different messages the film shows, not counting a logo-only opening.' },
    note: { type: 'string', description: 'Up to 25 words in Turkish on the manner of the film.' },
  },
  required: ['transition', 'reveal', 'texture', 'effect', 'font', 'logoIntro', 'messages', 'note'],
  additionalProperties: false,
})

export const STUDY_TASK = [
  'The sheet shows frames of one animated advertising banner, in order from left to right and top to bottom, separated by magenta gaps.',
  'Describe HOW the film is made, so that a different banner can be made in the same manner. Do not report what it says.',
  'transition, how one message gives way to the next:',
  '- burst: a bright cartoon wave, flame or splash floods the frame and the next message is under it',
  '- sweep: a band of light crosses the frame as the copy changes',
  '- slide: the old copy moves out and the new one moves in',
  '- fade: the copy dissolves, nothing else happens',
  'reveal, how the copy of a message appears:',
  '- letters: letter by letter (frames show a line with its last letters fainter, smaller or spaced out)',
  '- words: a word at a time',
  '- rise: whole lines move up into place',
  '- fade: the whole message at once',
  'texture, the backdrop: brush (painted strokes or a worn, uneven surface), grain (fine even noise), smooth (flat colour or a clean gradient).',
  'effect, small moving decoration beside the copy: coins (coins, chips or gifts falling), sparks (stars, glints, confetti), none.',
  'font, the lettering of the copy: round (soft, rounded, friendly) or block (square, geometric, condensed or sharp).',
  'logoIntro: true when the film opens on the logo alone before any message.',
  'messages: how many different messages are shown, not counting a logo-only opening.',
  'note: up to 25 words in Turkish on the manner of the film (rhythm, mood, how it moves). Never quote its words, its brand name or its offers.',
].join('\n')

const paceOf = (seconds: number, messages: number, intro: boolean): PaceId => {
  if (seconds <= 0 || messages < 1) return DEFAULT_LOOK.pace
  const beat = seconds / (messages + (intro ? 0.7 : 0))
  return [...PACES].sort((a, b) => Math.abs(a.beat + 0.5 - beat) - Math.abs(b.beat + 0.5 - beat))[0].id
}

/** What can be told from the file alone: its colours, its length and a sheet of its frames. */
export async function measureExample(source: ExampleSource) {
  const { shots: frames, width, height, seconds } = await sample(source)
  return { colors: measuredColors(frames.map((shot) => shot.small)), sheet: await contactSheet(frames, width, height), width, height, seconds }
}

/** The cut, the reveal and the surface of the film on the sheet, as the model reads them. */
export async function readManner(sheet: Buffer, width: number, height: number, seconds: number): Promise<{ look: MotionLook; note: string }> {
  const { output } = await generateText({
    model: MODEL,
    output: Output.object({ schema }),
    messages: [
      {
        role: 'user',
        content: [
          { type: 'file' as const, data: await sharp(sheet).png().toBuffer(), mediaType: 'image/png' },
          { type: 'text' as const, text: `${STUDY_TASK}\nMeasured from the file: ${width}x${height} px, ${seconds > 0 ? `${seconds.toFixed(1)} seconds` : 'a still picture'}.` },
        ],
      },
    ],
  })
  const look = cleanLook({ ...output, pace: paceOf(seconds, Number(output.messages) || 0, output.logoIntro === true) })
  const note = typeof output.note === 'string' ? output.note.replace(/\s+/g, ' ').trim().slice(0, 240) : ''
  return { look, note }
}

/**
 * The manner of an example banner. The colours are counted from the file; the cut, the reveal and the
 * surface are read by the model. When the model cannot be reached the counted part still stands.
 */
export async function studyExample(source: ExampleSource, figures: boolean): Promise<Study> {
  const { colors, sheet, width, height, seconds } = await measureExample(source)
  const measured: Study = { look: DEFAULT_LOOK, colors, note: '', seconds, sheet, read: false }

  const held = await holdBudget(MOTION_STUDY_COST, figures)
  if (held.error !== null) return measured
  try {
    const manner = await readManner(sheet, width, height, seconds)
    held.hold.billed = true
    return { ...measured, ...manner, read: true }
  } catch (error) {
    console.error('Motion example could not be read:', error)
    return measured
  } finally {
    // No job row carries this cost, so the paid amount stays on the hold itself.
    await closeHold(held.hold, 'failed', 'Örnek banner incelendi')
  }
}
