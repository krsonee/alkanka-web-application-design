import 'server-only'
import { generateText } from 'ai'
import sharp from 'sharp'
import { applyOverlay, brushOf } from '@/lib/studio-overlay'
import { fitStaticSticker } from '@/lib/studio-telegram'
import type { ImageSize, StudioBrand, StudioKind, StudioTexts } from '@/lib/studio-types'

const MODEL = 'google/gemini-3.1-flash-image'

type Input = {
  kind: StudioKind
  format: string
  category: string
  prompt: string
  brand: StudioBrand | null
  references: Buffer[]
  revisionOf: Buffer | null
  mascot?: boolean
  /** Copy the server prints afterwards. When set, the model is told to draw no text at all. */
  texts: StudioTexts | null
  size: ImageSize
}

const NO_TEXT_RULE =
  'IMPORTANT: This is a text-free key visual. Do NOT render any text, letters, numbers, words, headlines, buttons, labels or UI elements anywhere in the image. All typography is added later by a designer.'

// Asking for an "empty" or "dark" area makes the model paint a literal black box or bar, so the
// reserved areas are described as parts of the same scene that simply carry little detail.
const FULL_BLEED_RULE =
  'The artwork must be full-bleed: one continuous scene that fills the whole canvas edge to edge. Never draw panels, boxes, bars, frames, borders, letterboxing or blank rectangles.'
const LOGO_RULE =
  'Do NOT draw any brand logo, watermark or website name. In the top-left corner show only low-detail background of the same scene (no faces, no key objects), because a logo is overlaid there later.'

function copyRules({ format, prompt, texts }: Input) {
  if (!texts) {
    return [`Campaign brief (render any requested headline or button text exactly in Turkish, spelled correctly, large and readable): ${prompt}`]
  }
  return [
    `Campaign brief (describes the picture only): ${prompt}`,
    NO_TEXT_RULE,
    format === '16:9'
      ? 'Composition: the main subject sits on the right half. On the left half the same scene continues with low detail and soft shadow (out-of-focus background, mist, smoke) and no faces or key objects, because a headline is overlaid there later.'
      : 'Composition, like a movie poster: the main subject sits in the upper two thirds. In the lower third the same scene continues with low detail and soft shadow (ground, mist, smoke, out-of-focus background) and no faces or key objects, because a headline is overlaid there later.',
  ]
}

const MASCOT_RULE =
  "The FIRST reference image is the brand's official mascot character. Feature this exact mascot prominently as the hero of the design, keeping its face, body shape, colors, outfit and art style identical. You may change its pose and expression to fit the brief, but never redesign it."

function bannerPrompt(input: Input) {
  const { format, category, brand, mascot, texts } = input
  const colors = brand?.colors.length ? `Use this exact brand palette as the dominant colors: ${brand.colors.join(', ')}.` : ''
  return [
    `Premium, high-end ${category} advertising banner for a Turkish online betting/casino brand${brand ? ` named "${brand.name}"` : ''}.`,
    `Aspect ratio ${format}. Cinematic lighting, sharp details, rich depth, professional marketing key visual.`,
    colors,
    brand?.font && !texts ? `Typography style should feel similar to the font "${brand.font}".` : '',
    brand?.notes ? `Brand style notes: ${brand.notes}` : '',
    ...copyRules(input),
    FULL_BLEED_RULE,
    LOGO_RULE,
    mascot ? MASCOT_RULE : '',
    mascot
      ? 'Any additional reference images are supporting game characters or symbols; place them around the mascot.'
      : 'If reference images are provided, use their characters, symbols and art style faithfully as the main subject.',
  ]
    .filter(Boolean)
    .join('\n')
}

function stickerPrompt({ prompt, brand, mascot }: Input) {
  return [
    'A single bold die-cut sticker illustration for a Telegram sticker pack, centered, with a thick white outline around the whole sticker.',
    'Vibrant, glossy, cartoon/3D mascot style, expressive, high contrast.',
    brand?.colors.length ? `Accent colors: ${brand.colors.join(', ')}.` : '',
    `Content: ${prompt}. Any text must be in Turkish, spelled exactly, in a chunky readable font.`,
    'The background MUST be a perfectly flat solid pure green (#00FF00) with no shadows, gradients or other objects. Do not use green inside the sticker itself.',
    mascot ? MASCOT_RULE : 'If reference images are provided, use their character faithfully.',
  ]
    .filter(Boolean)
    .join('\n')
}

function revisionPrompt(input: Input) {
  return [
    'Edit the provided image according to these instructions while keeping the overall layout, composition and style the same:',
    input.prompt,
    input.mascot
      ? "The second image is the brand's official mascot; keep the mascot in the design looking exactly like it."
      : '',
    input.kind === 'sticker'
      ? 'Keep the background a flat solid pure green (#00FF00).'
      : `${LOGO_RULE} ${FULL_BLEED_RULE}`,
    input.kind !== 'sticker' && input.texts ? NO_TEXT_RULE : '',
  ]
    .filter(Boolean)
    .join('\n')
}

async function chromaKeySticker(image: Buffer) {
  const { data, info } = await sharp(image).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const greenness = g - Math.max(r, b)
    if (greenness > 70 && g > 120) {
      data[i + 3] = 0
    } else if (greenness > 25) {
      data[i + 3] = Math.round(data[i + 3] * (1 - (greenness - 25) / 45))
      data[i + 1] = Math.max(r, b)
    }
  }
  const trimmed = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .trim({ threshold: 1 })
    .png()
    .toBuffer()
  return fitStaticSticker(trimmed)
}

export async function runGeneration(input: Input) {
  const text = input.revisionOf ? revisionPrompt(input) : input.kind === 'sticker' ? stickerPrompt(input) : bannerPrompt(input)
  const images = input.revisionOf ? [input.revisionOf, ...input.references] : input.references
  const aspectRatio = input.kind === 'sticker' ? '1:1' : input.format
  const result = await generateText({
    model: MODEL,
    providerOptions: { google: { responseModalities: ['TEXT', 'IMAGE'], imageConfig: { aspectRatio, imageSize: input.size } } },
    messages: [
      {
        role: 'user',
        content: [
          ...images.map((data) => ({ type: 'file' as const, data, mediaType: 'image/png' })),
          { type: 'text' as const, text: `${text}\nOutput aspect ratio ${aspectRatio}.` },
        ],
      },
    ],
  })
  const file = result.files.find((f) => f.mediaType?.startsWith('image/'))
  if (!file) throw new Error('Görsel üretilemedi, lütfen tekrar deneyin.')
  const raw = Buffer.from(file.uint8Array)

  if (input.kind === 'sticker') {
    return { data: await chromaKeySticker(raw), contentType: 'image/webp', ext: 'webp' }
  }
  return { data: await applyOverlay(raw, brushOf(input.brand, input.texts)), contentType: 'image/png', ext: 'png', clean: raw }
}
