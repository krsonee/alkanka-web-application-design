export type PostButton = { text: string; url: string }

export const MAX_POST_BUTTONS = 6
export const BUTTON_TEXT_MAX = 40

const BUTTON_URL = /^(?:https?:\/\/|tg:\/\/)\S+$/i

function toList(input: unknown): unknown[] {
  if (Array.isArray(input)) return input
  if (typeof input !== 'string' || !input.trim()) return []
  try {
    const parsed: unknown = JSON.parse(input)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const field = (item: unknown, key: 'text' | 'url') =>
  item && typeof item === 'object' ? String((item as Record<string, unknown>)[key] ?? '').trim() : ''

/** Keeps only buttons Telegram accepts: a label and an http(s) or tg:// link. */
export function cleanButtons(input: unknown): PostButton[] {
  const out: PostButton[] = []
  for (const item of toList(input)) {
    const text = field(item, 'text').slice(0, BUTTON_TEXT_MAX)
    const url = field(item, 'url').slice(0, 400)
    if (!text || !BUTTON_URL.test(url)) continue
    out.push({ text, url })
    if (out.length >= MAX_POST_BUTTONS) break
  }
  return out
}

/** Why a half-filled row would be dropped, so the form can say it instead of silently losing the button. */
export function buttonError(input: unknown): string | null {
  const list = toList(input)
  if (list.length > MAX_POST_BUTTONS) return `En fazla ${MAX_POST_BUTTONS} buton eklenebilir`
  for (const [i, item] of list.entries()) {
    const text = field(item, 'text')
    const url = field(item, 'url')
    if (!text && !url) continue
    if (!text) return `${i + 1}. butonun yazısı boş`
    if (!BUTTON_URL.test(url)) return `${i + 1}. butonun linki http:// ya da https:// ile başlamalı`
  }
  return null
}

/** One button per row: sponsor labels are long and two per row get cut on phones. */
export function buttonMarkup(buttons: PostButton[] = []) {
  if (!buttons.length) return {}
  return { reply_markup: { inline_keyboard: buttons.map((b) => [{ text: b.text, url: b.url }]) } }
}
