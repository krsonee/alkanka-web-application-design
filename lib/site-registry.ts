export const HERO_PAGES = [
  { slug: 'sponsorlar', label: 'Sponsorlar', path: '/sponsorlar', title: 'Güvenilir sponsorlar' },
  { slug: 'bonuslar', label: 'Bonuslar', path: '/bonuslar', title: 'Bonus kodları' },
  { slug: 'ozel-oranlar', label: 'Özel oranlar', path: '/ozel-oranlar', title: 'Artırılmış oranlar' },
  { slug: 'kampanyalar', label: 'Kampanyalar', path: '/kampanyalar', title: 'Kampanyalar' },
  { slug: 'oyunlar', label: 'Oyunlar', path: '/oyunlar', title: 'Çark · Zar · Sandık' },
  { slug: 'market', label: 'Market', path: '/market', title: 'Puan marketi' },
  { slug: 'gorevler', label: 'Görevler', path: '/gorevler', title: 'Günlük görevler' },
  { slug: 'biletler', label: 'Biletler', path: '/biletler', title: 'Bilet çekilişleri' },
  { slug: 'tahminler', label: 'Tahminler', path: '/tahminler', title: 'Maç tahminleri' },
  { slug: 'siralama', label: 'Sıralama', path: '/siralama', title: 'Haftalık liderler' },
  { slug: 'sss', label: 'Yardım / SSS', path: '/sss', title: 'Sıkça sorulan sorular' },
].map((p) => ({ ...p, image: `/images/heroes/${p.slug}.png` }))

export type HeroPage = (typeof HERO_PAGES)[number]

export const JAKO_POSES = [
  'jako',
  'merhaba',
  'kazandi',
  'duyuru',
  'sandik',
  'dusunen',
  'zar',
  'market',
  'uzgun',
  'telegram',
] as const

const heroes = HERO_PAGES.map((p) => p.image)
const banners = [
  '/images/banner-wheel.png',
  '/images/banner-events.png',
  '/images/banner-telegram.png',
  '/images/hero-chest.png',
]
const tiles = ['wheel', 'market', 'tasks', 'dice', 'chest', 'predict'].map((t) => `/images/tile-${t}.png`)
const mascots = JAKO_POSES.map((p) => (p === 'jako' ? '/images/mascots/jako.png' : `/images/mascots/jako-${p}.png`))

export const IMAGE_LIBRARY = [...banners, ...heroes, ...tiles, ...mascots]

export function isAllowedImage(value: string) {
  return (
    value.startsWith('/images/') ||
    /^\/api\/logo\/[a-z0-9._-]+$/i.test(value) ||
    /^https:\/\/[^\s"'<>]+$/.test(value)
  )
}
