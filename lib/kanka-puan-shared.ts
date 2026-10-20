export type LevelDef = { name: string; badge: string; min: number }

/** Lives here (not in a client component) so server components get real strings, not a client reference. */
export const TIER_NAMES: Record<string, string> = { bronz: 'Bronz', altin: 'Altın', elmas: 'Elmas', efsane: 'Efsane' }

export type PointRules = {
  minute: number
  minuteDailyCap: number
  game: number
  gameDailyCap: number
  task: number
  chat: number
  chatDailyCap: number
  leaguePoint: number
  tournamentWin: number
  review: number
  referral: number
  telegram: number
  streak7: number
  streak30: number
}

export type QuestMetric = 'tahmin' | 'oyun' | 'gorev' | 'sohbet' | 'dakika'

export const QUEST_METRICS: { id: QuestMetric; label: string; unit: string }[] = [
  { id: 'tahmin', label: 'Tahmin ligi tahmini', unit: 'tahmin' },
  { id: 'oyun', label: 'Oynanan oyun', unit: 'oyun' },
  { id: 'gorev', label: 'Tamamlanan görev', unit: 'görev' },
  { id: 'sohbet', label: 'Sohbet mesajı', unit: 'mesaj' },
  { id: 'dakika', label: 'Sitede geçirilen dakika', unit: 'dakika' },
]

export type WeeklyQuestConfig = { enabled: boolean; title: string; badgeId: string; metric: QuestMetric; target: number }

export const DEFAULT_QUEST: WeeklyQuestConfig = { enabled: false, title: 'Hafta Kâhini', badgeId: '', metric: 'tahmin', target: 10 }

export const DEFAULT_RULES: PointRules = {
  minute: 1,
  minuteDailyCap: 120,
  game: 5,
  gameDailyCap: 30,
  task: 15,
  chat: 2,
  chatDailyCap: 40,
  leaguePoint: 20,
  tournamentWin: 300,
  review: 40,
  referral: 100,
  telegram: 50,
  streak7: 50,
  streak30: 300,
}

export const RULE_FIELDS: { key: keyof PointRules; label: string; hint: string; unit: string }[] = [
  { key: 'minute', label: 'Sitede geçirilen dakika', hint: 'Sekme açık ve aktifken her dakika', unit: 'KP / dk' },
  { key: 'minuteDailyCap', label: 'Günlük dakika sınırı', hint: 'Günde en fazla bu kadar dakika puan kazandırır', unit: 'dk' },
  { key: 'game', label: 'Oynanan oyun', hint: 'Tavla, okey, batak vb. her masa', unit: 'KP / oyun' },
  { key: 'gameDailyCap', label: 'Günlük oyun sınırı', hint: 'Günde en fazla bu kadar oyun KP kazandırır (seviye hızını korur)', unit: 'oyun' },
  { key: 'task', label: 'Tamamlanan görev', hint: 'Görevler sayfasındaki her görev', unit: 'KP / görev' },
  { key: 'chat', label: 'Sohbet mesajı', hint: 'Sohbet kanalına yazılan her mesaj', unit: 'KP / mesaj' },
  { key: 'chatDailyCap', label: 'Günlük mesaj sınırı', hint: 'Spamı önler, günde en fazla bu kadar mesaj sayılır', unit: 'mesaj' },
  { key: 'leaguePoint', label: 'Tahmin ligi puanı', hint: 'Doğru sonuç 1, tam skor 3 lig puanıdır', unit: 'KP / lig puanı' },
  { key: 'tournamentWin', label: 'Turnuva şampiyonluğu', hint: 'Turnuva bitince şampiyona otomatik', unit: 'KP' },
  { key: 'review', label: 'Onaylanan site yorumu', hint: 'Güven merkezinde yayınlanan yorum', unit: 'KP / yorum' },
  { key: 'referral', label: 'Getirilen arkadaş', hint: 'Davet ödülü onaylanan her arkadaş', unit: 'KP / kişi' },
  { key: 'telegram', label: 'Telegram bağlama', hint: 'Hesabını Telegram’a bağlayana bir kez', unit: 'KP' },
  { key: 'streak7', label: '7 günlük seri bonusu', hint: 'Üst üste 7 gün gelen üyeye her seride bir kez', unit: 'KP' },
  { key: 'streak30', label: '30 günlük seri bonusu', hint: 'Üst üste 30 gün gelen üyeye her seride bir kez', unit: 'KP' },
]

export const DEFAULT_LEVELS: LevelDef[] = [
  { name: 'Çaylak', badge: 'İlk Adım', min: 0 },
  { name: 'Meraklı', badge: 'Göz Kırpan', min: 100 },
  { name: 'Takipçi', badge: 'Kulak Misafiri', min: 250 },
  { name: 'Kanka', badge: 'Kanka Eli', min: 500 },
  { name: 'Gedikli', badge: 'Müdavim', min: 850 },
  { name: 'Masa Kurdu', badge: 'Zar Atan', min: 1300 },
  { name: 'Taktisyen', badge: 'Kroki', min: 2000 },
  { name: 'Usta', badge: 'Usta Eli', min: 2900 },
  { name: 'Kurt', badge: 'Gri Kurt', min: 4100 },
  { name: 'Kaptan', badge: 'Pazubant', min: 5600 },
  { name: 'Yıldız', badge: 'Parlayan Yıldız', min: 7400 },
  { name: 'Kahraman', badge: 'Demir Kalkan', min: 9600 },
  { name: 'Efsane', badge: 'Efsane Mührü', min: 12300 },
  { name: 'Titan', badge: 'Titan Yumruğu', min: 15600 },
  { name: 'Sultan', badge: 'Sultan Tuğrası', min: 19600 },
  { name: 'Şampiyon', badge: 'Altın Kupa', min: 24500 },
  { name: 'Elmas', badge: 'Saf Elmas', min: 30500 },
  { name: 'Kral', badge: 'Altın Taç', min: 37500 },
  { name: 'İmparator', badge: 'İmparator Asası', min: 46000 },
  { name: 'Cihangir', badge: 'Cihan Mührü', min: 56000 },
  { name: 'Al Kanka', badge: 'Altın Papağan', min: 68000 },
]

export type BadgeTier = 'altin' | 'elmas' | 'efsane'

export const BADGE_TIERS: { id: BadgeTier; label: string }[] = [
  { id: 'altin', label: 'Altın' },
  { id: 'elmas', label: 'Elmas' },
  { id: 'efsane', label: 'Efsane' },
]

export const BADGE_ICONS = ['award', 'trophy', 'crown', 'target', 'eye', 'message', 'feather', 'flame', 'gem', 'medal', 'shield', 'star', 'swords', 'zap', 'heart', 'rocket']

/** Tier band for level emblems: every 5 levels the emblem material changes. */
export const levelTier = (levelNumber: number) =>
  levelNumber >= 16 ? 'efsane' : levelNumber >= 11 ? 'elmas' : levelNumber >= 6 ? 'altin' : 'bronz'

/** Public ranking label. Missing names, emails, and masked addresses become a generic label. */
export function publicRankName(raw: string | null | undefined): string {
  const name = String(raw ?? '').replace(/\s+/g, ' ').trim()
  const first = name.split(' ')[0] ?? ''
  if (!first || first.includes('@') || first.includes('*')) return 'Kanka'
  return first
}
