import {
  CircleDot,
  Dices,
  Flag,
  Gift,
  HelpCircle,
  Home,
  LayoutGrid,
  ListChecks,
  Megaphone,
  Percent,
  ShoppingBag,
  Ticket,
  Trophy,
  type LucideIcon,
} from 'lucide-react'

export const TELEGRAM_URL = 'https://t.me/AlkankaOfficial'

export type NavItem = { id: string; label: string; href: string; icon: LucideIcon; badge?: string }

export const NAV_ITEMS: NavItem[] = [
  { id: 'anasayfa', label: 'Ana sayfa', href: '#anasayfa', icon: Home },
  { id: 'siteler', label: 'Siteler', href: '#siteler', icon: LayoutGrid },
  { id: 'gorevler', label: 'Görevler', href: '#gorevler', icon: ListChecks },
  { id: 'market', label: 'Puan marketi', href: '#market', icon: ShoppingBag },
  { id: 'oyunlar', label: 'Çark', href: '#oyunlar', icon: CircleDot, badge: 'Yeni' },
  { id: 'zar', label: 'Zar', href: '#oyunlar', icon: Dices },
  { id: 'sandik', label: 'Sandık', href: '#oyunlar', icon: Gift },
  { id: 'etkinlikler', label: 'Biletler', href: '#etkinlikler', icon: Ticket },
  { id: 'tahminler', label: 'Tahminler', href: '#etkinlikler', icon: Flag },
  { id: 'ozel-oranlar', label: 'Özel oranlar', href: '#siteler', icon: Percent },
  { id: 'kampanyalar', label: 'Kampanyalar', href: '#siteler', icon: Megaphone },
  { id: 'siralama', label: 'Sıralama', href: '#siralama', icon: Trophy },
  { id: 'sss', label: 'SSS', href: '#sss', icon: HelpCircle },
]

export type Slide = {
  id: string
  eyebrow: string
  title: string
  description: string
  cta: string
  href: string
  image: string
}

export const SLIDES: Slide[] = [
  {
    id: 's1',
    eyebrow: 'Günlük ödül',
    title: 'Çarkı çevir, AlkaCoin topla',
    description: 'Her 6 saatte bir ücretsiz çevirme hakkı. Boost, kod ve VIP geçiş kazan.',
    cta: 'Çarkı aç',
    href: '#oyunlar',
    image: '/images/banner-wheel.png',
  },
  {
    id: 's2',
    eyebrow: 'Puan marketi',
    title: 'Rozet, ekstra hak ve hediyeler',
    description: 'Topladığın AlkaCoin ile marketten dilediğini al. Nakit yok, sadece ödül.',
    cta: 'Marketi aç',
    href: '#market',
    image: '/images/hero-chest.png',
  },
  {
    id: 's3',
    eyebrow: 'Telegram',
    title: 'Kodlar önce Telegram’a düşer',
    description: '@AlkankaOfficial kanalında 14.2K üye. Promo kodlar, anketler ve anlık drop’lar.',
    cta: 'Kanala katıl',
    href: TELEGRAM_URL,
    image: '/images/banner-telegram.png',
  },
  {
    id: 's4',
    eyebrow: 'Haftalık etkinlik',
    title: '250.000 AlkaCoin ödüllü bilet çekilişi',
    description: 'Bilet al, tahmin yap, sıralamada yüksel. Her pazar 21:00’de çekiliş.',
    cta: 'Bilet al',
    href: '#etkinlikler',
    image: '/images/banner-events.png',
  },
]

export type QuickTile = { id: string; label: string; cta: string; href: string; image: string }

export const QUICK_TILES: QuickTile[] = [
  { id: 'cark', label: 'Çark', cta: 'Çarkı aç', href: '#oyunlar', image: '/images/tile-wheel.png' },
  { id: 'market', label: 'Market', cta: 'Marketi aç', href: '#market', image: '/images/tile-market.png' },
  { id: 'gorev', label: 'Görevler', cta: 'Görevlere git', href: '#gorevler', image: '/images/tile-tasks.png' },
  { id: 'zar', label: 'Zar', cta: 'Zar at', href: '#oyunlar', image: '/images/tile-dice.png' },
  { id: 'sandik', label: 'Sandık', cta: 'Sandık aç', href: '#oyunlar', image: '/images/tile-chest.png' },
  { id: 'tahmin', label: 'Tahminler', cta: 'Tahmin et', href: '#etkinlikler', image: '/images/tile-predict.png' },
]

export type TickerEvent = { id: string; kind: 'telegram' | 'claim' | 'drop'; text: string; time: string }

export const TICKER_EVENTS: TickerEvent[] = [
  { id: 't1', kind: 'telegram', text: 'Telegram kanalına yeni promo kod düştü', time: '1 dk' },
  { id: 't2', kind: 'claim', text: 'mert_k çarktan 250 AlkaCoin kazandı', time: '2 dk' },
  { id: 't3', kind: 'drop', text: 'VIP ödül havuzu yenilendi — 500 kontenjan açık', time: '3 dk' },
  { id: 't4', kind: 'claim', text: 'aylin.dev Altın Sandık açtı — 2x Boost', time: '4 dk' },
  { id: 't5', kind: 'telegram', text: 'Haftalık anket yayında: sıradaki etkinliği seç', time: '6 dk' },
  { id: 't6', kind: 'claim', text: 'kaan_88 çift altı attı — Gizemli Kutu', time: '7 dk' },
  { id: 't7', kind: 'drop', text: 'Trafik Boost kampanyası 48 saat uzatıldı', time: '9 dk' },
  { id: 't8', kind: 'claim', text: 'selin.x 7 günlük seriyi tamamladı — VIP Geçiş', time: '11 dk' },
]

export type SiteCategory = 'ozel' | 'trafik' | 'vip' | 'oran'

export type PartnerSite = {
  id: string
  name: string
  initials: string
  title: string
  description: string
  category: SiteCategory
  multiplier: string
  rating: number
  claimed: number
  hot?: boolean
}

export const SITE_TABS: { id: 'all' | SiteCategory; label: string }[] = [
  { id: 'all', label: 'Tümü' },
  { id: 'ozel', label: 'Özel Bonuslar' },
  { id: 'trafik', label: 'Trafik Boost' },
  { id: 'vip', label: 'VIP Ödüller' },
  { id: 'oran', label: 'Özel Oranlar' },
]

export const PARTNER_SITES: PartnerSite[] = [
  { id: 'p1', name: 'NovaReach', initials: 'NR', title: 'Hoş geldin ödül paketi', description: 'İlk kayıtta katlanmış hoş geldin paketi ve bonus AlkaCoin.', category: 'ozel', multiplier: '3x', rating: 4.9, claimed: 82, hot: true },
  { id: 'p2', name: 'PulseAds', initials: 'PA', title: 'Trafik Surge Boost', description: '72 saatlik boost penceresiyle kampanya erişimini katla.', category: 'trafik', multiplier: '2.5x', rating: 4.6, claimed: 64 },
  { id: 'p3', name: 'Apex Club', initials: 'AC', title: 'VIP seviye hızlandırıcı', description: 'Bir seviye atla, üyelere özel ödül drop’larına anında eriş.', category: 'vip', multiplier: '5x', rating: 4.8, claimed: 91, hot: true },
  { id: 'p4', name: 'Orbitly', initials: 'OR', title: 'Özel oran: 1.8 yerine 3.6', description: 'Sadece AL KANKA linkiyle gelenlere geçerli özel oran fırsatı.', category: 'oran', multiplier: '2x', rating: 4.7, claimed: 47 },
  { id: 'p5', name: 'Clickwave', initials: 'CW', title: 'Günlük ziyaret serisi', description: 'Art arda doğrulanmış ziyaretlerde katlanan ödüller.', category: 'trafik', multiplier: '1.8x', rating: 4.4, claimed: 58 },
  { id: 'p6', name: 'Luxe Rewards', initials: 'LR', title: 'Concierge bonus kasası', description: 'VIP üyeler için seçilmiş yüksek değerli bonuslar.', category: 'vip', multiplier: '4x', rating: 4.9, claimed: 73 },
  { id: 'p7', name: 'Vertex', initials: 'VX', title: 'Referans çarpanı', description: 'Davet ettiğin her arkadaş 30 gün boyunca katlanmış bonus kazandırır.', category: 'ozel', multiplier: '2x', rating: 4.5, claimed: 39 },
  { id: 'p8', name: 'Kuzey', initials: 'KZ', title: 'Özel oran: derbi haftası', description: 'Haftanın derbisinde AL KANKA üyelerine yükseltilmiş oran.', category: 'oran', multiplier: '2.2x', rating: 4.6, claimed: 66 },
]

export type MarketItem = {
  id: string
  name: string
  type: 'ROZET' | 'EKSTRA HAK' | 'HEDİYE' | 'VIP'
  price: number
  stock: number
  total: number
  image: string
  refOnly?: boolean
}

export const MARKET_ITEMS: MarketItem[] = [
  { id: 'm1', name: 'Altın Kanka Rozeti', type: 'ROZET', price: 2500, stock: 18, total: 50, image: '/images/tile-market.png' },
  { id: 'm2', name: '+3 Ekstra Çark Hakkı', type: 'EKSTRA HAK', price: 900, stock: 42, total: 100, image: '/images/tile-wheel.png' },
  { id: 'm3', name: '+5 Ekstra Zar Hakkı', type: 'EKSTRA HAK', price: 750, stock: 0, total: 80, image: '/images/tile-dice.png' },
  { id: 'm4', name: 'Seri Kalkanı (7 gün)', type: 'EKSTRA HAK', price: 1200, stock: 9, total: 30, image: '/images/tile-tasks.png' },
  { id: 'm5', name: 'VIP Telegram Erişimi', type: 'VIP', price: 6000, stock: 5, total: 10, image: '/images/banner-telegram.png', refOnly: true },
  { id: 'm6', name: 'Gizemli Hediye Kutusu', type: 'HEDİYE', price: 3500, stock: 3, total: 15, image: '/images/tile-chest.png' },
  { id: 'm7', name: 'Çekiliş Bileti x5', type: 'HEDİYE', price: 1000, stock: 0, total: 200, image: '/images/banner-events.png' },
  { id: 'm8', name: 'Özel Profil Çerçevesi', type: 'ROZET', price: 1800, stock: 27, total: 40, image: '/images/hero-chest.png' },
]

export type EventItem = {
  id: string
  kind: 'Haftalık' | 'Günlük' | 'Aylık'
  title: string
  subtitle: string
  hoursLeft: number
  participants: number
  entry: number
  prize: string
  image: string
}

export const EVENTS: EventItem[] = [
  { id: 'e1', kind: 'Haftalık', title: 'Bilet Çekilişi', subtitle: '250.000 AlkaCoin havuz', hoursLeft: 52.4, participants: 1284, entry: 50, prize: '1. ödül 50.000 AC', image: '/images/banner-events.png' },
  { id: 'e2', kind: 'Günlük', title: 'Zar Turnuvası', subtitle: 'En yüksek toplam kazanır', hoursLeft: 6.2, participants: 389, entry: 0, prize: '100 kişiye 500 AC', image: '/images/tile-dice.png' },
  { id: 'e3', kind: 'Aylık', title: 'Çark Maratonu', subtitle: 'Ay boyunca en çok çeviren', hoursLeft: 21 * 24 + 3, participants: 2410, entry: 100, prize: '300 kişiye ödül', image: '/images/tile-wheel.png' },
]

export type Prediction = {
  id: string
  league: string
  home: string
  away: string
  kickoff: string
  options: { id: string; label: string; votes: number }[]
  reward: number
}

export const PREDICTIONS: Prediction[] = [
  {
    id: 'pr1',
    league: 'Süper Lig · Derbi',
    home: 'Galatasaray',
    away: 'Fenerbahçe',
    kickoff: 'Pazar 20:00',
    reward: 150,
    options: [
      { id: '1', label: 'Ev', votes: 4210 },
      { id: 'x', label: 'Beraberlik', votes: 1880 },
      { id: '2', label: 'Deplasman', votes: 3960 },
    ],
  },
  {
    id: 'pr2',
    league: 'Süper Lig',
    home: 'Beşiktaş',
    away: 'Trabzonspor',
    kickoff: 'Cumartesi 19:00',
    reward: 100,
    options: [
      { id: '1', label: 'Ev', votes: 3120 },
      { id: 'x', label: 'Beraberlik', votes: 1405 },
      { id: '2', label: 'Deplasman', votes: 1730 },
    ],
  },
]

export const LEADERBOARD = [
  { rank: 1, name: 'selin.x', points: 184250, streak: 42 },
  { rank: 2, name: 'mert_k', points: 167900, streak: 31 },
  { rank: 3, name: 'kaan_88', points: 151320, streak: 28 },
  { rank: 4, name: 'aylin.dev', points: 128740, streak: 19 },
  { rank: 5, name: 'emre.tr', points: 119600, streak: 24 },
  { rank: 6, name: 'deniz_44', points: 104380, streak: 15 },
  { rank: 7, name: 'burak.k', points: 98210, streak: 12 },
  { rank: 8, name: 'zeynep_s', points: 91150, streak: 17 },
]

export const LIVE_WINS = [
  { id: 'w1', game: 'Çark', user: 'fireattack', time: '17:03', reward: '250 AC' },
  { id: 'w2', game: 'Sandık', user: 'shewxye', time: '16:58', reward: '2x Boost' },
  { id: 'w3', game: 'Zar', user: 'KadirE', time: '16:56', reward: '400 AC' },
  { id: 'w4', game: 'Tahmin', user: 'MaymunAdam', time: '16:52', reward: '150 AC' },
  { id: 'w5', game: 'Çark', user: 'Barka20', time: '16:49', reward: 'VIP Geçiş' },
  { id: 'w6', game: 'Görev', user: 'deniz_44', time: '16:47', reward: '100 AC' },
  { id: 'w7', game: 'Zar', user: 'selin.x', time: '16:44', reward: '240 AC' },
]

export type FaqItem = { q: string; a: string }
export const FAQ: { id: string; label: string; items: FaqItem[] }[] = [
  {
    id: 'genel',
    label: 'Genel',
    items: [
      { q: 'AL KANKA nedir ve nasıl çalışır?', a: 'AL KANKA; partner kampanyaları, mini oyunlar ve Telegram topluluğunu tek yerde toplayan bir ödül rehberidir. Görev yap, oyun oyna, AlkaCoin topla ve marketten ödül al.' },
      { q: 'Partner siteler hangi kriterlere göre seçiliyor?', a: 'Lisans, ödeme hızı, kullanıcı yorumları ve destek kalitesi düzenli olarak kontrol edilir. Kriterleri karşılamayan partnerler listeden çıkarılır.' },
      { q: 'Bilgiler ne sıklıkla güncelleniyor?', a: 'Kampanyalar ve özel oranlar günlük, giriş adresleri ise anlık olarak güncellenir. En hızlı bildirim Telegram kanalımızdadır.' },
    ],
  },
  {
    id: 'puan',
    label: 'AlkaCoin',
    items: [
      { q: 'AlkaCoin nasıl kazanılır?', a: 'Çark, zar ve sandık oyunları, günlük giriş serisi, görevler, tahminler ve etkinlikler ile AlkaCoin kazanırsın.' },
      { q: 'Markette nakit ödül var mı?', a: 'Hayır. Puan marketinde rozet, ekstra oyun hakkı, seri kalkanı, çekiliş bileti ve hediyeler bulunur. Nakit ödül yoktur.' },
      { q: 'Seri kalkanı ne işe yarar?', a: 'Bir günü kaçırdığında 7 günlük giriş serinin sıfırlanmasını engeller. Kalkan otomatik olarak kullanılır.' },
    ],
  },
  {
    id: 'telegram',
    label: 'Telegram',
    items: [
      { q: 'Promo kodları nereden takip ederim?', a: '@AlkankaOfficial kanalı kodların ilk düştüğü yerdir. Bildirimleri açarsan kontenjan dolmadan kodu alırsın.' },
      { q: 'VIP Telegram kanalına nasıl girerim?', a: 'Puan marketinden VIP Telegram Erişimi alarak veya 7 günlük seriyi tamamlayarak VIP kanala davet alırsın.' },
    ],
  },
  {
    id: 'guvenlik',
    label: 'Güvenlik',
    items: [
      { q: 'Hesabım güvende mi?', a: 'Şifreler şifrelenerek saklanır, oturumlar güvenli çerezlerle yönetilir. Kimseyle giriş bilgilerini paylaşma.' },
      { q: 'Yaş sınırı var mı?', a: 'Evet. AL KANKA yalnızca 18 yaş ve üzeri kullanıcılar içindir. Sorumlu davran.' },
    ],
  },
]
