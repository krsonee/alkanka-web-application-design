import { hasOwn } from './has-own'

export type TaskKind =
  | 'manual'
  | 'game_play'
  | 'game_win'
  | 'games_distinct'
  | 'sponsor_visit'
  | 'sponsor_link'
  | 'invite'
  | 'invite_active'
  | 'social_link'
  | 'social_follow'
  | 'social_like'
  | 'telegram_link'
  | 'tg_comment'
  | 'tg_active_days'
  | 'tv_watch'
  | 'tv_predict'
  | 'predict'
  | 'predict_correct'
  | 'chat_message'
  | 'cember_join'
  | 'table_invite'
  | 'trust_review'
  | 'trust_helpful'
  | 'login_days'
  | 'app_login'
  | 'tournament_join'
  | 'tournament_win'
  | 'profile'
  | 'secret_code'
  | 'bundle'

/** 'games' takes a game group only: a single game makes no sense for "different games played". */
export type KindParam = 'game' | 'games' | 'site' | 'platform' | 'code' | null

export type TaskCategory = 'genel' | 'takvim' | 'sosyal' | 'sponsor' | 'zincir'

export const TASK_CATEGORIES: { value: TaskCategory; label: string }[] = [
  { value: 'genel', label: 'Genel' },
  { value: 'takvim', label: 'Takvim' },
  { value: 'sosyal', label: 'Sosyal & Telegram' },
  { value: 'sponsor', label: 'Sponsor' },
  { value: 'zincir', label: 'Zincir' },
]

export const isCategory = (v: unknown): v is TaskCategory => TASK_CATEGORIES.some((c) => c.value === v)

export const TASK_KINDS: { value: TaskKind; label: string; param: KindParam; counted: boolean; hint: string }[] = [
  { value: 'manual', label: 'Serbest (tıkla / onaylı)', param: null, counted: false, hint: 'Üye butona basar. "Onay beklesin" açıksa sen onaylayınca puan yazılır.' },
  { value: 'game_play', label: 'Oyun oyna', param: 'game', counted: true, hint: 'Sonuna kadar oynanan masa/bot maçları sayılır. İade edilen, masadan kalkılan, pes edilen ya da süresi dolan maçlar sayılmaz.' },
  { value: 'game_win', label: 'Oyun kazan', param: 'game', counted: true, hint: 'Sadece kazanılan maçlar sayılır.' },
  { value: 'games_distinct', label: 'Farklı oyun oyna', param: 'games', counted: true, hint: 'Dönem içinde oynanan farklı oyun sayısı. Oyun grubu seçersen sadece o gruptaki oyunlar sayılır.' },
  { value: 'sponsor_visit', label: 'Sponsor siteye git', param: 'site', counted: true, hint: 'Üye sitedeki "Git" butonuyla (affiliate linkin) siteye gidince sayılır.' },
  { value: 'sponsor_link', label: 'Sponsor hesabı bağla', param: 'site', counted: true, hint: 'Üyenin sponsor hesabı panelde onaylanınca sayılır. Hedef 3 = 3 farklı sponsor.' },
  { value: 'invite', label: 'Arkadaş davet et', param: null, counted: true, hint: 'Davet linkiyle kayıt olan üyeler sayılır.' },
  { value: 'invite_active', label: 'Aktif davet', param: null, counted: true, hint: 'Davet ettiği ve en az bir oyun oynamış üyeler sayılır.' },
  { value: 'social_link', label: 'Sosyal hesap doğrula', param: 'platform', counted: false, hint: 'Üyenin sosyal hesabı doğrulanınca tamamlanır.' },
  { value: 'social_follow', label: 'Resmi hesabı takip et / abone ol', param: 'platform', counted: false, hint: 'Üyenin bağlı hesabı resmi hesabımızı takip ediyorsa tamamlanır. Platform API’si panelde bağlıysa otomatik, değilse onay kuyruğuna düşer.' },
  { value: 'social_like', label: 'Gönderiyi beğen', param: 'platform', counted: false, hint: 'Bağlantı alanına gönderi linkini yapıştır. Üyenin bağlı hesabı beğendiyse tamamlanır (X otomatik, diğerleri onaylı).' },
  { value: 'telegram_link', label: 'Telegram bağla', param: null, counted: false, hint: 'Üye Telegram hesabını bağlayınca tamamlanır.' },
  { value: 'tg_comment', label: 'Telegram gönderisine yorum', param: null, counted: true, hint: 'Bağlı Telegram hesabıyla kanal gönderilerine yazılan yorumlar sayılır.' },
  { value: 'tg_active_days', label: 'Telegram’da aktif gün', param: null, counted: true, hint: 'Sohbet grubunda veya kanal yorumlarında yazdığı farklı gün sayısı.' },
  { value: 'tv_watch', label: 'KankaTV izle (dakika)', param: null, counted: true, hint: 'Hedef dakika cinsindendir. Üye KankaTV’de yayın açıkken her dakika sayılır.' },
  { value: 'tv_predict', label: 'KankaTV gol tahmini bil', param: null, counted: true, hint: 'KankaTV’de “sıradaki golü kim atar” tahminini bilen üyeler sayılır.' },
  { value: 'predict', label: 'Maç tahmini yap', param: null, counted: true, hint: 'Tahminler sayfasında yapılan skor tahminleri.' },
  { value: 'predict_correct', label: 'Doğru maç tahmini', param: null, counted: true, hint: 'Sonuçlanan ve puan alan tahminler sayılır.' },
  { value: 'chat_message', label: 'Sohbete mesaj yaz', param: null, counted: true, hint: 'Site sohbetine yazılan mesajlar.' },
  { value: 'cember_join', label: 'Jako Çemberi’ne katıl', param: null, counted: true, hint: 'Ödül alınan Çember seansları sayılır.' },
  { value: 'table_invite', label: 'Masa daveti gönder', param: null, counted: true, hint: 'Oyun masasından arkadaşa gönderilen davetler.' },
  { value: 'trust_review', label: 'Güven Merkezi yorumu', param: null, counted: true, hint: 'Onaylanmış site yorumları sayılır.' },
  { value: 'trust_helpful', label: 'Yorumu “faydalı” işaretle', param: null, counted: true, hint: 'Güven Merkezi’nde faydalı işaretlenen yorumlar.' },
  { value: 'login_days', label: 'Giriş yapılan gün', param: null, counted: true, hint: 'Dönem içinde giriş ödülü alınan farklı gün sayısı.' },
  { value: 'app_login', label: 'Uygulamadan giriş', param: null, counted: true, hint: 'Ana ekrana eklenen Alkanka uygulamasından açılan farklı gün sayısı. Tarayıcıdan girişler sayılmaz.' },
  { value: 'tournament_join', label: 'Turnuvaya katıl', param: null, counted: true, hint: 'Kayıt olunan turnuvalar.' },
  { value: 'tournament_win', label: 'Turnuva kazan', param: 'game', counted: true, hint: 'Şampiyon olarak bitirilen turnuvalar sayılır. Oyun seçersen sadece o oyunun turnuvaları sayılır. İptal edilen ya da şampiyonsuz kapanan turnuva sayılmaz.' },
  { value: 'profile', label: 'Profili tamamla', param: null, counted: false, hint: 'Avatar, kapak veya takım seçince tamamlanır.' },
  { value: 'secret_code', label: 'Gizli kod', param: 'code', counted: false, hint: 'Kodu Telegram kanalında paylaş; sitede doğru kodu giren ödülü alır. Kod üyelere gösterilmez.' },
  { value: 'bundle', label: 'Hepsini bitir (süper görev)', param: null, counted: true, hint: 'Şart eklemezsen aynı dönemdeki diğer görevlerin hepsi bitince açılır (günlükte ödül 1x-2x arası rastgeledir). Şart eklersen sadece o şartların hepsi tamamlanınca açılır.' },
]

export const KIND_META = Object.fromEntries(TASK_KINDS.map((k) => [k.value, k])) as Record<TaskKind, (typeof TASK_KINDS)[number]>

export const isTaskKind = (v: unknown): v is TaskKind => typeof v === 'string' && hasOwn(KIND_META, v)

export const isAutoKind = (kind: TaskKind) => kind !== 'manual'

export const TASK_GAMES: { value: string; label: string }[] = [
  { value: 'tavla', label: 'Tavla' },
  { value: 'okey', label: 'Okey' },
  { value: 'okey101', label: '101 Okey' },
  { value: 'batak', label: 'Batak' },
  { value: 'pisti', label: 'Pişti' },
  { value: 'papaz', label: 'Papaz Kimde' },
  { value: 'monopoly', label: 'Jakopoly' },
  { value: 'bilardo', label: 'Bilardo' },
  { value: 'blackjack', label: 'Blackjack' },
  { value: 'rulet', label: 'Rulet' },
  { value: 'kafa-topu', label: 'Kafa Topu' },
  { value: 'kafa-basketbolu', label: 'Kafa Basketbolu' },
]

export const NINE_GAMES = 'dokuz-oyun'

/** A named set of games a task can count together, so "the nine listed games" leaves Blackjack, Rulet and Papaz out. */
export const TASK_GAME_GROUPS: { value: string; label: string; games: string[] }[] = [
  {
    value: NINE_GAMES,
    label: 'Dokuz oyun (Tavla, Okey, 101 Okey, Batak, Pişti, Jakopoly, Bilardo, Kafa Topu, Kafa Basketbolu)',
    games: ['tavla', 'okey', 'okey101', 'batak', 'pisti', 'monopoly', 'bilardo', 'kafa-topu', 'kafa-basketbolu'],
  },
]

/** The games a task's game setting stands for; null counts every game. */
export function taskGames(param: string | null): string[] | null {
  if (!param) return null
  return TASK_GAME_GROUPS.find((g) => g.value === param)?.games ?? [param]
}

export function gameParamOptions(type: KindParam) {
  const groups = TASK_GAME_GROUPS.map((g) => ({ value: g.value, label: g.label }))
  return type === 'games' ? groups : [...groups, ...TASK_GAMES]
}

export const isGameParam = (type: KindParam, value: string) => gameParamOptions(type).some((o) => o.value === value)

export const gameParamLabel = (value: string) =>
  value === NINE_GAMES ? 'Dokuz oyun' : (TASK_GAMES.find((g) => g.value === value)?.label ?? value)

/**
 * One condition of a super task that names its own conditions. `task` points at another task by id and
 * holds once that task is completed; every other kind is counted the way a task of that kind is.
 */
export type TaskPart = { kind: TaskKind | 'task'; param: string | null; target: number }

export const MAX_TASK_PARTS = 12
export const MAX_TASK_TARGET = 100_000

const NOT_A_PART: TaskKind[] = ['manual', 'bundle', 'secret_code', 'social_follow', 'social_like']

export const PART_KINDS = TASK_KINDS.filter((k) => !NOT_A_PART.includes(k.value))

export const isPartKind = (v: unknown): v is TaskPart['kind'] => v === 'task' || PART_KINDS.some((k) => k.value === v)

export const TASK_PLATFORMS = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'x', label: 'X' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'twitch', label: 'Twitch' },
]

/** "Oyun oyna · Tavla": what one condition of a super task asks for, without its number. */
export function partLabel(part: TaskPart) {
  if (part.kind === 'task') return 'Görev'
  const meta = KIND_META[part.kind]
  if (!part.param) return meta.label
  if (meta.param === 'game' || meta.param === 'games') return `${meta.label} · ${gameParamLabel(part.param)}`
  if (meta.param === 'platform') return `${meta.label} · ${TASK_PLATFORMS.find((x) => x.value === part.param)?.label ?? part.param}`
  return meta.label
}

/** Social tasks the member does off-site and then asks us to check. */
export const isSocialCheckKind = (kind: TaskKind) => kind === 'social_follow' || kind === 'social_like'
export const isSocialTaskKind = (kind: TaskKind) => kind === 'social_link' || isSocialCheckKind(kind)

/** Where the member goes to make progress on an auto task. */
export function kindHref(kind: TaskKind, param: string | null): { href: string; external: boolean } | null {
  switch (kind) {
    case 'game_play':
    case 'game_win':
    case 'games_distinct':
    case 'table_invite':
      return { href: '/oyunlar', external: false }
    case 'tv_watch':
    case 'tv_predict':
      return { href: '/kankatv', external: false }
    case 'predict':
    case 'predict_correct':
      return { href: '/tahminler', external: false }
    case 'trust_review':
    case 'trust_helpful':
      return { href: '/guven', external: false }
    case 'tournament_join':
    case 'tournament_win':
      return { href: '/turnuvalar', external: false }
    case 'sponsor_visit':
      return param ? { href: `/git/${encodeURIComponent(param)}?src=gorev`, external: true } : { href: '/sponsorlar', external: false }
    case 'sponsor_link':
    case 'social_link':
    case 'telegram_link':
    case 'invite':
    case 'invite_active':
    case 'profile':
      return { href: '/profil', external: false }
    default:
      return null
  }
}
