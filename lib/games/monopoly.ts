export type Group = 'brown' | 'lightblue' | 'pink' | 'orange' | 'red' | 'yellow' | 'green' | 'darkblue'
export type Square =
  | { type: 'go' | 'jail' | 'parking' | 'gotojail'; name: string }
  | { type: 'property'; name: string; group: Group; price: number; rent: number[]; house: number }
  | { type: 'rail' | 'utility'; name: string; price: number }
  | { type: 'tax'; name: string; amount: number }
  | { type: 'chance' | 'chest'; name: string }

const P = (name: string, group: Group, price: number, rent: number[], house: number): Square => ({ type: 'property', name, group, price, rent, house })

export const BOARD: Square[] = [
  { type: 'go', name: 'Başla' },
  P('Kasımpaşa', 'brown', 60, [2, 10, 30, 90, 160, 250], 50),
  { type: 'chest', name: 'Kamu Fonu' },
  P('Dolapdere', 'brown', 60, [4, 20, 60, 180, 320, 450], 50),
  { type: 'tax', name: 'Gelir Vergisi', amount: 200 },
  { type: 'rail', name: 'Haydarpaşa Garı', price: 200 },
  P('Sultanahmet', 'lightblue', 100, [6, 30, 90, 270, 400, 550], 50),
  { type: 'chance', name: 'Şans' },
  P('Eminönü', 'lightblue', 100, [6, 30, 90, 270, 400, 550], 50),
  P('Balat', 'lightblue', 120, [8, 40, 100, 300, 450, 600], 50),
  { type: 'jail', name: 'Hapis' },
  P('Beyoğlu', 'pink', 140, [10, 50, 150, 450, 625, 750], 100),
  { type: 'utility', name: 'Elektrik İdaresi', price: 150 },
  P('Beşiktaş', 'pink', 140, [10, 50, 150, 450, 625, 750], 100),
  P('Taksim', 'pink', 160, [12, 60, 180, 500, 700, 900], 100),
  { type: 'rail', name: 'Sirkeci Garı', price: 200 },
  P('Harbiye', 'orange', 180, [14, 70, 200, 550, 750, 950], 100),
  { type: 'chest', name: 'Kamu Fonu' },
  P('Şişli', 'orange', 180, [14, 70, 200, 550, 750, 950], 100),
  P('Mecidiyeköy', 'orange', 200, [16, 80, 220, 600, 800, 1000], 100),
  { type: 'parking', name: 'Ücretsiz Otopark' },
  P('Erenköy', 'red', 220, [18, 90, 250, 700, 875, 1050], 150),
  { type: 'chance', name: 'Şans' },
  P('Caddebostan', 'red', 220, [18, 90, 250, 700, 875, 1050], 150),
  P('Göztepe', 'red', 240, [20, 100, 300, 750, 925, 1100], 150),
  { type: 'rail', name: 'Karaköy İskelesi', price: 200 },
  P('Nişantaşı', 'yellow', 260, [22, 110, 330, 800, 975, 1150], 150),
  P('Teşvikiye', 'yellow', 260, [22, 110, 330, 800, 975, 1150], 150),
  { type: 'utility', name: 'Su İdaresi', price: 150 },
  P('Maçka', 'yellow', 280, [24, 120, 360, 850, 1025, 1200], 150),
  { type: 'gotojail', name: 'Kodese Gir' },
  P('Levent', 'green', 300, [26, 130, 390, 900, 1100, 1275], 200),
  P('Etiler', 'green', 300, [26, 130, 390, 900, 1100, 1275], 200),
  { type: 'chest', name: 'Kamu Fonu' },
  P('Bebek', 'green', 320, [28, 150, 450, 1000, 1200, 1400], 200),
  { type: 'rail', name: 'Kadıköy İskelesi', price: 200 },
  { type: 'chance', name: 'Şans' },
  P('Tarabya', 'darkblue', 350, [35, 175, 500, 1100, 1300, 1500], 200),
  { type: 'tax', name: 'Lüks Vergisi', amount: 100 },
  P('Bağdat Caddesi', 'darkblue', 400, [50, 200, 600, 1400, 1700, 2000], 200),
]

export const GROUP_SQUARES: Record<Group, number[]> = BOARD.reduce(
  (acc, sq, i) => {
    if (sq.type === 'property') acc[sq.group] = [...(acc[sq.group] ?? []), i]
    return acc
  },
  {} as Record<Group, number[]>,
)

/** Old tables may still have up to 10 seats; new tables are capped at MAX_PLAYERS. */
export const MAX_SEATS = 10
export const MAX_PLAYERS = 8
/** Lobby value for the classic long game: no turn limit, it ends when only one player is left standing. */
export const UNTIL_BANKRUPT = 999
export const STALEMATE_ROUND = 300
/** The bank only has so many buildings; running out of houses is part of the classic long game. */
export const BANK_HOUSES = 32
export const BANK_HOTELS = 12
export const START_MONEY = 1500
export const JAIL_FINE = 50
export const GO_SALARY = 200

type Card =
  | { text: string; kind: 'move'; to: number }
  | { text: string; kind: 'money'; amount: number }
  | { text: string; kind: 'jail' }
  | { text: string; kind: 'free' }
  | { text: string; kind: 'back'; steps: number }
  | { text: string; kind: 'each'; amount: number }
  | { text: string; kind: 'repair'; house: number; hotel: number }
  | { text: string; kind: 'nearest'; target: 'rail' | 'utility' }

export const CHANCE: Card[] = [
  { text: 'Başla noktasına ilerle, 200 ₺ al.', kind: 'move', to: 0 },
  { text: "Bağdat Caddesi'ne ilerle.", kind: 'move', to: 39 },
  { text: "Erenköy'e ilerle. Başla'dan geçersen 200 ₺ al.", kind: 'move', to: 21 },
  { text: "Beyoğlu'na ilerle. Başla'dan geçersen 200 ₺ al.", kind: 'move', to: 11 },
  { text: 'En yakın istasyona ilerle. Sahibi varsa iki kat kira öde.', kind: 'nearest', target: 'rail' },
  { text: 'En yakın idareye ilerle. Sahibi varsa zarın 10 katını öde.', kind: 'nearest', target: 'utility' },
  { text: 'Banka sana 50 ₺ temettü ödüyor.', kind: 'money', amount: 50 },
  { text: 'Hapisten ücretsiz çıkış kartı. Saklayabilirsin.', kind: 'free' },
  { text: '3 kare geri git.', kind: 'back', steps: 3 },
  { text: "Doğrudan hapse gir. Başla'dan geçme, 200 ₺ alma.", kind: 'jail' },
  { text: 'Mülklerine genel tamir: her ev için 25 ₺, her otel için 100 ₺ öde.', kind: 'repair', house: 25, hotel: 100 },
  { text: 'Hız cezası: 15 ₺ öde.', kind: 'money', amount: -15 },
  { text: "Haydarpaşa Garı'na git. Başla'dan geçersen 200 ₺ al.", kind: 'move', to: 5 },
  { text: 'Yönetim kurulu başkanı seçildin: her oyuncuya 50 ₺ öde.', kind: 'each', amount: -50 },
  { text: 'Konut kredin vadesi doldu: 150 ₺ al.', kind: 'money', amount: 150 },
]

export const CHEST: Card[] = [
  { text: 'Başla noktasına ilerle, 200 ₺ al.', kind: 'move', to: 0 },
  { text: 'Banka hatası lehine: 200 ₺ al.', kind: 'money', amount: 200 },
  { text: 'Doktor ücreti: 50 ₺ öde.', kind: 'money', amount: -50 },
  { text: 'Hisse satışından 50 ₺ kazandın.', kind: 'money', amount: 50 },
  { text: 'Hapisten ücretsiz çıkış kartı. Saklayabilirsin.', kind: 'free' },
  { text: "Doğrudan hapse gir. Başla'dan geçme, 200 ₺ alma.", kind: 'jail' },
  { text: 'Tatil fonun olgunlaştı: 100 ₺ al.', kind: 'money', amount: 100 },
  { text: 'Vergi iadesi: 20 ₺ al.', kind: 'money', amount: 20 },
  { text: 'Doğum günün kutlu olsun! Her oyuncudan 10 ₺ al.', kind: 'each', amount: 10 },
  { text: 'Hayat sigortan ödendi: 100 ₺ al.', kind: 'money', amount: 100 },
  { text: 'Hastane masrafı: 100 ₺ öde.', kind: 'money', amount: -100 },
  { text: 'Okul taksiti: 50 ₺ öde.', kind: 'money', amount: -50 },
  { text: 'Danışmanlık ücreti: 25 ₺ al.', kind: 'money', amount: 25 },
  { text: 'Sokak tamiri: her ev için 40 ₺, her otel için 115 ₺ öde.', kind: 'repair', house: 40, hotel: 115 },
  { text: 'Güzellik yarışmasında ikinci oldun: 10 ₺ al.', kind: 'money', amount: 10 },
  { text: 'Miras kaldı: 100 ₺ al.', kind: 'money', amount: 100 },
]

// ---------- Table rules ----------

export type MonoRules = { kumbara: boolean; goDouble: boolean; quick: boolean; doubleRent: boolean }
export const DEFAULT_MONO_RULES: MonoRules = { kumbara: false, goDouble: false, quick: false, doubleRent: false }
export const MONO_RULE_OPTIONS: { key: keyof MonoRules; label: string; hint: string }[] = [
  { key: 'kumbara', label: 'Otopark kumbarası', hint: "Vergi ve cezalar Ücretsiz Otopark'ta birikir, oraya gelen hepsini alır." },
  { key: 'goDouble', label: "Başla'ya tam gelene 400 ₺", hint: 'Başla karesine tam olarak gelen 200 yerine 400 ₺ alır.' },
  { key: 'quick', label: 'Hızlı oyun', hint: 'Oyun başında herkese rastgele 2 tapu dağıtılır.' },
  { key: 'doubleRent', label: 'Evsiz kira 2 kat', hint: 'Evsiz arsaların kirası iki katına çıkar, para daha hızlı döner.' },
]
export function normalizeMonoRules(input: unknown): MonoRules {
  if (!Array.isArray(input)) return { ...DEFAULT_MONO_RULES }
  const list = input.map(String)
  return { kumbara: list.includes('kumbara'), goDouble: list.includes('goDouble'), quick: list.includes('quick'), doubleRent: list.includes('doubleRent') }
}
export const monoRulesToList = (r: MonoRules) => (Object.keys(r) as (keyof MonoRules)[]).filter((k) => r[k])
export const monoRulesOf = (s: Pick<MonopolyState, 'rules'>) => s.rules ?? DEFAULT_MONO_RULES

// ---------- State ----------

export type Deck = 'chance' | 'chest'
export type MPlayer = {
  money: number
  pos: number
  jail: number
  inJail: boolean
  out: boolean
  cards: number
  doubles: number
  /** Which deck each held jail-free card came from, so it goes back to the right one. */
  cardFrom?: Deck[]
  /** Round of this bot's last trade offer; keeps bots from spamming offers. */
  tradeRound?: number
}

export type Bundle = { props: number[]; money: number; cards: number }
export type Trade = { from: number; to: number; give: Bundle; take: Bundle; counter: boolean }
export type Auction = { pos: number; bid: number; leader: number | null; active: number[]; idx: number; resume: 'roll' | 'end' }
export type Debt = { amount: number; to: number | null; pot: boolean; resume: 'roll' | 'end' }

export type MonopolyState = {
  kind: 'monopoly'
  seats: number
  bots: number[]
  players: MPlayer[]
  owner: (number | null)[]
  houses: number[]
  mortgaged: boolean[]
  turn: number
  phase: 'roll' | 'buy' | 'end' | 'auction' | 'debt'
  dice: [number, number] | null
  /** Survives the turn change so everyone can see what the previous player rolled. */
  lastRoll?: { seat: number; dice: [number, number] } | null
  again: boolean
  chance: number[]
  chest: number[]
  card: { deck: Deck; text: string } | null
  round: number
  maxRounds: number
  log: string[]
  note: string
  seq: number
  rules?: MonoRules
  /** Free Parking jackpot (only with the kumbara rule). */
  pot?: number
  trade?: Trade | null
  auction?: Auction | null
  auctionQueue?: number[]
  debt?: Debt | null
  tradesThisTurn?: number
}

type Act = { type: string; [k: string]: unknown }
export type MonopolyStep = { state: MonopolyState; winners: number[] | null }

const shuffled = (n: number) => {
  const a = Array.from({ length: n }, (_, i) => i)
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
const d6 = () => 1 + Math.floor(Math.random() * 6)
const round10 = (n: number) => Math.max(10, Math.round(n / 10) * 10)

export const isBuyable = (sq: Square): sq is Extract<Square, { price: number }> => sq.type === 'property' || sq.type === 'rail' || sq.type === 'utility'
const BUYABLE = BOARD.map((sq, i) => (isBuyable(sq) ? i : -1)).filter((i) => i >= 0)

export function initMonopoly(opts: { seats?: number; botSeats?: number[]; rounds?: number; rules?: unknown }): MonopolyState {
  const seats = Math.max(2, Math.min(MAX_SEATS, Math.floor(opts.seats ?? 4)))
  const rounds = Math.floor(Number(opts.rounds) || 0)
  const rules = normalizeMonoRules(opts.rules)
  const s: MonopolyState = {
    kind: 'monopoly',
    seats,
    bots: opts.botSeats ?? [],
    players: Array.from({ length: seats }, () => ({ money: START_MONEY, pos: 0, jail: 0, inJail: false, out: false, cards: 0, doubles: 0, cardFrom: [] })),
    owner: BOARD.map(() => null),
    houses: BOARD.map(() => 0),
    mortgaged: BOARD.map(() => false),
    turn: 0,
    phase: 'roll',
    dice: null,
    again: false,
    chance: shuffled(CHANCE.length),
    chest: shuffled(CHEST.length),
    card: null,
    round: 1,
    maxRounds: rounds >= 10 && rounds < UNTIL_BANKRUPT ? Math.min(100, rounds) : 0,
    log: ['Oyun başladı. Herkesin kasasında 1.500 ₺ var.'],
    note: '',
    seq: 0,
    rules,
    pot: 0,
    trade: null,
    auction: null,
    auctionQueue: [],
    debt: null,
    tradesThisTurn: 0,
  }
  if (rules.quick) {
    const deck = shuffled(BUYABLE.length).map((k) => BUYABLE[k])
    for (let r = 0; r < 2; r++)
      for (let seat = 0; seat < seats; seat++) {
        const pos = deck.shift()
        if (pos != null) s.owner[pos] = seat
      }
    s.log.push('Hızlı oyun: herkese 2 rastgele tapu dağıtıldı.')
  }
  return s
}

/** Who has to act right now: a trade answer and auction bids come before the normal turn. */
export function monoActor(s: MonopolyState) {
  if (s.trade) return s.trade.to
  if (s.auction) return s.auction.active[s.auction.idx] ?? s.turn
  return s.turn
}

export const ownsGroup = (s: Pick<MonopolyState, 'owner'>, seat: number, g: Group) => GROUP_SQUARES[g].every((i) => s.owner[i] === seat)

export function rentOf(s: MonopolyState, pos: number, diceSum: number, special?: 'rail2' | 'util10') {
  const sq = BOARD[pos]
  const owner = s.owner[pos]
  if (owner == null || s.mortgaged[pos]) return 0
  if (sq.type === 'property') {
    const h = s.houses[pos]
    if (h > 0) return sq.rent[h]
    const base = sq.rent[0] * (monoRulesOf(s).doubleRent ? 2 : 1)
    return ownsGroup(s, owner, sq.group) ? base * 2 : base
  }
  if (sq.type === 'rail') {
    const n = BOARD.filter((b, i) => b.type === 'rail' && s.owner[i] === owner).length
    return 25 * 2 ** (n - 1) * (special === 'rail2' ? 2 : 1)
  }
  if (sq.type === 'utility') {
    const n = BOARD.filter((b, i) => b.type === 'utility' && s.owner[i] === owner).length
    return diceSum * (special === 'util10' || n === 2 ? 10 : 4)
  }
  return 0
}

/** Short human reason shown next to a rent payment. */
function rentReason(s: MonopolyState, pos: number, diceSum: number, special?: 'rail2' | 'util10') {
  const sq = BOARD[pos]
  const owner = s.owner[pos]!
  if (sq.type === 'property') {
    const h = s.houses[pos]
    if (h === 5) return 'otelli'
    if (h > 0) return `${h} evli`
    return ownsGroup(s, owner, sq.group) ? 'renk tamam, 2 kat' : 'evsiz arsa'
  }
  if (sq.type === 'rail') {
    const n = BOARD.filter((b, i) => b.type === 'rail' && s.owner[i] === owner).length
    return `${n} istasyon${special === 'rail2' ? ', kart ile 2 kat' : ''}`
  }
  const n = BOARD.filter((b, i) => b.type === 'utility' && s.owner[i] === owner).length
  return `zar ${diceSum} × ${special === 'util10' || n === 2 ? 10 : 4}`
}

export function netWorth(s: MonopolyState, seat: number) {
  let w = s.players[seat].money
  BOARD.forEach((sq, i) => {
    if (s.owner[i] !== seat || !isBuyable(sq)) return
    w += s.mortgaged[i] ? sq.price / 2 : sq.price
    if (sq.type === 'property') w += s.houses[i] * sq.house
  })
  return w
}

/** Cash a player could raise right now by selling every building and mortgaging every deed. */
export function liquidity(s: MonopolyState, seat: number) {
  let v = 0
  BOARD.forEach((sq, i) => {
    if (s.owner[i] !== seat || !isBuyable(sq)) return
    if (sq.type === 'property') v += (s.houses[i] * sq.house) / 2
    if (!s.mortgaged[i]) v += sq.price / 2
  })
  return v
}

const alive = (s: MonopolyState) => s.players.map((p, i) => (p.out ? -1 : i)).filter((i) => i >= 0)

function draft(s: MonopolyState): MonopolyState {
  return {
    ...s,
    players: s.players.map((p) => ({ ...p, cardFrom: cardsOf(p) })),
    owner: [...s.owner],
    houses: [...s.houses],
    mortgaged: [...s.mortgaged],
    chance: [...s.chance],
    chest: [...s.chest],
    log: [...s.log],
    trade: s.trade ? { ...s.trade, give: { ...s.trade.give, props: [...s.trade.give.props] }, take: { ...s.trade.take, props: [...s.trade.take.props] } } : null,
    auction: s.auction ? { ...s.auction, active: [...s.auction.active] } : null,
    auctionQueue: [...(s.auctionQueue ?? [])],
    debt: s.debt ? { ...s.debt } : null,
    pot: s.pot ?? 0,
  }
}

/** Seat placeholder; the UI swaps `@n` for the player's name. */
const name = (seat: number) => `@${seat}`
const log = (s: MonopolyState, text: string) => {
  s.log = [...s.log, text].slice(-24)
}

// ---------- Jail-free cards ----------

const cardsOf = (p: MPlayer): Deck[] => (p.cardFrom && p.cardFrom.length === p.cards ? [...p.cardFrom] : Array.from({ length: p.cards }, () => 'chance' as Deck))
const freeIdx = (deck: Deck) => (deck === 'chance' ? CHANCE : CHEST).findIndex((c) => c.kind === 'free')
function addCards(p: MPlayer, decks: Deck[]) {
  p.cardFrom = [...cardsOf(p), ...decks]
  p.cards = p.cardFrom.length
}
function takeCards(p: MPlayer, n: number): Deck[] {
  const list = cardsOf(p)
  const out = list.splice(0, n)
  p.cardFrom = list
  p.cards = list.length
  return out
}

// ---------- Money ----------

/** Sells houses then mortgages deeds until the debt is covered. Returns false if still short. */
function raise(s: MonopolyState, seat: number, need: number) {
  const p = s.players[seat]
  while (p.money < need) {
    const built = BOARD.map((_, i) => i)
      .filter((i) => canSell(s, seat, i))
      .sort((a, b) => s.houses[b] - s.houses[a])[0]
    if (built != null) {
      s.houses[built]--
      p.money += (BOARD[built] as { house: number }).house / 2
      continue
    }
    const free = BOARD.map((_, i) => i)
      .filter((i) => canMortgage(s, seat, i))
      .sort((a, b) => sqPrice(a) - sqPrice(b))[0]
    if (free == null) return false
    s.mortgaged[free] = true
    p.money += sqPrice(free) / 2
  }
  return true
}

function transfer(s: MonopolyState, seat: number, amount: number, to: number | null, pot: boolean) {
  s.players[seat].money -= amount
  if (to != null) s.players[to].money += amount
  else if (pot && monoRulesOf(s).kumbara) s.pot = (s.pot ?? 0) + amount
}

/**
 * Pays `amount` from seat to `to` (null = bank). A human on their own turn who can still raise the
 * money gets a debt screen to choose what to sell; everyone else liquidates automatically.
 */
function pay(s: MonopolyState, seat: number, amount: number, to: number | null, opts: { pot?: boolean; auto?: boolean } = {}) {
  const p = s.players[seat]
  if (amount <= 0 || p.out) return
  const pot = !!opts.pot && to == null
  if (p.money >= amount) return transfer(s, seat, amount, to, pot)
  const human = !s.bots.includes(seat)
  if (!opts.auto && human && seat === s.turn && !s.debt && p.money + liquidity(s, seat) >= amount) {
    s.debt = { amount, to, pot, resume: 'end' }
    log(s, `${name(seat)} ${amount} ₺ borç için para bulmalı.`)
    return
  }
  if (raise(s, seat, amount)) return transfer(s, seat, amount, to, pot)
  bankrupt(s, seat, to)
}

/** Classic bankruptcy: to a player, everything goes to the creditor; to the bank, deeds go to auction. */
function bankrupt(s: MonopolyState, seat: number, to: number | null) {
  const p = s.players[seat]
  BOARD.forEach((sq, i) => {
    if (s.owner[i] === seat && sq.type === 'property' && s.houses[i] > 0) {
      p.money += (s.houses[i] * sq.house) / 2
      s.houses[i] = 0
    }
  })
  const cash = Math.max(0, p.money)
  const deeds = BOARD.map((_, i) => i).filter((i) => s.owner[i] === seat)
  const cards = takeCards(p, p.cards)
  p.money = 0
  p.out = true
  if (to != null && !s.players[to].out) {
    s.players[to].money += cash
    deeds.forEach((i) => (s.owner[i] = to))
    addCards(s.players[to], cards)
    log(s, `${name(seat)} iflas etti. Parası ve ${deeds.length} tapusu ${name(to)} oyuncusuna geçti.`)
  } else {
    deeds.forEach((i) => {
      s.owner[i] = null
      s.mortgaged[i] = false
    })
    cards.forEach((d) => (d === 'chance' ? s.chance : s.chest).push(freeIdx(d)))
    s.auctionQueue = [...(s.auctionQueue ?? []), ...deeds]
    log(s, `${name(seat)} iflas etti. ${deeds.length ? `${deeds.length} tapusu mezata çıkacak.` : 'Bankaya borçlu kaldı.'}`)
  }
  if (s.debt && s.turn === seat) s.debt = null
  if (s.trade && (s.trade.from === seat || s.trade.to === seat)) s.trade = null
}

function sendToJail(s: MonopolyState, seat: number) {
  const p = s.players[seat]
  p.pos = 10
  p.inJail = true
  p.jail = 0
  p.doubles = 0
  s.again = false
  log(s, `${name(seat)} hapse girdi.`)
}

function moveTo(s: MonopolyState, seat: number, to: number, collectGo = true) {
  const p = s.players[seat]
  if (collectGo && to < p.pos) {
    const exact = to === 0 && monoRulesOf(s).goDouble
    p.money += exact ? GO_SALARY * 2 : GO_SALARY
    log(s, exact ? `${name(seat)} Başla'ya tam geldi, +400 ₺.` : `${name(seat)} Başla'dan geçti, +200 ₺.`)
  }
  p.pos = to
}

function drawCard(s: MonopolyState, seat: number, deck: Deck, diceSum: number, depth: number) {
  const list = deck === 'chance' ? s.chance : s.chest
  const idx = list.shift()!
  const card = (deck === 'chance' ? CHANCE : CHEST)[idx]
  if (card.kind !== 'free') list.push(idx)
  s.card = { deck, text: card.text }
  log(s, `${name(seat)} ${deck === 'chance' ? 'Şans' : 'Kamu Fonu'} kartı çekti: ${card.text}`)
  const p = s.players[seat]
  switch (card.kind) {
    case 'money':
      if (card.amount > 0) p.money += card.amount
      else pay(s, seat, -card.amount, null, { pot: true })
      return
    case 'free':
      addCards(p, [deck])
      return
    case 'jail':
      sendToJail(s, seat)
      return
    case 'move':
      moveTo(s, seat, card.to)
      land(s, seat, diceSum, depth + 1)
      return
    case 'back':
      p.pos = (p.pos - card.steps + 40) % 40
      land(s, seat, diceSum, depth + 1)
      return
    case 'nearest': {
      let to = p.pos
      do to = (to + 1) % 40
      while (BOARD[to].type !== card.target)
      moveTo(s, seat, to)
      land(s, seat, diceSum, depth + 1, card.target === 'rail' ? 'rail2' : 'util10')
      return
    }
    case 'each':
      for (const o of alive(s)) {
        if (o === seat) continue
        if (card.amount < 0) pay(s, seat, -card.amount, o, { auto: true })
        else pay(s, o, card.amount, seat, { auto: true })
        if (s.players[seat].out) return
      }
      return
    case 'repair': {
      let total = 0
      BOARD.forEach((_, i) => {
        if (s.owner[i] !== seat) return
        total += s.houses[i] === 5 ? card.hotel : s.houses[i] * card.house
      })
      pay(s, seat, total, null, { pot: true })
      return
    }
  }
}

function land(s: MonopolyState, seat: number, diceSum: number, depth = 0, special?: 'rail2' | 'util10') {
  if (depth > 3) return
  const p = s.players[seat]
  const sq = BOARD[p.pos]
  if (sq.type === 'gotojail') return sendToJail(s, seat)
  if (sq.type === 'parking' && monoRulesOf(s).kumbara && (s.pot ?? 0) > 0) {
    p.money += s.pot!
    log(s, `${name(seat)} Otopark kumbarasından ${s.pot} ₺ aldı.`)
    s.pot = 0
    return
  }
  if (sq.type === 'tax') {
    log(s, `${name(seat)} ${sq.name} ödedi: ${sq.amount} ₺.`)
    return pay(s, seat, sq.amount, null, { pot: true })
  }
  if (sq.type === 'chance' || sq.type === 'chest') return drawCard(s, seat, sq.type, diceSum, depth)
  if (isBuyable(sq)) {
    const owner = s.owner[p.pos]
    if (owner == null) {
      s.phase = 'buy'
      return
    }
    if (owner === seat) return
    const rent = rentOf(s, p.pos, diceSum, special)
    if (rent > 0) {
      log(s, `${name(seat)}, ${sq.name} için ${name(owner)} oyuncusuna ${rent} ₺ kira ödedi (${rentReason(s, p.pos, diceSum, special)}).`)
      pay(s, seat, rent, owner)
    } else if (s.mortgaged[p.pos]) {
      log(s, `${name(seat)} ipotekli ${sq.name} karesine geldi, kira yok.`)
    }
  }
}

const resumePhase = (s: MonopolyState, seat: number): 'roll' | 'end' => (s.again && !s.players[seat].inJail && !s.players[seat].out ? 'roll' : 'end')

function afterMove(s: MonopolyState, seat: number) {
  if (s.phase === 'buy') return
  const resume = resumePhase(s, seat)
  if (s.debt) {
    s.debt.resume = resume
    s.phase = 'debt'
    return
  }
  s.phase = resume
}

function finishIfOver(s: MonopolyState): number[] | null {
  const live = alive(s)
  if (live.length <= 1) return live
  // Once every human is bankrupt only bots are left; settle right away by net worth.
  const botsOnly = live.every((i) => s.bots.includes(i))
  // A board that never produces a bankruptcy would run forever; settle a locked game by net worth.
  const locked = s.round > STALEMATE_ROUND
  if (botsOnly || locked || (s.maxRounds > 0 && s.round > s.maxRounds)) {
    if (locked) log(s, `${STALEMATE_ROUND} tur geçti, oyun net servete göre bitti.`)
    const worth = live.map((i) => netWorth(s, i))
    const max = Math.max(...worth)
    return live.filter((_, k) => worth[k] === max)
  }
  return null
}

function nextTurn(s: MonopolyState) {
  const live = alive(s)
  let next = s.turn
  for (let i = 1; i <= s.seats; i++) {
    const c = (s.turn + i) % s.seats
    if (live.includes(c)) {
      next = c
      break
    }
  }
  if (next <= s.turn) s.round++
  s.turn = next
  s.phase = 'roll'
  s.dice = null
  s.again = false
  s.card = null
  s.trade = null
  s.debt = null
  s.tradesThisTurn = 0
  s.players[next].doubles = 0
}

function roll(s: MonopolyState, seat: number) {
  const p = s.players[seat]
  const a = d6()
  const b = d6()
  const sum = a + b
  const dbl = a === b
  s.dice = [a, b]
  s.lastRoll = { seat, dice: [a, b] }
  s.card = null
  if (p.inJail) {
    if (dbl) {
      p.inJail = false
      p.jail = 0
      log(s, `${name(seat)} çift attı (${a}-${b}), hapisten çıktı.`)
      moveTo(s, seat, (p.pos + sum) % 40)
      s.again = false
      land(s, seat, sum)
      return afterMove(s, seat)
    }
    p.jail++
    if (p.jail < 3) {
      log(s, `${name(seat)} hapiste ${a}-${b} attı, çıkamadı.`)
      s.phase = 'end'
      return
    }
    log(s, `${name(seat)} üçüncü denemede çıkamadı, ${JAIL_FINE} ₺ ödeyip çıktı.`)
    pay(s, seat, JAIL_FINE, null, { pot: true, auto: true })
    if (p.out) return
    p.inJail = false
    p.jail = 0
    moveTo(s, seat, (p.pos + sum) % 40)
    s.again = false
    land(s, seat, sum)
    return afterMove(s, seat)
  }
  if (dbl) {
    p.doubles++
    if (p.doubles >= 3) {
      log(s, `${name(seat)} üst üste 3 çift attı!`)
      sendToJail(s, seat)
      s.phase = 'end'
      return
    }
  }
  s.again = dbl
  log(s, `${name(seat)} ${a}-${b} attı.`)
  moveTo(s, seat, (p.pos + sum) % 40)
  land(s, seat, sum)
  afterMove(s, seat)
}

const sqPrice = (pos: number) => {
  const sq = BOARD[pos]
  return isBuyable(sq) ? sq.price : 0
}

export function bankStock(s: MonopolyState) {
  let houses = 0
  let hotels = 0
  for (const h of s.houses) {
    if (h === 5) hotels++
    else houses += h
  }
  return { houses: BANK_HOUSES - houses, hotels: BANK_HOTELS - hotels }
}

export function canBuild(s: MonopolyState, seat: number, pos: number) {
  const sq = BOARD[pos]
  if (sq.type !== 'property' || s.owner[pos] !== seat || !ownsGroup(s, seat, sq.group)) return false
  const group = GROUP_SQUARES[sq.group]
  if (group.some((i) => s.mortgaged[i])) return false
  if (s.houses[pos] >= 5) return false
  const stock = bankStock(s)
  if (s.houses[pos] === 4 ? stock.hotels < 1 : stock.houses < 1) return false
  const min = Math.min(...group.map((i) => s.houses[i]))
  return s.houses[pos] === min && s.players[seat].money >= sq.house
}

export function canSell(s: MonopolyState, seat: number, pos: number) {
  const sq = BOARD[pos]
  if (sq.type !== 'property' || s.owner[pos] !== seat || s.houses[pos] === 0) return false
  const max = Math.max(...GROUP_SQUARES[sq.group].map((i) => s.houses[i]))
  return s.houses[pos] === max
}

export function canMortgage(s: MonopolyState, seat: number, pos: number) {
  const sq = BOARD[pos]
  if (!isBuyable(sq) || s.owner[pos] !== seat || s.mortgaged[pos]) return false
  if (sq.type === 'property') return GROUP_SQUARES[sq.group].every((i) => s.houses[i] === 0)
  return true
}

export const unmortgageCost = (pos: number) => Math.ceil((sqPrice(pos) / 2) * 1.1)

/** A deed can change hands only when its colour group has no buildings. */
export function canTradeDeed(s: MonopolyState, seat: number, pos: number) {
  const sq = BOARD[pos]
  if (!isBuyable(sq) || s.owner[pos] !== seat) return false
  return sq.type !== 'property' || GROUP_SQUARES[sq.group].every((i) => s.houses[i] === 0)
}

// ---------- Auctions ----------

function startAuction(s: MonopolyState, pos: number, resume: 'roll' | 'end') {
  const live = alive(s)
  const order = Array.from({ length: s.seats }, (_, k) => (s.turn + 1 + k) % s.seats).filter((i) => live.includes(i))
  s.auction = { pos, bid: 0, leader: null, active: order, idx: 0, resume }
  s.phase = 'auction'
  log(s, `${BOARD[pos].name} mezata çıktı.`)
  settleAuction(s)
}

function endAuction(s: MonopolyState) {
  const resume = s.auction!.resume
  s.auction = null
  const next = s.auctionQueue?.shift()
  if (next != null) return startAuction(s, next, resume)
  s.phase = resume
}

/** Drops broke or bankrupt bidders and closes the auction when one bidder is left. */
function settleAuction(s: MonopolyState) {
  const a = s.auction
  if (!a) return
  a.active = a.active.filter((i) => !s.players[i].out)
  for (let guard = 0; guard < 20; guard++) {
    if (a.leader != null && a.active.every((i) => i === a.leader)) {
      const sq = BOARD[a.pos]
      s.players[a.leader].money -= a.bid
      s.owner[a.pos] = a.leader
      log(s, `${name(a.leader)} ${sq.name} tapusunu mezatta ${a.bid} ₺'ye aldı.`)
      return endAuction(s)
    }
    if (!a.active.length) {
      log(s, `${BOARD[a.pos].name} mezatta kimseye satılmadı.`)
      return endAuction(s)
    }
    a.idx %= a.active.length
    const cur = a.active[a.idx]
    if (cur === a.leader) {
      a.idx = (a.idx + 1) % a.active.length
      continue
    }
    if (s.players[cur].money <= a.bid) {
      a.active.splice(a.idx, 1)
      continue
    }
    return
  }
}

// ---------- Trades ----------

function cleanBundle(raw: unknown): Bundle {
  const b = (raw ?? {}) as Partial<Bundle>
  const props = Array.isArray(b.props) ? Array.from(new Set(b.props.map((x) => Math.floor(Number(x))).filter((x) => x >= 0 && x < 40))) : []
  return { props, money: Math.max(0, Math.floor(Number(b.money) || 0)), cards: Math.max(0, Math.floor(Number(b.cards) || 0)) }
}

function checkBundle(s: MonopolyState, seat: number, b: Bundle) {
  if (b.props.some((i) => !canTradeDeed(s, seat, i))) throw new Error('Takastaki bir tapu artık verilemez (sahibi değişmiş ya da üzerinde ev var).')
  if (b.money > s.players[seat].money) throw new Error('Takastaki para kasada yok.')
  if (b.cards > s.players[seat].cards) throw new Error('Takastaki çıkış kartı yok.')
}

const bundleText = (b: Bundle) =>
  [...b.props.map((i) => BOARD[i].name), b.money ? `${b.money} ₺` : '', b.cards ? `${b.cards} çıkış kartı` : ''].filter(Boolean).join(', ') || 'hiçbir şey'

function executeTrade(s: MonopolyState, t: Trade) {
  checkBundle(s, t.from, t.give)
  checkBundle(s, t.to, t.take)
  const a = s.players[t.from]
  const b = s.players[t.to]
  t.give.props.forEach((i) => (s.owner[i] = t.to))
  t.take.props.forEach((i) => (s.owner[i] = t.from))
  a.money += t.take.money - t.give.money
  b.money += t.give.money - t.take.money
  addCards(b, takeCards(a, t.give.cards))
  addCards(a, takeCards(b, t.take.cards))
  log(s, `${name(t.from)} ile ${name(t.to)} takas yaptı. ${name(t.from)} verdi: ${bundleText(t.give)}. ${name(t.to)} verdi: ${bundleText(t.take)}.`)
}

/** How much a deed is worth to `seat` given the ownership map. */
function deedValue(owner: (number | null)[], seat: number, pos: number, mortgaged: boolean) {
  const sq = BOARD[pos]
  if (!isBuyable(sq)) return 0
  let v = mortgaged ? sq.price * 0.55 : sq.price
  if (sq.type === 'property') {
    const group = GROUP_SQUARES[sq.group]
    const mine = group.filter((i) => owner[i] === seat).length
    if (mine === group.length) v *= 2.4
    else if (mine > 1) v *= 1.4
  } else {
    const kind = sq.type
    const n = BOARD.filter((b, i) => b.type === kind && owner[i] === seat).length
    v *= 1 + 0.25 * Math.max(0, n - 1)
  }
  return v
}

/** Bot view of a trade where it is the `to` side. Returns the extra cash it would want if it says no. */
export function judgeTrade(s: MonopolyState, t: Trade) {
  const bot = t.to
  const before = s.owner
  const after = [...s.owner]
  t.give.props.forEach((i) => (after[i] = t.to))
  t.take.props.forEach((i) => (after[i] = t.from))
  let gain = t.give.money + t.give.cards * 50
  let loss = t.take.money + t.take.cards * 50
  t.give.props.forEach((i) => (gain += deedValue(after, bot, i, s.mortgaged[i])))
  t.take.props.forEach((i) => (loss += deedValue(before, bot, i, s.mortgaged[i])))
  // Handing a rival a full colour group is the real cost of a trade.
  for (const g of Object.keys(GROUP_SQUARES) as Group[]) {
    const cells = GROUP_SQUARES[g]
    if (cells.every((i) => after[i] === t.from) && !cells.every((i) => before[i] === t.from)) loss += cells.reduce((sum, i) => sum + sqPrice(i), 0) * 0.45
  }
  const keepsCash = s.players[bot].money - t.take.money >= 40
  const want = loss * 1.08
  return { ok: keepsCash && gain >= want, need: round10(want - gain) }
}

function proposeTrade(s: MonopolyState, t: Trade) {
  if (t.from === t.to || !s.players[t.to] || s.players[t.to].out) throw new Error('Geçersiz takas oyuncusu')
  checkBundle(s, t.from, t.give)
  checkBundle(s, t.to, t.take)
  const empty = (b: Bundle) => !b.props.length && !b.money && !b.cards
  if (empty(t.give) || empty(t.take)) throw new Error('İki taraf da bir şey vermeli')
  if (s.bots.includes(t.to)) {
    const v = judgeTrade(s, t)
    if (v.ok) executeTrade(s, t)
    else log(s, `${name(t.to)} takası reddetti. En az ${v.need} ₺ daha isterdi.`)
    return
  }
  s.trade = t
  log(s, `${name(t.from)}, ${name(t.to)} oyuncusuna takas teklif etti.`)
}

// ---------- Step ----------

export function monopolyStep(state: MonopolyState, seat: number, a: Act): MonopolyStep {
  if (monoActor(state) !== seat) throw new Error('Sıra sende değil')
  const s = draft(state)
  const p = s.players[seat]
  if (p.out) throw new Error('İflas ettin')
  const pos = Math.floor(Number(a.pos))
  s.seq++

  if (s.trade && !['acceptTrade', 'rejectTrade', 'counterTrade'].includes(a.type)) throw new Error('Önce takas teklifini yanıtla')
  if (s.auction && !['bid', 'fold'].includes(a.type)) throw new Error('Mezat sürüyor')

  switch (a.type) {
    case 'roll':
      if (s.phase !== 'roll') throw new Error('Şu an zar atamazsın')
      roll(s, seat)
      break
    case 'payJail':
      if (s.phase !== 'roll' || !p.inJail) throw new Error('Hapiste değilsin')
      if (p.money < JAIL_FINE) throw new Error('Yeterli paran yok')
      transfer(s, seat, JAIL_FINE, null, true)
      p.inJail = false
      p.jail = 0
      log(s, `${name(seat)} ${JAIL_FINE} ₺ ödeyip hapisten çıktı.`)
      break
    case 'useCard': {
      if (s.phase !== 'roll' || !p.inJail || p.cards < 1) throw new Error('Kartın yok')
      const [deck = 'chance'] = takeCards(p, 1)
      ;(deck === 'chest' ? s.chest : s.chance).push(freeIdx(deck))
      p.inJail = false
      p.jail = 0
      log(s, `${name(seat)} hapisten çıkış kartını kullandı.`)
      break
    }
    case 'buy': {
      if (s.phase !== 'buy') throw new Error('Satın alınacak tapu yok')
      const price = sqPrice(p.pos)
      if (p.money < price) throw new Error('Yeterli paran yok')
      p.money -= price
      s.owner[p.pos] = seat
      log(s, `${name(seat)} ${BOARD[p.pos].name} tapusunu ${price} ₺'ye aldı.`)
      s.phase = 'end'
      afterMove(s, seat)
      break
    }
    case 'pass':
      if (s.phase !== 'buy') throw new Error('Pas geçilecek bir şey yok')
      log(s, `${name(seat)} ${BOARD[p.pos].name} tapusunu almadı.`)
      startAuction(s, p.pos, resumePhase(s, seat))
      break
    case 'bid': {
      const au = s.auction
      if (!au) throw new Error('Mezat yok')
      const amount = Math.floor(Number(a.amount))
      if (!(amount > au.bid)) throw new Error(`Teklif ${au.bid} ₺'den yüksek olmalı`)
      if (amount > p.money) throw new Error('Kasanda bu kadar para yok')
      au.bid = amount
      au.leader = seat
      au.idx = (au.idx + 1) % au.active.length
      log(s, `${name(seat)} mezatta ${amount} ₺ teklif verdi.`)
      settleAuction(s)
      break
    }
    case 'fold': {
      const au = s.auction
      if (!au) throw new Error('Mezat yok')
      au.active.splice(au.idx, 1)
      settleAuction(s)
      break
    }
    case 'build': {
      if (s.phase === 'debt') throw new Error('Önce borcunu öde')
      if (!canBuild(s, seat, pos)) throw new Error('Buraya ev dikemezsin (tüm renk grubu senin olmalı, evler eşit dağılmalı, bankada ev/otel kalmış olmalı).')
      const sq = BOARD[pos] as Extract<Square, { type: 'property' }>
      p.money -= sq.house
      s.houses[pos]++
      log(s, `${name(seat)} ${sq.name} üzerine ${s.houses[pos] === 5 ? 'otel' : 'ev'} dikti.`)
      break
    }
    case 'sell': {
      if (!canSell(s, seat, pos)) throw new Error('Bu evi satamazsın')
      const sq = BOARD[pos] as Extract<Square, { type: 'property' }>
      s.houses[pos]--
      p.money += sq.house / 2
      log(s, `${name(seat)} ${sq.name} üzerindeki bir yapıyı sattı.`)
      break
    }
    case 'mortgage':
      if (!canMortgage(s, seat, pos)) throw new Error('Bu tapu ipotek edilemez')
      s.mortgaged[pos] = true
      p.money += sqPrice(pos) / 2
      log(s, `${name(seat)} ${BOARD[pos].name} tapusunu ipotek etti.`)
      break
    case 'unmortgage': {
      if (s.phase === 'debt') throw new Error('Önce borcunu öde')
      if (s.owner[pos] !== seat || !s.mortgaged[pos]) throw new Error('Bu tapu ipotekli değil')
      const cost = unmortgageCost(pos)
      if (p.money < cost) throw new Error('Yeterli paran yok')
      p.money -= cost
      s.mortgaged[pos] = false
      log(s, `${name(seat)} ${BOARD[pos].name} ipoteğini kaldırdı.`)
      break
    }
    case 'payDebt': {
      const d = s.debt
      if (!d || s.phase !== 'debt') throw new Error('Borcun yok')
      if (p.money < d.amount) throw new Error(`Kasada ${d.amount} ₺ olmalı, ev sat ya da ipotek et`)
      transfer(s, seat, d.amount, d.to, d.pot)
      log(s, `${name(seat)} ${d.amount} ₺ borcunu ödedi.`)
      s.debt = null
      s.phase = d.resume
      break
    }
    case 'autoDebt': {
      const d = s.debt
      if (!d || s.phase !== 'debt') throw new Error('Borcun yok')
      s.debt = null
      if (raise(s, seat, d.amount)) {
        transfer(s, seat, d.amount, d.to, d.pot)
        log(s, `${name(seat)} ${d.amount} ₺ borcunu ödedi.`)
        s.phase = d.resume
      } else bankrupt(s, seat, d.to)
      break
    }
    case 'bankrupt': {
      const d = s.debt
      if (!d || s.phase !== 'debt') throw new Error('Sadece borcunu ödeyemiyorsan iflas edebilirsin')
      bankrupt(s, seat, d.to)
      break
    }
    case 'propose': {
      if (seat !== s.turn || !['roll', 'end', 'debt'].includes(s.phase)) throw new Error('Takası kendi sıranda, zar atmadan önce ya da tur sonunda teklif edebilirsin')
      if ((s.tradesThisTurn ?? 0) >= 6) throw new Error('Bu tur için takas hakkın doldu')
      s.tradesThisTurn = (s.tradesThisTurn ?? 0) + 1
      proposeTrade(s, { from: seat, to: Math.floor(Number(a.to)), give: cleanBundle(a.give), take: cleanBundle(a.take), counter: false })
      break
    }
    case 'acceptTrade': {
      const t = s.trade
      if (!t) throw new Error('Bekleyen takas yok')
      s.trade = null
      executeTrade(s, t)
      break
    }
    case 'rejectTrade': {
      const t = s.trade
      if (!t) throw new Error('Bekleyen takas yok')
      s.trade = null
      log(s, `${name(seat)} takası reddetti.`)
      break
    }
    case 'counterTrade': {
      const t = s.trade
      if (!t) throw new Error('Bekleyen takas yok')
      if (t.counter) throw new Error('Karşı teklife tekrar karşı teklif verilemez')
      s.trade = null
      log(s, `${name(seat)} karşı teklif verdi.`)
      proposeTrade(s, { from: seat, to: t.from, give: cleanBundle(a.give), take: cleanBundle(a.take), counter: true })
      break
    }
    case 'end':
      if (s.phase !== 'end') throw new Error(s.phase === 'buy' ? 'Önce tapuyu al ya da pas geç' : s.phase === 'debt' ? 'Önce borcunu öde' : 'Önce zar at')
      nextTurn(s)
      break
    default:
      throw new Error('Bilinmeyen hamle')
  }

  if (s.players[s.turn].out && !s.auction) nextTurn(s)
  if (!s.auction && s.auctionQueue?.length) startAuction(s, s.auctionQueue.shift()!, s.phase === 'end' ? 'end' : 'roll')
  return { state: s, winners: finishIfOver(s) }
}

// ---------- Bot ----------

function botBid(s: MonopolyState, seat: number): Act {
  const a = s.auction!
  const p = s.players[seat]
  const pos = a.pos
  const after = [...s.owner]
  after[pos] = seat
  let value = deedValue(after, seat, pos, false)
  const sq = BOARD[pos]
  if (sq.type === 'property') {
    // Blocking a rival who already holds the rest of the colour is worth paying for.
    const others = GROUP_SQUARES[sq.group].filter((i) => i !== pos).map((i) => s.owner[i])
    if (others.length && others.every((o) => o != null && o === others[0] && o !== seat)) value *= 1.5
  }
  value *= 0.9 + Math.random() * 0.2
  const reserve = s.round < 6 ? 60 : 30
  const max = Math.floor(Math.min(value, p.money - reserve))
  const step = round10(sqPrice(pos) * 0.06)
  const next = a.leader == null ? Math.min(round10(sqPrice(pos) * 0.5), max) : a.bid + step
  if (next > a.bid && next <= max) return { type: 'bid', amount: next }
  return { type: 'fold' }
}

/** A bot that holds all but one deed of a colour offers cash for the missing one. */
/** The single deed `seat` lacks per colour group (only groups where every other cell is theirs). */
function lastMissing(s: MonopolyState, seat: number) {
  const out: number[] = []
  for (const g of Object.keys(GROUP_SQUARES) as Group[]) {
    const missing = GROUP_SQUARES[g].filter((i) => s.owner[i] !== seat)
    if (missing.length === 1) out.push(missing[0])
  }
  return out
}

/**
 * Breaks a locked board: when two players each hold the other's last missing deed, offer a straight
 * swap (plus cash to even out the value) so both can finally build.
 */
function botSwapIdea(s: MonopolyState, seat: number): Act | null {
  for (const want of lastMissing(s, seat)) {
    const holder = s.owner[want]
    if (holder == null || holder === seat || s.players[holder].out || !canTradeDeed(s, holder, want)) continue
    const theirNeeds = lastMissing(s, holder).filter((i) => s.owner[i] === seat && canTradeDeed(s, seat, i))
    for (const give of theirNeeds) {
      const take = { props: [want], money: 0, cards: 0 }
      let money = Math.max(0, round10(sqPrice(want) - sqPrice(give)))
      if (s.bots.includes(holder)) {
        const v = judgeTrade(s, { from: seat, to: holder, give: { props: [give], money, cards: 0 }, take, counter: false })
        if (!v.ok) money += Math.max(0, v.need)
      }
      if (s.players[seat].money - money < 100) continue
      return { type: 'propose', to: holder, give: { props: [give], money, cards: 0 }, take }
    }
  }
  return null
}

function botTradeIdea(s: MonopolyState, seat: number): Act | null {
  const p = s.players[seat]
  if ((p.tradeRound ?? -10) > s.round - 3) return null
  const swap = botSwapIdea(s, seat)
  if (swap) return swap
  for (const g of Object.keys(GROUP_SQUARES) as Group[]) {
    const cells = GROUP_SQUARES[g]
    const missing = cells.filter((i) => s.owner[i] !== seat)
    if (missing.length !== 1 || cells.length < 2) continue
    const pos = missing[0]
    const holder = s.owner[pos]
    if (holder == null || s.players[holder].out || !canTradeDeed(s, holder, pos)) continue
    let offer = round10(sqPrice(pos) * 2)
    const take = { props: [pos], money: 0, cards: 0 }
    if (s.bots.includes(holder)) {
      const v = judgeTrade(s, { from: seat, to: holder, give: { props: [], money: offer, cards: 0 }, take, counter: false })
      if (!v.ok) offer += v.need
    }
    if (p.money - offer < 150) continue
    return { type: 'propose', to: holder, give: { props: [], money: offer, cards: 0 }, take }
  }
  return null
}

function botAct(s: MonopolyState, seat: number): Act {
  const human = !s.bots.includes(seat)
  const p = s.players[seat]
  if (s.trade) {
    if (human) return { type: 'rejectTrade' }
    return judgeTrade(s, s.trade).ok ? { type: 'acceptTrade' } : { type: 'rejectTrade' }
  }
  if (s.auction) return human ? { type: 'fold' } : botBid(s, seat)
  if (s.phase === 'debt') return { type: 'autoDebt' }
  if (s.phase === 'roll') {
    if (!human) {
      const idea = botTradeIdea(s, seat)
      if (idea) return idea
    }
    if (p.inJail && p.cards > 0) return { type: 'useCard' }
    if (p.inJail && p.money > 350 && s.round < 12) return { type: 'payJail' }
    return { type: 'roll' }
  }
  if (s.phase === 'buy') {
    const pos = p.pos
    const sq = BOARD[pos]
    const price = sqPrice(pos)
    const completes = sq.type === 'property' && GROUP_SQUARES[sq.group].every((i) => i === pos || s.owner[i] === seat)
    const reserve = s.round < 8 ? 60 : 140
    return { type: p.money >= price && (p.money - price >= reserve || completes) ? 'buy' : 'pass' }
  }
  if (!human) {
    const reserve = s.round < 10 ? 150 : 80
    const spot = BOARD.map((_, i) => i)
      .filter((i) => canBuild(s, seat, i) && p.money - (BOARD[i] as { house: number }).house >= reserve)
      .sort((x, y) => s.houses[x] - s.houses[y] || sqPrice(y) - sqPrice(x))[0]
    if (spot != null) return { type: 'build', pos: spot }
    const m = BOARD.map((_, i) => i).find((i) => s.owner[i] === seat && s.mortgaged[i] && p.money - unmortgageCost(i) >= 400)
    if (m != null) return { type: 'unmortgage', pos: m }
  }
  return { type: 'end' }
}

/**
 * Plays for `seat` and then for any bots that have to answer (auction bids, trade replies) until
 * the turn moves on or a human has to decide. A human seat (timeout) only gets the current decision.
 */
export function monopolyBotTurn(state: MonopolyState, seat: number): MonopolyStep {
  let s = state
  const startTurn = s.turn
  const ctx = (x: MonopolyState) => (x.trade ? 't' : x.auction ? `a${x.auction.pos}` : 'turn')
  const startCtx = ctx(s)
  const human = !s.bots.includes(seat)
  for (let guard = 0; guard < 80 && s.turn === startTurn; guard++) {
    const who = monoActor(s)
    const mine = who === seat && (!human || ctx(s) === startCtx)
    if (!mine && !s.bots.includes(who)) break
    if (s.players[who].out) break
    const act = botAct(s, who)
    if (act.type === 'propose') s = { ...s, players: s.players.map((p, i) => (i === who ? { ...p, tradeRound: s.round } : p)) }
    let r: MonopolyStep
    try {
      r = monopolyStep(s, who, act)
    } catch {
      // A bot idea that turned out illegal: fall back to the safest move.
      const safe: Act = s.trade ? { type: 'rejectTrade' } : s.auction ? { type: 'fold' } : s.phase === 'debt' ? { type: 'autoDebt' } : s.phase === 'buy' ? { type: 'pass' } : s.phase === 'roll' ? { type: 'roll' } : { type: 'end' }
      r = monopolyStep(s, who, safe)
    }
    s = r.state
    if (r.winners) return r
  }
  return { state: s, winners: null }
}

export function runMonopolyBots(state: MonopolyState): MonopolyStep {
  let s = state
  for (let guard = 0; guard < 40 && s.bots.includes(monoActor(s)); guard++) {
    const r = monopolyBotTurn(s, monoActor(s))
    if (r.winners) return r
    if (r.state.seq === s.seq) break
    s = r.state
  }
  return { state: s, winners: null }
}

/** Gives clients time to walk the pawn, show the card and the rent before the next bot moves. */
export function monopolyPaceMs(s: MonopolyState) {
  if (s.auction) return 1300
  const last = s.log.at(-1) ?? ''
  const sum = s.dice ? s.dice[0] + s.dice[1] : 0
  let ms = 1500 + Math.min(12, sum) * 230
  if (s.card) ms += 1400
  if (/kira ödedi|iflas|mezat|takas/.test(last)) ms += 900
  return ms
}
