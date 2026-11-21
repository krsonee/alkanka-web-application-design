/** Everything the site, the panel and the server agree on about the prediction league. No server imports. */

export const SPORT_IDS = ['football', 'basketball', 'volleyball', 'tennis', 'esports'] as const
export type Sport = (typeof SPORT_IDS)[number]

/** Every question the league knows, in the order they are asked. A sport only ever uses its own subset. */
export const MARKET_IDS = [
  'side',
  'winner',
  'score',
  'setScore',
  'mapScore',
  'goals',
  'points',
  'margin',
  'parity',
  'sets',
  'maps',
  'btts',
  'half',
  'firstSet',
  'firstMap',
  'corners',
  'cards',
] as const
export type MarketId = (typeof MARKET_IDS)[number]

export type Coin = 'kc' | 'kp'

export type MarketRule = {
  /** League points for a correct answer. */
  pts: number
  coin: Coin
  amount: number
  /** Over/under threshold, always x.5 so an answer is never a push. */
  line?: number
  /** Score questions only: what a wrong score on the right side still earns. */
  nearPts?: number
  nearAmount?: number
  /** Set and map score only: how many sets or maps the match is played over, copied from the set. */
  bestOf?: number
}

export type PrizeKind = 'kc' | 'kp' | 'market' | 'cash'

/** `ref`/`name` point at the market product or the sponsor site; `amount` is KC, KP or TL. */
export type Prize = { kind: PrizeKind; amount: number; ref: string; name: string }

export type QuestionSet = {
  /** Left out for football, so sets saved before other sports existed read the same. */
  sport?: Sport
  /** Sets or maps the match is played over; only for sports decided that way. */
  bestOf?: number
  markets: Partial<Record<MarketId, MarketRule>>
  /** Paid on top when every question of the match is answered correctly. */
  bonus: { pts: number; prize: Prize | null } | null
}

export type Answers = Partial<Record<MarketId, string>>

export type MatchResult = {
  /** Goals, points, sets or maps, depending on the sport. */
  home: number
  away: number
  /** Null means the figure is unknown, which cancels the question that needs it. */
  htHome: number | null
  htAway: number | null
  corners: number | null
  cards: number | null
  /** Who took the first set or map. */
  first?: '1' | '2' | null
}

export type Outcome = 'hit' | 'near' | 'miss' | 'void'

export type Grade = {
  outcomes: Partial<Record<MarketId, Outcome>>
  pts: number
  kc: number
  kp: number
  exact: boolean
  bonus: boolean
}

export type LineSpec = { def: number; min: number; max: number }

export type ResultNeed = 'half' | 'corners' | 'cards' | 'first'

export const MARKETS: Record<MarketId, { label: string; short: string; ask: string; line?: LineSpec; needs?: ResultNeed; series?: boolean }> = {
  side: { label: 'Maç sonucu', short: 'Taraf', ask: 'Maçı kim kazanır?' },
  winner: { label: 'Kazanan', short: 'Kazanan', ask: 'Maçı kim kazanır?' },
  score: { label: 'Tam skor', short: 'Skor', ask: 'Maç kaç kaç biter?' },
  setScore: { label: 'Set skoru', short: 'Set', ask: 'Maç setlerde kaç kaç biter?', series: true },
  mapScore: { label: 'Harita skoru', short: 'Harita', ask: 'Seri haritalarda kaç kaç biter?', series: true },
  goals: { label: 'Toplam gol', short: 'Gol', ask: 'Toplam gol sayısı', line: { def: 2.5, min: 0.5, max: 6.5 } },
  points: { label: 'Toplam sayı', short: 'Sayı', ask: 'İki takımın toplam sayısı', line: { def: 160.5, min: 100.5, max: 300.5 } },
  margin: { label: 'Sayı farkı', short: 'Fark', ask: 'Kazanan kaç sayı farkla kazanır?', line: { def: 9.5, min: 0.5, max: 40.5 } },
  parity: { label: 'Tek / çift', short: 'Tek/çift', ask: 'İki takımın toplam sayısı tek mi, çift mi?' },
  sets: { label: 'Toplam set', short: 'Set sayısı', ask: 'Maç toplam kaç set sürer?', line: { def: 3.5, min: 2.5, max: 4.5 } },
  maps: { label: 'Toplam harita', short: 'Harita sayısı', ask: 'Seri toplam kaç harita sürer?', line: { def: 2.5, min: 2.5, max: 6.5 } },
  btts: { label: 'Karşılıklı gol', short: 'KG', ask: 'İki takım da gol atar mı?' },
  half: { label: 'İlk yarı sonucu', short: 'İlk yarı', ask: 'İlk yarıyı kim önde kapatır?', needs: 'half' },
  firstSet: { label: 'İlk set', short: 'İlk set', ask: 'İlk seti kim alır?', needs: 'first' },
  firstMap: { label: 'İlk harita', short: 'İlk harita', ask: 'İlk haritayı kim alır?', needs: 'first' },
  corners: { label: 'Korner', short: 'Korner', ask: 'Toplam korner sayısı', line: { def: 9.5, min: 4.5, max: 15.5 }, needs: 'corners' },
  cards: { label: 'Kart', short: 'Kart', ask: 'Toplam kart sayısı (sarı + kırmızı)', line: { def: 4.5, min: 0.5, max: 10.5 }, needs: 'cards' },
}

export type SportInfo = {
  label: string
  /** The questions this sport can ask. */
  markets: MarketId[]
  /** The highest figure one side can finish on. */
  maxScore: number
  draw: boolean
  /** Match lengths in sets or maps, the usual one first. Empty when the sport is not decided that way. */
  bestOf: number[]
  /** What the result form calls the final figure. */
  scoreLabel: string
  /** The unit of that figure. */
  unit: string
  /** Whether fixtures and results come from the calendar feed; otherwise both are entered by hand. */
  feed: boolean
}

export const SPORTS: Record<Sport, SportInfo> = {
  football: { label: 'Futbol', markets: ['side', 'score', 'goals', 'btts', 'half', 'corners', 'cards'], maxScore: 20, draw: true, bestOf: [], scoreLabel: 'Maç skoru (90 dk)', unit: 'gol', feed: true },
  basketball: { label: 'Basketbol', markets: ['winner', 'points', 'margin', 'parity', 'half'], maxScore: 250, draw: false, bestOf: [], scoreLabel: 'Maç skoru (uzatma dahil)', unit: 'sayı', feed: true },
  volleyball: { label: 'Voleybol', markets: ['winner', 'setScore', 'sets', 'firstSet'], maxScore: 3, draw: false, bestOf: [5], scoreLabel: 'Set skoru', unit: 'set', feed: true },
  tennis: { label: 'Tenis', markets: ['winner', 'setScore', 'sets', 'firstSet'], maxScore: 3, draw: false, bestOf: [3, 5], scoreLabel: 'Set skoru', unit: 'set', feed: true },
  esports: { label: 'E-spor', markets: ['winner', 'mapScore', 'maps', 'firstMap'], maxScore: 4, draw: false, bestOf: [3, 1, 5, 7], scoreLabel: 'Harita skoru', unit: 'harita', feed: false },
}

/** The games an e-sport match can be filed under; the panel can still type another. */
export const ESPORT_GAMES = ['CS2', 'League of Legends', 'Valorant', 'Dota 2'] as const

export const parseSport = (v: unknown): Sport => (SPORT_IDS.includes(v as Sport) ? (v as Sport) : 'football')

export const sportOf = (set: Pick<QuestionSet, 'sport'> | null | undefined): Sport => parseSport(set?.sport)

/** The match length a sport allows, falling back to its usual one. Undefined for sports without sets or maps. */
export function cleanBestOf(sport: Sport, v: unknown): number | undefined {
  const allowed = SPORTS[sport].bestOf
  if (!allowed.length) return undefined
  const n = Number(v)
  return allowed.includes(n) ? n : allowed[0]
}

export const winsNeeded = (bestOf: number) => Math.floor(bestOf / 2) + 1

/** Every way a series can end, home wins first and the clearest win at each end. */
export function seriesScores(bestOf: number): string[] {
  const need = winsNeeded(bestOf)
  const lost = Array.from({ length: need }, (_, i) => i)
  return [...lost.map((n) => `${need}-${n}`), ...lost.reverse().map((n) => `${n}-${need}`)]
}

/** A one-map series has nothing to ask beyond who wins it. */
export function sportMarkets(sport: Sport, bestOf?: number): MarketId[] {
  const ids = SPORTS[sport].markets
  return bestOf === 1 ? ids.filter((id) => id === 'winner') : ids
}

/** The over/under range of a question; a set or map count is bounded by how long the match can run. */
export function lineSpec(id: MarketId, bestOf?: number): LineSpec | undefined {
  const spec = MARKETS[id].line
  if (!spec || (id !== 'sets' && id !== 'maps') || !bestOf || bestOf < 3) return spec
  const min = winsNeeded(bestOf) + 0.5
  return { def: min, min, max: Math.max(min, bestOf - 0.5) }
}

const isScoreLike = (id: MarketId) => id === 'score' || Boolean(MARKETS[id].series)

export const MAX_GOALS = 20
export const MAX_MARKET_POINTS = 10
export const MAX_MARKET_AMOUNT = 100_000
export const MAX_BONUS_POINTS = 20
export const MAX_PRIZE_AMOUNT = 10_000_000
export const MAX_LEAGUE_PLACES = 20
export const MAX_STAT = 60

/** How the league scored before questions could be chosen: the exact score, with a consolation for the right side. */
export const LEGACY_SET: QuestionSet = {
  markets: { score: { pts: 3, coin: 'kc', amount: 150, nearPts: 1, nearAmount: 40 } },
  bonus: null,
}

const int = (v: unknown, min: number, max: number, fallback = min) => {
  const n = Math.round(Number(v))
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback
}

function cleanLine(v: unknown, spec: LineSpec) {
  const n = Number(v)
  if (!Number.isFinite(n)) return spec.def
  const half = Math.floor(n) + 0.5
  return Math.min(spec.max, Math.max(spec.min, half))
}

export function normalizePrize(raw: unknown): Prize | null {
  if (!raw || typeof raw !== 'object') return null
  const p = raw as Partial<Prize>
  const kind = p.kind === 'kp' || p.kind === 'market' || p.kind === 'cash' ? p.kind : p.kind === 'kc' ? 'kc' : null
  if (!kind) return null
  const ref = String(p.ref ?? '').trim().slice(0, 80)
  const name = String(p.name ?? '').trim().slice(0, 120)
  if (kind === 'market') return ref ? { kind, amount: 1, ref, name: name || 'Market ürünü' } : null
  const amount = int(p.amount, 0, MAX_PRIZE_AMOUNT)
  if (amount <= 0) return null
  if (kind === 'cash') return ref ? { kind, amount, ref, name: name || 'Sponsor' } : null
  return { kind, amount, ref: '', name: '' }
}

/** What a question pays when the panel switches it on without touching the figures. */
export const DEFAULT_RULES: Record<MarketId, MarketRule> = {
  side: { pts: 1, coin: 'kc', amount: 40 },
  winner: { pts: 1, coin: 'kc', amount: 40 },
  score: { pts: 3, coin: 'kc', amount: 150, nearPts: 1, nearAmount: 40 },
  setScore: { pts: 3, coin: 'kc', amount: 150, nearPts: 0, nearAmount: 0 },
  mapScore: { pts: 3, coin: 'kc', amount: 150, nearPts: 0, nearAmount: 0 },
  goals: { pts: 1, coin: 'kc', amount: 40, line: 2.5 },
  points: { pts: 1, coin: 'kc', amount: 40, line: 160.5 },
  margin: { pts: 2, coin: 'kc', amount: 60, line: 9.5 },
  parity: { pts: 1, coin: 'kc', amount: 40 },
  sets: { pts: 1, coin: 'kc', amount: 40, line: 3.5 },
  maps: { pts: 1, coin: 'kc', amount: 40, line: 2.5 },
  btts: { pts: 1, coin: 'kc', amount: 40 },
  half: { pts: 1, coin: 'kc', amount: 40 },
  firstSet: { pts: 1, coin: 'kc', amount: 40 },
  firstMap: { pts: 1, coin: 'kc', amount: 40 },
  corners: { pts: 2, coin: 'kc', amount: 60, line: 9.5 },
  cards: { pts: 2, coin: 'kc', amount: 60, line: 4.5 },
}

const sportTag = (sport: Sport, bestOf: number | undefined): Pick<QuestionSet, 'sport' | 'bestOf'> =>
  sport === 'football' ? {} : bestOf ? { sport, bestOf } : { sport }

/** A question's rule fitted to the match: its line inside the allowed range, the series length copied in. */
function fitRule(id: MarketId, rule: MarketRule, bestOf: number | undefined): MarketRule {
  const out: MarketRule = { pts: rule.pts, coin: rule.coin, amount: rule.amount }
  const spec = lineSpec(id, bestOf)
  if (spec) out.line = cleanLine(rule.line, spec)
  if (isScoreLike(id)) {
    out.nearPts = rule.nearPts ?? 0
    out.nearAmount = rule.nearAmount ?? 0
  }
  if (MARKETS[id].series && bestOf) out.bestOf = bestOf
  return out
}

/** The questions a match of this sport starts with: who wins, plus the sport's headline question. */
export function defaultSet(sport: Sport, length?: number): QuestionSet {
  if (sport === 'football') return LEGACY_SET
  const bestOf = cleanBestOf(sport, length)
  const markets: QuestionSet['markets'] = {}
  for (const id of sportMarkets(sport, bestOf).slice(0, 2)) markets[id] = fitRule(id, DEFAULT_RULES[id], bestOf)
  return { ...sportTag(sport, bestOf), markets, bonus: null }
}

export function normalizeSet(raw: unknown): QuestionSet {
  const input = (raw && typeof raw === 'object' ? raw : {}) as Partial<QuestionSet>
  const sport = parseSport(input.sport)
  const bestOf = cleanBestOf(sport, input.bestOf)
  const allowed = sportMarkets(sport, bestOf)
  const markets: QuestionSet['markets'] = {}
  for (const id of MARKET_IDS) {
    const r = input.markets?.[id]
    if (!r || typeof r !== 'object' || !allowed.includes(id)) continue
    markets[id] = fitRule(
      id,
      {
        pts: int(r.pts, 0, MAX_MARKET_POINTS),
        coin: r.coin === 'kp' ? 'kp' : 'kc',
        amount: int(r.amount, 0, MAX_MARKET_AMOUNT),
        line: r.line,
        nearPts: int(r.nearPts, 0, MAX_MARKET_POINTS),
        nearAmount: int(r.nearAmount, 0, MAX_MARKET_AMOUNT),
      },
      bestOf,
    )
  }
  if (!marketList({ markets, bonus: null }).length) return defaultSet(sport, bestOf)
  const b = input.bonus
  const bonus =
    b && typeof b === 'object' && marketList({ markets, bonus: null }).length > 1
      ? { pts: int(b.pts, 0, MAX_BONUS_POINTS), prize: normalizePrize(b.prize) }
      : null
  return { ...sportTag(sport, bestOf), markets, bonus: bonus && (bonus.pts > 0 || bonus.prize) ? bonus : null }
}

/** The questions of a match, in the order they are asked. */
export function marketList(set: QuestionSet): MarketId[] {
  return MARKET_IDS.filter((id) => set.markets[id])
}

export type Teams = { home: string; away: string }

export type Option = { value: string; label: string }

export function marketOptions(id: MarketId, teams: Teams, rule: MarketRule | undefined): Option[] {
  if (id === 'side' || id === 'half') {
    return [
      { value: '1', label: teams.home },
      { value: 'X', label: 'Berabere' },
      { value: '2', label: teams.away },
    ]
  }
  if (id === 'winner' || id === 'firstSet' || id === 'firstMap') {
    return [
      { value: '1', label: teams.home },
      { value: '2', label: teams.away },
    ]
  }
  if (id === 'btts') {
    return [
      { value: 'var', label: 'Var' },
      { value: 'yok', label: 'Yok' },
    ]
  }
  if (id === 'parity') {
    return [
      { value: 'tek', label: 'Tek' },
      { value: 'cift', label: 'Çift' },
    ]
  }
  if (id === 'score') return []
  if (MARKETS[id].series) return seriesScores(rule?.bestOf ?? 3).map((value) => ({ value, label: value.replace('-', ' - ') }))
  const line = lineText(rule?.line ?? MARKETS[id].line!.def)
  return [
    { value: 'alt', label: `${line} Alt` },
    { value: 'ust', label: `${line} Üst` },
  ]
}

export const lineText = (line: number) => line.toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

/** The question as the member reads it, with its line when it has one. */
export function marketTitle(id: MarketId, rule: MarketRule | undefined) {
  return MARKETS[id].line ? `${MARKETS[id].label} ${lineText(rule?.line ?? MARKETS[id].line!.def)}` : MARKETS[id].label
}

export function parseScore(value: string | undefined | null): [number, number] | null {
  const m = /^(\d{1,2})-(\d{1,2})$/.exec(String(value ?? ''))
  if (!m) return null
  const h = Number(m[1])
  const a = Number(m[2])
  return h <= MAX_GOALS && a <= MAX_GOALS ? [h, a] : null
}

export function answerText(id: MarketId, value: string | undefined | null, teams: Teams, rule: MarketRule | undefined) {
  if (!value) return '-'
  if (id === 'score') return value
  return marketOptions(id, teams, rule).find((o) => o.value === value)?.label ?? value
}

const sideOf = (h: number, a: number) => (h > a ? '1' : h < a ? '2' : 'X')
const overUnder = (total: number, line: number) => (total > line ? 'ust' : 'alt')

/** The right answer to a question, or null when the figure it needs was never entered. */
export function correctAnswer(id: MarketId, rule: MarketRule | undefined, r: MatchResult): string | null {
  switch (id) {
    case 'score':
    case 'setScore':
    case 'mapScore':
      return `${r.home}-${r.away}`
    case 'side':
      return sideOf(r.home, r.away)
    case 'winner':
      return r.home === r.away ? null : sideOf(r.home, r.away)
    case 'goals':
    case 'points':
    case 'sets':
    case 'maps':
      return overUnder(r.home + r.away, rule?.line ?? MARKETS[id].line!.def)
    case 'margin':
      return overUnder(Math.abs(r.home - r.away), rule?.line ?? MARKETS.margin.line!.def)
    case 'parity':
      return (r.home + r.away) % 2 === 0 ? 'cift' : 'tek'
    case 'firstSet':
    case 'firstMap':
      return r.first === '1' || r.first === '2' ? r.first : null
    case 'btts':
      return r.home > 0 && r.away > 0 ? 'var' : 'yok'
    case 'half':
      return r.htHome === null || r.htAway === null ? null : sideOf(r.htHome, r.htAway)
    case 'corners':
      return r.corners === null ? null : overUnder(r.corners, rule?.line ?? MARKETS.corners.line!.def)
    case 'cards':
      return r.cards === null ? null : overUnder(r.cards, rule?.line ?? MARKETS.cards.line!.def)
  }
}

/** Why these answers cannot be saved, or null when every question of the match is answered. */
export function answersError(set: QuestionSet, answers: Answers, teams: Teams): string | null {
  for (const id of marketList(set)) {
    const value = answers[id]
    if (!value) return `"${marketTitle(id, set.markets[id])}" sorusunu cevapla.`
    if (id === 'score') {
      if (!parseScore(value)) return `Skor 0-${MAX_GOALS} arasında olmalı.`
    } else if (!marketOptions(id, teams, set.markets[id]).some((o) => o.value === value)) {
      return `"${marketTitle(id, set.markets[id])}" için geçerli bir seçenek seç.`
    }
  }
  return null
}

/** Keeps only the answers this match asks for, so a stray key can never be stored or counted. */
export function cleanAnswers(set: QuestionSet, answers: Answers): Answers {
  const out: Answers = {}
  for (const id of marketList(set)) if (answers[id]) out[id] = String(answers[id])
  return out
}

/** Scores one member's answers against the final result. */
export function gradePick(set: QuestionSet, result: MatchResult, answers: Answers): Grade {
  const grade: Grade = { outcomes: {}, pts: 0, kc: 0, kp: 0, exact: false, bonus: false }
  const add = (coin: Coin, amount: number) => {
    if (coin === 'kp') grade.kp += amount
    else grade.kc += amount
  }
  const ids = marketList(set)
  for (const id of ids) {
    const rule = set.markets[id]!
    const right = correctAnswer(id, rule, result)
    if (right === null) {
      grade.outcomes[id] = 'void'
      continue
    }
    const mine = answers[id]
    if (mine === right) {
      grade.outcomes[id] = 'hit'
      grade.pts += rule.pts
      add(rule.coin, rule.amount)
      if (isScoreLike(id)) grade.exact = true
      continue
    }
    const guess = isScoreLike(id) ? parseScore(mine) : null
    const near = guess && sideOf(guess[0], guess[1]) === sideOf(result.home, result.away) && ((rule.nearPts ?? 0) > 0 || (rule.nearAmount ?? 0) > 0)
    if (near) {
      grade.outcomes[id] = 'near'
      grade.pts += rule.nearPts ?? 0
      add(rule.coin, rule.nearAmount ?? 0)
    } else {
      grade.outcomes[id] = 'miss'
    }
  }
  const counted = ids.filter((id) => grade.outcomes[id] !== 'void')
  if (set.bonus && counted.length > 1 && counted.every((id) => grade.outcomes[id] === 'hit')) {
    grade.bonus = true
    grade.pts += set.bonus.pts
    const prize = set.bonus.prize
    if (prize && (prize.kind === 'kc' || prize.kind === 'kp')) add(prize.kind, prize.amount)
  }
  return grade
}

const fmt = (n: number) => n.toLocaleString('tr-TR')

export function prizeText(p: Prize | null | undefined): string {
  if (!p) return ''
  if (p.kind === 'kc') return `${fmt(p.amount)} KC`
  if (p.kind === 'kp') return `${fmt(p.amount)} KP`
  if (p.kind === 'market') return p.name
  return `${fmt(p.amount)} TL nakit · ${p.name}`
}

export const PRIZE_KIND_LABEL: Record<PrizeKind, string> = {
  kc: 'Kanka Coin',
  kp: 'Kanka Puan',
  market: 'Market ödülü',
  cash: 'Sponsor nakit ödülü',
}

export function rewardText(rule: Pick<MarketRule, 'pts' | 'coin' | 'amount'>) {
  const parts: string[] = []
  if (rule.pts > 0) parts.push(`${rule.pts} puan`)
  if (rule.amount > 0) parts.push(`${fmt(rule.amount)} ${rule.coin === 'kp' ? 'KP' : 'KC'}`)
  return parts.join(' + ')
}

/** The most a member can take from a match by answering everything right, bonus included. */
export function setCeiling(set: QuestionSet) {
  let pts = 0
  let kc = 0
  let kp = 0
  for (const id of marketList(set)) {
    const r = set.markets[id]!
    pts += r.pts
    if (r.coin === 'kp') kp += r.amount
    else kc += r.amount
  }
  const prize = set.bonus?.prize ?? null
  if (set.bonus) pts += set.bonus.pts
  if (prize?.kind === 'kc') kc += prize.amount
  if (prize?.kind === 'kp') kp += prize.amount
  return { pts, kc, kp, gift: prize && (prize.kind === 'market' || prize.kind === 'cash') ? prize : null }
}

export function ceilingText(set: QuestionSet) {
  const c = setCeiling(set)
  const parts: string[] = []
  if (c.kc > 0) parts.push(`${fmt(c.kc)} KC`)
  if (c.kp > 0) parts.push(`${fmt(c.kp)} KP`)
  if (c.gift) parts.push(prizeText(c.gift))
  return parts.length ? parts.join(' + ') : `${c.pts} puan`
}

/** Which extra figures the result form has to ask for. */
export function resultNeeds(set: QuestionSet) {
  return {
    half: Boolean(set.markets.half),
    corners: Boolean(set.markets.corners),
    cards: Boolean(set.markets.cards),
    first: Boolean(set.markets.firstSet || set.markets.firstMap),
  }
}

export function resultError(set: QuestionSet, r: MatchResult): string | null {
  const sport = sportOf(set)
  const info = SPORTS[sport]
  const bestOf = cleanBestOf(sport, set.bestOf)
  const max = bestOf ? winsNeeded(bestOf) : info.maxScore
  const goal = (n: number) => Number.isInteger(n) && n >= 0 && n <= max
  const stat = (n: number | null) => n === null || (Number.isInteger(n) && n >= 0 && n <= MAX_STAT)
  if (!goal(r.home) || !goal(r.away)) return `${info.scoreLabel} 0-${max} arasında olmalı.`
  if (!info.draw && r.home === r.away) return `${info.label} maçı berabere bitmez. Kazananı belli olan skoru gir.`
  if (bestOf && Math.max(r.home, r.away) !== max) return `Bu maç ${max} ${info.unit} alan kazanır; kazanan tarafın skoru ${max} olmalı.`
  const first = r.first ?? null
  if (first !== null && first !== '1' && first !== '2') return `İlk ${info.unit} için bir taraf seç ya da boş bırak.`
  if (bestOf && first !== null && (first === '1' ? r.home : r.away) === 0) return `İlk ${info.unit} alan taraf maçı hiç ${info.unit} almadan bitirmiş olamaz.`
  if ((r.htHome === null) !== (r.htAway === null)) return 'İlk yarı skorunun iki tarafını da gir ya da ikisini de boş bırak.'
  if (r.htHome !== null && r.htAway !== null) {
    if (!goal(r.htHome) || !goal(r.htAway)) return `İlk yarı skoru 0-${max} arasında olmalı.`
    if (r.htHome > r.home || r.htAway > r.away) return 'İlk yarı skoru maç skorundan büyük olamaz.'
  }
  if (!stat(r.corners)) return `Korner sayısı 0-${MAX_STAT} arasında olmalı.`
  if (!stat(r.cards)) return `Kart sayısı 0-${MAX_STAT} arasında olmalı.`
  return null
}

/** The questions that will be cancelled because the result leaves their figure empty. */
export function voidedBy(set: QuestionSet, r: MatchResult): MarketId[] {
  return marketList(set).filter((id) => correctAnswer(id, set.markets[id], r) === null)
}

// --- League prizes -------------------------------------------------------

export type PeriodKind = 'week' | 'month'

export type PeriodPrizes = {
  on: boolean
  /** When the prizes were switched on; a period that ended before it is never paid. */
  since: string | null
  /** One prize per place, first place first. */
  places: Prize[]
}

export type LeagueSettings = {
  /** The questions a new football match gets unless it is given its own. */
  defaults: QuestionSet
  /** The saved starting questions of the other sports; a sport left out starts from its built-in pair. */
  sportDefaults: Partial<Record<Sport, QuestionSet>>
  week: PeriodPrizes
  month: PeriodPrizes
  /** Score finished calendar matches without anyone pressing a button. */
  auto: boolean
}

export const PERIOD_LABEL: Record<PeriodKind, string> = { week: 'Haftalık', month: 'Aylık' }

function normalizePeriod(raw: unknown): PeriodPrizes {
  const p = (raw && typeof raw === 'object' ? raw : {}) as Partial<PeriodPrizes>
  const places = (Array.isArray(p.places) ? p.places : []).map(normalizePrize).filter((x): x is Prize => x !== null).slice(0, MAX_LEAGUE_PLACES)
  const since = typeof p.since === 'string' && Number.isFinite(Date.parse(p.since)) ? new Date(p.since).toISOString() : null
  return { on: Boolean(p.on) && places.length > 0, since, places }
}

function normalizeSportDefaults(raw: unknown): LeagueSettings['sportDefaults'] {
  const input = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const out: LeagueSettings['sportDefaults'] = {}
  for (const sport of SPORT_IDS) {
    const saved = input[sport]
    if (sport !== 'football' && saved && typeof saved === 'object') out[sport] = normalizeSet({ ...saved, sport })
  }
  return out
}

/** The questions a new match of this sport opens with: the saved template, refitted to the match length. */
export function startingSet(settings: Pick<LeagueSettings, 'defaults' | 'sportDefaults'>, sport: Sport, length?: number): QuestionSet {
  if (sport === 'football') return settings.defaults
  const saved = settings.sportDefaults[sport]
  return saved ? normalizeSet({ ...saved, sport, bestOf: length ?? saved.bestOf }) : defaultSet(sport, length)
}

export function normalizeSettings(raw: unknown): LeagueSettings {
  const s = (raw && typeof raw === 'object' ? raw : {}) as Partial<LeagueSettings>
  return {
    defaults: normalizeSet({ ...(s.defaults && typeof s.defaults === 'object' ? s.defaults : {}), sport: 'football' }),
    sportDefaults: normalizeSportDefaults(s.sportDefaults),
    week: normalizePeriod(s.week),
    month: normalizePeriod(s.month),
    auto: Boolean(s.auto),
  }
}

const TR_OFFSET_MS = 3 * 3_600_000
const DAY_MS = 86_400_000

const dayMonth = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', timeZone: 'Europe/Istanbul' })
const monthYear = new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric', timeZone: 'Europe/Istanbul' })

export type Period = { kind: PeriodKind; key: string; start: number; end: number; label: string }

/** The league week (Monday to Sunday) or month around `at`, in Istanbul time. `shift` -1 is the one before. */
export function periodBounds(kind: PeriodKind, at: number, shift = 0): Period {
  const local = new Date(at + TR_OFFSET_MS)
  const y = local.getUTCFullYear()
  const m = local.getUTCMonth()
  const pad = (n: number) => String(n).padStart(2, '0')
  if (kind === 'month') {
    const start = Date.UTC(y, m + shift, 1) - TR_OFFSET_MS
    const end = Date.UTC(y, m + shift + 1, 1) - TR_OFFSET_MS
    const first = new Date(start + TR_OFFSET_MS)
    return { kind, key: `m:${first.getUTCFullYear()}-${pad(first.getUTCMonth() + 1)}`, start, end, label: monthYear.format(start) }
  }
  const sinceMonday = (local.getUTCDay() + 6) % 7
  const start = Date.UTC(y, m, local.getUTCDate() - sinceMonday + shift * 7) - TR_OFFSET_MS
  const end = start + 7 * DAY_MS
  const first = new Date(start + TR_OFFSET_MS)
  return {
    kind,
    key: `w:${first.getUTCFullYear()}-${pad(first.getUTCMonth() + 1)}-${pad(first.getUTCDate())}`,
    start,
    end,
    label: `${dayMonth.format(start)} - ${dayMonth.format(end - DAY_MS)}`,
  }
}

export const placeLabel = (place: number) => `${place}.`

// --- Awards --------------------------------------------------------------

export type AwardStatus = 'verildi' | 'beklemede' | 'iptal'

export const AWARD_STATUS_LABEL: Record<AwardStatus, string> = {
  verildi: 'Teslim edildi',
  beklemede: 'Teslim bekliyor',
  iptal: 'İptal edildi',
}

// --- Special leagues ------------------------------------------------------

export const MAX_BOARD_NAME = 60
export const MAX_OPEN_BOARDS = 20

export type BoardWinner = { place: number; userId: string; name: string; points: number; prize: Prize }

/** A league of its own: the matches filed under it are scored on its table instead of the weekly and monthly one. */
export type Board = {
  id: number
  name: string
  /** Whether its matches count in the weekly and monthly table as well. */
  general: boolean
  /** One prize per place, first place first; paid when the league is closed. */
  places: Prize[]
  open: boolean
  winners: BoardWinner[]
  closedAt: string | null
  /** The matches filed under it, and how many of them still wait for a result. */
  matches: number
  waiting: number
}

export type Award = {
  id: number
  userId: string
  userName: string
  source: 'match' | PeriodKind | 'board'
  title: string
  prize: Prize
  status: AwardStatus
  /** The member's user name on the sponsor site, needed before a sponsor prize can be delivered. */
  siteUsername: string | null
  needsUsername: boolean
  note: string | null
  createdAt: string
}

export const SITE_USERNAME_MIN = 2
export const SITE_USERNAME_MAX = 60
