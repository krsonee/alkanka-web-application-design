/**
 * One look for everything the site writes into Telegram on its own: member messages relayed from the
 * site chat, and automatic notices (invites, winners, reminders, alerts). Callers hand over plain
 * text; escaping and layout happen here, so a new message cannot forget either.
 */

export const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Send options every formatted message goes out with. */
export const TG_HTML = { parse_mode: 'HTML', link_preview_options: { is_disabled: true } } as const

/** Telegram cannot draw the site's badge icons, so each icon id has an emoji that stands in for it. */
export const BADGE_EMOJI: Record<string, string> = {
  award: '🏅',
  trophy: '🏆',
  crown: '👑',
  target: '🎯',
  eye: '👁',
  message: '💬',
  feather: '🪶',
  flame: '🔥',
  gem: '💎',
  medal: '🎖',
  shield: '🛡',
  star: '⭐',
  swords: '⚔️',
  zap: '⚡',
  heart: '❤️',
  rocket: '🚀',
  bird: '🦜',
}

export const badgeEmoji = (icon: string) => BADGE_EMOJI[icon] ?? BADGE_EMOJI.award

/** The role or badge written next to a member's name. */
export type TgMark = { name: string; icon: string }

/** "🛡 <b>Ahmet</b> · Moderatör", or just the bold name for a member without a role or badge. */
export function tgAuthor(name: string, mark?: TgMark | null): string {
  const who = `<b>${escapeHtml(name.trim() || 'Kanka')}</b>`
  const label = mark?.name.trim()
  return label ? `${badgeEmoji(mark!.icon)} ${who} · ${escapeHtml(label)}` : who
}

/**
 * A member's message from the site. The first line says who wrote it and that it came from the site;
 * the words themselves sit in a quote block, so they cannot be mistaken for the bot speaking.
 */
export function tgMemberMessage(name: string, mark: TgMark | null | undefined, text: string): string {
  return `${tgAuthor(name, mark)} · <i>siteden</i>\n<blockquote>${escapeHtml(text)}</blockquote>`
}

export type TgSpan = string | { bold: string } | { italic: string } | { strike: string } | { code: string }
export type TgLine = string | TgSpan[]

export const bold = (text: string | number): TgSpan => ({ bold: String(text) })
export const italic = (text: string | number): TgSpan => ({ italic: String(text) })
export const strike = (text: string | number): TgSpan => ({ strike: String(text) })
/** Tap-to-copy text, for a bonus code. */
export const code = (text: string | number): TgSpan => ({ code: String(text) })

type Marked = { bold?: string; italic?: string; strike?: string; code?: string }

function spanHtml(span: TgSpan): string {
  if (typeof span === 'string') return escapeHtml(span)
  const { bold: b, italic: i, strike: s, code: c } = span as Marked
  if (b !== undefined) return `<b>${escapeHtml(b)}</b>`
  if (i !== undefined) return `<i>${escapeHtml(i)}</i>`
  if (c !== undefined) return `<code>${escapeHtml(c)}</code>`
  return `<s>${escapeHtml(s ?? '')}</s>`
}

function spanText(span: TgSpan): string {
  if (typeof span === 'string') return span
  const { bold: b, italic: i, strike: s, code: c } = span as Marked
  return b ?? i ?? s ?? c ?? ''
}

const lineSpans = (line: TgLine): TgSpan[] => (typeof line === 'string' ? [line] : line)

/** Lines as Telegram HTML. An empty line stays as a gap between blocks. */
export const tgLines = (lines: TgLine[]) => lines.map((line) => lineSpans(line).map(spanHtml).join('')).join('\n')

/** The same lines without markup, for places that show plain text (the site, the panel preview). */
export const plainLines = (lines: TgLine[]) => lines.map((line) => lineSpans(line).map(spanText).join('')).join('\n')

export const NOTICE_EMOJI = {
  duyuru: '📣',
  davet: '🎲',
  kazanan: '🏆',
  hatirlatma: '⏰',
  alarm: '🔔',
  adres: '🔗',
} as const

export type TgNoticeKind = keyof typeof NOTICE_EMOJI

/**
 * An automatic message: a bold headline, an optional quiet line under it (what it is, when), the
 * details, then an optional closing line and an optional address, each set apart. `button` puts the
 * address under the message as a button instead of writing it out.
 */
export type TgNotice = {
  kind: TgNoticeKind
  title: string
  sub?: string
  lines?: (TgLine | null | undefined | false)[]
  foot?: string
  link?: string
  button?: { text: string; url: string }
}

const filled = (l: TgLine | null | undefined | false): l is TgLine => (typeof l === 'string' ? l.trim() !== '' : Array.isArray(l) && l.length > 0)
const kept = (n: TgNotice): TgLine[] => (n.lines ?? []).filter(filled)

export function tgNotice(n: TgNotice): string {
  const body = kept(n).map((line) => lineSpans(line).map(spanHtml).join(''))
  const parts = [`${NOTICE_EMOJI[n.kind]} <b>${escapeHtml(n.title.trim())}</b>`]
  if (n.sub?.trim()) parts.push(`<i>${escapeHtml(n.sub.trim())}</i>`)
  if (body.length) parts.push('', ...body)
  if (n.foot?.trim()) parts.push('', escapeHtml(n.foot.trim()))
  if (n.link?.trim()) parts.push('', escapeHtml(n.link.trim()))
  return parts.join('\n')
}

/** Send options for the notice's button. Empty when it has none or the address is not a full web address. */
export function noticeMarkup(n: TgNotice) {
  const text = n.button?.text.trim()
  const url = n.button?.url.trim()
  return text && url && /^https?:\/\/\S+$/i.test(url) ? { reply_markup: { inline_keyboard: [[{ text, url }]] } } : {}
}

const sentence = (text: string) => {
  const clean = text.replace(/^[^\p{L}\p{N}%₺$€+(]+/u, '').trim()
  return clean && !/[.!?:…]$/.test(clean) ? `${clean}.` : clean
}

/** The same notice as plain sentences, for the site's own chat feed where there is no markup and no line icons. */
export function noticePlain(n: TgNotice): string {
  const title = n.title.trim()
  const head = /[.!?:]$/.test(title) ? title : `${title}!`
  const body = kept(n).map((line) => sentence(lineSpans(line).map(spanText).join('')))
  return [head, sentence(n.sub ?? ''), ...body, sentence(n.foot ?? '')].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
}
