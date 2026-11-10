export const HOME_V2_KEY = 'home-v2'

export type DailyTile = { title: string; action: string; href: string; image: string }

export type HomeV2Config = {
  enabled: boolean
  eyebrow: string
  title: string
  heroImage: string
  primaryCta: string
  primaryHref: string
  secondaryCta: string
  secondaryHref: string
  pills: string[]
  dailyTitle: string
  dailySub: string
  daily: DailyTile[]
  showWallet: boolean
  showLeaderboard: boolean
  marketHref: string
}

export type SetupConfig = {
  enabled: boolean
  title: string
  intro: string
  allowTwoSeats: boolean
  points: number[]
  ruleFull: string
  quickBotEnabled: boolean
  games: Record<WizardGame, WizardGameConfig>
}

export const WIZARD_GAMES = ['okey', 'okey101', 'tavla', 'batak', 'pisti', 'papaz', 'monopoly', 'bilardo'] as const
export type WizardGame = (typeof WIZARD_GAMES)[number]
export type WizardGameConfig = { enabled: boolean; intro: string; rule: string }

export const WIZARD_GAME_LABEL: Record<WizardGame, string> = {
  okey: 'Okey',
  okey101: '101 Okey',
  tavla: 'Tavla',
  batak: 'Batak',
  pisti: 'Pişti',
  papaz: 'Papaz Kaçtı',
  monopoly: 'Monopoly',
  bilardo: 'Bilardo',
}

export const isWizardGame = (g: string): g is WizardGame => (WIZARD_GAMES as readonly string[]).includes(g)

export const wizardEnabledFor = (setup: SetupConfig | undefined, game: string) =>
  !!setup?.enabled && isWizardGame(game) && setup.games[game]?.enabled !== false

const DEFAULT_GAME_RULES: Record<WizardGame, string> = {
  okey: '',
  okey101: 'Seçilen el sayısı oynanır, toplamda en az ceza puanı alan kazanır. Eşli modda karşılıklı oturanlar takım olur.',
  tavla: 'Tek elde mars 2 kat, ağır mars 3 kat öder; mars güvencesi için girişte bahsin 2 katı bloke edilir, oyun bitince iade edilir. 3 ya da 5 elde, ellerin çoğunu ilk alan maçı kazanır.',
  batak: 'Seçilen puana ilk ulaşan kazanır, zirvede eşitlik olursa bir el daha oynanır. Tek elde en yüksek puan kazanır, eşitlikte ihaleyi alan kazanır.',
  pisti: 'En çok kart +3, eşitlikte kimseye verilmez. As ve Vale +1, ♣2 +2, ♦10 +3. Pişti +10, Vale pişti +20.',
  papaz: 'Pot kurtulma sırasına göre bölünür: ilk kurtulan en çok alır, eşsiz kartla kalan kaybeder.',
  monopoly: "Alınmayan tapu mezata çıkar. Oyuncular kendi sıralarında takas teklif edebilir. En iyi oyun 4-6 kişiyle oynanır.",
  bilardo: 'Birebir bilardo maçı. Kazanan potu alır.',
}

export type HomeV2Settings = { home: HomeV2Config; setup: SetupConfig }

export const OKEY_POINT_CHOICES = [0, 10, 20, 30] as const

export const DEFAULT_HOME_V2: HomeV2Settings = {
  home: {
    enabled: true,
    eyebrow: 'Hoş geldin, {ad}',
    title: 'Okey masan seni bekliyor',
    heroImage: '/images/games/okey.png',
    primaryCta: 'Masa aç',
    primaryHref: '/oyunlar/okey?masa-ac=1',
    secondaryCta: 'Başka oyun',
    secondaryHref: '/oyunlar',
    pills: ['4 kişi', 'Tekli', '20 puan'],
    dailyTitle: 'Bugün senin için',
    dailySub: 'Ücretsiz haklarını kullanmayı unutma',
    daily: [
      { title: 'Günlük çark', action: 'Çevir', href: '/oyunlar/cark', image: '/images/tile-wheel.png' },
      { title: 'Sandık', action: 'Aç', href: '/oyunlar/sandik', image: '/images/tile-chest.png' },
      { title: 'Görevler', action: 'Görevlere git', href: '/gorevler', image: '/images/tile-tasks.png' },
    ],
    showWallet: true,
    showLeaderboard: true,
    marketHref: '/market',
  },
  setup: {
    enabled: true,
    title: 'Masa aç',
    intro: 'Masanı adım adım kur. Her adımda yalnızca bir şey seçersin.',
    allowTwoSeats: true,
    points: [0, 10, 20, 30],
    ruleFull:
      'Herkes seçilen puanla başlar. Normal bitişte rakipler 2 puan kaybeder (1 kat). Okeyle ya da çiftten bitiş 2 kat (4 puan), çiftten ve okeyle bitiş 4 kat (8 puan) sildirir. Göstergeyi gösteren rakiplerine 1 puan sildirir. Puanı ilk sıfırlanan olunca en yüksek puanlı kazanır.',
    quickBotEnabled: true,
    games: Object.fromEntries(WIZARD_GAMES.map((g) => [g, { enabled: true, intro: '', rule: DEFAULT_GAME_RULES[g] }])) as Record<WizardGame, WizardGameConfig>,
  },
}

const str = (v: unknown, fallback: string, max: number) => (typeof v === 'string' ? v.slice(0, max) : fallback)
const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback)

export function mergeHomeV2(saved: unknown): HomeV2Settings {
  const s = (saved && typeof saved === 'object' ? saved : {}) as Partial<{ home: Partial<HomeV2Config>; setup: Partial<SetupConfig> }>
  const h = s.home ?? {}
  const u = s.setup ?? {}
  const d = DEFAULT_HOME_V2
  const daily = Array.isArray(h.daily)
    ? h.daily.slice(0, 3).map((t, i) => ({
        title: str(t?.title, d.home.daily[i]?.title ?? '', 40),
        action: str(t?.action, d.home.daily[i]?.action ?? '', 24),
        href: str(t?.href, d.home.daily[i]?.href ?? '/', 200),
        image: str(t?.image, d.home.daily[i]?.image ?? '', 500),
      }))
    : d.home.daily
  const points = Array.isArray(u.points)
    ? OKEY_POINT_CHOICES.filter((p) => (u.points as number[]).includes(p))
    : d.setup.points
  return {
    home: {
      enabled: bool(h.enabled, d.home.enabled),
      eyebrow: str(h.eyebrow, d.home.eyebrow, 60),
      title: str(h.title, d.home.title, 90),
      heroImage: str(h.heroImage, d.home.heroImage, 500),
      primaryCta: str(h.primaryCta, d.home.primaryCta, 30),
      primaryHref: str(h.primaryHref, d.home.primaryHref, 200),
      secondaryCta: str(h.secondaryCta, d.home.secondaryCta, 30),
      secondaryHref: str(h.secondaryHref, d.home.secondaryHref, 200),
      pills: Array.isArray(h.pills) ? h.pills.filter((p): p is string => typeof p === 'string' && p.trim() !== '').slice(0, 5).map((p) => p.slice(0, 24)) : d.home.pills,
      dailyTitle: str(h.dailyTitle, d.home.dailyTitle, 60),
      dailySub: str(h.dailySub, d.home.dailySub, 120),
      daily: daily.length ? daily : d.home.daily,
      showWallet: bool(h.showWallet, d.home.showWallet),
      showLeaderboard: bool(h.showLeaderboard, d.home.showLeaderboard),
      marketHref: str(h.marketHref, d.home.marketHref, 200),
    },
    setup: {
      enabled: bool(u.enabled, d.setup.enabled),
      title: str(u.title, d.setup.title, 40),
      intro: str(u.intro, d.setup.intro, 200),
      allowTwoSeats: bool(u.allowTwoSeats, d.setup.allowTwoSeats),
      points: points.length ? points : [0],
      ruleFull: str(u.ruleFull, d.setup.ruleFull, 800),
      quickBotEnabled: bool(u.quickBotEnabled, d.setup.quickBotEnabled),
      games: Object.fromEntries(
        WIZARD_GAMES.map((g) => {
          const raw = (u.games && typeof u.games === 'object' ? (u.games as Record<string, Partial<WizardGameConfig>>)[g] : undefined) ?? {}
          const def = d.setup.games[g]
          return [g, { enabled: bool(raw.enabled, def.enabled), intro: str(raw.intro, def.intro, 200), rule: str(raw.rule, def.rule, 800) }]
        }),
      ) as Record<WizardGame, WizardGameConfig>,
    },
  }
}
