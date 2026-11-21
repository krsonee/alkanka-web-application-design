/**
 * "Gol Yağmuru" (gol başı ödül) events: every goal pays a fixed reward.
 * Alkanka events: the member backs one team and is paid in KC for each goal it scores.
 * Sponsor events: the member bets at the sponsor, enters the coupon number, and every goal of the match counts.
 * Kept apart from the prediction league: its own tables, its own rules, nothing shared but the page.
 */
import { TASK_GAMES } from './task-kinds'
import { TR_TZ } from './tr-time'

export const GOAL_NAME = 'Gol Yağmuru'

export type GoalCategory = 'alkanka' | 'sponsor'
export type GoalSide = 'home' | 'away'
/**
 * What an entry counts. Nobody picks a team any more: every entry counts all goals of the match.
 * Entries saved while Alkanka events still asked for a team keep that team and are paid as promised.
 */
export type GoalPickSide = GoalSide | 'all'
export type GoalStatus = 'open' | 'settled' | 'void'
/**
 * Sponsor events: whether staff found the coupon valid.
 * Alkanka events with a condition: whether the member met it on the match day.
 */
export type GoalApproval = 'pending' | 'approved' | 'rejected'

export const GOAL_CATEGORIES: { id: GoalCategory; label: string; hint: string }[] = [
  { id: 'alkanka', label: 'Alkanka etkinlikleri', hint: "Maça katıl, maç günü Alkanka'daki şartı tamamla; maçtaki her gol KC olarak hesabına yatsın." },
  { id: 'sponsor', label: 'Sponsor etkinlikleri', hint: 'Sponsorda bahsini al, kupon numaranı gir; maçtaki her gol ödül kazandırır.' },
]

export const GOAL_MAX_PER_GOAL = 10_000
export const GOAL_MAX_GOALS = 30
export const GOAL_KC_UNIT = 'KC'
export const GOAL_MAX_FEE = 100_000
export const GOAL_MAX_RULES = 3
/** From this many invalid requests on, the panel calls a member a repeat offender. */
export const GOAL_REPEAT_AT = 3

// --- Conditions of an Alkanka event ---------------------------------------

export type GoalRuleKind = 'play' | 'win' | 'minutes' | 'task'
/** `game` is empty for "any game", and always empty for a condition that is not about a game. */
export type GoalRule = { kind: GoalRuleKind; game: string; amount: number }
export type GoalRuleMode = 'all' | 'any'

export const GOAL_RULE_KINDS: { id: GoalRuleKind; label: string; unit: string; min: number; max: number; hint: string }[] = [
  { id: 'play', label: 'Oyun oyna', unit: 'maç', min: 1, max: 50, hint: 'Maç günü bitirilen masa ve bot maçları sayılır. İade edilen maç sayılmaz.' },
  { id: 'win', label: 'Oyun kazan', unit: 'galibiyet', min: 1, max: 50, hint: 'Maç günü kazanılan maçlar sayılır.' },
  { id: 'minutes', label: 'Oyunda vakit geçir', unit: 'dakika', min: 5, max: 600, hint: 'Oyun sayfası açık ve ekrandayken geçen her dakika sayılır. 60 dakika = 1 saat.' },
  { id: 'task', label: 'Görev tamamla', unit: 'görev', min: 1, max: 20, hint: 'Maç günü Görevler sayfasında tamamlanıp ödülü alınan görevler sayılır. Onayı elle verilen görev, onay gün bitmeden verilirse sayılır.' },
]

/** A condition about tasks has no game to choose. */
export const goalRuleHasGame = (kind: GoalRuleKind) => kind !== 'task'

/** What a member reads on an Alkanka event that was left without a condition. */
export const GOAL_NO_RULE = 'Bu etkinliğin şartı henüz belirlenmedi; katılım şart eklenince açılır.'

const RULE_KIND = new Map(GOAL_RULE_KINDS.map((k) => [k.id, k]))
const GAME_LABEL = new Map(TASK_GAMES.map((g) => [g.value, g.label]))

export const isGoalRuleKind = (v: unknown): v is GoalRuleKind => v === 'play' || v === 'win' || v === 'minutes' || v === 'task'

export function goalMinutesText(minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h === 0 ? `${m} dakika` : m === 0 ? `${h} saat` : `${h} saat ${m} dakika`
}

/** One condition as the member reads it. */
export function goalRuleText(r: GoalRule) {
  if (r.kind === 'task') return `Görevler sayfasından en az ${r.amount} görev tamamla`
  const where = r.game ? `${GAME_LABEL.get(r.game) ?? r.game} oyununda` : 'Herhangi bir oyunda'
  if (r.kind === 'minutes') return `${where} en az ${goalMinutesText(r.amount)} vakit geçir`
  return `${where} en az ${r.amount} maç ${r.kind === 'win' ? 'kazan' : 'oyna'}`
}

/** How far the member is on one condition: "2/3 maç". */
export function goalRuleProgress(r: GoalRule, done: number) {
  const unit = RULE_KIND.get(r.kind)?.unit ?? ''
  return `${Math.min(done, r.amount).toLocaleString('tr-TR')}/${r.amount.toLocaleString('tr-TR')} ${unit}`
}

/** Keeps only well-formed conditions; what the database or a form hands over is never trusted as is. */
export function cleanGoalRules(input: unknown): GoalRule[] {
  const out: GoalRule[] = []
  for (const raw of Array.isArray(input) ? input : []) {
    const x = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
    const kind = RULE_KIND.get(x.kind as GoalRuleKind)
    const amount = Number(x.amount)
    const game = kind && goalRuleHasGame(kind.id) && typeof x.game === 'string' && GAME_LABEL.has(x.game) ? x.game : ''
    if (!kind || !Number.isInteger(amount) || amount < kind.min || amount > kind.max) continue
    if (out.some((r) => r.kind === kind.id && r.game === game)) continue
    out.push({ kind: kind.id, game, amount })
    if (out.length === GOAL_MAX_RULES) break
  }
  return out
}

/** Whether what the member did on the match day satisfies the event. No condition is always satisfied. */
export function goalRulesMet(rules: GoalRule[], mode: GoalRuleMode, done: number[]) {
  if (rules.length === 0) return true
  const hits = rules.map((r, i) => (done[i] ?? 0) >= r.amount)
  return mode === 'any' ? hits.some(Boolean) : hits.every(Boolean)
}

// --- Events ---------------------------------------------------------------

export type GoalEventInput = {
  id?: number | null
  title: string
  category: GoalCategory
  perGoal: number
  /** What a sponsor hands out per goal, in its own words: "freebet", "freespin". Always KC for Alkanka events. */
  unit: string
  siteId: number | null
  /** The member must have joined the sponsor through our link. */
  viaLink: boolean
  /** Smallest bet the sponsor asks for, as it should read on the card: "100 TL". Empty when there is none. */
  minBet: string
  /** Sponsor: the member must have made a deposit at the sponsor on the match day. */
  needDeposit: boolean
  /** Sponsor: lowest odds the pre-match bet may have; 0 when there is no limit. */
  minOdds: number
  /** Alkanka: KC taken when the member joins a match; 0 when joining is free. */
  entryFee: number
  /** Alkanka: what the member has to do on the match day before the reward is paid. At least one is required. */
  rules: GoalRule[]
  ruleMode: GoalRuleMode
  terms: string
  active: boolean
}

export type GoalEvent = Omit<GoalEventInput, 'id'> & { id: number; siteName: string | null; siteSlug: string | null; createdAt: string }

export type GoalMyPick = {
  side: GoalPickSide
  siteUsername: string | null
  coupon: string | null
  approval: GoalApproval
  rejectReason: string | null
  goals: number | null
  reward: number | null
  paid: boolean
  fee: number
  feeRefunded: boolean
  /** Alkanka events with conditions: how much of each the member has done on the match day, in the order of `rules`. */
  progress: number[] | null
}

export type GoalMatch = {
  id: number
  eventId: number
  league: string
  home: string
  away: string
  homeLogo: string | null
  awayLogo: string | null
  extId: number | null
  kickoff: string
  status: GoalStatus
  homeGoals: number | null
  awayGoals: number | null
  /** Fixed when the match is added, so a later change to the event never rewrites a promise already made. */
  perGoal: number
  homePicks: number
  awayPicks: number
  /** Everyone who joined, sponsor coupons included. */
  picks: number
  myPick: GoalMyPick | null
}

export type GoalEventView = GoalEvent & { matches: GoalMatch[] }

export type GoalFlagState = 'warned' | 'blocked'

/** What the page needs to know about the member looking at it. */
export type GoalMe = {
  /** Sponsor accounts the member linked, by the sponsor's slug. */
  accounts: Record<string, { username: string; status: GoalApproval }>
  flag: { state: GoalFlagState; note: string } | null
}

export type GoalPickRow = {
  userId: string
  userName: string
  side: GoalPickSide
  siteUsername: string | null
  coupon: string | null
  approval: GoalApproval
  rejectReason: string | null
  goals: number | null
  reward: number | null
  paid: boolean
  payError: string | null
  fee: number
  feeRefunded: boolean
  at: string
  /** How this member has behaved in sponsor events so far. */
  invalid: number
  flag: GoalFlagState | null
  warns: number
}

/** One member in the panel's list of invalid requests. */
export type GoalFlagRow = {
  userId: string
  userName: string
  state: GoalFlagState | null
  warns: number
  note: string
  /** Sponsor requests found invalid, and all sponsor requests the member ever sent. */
  invalid: number
  total: number
  lastReason: string | null
  lastAt: string | null
  updatedBy: string | null
  updatedAt: string | null
}

export type GoalFlagAction = 'warn' | 'block' | 'open'

export const isGoalCategory = (v: unknown): v is GoalCategory => v === 'alkanka' || v === 'sponsor'
export const isGoalApproval = (v: unknown): v is GoalApproval => v === 'pending' || v === 'approved' || v === 'rejected'
export const isGoalFlagAction = (v: unknown): v is GoalFlagAction => v === 'warn' || v === 'block' || v === 'open'

/** Why a sponsor request is refused; staff picks one or writes their own. */
export const GOAL_REJECT_REASONS = [
  'Kupon bulunamadı',
  'Kupon bu maça ait değil',
  'Oran şartın altında',
  'Bahis maç başladıktan sonra alınmış',
  'Maç günü yatırım yok',
  'En az bahis tutarı sağlanmadı',
  'Hesap Alkanka linkiyle açılmamış',
  'Kullanıcı adı sponsor hesabıyla uyuşmuyor',
]

export const GOAL_RULE_MISSED = 'Şart maç günü tamamlanmadı'

/** The tag a member carries in the panel, from the mildest to the heaviest. */
export function goalTag(m: { state: GoalFlagState | null; warns: number; invalid: number }): { label: string; tone: 'bad' | 'warn' | 'plain' | 'good' } {
  if (m.state === 'blocked') return { label: 'Katılımı kapalı', tone: 'bad' }
  if (m.state === 'warned') return { label: m.warns > 1 ? `${m.warns} kez uyarıldı` : 'Uyarıldı', tone: 'warn' }
  if (m.invalid >= GOAL_REPEAT_AT) return { label: `Tekrarlayan geçersiz talep (${m.invalid})`, tone: 'warn' }
  if (m.invalid > 0) return { label: `${m.invalid} geçersiz talep`, tone: 'plain' }
  return { label: 'Temiz', tone: 'good' }
}

const text = (v: unknown, max: number) =>
  String(v ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)

/** "1,8", "1.80" or 1.8 as a number with two decimals; NaN when it is not a number. */
export function parseOdds(v: unknown) {
  if (v === null || v === undefined || v === '') return 0
  const n = typeof v === 'number' ? v : Number(String(v).trim().replace(',', '.'))
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : Number.NaN
}

export const oddsText = (odds: number) => odds.toFixed(2).replace('.', ',')

/** Checks an event before it is saved; the cleaned copy is what gets stored. */
export function checkGoalEvent(input: unknown): { ok: true; value: GoalEventInput } | { ok: false; error: string } {
  const raw = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  if (!isGoalCategory(raw.category)) return { ok: false, error: 'Etkinlik türünü seç: Alkanka ya da sponsor.' }
  const sponsor = raw.category === 'sponsor'
  const title = text(raw.title, 80)
  if (title.length < 3) return { ok: false, error: 'Etkinliğe en az 3 harfli bir ad ver.' }
  const perGoal = Number(raw.perGoal)
  if (!Number.isInteger(perGoal) || perGoal < 1 || perGoal > GOAL_MAX_PER_GOAL) {
    return { ok: false, error: `Gol başı ödül 1 ile ${GOAL_MAX_PER_GOAL.toLocaleString('tr-TR')} arasında tam sayı olmalı.` }
  }
  const unit = sponsor ? text(raw.unit, 24) : GOAL_KC_UNIT
  if (sponsor && unit.length < 2) return { ok: false, error: 'Sponsorun verdiği ödülün adını yaz: freebet, freespin gibi.' }
  const siteId = sponsor ? Number(raw.siteId) : null
  if (sponsor && (!Number.isSafeInteger(siteId) || (siteId as number) <= 0)) return { ok: false, error: 'Etkinliğin sponsorunu seç.' }
  const viaLink = sponsor && Boolean(raw.viaLink)
  const minBet = sponsor ? text(raw.minBet, 40) : ''
  const needDeposit = sponsor && Boolean(raw.needDeposit)
  const minOdds = sponsor ? parseOdds(raw.minOdds) : 0
  if (Number.isNaN(minOdds) || (minOdds !== 0 && (minOdds < 1.01 || minOdds > 50))) {
    return { ok: false, error: 'En düşük oran 1,01 ile 50 arasında olmalı. Oran şartı yoksa alanı boş bırak.' }
  }

  const entryFee = sponsor ? 0 : Number(raw.entryFee ?? 0)
  if (!Number.isInteger(entryFee) || entryFee < 0 || entryFee > GOAL_MAX_FEE) {
    return { ok: false, error: `Katılım ücreti 0 ile ${GOAL_MAX_FEE.toLocaleString('tr-TR')} KC arasında tam sayı olmalı. Ücretsizse 0 yaz.` }
  }
  const asked = sponsor || !Array.isArray(raw.rules) ? [] : raw.rules
  if (asked.length > GOAL_MAX_RULES) return { ok: false, error: `En fazla ${GOAL_MAX_RULES} şart eklenebilir.` }
  const rules = cleanGoalRules(asked)
  if (rules.length !== asked.length) {
    return { ok: false, error: 'Şartlardan biri eksik ya da aynı şart iki kez eklenmiş. Maç sayısı 1-50, süre 5-600 dakika, görev sayısı 1-20 arasında olmalı.' }
  }
  // Without a condition every goal would pay whoever pressed a button; the event is about doing something on Alkanka.
  if (!sponsor && rules.length === 0) {
    return { ok: false, error: "En az bir şart ekle: üye ödülü, maç günü Alkanka'da bu şartı tamamlayınca alır. Şartı sistem kendisi kontrol eder." }
  }
  const ruleMode: GoalRuleMode = raw.ruleMode === 'any' && rules.length > 1 ? 'any' : 'all'

  const terms = String(raw.terms ?? '')
    .replace(/[ \t]+/g, ' ')
    .trim()
    .slice(0, 600)
  const id = raw.id === null || raw.id === undefined || raw.id === '' ? null : Number(raw.id)
  if (id !== null && (!Number.isSafeInteger(id) || id <= 0)) return { ok: false, error: 'Etkinlik bulunamadı.' }
  return {
    ok: true,
    value: { id, title, category: raw.category, perGoal, unit, siteId, viaLink, minBet, needDeposit, minOdds, entryFee, rules, ruleMode, terms, active: raw.active !== false },
  }
}

export function checkGoalScore(home: unknown, away: unknown): { ok: true; home: number; away: number } | { ok: false; error: string } {
  const h = Number(home)
  const a = Number(away)
  const fine = (n: number) => Number.isInteger(n) && n >= 0 && n <= GOAL_MAX_GOALS
  if (home === '' || away === '' || home === null || away === null || !fine(h) || !fine(a)) {
    return { ok: false, error: `Skoru gir: iki takım için de 0 ile ${GOAL_MAX_GOALS} arasında bir sayı.` }
  }
  return { ok: true, home: h, away: a }
}

/** A coupon number as the member typed it, without the spaces. */
export function checkCoupon(v: unknown): { ok: true; value: string } | { ok: false; error: string } {
  const value = String(v ?? '')
    .replace(/\s+/g, '')
    .slice(0, 40)
  if (value.length < 4) return { ok: false, error: 'Kupon numaranı yaz: en az 4 karakter.' }
  if (!/^[A-Za-z0-9\-_./#]+$/.test(value)) return { ok: false, error: 'Kupon numarasında sadece harf, rakam ve - _ . / # olabilir.' }
  return { ok: true, value }
}

export const goalsFor = (side: GoalPickSide, home: number, away: number) => (side === 'home' ? home : side === 'away' ? away : home + away)

export function goalReward(perGoal: number, goals: number) {
  if (!Number.isInteger(perGoal) || !Number.isInteger(goals) || perGoal <= 0 || goals <= 0) return 0
  return perGoal * Math.min(goals, GOAL_MAX_GOALS * 2)
}

export const goalAmount = (amount: number, unit: string) => `${amount.toLocaleString('tr-TR')} ${unit}`

type RuleSource = Pick<GoalEvent, 'category' | 'perGoal' | 'unit' | 'viaLink' | 'minBet' | 'needDeposit' | 'minOdds' | 'entryFee' | 'rules' | 'ruleMode' | 'terms' | 'siteName'>

/** The whole rule box of an event, written for the member: how to join, what pays, what voids it. */
export function goalRuleLines(e: RuleSource): string[] {
  const reward = goalAmount(e.perGoal, e.unit)
  const out: string[] = []
  if (e.category === 'sponsor') {
    const site = e.siteName ?? 'Sponsor'
    out.push(`${site} hesabını Alkanka'ya bağla. Kullanıcı adın talebine kendiliğinden eklenir, ödül o hesaba tanımlanır.`)
    if (e.viaLink) out.push(`${site} üyeliğini Alkanka linkiyle açmış olmalısın.`)
    if (e.needDeposit) out.push(`Maçın oynandığı gün ${site} hesabına yatırım yapmış olmalısın.`)
    const limits = [e.minOdds ? `en az ${oddsText(e.minOdds)} oranla` : '', e.minBet ? `en az ${e.minBet} tutarında` : ''].filter(Boolean).join(' ve ')
    out.push(`Listedeki maça ${site} sitesinde, maç başlamadan önce${limits ? ` ${limits}` : ''} bahis al. Canlı (maç başladıktan sonra alınan) bahis sayılmaz.`)
    out.push('Bahsini aldıktan sonra maçın kartına kupon numaranı yaz ve kaydet. Kupon numarası maç başlayana kadar girilir.')
    out.push(`Taraf seçmen gerekmez: maçta atılan her gol ${reward} kazandırır.`)
    out.push('Şartlara uymayan talep geçersiz sayılır. Geçersiz talep tekrarlanırsa önce uyarı verilir, sonra sponsor etkinliklerine katılımın kapatılır.')
  } else {
    out.push('Maç başlamadan maçın kartındaki "Maça katıl" düğmesine bas. Takım seçmen gerekmez; katılım maç başlayınca kapanır.')
    out.push(`Maçta atılan her gol ${reward} kazandırır, hangi takım atarsa atsın. Uzatmaya giden maçta 90 dakikanın skoru sayılır.`)
    if (e.entryFee > 0) out.push(`Katılım ${goalAmount(e.entryFee, GOAL_KC_UNIT)}: katılırken bakiyenden düşer. Maç iptal edilirse geri yatar; maçta gol olmazsa ya da şartı tamamlamazsan geri verilmez.`)
    if (e.rules.length > 0) {
      const which = e.rules.length === 1 ? 'şu şartı' : e.ruleMode === 'any' ? 'şu şartlardan birini' : 'şu şartların hepsini'
      out.push(`Ödülü alabilmek için maçın oynandığı gün (Türkiye saatiyle 00:00 - 23:59) Alkanka'da ${which} tamamla: ${e.rules.map(goalRuleText).join('; ')}.`)
      out.push('Şartı sistem kendisi sayar; bir şey göndermen gerekmez. Tamamlanınca ödül kendiliğinden yatar. Gün bitene kadar tamamlanmazsa o maçın ödülü verilmez.')
    } else {
      out.push(GOAL_NO_RULE)
    }
  }
  if (e.terms) out.push(e.terms)
  return out
}

export function goalStatusLabel(m: Pick<GoalMatch, 'status' | 'kickoff'>, now: number) {
  if (m.status === 'void') return 'İptal edildi'
  if (m.status === 'settled') return 'Sonuçlandı'
  return Date.parse(m.kickoff) > now ? 'Katılıma açık' : 'Sonuç bekleniyor'
}

export const GOAL_APPROVAL_LABEL: Record<GoalApproval, string> = { pending: 'Kontrol bekliyor', approved: 'Geçerli', rejected: 'Geçersiz' }

type PickState = Pick<GoalPickRow, 'reward' | 'paid' | 'payError' | 'approval' | 'fee' | 'feeRefunded'>

/**
 * Where one pick stands, in the words the panel and the Excel file both use. A payment marked as failed
 * is never called paid, and a member whose request was refused is not waiting for a delivery.
 */
export function goalPickState(p: PickState, sponsor: boolean, status: GoalStatus): string {
  if (status === 'void') return p.fee > 0 ? (p.feeRefunded ? 'İptal, katılım iade edildi' : 'İptal, iade sırada') : 'İptal'
  if (sponsor && p.approval === 'rejected') return 'Geçersiz talep'
  if (p.reward === null) return sponsor ? (p.approval === 'approved' ? 'Kupon geçerli, sonuç bekleniyor' : 'Kupon kontrolü bekliyor') : 'Sonuç bekleniyor'
  if (p.reward === 0) return 'Ödül yok'
  if (!sponsor) {
    if (p.payError) return 'Yazılamadı'
    if (p.paid) return 'Ödendi'
    return p.approval === 'rejected' ? 'Şart tamamlanmadı' : p.approval === 'pending' ? 'Şart bekleniyor' : 'Sırada'
  }
  if (p.paid) return 'Teslim edildi'
  return p.approval === 'approved' ? 'Teslim bekliyor' : 'Kupon kontrolü bekliyor'
}

/** What a match owes and what has really gone out. Refused picks and failed payments count as neither. */
export function goalPickTotals(picks: GoalPickRow[], sponsor: boolean) {
  const sum = (list: GoalPickRow[]) => list.reduce((s, p) => s + (p.reward ?? 0), 0)
  const owed = picks.filter((p) => (p.reward ?? 0) > 0 && p.approval !== 'rejected')
  return {
    owed: sum(owed),
    done: sum(owed.filter((p) => p.paid && !p.payError)),
    refused: sum(picks.filter((p) => p.approval === 'rejected')),
    failed: picks.filter((p) => !sponsor && p.payError).length,
    /** Alkanka picks still waiting for the member to meet the condition. */
    waiting: picks.filter((p) => !sponsor && (p.reward ?? 0) > 0 && !p.paid && !p.payError && p.approval === 'pending').length,
    fees: picks.reduce((s, p) => s + (p.feeRefunded ? 0 : p.fee), 0),
  }
}

/** Which goals an entry counts; only entries from before sides were dropped name a team. */
export const goalSideName = (side: GoalPickSide, m: Pick<GoalMatch, 'home' | 'away'>) =>
  side === 'home' ? `Sadece ${m.home} (eski seçim)` : side === 'away' ? `Sadece ${m.away} (eski seçim)` : 'Maçın bütün golleri'

function cell(value: string | number | null) {
  let out = value === null ? '' : String(value)
  // A cell starting with = + - @ runs as a formula in Excel.
  if (/^[=+\-@\t\r]/.test(out)) out = `'${out}`
  return `"${out.replace(/"/g, '""')}"`
}

/** Semicolon separated with a BOM: opens in Turkish Excel with the right columns and letters. */
export function goalPicksCsv(match: Pick<GoalMatch, 'home' | 'away' | 'status'>, unit: string, sponsor: boolean, picks: GoalPickRow[]) {
  const head = [
    'Üye',
    ...(sponsor ? ['Sponsordaki kullanıcı adı', 'Kupon numarası', 'Talep', 'Geçersizlik nedeni', 'Üye etiketi'] : ['Sayılan goller', 'Katılım ücreti (KC)']),
    'Gol',
    `Ödül (${unit})`,
    sponsor ? 'Teslim' : 'Ödeme',
    'Kayıt zamanı (Türkiye saati)',
  ]
  const lines = picks.map((p) =>
    [
      p.userName,
      ...(sponsor ? [p.siteUsername, p.coupon, GOAL_APPROVAL_LABEL[p.approval], p.rejectReason, goalTag({ state: p.flag, warns: p.warns, invalid: p.invalid }).label] : [goalSideName(p.side, match), p.fee]),
      p.goals,
      p.reward,
      goalPickState(p, sponsor, match.status),
      new Date(p.at).toLocaleString('tr-TR', { timeZone: TR_TZ }),
    ]
      .map(cell)
      .join(';'),
  )
  return `\uFEFF${[head.map(cell).join(';'), ...lines].join('\r\n')}`
}
