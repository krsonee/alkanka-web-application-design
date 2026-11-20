export const TOUR_SETTINGS_KEY = 'tour:settings'

/** `/?tur-onizle=misafir|uye` opens the tour without reward, counting or "seen" marks. */
export const TOUR_PREVIEW_PARAM = 'tur-onizle'
/**
 * Names the unsaved draft the panel parked on the server for a preview. The panel and the site live
 * on different domains, so the draft cannot travel in the browser's own storage.
 */
export const TOUR_PREVIEW_TOKEN_PARAM = 't'
export const TOUR_PREVIEW_VALUES = { guest: 'misafir', member: 'uye' } as const

export const MAX_TOUR_STEPS = 12
export const TOUR_TITLE_MAX = 80
export const TOUR_BODY_MAX = 400

export const TOUR_AUDIENCES = ['guest', 'member'] as const
export type TourAudience = (typeof TOUR_AUDIENCES)[number]
export const TOUR_AUDIENCE_LABELS: Record<TourAudience, string> = { guest: 'Misafir turu', member: 'Üye turu' }

export type TourScreen = {
  id: string
  label: string
  /** Page the step can open, and the page its "go there" button leads to. */
  href?: string
  go?: string
  /** Tried in order; the first one actually visible on screen is highlighted. */
  selectors: string[]
  /** True when the place lives in the side menu, which is closed on phones. */
  inMenu?: boolean
  pose: 'merhaba' | 'zar' | 'sandik' | 'duyuru' | 'market' | 'telegram' | 'kazandi'
}

const nav = (id: string) => `[data-tour-nav="${id}"]`
const mark = (id: string) => `[data-tour="${id}"]`
const HUB = nav('gorev-merkezi')

export const TOUR_SCREENS: TourScreen[] = [
  { id: 'none', label: 'Hedef yok (ekranın ortasında)', selectors: [], pose: 'merhaba' },
  { id: 'oyunlar', label: 'Oyunlar', href: '/oyunlar', go: 'Oyunlara git', selectors: [nav('oyunlar'), mark('mobile-oyunlar')], inMenu: true, pose: 'zar' },
  {
    id: 'gorevler',
    label: 'Görevler, çark ve sandık',
    href: '/gorevler',
    go: 'Görevlere bak',
    selectors: [nav('gorevler'), HUB, mark('tile-cark'), mark('tile-gorev')],
    inMenu: true,
    pose: 'sandik',
  },
  { id: 'turnuvalar', label: 'Turnuvalar', href: '/turnuvalar', go: 'Turnuvalara bak', selectors: [nav('turnuvalar'), HUB], inMenu: true, pose: 'zar' },
  { id: 'tahminler', label: 'Tahmin ligi', href: '/tahminler', go: 'Tahmin ligine git', selectors: [nav('tahminler'), HUB], inMenu: true, pose: 'duyuru' },
  { id: 'market', label: 'Market', href: '/market', go: 'Markete git', selectors: [nav('market'), mark('mobile-market'), mark('tile-market')], inMenu: true, pose: 'market' },
  { id: 'siralama', label: 'Sıralama', href: '/siralama', go: 'Sıralamayı gör', selectors: [nav('siralama')], inMenu: true, pose: 'zar' },
  { id: 'rozetler', label: 'Rozetler', href: '/rozetler', go: 'Rozetlere bak', selectors: [nav('rozetler')], inMenu: true, pose: 'kazandi' },
  { id: 'kampanyalar', label: 'Kampanyalar', href: '/kampanyalar', go: 'Kampanyalara bak', selectors: [nav('kampanyalar')], inMenu: true, pose: 'duyuru' },
  { id: 'sponsorlar', label: 'Sponsorlar', href: '/sponsorlar', go: 'Sponsorlara bak', selectors: [nav('siteler')], inMenu: true, pose: 'duyuru' },
  { id: 'ozel-oranlar', label: 'Özel oranlar', href: '/ozel-oranlar', go: 'Özel oranlara bak', selectors: [nav('ozel-oranlar')], inMenu: true, pose: 'duyuru' },
  { id: 'kankatv', label: 'KankaTV', href: '/kankatv', go: 'KankaTV’yi aç', selectors: [nav('kankatv')], inMenu: true, pose: 'duyuru' },
  { id: 'telegram', label: 'Telegram kanalları', selectors: [mark('telegram')], inMenu: true, pose: 'telegram' },
  { id: 'uygulama', label: 'Mobil uygulama', href: '/uygulama', go: 'Nasıl yüklenir?', selectors: [nav('uygulama')], inMenu: true, pose: 'merhaba' },
  { id: 'coin', label: 'Kanka Coin bakiyesi (üst çubuk)', selectors: [mark('coins'), mark('account')], pose: 'sandik' },
  { id: 'hesap', label: 'Hesap / giriş düğmesi (üst çubuk)', selectors: [mark('account')], pose: 'kazandi' },
]

/** Shown on phones when the place itself sits inside the closed side menu. */
export const TOUR_MENU_BUTTON = mark('menu-btn')

export function tourScreen(id: string): TourScreen {
  return TOUR_SCREENS.find((s) => s.id === id) ?? TOUR_SCREENS[0]
}

/** `spot`: stay on the page and highlight where it is. `open`: take the visitor to the page itself. */
export type TourShow = 'spot' | 'open'

export type TourStep = {
  id: string
  title: string
  body: string
  image: string
  screen: string
  show: TourShow
  enabled: boolean
}

export type TourSettings = {
  enabled: boolean
  autoStart: boolean
  autoStartDelay: number
  reward: number
  /** Reward only within this many days of signing up; 0 = no limit. */
  rewardDays: number
  /** At most this many rewards per day; 0 = no limit. */
  rewardDailyCap: number
  /** False: everyone sees the member tour. */
  split: boolean
  /** Raised to show the tour again to people who already saw it. */
  version: number
  versionNote: string
  tours: Record<TourAudience, TourStep[]>
}

const step = (id: string, screen: string, title: string, body: string): TourStep => ({ id, screen, title, body, image: '', show: 'spot', enabled: true })

const SHARED_STEPS: TourStep[] = [
  step(
    'hosgeldin',
    'none',
    'Hoş geldin kanka!',
    'Ben Jako. Burada ücretsiz oynar, Kanka Coin toplar, coinleri marketten gerçek ödüllere çevirirsin. Kısa bir tur atalım, sonunda sana hediye KC var.',
  ),
  step('oyunlar', 'oyunlar', 'Oyunlar', 'Tavla, okey, batak, blackjack, rulet ve daha fazlası. Tek başına oyna ya da masa açıp kankanla karşılaş.'),
  step('gorevler', 'gorevler', 'Görevler, çark ve sandık', 'Çarkı ve sandığı bedava aç, günlük ve haftalık görevleri tamamla. En hızlı KC kazanma yolu burası.'),
  step('market', 'market', 'Puan marketi', 'Biriktirdiğin Kanka Coin’leri marketten freespin, bonus ve hediyelere çevir.'),
  step('siralama', 'siralama', 'Sıralama ve rozetler', 'Oynadıkça seviye atla, rozet topla, haftalık sıralamada zirveye çık.'),
  step('telegram', 'telegram', 'Telegram kanallarımız', 'Promo kodlar, özel oranlar ve duyurular ilk Telegram’a düşer. Kanallara katıl, hiçbir şeyi kaçırma.'),
  step('uygulama', 'uygulama', 'Uygulamayı yükle', 'Siteyi telefonuna uygulama olarak ekle, bildirimleri aç; ikisine de ekstra KC hediye.'),
]

const LEGACY_IDS = ['hosgeldin', 'oyunlar', 'gorevler', 'market', 'siralama', 'telegram', 'uygulama', 'final'] as const
const LEGACY_SCREENS: Record<(typeof LEGACY_IDS)[number], string> = {
  hosgeldin: 'none',
  oyunlar: 'oyunlar',
  gorevler: 'gorevler',
  market: 'market',
  siralama: 'siralama',
  telegram: 'telegram',
  uygulama: 'uygulama',
  final: 'hesap',
}

export const TOUR_DEFAULTS: TourSettings = {
  enabled: true,
  autoStart: true,
  autoStartDelay: 6,
  reward: 100,
  rewardDays: 0,
  rewardDailyCap: 0,
  split: false,
  version: 1,
  versionNote: '',
  tours: {
    member: [
      ...SHARED_STEPS,
      step('final', 'hesap', 'Tur bitti, hediyen hazır!', 'Artık her yeri biliyorsun. Turu tamamla, hediye Kanka Coin’lerin hesabına yatsın.'),
    ],
    guest: [
      ...SHARED_STEPS.filter((s) => s.id !== 'uygulama'),
      step('final', 'hesap', 'Tur bitti, hediyen seni bekliyor', 'Ücretsiz kayıt ol, tur hediyen olan Kanka Coin’ler hesabına yatsın.'),
    ],
  },
}

const clampInt = (v: unknown, min: number, max: number, fallback: number) => {
  const n = Math.round(Number(v))
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback
}

const cleanText = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

/** Only a path on this site or an https address; anything else is dropped. */
export function cleanTourImage(v: unknown): string {
  const s = typeof v === 'string' ? v.trim() : ''
  if (!s || s.length > 500 || /[\s"'<>]/.test(s)) return ''
  if (s.startsWith('/') && !s.startsWith('//')) return s
  return /^https:\/\/[^/]+\/.+/i.test(s) ? s : ''
}

function cleanSteps(input: unknown, fallback: TourStep[]): TourStep[] {
  if (!Array.isArray(input)) return fallback.map((s) => ({ ...s }))
  const used = new Set<string>()
  const steps: TourStep[] = []
  for (const item of input.slice(0, MAX_TOUR_STEPS)) {
    if (!item || typeof item !== 'object') continue
    const raw = item as Partial<TourStep>
    const title = cleanText(raw.title, TOUR_TITLE_MAX)
    const body = cleanText(raw.body, TOUR_BODY_MAX)
    if (!title && !body) continue
    let id = typeof raw.id === 'string' && /^[a-z0-9-]{1,24}$/.test(raw.id) ? raw.id : `adim-${steps.length + 1}`
    for (let n = 2; used.has(id); n += 1) id = `${id.slice(0, 20)}-${n}`
    used.add(id)
    const screen = tourScreen(String(raw.screen ?? 'none'))
    steps.push({
      id,
      title: title || screen.label,
      body,
      image: cleanTourImage(raw.image),
      screen: screen.id,
      show: raw.show === 'open' && screen.href ? 'open' : 'spot',
      enabled: raw.enabled !== false,
    })
  }
  if (!steps.length) return fallback.map((s) => ({ ...s }))
  // A tour with every step hidden would open as an empty box.
  if (!steps.some((s) => s.enabled)) steps[steps.length - 1].enabled = true
  return steps
}

/** Settings saved before steps became a list: eight fixed steps keyed by name, the last one always on. */
function legacySteps(input: unknown): TourStep[] | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null
  const old = input as Record<string, Partial<{ title: string; body: string; enabled: boolean }> | undefined>
  return LEGACY_IDS.map((id) => {
    const d = TOUR_DEFAULTS.tours.member.find((s) => s.id === id)!
    const s = old[id] ?? {}
    return {
      ...d,
      screen: LEGACY_SCREENS[id],
      title: cleanText(s.title, TOUR_TITLE_MAX) || d.title,
      body: cleanText(s.body, TOUR_BODY_MAX) || d.body,
      enabled: id === 'final' ? true : s.enabled !== false,
    }
  })
}

export function normalizeTourSettings(input: unknown): TourSettings {
  const raw = (input && typeof input === 'object' ? input : {}) as Partial<TourSettings> & { steps?: unknown }
  const rawTours = (raw.tours && typeof raw.tours === 'object' ? raw.tours : null) as Partial<Record<TourAudience, unknown>> | null
  const legacy = rawTours ? null : legacySteps(raw.steps)
  return {
    enabled: raw.enabled !== false,
    autoStart: raw.autoStart !== false,
    autoStartDelay: clampInt(raw.autoStartDelay, 0, 60, TOUR_DEFAULTS.autoStartDelay),
    reward: clampInt(raw.reward, 0, 100000, TOUR_DEFAULTS.reward),
    rewardDays: clampInt(raw.rewardDays, 0, 365, 0),
    rewardDailyCap: clampInt(raw.rewardDailyCap, 0, 100000, 0),
    split: raw.split === true,
    version: clampInt(raw.version, 1, 1_000_000, 1),
    versionNote: cleanText(raw.versionNote, 120),
    tours: {
      member: cleanSteps(rawTours?.member ?? legacy, TOUR_DEFAULTS.tours.member),
      guest: cleanSteps(rawTours?.guest ?? legacy, TOUR_DEFAULTS.tours.guest),
    },
  }
}

/** The steps a visitor actually walks through. */
export function tourSteps(settings: TourSettings, audience: TourAudience): TourStep[] {
  return settings.tours[settings.split ? audience : 'member'].filter((s) => s.enabled)
}

export function newTourStepId() {
  return `a${Math.random().toString(36).slice(2, 9)}`
}
