import 'server-only'
import { generateText, jsonSchema, Output } from 'ai'
import sharp from 'sharp'
import { closeHold, holdBudget } from '@/lib/studio-budget'
import { ASSET_ROLES, ASSET_SORT_COST, settleLabel, type AssetLabel } from '@/lib/studio-refs'

/** Sorting is a plain classification, so it runs on the small model: a game's kit is some fifty calls. */
export const SORT_MODEL = 'google/gemini-3.5-flash-lite'

type Answer = { role: string; score: number; note: string }

const schema = jsonSchema<Answer>({
  type: 'object',
  properties: {
    role: { type: 'string', enum: [...ASSET_ROLES] },
    score: { type: 'integer', description: 'From 1 to 10.' },
    note: { type: 'string', description: 'Up to 8 words in Turkish naming what is shown.' },
  },
  required: ['role', 'score', 'note'],
  additionalProperties: false,
})

export const sortTask = (width: number, height: number, cutOut: boolean) =>
  [
    "You sort the art files of an online slot game's press kit, so that a designer finds the best ones for a promotional banner.",
    `The file is shown on a flat grey backdrop; the grey is not part of it. Measured from the file: ${width}x${height} px, ${cutOut ? 'cut out on a transparent background' : 'no transparency, the picture fills the whole file'}.`,
    'role, one of:',
    '- character: a person, animal or creature drawn as a free-standing figure (the hero or mascot of the game), not inside a tile frame',
    "- logo: the game's title lettering",
    '- background: a full scene or landscape without transparency, made to sit behind everything else',
    '- symbol: a reel symbol: a framed tile, a scatter, wild or bonus badge, a card letter or number (A, K, Q, J, 10)',
    '- object: a single prop without a frame (a vehicle, a chest, a pumpkin, a hook)',
    '- other: empty frames, interface parts, anything else',
    'score, 1 to 10, how much a banner gains from this file:',
    '- 9-10: the hero character in full colour, large and whole; the full-colour title logo; the main background',
    '- 6-8: good-looking premium symbols and props',
    '- 3-5: minor symbols',
    '- 1-2: card letters and numbers, white-only or single-colour copies of the logo, empty frames, tiny or blurry files',
    'note: up to 8 words in Turkish naming what is shown, e.g. "Balıkçı karakter, ayakta".',
  ].join('\n')

/** What the picture is and how useful it is. Null when the model could not be reached. */
export async function labelOf(png: Buffer): Promise<AssetLabel | null> {
  try {
    const [meta, stats] = await Promise.all([sharp(png).metadata(), sharp(png).stats()])
    const width = meta.width ?? 0
    const height = meta.height ?? 0
    const alpha = meta.hasAlpha ? stats.channels[stats.channels.length - 1] : null
    const preview = await sharp(png).resize({ width: 512, height: 512, fit: 'inside', withoutEnlargement: true }).flatten({ background: '#7a7a7a' }).png().toBuffer()
    const { output } = await generateText({
      model: SORT_MODEL,
      output: Output.object({ schema }),
      messages: [
        {
          role: 'user',
          content: [
            { type: 'file' as const, data: preview, mediaType: 'image/png' },
            { type: 'text' as const, text: sortTask(width, height, Boolean(alpha && alpha.min < 250)) },
          ],
        },
      ],
    })
    return settleLabel(output, Math.max(width, height))
  } catch (error) {
    console.error('[studio] kütüphane görseli etiketlenemedi', error)
    return null
  }
}

/**
 * Labels one library picture inside the monthly cap. The picture is kept either way: without a
 * label it can still be picked by hand, it is only left out of the automatic choice.
 */
export async function sortAsset(png: Buffer, figures: boolean): Promise<AssetLabel | null> {
  const held = await holdBudget(ASSET_SORT_COST, figures)
  if (held.error !== null) return null
  const label = await labelOf(png)
  if (label) held.hold.billed = true
  // No job row carries this cost, so the paid amount stays on the hold itself.
  await closeHold(held.hold, 'failed', 'Kütüphane görseli etiketlendi')
  return label
}
