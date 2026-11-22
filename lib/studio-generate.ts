import 'server-only'
import { generateText } from 'ai'
import sharp from 'sharp'
import { applyOverlay, brushOf } from '@/lib/studio-overlay'
import { stylePrompt, type StyleId } from '@/lib/studio-brief'
import { fitStaticSticker, stickerMaster } from '@/lib/studio-telegram'
import { letterNotes, spelledOut } from '@/lib/studio-copy'
import { imageRender, type ImageSize, type StudioBrand, type StudioKind, type StudioTexts } from '@/lib/studio-types'

const MODEL = 'google/gemini-3.1-flash-image'
const PRO_MODEL = 'google/gemini-3-pro-image'

type Input = {
  /**
   * The brief worked out in English by the art-direction step. When it is set, a banner is always
   * drawn text-free: copy is printed by the server or not at all, never drawn by the image model.
   */
  scene?: string
  /** Called once the model has returned a picture, which is the point the job costs money. */
  onBilled?: () => void
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
  style?: StyleId
  /** Extra colors asked for in the form, in plain words. */
  palette?: string
  /** Stickers: the short text on the sticker; empty means no text at all. */
  caption?: string
  /** Stickers: the server draws an even white edge, so the model is told to draw none. */
  outline?: boolean
  /** Sticker revisions: the sticker being revised already has a white edge, which the model is told to keep. */
  edged?: boolean
  /**
   * Stickers: a sticker that came back cut off by the picture's edge is drawn once more, smaller.
   * `allow` is asked before that second paid call and `billed` is called when it has answered.
   */
  redraw?: { allow: () => Promise<boolean>; billed: () => void }
}

/**
 * What staff wrote is the order, not a suggestion. Without this the model treats the brief as one
 * hint among the style rules and swaps or drops what it finds hard.
 */
const BRIEF_RULE =
  'The brief below is the specification and has priority over every style rule in this prompt. It may be written in Turkish; follow it literally. Show every character, object, place, pose, colour and number of things it names, exactly as described. Do not swap a named element for a similar one, do not leave any out, and do not add main elements the brief does not ask for.'

const NO_TEXT_RULE =
  'IMPORTANT: This is a text-free key visual. Do NOT render any text, letters, numbers, words, headlines, buttons, labels or UI elements anywhere in the image. All typography is added later by a designer. The only exception is marking that is physically part of an object the brief names, such as the pips on playing cards or the numbers on game tiles and dice.'

const sceneRule = (scene: string | undefined, withBrief = true) =>
  !scene ? '' : withBrief ? `Art direction (the same brief worked out in detail; wherever the two differ, the brief wins):\n${scene}` : `Brief (describes the picture only):\n${scene}`

// Asking for an "empty" or "dark" area makes the model paint a literal black box or bar, so the
// reserved areas are described as parts of the same scene that simply carry little detail.
const FULL_BLEED_RULE =
  'The artwork must be full-bleed: one continuous scene that fills the whole canvas edge to edge. Never draw panels, boxes, bars, frames, borders, letterboxing or blank rectangles.'
// The server lays its own soft darkening under the headline. A model asked to darken or soften that
// area itself tends to draw it as a separate panel with a straight edge.
const SEAMLESS_RULE =
  'It is one single photograph taken with one lens: the light, the colours and the focus run on unbroken across the whole frame. Do not darken, blur, tint, fade, mirror or repeat any part of the picture, do not composite two pictures, and never let a straight edge, band, panel or split show anywhere.'
const NO_LOGO_RULE = 'Do NOT draw any brand logo, watermark or website name.'
const LOGO_RULE = `${NO_LOGO_RULE} In the top-left corner show only low-detail background of the same scene (no faces, no key objects), because a logo is overlaid there later.`
// Without a brand kit logo nothing is printed in the corner, so the corner is not kept clear.
const logoRule = (brand: StudioBrand | null) => (brand?.logo ? LOGO_RULE : NO_LOGO_RULE)

function copyRules({ format, prompt, texts, scene }: Input) {
  // Neither copy to print nor art direction (that step failed): the model is left to try any writing itself.
  if (!texts && !scene) {
    return [BRIEF_RULE, `Brief (render any requested headline or button text exactly in Turkish, spelled correctly, large and readable):\n${prompt}`]
  }
  // With art direction the picture is always text-free, because the image model misspells Turkish.
  // The note arrives with its writing requests cut out, or not at all when that cut was not safe.
  const brief = [BRIEF_RULE, prompt ? `Brief (describes the picture only):\n${prompt}` : '', sceneRule(scene, Boolean(prompt)), NO_TEXT_RULE]
  if (!texts) return brief
  return [
    ...brief,
    format === '16:9'
      ? `Framing, as a camera operator would set it: a film still framed off-centre. The main subject and every key object are placed in the right-hand part of the frame. The left-hand part of the frame is simply the same place receding behind them, with no faces and no key objects in it. ${SEAMLESS_RULE}`
      : `Framing, as a camera operator would set it: the camera is tilted slightly down so that the frame has a deep foreground. The main subject and every key object are placed in the upper two thirds of the frame. The lower third of the frame is simply the foreground of the same place (the ground, grass, floor or table surface in front of the subject, reaching all the way to the bottom edge), with no faces and no key objects in it. ${SEAMLESS_RULE}`,
  ]
}

const MASCOT_RULE =
  "The FIRST reference image is the brand's official mascot character. Feature this exact mascot prominently as the hero of the design, keeping its face, body shape, colors, outfit and art style identical. You may change its pose and expression to fit the brief, but never redesign it."

function bannerPrompt(input: Input) {
  const { format, category, brand, mascot, texts } = input
  const colors = brand?.colors.length ? `Use this exact brand palette as the dominant colors: ${brand.colors.join(', ')}.` : ''
  return [
    `Premium advertising banner${brand ? ` for the brand "${brand.name}"` : ''}. Theme: ${category}.`,
    `Aspect ratio ${format}. Cinematic lighting, sharp details, rich depth, professional marketing key visual.`,
    ...copyRules(input),
    stylePrompt(input.style ?? 'auto'),
    colors,
    input.palette ? `${colors ? 'Additional colors' : 'Colors'} asked for by the client: ${input.palette}.` : '',
    brand?.font && !texts ? `Typography style should feel similar to the font "${brand.font}".` : '',
    brand?.notes ? `Brand style notes: ${brand.notes}` : '',
    FULL_BLEED_RULE,
    logoRule(brand),
    mascot ? MASCOT_RULE : '',
    mascot
      ? 'Any additional reference images are supporting game characters or symbols; place them around the mascot.'
      : 'If reference images are provided, use their characters, symbols and art style faithfully as the main subject.',
  ]
    .filter(Boolean)
    .join('\n')
}

const WHOLE_STICKER_RULE =
  'COMPLETE AND UNCROPPED: everything that is drawn (the whole character, every object and all of the text) is fully visible, centred, and fills about 80% of the image as one compact group. Leave an empty green margin on all four sides. Nothing may touch or be cut off by the edge of the image, and no part floats far away from the rest.'
const GREEN_RULE =
  'The background MUST be a perfectly flat solid pure green (#00FF00) with no shadows, gradients or other objects. Do not use green inside the sticker itself.'

// The word "sticker" alone makes the model draw the white edge of a printed one, so a picture that must not have
// that edge is described to the model as artwork on a green screen.
const NO_EDGE_RULE =
  'NO WHITE EDGE: this is NOT a printed or die-cut sticker. There is no white outline, border, stroke, halo or glow around the artwork or around its text, and no white backing shape behind it. The coloured artwork touches the green background directly, and every gap between two parts of the artwork is green, never white.'
const asArtwork = (rule: string) => rule.replace(/\bsticker\b/g, 'artwork')

/** A caption the image model draws itself: spelled out letter by letter, with its Turkish letters described. */
function captionRule(caption: string) {
  const notes = letterNotes(caption)
  return [
    `The sticker carries exactly this text, in Turkish, spelled exactly, complete, in a chunky readable font: "${caption}". No other text.`,
    `Letter by letter: ${spelledOut(caption)}. Draw every letter once, in this order, and no others.`,
    notes.length ? `Turkish letters in it, which must keep their marks: ${notes.join('; ')}.` : '',
  ]
    .filter(Boolean)
    .join(' ')
}

function stickerPrompt({ prompt, scene, brand, mascot, style, palette, caption, outline }: Input) {
  const worded = outline ? (rule: string) => rule : asArtwork
  return [
    outline
      ? 'A single bold die-cut sticker illustration for a Telegram sticker pack.'
      : 'A single bold illustration isolated on a green screen, to be cut out by chroma key.',
    outline ? '' : NO_EDGE_RULE,
    BRIEF_RULE,
    `Brief:\n${prompt}`,
    sceneRule(scene),
    caption
      ? worded(captionRule(caption))
      : 'Any text asked for above must be in Turkish, spelled exactly, complete, in a chunky readable font. Otherwise draw no text.',
    WHOLE_STICKER_RULE,
    outline ? 'Do NOT draw any outline, border or stroke around the sticker; a clean outline is added afterwards.' : '',
    stylePrompt(style ?? 'auto') || 'Vibrant, glossy, cartoon/3D mascot style.',
    'Expressive, high contrast, readable at a small size.',
    brand?.colors.length ? `Accent colors: ${brand.colors.join(', ')}.` : '',
    palette ? `Colors asked for by the client: ${palette}.` : '',
    worded(GREEN_RULE),
    mascot ? MASCOT_RULE : 'If reference images are provided, use their character faithfully.',
    outline ? '' : 'Final check before you draw: no white outline anywhere, only the artwork on flat green.',
  ]
    .filter(Boolean)
    .join('\n')
}

/** A revision changes what was asked and nothing else; the rest of the picture is not up for a redraw. */
function revisionPrompt(input: Input) {
  const sticker = input.kind === 'sticker'
  return [
    'Edit the provided image. Apply ONLY the change described below and nothing else. The instruction may be written in Turkish; follow it literally and completely:',
    input.prompt,
    input.scene ? `The same instruction restated in English (wherever the two differ, the instruction above wins): ${input.scene}` : '',
    'Everything the instruction does not mention stays exactly as it is in the image: composition, characters, faces, poses, objects, colours, lighting, art style, sizes and positions. Do not redraw, restyle, move or remove anything else.',
    input.mascot
      ? "The second image is the brand's official mascot; keep the mascot in the design looking exactly like it."
      : '',
    sticker
      ? input.edged
        ? `Keep the white outline around the sticker exactly as it is. ${GREEN_RULE} ${WHOLE_STICKER_RULE}`
        : `${NO_EDGE_RULE} The image has no white outline now and must not get one. ${asArtwork(GREEN_RULE)} ${WHOLE_STICKER_RULE}`
      : `${logoRule(input.brand)} ${FULL_BLEED_RULE}`,
    !sticker && input.texts ? NO_TEXT_RULE : '',
  ]
    .filter(Boolean)
    .join('\n')
}

const REDRAW_PROMPT = [
  'The sticker in this image is cut off by the edge of the picture.',
  'Draw the SAME sticker again: same character, pose, expression, objects, colours, art style and text. Change nothing about its design.',
  'Make it smaller and centred so that all of it is visible, and draw the parts that were cut off.',
  WHOLE_STICKER_RULE,
  GREEN_RULE,
].join('\n')

/** Rows of pixels at each side of the picture that are checked for a sticker running off it. */
const EDGE_ROWS = 2

/** True when the cut-out touches a side of the picture along a stretch too long to be stray pixels. */
function cutAtEdge(data: Buffer, width: number, height: number) {
  const solid = (x: number, y: number) => data[(y * width + x) * 4 + 3] > 200
  const touching = (length: number, at: (i: number, row: number) => boolean) => {
    let count = 0
    for (let row = 0; row < EDGE_ROWS; row++) for (let i = 0; i < length; i++) if (at(i, row)) count++
    return count / EDGE_ROWS >= Math.max(8, length * 0.02)
  }
  return (
    touching(width, (x, row) => solid(x, row)) ||
    touching(width, (x, row) => solid(x, height - 1 - row)) ||
    touching(height, (y, row) => solid(row, y)) ||
    touching(height, (y, row) => solid(width - 1 - row, y))
  )
}

/** Removes the green and reports whether the sticker runs off the picture. */
async function keySticker(image: Buffer) {
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
  const cut = cutAtEdge(data, info.width, info.height)
  const art = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .trim({ threshold: 1 })
    .png()
    .toBuffer()
  return { art, cut }
}

async function draw(text: string, images: Buffer[], aspectRatio: string, size: ImageSize) {
  const render = imageRender(size)
  const result = await generateText({
    model: render.pro ? PRO_MODEL : MODEL,
    providerOptions: { google: { responseModalities: ['TEXT', 'IMAGE'], imageConfig: { aspectRatio, imageSize: render.px } } },
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
  return Buffer.from(file.uint8Array)
}

/**
 * `clean` is the copy later work starts from: the text-free picture of a banner, the full-size
 * transparent PNG of a sticker. `calls` is how many paid model calls the result took.
 */
export async function runGeneration(input: Input) {
  const text = input.revisionOf ? revisionPrompt(input) : input.kind === 'sticker' ? stickerPrompt(input) : bannerPrompt(input)
  const images = input.revisionOf ? [input.revisionOf, ...input.references] : input.references
  const aspectRatio = input.kind === 'sticker' ? '1:1' : input.format
  const raw = await draw(text, images, aspectRatio, input.size)
  input.onBilled?.()

  if (input.kind !== 'sticker') {
    return { data: await applyOverlay(raw, brushOf(input.brand, input.texts)), contentType: 'image/png', ext: 'png', clean: raw, calls: 1 }
  }
  let keyed = await keySticker(raw)
  let calls = 1
  if (keyed.cut && input.redraw && (await input.redraw.allow())) {
    // A second call that fails leaves the first sticker, cut edge and all; it is still worth having.
    const again = await draw(REDRAW_PROMPT, [raw], aspectRatio, input.size).catch((error) => {
      console.error('[studio] kesik sticker yeniden çizilemedi', error)
      return null
    })
    if (again) {
      input.redraw.billed()
      calls = 2
      keyed = await keySticker(again)
    }
  }
  const master = await stickerMaster(keyed.art, Boolean(input.outline))
  return { data: await fitStaticSticker(master), contentType: 'image/webp', ext: 'webp', clean: master, calls }
}
