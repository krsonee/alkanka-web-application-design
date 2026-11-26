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
// One keycap opening a line numbers a step ("1⃣ Üye ol"); anywhere else keycaps spell a number ("1⃣5⃣ ORAN").
const STEP_KEYCAP = /^(\d)\uFE0F?\u20E3(?!\s*\d\uFE0F?\u20E3)\s*/u
const KEYCAP = /(\d)\uFE0F?\u20E3/gu

// Three or more pictures in a row inside a line: a word or a divider drawn with emoji, which says nothing in our copy.
const PICTURE = String.raw`(?:\p{Extended_Pictographic}|\p{Regional_Indicator})(?:\uFE0F|\u200D\p{Extended_Pictographic}|[\u{1F3FB}-\u{1F3FF}])*`
const PICTURE_RUN = new RegExp(String.raw`(?:${PICTURE}[ \t]*){3,}`, 'gu')

// Stand-ins a client shows for premium emoji that drew letters ("🔤🔤" for "TL"): the letters are lost, the sign is noise.
const LETTER_SIGN = /[\u{1F520}-\u{1F524}]\uFE0F?/gu

// "25⚡000": the point of a thousand drawn as a sign.
const DRAWN_POINT = new RegExp(String.raw`(\d)${PICTURE}(\d{3})(?!\d)`, 'gu')

// "20:45 | BEŞİKTAŞ 🆚 HB SHEVA": a kick-off time and the two sides, with a sign, "vs" or a dash between them.
const CLOCK = String.raw`(?:[01]?\d|2[0-3])[:.][0-5]\d`
const FIXTURE = new RegExp(String.raw`^(${CLOCK})\s*[|·•:\-–—]*\s*(\P{N}.*?)\s*(?:${PICTURE}|(?<![\p{L}])vs\.?(?![\p{L}])|\s[-–—]\s)\s*(\S.*)$`, 'iu')
// A kick-off time whose sides were drawn with premium emoji: nothing is left to say.
const BARE_CLOCK = new RegExp(String.raw`^${CLOCK}$`)
const isSide = (s: string) => /\p{L}/u.test(s) && s.length <= 32 && s.split(/\s+/).length <= 4

function fixtureOf(core: string) {
  const parts = core.match(FIXTURE)
  if (!parts || !isSide(parts[2]) || !isSide(parts[3])) return null
  return { time: parts[1].replace('.', ':'), sides: `${parts[2].trim()} – ${parts[3].trim()}` }
}

/**
 * Lines that only work under the source's own post: a reaction goal ("50 emoji gerekiyor"), a call
 * to react ("Emojileri döktür"). Reactions on our copy unlock nothing, so the line would mislead.
 */
const SOURCE_ONLY =
  /\d+\s*(?:emoji|tepki|kalp|beğeni|begeni)|(?:emoji|tepki|kalp)\p{L}*\s+(?:dök|bırak|birak|at(?![\p{L}])|bas|yağdır|yagdir|gönder|gonder|ver(?![\p{L}]))|(?:dök|bırak|birak|yağdır|yagdir)\p{L}*\s+(?:emoji|tepki|kalp)/iu

const URGENT = /son\s+\d+\s*(?:saat|dakika|dk|gün|gun)|son\s+(?:gün|gun|saatler|dakikalar|şans|sans)|bugün\s+son|bugun\s+son|süre\s+doluyor/iu

type RowKind = 'label' | 'shout' | 'item' | 'text' | 'match'
/** `mark` is the sign the source put in front of the line: two lists with different signs are two lists. */
type Row = { kind: RowKind; spans: TgSpan[]; plain: string; gapBefore: boolean; mark: string; coded?: boolean }

const letters = (s: string) => s.match(/\p{L}/gu)?.length ?? 0

/** A short line in capitals ("SON 2 SAAT!") or one that opens a list ("Katılım şartları:"). */
function headingKind(core: string): 'label' | 'shout' | null {
  if (letters(core) < 3) return null
  if (core.length <= 40 && /:$/.test(core)) return 'label'
  if (core.length <= 48 && core === upper(core) && !/[.!?]\s+\p{L}/u.test(core)) return 'shout'
  return null
}

/** "PRO KASA: Gün içerisinde ..." → the name in bold; a code after "Kod:" as tap-to-copy text. */
function labelled(core: string): { spans: TgSpan[]; coded: boolean } {
  const parts = core.match(/^([^:.!?]{2,28}):\s+(\S.*)$/u)
  if (!parts || !/\p{L}/u.test(parts[1]) || parts[1].trim().split(/\s+/).length > 4) return { spans: [core], coded: false }
  const value = parts[2].trim()
  // "KOD: ✨UEFAHAFTASI": the sign in front of the code is not part of it.
  const bare = value.replace(LEAD, '')
  const coded = namesCode(parts[1]) && CODE.test(bare)
  return { spans: [bold(`${parts[1].trim()}:`), ' ', coded ? code(bare) : value], coded }
}

const CODE = /^[A-Z0-9_-]{4,24}$/
const namesCode = (label: string) => /(?<![\p{L}])kod/iu.test(label)

/** What is left of a line once its ornament is gone. A hidden link taken out of the source can leave a sentence starting mid-way (", oranlarla kazan"). */
function coreOf(line: string) {
  const lead = line.match(LEAD)?.[0] ?? ''
  const core = line
    .slice(lead.length)
    .replace(TRAIL, '')
    .replace(/([!?])\1+/g, '$1')
    // "kazanır ." and "FIRTINA'DA !": the mark belongs to the word before it.
    .replace(/(?<=[\p{L}\p{N}%'’)])[ \t]+([.,!?;:])(?=\s|$)/gu, '$1')
    .trim()
  return /[,;.]/.test(lead) ? core.replace(/^\p{Ll}/u, (c) => upper(c)) : core
}

function rowsOf(body: string): Row[] {
  const out: Row[] = []
  let gap = false
  for (const raw of body.split('\n')) {
    const line = raw
      .trim()
      .replace(STEP_KEYCAP, '$1. ')
      .replace(KEYCAP, '$1')
      .replace(LETTER_SIGN, ' ')
      .replace(DRAWN_POINT, '$1.$2')
      .replace(PICTURE_RUN, ' ')
      .replace(/[ \t]{2,}/g, ' ')
      .trim()
    if (!line) {
      // A row that held nothing but ornament is not a gap the source left.
      if (!raw.trim()) gap = true
      continue
    }
    if (!/[\p{L}\p{N}]/u.test(line) || SOURCE_ONLY.test(line)) continue
    const core = coreOf(line)
    if (!core || BARE_CLOCK.test(core)) continue
    const prev = out[out.length - 1]
    // "Promosyon Kodu:" with the code alone on the next line: one line, the code as tap-to-copy text.
    if (prev?.kind === 'label' && namesCode(prev.plain) && CODE.test(core)) {
      out[out.length - 1] = { ...prev, kind: 'text', spans: [bold(prev.plain), ' ', code(core)], plain: `${prev.plain} ${core}` }
      gap = false
      continue
    }
    const mark = (line.match(LEAD)?.[0] ?? '').replace(/[\s\uFE0F]/g, '')
    const fixture = fixtureOf(core)
    const heading = fixture ? null : headingKind(core)
    const named = labelled(core)
    const row: Row = fixture
      ? { kind: 'match', spans: [bold(fixture.time), '  ', fixture.sides], plain: `${fixture.time} ${fixture.sides}`, gapBefore: gap, mark }
      : heading && !named.coded
        ? { kind: heading, spans: [heading === 'shout' && URGENT.test(core) ? '⏳ ' : '', bold(core)], plain: core, gapBefore: gap, mark }
        : { kind: mark ? 'item' : 'text', spans: [mark ? '• ' : '', ...named.spans], plain: core, gapBefore: gap, mark, coded: named.coded }
    out.push(row)
    gap = false
  }
  return out
}

/** A point that shares its sign with the point next to it: part of a list the source drew with one bullet. */
const inSignedList = (rows: Row[], i: number) =>
  [rows[i - 1], rows[i + 1]].some((near) => near?.kind === 'item' && near.mark === rows[i].mark)

/** A list reads as one block and stays under the line that opens it; everything else keeps the source's own gaps. */
function gapBefore(rows: Row[], i: number) {
  const prev = rows[i - 1]
  const next = rows[i]
  if (prev.kind === 'label') return false
  if (prev.kind === 'match' && next.kind === 'match') return false
  // Sources space out the points of one list. Another list starts where a gap meets a change of sign, and one side keeps a sign of its own.
  if (prev.kind === 'item' && next.kind === 'item') {
    return next.gapBefore && prev.mark !== next.mark && (inSignedList(rows, i - 1) || inSignedList(rows, i))
  }
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

  // "25.000" on a line of its own above "Ödüllü Rolling": one headline, as the source reads it.
  const [amount, after] = body
  if (amount && after && !letters(amount.plain) && !after.gapBefore && (after.kind === 'text' || after.kind === 'shout')) {
    const plain = `${amount.plain} ${after.plain}`
    body = [{ ...after, plain, spans: [bold(plain)], gapBefore: amount.gapBefore }, ...body.slice(2)]
  }

  const first = body[0]
  const hasTitle = Boolean(first && first.plain.length <= TITLE_LIMIT && first.kind !== 'label' && letters(first.plain) >= 3)
  const title = hasTitle ? first.plain.replace(/[:.]+$/, '') : ''
  const rest = hasTitle ? body.slice(1) : body
  const kind = kindOf(title, input.body)

  // A picture or a video shared without a word gets no made-up headline: only who it is from.
  // A headline that is a code ("KOD: UEFAHAFTASI") keeps the code as tap-to-copy text.
  const headline: TgSpan[] = hasTitle && first.coded ? first.spans.filter((s) => s !== '' && s !== '• ') : [bold(title || kind.label)]
  const lines: TgLine[] = body.length ? [[`${kind.emoji} `, ...headline]] : []
  if (site && tag) lines.push([bold(upper(site)), ' · ', italic(tag)])
  else if (site) lines.push([bold(upper(site))])
  else if (tag) lines.push([italic(tag)])

  rest.forEach((row, i) => {
    if (i === 0 || gapBefore(rest, i)) lines.push('')
    lines.push(row.spans.filter((s) => s !== '' && !(s === '• ' && alone(rest, i))))
  })

  if (input.footer.trim()) lines.push('', input.footer.trim())
  return { html: tgLines(lines), plain: plainLines(lines) }
}
