/** Rules shared by the post composer in the panel and the sender on the server, so the screen never accepts what Telegram refuses. */

export const TEXT_LIMIT = 4096
export const CAPTION_LIMIT = 1024
export const POPUP_LIMIT = 200
export const COPY_LIMIT = 256
export const LABEL_LIMIT = 48
export const MAX_MEDIA = 10
export const MAX_BUTTON_ROWS = 10
export const MAX_BUTTONS_PER_ROW = 8
/** Bots cannot delete a message once it is 48 hours old, so timed deletion stops an hour short of that. */
export const MAX_DELETE_HOURS = 47
export const MAX_UNPIN_HOURS = 24 * 30
export const PHOTO_MAX_BYTES = 10 * 1024 * 1024
export const FILE_MAX_BYTES = 49 * 1024 * 1024

export type PostMediaKind = 'photo' | 'video' | 'gif' | 'file'
export type PostMedia = {
  kind: PostMediaKind
  /** Blob pathname. */
  path: string
  name: string
  size: number
  /** Telegram's id for the uploaded file; kept on the server so a second target or a resend skips the upload. */
  fileId?: string
}

export type PostButtonKind = 'link' | 'popup' | 'copy' | 'member' | 'vote' | 'raffle' | 'bot'
export type PostButton = {
  id: string
  kind: PostButtonKind
  label: string
  /**
   * link: the address · popup: the text shown in the alert · copy: the text put on the clipboard ·
   * member: what a member sees · raffle: what someone sees on joining · bot: the bot's t.me address · vote: unused.
   */
  value: string
  /** link only: route through the site so the click is counted. */
  track: boolean
  /** member only: what someone who has not joined sees. */
  alt?: string
  /** raffle only: only members of the chat may join. */
  gate?: boolean
}

const BUTTON_KIND_LIST: PostButtonKind[] = ['link', 'popup', 'copy', 'member', 'vote', 'raffle', 'bot']
/** Kinds answered by the bot itself, so they only work on a bot whose button presses reach the site. */
export const PRESS_KINDS: PostButtonKind[] = ['popup', 'member', 'vote', 'raffle']
export const needsListener = (buttons: PostButton[][]) => buttons.flat().some((b) => PRESS_KINDS.includes(b.kind))
export const DEFAULT_ALT = 'Bu içerik üyelere özel. Önce katıl, sonra butona tekrar bas.'
export const DEFAULT_JOINED = 'Çekilişe katıldın. Bol şans!'
export const BOT_LINK = /^https:\/\/t\.me\/([A-Za-z][A-Za-z0-9_]{3,31})(?:\?start=([A-Za-z0-9_-]{1,64}))?$/
export const botLink = (username: string, start: string) => `https://t.me/${username.replace(/^@/, '')}${start ? `?start=${start}` : ''}`

/** What the button shows in Telegram: vote and raffle buttons carry their running count. */
export function buttonText(b: PostButton, counts: Record<string, number>) {
  if (b.kind === 'vote') return `${b.label} ${counts[b.id] ?? 0}`
  if (b.kind === 'raffle') return `${b.label} (${counts[b.id] ?? 0})`
  return b.label
}

export type PostOptions = {
  silent: boolean
  protect: boolean
  preview: boolean
  pin: boolean
  unpinHours: number
  deleteHours: number
  sponsorId: string
}

export type PostContent = { text: string; media: PostMedia[]; buttons: PostButton[][]; options: PostOptions }

export const DEFAULT_OPTIONS: PostOptions = { silent: false, protect: false, preview: true, pin: false, unpinHours: 0, deleteHours: 0, sponsorId: '' }
export const EMPTY_POST: PostContent = { text: '', media: [], buttons: [], options: DEFAULT_OPTIONS }

export const BUTTON_KINDS: { kind: PostButtonKind; label: string; hint: string; valueLabel: string; limit: number }[] = [
  { kind: 'link', label: 'Link', hint: 'Basınca adres açılır.', valueLabel: 'Adres (https://…)', limit: 2000 },
  { kind: 'popup', label: 'Açılır yazı', hint: 'Basınca ekranda pencere açılır. Kod, kural, kazanan bilgisi için.', valueLabel: 'Pencerede çıkacak yazı', limit: POPUP_LIMIT },
  { kind: 'copy', label: 'Kodu kopyala', hint: 'Basınca yazdığın kod kişinin panosuna kopyalanır.', valueLabel: 'Kopyalanacak kod', limit: COPY_LIMIT },
  {
    kind: 'member',
    label: 'Üyeye özel',
    hint: 'Basan kişi postun durduğu kanala ya da gruba üye mi bakılır. Üyeyse içerik, değilse “önce katıl” yazısı pencerede çıkar.',
    valueLabel: 'Üyelerin göreceği yazı',
    limit: POPUP_LIMIT,
  },
  { kind: 'vote', label: 'Oy', hint: 'Butonun üstünde oy sayısı görünür. Kişi başı tek oy; aynı posttaki oy butonları tek oylama sayılır, kişi oyunu değiştirebilir.', valueLabel: '', limit: 0 },
  {
    kind: 'raffle',
    label: 'Çekilişe katıl',
    hint: 'Butonun üstünde katılan sayısı görünür. Kazananı “Gönderilenler” listesinden seçersin.',
    valueLabel: 'Katılınca çıkacak yazı (boş bırakabilirsin)',
    limit: POPUP_LIMIT,
  },
  { kind: 'bot', label: 'Bota git', hint: 'Basınca seçtiğin botla özel sohbet açılır ve bot başlatılır.', valueLabel: '', limit: 120 },
]

export type PostSponsor = { id: string; name: string; url: string }
export type PostTarget = { botId: number; chatId: string; title: string }
export type TargetCheck = { chatId: string; title: string; ok: boolean; problem: string | null }

export type RaffleWinner = { tgId: number; name: string; username: string | null }
export type PostStats = {
  /** Votes per vote button and entries on the raffle button, by button id. */
  counts: Record<string, number>
  raffle: { entries: number; closed: boolean; winners: RaffleWinner[] } | null
}

// --- Drafts, templates, scheduled posts -------------------------------------------

export type PlanKind = 'draft' | 'template' | 'scheduled'
export type PlanRepeat = 'none' | 'daily' | 'weekly'
export type PlanStatus = 'waiting' | 'sending' | 'failed' | 'missed'
export type PlanRow = {
  id: number
  kind: PlanKind
  name: string
  author: string
  botId: number | null
  chatIds: string[]
  content: PostContent
  sendAt: string | null
  repeat: PlanRepeat
  /** How late the post may still go out; 0 means however late. */
  graceMin: number
  status: PlanStatus
  lastError: string | null
  updatedAt: string
}

export const REPEAT_LABEL: Record<PlanRepeat, string> = { none: 'Bir kez', daily: 'Her gün', weekly: 'Her hafta' }
export const REPEAT_MS: Record<PlanRepeat, number> = { none: 0, daily: 24 * 60 * 60 * 1000, weekly: 7 * 24 * 60 * 60 * 1000 }
export const GRACE_CHOICES: { min: number; label: string }[] = [
  { min: 15, label: '15 dakikaya kadar' },
  { min: 60, label: '1 saate kadar' },
  { min: 180, label: '3 saate kadar' },
  { min: 0, label: 'Ne kadar geç olursa olsun gönder' },
]
export const DEFAULT_GRACE_MIN = 180
export const MAX_PLANS = 200

/** Turkey has kept UTC+3 all year since 2016, so panel times convert with a fixed offset. */
const TR_OFFSET_MS = 3 * 60 * 60 * 1000
export const TR_ZONE = 'Europe/Istanbul'

/** `YYYY-MM-DDTHH:mm` typed in Turkey time → ISO instant. */
export function localToIso(local: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return null
  const d = new Date(`${local}:00+03:00`)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}
export const isoToLocal = (iso: string | number) => new Date(new Date(iso).getTime() + TR_OFFSET_MS).toISOString().slice(0, 16)
/** Calendar day in Turkey, `YYYY-MM-DD`. */
export const trDay = (iso: string | number) => isoToLocal(iso).slice(0, 10)

/** The first run of a repeating post after `now`; null for a one-time post. */
export function nextRun(sendAt: number, repeat: PlanRepeat, now: number) {
  const step = REPEAT_MS[repeat]
  if (!step) return null
  return sendAt + Math.max(1, Math.floor((now - sendAt) / step) + 1) * step
}

/** Every run of a plan that falls inside [from, to). */
export function runsBetween(plan: Pick<PlanRow, 'sendAt' | 'repeat'>, from: number, to: number) {
  if (!plan.sendAt) return []
  const first = new Date(plan.sendAt).getTime()
  const step = REPEAT_MS[plan.repeat]
  if (!step) return first >= from && first < to ? [first] : []
  const runs: number[] = []
  for (let t = first < from ? first + Math.ceil((from - first) / step) * step : first; t < to; t += step) runs.push(t)
  return runs
}

// --- Rule for posts made outside the panel ----------------------------------------

export const SIGNATURE_LIMIT = 200
export type ChannelRule = {
  botId: number
  chatId: string
  title: string
  enabled: boolean
  /** Plain line added under the post's text. */
  signature: string
  sponsorId: string
  buttons: PostButton[][]
}

export type PostSendRow = {
  id: number
  chatId: string
  chatTitle: string
  link: string | null
  status: 'sent' | 'failed' | 'deleted'
  error: string | null
  pinned: boolean
  unpinAt: string | null
  deleteAt: string | null
  sentAt: string
  editedAt: string | null
  /** False once the message is too old for a bot to delete. */
  canDelete: boolean
  mediaCount: number
  textOnMedia: boolean
}

/** manual: posted to a channel outside the panel (by hand, or by a bot that keeps no record) and picked up by the listening bot. */
export type PostOrigin = 'panel' | 'mirror' | 'share' | 'manual'
export type PostRow = {
  id: number
  origin: PostOrigin
  note: string
  author: string
  botId: number | null
  botName: string
  content: PostContent
  /** The text holds formatting the panel cannot rebuild, so it is left as it is in Telegram. */
  locked: boolean
  createdAt: string
  sends: PostSendRow[]
  clicks: Record<string, number>
  stats: PostStats
}

export const ORIGIN_LABEL: Record<PostOrigin, string> = { panel: 'Panel', mirror: 'Kanal aktarımı', share: 'Post paylaşım', manual: 'Panel dışı' }

export type PostCenterData = {
  bots: { id: number; name: string; username: string }[]
  targets: PostTarget[]
  /** Bots that receive button presses; only these can carry buttons the bot answers itself. */
  listening: number[]
  sponsors: PostSponsor[]
  /** Images made in the Studio, offered as ready media. */
  library: { path: string; label: string }[]
  posts: PostRow[]
  hasMore: boolean
  testChat: string
  plans: PlanRow[]
  rules: ChannelRule[]
}

// --- Text ------------------------------------------------------------------------

const NAMED: Record<string, string> = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'", nbsp: ' ' }

export function decodeText(s: string) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, ref: string) => {
    if (ref[0] !== '#') return NAMED[ref.toLowerCase()] ?? whole
    const code = ref[1].toLowerCase() === 'x' ? parseInt(ref.slice(2), 16) : parseInt(ref.slice(1), 10)
    return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : ''
  })
}

export const escapeText = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const escapeAttr = (s: string) => escapeText(s).replace(/"/g, '&quot;')

/** Telegram opens only web and tg:// links from a message or a button. */
export function safeLink(input: string) {
  const raw = input.trim()
  if (!raw) return null
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`
  if (!/^(https?:\/\/|tg:\/\/)/i.test(candidate)) return null
  try {
    const url = new URL(candidate)
    if (url.protocol !== 'tg:' && !url.hostname.includes('.')) return null
    return url.toString()
  } catch {
    return null
  }
}

const TAGS: Record<string, string> = {
  b: 'b', strong: 'b', i: 'i', em: 'i', u: 'u', ins: 'u', s: 's', strike: 's', del: 's',
  code: 'code', pre: 'pre', blockquote: 'blockquote', 'tg-spoiler': 'tg-spoiler', a: 'a',
}
const LINE_BREAKERS = new Set(['div', 'p', 'li', 'tr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'])
const TOKEN = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^'">])*)>|([^<]+)|(<)/g
const EMPTY_PAIR = /<(b|i|u|s|code|pre|blockquote|tg-spoiler)><\/\1>|<a href="[^"]*"><\/a>|<tg-emoji emoji-id="\d+"><\/tg-emoji>/g
const EMOJI_ID = /^\d{1,20}$/

function attrOf(attrs: string, name: string) {
  const m = new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(attrs)
  return m ? decodeText(m[1] ?? m[2] ?? m[3] ?? '') : ''
}

/**
 * Reduces any HTML to the tags Telegram accepts, always properly nested and closed.
 * Telegram rejects the whole message on one stray tag, so nothing outside this list survives.
 */
export function cleanTgHtml(input: string): string {
  const out: string[] = []
  const stack: string[] = []
  const spans: boolean[] = []
  const closeDownTo = (tag: string) => {
    const at = stack.lastIndexOf(tag)
    if (at < 0) return
    for (let i = stack.length - 1; i >= at; i--) out.push(`</${stack[i]}>`)
    stack.length = at
  }
  const breakLine = () => {
    const last = out[out.length - 1]
    if (last !== undefined && !last.endsWith('\n')) out.push('\n')
  }

  for (const m of String(input ?? '').matchAll(TOKEN)) {
    if (m[4] !== undefined) {
      out.push(escapeText(decodeText(m[4])))
      continue
    }
    if (m[5] !== undefined) {
      out.push('&lt;')
      continue
    }
    const closing = m[1] === '/'
    const name = m[2].toLowerCase()
    const attrs = m[3] ?? ''
    const literal = stack.includes('code') || stack.includes('pre')

    if (name === 'br') {
      if (!closing) out.push('\n')
      continue
    }
    if (LINE_BREAKERS.has(name)) {
      breakLine()
      continue
    }
    if (name === 'span') {
      if (closing) {
        if (spans.pop()) closeDownTo('tg-spoiler')
        continue
      }
      const spoiler = /class\s*=\s*["']?[^"'>]*\btg-spoiler\b/i.test(attrs) && !literal && !stack.includes('tg-spoiler') && !stack.includes('tg-emoji')
      spans.push(spoiler)
      if (spoiler) {
        stack.push('tg-spoiler')
        out.push('<tg-spoiler>')
      }
      continue
    }
    if (name === 'img') {
      // The writing area shows a premium emoji as an image; Telegram wants a tag around the plain emoji it stands for.
      const id = attrOf(attrs, 'data-emoji-id')
      const alt = [...attrOf(attrs, 'alt').trim()].slice(0, 10).join('')
      if (!closing && !literal && !stack.includes('tg-emoji') && EMOJI_ID.test(id) && alt) out.push(`<tg-emoji emoji-id="${id}">${escapeText(alt)}</tg-emoji>`)
      continue
    }
    if (name === 'tg-emoji') {
      if (closing) {
        closeDownTo('tg-emoji')
        continue
      }
      const id = attrOf(attrs, 'emoji-id')
      if (literal || stack.includes('tg-emoji') || !EMOJI_ID.test(id)) continue
      stack.push('tg-emoji')
      out.push(`<tg-emoji emoji-id="${id}">`)
      continue
    }
    const tag = TAGS[name]
    if (!tag) continue
    if (closing) {
      // Inside code only its own closing tag counts; everything else there is plain text.
      if (!literal || tag === 'code' || tag === 'pre') closeDownTo(tag)
      continue
    }
    // A premium emoji holds nothing but its plain emoji.
    if (literal || stack.includes(tag) || stack.includes('tg-emoji')) continue
    if (tag === 'blockquote' || tag === 'pre') breakLine()
    if (tag === 'a') {
      const href = /href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attrs)
      const url = href ? safeLink(decodeText(href[1] ?? href[2] ?? href[3] ?? '')) : null
      if (!url) continue
      stack.push('a')
      out.push(`<a href="${escapeAttr(url)}">`)
      continue
    }
    stack.push(tag)
    out.push(`<${tag}>`)
  }
  for (let i = stack.length - 1; i >= 0; i--) out.push(`</${stack[i]}>`)

  let html = out.join('')
  for (let prev = ''; prev !== html; ) {
    prev = html
    html = html.replace(EMPTY_PAIR, '')
  }
  return html.replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim()
}

// --- Premium emoji ---------------------------------------------------------------

/** Served only to a signed-in panel account; see app/panel/tg-emoji/[id]/route.ts. */
export const EMOJI_IMAGE_PATH = '/panel/tg-emoji/'

export type EmojiPack = { name: string; title: string; emojis: { id: string; emoji: string }[] }

const TG_EMOJI = /<tg-emoji emoji-id="(\d+)">([^<]*)<\/tg-emoji>/g

export const hasPremiumEmoji = (html: string) => html.includes('<tg-emoji ')

/** A premium emoji as the panel shows it. cleanTgHtml turns it back into Telegram's tag. */
export const emojiImageTag = (id: string, emoji: string) =>
  `<img class="tg-emoji" data-emoji-id="${id}" alt="${escapeAttr(emoji)}" src="${EMOJI_IMAGE_PATH}${id}" draggable="false">`

/** Clean Telegram HTML with every premium emoji as its image, for the writing area and the preview. */
export const showPremiumEmoji = (html: string) => html.replace(TG_EMOJI, (_, id: string, alt: string) => emojiImageTag(id, decodeText(alt)))

/** The same text with every premium emoji replaced by the plain emoji it stands for. */
export const plainEmoji = (html: string) => html.replace(TG_EMOJI, '$2')

export const plainText = (html: string) => decodeText(html.replace(/<[^>]+>/g, ''))

/** What Telegram counts against its limits: the text left after formatting is removed. */
export const visibleLength = (html: string) => plainText(html).length

export function signatureHtml(sponsor: PostSponsor | null | undefined) {
  if (!sponsor) return ''
  return `<a href="${escapeAttr(sponsor.url)}"><b>${escapeText(sponsor.name)} giriş ve bonus için tıkla</b></a>`
}

/** The text as it reaches Telegram: the written part plus the sponsor line, when one is picked. */
export function finalText(content: PostContent, sponsors: PostSponsor[]) {
  const signature = signatureHtml(sponsors.find((s) => s.id === content.options.sponsorId))
  return [content.text, signature].filter(Boolean).join('\n\n')
}

export const hasButtons = (content: PostContent) => content.buttons.some((row) => row.length > 0)

/**
 * Telegram cannot put buttons under an album or more than 1024 characters under any media.
 * In both cases the media goes first and the text follows as its own message, carrying the buttons.
 */
export function needsSplit(mediaCount: number, textLength: number, withButtons: boolean) {
  return mediaCount > 0 && (textLength > CAPTION_LIMIT || (mediaCount > 1 && withButtons))
}

// --- Media -----------------------------------------------------------------------

export const MEDIA_PATH = /^(tgposts\/[a-z0-9_-][a-z0-9._-]{0,119}|studio\/[a-z0-9_-][a-z0-9._-]{0,59}\/[a-z0-9_-][a-z0-9._-]{0,119})$/i

/** File types the composer accepts, by extension. */
export const UPLOAD_TYPES: Record<string, { mime: string; kind: PostMediaKind }> = {
  jpg: { mime: 'image/jpeg', kind: 'photo' },
  jpeg: { mime: 'image/jpeg', kind: 'photo' },
  png: { mime: 'image/png', kind: 'photo' },
  webp: { mime: 'image/webp', kind: 'photo' },
  gif: { mime: 'image/gif', kind: 'gif' },
  mp4: { mime: 'video/mp4', kind: 'video' },
  pdf: { mime: 'application/pdf', kind: 'file' },
  zip: { mime: 'application/zip', kind: 'file' },
  txt: { mime: 'text/plain', kind: 'file' },
  csv: { mime: 'text/csv', kind: 'file' },
  docx: { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', kind: 'file' },
  xlsx: { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', kind: 'file' },
}

export const extensionOf = (name: string) => /\.([a-z0-9]{1,5})$/i.exec(name)?.[1].toLowerCase() ?? ''
export const mediaKindOf = (path: string): PostMediaKind => UPLOAD_TYPES[extensionOf(path)]?.kind ?? 'file'
export const mediaUrl = (path: string) => `/api/tg/post-media/${path}`
export const MEDIA_KIND_LABEL: Record<PostMediaKind, string> = { photo: 'Fotoğraf', video: 'Video', gif: 'GIF', file: 'Dosya' }

const mb = (bytes: number) => (bytes / 1024 / 1024).toLocaleString('tr-TR', { maximumFractionDigits: 1 })

/** Returns why a file is refused, or null when it may be attached. */
export function uploadProblem(file: { name: string; size: number }) {
  const type = UPLOAD_TYPES[extensionOf(file.name)]
  if (!type) return 'Bu dosya türü desteklenmiyor. JPG, PNG, WEBP, GIF, MP4, PDF, ZIP, TXT, CSV, DOCX ya da XLSX yükle.'
  const max = type.kind === 'photo' ? PHOTO_MAX_BYTES : FILE_MAX_BYTES
  if (file.size > max) return `Bu dosya ${mb(file.size)} MB. Telegram ${type.kind === 'photo' ? 'fotoğrafta' : 'bu türde'} en fazla ${mb(max)} MB kabul ediyor.`
  return null
}

// --- Whole post ------------------------------------------------------------------

const clampInt = (v: unknown, min: number, max: number) => {
  const n = Math.round(Number(v))
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min
}

export const newButtonId = () => Math.random().toString(36).slice(2, 8).padEnd(6, '0')

/** Rebuilds a post from untrusted input, keeping only known fields within Telegram's bounds. */
export function normalizeContent(raw: unknown): PostContent {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const o = (r.options && typeof r.options === 'object' ? r.options : {}) as Record<string, unknown>
  const seen = new Set<string>()

  const media: PostMedia[] = (Array.isArray(r.media) ? r.media : [])
    .map((m) => (m && typeof m === 'object' ? (m as Record<string, unknown>) : {}))
    .filter((m) => typeof m.path === 'string' && MEDIA_PATH.test(m.path) && !m.path.includes('..'))
    .slice(0, MAX_MEDIA)
    .map((m) => ({
      kind: mediaKindOf(String(m.path)),
      path: String(m.path),
      name: String(m.name ?? '').replace(/[^\p{L}\p{N} ._()-]/gu, '').slice(0, 80) || String(m.path).split('/').pop()!,
      size: clampInt(m.size, 0, FILE_MAX_BYTES),
    }))

  const buttons: PostButton[][] = (Array.isArray(r.buttons) ? r.buttons : [])
    .slice(0, MAX_BUTTON_ROWS)
    .map((row) =>
      (Array.isArray(row) ? row : [])
        .slice(0, MAX_BUTTONS_PER_ROW)
        .map((b) => (b && typeof b === 'object' ? (b as Record<string, unknown>) : {}))
        .map((b): PostButton => {
          const kind: PostButtonKind = BUTTON_KIND_LIST.includes(b.kind as PostButtonKind) ? (b.kind as PostButtonKind) : 'link'
          let id = typeof b.id === 'string' && /^[a-z0-9]{1,8}$/.test(b.id) ? b.id : newButtonId()
          while (seen.has(id)) id = newButtonId()
          seen.add(id)
          const value = String(b.value ?? '').replace(/\r/g, '').trim()
          const limit = BUTTON_KINDS.find((k) => k.kind === kind)!.limit
          return {
            id,
            kind,
            label: String(b.label ?? '').replace(/\s+/g, ' ').trim().slice(0, LABEL_LIMIT),
            value: kind === 'link' ? (safeLink(value) ?? value).slice(0, limit) : value.slice(0, limit),
            track: kind === 'link' && Boolean(b.track),
            ...(kind === 'member' ? { alt: String(b.alt ?? '').replace(/\r/g, '').trim().slice(0, POPUP_LIMIT) } : {}),
            ...(kind === 'raffle' ? { gate: Boolean(b.gate) } : {}),
          }
        }),
    )
    .filter((row) => row.length > 0)

  const pin = Boolean(o.pin)
  return {
    text: cleanTgHtml(String(r.text ?? '')),
    media,
    buttons,
    options: {
      silent: Boolean(o.silent),
      protect: Boolean(o.protect),
      preview: o.preview === undefined ? true : Boolean(o.preview),
      pin,
      unpinHours: pin ? clampInt(o.unpinHours, 0, MAX_UNPIN_HOURS) : 0,
      deleteHours: clampInt(o.deleteHours, 0, MAX_DELETE_HOURS),
      sponsorId: String(o.sponsorId ?? '').slice(0, 80),
    },
  }
}

/** Every reason Telegram (or common sense) would refuse this post. Empty means it can be sent. */
export function postProblems(content: PostContent, text: string): string[] {
  const problems: string[] = []
  const length = visibleLength(text)
  const { media } = content
  const buttons = content.buttons.flat()

  if (!length && !media.length) problems.push('Yazı ya da medya ekle.')
  if (length > TEXT_LIMIT) problems.push(`Yazı ${length} karakter. Telegram en fazla ${TEXT_LIMIT} karakter kabul ediyor.`)
  if (media.length > 1) {
    if (media.some((m) => m.kind === 'gif')) problems.push('GIF albümde gönderilemez. GIF’i tek başına gönder ya da albümden çıkar.')
    if (media.some((m) => m.kind === 'file') && media.some((m) => m.kind !== 'file')) {
      problems.push('Dosyalar fotoğraf ve videoyla aynı albümde olamaz. Ya sadece dosya ya da sadece fotoğraf/video seç.')
    }
  }
  if (media.length > 1 && buttons.length && !length) {
    problems.push('Telegram albümün altına buton koymuyor; butonlar ayrı bir yazı mesajıyla gider. Bunun için yazı ekle.')
  }
  problems.push(...buttonProblems(buttons))
  const unfilled = templateFields(content)
  if (unfilled.length) problems.push(`Doldurulmamış şablon alanı var: ${unfilled.map((f) => `{${f}}`).join(', ')}. Yerine gerçek değeri yaz.`)
  return [...new Set(problems)]
}

export function buttonProblems(buttons: PostButton[]): string[] {
  const problems: string[] = []
  for (const b of buttons) {
    const name = b.label ? `"${b.label}" butonu` : 'Adsız buton'
    if (!b.label) problems.push('Her butonun üstünde bir yazı olmalı.')
    if (b.kind === 'link' && !safeLink(b.value)) problems.push(`${name}: adres geçersiz. https:// ile başlayan tam adresi yaz.`)
    if (b.kind === 'popup' && !b.value) problems.push(`${name}: pencerede çıkacak yazı boş.`)
    if (b.kind === 'copy' && !b.value) problems.push(`${name}: kopyalanacak kod boş.`)
    if (b.kind === 'member' && !b.value) problems.push(`${name}: üyelerin göreceği yazı boş.`)
    if (b.kind === 'bot' && !BOT_LINK.test(b.value)) problems.push(`${name}: gidilecek botu seç.`)
  }
  if (buttons.filter((b) => b.kind === 'raffle').length > 1) problems.push('Bir postta tek çekiliş butonu olur.')
  return problems
}

// --- Templates -------------------------------------------------------------------

export const TEMPLATE_FIELDS = ['sponsor', 'kod', 'link'] as const
export type TemplateField = (typeof TEMPLATE_FIELDS)[number]
export const TEMPLATE_FIELD_LABEL: Record<TemplateField, string> = { sponsor: 'Sponsor adı', kod: 'Promosyon kodu', link: 'Link' }

const textsOf = (content: PostContent) => [content.text, ...content.buttons.flat().flatMap((b) => [b.label, b.value, b.alt ?? ''])]

/** Template fields still standing in the post, in a fixed order. */
export function templateFields(content: PostContent): TemplateField[] {
  const all = textsOf(content).join('\n')
  return TEMPLATE_FIELDS.filter((f) => all.includes(`{${f}}`))
}

/** Puts real values in place of `{sponsor}`, `{kod}` and `{link}`; a field left empty stays as written. */
export function fillTemplate(content: PostContent, values: Partial<Record<TemplateField, string>>): PostContent {
  const fill = (s: string, escape: boolean) =>
    TEMPLATE_FIELDS.reduce((out, f) => {
      const value = (values[f] ?? '').trim()
      return value ? out.split(`{${f}}`).join(escape ? escapeText(value) : value) : out
    }, s)
  return {
    ...content,
    text: fill(content.text, true),
    buttons: content.buttons.map((row) =>
      row.map((b) => ({ ...b, label: fill(b.label, false), value: fill(b.value, false), ...(b.alt !== undefined ? { alt: fill(b.alt, false) } : {}) })),
    ),
  }
}

// --- Telegram entities -----------------------------------------------------------

export type TgTextEntity = { type: string; offset: number; length: number; url?: string; user?: { id: number }; language?: string }

const ENTITY_TAG: Record<string, string> = {
  bold: 'b', italic: 'i', underline: 'u', strikethrough: 's', spoiler: 'tg-spoiler', code: 'code', pre: 'pre', blockquote: 'blockquote',
}
/** Telegram marks these again by itself when the same text is sent back, so nothing is lost by leaving them out. */
const SELF_MARKED = new Set(['mention', 'hashtag', 'cashtag', 'bot_command', 'url', 'email', 'phone_number'])

/**
 * Rebuilds a message a person wrote in Telegram as the HTML the bot would have to send to keep it the same.
 * `lossless` is false when the message holds something that cannot be sent back (custom emoji, a collapsed quote,
 * a code language); editing such a text would strip it, so the caller should leave the text alone.
 */
export function entitiesToHtml(text: string, entities: TgTextEntity[] = []): { html: string; lossless: boolean } {
  const opens = new Map<number, string[]>()
  const closes = new Map<number, string[]>()
  let lossless = true
  for (const e of [...entities].sort((a, b) => a.offset - b.offset || b.length - a.length)) {
    if (e.length <= 0 || SELF_MARKED.has(e.type)) continue
    let open: string
    let close: string
    if (e.type === 'text_link' && e.url) [open, close] = [`<a href="${escapeAttr(e.url)}">`, '</a>']
    else if (e.type === 'text_mention' && e.user) [open, close] = [`<a href="tg://user?id=${e.user.id}">`, '</a>']
    else if (ENTITY_TAG[e.type] && !e.language) [open, close] = [`<${ENTITY_TAG[e.type]}>`, `</${ENTITY_TAG[e.type]}>`]
    else {
      lossless = false
      continue
    }
    opens.set(e.offset, [...(opens.get(e.offset) ?? []), open])
    closes.set(e.offset + e.length, [close, ...(closes.get(e.offset + e.length) ?? [])])
  }
  let out = ''
  for (let i = 0; i <= text.length; i++) {
    out += (closes.get(i) ?? []).join('')
    if (i === text.length) break
    out += (opens.get(i) ?? []).join('') + escapeText(text[i])
  }
  return { html: cleanTgHtml(out), lossless }
}
