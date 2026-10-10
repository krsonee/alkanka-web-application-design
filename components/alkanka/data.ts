import {
  BadgePercent,
  Eye,
  Send,
  ShieldCheck,
  UserPlus,
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
  { id: 'anasayfa', label: 'Ana sayfa', href: '/', icon: Home },
  { id: 'siteler', label: 'Sponsorlar', href: '/sponsorlar', icon: LayoutGrid },
  { id: 'bonuslar', label: 'Bonuslar', href: '/bonuslar', icon: BadgePercent },
  { id: 'ozel-oranlar', label: 'Özel oranlar', href: '/ozel-oranlar', icon: Percent },
  { id: 'kampanyalar', label: 'Kampanyalar', href: '/kampanyalar', icon: Megaphone },
  { id: 'cark', label: 'Çark', href: '/oyunlar/cark', icon: CircleDot, badge: 'Yeni' },
  { id: 'zar', label: 'Zar', href: '/oyunlar/zar', icon: Dices },
  { id: 'sandik', label: 'Sandık', href: '/oyunlar/sandik', icon: Gift },
  { id: 'market', label: 'Puan marketi', href: '/market', icon: ShoppingBag },
  { id: 'gorevler', label: 'Görevler', href: '/gorevler', icon: ListChecks },
  { id: 'etkinlikler', label: 'Biletler', href: '/biletler', icon: Ticket },
  { id: 'tahminler', label: 'Tahminler', href: '/tahminler', icon: Flag },
  { id: 'siralama', label: 'Sıralama', href: '/siralama', icon: Trophy },
  { id: 'sss', label: 'SSS', href: '/sss', icon: HelpCircle },
]

export const SECTION_IDS = NAV_ITEMS.map((i) => i.href.split('#')[1]).filter((v, i, a) => a.indexOf(v) === i)

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
    title: 'Çarkı çevir, Kanka Coin topla',
    description: 'Her 6 saatte bir ücretsiz çevirme hakkı. Boost, kod ve VIP geçiş kazan.',
    cta: 'Çarkı aç',
    href: '/oyunlar/cark',
    image: '/images/banner-wheel.png',
  },
  {
    id: 's2',
    eyebrow: 'Puan marketi',
    title: 'Rozet, ekstra hak ve hediyeler',
    description: 'Topladığın Kanka Coin ile marketten dilediğini al. Nakit yok, sadece ödül.',
    cta: 'Marketi aç',
    href: '/market',
    image: '/images/hero-chest.png',
  },
  {
    id: 's3',
    eyebrow: 'Telegram',
    title: 'Kodlar önce Telegram’a düşer',
    description: '@AlkankaOfficial kanalında 14.2K üye. Promo kodlar, anketler ve anlık drop’lar.',
    cta: 'Kanala katıl',
    href: TELEGRAM_URL,
    image: '/images/mascots/jako-duyuru.png',
  },
  {
    id: 's4',
    eyebrow: 'Haftalık etkinlik',
    title: '250.000 Kanka Coin ödüllü bilet çekilişi',
    description: 'Bilet al, tahmin yap, sıralamada yüksel. Her pazar 21:00’de çekiliş.',
    cta: 'Bilet al',
    href: '/biletler',
    image: '/images/banner-events.png',
  },
]

export type QuickTile = { id: string; label: string; cta: string; href: string; image: string }

export const QUICK_TILES: QuickTile[] = [
  { id: 'cark', label: 'Çark', cta: 'Çarkı aç', href: '/oyunlar/cark', image: '/images/tile-wheel.png' },
  { id: 'market', label: 'Market', cta: 'Marketi aç', href: '/market', image: '/images/tile-market.png' },
  { id: 'gorev', label: 'Görevler', cta: 'Görevlere git', href: '/gorevler', image: '/images/tile-tasks.png' },
  { id: 'zar', label: 'Zar', cta: 'Zar at', href: '/oyunlar/zar', image: '/images/tile-dice.png' },
  { id: 'sandik', label: 'Sandık', cta: 'Sandık aç', href: '/oyunlar/sandik', image: '/images/tile-chest.png' },
  { id: 'tahmin', label: 'Tahminler', cta: 'Tahmin et', href: '/tahminler', image: '/images/tile-predict.png' },
]

export type TickerEvent = { id: string; kind: 'telegram' | 'claim' | 'drop'; text: string; time: string }

export const TICKER_EVENTS: TickerEvent[] = [
  { id: 't1', kind: 'telegram', text: 'Telegram kanalına yeni promo kod düştü', time: '1 dk' },
  { id: 't2', kind: 'claim', text: 'mert_k çarktan 250 Kanka Coin kazandı', time: '2 dk' },
  { id: 't3', kind: 'drop', text: 'VIP ödül havuzu yenilendi — 500 kontenjan açık', time: '3 dk' },
  { id: 't4', kind: 'claim', text: 'aylin.dev Altın Sandık açtı — 2x Boost', time: '4 dk' },
  { id: 't5', kind: 'telegram', text: 'Haftalık anket yayında: sıradaki etkinliği seç', time: '6 dk' },
  { id: 't6', kind: 'claim', text: 'kaan_88 çift altı attı — Gizemli Kutu', time: '7 dk' },
  { id: 't7', kind: 'drop', text: 'Trafik Boost kampanyası 48 saat uzatıldı', time: '9 dk' },
  { id: 't8', kind: 'claim', text: 'selin.x 7 günlük seriyi tamamladı — VIP Geçiş', time: '11 dk' },
]

export type SponsorTier = 'ana' | 'vip' | 'guvenilir'

export const TIER_INFO: Record<SponsorTier, { label: string; description: string }> = {
  ana: { label: 'Ana Sponsor', description: 'AL KANKA’nın resmi ana sponsoru. En yüksek bonus ve özel oranlar burada.' },
  vip: { label: 'VIP Sponsorlar', description: 'Yüksek limitli, hızlı ödemeli ve VIP üyelere özel ayrıcalıklı siteler.' },
  guvenilir: { label: 'Güvenilir Sponsorlar', description: 'Uzun süredir sorunsuz çalıştığımız, düzenli kontrol edilen siteler.' },
}

export type Sponsor = {
  id: string
  name: string
  initials: string
  tier: SponsorTier
  tagline: string
  welcome: string
  perks: string[]
  rating: number
  payout: string
}

const BASE_SPONSORS: Sponsor[] = [
  { id: 'novareach', name: 'NovaReach', initials: 'NR', tier: 'ana', tagline: 'Resmi ana sponsor', welcome: '%300 hoş geldin bonusu', perks: ['AL KANKA’ya özel oranlar', '7/24 Türkçe canlı destek', 'Haftalık %25 kayıp bonusu', 'Anında çekim'], rating: 4.9, payout: '5 dk' },
  { id: 'apex-club', name: 'Apex Club', initials: 'AC', tier: 'vip', tagline: 'VIP seviye hızlandırıcı', welcome: '%200 + 100 freespin', perks: ['VIP seviye atlama', 'Kişisel hesap yöneticisi'], rating: 4.8, payout: '10 dk' },
  { id: 'luxe-rewards', name: 'Luxe Rewards', initials: 'LR', tier: 'vip', tagline: 'Concierge bonus kasası', welcome: '%150 yatırım bonusu', perks: ['Yüksek çekim limiti', 'Doğum günü hediyesi'], rating: 4.9, payout: '15 dk' },
  { id: 'orbitly', name: 'Orbitly', initials: 'OR', tier: 'vip', tagline: 'Özel oran merkezi', welcome: '%100 spor bonusu', perks: ['Derbi özel oranları', 'Kombine sigortası'], rating: 4.7, payout: '10 dk' },
  { id: 'pulse', name: 'PulseBet', initials: 'PB', tier: 'guvenilir', tagline: 'Hızlı ve sade', welcome: '%100 hoş geldin', perks: ['Düşük çevrim şartı'], rating: 4.6, payout: '20 dk' },
  { id: 'clickwave', name: 'Clickwave', initials: 'CW', tier: 'guvenilir', tagline: 'Günlük ziyaret serisi', welcome: '50 freespin', perks: ['Günlük çark'], rating: 4.4, payout: '30 dk' },
  { id: 'vertex', name: 'Vertex', initials: 'VX', tier: 'guvenilir', tagline: 'Referans çarpanı', welcome: '%75 yatırım bonusu', perks: ['Arkadaş davet bonusu'], rating: 4.5, payout: '25 dk' },
  { id: 'kuzey', name: 'Kuzey', initials: 'KZ', tier: 'guvenilir', tagline: 'Spor odaklı', welcome: '%100 spor bonusu', perks: ['Canlı maç yayını'], rating: 4.6, payout: '20 dk' },
]

const EXTRA_SPONSORS: [name: string, initials: string, tier: SponsorTier, welcome: string, perk: string, rating: number, payout: string][] = [
  ['Zenith', 'ZN', 'vip', '%250 yatırım bonusu', 'Yüksek çekim limiti', 4.8, '10 dk'],
  ['Royal Spin', 'RS', 'vip', '200 freespin', 'Haftalık VIP turnuva', 4.7, '15 dk'],
  ['Goldline', 'GL', 'vip', '%200 hoş geldin', 'Kişisel temsilci', 4.8, '10 dk'],
  ['Kraken', 'KR', 'vip', '%150 + 50 freespin', 'Kripto ile anında çekim', 4.7, '5 dk'],
  ['Monarch', 'MN', 'vip', '%300 VIP bonusu', 'Doğum günü bonusu', 4.9, '10 dk'],
  ['Atlas Bet', 'AB', 'vip', '%100 spor + %100 casino', 'Kombine sigortası', 4.6, '15 dk'],
  ['Mavibet', 'MB', 'guvenilir', '%100 hoş geldin', 'Düşük çevrim', 4.5, '20 dk'],
  ['Starline', 'SL', 'guvenilir', '75 freespin', 'Günlük çark', 4.4, '30 dk'],
  ['Polaris', 'PL', 'guvenilir', '%50 yatırım bonusu', 'Haftalık kayıp iadesi', 4.5, '25 dk'],
  ['Kale', 'KL', 'guvenilir', '%100 spor bonusu', 'Canlı maç yayını', 4.6, '20 dk'],
  ['Delta Play', 'DP', 'guvenilir', '150 ₺ deneme', 'Yatırımsız deneme', 4.3, '30 dk'],
  ['Rota', 'RT', 'guvenilir', '%75 hoş geldin', 'Mobil uygulama', 4.4, '25 dk'],
  ['Nehir', 'NH', 'guvenilir', '%100 casino bonusu', 'Canlı casino iadesi', 4.5, '20 dk'],
  ['Sirius', 'SR', 'guvenilir', '50 freespin', 'Hızlı kayıt', 4.3, '30 dk'],
  ['Truva', 'TR', 'guvenilir', '%120 yatırım bonusu', 'Haftalık turnuva', 4.6, '20 dk'],
  ['Bora', 'BR', 'guvenilir', '%100 spor bonusu', 'Erken ödeme', 4.4, '25 dk'],
  ['Pera', 'PR', 'guvenilir', '%80 hoş geldin', 'Papara ile yatırım', 4.5, '20 dk'],
  ['Vira', 'VR', 'guvenilir', '100 freespin', 'Slot turnuvaları', 4.4, '30 dk'],
  ['Mira', 'MR', 'guvenilir', '%50 kayıp bonusu', 'Çevrimsiz iade', 4.5, '25 dk'],
  ['Yıldız', 'YL', 'guvenilir', '%100 hoş geldin', '7/24 destek', 4.6, '20 dk'],
  ['Tuna', 'TN', 'guvenilir', '200 ₺ deneme', 'Yatırımsız bonus', 4.3, '30 dk'],
  ['Lodos', 'LD', 'guvenilir', '%60 yatırım bonusu', 'Kripto yatırım', 4.4, '25 dk'],
]

export const SPONSORS: Sponsor[] = [
  ...BASE_SPONSORS,
  ...EXTRA_SPONSORS.map(([name, initials, tier, welcome, perk, rating, payout]) => ({
    id: name.toLowerCase().replace(/\s+/g, '-').replace('ı', 'i'),
    name,
    initials,
    tier,
    tagline: perk,
    welcome,
    perks: [perk, 'AL KANKA linkiyle ekstra bonus'],
    rating,
    payout,
  })),
]

export type Bonus = {
  id: string
  sponsorId: string
  type: 'Hoş geldin' | 'Yatırım' | 'Kayıp' | 'Freespin' | 'Deneme'
  title: string
  amount: string
  wager: string
  code?: string
}

export const BONUSES: Bonus[] = [
  { id: 'b1', sponsorId: 'novareach', type: 'Hoş geldin', title: 'İlk yatırıma %300', amount: '15.000 ₺’ye kadar', wager: '15x çevrim', code: 'ALKANKA300' },
  { id: 'b2', sponsorId: 'apex-club', type: 'Freespin', title: '100 freespin', amount: 'Kayıtta anında', wager: '20x çevrim' },
  { id: 'b3', sponsorId: 'novareach', type: 'Kayıp', title: 'Haftalık %25 kayıp', amount: 'Limitsiz', wager: 'Çevrimsiz' },
  { id: 'b4', sponsorId: 'luxe-rewards', type: 'Yatırım', title: 'Her yatırıma %50', amount: '5.000 ₺’ye kadar', wager: '10x çevrim', code: 'KANKA50' },
  { id: 'b5', sponsorId: 'pulse', type: 'Deneme', title: '250 ₺ deneme bonusu', amount: 'Yatırımsız', wager: '25x çevrim', code: 'DENEKANKA' },
  { id: 'b6', sponsorId: 'kuzey', type: 'Yatırım', title: 'Spor yatırımına %100', amount: '3.000 ₺’ye kadar', wager: '8x çevrim' },
]

export type SpecialOdd = {
  id: string
  sponsorId: string
  league: string
  match: string
  market: string
  oldOdd: number
  newOdd: number
  kickoff: string
  limit: string
}

export const SPECIAL_ODDS: SpecialOdd[] = [
  { id: 'o1', sponsorId: 'novareach', league: 'Süper Lig · Derbi', match: 'Galatasaray - Fenerbahçe', market: 'Maçta 2.5 üst', oldOdd: 1.85, newOdd: 3.6, kickoff: 'Pazar 20:00', limit: 'Maks. 500 ₺' },
  { id: 'o2', sponsorId: 'orbitly', league: 'Süper Lig', match: 'Beşiktaş - Trabzonspor', market: 'Beşiktaş kazanır', oldOdd: 1.9, newOdd: 3.0, kickoff: 'Cumartesi 19:00', limit: 'Maks. 300 ₺' },
  { id: 'o3', sponsorId: 'kuzey', league: 'Şampiyonlar Ligi', match: 'Real Madrid - Man. City', market: 'KG var', oldOdd: 1.6, newOdd: 2.5, kickoff: 'Salı 22:00', limit: 'Maks. 250 ₺' },
  { id: 'o4', sponsorId: 'apex-club', league: 'NBA', match: 'Lakers - Celtics', market: 'Toplam 220.5 üst', oldOdd: 1.88, newOdd: 2.75, kickoff: 'Çarşamba 03:30', limit: 'Maks. 200 ₺' },
]

export type Campaign = {
  id: string
  sponsorId: string
  title: string
  description: string
  ends: string
  image: string
  tag: string
  hoursLeft: number
}

export const CAMPAIGNS: Campaign[] = [
  { id: 'c1', sponsorId: 'novareach', title: 'Derbi haftası çılgınlığı', description: 'Derbi haftası boyunca tüm kuponlara %20 kazanç artırımı ve kayıp iadesi.', ends: '3 gün kaldı', image: '/images/banner-events.png', tag: 'Spor', hoursLeft: 72 },
  { id: 'c2', sponsorId: 'apex-club', title: 'VIP Kulübü yaz turnuvası', description: '1.000.000 ₺ ödül havuzlu slot turnuvası. İlk 500 kişiye ödül.', ends: '9 gün kaldı', image: '/images/banner-wheel.png', tag: 'Turnuva', hoursLeft: 216 },
  { id: 'c3', sponsorId: 'luxe-rewards', title: 'Hafta sonu cashback', description: 'Cuma-pazar arası tüm kayıplara %30 nakit iade, çevrimsiz.', ends: 'Hafta sonu', image: '/images/hero-chest.png', tag: 'İade', hoursLeft: 48 },
  { id: 'c4', sponsorId: 'pulse', title: 'Telegram’a özel drop', description: 'Kod önce @AlkankaOfficial kanalına düşer. İlk 200 kişiye 50 freespin.', ends: 'Bugün', image: '/images/banner-telegram.png', tag: 'Telegram', hoursLeft: 8 },
  { id: 'c5', sponsorId: 'zenith', title: 'Zenith çifte yatırım günü', description: 'Salı günleri yapılan her yatırıma %50 ekstra bonus, 5.000 ₺’ye kadar.', ends: '2 gün kaldı', image: '/images/tile-market.png', tag: 'Yatırım', hoursLeft: 40 },
  { id: 'c6', sponsorId: 'royal-spin', title: 'Royal Spin 500 freespin yağmuru', description: 'Her gün seçili slotlarda 100 freespin. 5 gün boyunca toplam 500 freespin.', ends: '5 gün kaldı', image: '/images/tile-wheel.png', tag: 'Freespin', hoursLeft: 120 },
  { id: 'c7', sponsorId: 'kuzey', title: 'Şampiyonlar Ligi gecesi', description: 'Salı ve çarşamba maçlarında kombine kuponlara %15 ekstra kazanç.', ends: '1 gün kaldı', image: '/images/tile-predict.png', tag: 'Spor', hoursLeft: 26 },
  { id: 'c8', sponsorId: 'monarch', title: 'Monarch VIP çekilişi', description: 'Ay sonuna kadar yatırım yapan herkes iPhone ve tatil çekilişine katılır.', ends: '18 gün kaldı', image: '/images/tile-chest.png', tag: 'Çekiliş', hoursLeft: 432 },
  { id: 'c9', sponsorId: 'kraken', title: 'Kripto yatırımına %25 ekstra', description: 'USDT ve BTC yatırımlarında %25 ekstra bonus, anında çekim.', ends: '6 gün kaldı', image: '/images/tile-dice.png', tag: 'Yatırım', hoursLeft: 144 },
  { id: 'c10', sponsorId: 'goldline', title: 'Goldline canlı casino haftası', description: 'Canlı casino kayıplarına günlük %20 iade, çevrimsiz.', ends: '4 gün kaldı', image: '/images/banner-wheel.png', tag: 'İade', hoursLeft: 96 },
  { id: 'c11', sponsorId: 'truva', title: 'Truva slot turnuvası', description: '250.000 ₺ ödül havuzu. En yüksek çarpanı yakalayan ilk 100 kişi kazanır.', ends: '7 gün kaldı', image: '/images/hero-chest.png', tag: 'Turnuva', hoursLeft: 168 },
  { id: 'c12', sponsorId: 'clickwave', title: 'Telegram anket ödülü', description: 'Kanaldaki haftalık ankete katılan ilk 300 kişiye 25 freespin.', ends: 'Bugün', image: '/images/banner-telegram.png', tag: 'Telegram', hoursLeft: 5 },
]

export function sponsorById(id: string) {
  return SPONSORS.find((s) => s.id === id)
}

export type MarketItem = {
  id: string
  name: string
  type: 'ROZET' | 'EKSTRA HAK' | 'HEDİYE' | 'VIP'
  price: number
  stock: number
  total: number
  image: string
  refOnly?: boolean
  limit: number
  description: string
  delivery: string
  rules: string[]
}

const MARKET_COMMON_RULES = [
  'Satın alınan ürünler iade edilmez ve Kanka Coin’e geri çevrilmez.',
  'Ürünler başka hesaba devredilemez, satılamaz.',
  'Birden fazla hesapla stok toplayan kullanıcıların tüm ödülleri iptal edilir.',
]

export const MARKET_ITEMS: MarketItem[] = [
  { id: 'altin-rozet', name: 'Altın Kanka Rozeti', type: 'ROZET', price: 2500, stock: 18, total: 50, image: '/images/tile-market.png', limit: 1, description: 'Profilinde ve sıralamada adının yanında görünen altın rozet. Topluluğun en aktif üyelerini gösterir.', delivery: 'Satın alır almaz profiline eklenir.', rules: ['Hesap başına 1 adet alınabilir.', 'Rozet kalıcıdır, süre sınırı yoktur.'] },
  { id: 'cark-hakki', name: '+3 Ekstra Çark Hakkı', type: 'EKSTRA HAK', price: 900, stock: 42, total: 100, image: '/images/tile-wheel.png', limit: 5, description: 'Günlük ücretsiz hakkına ek olarak 3 çark çevirme hakkı.', delivery: 'Haklar anında hesabına tanımlanır.', rules: ['Haklar 7 gün içinde kullanılmalıdır.', 'Günde en fazla 5 paket alınabilir.'] },
  { id: 'zar-hakki', name: '+5 Ekstra Zar Hakkı', type: 'EKSTRA HAK', price: 750, stock: 0, total: 80, image: '/images/tile-dice.png', limit: 5, description: 'Zar oyununda 5 ekstra atış hakkı. Düşeş jackpotu bu haklarla da geçerli.', delivery: 'Haklar anında hesabına tanımlanır.', rules: ['Haklar 7 gün içinde kullanılmalıdır.', 'Stok her pazartesi yenilenir.'] },
  { id: 'seri-kalkani', name: 'Seri Kalkanı (7 gün)', type: 'EKSTRA HAK', price: 1200, stock: 9, total: 30, image: '/images/tile-tasks.png', limit: 2, description: 'Bir günü kaçırdığında giriş serinin sıfırlanmasını engeller.', delivery: 'Kalkan aktif edilir, ihtiyaç anında otomatik kullanılır.', rules: ['Kalkan 7 gün boyunca geçerlidir.', 'Aynı anda en fazla 1 kalkan aktif olabilir.'] },
  { id: 'vip-telegram', name: 'VIP Telegram Erişimi', type: 'VIP', price: 6000, stock: 5, total: 10, image: '/images/banner-telegram.png', refOnly: true, limit: 1, description: 'Kodların herkesten önce düştüğü kapalı VIP Telegram kanalına 30 günlük erişim.', delivery: 'Davet linki 24 saat içinde Telegram’dan gönderilir.', rules: ['Sadece referans linkiyle kayıt olan üyeler alabilir.', 'Telegram kullanıcı adının profilde kayıtlı olması gerekir.'] },
  { id: 'gizemli-kutu', name: 'Gizemli Hediye Kutusu', type: 'HEDİYE', price: 3500, stock: 3, total: 15, image: '/images/tile-chest.png', limit: 1, description: 'İçinden rozet, çekiliş bileti, VIP geçiş veya fiziksel hediye çıkabilen sürpriz kutu.', delivery: 'Kutu sandık ekranında açılır. Fiziksel hediyeler için destek seninle iletişime geçer.', rules: ['Haftada 1 adet alınabilir.', 'Fiziksel hediyeler sadece Türkiye içi gönderilir.'] },
  { id: 'cekilis-bileti', name: 'Çekiliş Bileti x5', type: 'HEDİYE', price: 1000, stock: 0, total: 200, image: '/images/banner-events.png', limit: 4, description: 'Haftalık bilet çekilişi için 5 ekstra bilet. Kazanma şansını artırır.', delivery: 'Biletler o haftanın çekilişine otomatik eklenir.', rules: ['Haftada en fazla 4 paket (20 bilet) alınabilir.', 'Biletler sonraki haftaya devretmez.'] },
  { id: 'profil-cercevesi', name: 'Özel Profil Çerçevesi', type: 'ROZET', price: 1800, stock: 27, total: 40, image: '/images/hero-chest.png', limit: 1, description: 'Profil fotoğrafının etrafında hareketli altın çerçeve.', delivery: 'Anında profiline eklenir.', rules: ['Hesap başına 1 adet alınabilir.'] },
].map((item) => ({ ...item, rules: [...item.rules, ...MARKET_COMMON_RULES] })) as MarketItem[]

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
  description: string
  steps: string[]
  rules: string[]
  prizes: { place: string; prize: string }[]
}

export const EVENTS: EventItem[] = [
  {
    id: 'bilet-cekilisi',
    kind: 'Haftalık',
    title: 'Bilet Çekilişi',
    subtitle: '250.000 Kanka Coin havuz',
    hoursLeft: 52.4,
    participants: 1284,
    entry: 50,
    prize: '1. ödül 50.000 KC',
    image: '/images/banner-events.png',
    description: 'Her pazar 21:00’de Telegram kanalında canlı yayınla yapılan haftalık çekiliş. Ne kadar çok biletin varsa şansın o kadar yüksek.',
    steps: ['50 Kanka Coin ile 1 bilet al.', 'Marketten veya görevlerden ekstra bilet topla.', 'Pazar 21:00’de canlı çekilişi Telegram’dan izle.', 'Kazandıysan ödül otomatik hesabına geçer.'],
    rules: ['Hesap başına haftada en fazla 25 bilet kullanılabilir.', 'Çekiliş rastgele sayı üreteciyle, canlı yayında yapılır.', 'Kazananlar Telegram kanalında ve sitede duyurulur.', 'Birden fazla hesapla katılım tespit edilirse tüm biletler iptal edilir.', 'Ödüller 24 saat içinde hesaba yatırılır.'],
    prizes: [
      { place: '1.', prize: '50.000 KC' },
      { place: '2.', prize: '25.000 KC' },
      { place: '3.', prize: '15.000 KC' },
      { place: '4.-10.', prize: '5.000 KC' },
      { place: '11.-100.', prize: '1.400 KC' },
    ],
  },
  {
    id: 'zar-turnuvasi',
    kind: 'Günlük',
    title: 'Zar Turnuvası',
    subtitle: 'En yüksek toplam kazanır',
    hoursLeft: 6.2,
    participants: 389,
    entry: 0,
    prize: '100 kişiye 500 KC',
    image: '/images/tile-dice.png',
    description: 'Gün içinde attığın en iyi 3 zarın toplamı sıralamaya yazılır. Gece 00:00’da ilk 100 kişi ödül alır.',
    steps: ['Turnuvaya ücretsiz katıl.', 'Gün içinde zar at, en iyi 3 atışın sayılır.', 'Çift ve düşeş bonus puan kazandırır.', 'Gece 00:00’da ilk 100 ödül alır.'],
    rules: ['Sadece günlük ücretsiz ve marketten alınan haklar geçerlidir.', 'Eşitlikte puana önce ulaşan üst sırada yer alır.', 'Turnuva her gün 00:00’da sıfırlanır.'],
    prizes: [
      { place: '1.', prize: '5.000 KC' },
      { place: '2.-10.', prize: '1.000 KC' },
      { place: '11.-100.', prize: '500 KC' },
    ],
  },
  {
    id: 'cark-maratonu',
    kind: 'Aylık',
    title: 'Çark Maratonu',
    subtitle: 'Ay boyunca en çok çeviren',
    hoursLeft: 21 * 24 + 3,
    participants: 2410,
    entry: 100,
    prize: '300 kişiye ödül',
    image: '/images/tile-wheel.png',
    description: 'Ay boyunca çevirdiğin her çark 1 maraton puanı kazandırır. Ay sonunda ilk 300 kişi ödüllendirilir.',
    steps: ['100 Kanka Coin ile maratona kayıt ol.', 'Her çark çevirişin 1 puan kazandırır.', 'Jackpot dilimi 10 bonus puan verir.', 'Ay sonunda ilk 300 ödül alır.'],
    rules: ['Kayıt ücreti iade edilmez.', 'Sadece kayıt sonrası çevirmeler sayılır.', 'Bot veya otomatik tıklama kullanımı kalıcı yasak sebebidir.'],
    prizes: [
      { place: '1.', prize: 'VIP Telegram + 30.000 KC' },
      { place: '2.-3.', prize: '15.000 KC' },
      { place: '4.-50.', prize: '2.000 KC' },
      { place: '51.-300.', prize: '500 KC' },
    ],
  },
]

export type TaskItem = {
  id: string
  icon: LucideIcon
  title: string
  detail: string
  reward: number
  href?: string
  description: string
  steps: string[]
  rules: string[]
  verification: string
}

export const TASKS: TaskItem[] = [
  { id: 'telegram', icon: Send, title: 'Telegram kanalına katıl', detail: '@AlkankaOfficial', reward: 150, href: TELEGRAM_URL, description: 'Kodların ilk düştüğü resmi Telegram kanalımıza katıl.', steps: ['Kanala katıl butonuna bas.', 'Telegram’da “Katıl”a dokun.', 'Profilinde Telegram kullanıcı adını kaydet.'], rules: ['Kanaldan 7 gün içinde ayrılırsan ödül geri alınır.', 'Hesap başına bir kez tamamlanabilir.'], verification: 'Telegram botu üyeliğini otomatik kontrol eder.' },
  { id: 'site-ziyareti', icon: Eye, title: '3 sponsor siteyi ziyaret et', detail: '0 / 3 tamamlandı', reward: 90, description: 'Sponsor sitelerden üçünü AL KANKA linkiyle ziyaret et.', steps: ['Sponsorlar bölümünden bir site seç.', '“Siteye git” ile siteyi aç.', 'En az 30 saniye sitede kal.', 'Üç farklı site için tekrarla.'], rules: ['Aynı site günde bir kez sayılır.', 'Görev her gün 00:00’da yenilenir.'], verification: 'Ziyaretler takip linkiyle otomatik sayılır.' },
  { id: 'arkadas-davet', icon: UserPlus, title: 'Bir arkadaşını davet et', detail: 'Davet linkini paylaş', reward: 250, description: 'Davet linkinle kayıt olan her arkadaş için ödül kazan.', steps: ['Profilinden davet linkini kopyala.', 'Arkadaşına gönder.', 'Arkadaşın kayıt olup hesabını doğrulasın.'], rules: ['Kendi ikinci hesabını davet etmek yasaktır.', 'Arkadaşın 7 gün içinde doğrulama yapmalıdır.', 'Ayda en fazla 20 davet ödüllendirilir.'], verification: 'Arkadaşın hesabını doğruladığında ödül otomatik eklenir.' },
  { id: 'hesap-dogrula', icon: ShieldCheck, title: 'Hesabını doğrula', detail: 'Mavi tik al, turnuvalara katıl', reward: 200, description: 'E-posta ve telefon doğrulamasıyla hesabını güvene al.', steps: ['E-postana gelen linke tıkla.', 'Telefonuna gelen kodu gir.', 'Mavi tik profilinde görünür.'], rules: ['Hesap başına bir kez tamamlanabilir.', 'Turnuva ödülleri sadece doğrulanmış hesaplara verilir.'], verification: 'Doğrulama tamamlanınca ödül anında eklenir.' },
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
  { id: 'w1', game: 'Çark', user: 'fireattack', time: '17:03', reward: '250 KC' },
  { id: 'w2', game: 'Sandık', user: 'shewxye', time: '16:58', reward: '2x Boost' },
  { id: 'w3', game: 'Zar', user: 'KadirE', time: '16:56', reward: '400 KC' },
  { id: 'w4', game: 'Tahmin', user: 'MaymunAdam', time: '16:52', reward: '150 KC' },
  { id: 'w5', game: 'Çark', user: 'Barka20', time: '16:49', reward: 'VIP Geçiş' },
  { id: 'w6', game: 'Görev', user: 'deniz_44', time: '16:47', reward: '100 KC' },
  { id: 'w7', game: 'Zar', user: 'selin.x', time: '16:44', reward: '240 KC' },
]

export type FaqItem = { q: string; a: string }
export const FAQ: { id: string; label: string; items: FaqItem[] }[] = [
  {
    id: 'genel',
    label: 'Genel',
    items: [
      { q: 'AL KANKA nedir ve nasıl çalışır?', a: 'AL KANKA; partner kampanyaları, mini oyunlar ve Telegram topluluğunu tek yerde toplayan bir ödül rehberidir. Görev yap, oyun oyna, Kanka Coin topla ve marketten ödül al.' },
      { q: 'Partner siteler hangi kriterlere göre seçiliyor?', a: 'Lisans, ödeme hızı, kullanıcı yorumları ve destek kalitesi düzenli olarak kontrol edilir. Kriterleri karşılamayan partnerler listeden çıkarılır.' },
      { q: 'Bilgiler ne sıklıkla güncelleniyor?', a: 'Kampanyalar ve özel oranlar günlük, giriş adresleri ise anlık olarak güncellenir. En hızlı bildirim Telegram kanalımızdadır.' },
    ],
  },
  {
    id: 'puan',
    label: 'Kanka Coin',
    items: [
      { q: 'Kanka Coin nasıl kazanılır?', a: 'Çark, zar ve sandık oyunları, günlük giriş serisi, görevler, tahminler ve etkinlikler ile Kanka Coin kazanırsın.' },
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
