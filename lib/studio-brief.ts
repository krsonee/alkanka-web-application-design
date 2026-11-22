import { STUDIO_TEXT_CEILING, type StudioAsset, type StudioTexts } from '@/lib/studio-types'

/** The four jobs of the Studio. Each has its own form; `gif` and `video` animate a banner. */
export type StudioFlow = 'banner' | 'gif' | 'video' | 'sticker'

export const STUDIO_STYLES = [
  { id: 'auto', label: 'Otomatik', hint: 'Model seçer', prompt: '' },
  {
    id: '3d',
    label: '3D',
    hint: 'Parlak, hacimli',
    prompt: 'Art style: glossy 3D render like a modern animated film, with soft studio lighting, rounded volumes and rich materials.',
  },
  {
    id: 'cartoon',
    label: 'Çizgi',
    hint: 'Kalın çizgi, düz renk',
    prompt: 'Art style: bold 2D cartoon illustration with clean thick outlines, flat cel shading and saturated colors.',
  },
  {
    id: 'real',
    label: 'Gerçekçi',
    hint: 'Fotoğraf gibi',
    prompt: 'Art style: photorealistic, like a high-budget commercial photo shoot, with natural materials and real lens depth of field.',
  },
] as const
export type StyleId = (typeof STUDIO_STYLES)[number]['id']

export const CAMERA_MOVES = [
  { id: 'still', label: 'Sabit durur', prompt: 'The camera is locked off and does not move.' },
  { id: 'push', label: 'Yavaşça yaklaşır', prompt: 'The camera pushes in slowly and smoothly.' },
  { id: 'pull', label: 'Yavaşça uzaklaşır', prompt: 'The camera pulls back slowly and smoothly.' },
  { id: 'orbit', label: 'Etrafında döner', prompt: 'The camera orbits slowly around the main subject.' },
  { id: 'pan', label: 'Yana kayar', prompt: 'The camera slides sideways in a slow, smooth pan.' },
] as const
export type CameraId = (typeof CAMERA_MOVES)[number]['id']

export type Brief = {
  /** What the picture is about. The only required field. */
  subject: string
  scene: string
  character: string
  style: StyleId
  /** Extra colors in plain words; the brand kit's palette is added by the server. */
  colors: string
  /** Stickers only: the short text drawn on the sticker. */
  caption: string
}
export type Motion = { action: string; camera: CameraId }

// Staff writes as much detail as the job needs; the only bound is the technical ceiling shared by all Studio fields.
export const BRIEF_LIMITS = {
  subject: STUDIO_TEXT_CEILING,
  scene: STUDIO_TEXT_CEILING,
  character: STUDIO_TEXT_CEILING,
  colors: STUDIO_TEXT_CEILING,
  caption: STUDIO_TEXT_CEILING,
} as const
export const MOTION_LIMIT = STUDIO_TEXT_CEILING
export const SUBJECT_MIN = 5

export const EMPTY_BRIEF: Brief = { subject: '', scene: '', character: '', style: 'auto', colors: '', caption: '' }
export const EMPTY_MOTION: Motion = { action: '', camera: 'still' }

const tidy = (value: unknown, max: number) => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '')

export const toStyle = (value: unknown): StyleId => STUDIO_STYLES.find((s) => s.id === value)?.id ?? 'auto'
export const toCamera = (value: unknown): CameraId => CAMERA_MOVES.find((c) => c.id === value)?.id ?? 'still'

export function cleanBrief(raw: unknown): Brief {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  return {
    subject: tidy(r.subject, BRIEF_LIMITS.subject),
    scene: tidy(r.scene, BRIEF_LIMITS.scene),
    character: tidy(r.character, BRIEF_LIMITS.character),
    style: toStyle(r.style),
    colors: tidy(r.colors, BRIEF_LIMITS.colors),
    caption: tidy(r.caption, BRIEF_LIMITS.caption),
  }
}

export function cleanMotion(raw: unknown): Motion {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  return { action: tidy(r.action, MOTION_LIMIT), camera: toCamera(r.camera) }
}

/** Why the form cannot be sent yet, or null when it can. */
export function briefProblem(brief: Brief): string | null {
  return cleanBrief(brief).subject.length < SUBJECT_MIN ? `Konuyu yaz (en az ${SUBJECT_MIN} karakter).` : null
}

/** The picture part of the model prompt. Style, colors and sticker text are separate rules. */
export function briefText(raw: Brief) {
  const brief = cleanBrief(raw)
  return [
    `Subject: ${brief.subject}`,
    brief.scene ? `Scene and background: ${brief.scene}` : '',
    brief.character ? `Main character: ${brief.character}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

export const stylePrompt = (style: StyleId) => STUDIO_STYLES.find((s) => s.id === style)?.prompt ?? ''

/** One-line Turkish summary kept with the result, so the history shows what was asked for. */
export function briefLabel(raw: Brief) {
  const brief = cleanBrief(raw)
  return [brief.subject, brief.character, brief.scene].filter(Boolean).join(' · ').slice(0, 400)
}

const MOTION_RULE =
  'Motion direction from the client. It may be written in Turkish. Do exactly and completely what it describes, and nothing it does not describe: no other actions, no scene changes, no cuts, no new characters or objects.'
const DEFAULT_ACTION = 'Subtle premium motion: light sweeps and glints, drifting particles, the main character moves slightly and naturally.'

/**
 * The motion part of the video prompt. `fixedCamera` is set when the picture only fills part of the
 * frame (square banners, stickers): any camera move there would pull the padding into view.
 */
export function motionText(raw: Motion, fixedCamera = false) {
  const motion = cleanMotion(raw)
  const camera = CAMERA_MOVES.find((c) => c.id === (fixedCamera ? 'still' : motion.camera)) ?? CAMERA_MOVES[0]
  return [motion.action ? `${MOTION_RULE}\n${motion.action}` : DEFAULT_ACTION, camera.prompt].join('\n')
}

export function motionLabel(raw: Motion) {
  const motion = cleanMotion(raw)
  const camera = CAMERA_MOVES.find((c) => c.id === motion.camera)
  return [motion.action, camera && camera.id !== 'still' ? `kamera ${camera.label.toLocaleLowerCase('tr')}` : ''].filter(Boolean).join(' · ')
}

export type Recipe = {
  id: string
  name: string
  brief: Partial<Brief>
  motion?: Partial<Motion>
  texts?: Partial<StudioTexts>
}

const PICTURE_RECIPES: Recipe[] = [
  {
    id: 'freespin',
    name: 'Freespin kampanyası',
    brief: {
      subject: 'Freespin kampanyası duyurusu',
      scene: 'Işıklı slot makinelerinin olduğu parlak bir casino salonu, havada altın paralar',
      character: 'Elinde altın paralar tutan, sevinçle gülen bir karakter',
      style: '3d',
      colors: 'altın ve mor',
    },
    motion: { action: 'Altın paralar yukarıdan yağıyor, karakter elini kaldırıp sallıyor, slot ışıkları yanıp sönüyor', camera: 'push' },
    texts: { headline: '100 FREESPIN', subline: 'İlk yatırımına özel', cta: 'HEMEN AL' },
  },
  {
    id: 'match',
    name: 'Maç günü / özel oran',
    brief: {
      subject: 'Büyük maç için özel oran duyurusu',
      scene: 'Gece maçında dolu bir stadyum, projektör ışıkları ve hafif sis',
      character: 'Topa vurmak üzere olan bir futbolcu, forması düz renk ve yazısız',
      style: 'real',
      colors: 'koyu lacivert ve yeşil',
    },
    motion: { action: 'Futbolcu topa vuruyor, çim parçaları havalanıyor, projektör ışıkları parlıyor', camera: 'orbit' },
    texts: { headline: 'ÖZEL ORAN 5.00', subline: 'Bu akşam 21:00', cta: 'KUPONA EKLE' },
  },
  {
    id: 'live',
    name: 'Canlı casino',
    brief: {
      subject: 'Canlı casino masalarına davet',
      scene: 'Loş ışıklı şık bir casino masası, masada fişler ve kartlar',
      character: 'Kart dağıtan güler yüzlü bir krupiye',
      style: 'real',
      colors: 'bordo ve altın',
    },
    motion: { action: 'Krupiye kartı masaya bırakıyor, fişler hafifçe kayıyor, ışıklar parlıyor', camera: 'push' },
    texts: { headline: 'CANLI CASINO', subline: 'Masalar 7/24 açık', cta: 'MASAYA OTUR' },
  },
  {
    id: 'tournament',
    name: 'Turnuva',
    brief: {
      subject: 'Ödüllü turnuva duyurusu',
      scene: 'Sahne ışıkları altında bir podyum, havada konfeti',
      character: 'Podyumun üstünde parlayan büyük bir altın kupa',
      style: '3d',
      colors: 'altın ve koyu mavi',
    },
    motion: { action: 'Konfetiler yağıyor, kupanın üstünde ışık parlamaları geziyor', camera: 'orbit' },
    texts: { headline: '500.000 TL ÖDÜL', subline: 'Turnuva bu hafta sonu', cta: 'KATIL' },
  },
]

const STICKER_RECIPES: Recipe[] = [
  {
    id: 'code',
    name: 'Kod geldi',
    brief: { subject: 'Promosyon kodu geldi haberi', character: 'Elinde megafon tutan heyecanlı bir karakter', style: '3d', caption: 'KOD GELDİ!' },
    motion: { action: 'Karakter megafonu sallıyor ve zıplıyor' },
  },
  {
    id: 'win',
    name: 'Kazandık',
    brief: { subject: 'Büyük kazanç sevinci', character: 'İki elini havaya kaldırmış sevinen bir karakter, etrafında altın paralar', style: '3d', caption: 'KAZANDIK!' },
    motion: { action: 'Karakter sevinçle zıplıyor, altın paralar etrafında dönüyor' },
  },
  {
    id: 'luck',
    name: 'Bol şans',
    brief: { subject: 'Bol şans dileği', character: 'Göz kırpan, başparmağını kaldırmış bir karakter, yanında dört yapraklı yonca', style: 'cartoon', caption: 'BOL ŞANS' },
    motion: { action: 'Karakter göz kırpıyor ve başparmağını sallıyor' },
  },
  {
    id: 'wait',
    name: 'Az kaldı',
    brief: { subject: 'Kampanya birazdan başlıyor', character: 'Kol saatine bakan sabırsız bir karakter', style: 'cartoon', caption: 'AZ KALDI' },
    motion: { action: 'Karakter saatine bakıp ayağını yere vuruyor' },
  },
]

export const RECIPES: Record<StudioFlow, Recipe[]> = {
  banner: PICTURE_RECIPES,
  gif: PICTURE_RECIPES,
  video: PICTURE_RECIPES,
  sticker: STICKER_RECIPES,
}

const fold = (value: string) => value.toLocaleLowerCase('tr').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

/**
 * Library pictures whose game or provider is named in the form, best match first. A game name
 * outranks a provider name; names under three letters never match.
 */
export function matchAssets(text: string, assets: Pick<StudioAsset, 'id' | 'provider' | 'game'>[], max = 3): number[] {
  const haystack = ` ${fold(text)} `
  if (haystack.trim().length < 3) return []
  const hit = (name: string) => {
    const needle = fold(name)
    return needle.length >= 3 && haystack.includes(` ${needle} `)
  }
  const scored = assets
    .map((asset) => ({ id: asset.id, score: hit(asset.game) ? 2 : hit(asset.provider) ? 1 : 0 }))
    .filter((entry) => entry.score > 0)
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
    .map((entry) => entry.id)
}

export type Improved = Pick<Brief, 'subject' | 'scene' | 'character' | 'colors'> & { action: string }

/** Takes the model's rewrite field by field; an empty or missing field keeps what the user wrote. */
export function improvedFields(raw: unknown, brief: Brief, motion: Motion): Improved {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const before = cleanBrief(brief)
  return {
    subject: tidy(r.subject, BRIEF_LIMITS.subject) || before.subject,
    scene: tidy(r.scene, BRIEF_LIMITS.scene) || before.scene,
    character: tidy(r.character, BRIEF_LIMITS.character) || before.character,
    colors: tidy(r.colors, BRIEF_LIMITS.colors) || before.colors,
    action: tidy(r.action, MOTION_LIMIT) || cleanMotion(motion).action,
  }
}
