/**
 * What the special odds bot writes into our channel, and the rules that need no model: reading a
 * plainly written odds post when the reader is down, checking what the reader returned against the
 * post itself, and telling a bare result note ("Kazandı ✅") from a post that only carries the word.
 */
import type { ParsedOdd } from '@/lib/deal-types'
import { firstOddNumber } from '@/lib/special-odds-shared'
import { bold, italic, plainLines, strike, tgLines, type TgLine } from '@/lib/tg-format'

/** The same post twice: marked up for Telegram, plain for the site card and the panel. */
export type OddsPostText = { html: string; plain: string }

const lower = (s: string) => s.toLocaleLowerCase('tr')
const asPost = (lines: TgLine[]): OddsPostText => ({ html: tgLines(lines), plain: plainLines(lines) })

/** "20" → "20,00" */
export const oddText = (n: number) => n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const trimSymbols = (s: string) => s.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}).]+$/gu, '').trim()

// Campaign posts of a betting site: never an odd, whatever numbers they carry.
const PROMO = /free\s?spin|freebet|bonus|çevrim|cevrim|turnuva|slot|casino|jackpot|çekiliş|cekilis|kayıp|kayip|nakit|(?<![\p{L}])kasa|(?<![\p{L}])kod(?![\p{L}])/iu

export const looksLikePromo = (text: string) => PROMO.test(lower(text))

// Words of a bet type. A line such as "Karşılıklı Gol - Evet" is a market, not two teams.
const MARKET_WORD =
  /(?<![\p{L}\p{N}])(evet|hayır|hayir|var|yok|üst|ust|alt|gol|kg|ms|iy|maç sonucu|mac sonucu|handikap|korner|kart|oran|bahis|yatırım|yatirim|limit|maks|max|min|tl)(?![\p{L}\p{N}])/iu

const ODD_IN_LINE = /(?<![\d.,])\d{1,3}[.,]\d{2}\s*x?(?![\d.,])/giu

function teamSide(raw: string) {
  const side = trimSymbols(raw)
  const letters = side.match(/\p{L}/gu)?.length ?? 0
  if (letters < 3 || side.length > 40) return null
  if (/[₺$€%:|•]/u.test(side) || /\d{3,}/.test(side)) return null
  if (side.split(/\s+/).length > 5) return null
  if (MARKET_WORD.test(lower(side))) return null
  return side
}

/** "🇹🇷 Trabzonspor - Eyüpspor 👤" → "Trabzonspor - Eyüpspor"; null for anything that is not two team names. */
export function matchOfLine(line: string) {
  const parts = line.replace(ODD_IN_LINE, ' ').match(/^(.+?)\s+(?:-|–|—|vs\.?)\s+(.+)$/iu)
  if (!parts) return null
  const home = teamSide(parts[1])
  const away = teamSide(parts[2])
  return home && away ? `${home} - ${away}` : null
}

const hasMatchLine = (text: string) => text.split('\n').some((line) => matchOfLine(line.trim()))

const NUM = String.raw`\d{1,4}(?:[.,]\d{1,2})?`
// "14,59x yerine tam 20,00x", "1.85 → 2.50"
const SWAP = new RegExp(String.raw`(${NUM})\s*x?\s*(?:yerine|➜|→|➡|->|>>|»)\s*(?:tam\s*)?(${NUM})\s*x?`, 'iu')
const LIMIT = /(?:maks(?:imum)?|max)\.?\s*(?:bahis|tutar|limit)?\s*[:\-–]?\s*(\d[\d.]*\s*(?:₺|tl))/iu

const toOdd = (raw: string) => {
  const n = Number(raw.replace(',', '.'))
  return Number.isFinite(n) && n > 1 && n < 10_000 ? n : null
}

/**
 * Reads a post written the usual way (a "Team - Team" line, the bet under it, an odd) without the model.
 * Only used when the reader cannot be reached; a post it cannot read waits in the panel instead of going out.
 */
export function localOdds(text: string): ParsedOdd[] {
  if (looksLikePromo(text)) return []
  const lines = text.split('\n').map((l) => l.trim())
  const swap = text.match(SWAP)
  const shared = swap ? { oldOdd: toOdd(swap[1]), newOdd: toOdd(swap[2]) } : null
  const limit = text.match(LIMIT)?.[1]?.replace(/\s+/g, '') ?? ''
  const lone = firstOddNumber(text)

  const out: ParsedOdd[] = []
  for (let i = 0; i < lines.length && out.length < 12; i++) {
    const match = matchOfLine(lines[i])
    if (!match) continue
    const next = lines[i + 1] ?? ''
    const isMarket = Boolean(next) && next.length <= 60 && !matchOfLine(next) && !SWAP.test(next)
    const market = isMarket ? trimSymbols(next.replace(ODD_IN_LINE, ' ').replace(/\s*[•|]\s*/g, ' - ').replace(/\s{2,}/g, ' ')) : ''
    const own = firstOddNumber(lines[i]) ?? (isMarket ? firstOddNumber(next) : null)
    const newOdd = own ?? shared?.newOdd ?? lone
    if (!newOdd) continue
    const oldOdd = own ? null : (shared?.oldOdd ?? null)
    out.push({ match, league: '', market, oldOdd: oldOdd && oldOdd < newOdd ? oldOdd : null, newOdd, kickoff: '', limit })
  }
  return out
}

const sidesOf = (match: string) =>
  lower(match)
    .split(/\s+(?:-|–|—|vs\.?)\s+/u)
    .map((side) => side.trim())
    .filter((side) => side.length > 3)

/** True when the text names one of the teams of this match. */
export function namesMatch(text: string, match: string) {
  const hay = lower(text)
  return sidesOf(match).some((side) => hay.includes(side))
}

/**
 * Keeps only what the post really says: the new odd has to be written in it and at least one of the
 * teams has to be named. Guards against the reader inventing a match out of a campaign post.
 */
export function groundedOdds(text: string, odds: ParsedOdd[]): ParsedOdd[] {
  const written = new Set((text.match(/\d+(?:[.,]\d+)?/g) ?? []).map((n) => Number(n.replace(',', '.'))))
  return odds.filter((o) => written.has(o.newOdd) && namesMatch(text, o.match))
}

/** The post says it is an odd but names no match in its text: the match is usually on its picture. */
export const declaresOdd = (text: string) => /oran/iu.test(text) && !looksLikePromo(text) && !hasMatchLine(text)

/** A short note with nothing in it but the outcome, e.g. "Özel oranımız kazandı ✅". */
export const isBareNote = (text: string) => text.trim().length <= 120 && !looksLikePromo(text) && !hasMatchLine(text)

// --- Layout ------------------------------------------------------------------

type Head = { siteName: string; tagLine: string; footer: string }

function headLines(head: Head, title: string): TgLine[] {
  const site = head.siteName.trim().toLocaleUpperCase('tr')
  const first: TgLine = title ? ['⚡ ', bold(title), ' · ', bold(site)] : [bold(site)]
  return head.tagLine.trim() ? [first, [italic(head.tagLine.trim())]] : [first]
}

const footLines = (head: Head): TgLine[] => (head.footer.trim() ? ['', head.footer.trim()] : [])

const oddLine = (lead: string, oldOdd: number | null, newOdd: number): TgLine =>
  oldOdd ? [lead, strike(oddText(oldOdd)), ' yerine ', bold(oddText(newOdd))] : [lead, bold(oddText(newOdd))]

const cleanLimit = (limit: string) =>
  limit
    .replace(/^\s*(?:maks(?:imum)?|max)\.?\s*(?:bahis|tutar|limit)?\s*[:\-–]?\s*/iu, '')
    .trim()

export type OddsPostInput = Head & {
  odds: ParsedOdd[]
  /** Who can take the odd, as the source wrote it. */
  note: string
  /** The reader's word on whether the matches are one combined coupon. Null when it did not say. */
  coupon: boolean | null
}

/** An odds post rebuilt in our own layout, so every source looks the same in the channel. */
export function oddsPost(input: OddsPostInput): OddsPostText {
  const { odds } = input
  const first = odds[0]
  const sameOdd = odds.every((o) => o.newOdd === first.newOdd && o.oldOdd === first.oldOdd)
  const coupon = odds.length > 1 && sameOdd && input.coupon !== false
  const limits = new Set(odds.map((o) => cleanLimit(o.limit)))
  const sharedLimit = limits.size === 1 ? [...limits][0] : ''

  const lines: TgLine[] = [...headLines(input, 'ÖZEL ORAN')]
  for (const o of odds) {
    lines.push('', ['🔹 ', bold(o.match)])
    const when = [o.league, o.kickoff].map((v) => v.trim()).filter(Boolean).join(' · ')
    if (when) lines.push(when)
    if (o.market.trim()) lines.push(o.market.trim())
    if (!coupon) lines.push(oddLine(o.oldOdd ? '' : 'Oran: ', o.oldOdd, o.newOdd))
    if (!sharedLimit && cleanLimit(o.limit)) lines.push(`Maksimum bahis: ${cleanLimit(o.limit)}`)
  }

  const summary: TgLine[] = []
  if (coupon) summary.push(oddLine(`🎟 ${odds.length} maçlı kupon: `, first.oldOdd, first.newOdd))
  if (sharedLimit) summary.push(['💰 Maksimum bahis: ', bold(sharedLimit)])
  if (input.note.trim()) summary.push(`📌 ${input.note.trim()}`)
  if (summary.length) lines.push('', ...summary)

  return asPost([...lines, ...footLines(input)])
}

/** Rows of ornament (emoji banners, divider lines) carry nothing once the premium emoji are gone. */
export function tidyBody(text: string) {
  return text
    .split('\n')
    .map((line) => line.replace(/[ \t]{2,}/g, ' ').trim())
    .filter((line) => line === '' || /[\p{L}\p{N}]/u.test(line))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** A post shared without an odd (the source's rule lets everything through, or the panel sent it): the source's own words under our headline. */
export function carriedPost(input: Head & { body: string }): OddsPostText {
  const body = tidyBody(input.body)
  return asPost([...headLines(input, ''), ...(body ? ['', ...body.split('\n')] : []), ...footLines(input)])
}

export type SettledOdd = { match: string; market: string; newOdd: number | null }

const NOTE_EMOJI = { won: '✅', lost: '❌', filled: '🔒' } as const

/** The reply under an odd when its limit fills or its result comes in: the panel's text, then which odd it is about. */
export function resultNotice(kind: keyof typeof NOTE_EMOJI, text: string, siteName: string, odds: SettledOdd[]): OddsPostText {
  const [headline = '', ...rest] = text.trim().split('\n')
  const marked = /^[^\p{L}\p{N}]/u.test(headline)
  const lines: TgLine[] = [marked ? [bold(headline)] : [`${NOTE_EMOJI[kind]} `, bold(headline)], ...rest]
  if (!odds.length) return asPost(lines)

  const site = siteName.trim()
  const first = odds[0]
  const oneOdd = first.newOdd !== null && odds.every((o) => o.newOdd === first.newOdd)
  lines.push('')
  if (odds.length === 1) {
    lines.push([...(site ? [bold(site), ' · '] : []), first.match])
    if (first.market.trim()) lines.push(first.market.trim())
  } else {
    lines.push([...(site ? [bold(site), ' · '] : []), `${odds.length} maçlı kupon`])
    for (const o of odds.slice(0, 6)) lines.push(`🔹 ${o.match}`)
  }
  if (oneOdd) lines.push(['Oran: ', bold(oddText(first.newOdd!))])
  return asPost(lines)
}
