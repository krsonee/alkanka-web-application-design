import { NINE_GAMES, TASK_GAMES, type TaskCategory, type TaskKind } from './task-kinds'
import type { TaskPeriod } from './task-period'

/**
 * The team's "Alkanka görevler & etkinlik takvimi" sheet as tasks. The sheet is written for December 2026;
 * `buildPlan` takes the day the calendar goes live and fits it to that day: the daily rule simply starts
 * earlier, and a week or month that is already under way gets its targets cut to the days that are left.
 * The sheet has no reward column, so every amount here follows what the site already pays for the same work.
 */

export type PlanPart = { kind: TaskKind; param?: string; target?: number } | { ref: string }

export type PlanTask = {
  key: string
  /** The sheet's own grouping, kept for the report. */
  group: string
  title: string
  detail: string
  kind: TaskKind
  period: TaskPeriod
  points: number
  target: number
  param: string | null
  category: TaskCategory
  startsAt: string | null
  endsAt: string | null
  days: string[] | null
  parts: PlanPart[]
  active: boolean
  approval: boolean
  /** Left out when the site already has a task that asks for exactly the same thing. */
  dedupe: boolean
  /** What has to be filled in before a hidden task can go on the site. */
  note: string
}

/** The sheet's daily calendar: 1 December is a Tavla day and the nine games take turns from there. */
export const PLAN_FIRST_DAY = '2026-12-01'
export const PLAN_LAST_DAY = '2026-12-31'
/** The Sunday that ends the last week in the sheet's weekly list. */
export const PLAN_LAST_WEEK_DAY = '2027-01-03'

const DAY_GAMES = ['tavla', 'okey', 'okey101', 'batak', 'pisti', 'monopoly', 'bilardo', 'kafa-topu', 'kafa-basketbolu']
/** Messages asked for on each weekday in the sheet, Sunday first. */
const CHAT_BY_WEEKDAY = [9, 4, 5, 6, 7, 8, 10]
const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']

const GAME_LABEL = new Map(TASK_GAMES.map((g) => [g.value, g.label]))
const gameName = (game: string) => GAME_LABEL.get(game) ?? game

const utc = (day: string) => new Date(`${day}T00:00:00Z`)
const addDays = (day: string, n: number) => {
  const d = utc(day)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
const diffDays = (from: string, to: string) => Math.round((utc(to).getTime() - utc(from).getTime()) / 86_400_000)
const weekday = (day: string) => utc(day).getUTCDay()
/** Midnight in Turkey at the start of that day. */
const startOf = (day: string) => new Date(`${day}T00:00:00+03:00`).toISOString()
const dayText = (day: string) => `${Number(day.slice(8))} ${MONTHS[Number(day.slice(5, 7)) - 1]}`
const round5 = (n: number) => Math.max(5, Math.round(n / 5) * 5)

export function gameOfDay(day: string) {
  return DAY_GAMES[((diffDays(PLAN_FIRST_DAY, day) % DAY_GAMES.length) + DAY_GAMES.length) % DAY_GAMES.length]
}

export const chatTargetOf = (day: string) => CHAT_BY_WEEKDAY[weekday(day)]

function daysBetween(first: string, last: string) {
  const out: string[] = []
  for (let day = first; day <= last; day = addDays(day, 1)) out.push(day)
  return out
}

type Draft = Pick<PlanTask, 'key' | 'group' | 'title' | 'detail' | 'kind' | 'period' | 'points'> & Partial<PlanTask>

function task(draft: Draft): PlanTask {
  return {
    target: 1, param: null, category: 'genel', startsAt: null, endsAt: null, days: null, parts: [],
    active: true, approval: false, dedupe: false, note: '',
    ...draft,
  }
}

function dailyPlan(start: string): PlanTask[] {
  if (start > PLAN_LAST_DAY) return []
  const days = daysBetween(start, PLAN_LAST_DAY)
  const base = { group: 'Günlük takvim', period: 'daily' as const, category: 'takvim' as const, startsAt: startOf(start), endsAt: startOf(addDays(PLAN_LAST_DAY, 1)) }
  const out: PlanTask[] = [
    task({ ...base, key: 'gun-giris', title: 'Giriş yap ve serine 1 gün ekle', detail: 'Bugünün giriş ödülünü al, serin bir gün uzasın.', kind: 'login_days', points: 15 }),
    task({ ...base, key: 'gun-tahmin', title: '3 farklı maç için tahmin yap', detail: 'Tahminler sayfasında bugün 3 ayrı maça tahmin gir.', kind: 'predict', target: 3, points: 25 }),
    task({ ...base, key: 'gun-turnuva', title: '1 turnuvaya katıl', detail: 'Bugün bir turnuvaya kayıt ol.', kind: 'tournament_join', points: 30 }),
  ]
  for (const game of DAY_GAMES) {
    const on = days.filter((day) => gameOfDay(day) === game)
    if (!on.length) continue
    const name = gameName(game)
    out.push(task({
      ...base, key: `gun-oyun-${game}`, title: `${name} oyununda 4 tur kazan`, detail: `Günün oyunu ${name}. Bugün ${name} masalarında 4 tur kazan.`,
      kind: 'game_win', param: game, target: 4, points: 40, days: on,
    }))
  }
  out.push(task({ ...base, key: 'gun-cesit', title: '4 farklı oyunda birer tur tamamla', detail: 'Bugün 4 ayrı oyunda en az birer tur bitir.', kind: 'games_distinct', target: 4, points: 35 }))
  for (const count of [...new Set(CHAT_BY_WEEKDAY)].sort((a, b) => a - b)) {
    const on = days.filter((day) => chatTargetOf(day) === count)
    if (!on.length) continue
    out.push(task({
      ...base, key: `gun-sohbet-${count}`, title: `Sohbete ${count} farklı mesaj yaz`, detail: `Bugün site sohbetine ${count} mesaj yaz.`,
      kind: 'chat_message', target: count, points: 15, days: on,
    }))
  }
  return out
}

function weeklyPlan(start: string): PlanTask[] {
  if (start > PLAN_LAST_WEEK_DAY) return []
  const sinceMonday = (weekday(start) + 6) % 7
  const firstMonday = sinceMonday === 0 ? start : addDays(start, 7 - sinceMonday)
  const base = { group: 'Haftalık takvim', period: 'weekly' as const, category: 'takvim' as const }
  const out: PlanTask[] = []
  if (sinceMonday !== 0) {
    // The week is already under way: the sheet asks for 1 login, 4 wins and 7 rounds a day, so the days left decide the targets.
    const left = 7 - sinceMonday
    const window = { startsAt: startOf(start), endsAt: startOf(firstMonday) }
    out.push(
      task({ ...base, ...window, key: 'hafta-ilk-giris', title: `Haftanın kalan ${left} gününde giriş yap`, detail: `Pazar gecesine kadar ${left} gün giriş ödülünü al.`, kind: 'login_days', target: left, points: round5((120 * left) / 7) }),
      task({ ...base, ...window, key: 'hafta-ilk-kazan', title: `Hafta bitmeden ${4 * left} tur kazan`, detail: 'Pazar gecesine kadar herhangi bir oyunda kazandığın turlar sayılır.', kind: 'game_win', target: 4 * left, points: round5((250 * left) / 7) }),
      task({ ...base, ...window, key: 'hafta-ilk-tur', title: `Hafta bitmeden ${7 * left} tur tamamla`, detail: 'Pazar gecesine kadar herhangi bir oyunda bitirdiğin turlar sayılır.', kind: 'game_play', target: 7 * left, points: round5((200 * left) / 7) }),
    )
  }
  if (firstMonday <= addDays(PLAN_LAST_WEEK_DAY, -6)) {
    const window = { startsAt: startOf(firstMonday), endsAt: startOf(addDays(PLAN_LAST_WEEK_DAY, 1)) }
    out.push(
      task({ ...base, ...window, key: 'hafta-giris', title: 'Bu hafta 7 gün üst üste giriş yap', detail: 'Pazartesiden pazara her gün giriş ödülünü al.', kind: 'login_days', target: 7, points: 120 }),
      task({ ...base, ...window, key: 'hafta-kazan', title: 'Bu hafta 28 tur kazan', detail: 'Hafta boyunca herhangi bir oyunda kazandığın turlar sayılır.', kind: 'game_win', target: 28, points: 250 }),
      task({ ...base, ...window, key: 'hafta-tur', title: 'Bu hafta 49 tur tamamla', detail: 'Hafta boyunca herhangi bir oyunda bitirdiğin turlar sayılır.', kind: 'game_play', target: 49, points: 200 }),
    )
  }
  return out
}

function monthlyPlan(start: string): PlanTask[] {
  const out: PlanTask[] = []
  for (let first = start; first <= PLAN_LAST_DAY; ) {
    const year = Number(first.slice(0, 4))
    const month = Number(first.slice(5, 7))
    const length = new Date(Date.UTC(year, month, 0)).getUTCDate()
    const next = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10)
    const left = length - Number(first.slice(8)) + 1
    const whole = left === length
    const cut = (n: number) => Math.max(1, Math.round((n * left) / length))
    const pay = (n: number) => (whole ? n : round5((n * left) / length))
    const name = MONTHS[month - 1]
    const base = {
      group: 'Aylık takvim', period: 'monthly' as const, category: 'takvim' as const,
      startsAt: startOf(first), endsAt: startOf(next), dedupe: whole,
    }
    const key = (what: string) => `ay-${first.slice(0, 7)}-${what}`
    out.push(
      task({ ...base, key: key('giris'), title: `${name} ayında ${cut(25)} farklı günde giriş yap`, detail: 'Giriş ödülünü aldığın her gün bir sayılır.', kind: 'login_days', target: cut(25), points: pay(400) }),
      task({ ...base, key: key('tahmin'), title: `${name} ayında ${cut(75)} farklı maç için tahmin yap`, detail: 'Tahmin girdiğin her maç bir sayılır.', kind: 'predict', target: cut(75), points: pay(225) }),
      task({ ...base, key: key('turnuva'), title: `${name} ayında ${cut(25)} farklı turnuvaya katıl`, detail: 'Kayıt olduğun her turnuva bir sayılır.', kind: 'tournament_join', target: cut(25), points: pay(500) }),
      task({ ...base, key: key('kazan'), title: `${name} ayında ${cut(100)} tur kazan`, detail: 'Ay boyunca herhangi bir oyunda kazandığın turlar sayılır.', kind: 'game_win', target: cut(100), points: pay(600) }),
      task({ ...base, key: key('tur'), title: `${name} ayında ${cut(175)} tur tamamla`, detail: 'Ay boyunca herhangi bir oyunda bitirdiğin turlar sayılır.', kind: 'game_play', target: cut(175), points: pay(500) }),
    )
    first = next
  }
  return out
}

const NINE_LIST = 'Tavla, Okey, 101 Okey, Batak, Pişti, Jakopoly, Bilardo, Kafa Topu ve Kafa Basketbolu'

const ONCE_DETAIL: Partial<Record<TaskKind, string>> = {
  predict: 'Tahminler sayfasında tahmin girdiğin her maç bir sayılır.',
  predict_correct: 'Sonuçlanan ve puan alan tahminlerin sayılır.',
  tournament_join: 'Kayıt olduğun her turnuva bir sayılır.',
  tournament_win: 'Şampiyon olarak bitirdiğin turnuvalar sayılır.',
  tv_watch: 'KankaTV’de yayın açıkken geçen her dakika sayılır.',
  tv_predict: '“Sıradaki golü kim atar” tahminini bildiğin her gol sayılır.',
  invite: 'Davet bağlantınla kayıt olan her arkadaşın bir sayılır.',
  invite_active: 'Davet ettiğin ve en az bir oyun turu bitiren arkadaşların sayılır.',
  table_invite: 'Oyun masasından gönderdiğin davetler sayılır.',
  login_days: 'Giriş ödülünü aldığın her gün bir sayılır.',
  app_login: 'Ana ekrana eklediğin Alkanka uygulamasından girdiğin günler sayılır.',
  tg_comment: 'Bağlı Telegram hesabınla kanal gönderisine yazdığın yorumlar sayılır.',
  telegram_link: 'Profilinden Telegram hesabını bağla.',
  social_link: 'Profilinden hesabını bağla ve doğrulat.',
  social_follow: 'Bağlı hesabınla resmî hesabımızı takip et, sonra kontrol ettir.',
  social_like: 'Bağlı hesabınla gönderiyi beğen, sonra kontrol ettir.',
  secret_code: 'Kodu Telegram kanalındaki gönderide bul, buraya yaz.',
  manual: 'Yorumunu yaz, sonra görevi tamamladığını bildir; ekip kontrol edip onaylar.',
  bundle: 'Şartların hepsi tamamlanınca ödül açılır.',
}

/** Kinds that read the account as it stands; every other kind counts from the day the calendar starts. */
const STATE_KINDS: TaskKind[] = ['telegram_link', 'social_link', 'social_follow', 'social_like', 'secret_code', 'manual', 'profile', 'sponsor_link']

const SOCIAL_GROUPS = ['Hesap bağlama', 'Hesap doğrulama', 'Takip ve abonelik', 'Gönderi beğenisi', 'Gönderi yorumu', 'Telegram']

function oncePlan(start: string): PlanTask[] {
  const out: PlanTask[] = []
  const since = ` Sayım ${dayText(start)} günü başlar.`
  const add = (group: string, title: string, kind: TaskKind, points: number, extra: Partial<PlanTask> = {}) => {
    const game = extra.param && (kind === 'game_play' || kind === 'game_win') ? extra.param : null
    const what = kind === 'game_win' ? 'kazandığın turlar sayılır.' : 'bitirdiğin turlar sayılır.'
    const own = game === NINE_GAMES ? `${NINE_LIST} oyunlarında ${what}` : game ? `${gameName(game)} masalarında ${what}` : (ONCE_DETAIL[kind] ?? '')
    const counted = !STATE_KINDS.includes(kind) && !extra.parts?.some((p) => 'ref' in p)
    out.push(task({
      key: `tek-${out.length + 1}`, group, title, kind, points, period: 'once',
      detail: `${own}${counted ? since : ''}`.trim(),
      category: SOCIAL_GROUPS.includes(group) ? 'sosyal' : group === 'Sponsor' ? 'sponsor' : 'genel',
      startsAt: startOf(start),
      dedupe: kind !== 'manual' && kind !== 'bundle' && kind !== 'secret_code',
      ...extra,
    }))
  }
  const all = (kind: TaskKind, target = 1, param?: string): PlanPart => ({ kind, target, param })
  const needsLink = 'Gönderinin linkini ekleyip yayına al.'

  add('Hesap bağlama', 'Telegram hesabını Alkanka’ya bağla', 'telegram_link', 150)
  for (const [platform, name] of [['x', 'X'], ['instagram', 'Instagram'], ['youtube', 'YouTube'], ['twitch', 'Twitch']]) {
    add('Hesap doğrulama', `${name} hesabını doğrula`, 'social_link', 50, { param: platform })
  }
  add('Hesap doğrulama', 'Tüm hesaplarını doğrula', 'bundle', 250, {
    parts: [all('telegram_link'), all('social_link', 1, 'x'), all('social_link', 1, 'instagram'), all('social_link', 1, 'youtube'), all('social_link', 1, 'twitch')],
  })
  add('Takip ve abonelik', 'Alkanka’yı X’te takip et', 'social_follow', 30, { param: 'x' })
  add('Takip ve abonelik', 'Alkanka’yı Instagram’da takip et', 'social_follow', 30, { param: 'instagram' })
  add('Takip ve abonelik', 'Alkanka’nın YouTube kanalına abone ol', 'social_follow', 30, { param: 'youtube' })
  add('Takip ve abonelik', 'Alkanka’nın Twitch kanalını takip et', 'social_follow', 30, { param: 'twitch' })
  // The site cannot check channel membership by itself; the Telegram task it already has stands for this one.
  add('Takip ve abonelik', 'Alkanka’nın resmî Telegram kanalına katıl', 'telegram_link', 100)
  add('Gönderi beğenisi', 'Alkanka’nın X’teki tanıtım gönderisini beğen', 'social_like', 15, { param: 'x', active: false, note: needsLink })
  add('Gönderi beğenisi', 'Alkanka’nın Instagram’daki oyun tanıtımını beğen', 'social_like', 15, { param: 'instagram', active: false, note: needsLink })
  add('Gönderi beğenisi', 'Alkanka’nın YouTube’daki tanıtım videosunu beğen', 'social_like', 15, { param: 'youtube', active: false, note: needsLink })
  add('Gönderi yorumu', 'Alkanka’nın X’teki oyun sorusuna yanıt yaz', 'manual', 40, { approval: true, active: false, note: needsLink })
  add('Gönderi yorumu', 'Instagram’daki etkinlik gönderisine oyun önerini yorum olarak yaz', 'manual', 40, { approval: true, active: false, note: needsLink })
  add('Gönderi yorumu', 'YouTube’daki tanıtım videosuna yorum yaz', 'manual', 40, { approval: true, active: false, note: needsLink })
  add('Gönderi yorumu', 'Telegram’daki tanışma gönderisine yorum yaz', 'tg_comment', 20)
  // Counted from the same comments as the task above, so it asks for a second one.
  add('Gönderi yorumu', 'Telegram’daki oyun önerileri gönderisine sevdiğin oyunu yaz', 'tg_comment', 30, { target: 2 })
  add('Telegram', 'Telegram’daki karşılama gönderisinin gizli kodunu gir', 'secret_code', 40, { active: false, note: 'Kodu yazıp yayına al.' })

  for (const [target, points] of [[250, 450], [1000, 950], [2500, 1500], [5000, 2100]]) {
    add('Oyun turları', `Listelenen oyunlarda toplam ${target.toLocaleString('tr-TR')} tur oyna`, 'game_play', points, { param: NINE_GAMES, target })
  }
  for (const [target, points] of [[100, 450], [250, 700], [500, 1000], [1000, 1400]]) {
    add('Oyun galibiyeti', `Listelenen oyunlarda toplam ${target.toLocaleString('tr-TR')} galibiyet elde et`, 'game_win', points, { param: NINE_GAMES, target })
  }
  for (const [target, points] of [[100, 250], [250, 400], [500, 550]]) add('Maç tahmini', `${target} farklı maç için tahmin yap`, 'predict', points, { target })
  for (const [target, points] of [[50, 300], [100, 450], [150, 550], [300, 800]]) add('Maç tahmini', `${target} farklı maçın sonucunu doğru tahmin et`, 'predict_correct', points, { target })
  for (const [target, points] of [[25, 400], [50, 550], [100, 800], [200, 1150]]) add('Turnuva katılımı', `${target} farklı turnuvaya katıl`, 'tournament_join', points, { target })
  for (const [target, points] of [[15, 800], [25, 1000], [50, 1400], [100, 2000]]) add('Turnuva galibiyeti', `${target} farklı turnuva kazan`, 'tournament_win', points, { target })

  const perGame: [string, number, number, number, number][] = [
    ['tavla', 350, 550, 120, 500], ['okey', 300, 500, 100, 450], ['okey101', 250, 450, 100, 450],
    ['batak', 300, 500, 120, 500], ['pisti', 500, 650, 200, 650], ['monopoly', 200, 400, 75, 400],
    ['bilardo', 300, 500, 100, 450], ['kafa-topu', 400, 600, 150, 550], ['kafa-basketbolu', 400, 600, 150, 550],
  ]
  for (const [game, rounds, roundPay, wins, winPay] of perGame) {
    add('Oyuna özel', `${gameName(game)} oyununda ${rounds} tur tamamla`, 'game_play', roundPay, { param: game, target: rounds })
    add('Oyuna özel', `${gameName(game)} oyununda ${wins} tur kazan`, 'game_win', winPay, { param: game, target: wins })
  }

  add('Oyun çeşitliliği', 'Dokuz oyunun tamamını oyna ve toplam 750 tur bitir', 'bundle', 1000, { parts: [all('games_distinct', 9, NINE_GAMES), all('game_play', 750, NINE_GAMES)] })
  add('Oyun çeşitliliği', 'Dokuz oyunun her birinde 50 tur tamamla', 'bundle', 1200, { parts: DAY_GAMES.map((game) => all('game_play', 50, game)) })
  add('Oyun çeşitliliği', 'Tavla, Okey ve 101 Okey’de ayrı ayrı 100 tur tamamla', 'bundle', 700, { parts: ['tavla', 'okey', 'okey101'].map((game) => all('game_play', 100, game)) })
  add('Oyun çeşitliliği', 'Batak’ta 75, Pişti’de 75 galibiyet elde et', 'bundle', 800, { parts: [all('game_win', 75, 'batak'), all('game_win', 75, 'pisti')] })
  add('Oyun çeşitliliği', 'Kafa Topu ve Kafa Basketbolu’nda ayrı ayrı 100 tur kazan', 'bundle', 900, { parts: [all('game_win', 100, 'kafa-topu'), all('game_win', 100, 'kafa-basketbolu')] })

  for (const [target, points] of [[600, 300], [1500, 450], [3000, 650]]) add('KankaTV', `KankaTV yayınlarını toplam ${target.toLocaleString('tr-TR')} dakika izle`, 'tv_watch', points, { target })
  for (const [target, points] of [[25, 300], [50, 400], [100, 600]]) add('KankaTV', `KankaTV’de ${target} gol tahminini doğru bil`, 'tv_predict', points, { target })
  add('KankaTV', 'KankaTV’yi 1.500 dakika izle ve 50 gol tahminini doğru bil', 'bundle', 900, { parts: [all('tv_watch', 1500), all('tv_predict', 50)] })

  for (const [target, points] of [[10, 800], [25, 1500], [50, 2500]]) add('Arkadaş daveti', `Davet bağlantınla ${target} arkadaşının Alkanka’ya üye olmasını sağla`, 'invite', points, { target })
  for (const [target, points] of [[10, 1200], [25, 2500], [50, 4000]]) add('Aktif davet', `Davet ettiğin ${target} arkadaşın ilk oyun turunu tamamlasın`, 'invite_active', points, { target })
  for (const [target, points] of [[50, 300], [100, 450]]) add('Masa daveti', `${target} farklı oyuncuya masa daveti gönder`, 'table_invite', points, { target })

  for (const [target, points] of [[30, 450], [90, 1000], [180, 1800]]) add('Üyelik', `Alkanka’ya ${target} farklı günde giriş yap`, 'login_days', points, { target })
  for (const [target, points] of [[30, 500], [90, 1100]]) add('Üyelik', `Alkanka uygulamasına ${target} farklı günde giriş yap`, 'app_login', points, { target })
  add('Üyelik', 'Profilini tamamla ve Alkanka’ya 30 farklı günde giriş yap', 'bundle', 500, { parts: [all('profile'), all('login_days', 30)] })

  add('Topluluk', 'Jako Çemberi’ne katıl ve Alkanka’ya 90 farklı günde giriş yap', 'bundle', 1100, { parts: [all('cember_join'), all('login_days', 90)] })
  add('Topluluk', 'Alkanka’ya 30 farklı gün giriş yap ve site sohbetinde 150 mesaj paylaş', 'bundle', 600, { parts: [all('login_days', 30), all('chat_message', 150)] })
  add('Topluluk', 'Alkanka’ya 90 farklı gün giriş yap ve site sohbetinde 500 mesaj paylaş', 'bundle', 1300, { parts: [all('login_days', 90), all('chat_message', 500)] })
  add('Topluluk', '60 farklı gün giriş yap ve deneyim yaşadığın bir siteyi Güven Merkezi’nde değerlendir', 'bundle', 900, { parts: [all('login_days', 60), all('trust_review')] })
  add('Topluluk', '90 farklı gün giriş yap ve yararlı bulduğun 10 ayrı yorumu işaretle', 'bundle', 1100, { parts: [all('login_days', 90), all('trust_helpful', 10)] })

  add('Sponsor', '30 farklı gün giriş yap ve görevdeki sponsorun sayfasını ziyaret et', 'bundle', 500, { parts: [all('login_days', 30), all('sponsor_visit')] })
  add('Sponsor', 'Sponsor hesabını Alkanka’ya bağla ve oyunlarda toplam 500 tur tamamla', 'bundle', 1000, { parts: [all('sponsor_link'), all('game_play', 500, NINE_GAMES)] })

  const codes = [1, 2, 3, 4, 5, 6].map((week) => {
    const code = task({
      key: `kod-${week}`, group: 'Etkinlik', title: `${week}. etkinlik kodu`, detail: 'Etkinlikte paylaşılan gizli kodu buraya yaz.', kind: 'secret_code', period: 'once',
      points: 40, startsAt: startOf(start), active: false, note: 'Etkinlik haftasında kodu yazıp yayına al.',
    })
    out.push(code)
    return code.key
  })
  add('Etkinlik', 'Altı ayrı haftada düzenlenen altı etkinliğin gizli kodlarını topla', 'bundle', 600, {
    parts: codes.map((ref) => ({ ref })), active: false, note: 'İlk etkinlik kodu yayına girince bunu da yayına al.',
  })

  add('Süper görev', 'Oyunlarda 1.000 galibiyete ulaş ve 100 farklı turnuvaya katıl', 'bundle', 2500, { parts: [all('game_win', 1000, NINE_GAMES), all('tournament_join', 100)] })
  add('Süper görev', '150 doğru maç tahmini yap ve KankaTV’de 50 gol tahminini doğru bil', 'bundle', 1000, { parts: [all('predict_correct', 150), all('tv_predict', 50)] })
  return out
}

/** Every task of the sheet, fitted to the day the calendar starts (a Turkey date, YYYY-MM-DD). */
export function buildPlan(start: string): PlanTask[] {
  return [...dailyPlan(start), ...weeklyPlan(start), ...monthlyPlan(start), ...oncePlan(start)]
}
