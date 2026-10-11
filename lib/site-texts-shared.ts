import { EVENTS } from '@/components/alkanka/data'

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
  {
    id: 'events',
    title: 'Etkinlik kartları',
    description: 'Ana sayfa ve kampanyalar sayfasındaki etkinlik kartları.',
    fields: EVENTS.flatMap((e) => [
      { key: `event.${e.id}.title`, label: `${e.title} · başlık`, default: e.title, max: 60 },
      { key: `event.${e.id}.subtitle`, label: `${e.title} · alt yazı`, default: e.subtitle, max: 90 },
      { key: `event.${e.id}.prize`, label: `${e.title} · ödül yazısı`, default: e.prize, max: 40 },
    ]),
  },
]

export const TEXT_FIELDS = TEXT_GROUPS.flatMap((g) => g.fields)

export type SiteTexts = Record<string, string>

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
