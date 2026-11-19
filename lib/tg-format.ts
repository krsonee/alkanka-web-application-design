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

/** A member's message from the site: who wrote it on the first line, what they wrote under it. */
export function tgMemberMessage(name: string, mark: TgMark | null | undefined, text: string): string {
  return `${tgAuthor(name, mark)}\n${escapeHtml(text)}`
}

export type TgSpan = string | { bold: string }
export type TgLine = string | TgSpan[]

export const bold = (text: string | number): TgSpan => ({ bold: String(text) })

export const NOTICE_EMOJI = {
  duyuru: '📣',
  davet: '🎲',
  kazanan: '🏆',
  hatirlatma: '⏰',
  alarm: '🔔',
  adres: '🔗',
} as const

export type TgNoticeKind = keyof typeof NOTICE_EMOJI

/** An automatic message: a bold headline, the details under it, then an optional closing line and an optional address, each set apart. */
export type TgNotice = { kind: TgNoticeKind; title: string; lines?: (TgLine | null | undefined | false)[]; foot?: string; link?: string }

const spans = (line: TgLine): TgSpan[] => (typeof line === 'string' ? [line] : line)
const filled = (l: TgLine | null | undefined | false): l is TgLine => (typeof l === 'string' ? l.trim() !== '' : Array.isArray(l) && l.length > 0)
const kept = (n: TgNotice): TgLine[] => (n.lines ?? []).filter(filled)

export function tgNotice(n: TgNotice): string {
  const body = kept(n).map((line) =>
    spans(line)
      .map((s) => (typeof s === 'string' ? escapeHtml(s) : `<b>${escapeHtml(s.bold)}</b>`))
      .join(''),
  )
  const parts = [`${NOTICE_EMOJI[n.kind]} <b>${escapeHtml(n.title.trim())}</b>`]
  if (body.length) parts.push('', ...body)
  if (n.foot?.trim()) parts.push('', escapeHtml(n.foot.trim()))
  if (n.link?.trim()) parts.push('', escapeHtml(n.link.trim()))
  return parts.join('\n')
}

/** The same notice as one plain sentence, for the site's own chat feed where there is no markup. */
export function noticePlain(n: TgNotice): string {
  const title = n.title.trim()
  const head = /[.!?:]$/.test(title) ? title : `${title}!`
  const body = kept(n).map((line) =>
    spans(line)
      .map((s) => (typeof s === 'string' ? s : s.bold))
      .join(''),
  )
  return [head, ...body, n.foot ?? ''].join(' ').replace(/\s+/g, ' ').trim()
}
