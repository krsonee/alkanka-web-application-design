import type { StudioTexts } from '@/lib/studio-types'

/**
 * Letters and digits only, with Turkish letters folded onto their plain forms. Two pieces of copy
 * that fold to the same string differ in nothing but Turkish spelling, case and punctuation.
 */
export function foldTr(text: string) {
  return text
    .toLocaleLowerCase('tr')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/[^\p{L}\p{N}%]+/gu, ' ')
    .trim()
}

export const sameWords = (a: string, b: string) => foldTr(a) === foldTr(b)

/** True when `text` stands in `source` word for word, whatever its Turkish letters and case. */
export function writtenIn(text: string, source: string) {
  const needle = foldTr(text)
  return needle.length > 0 && ` ${foldTr(source)} `.includes(` ${needle} `)
}

const tidy = (value: unknown) => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '')

/** The corrected spelling is taken only when it changes no word: the staff's copy is never reworded. */
export const respelled = (original: string, suggested: unknown) => {
  const fixed = tidy(suggested)
  return fixed && sameWords(original, fixed) ? fixed : original
}

// Borrowed words keep the plain capital I that Turkish players know them by: FREESPIN, not FREESPİN.
const BORROWED = new Set(['freespin', 'freespins', 'free', 'spin', 'spins', 'casino', 'win', 'wins', 'live', 'vip', 'big', 'online', 'king', 'mini', 'gift', 'bitcoin', 'wild', 'link', 'jackpotwin', 'deposit', 'cashing', 'trading'])

/** Capitals by Turkish rules (i becomes İ, ı becomes I), one word at a time so borrowed words are left alone. */
export const trUpper = (text: string) =>
  text
    .split(' ')
    .map((word) => (BORROWED.has(foldTr(word)) ? word.replace(/ı/g, 'i').toUpperCase() : word.toLocaleUpperCase('tr')))
    .join(' ')
const trSentence = (text: string) => text.charAt(0).toLocaleUpperCase('tr') + text.slice(1)

const FIELDS = ['headline', 'subline', 'cta'] as const

/** Copy typed into the form, with only its Turkish letters restored. */
export function respelledTexts(given: StudioTexts, suggested: Partial<Record<keyof StudioTexts, unknown>>): StudioTexts {
  return { headline: respelled(given.headline, suggested.headline), subline: respelled(given.subline, suggested.subline), cta: respelled(given.cta, suggested.cta) }
}

/**
 * Copy the brief asks to be written on the picture. A phrase is kept only when it stands in the
 * brief word for word, so nothing the staff did not write is ever printed.
 */
export function liftedTexts(brief: string, suggested: Partial<Record<keyof StudioTexts, unknown>>): StudioTexts | null {
  const seen = new Set<string>()
  const lifted = { headline: '', subline: '', cta: '' }
  for (const field of FIELDS) {
    const text = tidy(suggested[field])
    const key = foldTr(text)
    if (!text || seen.has(key) || !writtenIn(text, brief)) continue
    seen.add(key)
    lifted[field] = field === 'subline' ? trSentence(text) : trUpper(text)
  }
  // A lone secondary line is the headline.
  if (!lifted.headline && lifted.subline) {
    lifted.headline = trUpper(lifted.subline)
    lifted.subline = ''
  }
  return lifted.headline || lifted.cta ? lifted : null
}

/**
 * The brief with its writing requests cut out, as handed to the image model. Taken only when it is
 * a cut and nothing more: every word still comes from the brief, and none of the printed copy is left
 * in it. Otherwise empty, and the picture is drawn from the art direction alone.
 */
export function cutBrief(brief: string, cut: unknown, printed: StudioTexts | null) {
  const text = typeof cut === 'string' ? cut.trim() : ''
  if (!text) return ''
  const known = new Set(foldTr(brief).split(' '))
  if (!foldTr(text).split(' ').every((word) => known.has(word))) return ''
  const copy = printed ? FIELDS.map((field) => printed[field]).filter(Boolean) : []
  return copy.some((line) => writtenIn(line, text)) ? '' : text
}

const MARKS: Record<string, string> = {
  ş: 's with a small hook (cedilla) under it',
  Ş: 'S with a small hook (cedilla) under it',
  ç: 'c with a small hook (cedilla) under it',
  Ç: 'C with a small hook (cedilla) under it',
  ğ: 'g with a small curve (breve) above it',
  Ğ: 'G with a small curve (breve) above it',
  ö: 'o with two dots above it',
  Ö: 'O with two dots above it',
  ü: 'u with two dots above it',
  Ü: 'U with two dots above it',
  İ: 'a capital I WITH a dot above it',
  ı: 'a lowercase i WITHOUT its dot',
}

/** What an image model has to be told about the Turkish letters in a caption it draws itself. */
export function letterNotes(text: string) {
  const notes = new Map<string, string>()
  for (const letter of text) if (MARKS[letter]) notes.set(letter, MARKS[letter])
  return [...notes].map(([letter, note]) => `"${letter}" is ${note}`)
}

export const spelledOut = (text: string) =>
  text
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => [...word].join('-'))
    .join(' / ')
