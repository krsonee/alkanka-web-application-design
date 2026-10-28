export const TELEGRAM_PROMO_KEY = 'telegram:promo-strip'

export type TelegramPromoSettings = {
  enabled: boolean
  text: string
  cta: string
  url: string
  reward: number
  /** Days before a dismissed strip shows again; 0 keeps it hidden until the text changes. */
  reshowDays: number
}

export const TELEGRAM_PROMO_DEFAULTS: TelegramPromoSettings = {
  enabled: true,
  text: 'Promo kodlar, özel oranlar ve etkinlikler ilk Telegram kanalımıza düşer.',
  cta: 'Kanala katıl',
  url: '',
  reward: 150,
  reshowDays: 3,
}

const clampInt = (v: unknown, min: number, max: number, fallback: number) => {
  const n = Math.round(Number(v))
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback
}

const cleanText = (v: unknown, max: number, fallback: string) => {
  const s = typeof v === 'string' ? v.trim().slice(0, max) : ''
  return s || fallback
}

const cleanUrl = (v: unknown) => {
  const s = typeof v === 'string' ? v.trim() : ''
  if (!s) return ''
  if (/^@?[a-z0-9_]{4,32}$/i.test(s)) return `https://t.me/${s.replace(/^@/, '')}`
  return /^https:\/\/(t\.me|telegram\.me)\//i.test(s) ? s.slice(0, 200) : ''
}

export function normalizeTelegramPromo(input: unknown): TelegramPromoSettings {
  const raw = (input && typeof input === 'object' ? input : {}) as Partial<TelegramPromoSettings>
  const d = TELEGRAM_PROMO_DEFAULTS
  return {
    enabled: raw.enabled !== false,
    text: cleanText(raw.text, 140, d.text),
    cta: cleanText(raw.cta, 30, d.cta),
    url: cleanUrl(raw.url),
    reward: clampInt(raw.reward, 0, 100000, d.reward),
    reshowDays: clampInt(raw.reshowDays, 0, 60, d.reshowDays),
  }
}
