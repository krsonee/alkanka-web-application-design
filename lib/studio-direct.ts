import 'server-only'
import { generateText, jsonSchema, Output } from 'ai'
import { cutBrief, liftedTexts, respelled, respelledTexts } from '@/lib/studio-copy'
import type { StudioTexts } from '@/lib/studio-types'

const MODEL = 'google/gemini-3.5-flash'

const SCENE_LIMIT = 1600

export type Direction = {
  /** The brief worked out for the image model, in English. */
  scene: string
  /**
   * The note as the image model gets it. For a new banner the writing requests are cut out of it,
   * because a model that reads "write this on it" draws the words whatever else it is told; empty
   * when that cut could not be trusted, and the picture is then drawn from `scene` alone.
   */
  note: string
  /** Banner copy the server prints: the form's own, respelled, or what the brief asks to be written. */
  texts: StudioTexts | null
  /** Sticker caption with its Turkish letters restored. */
  caption: string
}

type Asked = {
  kind: 'banner' | 'sticker'
  /** A revision is one instruction about an existing picture, not a new brief. */
  revision: boolean
  brief: string
  format: string
  category: string
  texts: StudioTexts | null
  caption: string
  mascot: boolean
}

type Answer = { scene: string; picture: string; headline: string; subline: string; cta: string; caption: string }

const field = (description: string) => ({ type: 'string' as const, description })

const schema = jsonSchema<Answer>({
  type: 'object',
  properties: {
    scene: field('The picture (or the edit) described in English for an image model.'),
    picture: field('The note in its own words with the writing requests cut out; empty for an instruction or a sticker.'),
    headline: field('Main line of copy; empty when none is asked for.'),
    subline: field('Secondary line of copy; empty when none is asked for.'),
    cta: field('Button text; empty when none is asked for.'),
    caption: field('Sticker caption with correct Turkish spelling; empty when none was given.'),
  },
  required: ['scene', 'picture', 'headline', 'subline', 'cta', 'caption'],
  additionalProperties: false,
})

const WHO =
  'You are the art director of a Turkish online gaming and betting brand. Staff write short notes in Turkish, usually typed quickly on a keyboard without Turkish letters ("ı" for "i", "s" for "ş", "o" for "ö", "u" for "ü", "c" for "ç", "g" for "ğ") and with typos. Read the note the way a Turkish speaker would and work out what was meant.'

const SPELLING =
  'Correct Turkish spelling means restoring ş, ğ, ı, İ, ö, ü, ç and dotted/dotless i where the word needs them. Change nothing else: the same words, the same numbers, the same order. Leave brand names, website names, codes and borrowed words (bonus, freespin, casino, jackpot, slot) as they were typed.'

const NEW_SCENE = [
  '"scene": describe the picture that was asked for, in English, in 90 to 160 words, for an image model that follows English best.',
  'Start with the main subject, then every other thing the note names: each character, object, place, pose, colour and count, exactly as asked. Then the setting, the light, the camera angle, the depth and the mood.',
  'Be concrete and visual. When the note names a game or an object from Turkish daily life (okey, tavla, batak, pişti, çay bardağı, kahvehane), say what it physically looks like so it is drawn correctly.',
  'Keep every element the note names. Do not swap one for something similar, do not leave any out, and do not add other main subjects. You may add supporting detail that fits: materials, light, atmosphere, background.',
  'Never describe writing, letters, logos, watermarks or interface elements in the scene; copy is printed separately.',
  'Words the note wants written on the picture are copy, not things to draw: a slogan that mentions a game or an object does not put that game or object into the scene.',
  'When the note calls a character a mascot, describe it as a stylised, friendly 3D cartoon mascot character, not as a real animal or a photograph.',
]

const REVISION_SCENE = [
  '"scene": restate the instruction as one precise edit in English, in at most 70 words: what changes, into what, and where in the picture.',
  'Mention only what the instruction asks for. Do not describe the rest of the picture and do not add improvements of your own.',
]

function system(asked: Asked) {
  const banner = asked.kind === 'banner'
  return [
    WHO,
    asked.revision ? 'The note is an instruction to change one thing in an existing picture.' : `The note is a brief for a new ${banner ? `advertising banner (${asked.format}, theme: ${asked.category})` : 'Telegram sticker: one character or object cut out, with no background scene'}.`,
    ...(asked.revision ? REVISION_SCENE : NEW_SCENE),
    asked.mascot ? 'The brand mascot is supplied to the image model as a reference picture. Call it "the brand mascot from the reference image" and do not describe its looks.' : '',
    SPELLING,
    banner && !asked.revision
      ? '"picture": the note again, in its own words and its own language, with every part that asks for writing on the picture cut out (both the words to be written and the request to write them). Cut only; do not correct, translate, reorder or add anything.'
      : 'Leave "picture" empty.',
    !banner || asked.revision
      ? 'Leave "headline", "subline" and "cta" empty.'
      : asked.texts
        ? 'The copy is already given in "copy". Return each field with correct Turkish spelling and nothing else changed; return an empty field as empty.'
        : 'Copy: fill "headline", "subline" and "cta" ONLY with words the note explicitly asks to be written on the picture (after words like "yaz", "yazsın", "yazı", "başlık", "slogan", "buton", or inside quotes). Take them word for word with correct Turkish spelling. The main phrase is the headline, a second line is the subline, a button text is the cta. Take every phrase the note asks for and drop none; do not add, drop or replace a single word inside a phrase. Example: the note "kupa tutan aslan, ustunde buyuk odul seni bekliyor yazsin, alt yazi: her aksam 21:00, buton: simdi katil" gives headline "Büyük ödül seni bekliyor", subline "Her akşam 21:00", cta "Şimdi katıl". When the note asks for no writing, leave all three empty. Never invent copy.',
    asked.caption ? 'Return "caption" as the given caption with correct Turkish spelling and nothing else changed.' : 'Leave "caption" empty.',
  ]
    .filter(Boolean)
    .join('\n')
}

/**
 * Works a short Turkish note out into an English scene and settles the copy. Null when the model
 * could not be reached; the picture is then drawn from the note alone, as before.
 */
export async function direct(asked: Asked): Promise<Direction | null> {
  try {
    const { output } = await generateText({
      model: MODEL,
      output: Output.object({ schema }),
      system: system(asked),
      prompt: JSON.stringify({ note: asked.brief, copy: asked.texts ?? undefined, caption: asked.caption || undefined }),
    })
    const scene = typeof output?.scene === 'string' ? output.scene.replace(/\s+/g, ' ').trim().slice(0, SCENE_LIMIT) : ''
    if (!scene) return null
    const banner = asked.kind === 'banner' && !asked.revision
    const lifted = banner && !asked.texts ? liftedTexts(asked.brief, output) : null
    return {
      scene,
      note: banner ? cutBrief(asked.brief, output.picture, lifted) : asked.brief,
      texts: !banner ? asked.texts : asked.texts ? respelledTexts(asked.texts, output) : lifted,
      caption: asked.caption ? respelled(asked.caption, output.caption) : '',
    }
  } catch (error) {
    console.error('[studio] sahne tarifi yazılamadı', error)
    return null
  }
}
