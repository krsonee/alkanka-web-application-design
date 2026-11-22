/**
 * What a library picture is, and which of a game's pictures a job starts from. A game's press kit
 * is some fifty files of which three are worth showing the image model; the rest are card letters,
 * white copies of the logo and empty frames.
 */
export const ASSET_ROLES = ['character', 'logo', 'background', 'symbol', 'object', 'other'] as const
export type AssetRole = (typeof ASSET_ROLES)[number]

export const ROLE_LABELS: Record<AssetRole, string> = {
  character: 'Karakter',
  logo: 'Oyun logosu',
  background: 'Arka plan',
  symbol: 'Sembol',
  object: 'Nesne',
  other: 'Diğer',
}

export const toRole = (value: unknown): AssetRole | '' => ASSET_ROLES.find((role) => role === value) ?? ''

/** One library picture looked at by the model once, when it is added. */
export const ASSET_SORT_COST = 0.001

export const MAX_REFERENCES = 3

/** Pictures scored under this are never chosen on their own; a pin overrides it. */
const USABLE_SCORE = 4
/** A file this small is a thumbnail whatever it shows. */
const TINY_SIDE = 200

export type AssetLabel = { role: AssetRole; score: number; note: string }

/** The model's answer made safe to store. Null when it named no role we know. */
export function settleLabel(answer: { role?: unknown; score?: unknown; note?: unknown } | null | undefined, longSide: number): AssetLabel | null {
  const role = toRole(answer?.role)
  if (!role) return null
  const raw = Math.round(Number(answer?.score))
  const score = Number.isFinite(raw) ? Math.min(10, Math.max(1, raw)) : 5
  return {
    role,
    score: longSide < TINY_SIDE ? Math.min(score, 3) : score,
    note: typeof answer?.note === 'string' ? answer.note.replace(/\s+/g, ' ').trim().slice(0, 80) : '',
  }
}

type Ranked = { id: number; game: string; role: AssetRole | ''; score: number; pinned: boolean }

/**
 * Game names are English and typed by Turkish staff: "BIG BASS" lowercases to "bıg bass" in
 * Turkish, so both i's are folded into one.
 */
export const foldName = (value: string) => value.toLocaleLowerCase('tr').replace(/ı/g, 'i').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
const fold = foldName

/**
 * The library game the text names, folded. Of two games that both match, the longer name wins, so
 * "Big Bass Halloween Splash 1000" is not mistaken for "Big Bass".
 */
export function namedGame(text: string, assets: Pick<Ranked, 'game'>[]): string | null {
  const haystack = ` ${fold(text)} `
  let found: string | null = null
  for (const asset of assets) {
    const name = fold(asset.game)
    if (name.length < 3 || (found && name.length <= found.length)) continue
    if (haystack.includes(` ${name} `)) found = name
  }
  return found
}

const byRank = (a: Ranked, b: Ranked) => Number(b.pinned) - Number(a.pinned) || b.score - a.score || a.id - b.id

/**
 * The pictures a job starts from when the text names a library game: what staff pinned first, then
 * the game's best character, logo and background, then its best symbols. A sticker is one figure,
 * so it gets one picture. Pictures nobody has labelled are never chosen here.
 */
export function bestAssets(text: string, assets: Ranked[], kind: 'banner' | 'sticker'): number[] {
  const game = namedGame(text, assets)
  if (!game) return []
  const pool = assets.filter((a) => fold(a.game) === game && a.role !== '' && (a.pinned || a.score >= USABLE_SCORE)).sort(byRank)
  const top = (...roles: AssetRole[]) => pool.find((a) => a.role !== '' && roles.includes(a.role))

  if (kind === 'sticker') {
    const hero = top('character') ?? top('symbol', 'object')
    return hero ? [hero.id] : []
  }

  const chosen = pool.filter((a) => a.pinned).slice(0, MAX_REFERENCES)
  for (const role of ['character', 'logo', 'background'] as const) {
    if (chosen.length >= MAX_REFERENCES) break
    if (chosen.some((a) => a.role === role)) continue
    const best = top(role)
    if (best) chosen.push(best)
  }
  for (const extra of pool) {
    if (chosen.length >= MAX_REFERENCES) break
    if (!chosen.includes(extra) && (extra.role === 'symbol' || extra.role === 'object')) chosen.push(extra)
  }
  return chosen.map((a) => a.id)
}

/**
 * Tells the image model what each library picture is. Without it a logo, a backdrop and a figure
 * all arrive as "reference images" and the model treats the backdrop as one more character.
 * `roles` follows the order the pictures are sent in; the mascot, when there is one, is sent first.
 */
export function referenceRules(roles: (AssetRole | '')[], mascot: boolean, kind: 'banner' | 'sticker'): string[] {
  return roles.flatMap((role, index) => {
    const at = `Reference image ${index + 1 + (mascot ? 1 : 0)}`
    if (role === 'character') {
      return mascot
        ? `${at} is the game's own character. Show it next to the mascot, looking exactly like this: same face, body, outfit, colours and art style. Its pose may change.`
        : `${at} is the game's own character. Show this exact character as the main subject: same face, body, outfit, colours and art style. Its pose and expression may change to fit the brief.`
    }
    if (role === 'logo') {
      return kind === 'sticker'
        ? `${at} is the game's official logo. If it is shown, show it exactly as it is: same letters, shapes and colours.`
        : `${at} is the game's official logo. Show it once, beside the main subject, exactly as it is: the same letters, shapes and colours, whole and readable. Leave clear space around it: no character, object or effect overlaps or covers any part of it. Do not redraw, restyle, translate or respell it. It is the one piece of lettering allowed in this picture besides what the rules above permit.`
    }
    if (role === 'background') {
      return kind === 'sticker'
        ? `${at} is the game's background art. Take only its palette and art style from it; the sticker itself still stands on flat green.`
        : `${at} is the game's own background art. Set the scene in this place: the same setting, palette, lighting and art style, recomposed to fill the frame. Do not paste it in as a flat rectangle.`
    }
    if (role === 'symbol' || role === 'object') {
      return `${at} is ${role === 'symbol' ? 'a symbol' : 'an object'} from the game. Include it in the scene looking the same, in the same art style.`
    }
    return []
  })
}
