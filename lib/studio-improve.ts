import 'server-only'
import { generateText, jsonSchema, Output } from 'ai'
import {
  BRIEF_LIMITS,
  cleanBrief,
  cleanMotion,
  improvedFields,
  MOTION_LIMIT,
  type Brief,
  type Improved,
  type Motion,
  type StudioFlow,
} from '@/lib/studio-brief'

const MODEL = 'google/gemini-3.5-flash'

const FLOW_NOTE: Record<StudioFlow, string> = {
  banner: 'The result is a still advertising banner.',
  gif: 'The result is a short, silent, looping animated GIF made from a still banner.',
  video: 'The result is a 4 to 8 second promo video made from a still banner.',
  sticker: 'The result is a single Telegram sticker: one character or object, cut out, with no background scene.',
}

const text = (max: number, description: string) => ({ type: 'string' as const, maxLength: max, description })

const schema = jsonSchema<Record<keyof Improved, string>>({
  type: 'object',
  properties: {
    subject: text(BRIEF_LIMITS.subject, 'What the picture is about, in one clear sentence.'),
    scene: text(BRIEF_LIMITS.scene, 'Place, background, light and mood. Empty for a sticker.'),
    character: text(BRIEF_LIMITS.character, 'The main character or object: looks, pose, expression, what it holds.'),
    colors: text(BRIEF_LIMITS.colors, 'Two or three colour names. Empty when the client gave none and none are implied.'),
    action: text(MOTION_LIMIT, 'What moves and how, as visible actions. Empty when the result is a still picture.'),
  },
  required: ['subject', 'scene', 'character', 'colors', 'action'],
  additionalProperties: false,
})

/** Rewrites the form's fields into concrete, visual Turkish. The user's own wording wins on any doubt. */
export async function improveBrief(flow: StudioFlow, rawBrief: Brief, rawMotion: Motion): Promise<Improved> {
  const brief = cleanBrief(rawBrief)
  const motion = cleanMotion(rawMotion)
  const moving = flow === 'gif' || flow === 'video' || flow === 'sticker'
  const { output } = await generateText({
    model: MODEL,
    output: Output.object({ schema }),
    system: [
      'You are an art director for a Turkish online betting and casino brand. You turn a short client note into a clear brief for an image model.',
      FLOW_NOTE[flow],
      'Rewrite each field in Turkish, concrete and visual: what is seen, where, in what light, in what pose. Keep the client\'s idea; add detail, do not change the subject.',
      'Never ask for text, letters, numbers, logos or brand names in the picture; the copy is printed separately.',
      'Do not mention real people, real teams or real brands. Do not show minors.',
      moving ? 'For "action", describe two or three simple visible movements that fit a few seconds.' : 'Leave "action" empty.',
      flow === 'sticker' ? 'Leave "scene" empty.' : '',
      'Keep every field short: one or two sentences.',
    ]
      .filter(Boolean)
      .join('\n'),
    prompt: JSON.stringify({ subject: brief.subject, scene: brief.scene, character: brief.character, colors: brief.colors, action: motion.action }),
  })
  const improved = improvedFields(output, brief, motion)
  return { ...improved, scene: flow === 'sticker' ? brief.scene : improved.scene, action: moving ? improved.action : motion.action }
}
