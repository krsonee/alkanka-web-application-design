export type TaskKind =
  | 'manual'
  | 'game_play'
  | 'game_win'
  | 'sponsor_visit'
  | 'sponsor_link'
  | 'invite'
  | 'social_link'
  | 'telegram_link'
  | 'tv_watch'
  | 'tv_predict'

export type KindParam = 'game' | 'site' | 'platform' | null

export const TASK_KINDS: { value: TaskKind; label: string; param: KindParam; counted: boolean; hint: string }[] = [
  { value: 'manual', label: 'Serbest (tıkla / onaylı)', param: null, counted: false, hint: 'Üye butona basar. "Onay beklesin" açıksa sen onaylayınca puan yazılır.' },
  { value: 'game_play', label: 'Oyun oyna', param: 'game', counted: true, hint: 'Bitmiş masa/bot maçları sayılır. İade edilen maçlar sayılmaz.' },
  { value: 'game_win', label: 'Oyun kazan', param: 'game', counted: true, hint: 'Sadece kazanılan maçlar sayılır.' },
  { value: 'sponsor_visit', label: 'Sponsor siteye git', param: 'site', counted: true, hint: 'Üye sitedeki "Git" butonuyla (affiliate linkin) siteye gidince sayılır.' },
  { value: 'sponsor_link', label: 'Sponsor hesabı bağla', param: 'site', counted: false, hint: 'Üyenin sponsor hesabı panelde onaylanınca tamamlanır.' },
  { value: 'invite', label: 'Arkadaş davet et', param: null, counted: true, hint: 'Davet linkiyle kayıt olan üyeler sayılır.' },
  { value: 'social_link', label: 'Sosyal hesap doğrula', param: 'platform', counted: false, hint: 'Üyenin sosyal hesabı doğrulanınca tamamlanır.' },
  { value: 'telegram_link', label: 'Telegram bağla', param: null, counted: false, hint: 'Üye Telegram hesabını bağlayınca tamamlanır.' },
  { value: 'tv_watch', label: 'KankaTV izle (dakika)', param: null, counted: true, hint: 'Hedef dakika cinsindendir. Üye KankaTV’de yayın açıkken her dakika sayılır.' },
  { value: 'tv_predict', label: 'KankaTV gol tahmini bil', param: null, counted: true, hint: 'KankaTV’de “sıradaki golü kim atar” tahminini bilen üyeler sayılır.' },
]

export const KIND_META = Object.fromEntries(TASK_KINDS.map((k) => [k.value, k])) as Record<TaskKind, (typeof TASK_KINDS)[number]>

export const isTaskKind = (v: unknown): v is TaskKind => typeof v === 'string' && v in KIND_META

export const isAutoKind = (kind: TaskKind) => kind !== 'manual'

export const TASK_GAMES: { value: string; label: string }[] = [
  { value: 'tavla', label: 'Tavla' },
  { value: 'okey', label: 'Okey' },
  { value: 'okey101', label: '101 Okey' },
  { value: 'batak', label: 'Batak' },
  { value: 'pisti', label: 'Pişti' },
  { value: 'papaz', label: 'Papaz Kaçtı' },
  { value: 'monopoly', label: 'Monopoly' },
  { value: 'bilardo', label: 'Bilardo' },
  { value: 'blackjack', label: 'Blackjack' },
  { value: 'rulet', label: 'Rulet' },
  { value: 'kafa-topu', label: 'Kafa Topu' },
  { value: 'kafa-basketbolu', label: 'Kafa Basketbolu' },
]

export const TASK_PLATFORMS = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'x', label: 'X' },
  { value: 'youtube', label: 'YouTube' },
]

/** Where the member goes to make progress on an auto task. */
export function kindHref(kind: TaskKind, param: string | null): { href: string; external: boolean } | null {
  if (kind === 'game_play' || kind === 'game_win') return { href: '/oyunlar', external: false }
  if (kind === 'tv_watch' || kind === 'tv_predict') return { href: '/kankatv', external: false }
  if (kind === 'sponsor_visit') return param ? { href: `/git/${encodeURIComponent(param)}?src=gorev`, external: true } : { href: '/sponsorlar', external: false }
  if (kind === 'sponsor_link' || kind === 'social_link' || kind === 'telegram_link' || kind === 'invite') return { href: '/profil', external: false }
  return null
}
