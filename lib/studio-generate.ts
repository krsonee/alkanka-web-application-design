import 'server-only'
import { generateImage } from 'ai'
import sharp from 'sharp'
import { readFile } from '@/lib/studio'
import type { StudioBrand, StudioKind } from '@/lib/studio-types'

const MODEL = 'google/gemini-3.1-flash-image'

type Input = {
  kind: StudioKind
  format: string
  category: string
  prompt: string
  brand: StudioBrand | null
  references: Buffer[]
  revisionOf: Buffer | null
}

function bannerPrompt({ format, category, prompt, brand }: Input) {
  const colors = brand?.colors.length ? `Use this exact brand palette as the dominant colors: ${brand.colors.join(', ')}.` : ''
  return [
    `Premium, high-end ${category} advertising banner for a Turkish online betting/casino brand${brand ? ` named "${brand.name}"` : ''}.`,
    `Aspect ratio ${format}. Cinematic lighting, sharp details, rich depth, professional marketing key visual.`,
    colors,
    brand?.font ? `Typography style should feel similar to the font "${brand.font}".` : '',
    brand?.notes ? `Brand style notes: ${brand.notes}` : '',
    `Campaign brief (render any requested headline or button text exactly in Turkish, spelled correctly, large and readable): ${prompt}`,
    'IMPORTANT: Do NOT draw any brand logo, watermark or website name. Keep the top-left corner area (about 25% width, 14% height) visually calm and empty so a logo can be placed there later.',
    'If reference images are provided, use their characters, symbols and art style faithfully as the main subject.',
  ]
    .filter(Boolean)
    .join('\n')
}

function stickerPrompt({ prompt, brand }: Input) {
  return [
    'A single bold die-cut sticker illustration for a Telegram sticker pack, centered, with a thick white outline around the whole sticker.',
    'Vibrant, glossy, cartoon/3D mascot style, expressive, high contrast.',
    brand?.colors.length ? `Accent colors: ${brand.colors.join(', ')}.` : '',
    `Content: ${prompt}. Any text must be in Turkish, spelled exactly, in a chunky readable font.`,
    'The background MUST be a perfectly flat solid pure green (#00FF00) with no shadows, gradients or other objects. Do not use green inside the sticker itself.',
    'If reference images are provided, use their character faithfully.',
  ]
    .filter(Boolean)
    .join('\n')
}

function revisionPrompt(input: Input) {
  return [
    'Edit the provided image according to these instructions while keeping the overall layout, composition and style the same:',
    input.prompt,
    input.kind === 'sticker'
      ? 'Keep the background a flat solid pure green (#00FF00).'
      : 'Do not add any logo or website name. Keep the top-left corner area calm and empty.',
  ].join('\n')
}

async function overlayLogo(image: Buffer, logoPath: string) {
  const base = sharp(image)
  const { width = 1024, height = 1024 } = await base.metadata()
  const logoWidth = Math.round(width * (width > height ? 0.18 : 0.26))
  const logo = await sharp(await readFile(logoPath))
    .resize({ width: logoWidth, height: Math.round(height * 0.12), fit: 'inside' })
    .png()
    .toBuffer()
  const pad = Math.round(Math.min(width, height) * 0.045)
  return base.composite([{ input: logo, top: pad, left: pad }]).png().toBuffer()
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
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .trim({ threshold: 1 })
    .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 92 })
    .toBuffer()
}

export async function runGeneration(input: Input) {
  const text = input.revisionOf ? revisionPrompt(input) : input.kind === 'sticker' ? stickerPrompt(input) : bannerPrompt(input)
  const images = input.revisionOf ? [input.revisionOf, ...input.references] : input.references
  const { image } = await generateImage({
    model: MODEL,
    prompt: images.length ? { text, images } : text,
    aspectRatio: (input.kind === 'sticker' ? '1:1' : input.format) as `${number}:${number}`,
  })
  const raw = Buffer.from(image.uint8Array)

  if (input.kind === 'sticker') {
    return { data: await chromaKeySticker(raw), contentType: 'image/webp', ext: 'webp' }
  }
  const withLogo = input.brand?.logo ? await overlayLogo(raw, input.brand.logo) : await sharp(raw).png().toBuffer()
  return { data: withLogo, contentType: 'image/png', ext: 'png', clean: raw }
}
