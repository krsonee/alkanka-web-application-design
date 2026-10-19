import type { Metadata } from 'next'

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://alkanka.com').replace(/\/$/, '')
export const SITE_NAME = 'AL KANKA'
export const DEFAULT_OG = '/images/og.png'

type PageSeo = { path: string; title: string; description: string; image?: string; keywords: string[] }

export const PAGE_SEO = {
  anasayfa: {
    path: '/',
    title: 'AL KANKA — Bonus Kodları, Özel Oranlar ve Promo Kodlar',
    description:
      'Güncel bonus kodları, özel oranlar ve promo kodlar tek yerde. Çark çevir, zar at, Kanka Coin topla, puan marketinden ödül al.',
    keywords: ['bonus kodları', 'özel oranlar', 'promo kod', 'deneme bonusu', 'freespin', 'al kanka'],
  },
  bonuslar: {
    path: '/bonuslar',
    title: 'Güncel Bonus Kodları ve Deneme Bonusları',
    description: 'Bugün geçerli bonus kodları, deneme bonusları ve freespin fırsatları. Kodu kopyala, kayıt olurken kullan.',
    image: '/images/heroes/bonuslar.png',
    keywords: ['bonus kodları', 'deneme bonusu', 'freespin', 'hoş geldin bonusu', 'güncel bonus'],
  },
  'ozel-oranlar': {
    path: '/ozel-oranlar',
    title: 'Bugünün Özel Oranları ve Artırılmış Oranlar',
    description: 'Günün maçları için özel, süper ve artırılmış oranlar. Her gün güncellenen oran listesi.',
    image: '/images/heroes/ozel-oranlar.png',
    keywords: ['özel oran', 'artırılmış oran', 'süper oran', 'günün oranları', 'boost oran'],
  },
  kampanyalar: {
    path: '/kampanyalar',
    title: 'Aktif Kampanyalar ve Promosyonlar',
    description: 'Partner sitelerin aktif kampanyaları, kayıp bonusları ve sınırlı süreli promosyonlar.',
    image: '/images/heroes/kampanyalar.png',
    keywords: ['kampanyalar', 'promosyon', 'kayıp bonusu', 'yatırım bonusu'],
  },
  sponsorlar: {
    path: '/sponsorlar',
    title: 'Sponsor Siteler ve Güncel Giriş Adresleri',
    description: 'AL KANKA sponsor siteleri, güncel giriş linkleri ve her siteye özel bonuslar.',
    image: '/images/heroes/sponsorlar.png',
    keywords: ['güncel giriş', 'sponsor siteler', 'giriş adresi', 'güvenilir siteler'],
  },
  oyunlar: {
    path: '/oyunlar',
    title: 'Ücretsiz Mini Oyunlar: Çark, Zar, Sandık',
    description: 'Ücretsiz çark çevir, zar at, sandık aç ve Kanka Coin kazan. Kazandığın puanları marketten ödüle çevir.',
    image: '/images/heroes/oyunlar.png',
    keywords: ['çark çevir', 'ücretsiz çark', 'zar oyunu', 'sandık aç', 'puan kazan'],
  },
  turnuvalar: {
    path: '/turnuvalar',
    title: 'Tavla, Okey ve Bilardo Turnuvaları',
    description: 'Tavla, okey ve bilardo turnuvalarına katıl, Kanka Coin ödül havuzunu kap.',
    image: '/images/heroes/turnuvalar.png',
    keywords: ['tavla turnuvası', 'okey turnuvası', 'bilardo turnuvası', 'ödüllü turnuva'],
  },
  market: {
    path: '/market',
    title: 'Puan Marketi: Kanka Coin ile Ödül Al',
    description: 'Topladığın Kanka Coin ile rozet, ekstra hak ve hediye al.',
    image: '/images/heroes/market.png',
    keywords: ['puan marketi', 'kanka coin', 'ödül marketi'],
  },
  gorevler: {
    path: '/gorevler',
    title: 'Günlük Görevler ve Ödüller',
    description: 'Günlük ve haftalık görevleri tamamla, Kanka Coin ve ekstra hak kazan.',
    image: '/images/heroes/gorevler.png',
    keywords: ['günlük görev', 'görev ödülü', 'puan kazan'],
  },
  biletler: {
    path: '/biletler',
    title: 'Çekiliş Biletleri ve Etkinlikler',
    description: 'Bilet al, haftalık çekilişlere katıl, ödül kazan.',
    image: '/images/heroes/biletler.png',
    keywords: ['çekiliş', 'çekiliş bileti', 'ödüllü çekiliş'],
  },
  kankatv: {
    path: '/kankatv',
    title: 'KankaTV — Canlı Skor ve Ücretsiz Canlı Yayın',
    description:
      'Premier Lig, LaLiga, Serie A, Bundesliga, Ligue 1 ve Liga Portugal maçları, canlı skorlar ve açık kanalların resmi canlı yayınları.',
    keywords: ['canlı skor', 'canlı maç', 'kankatv', 'basketbol canlı skor', 'voleybol canlı skor', 'premier lig', 'süper lig', 'a spor canlı'],
  },
  tahminler: {
    path: '/tahminler',
    title: 'Maç Tahminleri ve Tahmin Yarışması',
    description: 'Maç tahminlerini yap, doğru bil, Kanka Coin kazan.',
    image: '/images/heroes/tahminler.png',
    keywords: ['maç tahminleri', 'tahmin yarışması', 'günün tahminleri'],
  },
  rozetler: {
    path: '/rozetler',
    title: 'Rozetler ve Seviyeler — Kanka Puan',
    description: 'Sitede vakit geçir, oyun oyna, görev yap ve sohbette yaz: Kanka Puan topla, seviye atla, değerli rozetleri kazan.',
    keywords: ['rozet', 'seviye', 'kanka puan', 'tahmin kralı', 'turnuva şampiyonu'],
  },
  siralama: {
    path: '/siralama',
    title: 'Sıralama ve Liderlik Tablosu',
    description: 'En çok Kanka Coin toplayan üyeler ve haftalık liderlik tablosu.',
    image: '/images/heroes/siralama.png',
    keywords: ['liderlik tablosu', 'sıralama'],
  },
  uygulama: {
    path: '/uygulama',
    title: 'Mobil Uygulama: Ana Ekrana Ekle, Bonus Kazan',
    description: "AL KANKA'yı Android ve iPhone ana ekranına ekle, uygulamadan giriş yap, bonus KC kazan.",
    image: '/images/heroes/uygulama.png',
    keywords: ['al kanka uygulama', 'mobil uygulama', 'apk'],
  },
  sss: {
    path: '/sss',
    title: 'Sıkça Sorulan Sorular',
    description: 'Kanka Coin, puan marketi, Telegram ve hesap güvenliği hakkında en çok sorulanlar.',
    image: '/images/heroes/sss.png',
    keywords: ['al kanka nedir', 'kanka coin nedir', 'sss'],
  },
  rehber: {
    path: '/rehber',
    title: 'Rehber: Bonus, Oran ve Promo Kod Yazıları',
    description: 'Bonus kodları nasıl kullanılır, özel oran nedir, deneme bonusu nasıl alınır? Güncel rehber yazıları.',
    keywords: ['bonus rehberi', 'deneme bonusu nasıl alınır', 'özel oran nedir', 'promo kod nasıl kullanılır'],
  },
} satisfies Record<string, PageSeo>

export type PageKey = keyof typeof PAGE_SEO

export function pageMeta(key: PageKey): Metadata {
  const page: PageSeo = PAGE_SEO[key]
  const image = page.image ?? DEFAULT_OG
  return {
    title: key === 'anasayfa' ? { absolute: page.title } : page.title,
    description: page.description,
    keywords: page.keywords,
    alternates: { canonical: page.path },
    openGraph: { title: page.title, description: page.description, url: page.path, images: [{ url: image }] },
    twitter: { card: 'summary_large_image', title: page.title, description: page.description, images: [image] },
  }
}

export function slugify(input: string) {
  const map: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', İ: 'i' }
  return input
    .replace(/[çğıöşüİ]/g, (c) => map[c] ?? c)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70)
}

export function jsonLd(data: unknown) {
  return { __html: JSON.stringify(data).replace(/</g, '\\u003c') }
}
