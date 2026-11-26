/** Avatar frames: the ones a badge tier earns and the ones bought in the market. Safe to import from the browser. */
import { hasOwn } from '@/lib/has-own'

export type TierFrame = 'altin' | 'elmas' | 'efsane'
export type ArtFrame = 'defne' | 'mavi-alev' | 'ejder'
export type AvatarFrame = TierFrame | 'ozel' | ArtFrame

/** One cut of a drawn frame. `w` and `h` are in avatar diameters: the picture is laid over the avatar at that size. */
export type FrameCut = { src: string; w: number; h: number }

type ArtDef = {
  /** Only the ring, for small avatars in lists and chat, where a wider frame would cover the row beside it. */
  ring: FrameCut
  /** The ring with its leaves and flames, for the avatar in the profile header. */
  crest: FrameCut
  /** Everything the product picture shows, where there is room around the avatar. */
  show: FrameCut
}

const cut = (file: string, w: number, h = w): FrameCut => ({ src: `/images/frames/${file}.webp`, w, h })

/**
 * The drawn frames, cut from the market product pictures by the script kept with the work notes. The sizes are
 * the ones that script printed: change a picture and they change with it.
 */
export const ART_FRAMES: Record<ArtFrame, ArtDef> = {
  defne: { ring: cut('defne-ring', 1.465), crest: cut('defne-crest', 1.987), show: cut('defne-crest', 1.987) },
  'mavi-alev': { ring: cut('mavi-alev-ring', 1.357), crest: cut('mavi-alev-crest', 1.786), show: cut('mavi-alev-crest', 1.786) },
  ejder: { ring: cut('ejder-ring', 1.528), crest: cut('ejder-crest', 2.083), show: cut('ejder-show', 3.139, 2.083) },
}

export const isArtFrame = (frame: unknown): frame is ArtFrame => typeof frame === 'string' && hasOwn(ART_FRAMES, frame)

/** A frame sold in the market. Holding its badge is what owning the frame means. */
export type BoughtFrame = { badge: string; frame: AvatarFrame; name: string; about: string }

export const BOUGHT_FRAMES: BoughtFrame[] = [
  {
    badge: 'ozel-cerceve',
    frame: 'ozel',
    name: 'Özel Profil Çerçevesi',
    about: 'Avatarının etrafında ışığı dönen altın çerçeve. Profilinde, sohbette, sıralamada ve menüde görünür.',
  },
  {
    badge: 'cerceve-defne',
    frame: 'defne',
    name: 'Altın Defne Çerçevesi',
    about: 'Altın defne yaprakları ve yakut taşlarla çevrili çerçeve. Profilinde, sohbette, sıralamada ve menüde görünür.',
  },
  {
    badge: 'cerceve-mavi-alev',
    frame: 'mavi-alev',
    name: 'Mavi Alev Çerçevesi',
    about: 'Buz mavisi bir alev halkası. Profilinde, sohbette, sıralamada ve menüde görünür.',
  },
  {
    badge: 'cerceve-ejder',
    frame: 'ejder',
    name: 'Ejder Alevi Çerçevesi',
    about: 'İki ejder kanadı ve kor alevlerden bir halka. Profilinde, sohbette, sıralamada ve menüde görünür.',
  },
]

export const FRAME_BADGE_IDS: string[] = BOUGHT_FRAMES.map((f) => f.badge)

export const boughtFrameOf = (badgeId: string | null | undefined) => BOUGHT_FRAMES.find((f) => f.badge === badgeId) ?? null

/** The choice that means "no bought frame: wear the one my badges earned". */
export const TIER_FRAME_CHOICE = 'rozet'

const TIER_OF_RANK: (TierFrame | null)[] = [null, 'altin', 'elmas', 'efsane']

export const tierFrame = (rank: number): TierFrame | null => TIER_OF_RANK[Math.max(0, Math.min(3, Math.trunc(rank) || 0))]

/**
 * The frame a member wears. `bought` lists the frame badges they hold, newest first; `choice` is what they
 * picked. A choice they no longer hold is ignored, and without a choice the newest bought frame is worn, so
 * a frame shows the moment it is bought.
 */
export function wornFrame(rank: number, bought: string[], choice: string | null): AvatarFrame | null {
  const earned = tierFrame(rank)
  if (choice === TIER_FRAME_CHOICE) return earned
  const badge = choice && bought.includes(choice) ? choice : bought.find((id) => boughtFrameOf(id))
  return boughtFrameOf(badge)?.frame ?? earned
}

const FRAME_LABELS: Record<AvatarFrame, string> = {
  altin: 'Altın rozet çerçevesi',
  elmas: 'Elmas rozet çerçevesi',
  efsane: 'Efsane rozet çerçevesi',
  ozel: 'Özel profil çerçevesi',
  defne: 'Altın Defne çerçevesi',
  'mavi-alev': 'Mavi Alev çerçevesi',
  ejder: 'Ejder Alevi çerçevesi',
}

export const frameLabel = (frame: AvatarFrame) => FRAME_LABELS[frame]

/** One row of the frame picker in the profile. `id` is a frame badge, or TIER_FRAME_CHOICE for the earned frame. */
export type FrameOption = {
  id: string
  frame: AvatarFrame | null
  name: string
  about: string
  owned: boolean
  /** The market product that sells it, when one is on sale. */
  product: string | null
}

export type FrameState = { worn: AvatarFrame | null; choice: string; options: FrameOption[] }

export const NO_FRAMES: FrameState = { worn: null, choice: TIER_FRAME_CHOICE, options: [] }
