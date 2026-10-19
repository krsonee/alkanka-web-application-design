export type AvatarUnlock = 'free' | 'level' | 'coin'
export type AvatarGroup = 'jako' | 'takim'

export type AvatarDef = {
  id: string
  name: string
  src: string
  group: AvatarGroup
  unlock: AvatarUnlock
  level: number
  price: number
  active: boolean
  sort: number
}

export type AvatarStatus = 'selected' | 'owned' | 'unlocked' | 'buy' | 'locked'
export type AvatarCard = AvatarDef & { status: AvatarStatus }

export type CoverDef = { id: string; name: string; src: string; level: number }
export type TeamDef = { id: string; name: string; colors: [string, string] }

export type LookState = {
  avatars: AvatarCard[]
  covers: (CoverDef & { unlocked: boolean })[]
  avatarId: string | null
  coverId: string
  team: string | null
  level: number
  balance: number
  rewardPending: boolean
  reward: number
}

export const FIRST_AVATAR_REWARD = 100

export const AVATAR_GROUPS: Record<AvatarGroup, string> = {
  jako: 'Jako karakterleri',
  takim: 'Takım formalı Jako',
}

const P = '/images/profil-fotograflari'
const T = '/images/avatarlar'

function a(id: string, name: string, src: string, group: AvatarGroup, unlock: AvatarUnlock, value = 0, sort = 0): AvatarDef {
  return { id, name, src, group, unlock, level: unlock === 'level' ? value : 1, price: unlock === 'coin' ? value : 0, active: true, sort }
}

export const DEFAULT_AVATARS: AvatarDef[] = [
  a('altin-coin', 'Altın Coin', `${P}/01-altin-coin-klasik.png`, 'jako', 'free', 0, 1),
  a('flat-jako', 'Sade Jako', `${P}/05-flat-ikon-jako.png`, 'jako', 'free', 0, 2),
  a('ak-mermer', 'AK Mermer', `${P}/07-ak-monogram-mermer.png`, 'jako', 'free', 0, 3),
  a('jako-sticker', 'Sticker Jako', `${P}/11-jako-cizgi-sticker.png`, 'jako', 'free', 0, 4),
  a('al-kanka-rozet', 'AL KANKA Rozet', `${P}/13-al-kanka-rozet.png`, 'jako', 'free', 0, 5),
  a('al-kanka-yazi', 'AL KANKA Yazı', `${P}/18-al-kanka-yazi-logo.png`, 'jako', 'free', 0, 6),
  a('jako-minimal', 'Minimal Jako', `${P}/20-jako-minimal-cizgi.png`, 'jako', 'free', 0, 7),
  a('jako-goz-kirpan', 'Göz Kırpan', `${P}/02-jako-goz-kirpan.png`, 'jako', 'level', 2, 10),
  a('jako-coin-isiriyor', 'Coin Avcısı', `${P}/03-jako-coin-isiriyor.png`, 'jako', 'level', 3, 11),
  a('jako-telefonda', 'Telefonda', `${P}/09-jako-telefonda.png`, 'jako', 'level', 3, 12),
  a('jako-gozluklu', 'Güneş Gözlüklü', `${P}/04-jako-gunes-gozluklu.png`, 'jako', 'level', 4, 13),
  a('jako-neon', 'Neon Jako', `${P}/08-jako-neon.png`, 'jako', 'level', 5, 14),
  a('jako-dj', 'DJ Jako', `${P}/14-jako-kulaklikli-dj.png`, 'jako', 'level', 5, 15),
  a('jako-coin-ustunde', 'Coin Tepesinde', `${P}/10-jako-coin-ustunde.png`, 'jako', 'level', 6, 16),
  a('jako-coin-yagmuru', 'Coin Yağmuru', `${P}/15-jako-coin-yagmuru.png`, 'jako', 'level', 6, 17),
  a('jako-mafya', 'Baba Jako', `${P}/12-jako-mafya-silueti.png`, 'jako', 'level', 7, 18),
  a('jako-kral', 'Kral Jako', `${P}/06-jako-tac-kral.png`, 'jako', 'level', 8, 19),
  a('jako-bayrakli', 'Bayraklı Jako', `${P}/21-jako-turk-bayrakli.png`, 'jako', 'coin', 500, 30),
  a('jako-selam', 'Selam Kanka', `${P}/17-jako-selam-veren.png`, 'jako', 'coin', 750, 31),
  a('jako-oyuncu', 'Oyuncu Jako', `${P}/19-jako-oyun-kolu.png`, 'jako', 'coin', 1000, 32),
  a('ak-kalkan', 'AK Kalkan', `${P}/16-ak-kalkan-logo.png`, 'jako', 'coin', 1500, 33),
  a('jako-pop-art', 'Pop Art Jako', `${P}/22-jako-pop-art.png`, 'jako', 'coin', 2000, 34),
  a('takim-milli', 'Ay-Yıldız', `${T}/takim-milli.png`, 'takim', 'free', 0, 50),
  a('takim-sari-kirmizi', 'Sarı-Kırmızı', `${T}/takim-sari-kirmizi.png`, 'takim', 'coin', 750, 51),
  a('takim-sari-lacivert', 'Sarı-Lacivert', `${T}/takim-sari-lacivert.png`, 'takim', 'coin', 750, 52),
  a('takim-siyah-beyaz', 'Siyah-Beyaz', `${T}/takim-siyah-beyaz.png`, 'takim', 'coin', 750, 53),
  a('takim-bordo-mavi', 'Bordo-Mavi', `${T}/takim-bordo-mavi.png`, 'takim', 'coin', 750, 54),
  a('takim-yesil-beyaz', 'Yeşil-Beyaz', `${T}/takim-yesil-beyaz.png`, 'takim', 'coin', 750, 55),
  a('takim-turuncu-lacivert', 'Turuncu-Lacivert', `${T}/takim-turuncu-lacivert.png`, 'takim', 'coin', 750, 56),
  a('takim-kaleci-altin', 'Altın Eldiven', `${T}/takim-kaleci-altin.png`, 'takim', 'level', 6, 57),
  a('takim-kirmizi-beyaz', 'Kırmızı-Beyaz', `${T}/takim-kirmizi-beyaz.png`, 'takim', 'coin', 750, 58),
  a('takim-kirmizi-siyah', 'Kırmızı-Siyah', `${T}/takim-kirmizi-siyah.png`, 'takim', 'coin', 750, 59),
  a('takim-kirmizi-yesil', 'Kırmızı-Yeşil', `${T}/takim-kirmizi-yesil.png`, 'takim', 'coin', 750, 60),
  a('takim-yesil-siyah', 'Yeşil-Siyah', `${T}/takim-yesil-siyah.png`, 'takim', 'coin', 750, 61),
  a('takim-mor-beyaz', 'Mor-Beyaz', `${T}/takim-mor-beyaz.png`, 'takim', 'coin', 750, 62),
  a('takim-mavi-beyaz', 'Mavi-Beyaz', `${T}/takim-mavi-beyaz.png`, 'takim', 'coin', 750, 63),
  a('takim-tribun', 'Tribün Lideri', `${T}/takim-tribun.png`, 'takim', 'level', 3, 70),
  a('takim-golcu', 'Golcü Jako', `${T}/takim-golcu.png`, 'takim', 'level', 4, 71),
  a('takim-hakem', 'Hakem Jako', `${T}/takim-hakem.png`, 'takim', 'level', 5, 72),
  a('takim-kaptan', 'Kaptan Jako', `${T}/takim-kaptan.png`, 'takim', 'coin', 1250, 73),
  a('takim-hoca', 'Hoca Jako', `${T}/takim-hoca.png`, 'takim', 'coin', 1500, 74),
  a('takim-sampiyon', 'Şampiyon Jako', `${T}/takim-sampiyon.png`, 'takim', 'level', 8, 75),
]

export const COVERS: CoverDef[] = [
  { id: 'klasik', name: 'Klasik', src: '/images/badges/profile-cover.png', level: 1 },
  { id: 'stadyum', name: 'Stadyum', src: '/images/kapaklar/stadyum.png', level: 1 },
  { id: 'istanbul', name: 'İstanbul gecesi', src: '/images/kapaklar/istanbul.png', level: 2 },
  { id: 'kumarhane', name: 'Masa başı', src: '/images/kapaklar/kumarhane.png', level: 4 },
  { id: 'hazine', name: 'Hazine odası', src: '/images/kapaklar/hazine.png', level: 6 },
]

export const TEAMS: TeamDef[] = [
  { id: 'sari-kirmizi', name: 'Sarı-Kırmızı', colors: ['#f2b705', '#a6192e'] },
  { id: 'sari-lacivert', name: 'Sarı-Lacivert', colors: ['#f2c200', '#14254f'] },
  { id: 'siyah-beyaz', name: 'Siyah-Beyaz', colors: ['#111111', '#f4f4f4'] },
  { id: 'bordo-mavi', name: 'Bordo-Mavi', colors: ['#7a1f3d', '#5aa9e6'] },
  { id: 'yesil-beyaz', name: 'Yeşil-Beyaz', colors: ['#0a7d3b', '#f4f4f4'] },
  { id: 'turuncu-lacivert', name: 'Turuncu-Lacivert', colors: ['#f26b1d', '#14254f'] },
  { id: 'kirmizi-beyaz', name: 'Kırmızı-Beyaz', colors: ['#d71920', '#f4f4f4'] },
  { id: 'kirmizi-siyah', name: 'Kırmızı-Siyah', colors: ['#d71920', '#111111'] },
  { id: 'kirmizi-yesil', name: 'Kırmızı-Yeşil', colors: ['#d71920', '#0a7d3b'] },
  { id: 'yesil-siyah', name: 'Yeşil-Siyah', colors: ['#0a7d3b', '#111111'] },
  { id: 'mor-beyaz', name: 'Mor-Beyaz', colors: ['#5b2a86', '#f4f4f4'] },
  { id: 'mavi-beyaz', name: 'Mavi-Beyaz', colors: ['#1e6fd9', '#f4f4f4'] },
  { id: 'milli', name: 'Ay-Yıldız', colors: ['#e30a17', '#f4f4f4'] },
]

export function teamById(id: string | null | undefined) {
  return TEAMS.find((t) => t.id === id) ?? null
}

export function coverById(id: string | null | undefined) {
  return COVERS.find((c) => c.id === id) ?? COVERS[0]
}

export function unlockLabel(av: AvatarDef) {
  if (av.unlock === 'level') return `Seviye ${av.level}`
  if (av.unlock === 'coin') return `${av.price.toLocaleString('tr-TR')} KC`
  return 'Ücretsiz'
}
