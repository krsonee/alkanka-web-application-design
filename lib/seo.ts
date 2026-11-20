import type { Metadata } from 'next'
import shareImages from './share-images.json'

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://alkanka.com').replace(/\/$/, '')
export const SITE_NAME = 'AL KANKA'
// A JPG under 300 KB: WhatsApp and Telegram skip link previews whose image is much heavier.
export const DEFAULT_OG = '/images/og.jpg'

type ShareImage = { url: string; width?: number; height?: number }
const SHARE_IMAGES: Record<string, ShareImage> = {
  ...shareImages,
  [DEFAULT_OG]: { url: DEFAULT_OG, width: 1200, height: 630 },
}

/** The light JPG copy of an artwork for link previews (scripts/make-share-images.mjs); falls back to the artwork itself. */
export function shareImage(src: string): ShareImage {
  return SHARE_IMAGES[src] ?? { url: src }
}

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
    title: 'Online Okey, Tavla, Batak, Pişti ve Bilardo Oyna',
    description: 'Okey, 101 Okey, tavla, batak, pişti ve bilardo masalarına otur; bota karşı ya da oyuncularla oyna. Çark, zar ve sandıkla her gün ücretsiz Kanka Coin topla.',
    image: '/images/heroes/oyunlar.png',
    keywords: ['online okey', 'tavla oyna', 'batak oyna', 'pişti oyna', 'bilardo oyna', 'çark çevir', 'puan kazan'],
  },
  turnuvalar: {
    path: '/turnuvalar',
    title: 'Tavla, Okey ve Bilardo Turnuvaları',
    description: 'Tavla, okey, bilardo ve kafa topu turnuvalarına katıl. Eleme, lig ve puan ligi formatlarında yarış, Kanka Coin ödül havuzundan payını al.',
    image: '/images/heroes/turnuvalar.png',
    keywords: ['tavla turnuvası', 'okey turnuvası', 'bilardo turnuvası', 'ödüllü turnuva'],
  },
  market: {
    path: '/market',
    title: 'Puan Marketi: Kanka Coin ile Ödül Al',
    description: 'Topladığın Kanka Coin’i puan marketinde harca: çark ve zar hakkı, seri kalkanı, rozet ve sponsor ödülleri. Ürünleri incele, coinini ödüle çevir.',
    image: '/images/heroes/market.png',
    keywords: ['puan marketi', 'kanka coin', 'ödül marketi'],
  },
  gorevler: {
    path: '/gorevler',
    title: 'Günlük Görevler ve Ödüller',
    description: 'Günlük ve haftalık görevleri tamamla, Kanka Coin ve ekstra hak kazan. Oyun oyna, tahmin yap, çarkı çevir; her görevin ödülü ayrı.',
    image: '/images/heroes/gorevler.png',
    keywords: ['günlük görev', 'görev ödülü', 'puan kazan'],
  },
  kankatv: {
    path: '/kankatv',
    title: 'KankaTV — Canlı Skor ve Ücretsiz Canlı Yayın',
    description:
      'Premier Lig, LaLiga, Serie A, Bundesliga, Ligue 1 ve Liga Portugal maçları, canlı skorlar ve açık kanalların resmi canlı yayınları.',
    image: '/images/heroes/kankatv.png',
    keywords: ['canlı skor', 'canlı maç', 'kankatv', 'basketbol canlı skor', 'voleybol canlı skor', 'premier lig', 'süper lig', 'a spor canlı'],
  },
  tahminler: {
    path: '/tahminler',
    title: 'Maç Tahminleri ve Tahmin Yarışması',
    description: 'Günün maçlarına tahminini yap: maç sonucu, skor, gol alt/üst ve daha fazlası. Doğru bilen Kanka Coin kazanır, tahmin liginde sıralamaya girer.',
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
    description: 'En çok Kanka Coin toplayan üyeler ve haftalık liderlik tablosu. Sıranı gör, ilk üçe gir, şampiyon kürsüsünde yerini al.',
    image: '/images/heroes/siralama.png',
    keywords: ['liderlik tablosu', 'sıralama'],
  },
  sampiyonlar: {
    path: '/sampiyonlar',
    title: 'Şampiyon Kürsüsü: Haftanın ve Ayın İlk 3 Kankası',
    description: 'Her haftanın ve ayın ilk 3 kankası şampiyon kürsüsünde. Kürsüye çıkanlar burada kalıcı olarak yer alır; geçmiş dönemlerin şampiyonlarını da gör.',
    image: '/images/heroes/siralama.png',
    keywords: ['şampiyonlar', 'haftanın şampiyonu', 'kürsü'],
  },
  uygulama: {
    path: '/uygulama',
    title: 'Mobil Uygulama: Ana Ekrana Ekle, Bonus Kazan',
    description: "AL KANKA'yı Android ve iPhone ana ekranına ekle, bildirimleri aç, bonus Kanka Coin kazan. Turnuva ve promo kod duyuruları ilk sana gelsin.",
    image: '/images/heroes/uygulama.png',
    keywords: ['al kanka uygulama', 'mobil uygulama', 'apk'],
  },
  sss: {
    path: '/sss',
    title: 'Sıkça Sorulan Sorular',
    description: 'Kanka Coin nedir, nasıl kazanılır, puan marketi nasıl çalışır? Telegram bağlama, ödül teslimi ve hesap güvenliği hakkında en çok sorulanlar.',
    image: '/images/heroes/sss.png',
    keywords: ['al kanka nedir', 'kanka coin nedir', 'sss'],
  },
  rehber: {
    path: '/rehber',
    title: 'Oyun Rehberi: Okey, Tavla, Batak ve Bilardo',
    description: 'Okey, 101 okey, tavla, batak, pişti ve bilardo nasıl oynanır? Kurallar, puan hesaplama, taktikler ve turnuva rehberleri tek yerde.',
    keywords: ['okey nasıl oynanır', 'tavla nasıl oynanır', 'batak kuralları', 'bilardo kuralları', 'oyun rehberi'],
  },
} satisfies Record<string, PageSeo>

/** Shown to members only: served with noindex and kept out of the sitemap. */
export const MEMBERS_ONLY_PATHS = new Set(['/sponsorlar', '/kampanyalar', '/bonuslar', '/ozel-oranlar'])

export type PageKey = keyof typeof PAGE_SEO

export function pageMeta(key: PageKey): Metadata {
  const page: PageSeo = PAGE_SEO[key]
  const image = shareImage(page.image ?? DEFAULT_OG)
  return {
    title: key === 'anasayfa' ? { absolute: page.title } : page.title,
    description: page.description,
    keywords: page.keywords,
    alternates: { canonical: page.path },
    openGraph: { ...OG_BASE, title: page.title, description: page.description, url: page.path, images: [image] },
    twitter: { card: 'summary_large_image', title: page.title, description: page.description, images: [image.url] },
  }
}

/** A page that sets its own openGraph replaces the layout's whole block, so these have to be repeated on every page. */
export const OG_BASE = { type: 'website', locale: 'tr_TR', siteName: SITE_NAME } as const

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

export function breadcrumbLd(trail: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((step, i) => ({ '@type': 'ListItem', position: i + 1, name: step.name, item: `${SITE_URL}${step.path}` })),
  }
}

export function jsonLd(data: unknown) {
  return { __html: JSON.stringify(data).replace(/</g, '\\u003c') }
}
