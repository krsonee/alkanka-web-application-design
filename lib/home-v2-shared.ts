export const HOME_V2_KEY = 'home-v2'

export type DailyTile = { title: string; action: string; href: string; image: string }
export type FreeTile = { title: string; sub: string; href: string; image: string }
export type PromoCard = { title: string; text: string; cta: string; href: string; image: string }
export type RailLink = { label: string; href: string; icon: string }

export const HOME_GAME_KEYS = ['okey', 'okey101', 'tavla', 'batak', 'pisti', 'papaz', 'bilardo', 'monopoly'] as const
export const SLIDE_GAME_KEYS = ['okey', 'tavla', 'batak', 'pisti', 'okey101', 'bilardo'] as const
export const HOME_GAME_LABEL: Record<string, string> = {
  okey: 'Okey',
  okey101: '101 Okey',
  tavla: 'Tavla',
  batak: 'Batak',
  pisti: 'Pişti',
  papaz: 'Papaz',
  bilardo: 'Bilardo',
  monopoly: 'Monopoly',
}
export const SPONSOR_FALLBACK_IMAGE = '/images/market/sponsor-bonus.png'
export const productImage = (p: { image?: string | null; kind?: string }) =>
  p.image?.trim() || (p.kind === 'sponsor' ? SPONSOR_FALLBACK_IMAGE : '/images/tile-market.png')
export const RAIL_ICONS = ['wheel', 'chest', 'dice', 'target', 'swords', 'megaphone', 'handshake', 'percent', 'ticket', 'gift', 'trophy', 'star'] as const

export type HomeV2Config = {
  enabled: boolean
  fullPage: boolean
  showRail: boolean
  rail: RailLink[]
  guestText: string
  guestHighlight: string
  slides: string[]
  showNewbie: boolean
  newbieTitle: string
  newbieText: string
  freeTitle: string
  freeSub: string
  free: FreeTile[]
  gamesTitle: string
  gamesSub: string
  memberGamesSub: string
  games: string[]
  showMarket: boolean
  marketTitle: string
  marketSub: string
  marketCount: number
  promos: PromoCard[]
  lbTitle: string
  lbNote: string
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
  guestEnabled: boolean
  guestEyebrow: string
  guestTitle: string
  guestPrimaryCta: string
  guestPrimaryHref: string
  guestSecondaryCta: string
  guestSecondaryHref: string
  guestCardTitle: string
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
    fullPage: true,
    showRail: true,
    rail: [
      { label: 'Günlük çark', href: '/oyunlar/cark', icon: 'wheel' },
      { label: 'Sandık', href: '/oyunlar/sandik', icon: 'chest' },
      { label: 'Zar', href: '/oyunlar/zar', icon: 'dice' },
      { label: 'Tahminler', href: '/tahminler', icon: 'target' },
      { label: 'Turnuvalar', href: '/turnuvalar', icon: 'swords' },
      { label: 'Kampanyalar', href: '/kampanyalar', icon: 'megaphone' },
      { label: 'Sponsorlar', href: '/sponsorlar', icon: 'handshake' },
      { label: 'Özel oran', href: '/ozel-oranlar', icon: 'percent' },
      { label: 'Promo kod', href: '/bonuslar', icon: 'ticket' },
    ],
    guestText: "Okey, tavla, batak, pişti ve daha fazlası. Her oyunda Kanka Coin topla, Market'te rozete, ekstra haklara ve sponsor bonuslarına çevir.",
    guestHighlight: 'kankalarınla',
    slides: [...SLIDE_GAME_KEYS],
    showNewbie: true,
    newbieTitle: 'Siteye yeni misin?',
    newbieText: 'Kısa tur, sitenin her bölümünü adım adım gösterir. Üst bardaki pusula butonundan da açabilirsin.',
    freeTitle: 'Her gün ücretsiz',
    freeSub: 'Oyun dışında da Kanka Coin toplamanın yolları',
    free: [
      { title: 'Günlük çark', sub: 'Her gün ücretsiz çevir', href: '/oyunlar/cark', image: '/images/tile-wheel.png' },
      { title: 'Sandık', sub: 'Günlük sandığını aç', href: '/oyunlar/sandik', image: '/images/tile-chest.png' },
      { title: 'Zar', sub: 'Zar at, coin topla', href: '/oyunlar/zar', image: '/images/tile-dice.png' },
      { title: 'Görevler', sub: 'Görevi bitir, coin al', href: '/gorevler', image: '/images/tile-tasks.png' },
      { title: 'Tahminler', sub: 'Maç tahmini yap', href: '/tahminler', image: '/images/tile-predict.png' },
      { title: 'Market', sub: 'Coinlerini harca', href: '/market', image: '/images/tile-market.png' },
    ],
    gamesTitle: 'Oyunlar',
    gamesSub: 'Bota karşı ya da oyuncularla, istediğin masaya otur',
    memberGamesSub: 'Hangi masaya oturuyorsun?',
    games: [...HOME_GAME_KEYS],
    showMarket: true,
    marketTitle: "Market'te seni bekleyenler",
    marketSub: 'Topladığın Kanka Coin ile alabileceğin ürünler',
    marketCount: 8,
    promos: [
      { title: 'Kampanyalar ve çekilişler', text: 'Güncel kampanyaları ve sponsor fırsatlarını tek yerde gör.', cta: 'İncele', href: '/kampanyalar', image: '/images/banner-events.png' },
      { title: 'Telegram kanalı', text: 'Duyurular ve çekilişler burada paylaşılıyor.', cta: 'Katıl', href: 'https://t.me/alkankaresmi', image: '/images/banner-telegram.png' },
    ],
    lbTitle: 'Haftalık sıralama',
    lbNote: 'Pazartesi sıfırlanır',
    eyebrow: 'Hoş geldin, {ad}',
    title: 'Okey masan seni bekliyor',
    heroImage: '/images/slides/okey.png',
    primaryCta: 'Aynı ayarla oyna',
    primaryHref: '/oyunlar/okey?masa-ac=1',
    secondaryCta: 'Başka oyun',
    secondaryHref: '/oyunlar',
    pills: ['4 kişi', 'Tekli', '20 puan', '50 KC'],
    dailyTitle: 'Bugün senin için',
    dailySub: '{toplam} ücretsiz hakkından {hazir} tanesi hazır',
    daily: [
      { title: 'Günlük çark', action: 'Çevir', href: '/oyunlar/cark', image: '/images/tile-wheel.png' },
      { title: 'Sandık', action: 'Aç', href: '/oyunlar/sandik', image: '/images/tile-chest.png' },
      { title: 'Zar', action: 'At', href: '/oyunlar/zar', image: '/images/tile-dice.png' },
    ],
    showWallet: true,
    showLeaderboard: true,
    marketHref: '/market',
    guestEnabled: true,
    guestEyebrow: 'Alkanka oyun salonu',
    guestTitle: 'Masaya otur, kankalarınla oyna.',
    guestPrimaryCta: 'Ücretsiz üye ol',
    guestPrimaryHref: '#kayit',
    guestSecondaryCta: 'Oyunlara göz at',
    guestSecondaryHref: '/oyunlar',
    guestCardTitle: 'Kayıt ol, başla',
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
  const keys = (v: unknown, allowed: readonly string[], fallback: string[]) =>
    Array.isArray(v) ? v.filter((k): k is string => typeof k === 'string' && allowed.includes(k)).filter((k, i, a) => a.indexOf(k) === i) : fallback
  const free = Array.isArray(h.free)
    ? h.free.slice(0, 8).map((t) => ({ title: str(t?.title, '', 40), sub: str(t?.sub, '', 60), href: str(t?.href, '/', 200), image: str(t?.image, '', 500) })).filter((t) => t.title)
    : d.home.free
  const promos = Array.isArray(h.promos)
    ? h.promos.slice(0, 2).map((p, i) => ({
        title: str(p?.title, d.home.promos[i]?.title ?? '', 60),
        text: str(p?.text, d.home.promos[i]?.text ?? '', 140),
        cta: str(p?.cta, d.home.promos[i]?.cta ?? '', 24),
        href: str(p?.href, d.home.promos[i]?.href ?? '/', 200),
        image: str(p?.image, d.home.promos[i]?.image ?? '', 500),
      }))
    : d.home.promos
  const rail = Array.isArray(h.rail)
    ? h.rail
        .slice(0, 12)
        .map((r) => ({ label: str(r?.label, '', 30), href: str(r?.href, '/', 200), icon: (RAIL_ICONS as readonly string[]).includes(r?.icon as string) ? (r.icon as string) : 'star' }))
        .filter((r) => r.label)
    : d.home.rail
  const marketCount = typeof h.marketCount === 'number' ? Math.min(12, Math.max(2, Math.round(h.marketCount))) : d.home.marketCount
  return {
    home: {
      enabled: bool(h.enabled, d.home.enabled),
      fullPage: bool(h.fullPage, d.home.fullPage),
      showRail: bool(h.showRail, d.home.showRail),
      rail,
      guestText: str(h.guestText, d.home.guestText, 300),
      guestHighlight: str(h.guestHighlight, d.home.guestHighlight, 40),
      slides: keys(h.slides, SLIDE_GAME_KEYS, d.home.slides),
      showNewbie: bool(h.showNewbie, d.home.showNewbie),
      newbieTitle: str(h.newbieTitle, d.home.newbieTitle, 60),
      newbieText: str(h.newbieText, d.home.newbieText, 200),
      freeTitle: str(h.freeTitle, d.home.freeTitle, 60),
      freeSub: str(h.freeSub, d.home.freeSub, 120),
      free,
      gamesTitle: str(h.gamesTitle, d.home.gamesTitle, 60),
      gamesSub: str(h.gamesSub, d.home.gamesSub, 120),
      memberGamesSub: str(h.memberGamesSub, d.home.memberGamesSub, 120),
      games: keys(h.games, HOME_GAME_KEYS, d.home.games),
      showMarket: bool(h.showMarket, d.home.showMarket),
      marketTitle: str(h.marketTitle, d.home.marketTitle, 60),
      marketSub: str(h.marketSub, d.home.marketSub, 120),
      marketCount,
      promos,
      lbTitle: str(h.lbTitle, d.home.lbTitle, 40),
      lbNote: str(h.lbNote, d.home.lbNote, 40),
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
      guestEnabled: bool(h.guestEnabled, d.home.guestEnabled),
      guestEyebrow: str(h.guestEyebrow, d.home.guestEyebrow, 60),
      guestTitle: str(h.guestTitle, d.home.guestTitle, 90),
      guestPrimaryCta: str(h.guestPrimaryCta, d.home.guestPrimaryCta, 40),
      guestPrimaryHref: str(h.guestPrimaryHref, d.home.guestPrimaryHref, 200),
      guestSecondaryCta: str(h.guestSecondaryCta, d.home.guestSecondaryCta, 30),
      guestSecondaryHref: str(h.guestSecondaryHref, d.home.guestSecondaryHref, 200),
      guestCardTitle: str(h.guestCardTitle, d.home.guestCardTitle, 40),
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
