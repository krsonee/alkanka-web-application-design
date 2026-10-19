export const TOUR_SETTINGS_KEY = 'tour:settings'

export const TOUR_STEP_IDS = ['hosgeldin', 'oyunlar', 'gorevler', 'market', 'siralama', 'telegram', 'uygulama', 'final'] as const
export type TourStepId = (typeof TOUR_STEP_IDS)[number]

export type TourStepText = { title: string; body: string; enabled: boolean }

export type TourSettings = {
  enabled: boolean
  autoStart: boolean
  autoStartDelay: number
  reward: number
  steps: Record<TourStepId, TourStepText>
}

export const TOUR_STEP_LABELS: Record<TourStepId, string> = {
  hosgeldin: 'Hoş geldin',
  oyunlar: 'Oyunlar',
  gorevler: 'Görevler, çark ve sandık',
  market: 'Puan marketi',
  siralama: 'Sıralama ve rozetler',
  telegram: 'Telegram kanalları',
  uygulama: 'Mobil uygulama',
  final: 'Bitiş (ödül / kayıt)',
}

export const TOUR_DEFAULTS: TourSettings = {
  enabled: true,
  autoStart: true,
  autoStartDelay: 6,
  reward: 100,
  steps: {
    hosgeldin: {
      enabled: true,
      title: 'Hoş geldin kanka!',
      body: 'Ben Jako. Burada ücretsiz oynar, Kanka Coin toplar, coinleri marketten gerçek ödüllere çevirirsin. Kısa bir tur atalım, sonunda sana hediye KC var.',
    },
    oyunlar: {
      enabled: true,
      title: 'Oyunlar',
      body: 'Tavla, okey, batak, blackjack, rulet ve daha fazlası. Tek başına oyna ya da masa açıp kankanla karşılaş.',
    },
    gorevler: {
      enabled: true,
      title: 'Görevler, çark ve sandık',
      body: 'Çarkı ve sandığı bedava aç, günlük ve haftalık görevleri tamamla. En hızlı KC kazanma yolu burası.',
    },
    market: {
      enabled: true,
      title: 'Puan marketi',
      body: 'Biriktirdiğin Kanka Coin’leri marketten freespin, bonus ve hediyelere çevir.',
    },
    siralama: {
      enabled: true,
      title: 'Sıralama ve rozetler',
      body: 'Oynadıkça seviye atla, rozet topla, haftalık sıralamada zirveye çık.',
    },
    telegram: {
      enabled: true,
      title: 'Telegram kanallarımız',
      body: 'Promo kodlar, özel oranlar ve duyurular ilk Telegram’a düşer. Kanallara katıl, hiçbir şeyi kaçırma.',
    },
    uygulama: {
      enabled: true,
      title: 'Uygulamayı yükle',
      body: 'Siteyi telefonuna uygulama olarak ekle, bildirimleri aç; ikisine de ekstra KC hediye.',
    },
    final: {
      enabled: true,
      title: 'Tur bitti, hediyen hazır!',
      body: 'Artık her yeri biliyorsun. Turu tamamla, hediye Kanka Coin’lerin hesabına yatsın.',
    },
  },
}

const clampInt = (v: unknown, min: number, max: number, fallback: number) => {
  const n = Math.round(Number(v))
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback
}

const cleanText = (v: unknown, max: number, fallback: string) => {
  const s = typeof v === 'string' ? v.trim().slice(0, max) : ''
  return s || fallback
}

export function normalizeTourSettings(input: unknown): TourSettings {
  const raw = (input && typeof input === 'object' ? input : {}) as Partial<TourSettings>
  const rawSteps = (raw.steps && typeof raw.steps === 'object' ? raw.steps : {}) as Partial<Record<TourStepId, Partial<TourStepText>>>
  const steps = Object.fromEntries(
    TOUR_STEP_IDS.map((id) => {
      const d = TOUR_DEFAULTS.steps[id]
      const s = rawSteps[id] ?? {}
      return [
        id,
        {
          enabled: id === 'final' ? true : s.enabled !== false,
          title: cleanText(s.title, 80, d.title),
          body: cleanText(s.body, 400, d.body),
        },
      ]
    }),
  ) as Record<TourStepId, TourStepText>
  return {
    enabled: raw.enabled !== false,
    autoStart: raw.autoStart !== false,
    autoStartDelay: clampInt(raw.autoStartDelay, 0, 60, TOUR_DEFAULTS.autoStartDelay),
    reward: clampInt(raw.reward, 0, 100000, TOUR_DEFAULTS.reward),
    steps,
  }
}
