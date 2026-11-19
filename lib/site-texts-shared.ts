export const TEXTS_KEY = 'texts:site'
export const DEFAULT_SIGNUP_BONUS = 250

export type TextField = { key: string; label: string; default: string; max: number; hint?: string }
export type TextGroup = { id: string; title: string; description: string; fields: TextField[] }

export const TEXT_GROUPS: TextGroup[] = [
  {
    id: 'auth',
    title: 'Giriş / kayıt penceresi',
    description: 'Metinlerde {bonus} yazarsan, aşağıdaki kayıt bonusu rakamı otomatik yazılır.',
    fields: [
      { key: 'auth.bonus', label: 'Kayıt bonusu (KC)', default: String(DEFAULT_SIGNUP_BONUS), max: 6, hint: 'Yeni üyenin cüzdanına gerçekten yüklenen miktar.' },
      { key: 'auth.eyebrow', label: 'Üst etiket', default: 'Jako diyor ki', max: 40 },
      { key: 'auth.registerSpeech', label: 'Kayıt ekranı Jako yazısı', default: 'Hoş geldin kanka! İlk girişte {bonus} Kanka Coin benden.', max: 140 },
      { key: 'auth.loginSpeech', label: 'Giriş ekranı Jako yazısı', default: 'Tekrar hoş geldin kanka, seri seni bekliyor.', max: 140 },
      { key: 'auth.registerCta', label: 'Kayıt butonu', default: 'Kayıt ol, {bonus} KC kap', max: 40 },
      { key: 'auth.loginCta', label: 'Giriş butonu', default: 'Giriş yap', max: 40 },
    ],
  },
]

export const TEXT_FIELDS = TEXT_GROUPS.flatMap((g) => g.fields)

export type SiteTexts = Record<string, string>

const EVENT_TEXT = /^event\.(.+)\.(title|subtitle|prize)$/

/**
 * Event cards used to be three fixed rows of text here, laid over the event list. They are edited on
 * the events themselves now; what was typed in the old rows is still honoured until the event is saved.
 */
export function legacyEventTexts(saved: unknown): SiteTexts {
  const out: SiteTexts = {}
  if (!saved || typeof saved !== 'object') return out
  for (const [key, value] of Object.entries(saved as Record<string, unknown>)) {
    if (EVENT_TEXT.test(key) && typeof value === 'string' && value.trim()) out[key] = value.trim()
  }
  return out
}

/** Lays the old per-event text rows over a list of events. */
export function withLegacyEventTexts<T extends { id: string; title: string; subtitle: string; prize: string }>(events: T[], saved: unknown): T[] {
  const texts = legacyEventTexts(saved)
  if (!Object.keys(texts).length) return events
  return events.map((e) => ({
    ...e,
    title: texts[`event.${e.id}.title`] ?? e.title,
    subtitle: texts[`event.${e.id}.subtitle`] ?? e.subtitle,
    prize: texts[`event.${e.id}.prize`] ?? e.prize,
  }))
}

export function mergeTexts(saved: SiteTexts | null | undefined): SiteTexts {
  const out: SiteTexts = {}
  for (const f of TEXT_FIELDS) {
    const v = saved?.[f.key]?.trim()
    out[f.key] = v ? v : f.default
  }
  return out
}

export function parseBonus(texts: SiteTexts) {
  const n = Number.parseInt(texts['auth.bonus'] ?? '', 10)
  return Number.isInteger(n) && n >= 0 && n <= 100000 ? n : DEFAULT_SIGNUP_BONUS
}

export function fillText(template: string, texts: SiteTexts) {
  return template.replaceAll('{bonus}', String(parseBonus(texts)))
}
