/**
 * A bonus or campaign post taken from another channel, rebuilt in our own layout: a headline, who it
 * is from, then the terms as a tidy list. Only the arrangement changes; every term stays in the
 * source's own words. Used by the special odds bot (posts without an odd) and the post sharing bot.
 */
import { bold, code, italic, plainLines, tgLines, type TgLine, type TgSpan } from '@/lib/tg-format'

/** The same post twice: marked up for Telegram, plain for the site and the panel. */
export type PostText = { html: string; plain: string }

export type PostHead = { siteName: string; tagLine: string; footer: string }

const lower = (s: string) => s.toLocaleLowerCase('tr')
const upper = (s: string) => s.toLocaleUpperCase('tr')

const KINDS: { emoji: string; label: string; words: RegExp }[] = [
  { emoji: '🎰', label: 'Freespin', words: /free\s?spin|slot|casino|jackpot/iu },
  { emoji: '🎟', label: 'Çekiliş', words: /çekiliş|cekilis/iu },
  { emoji: '🏆', label: 'Turnuva', words: /turnuva/iu },
  { emoji: '⚽', label: 'Bahis kampanyası', words: /freebet|(?<![\p{L}])bahis/iu },
  { emoji: '🎁', label: 'Bonus', words: /bonus|kayıp|kayip|nakit|yatırım|yatirim|promosyon|(?<![\p{L}])kasa|(?<![\p{L}])kod(?![\p{L}])/iu },
]
const PLAIN_KIND = { emoji: '📣', label: 'Duyuru' }

const kindOf = (title: string, body: string) =>
  KINDS.find((k) => k.words.test(title)) ?? KINDS.find((k) => k.words.test(body)) ?? PLAIN_KIND

// What stands in front of a line in the source: emoji, bullets, dashes. A sign that belongs to the words ("%100", "+18") is kept.
const LEAD = /^[^\p{L}\p{N}%₺$€+(“"'‘]+/u
const TRAIL = /[^\p{L}\p{N}%₺$€)!?.…:”"'’]+$/u
const KEYCAP = /(\d)\uFE0F?\u20E3\s*/gu

/**
 * Lines that only work under the source's own post: a reaction goal ("50 emoji gerekiyor"), a call
 * to react ("Emojileri döktür"). Reactions on our copy unlock nothing, so the line would mislead.
 */
const SOURCE_ONLY =
  /\d+\s*(?:emoji|tepki|kalp|beğeni|begeni)|(?:emoji|tepki|kalp)\p{L}*\s+(?:dök|bırak|birak|at(?![\p{L}])|bas|yağdır|yagdir|gönder|gonder|ver(?![\p{L}]))|(?:dök|bırak|birak|yağdır|yagdir)\p{L}*\s+(?:emoji|tepki|kalp)/iu

const URGENT = /son\s+\d+\s*(?:saat|dakika|dk|gün|gun)|son\s+(?:gün|gun|saatler|dakikalar|şans|sans)|bugün\s+son|bugun\s+son|süre\s+doluyor/iu

type RowKind = 'label' | 'shout' | 'item' | 'text'
type Row = { kind: RowKind; spans: TgSpan[]; plain: string; gapBefore: boolean }

const letters = (s: string) => s.match(/\p{L}/gu)?.length ?? 0

/** A short line in capitals ("SON 2 SAAT!") or one that opens a list ("Katılım şartları:"). */
function headingKind(core: string): 'label' | 'shout' | null {
  if (letters(core) < 3) return null
  if (core.length <= 40 && /:$/.test(core)) return 'label'
  if (core.length <= 48 && core === upper(core) && !/[.!?]\s+\p{L}/u.test(core)) return 'shout'
  return null
}

/** "PRO KASA: Gün içerisinde ..." → the name in bold; a code after "Kod:" as tap-to-copy text. */
function labelled(core: string): TgSpan[] {
  const parts = core.match(/^([^:.!?]{2,28}):\s+(\S.*)$/u)
  if (!parts || !/\p{L}/u.test(parts[1]) || parts[1].trim().split(/\s+/).length > 4) return [core]
  const value = parts[2].trim()
  return [bold(`${parts[1].trim()}:`), ' ', namesCode(parts[1]) && CODE.test(value) ? code(value) : value]
}

const CODE = /^[A-Z0-9_-]{4,24}$/
const namesCode = (label: string) => /(?<![\p{L}])kod/iu.test(label)

/** What is left of a line once its ornament is gone. A hidden link taken out of the source can leave a sentence starting mid-way (", oranlarla kazan"). */
function coreOf(line: string) {
  const lead = line.match(LEAD)?.[0] ?? ''
  const core = line.slice(lead.length).replace(TRAIL, '').replace(/([!?])\1+/g, '$1').trim()
  return /[,;.]/.test(lead) ? core.replace(/^\p{Ll}/u, (c) => upper(c)) : core
}

function rowsOf(body: string): Row[] {
  const out: Row[] = []
  let gap = false
  for (const raw of body.split('\n')) {
    const line = raw.replace(KEYCAP, '$1. ').replace(/[ \t]{2,}/g, ' ').trim()
    if (!line) {
      gap = true
      continue
    }
    if (!/[\p{L}\p{N}]/u.test(line) || SOURCE_ONLY.test(line)) continue
    const core = coreOf(line)
    if (!core) continue
    const prev = out[out.length - 1]
    // "Promosyon Kodu:" with the code alone on the next line: one line, the code as tap-to-copy text.
    if (prev?.kind === 'label' && namesCode(prev.plain) && CODE.test(core)) {
      out[out.length - 1] = { ...prev, kind: 'text', spans: [bold(prev.plain), ' ', code(core)], plain: `${prev.plain} ${core}` }
      gap = false
      continue
    }
    const marked = LEAD.test(line)
    const heading = headingKind(core)
    const row: Row = heading
      ? { kind: heading, spans: [heading === 'shout' && URGENT.test(core) ? '⏳ ' : '', bold(core)], plain: core, gapBefore: gap }
      : { kind: marked ? 'item' : 'text', spans: [marked ? '• ' : '', ...labelled(core)], plain: core, gapBefore: gap }
    out.push(row)
    gap = false
  }
  return out
}

/** A list reads as one block and stays under the line that opens it; everything else keeps the source's own gaps. */
function gapBetween(prev: Row, next: Row) {
  if (prev.kind === 'label') return false
  if (prev.kind === 'item' && next.kind === 'item') return false
  return prev.kind !== next.kind || next.gapBefore
}

/** A single point is not a list: it goes out as a plain line. */
const alone = (rows: Row[], i: number) => rows[i].kind === 'item' && rows[i - 1]?.kind !== 'item' && rows[i + 1]?.kind !== 'item'

const TITLE_LIMIT = 72

export function campaignPost(input: PostHead & { body: string }): PostText {
  const site = input.siteName.trim()
  const tag = input.tagLine.trim()
  let body = rowsOf(input.body)
  // A source that opens with its own name says nothing our headline does not already say.
  if (site && body[0] && lower(body[0].plain.replace(/[!:.]+$/, '')) === lower(site)) body = body.slice(1)

  const first = body[0]
  const hasTitle = Boolean(first && first.plain.length <= TITLE_LIMIT && first.kind !== 'label' && letters(first.plain) >= 3)
  const title = hasTitle ? first.plain.replace(/[:.]+$/, '') : ''
  const rest = hasTitle ? body.slice(1) : body
  const kind = kindOf(title, input.body)

  // A picture or a video shared without a word gets no made-up headline: only who it is from.
  const lines: TgLine[] = body.length ? [[`${kind.emoji} `, bold(title || kind.label)]] : []
  if (site && tag) lines.push([bold(upper(site)), ' · ', italic(tag)])
  else if (site) lines.push([bold(upper(site))])
  else if (tag) lines.push([italic(tag)])

  rest.forEach((row, i) => {
    if (i === 0 || gapBetween(rest[i - 1], row)) lines.push('')
    lines.push(row.spans.filter((s) => s !== '' && !(s === '• ' && alone(rest, i))))
  })

  if (input.footer.trim()) lines.push('', input.footer.trim())
  return { html: tgLines(lines), plain: plainLines(lines) }
}
