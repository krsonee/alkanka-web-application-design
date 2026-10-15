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

export type MPlayer = { money: number; pos: number; jail: number; inJail: boolean; out: boolean; cards: number; doubles: number }

export type MonopolyState = {
  kind: 'monopoly'
  seats: number
  bots: number[]
  players: MPlayer[]
  owner: (number | null)[]
  houses: number[]
  mortgaged: boolean[]
  turn: number
  phase: 'roll' | 'buy' | 'end'
  dice: [number, number] | null
  again: boolean
  chance: number[]
  chest: number[]
  card: { deck: 'chance' | 'chest'; text: string } | null
  round: number
  maxRounds: number
  log: string[]
  note: string
  seq: number
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

export function initMonopoly(opts: { seats?: number; botSeats?: number[]; rounds?: number }): MonopolyState {
  const seats = Math.max(2, Math.min(4, Math.floor(opts.seats ?? 4)))
  return {
    kind: 'monopoly',
    seats,
    bots: opts.botSeats ?? [],
    players: Array.from({ length: seats }, () => ({ money: START_MONEY, pos: 0, jail: 0, inJail: false, out: false, cards: 0, doubles: 0 })),
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
    maxRounds: opts.rounds && opts.rounds >= 10 ? Math.min(40, Math.floor(opts.rounds)) : 20,
    log: ['Oyun başladı. Herkesin kasasında 1.500 ₺ var.'],
    note: '',
    seq: 0,
  }
}

export const isBuyable = (sq: Square): sq is Extract<Square, { price: number }> => sq.type === 'property' || sq.type === 'rail' || sq.type === 'utility'
export const ownsGroup = (s: MonopolyState, seat: number, g: Group) => GROUP_SQUARES[g].every((i) => s.owner[i] === seat)

export function rentOf(s: MonopolyState, pos: number, diceSum: number, special?: 'rail2' | 'util10') {
  const sq = BOARD[pos]
  const owner = s.owner[pos]
  if (owner == null || s.mortgaged[pos]) return 0
  if (sq.type === 'property') {
    const h = s.houses[pos]
    if (h > 0) return sq.rent[h]
    return ownsGroup(s, owner, sq.group) ? sq.rent[0] * 2 : sq.rent[0]
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

export function netWorth(s: MonopolyState, seat: number) {
  let w = s.players[seat].money
  BOARD.forEach((sq, i) => {
    if (s.owner[i] !== seat || !isBuyable(sq)) return
    w += s.mortgaged[i] ? sq.price / 2 : sq.price
    if (sq.type === 'property') w += s.houses[i] * sq.house
  })
  return w
}

const alive = (s: MonopolyState) => s.players.map((p, i) => (p.out ? -1 : i)).filter((i) => i >= 0)

/** Clones the parts of state we mutate during one action. */
function draft(s: MonopolyState): MonopolyState {
  return {
    ...s,
    players: s.players.map((p) => ({ ...p })),
    owner: [...s.owner],
    houses: [...s.houses],
    mortgaged: [...s.mortgaged],
    chance: [...s.chance],
    chest: [...s.chest],
    log: [...s.log],
  }
}

/** Seat placeholder; the UI swaps `@n` for the player's name. */
const name = (seat: number) => `@${seat}`
const log = (s: MonopolyState, text: string) => {
  s.log = [...s.log, text].slice(-14)
}

/** Sells houses then mortgages deeds until the debt is covered. Returns false if still short. */
function raise(s: MonopolyState, seat: number, need: number) {
  const p = s.players[seat]
  const mine = BOARD.map((sq, i) => ({ sq, i })).filter(({ i }) => s.owner[i] === seat)
  while (p.money < need) {
    const built = mine.filter(({ sq, i }) => sq.type === 'property' && s.houses[i] > 0).sort((a, b) => s.houses[b.i] - s.houses[a.i])[0]
    if (built && built.sq.type === 'property') {
      s.houses[built.i]--
      p.money += built.sq.house / 2
      continue
    }
    const free = mine.filter(({ sq, i }) => isBuyable(sq) && !s.mortgaged[i]).sort((a, b) => (a.sq as { price: number }).price - (b.sq as { price: number }).price)[0]
    if (!free) return false
    s.mortgaged[free.i] = true
    p.money += (free.sq as { price: number }).price / 2
  }
  return true
}

/** Pays `amount` from seat to `to` (null = bank). Handles liquidation and bankruptcy. */
function pay(s: MonopolyState, seat: number, amount: number, to: number | null) {
  const p = s.players[seat]
  if (amount <= 0) return
  if (p.money < amount && !raise(s, seat, amount)) {
    const left = Math.max(0, p.money)
    if (to != null) s.players[to].money += left
    p.money = 0
    p.out = true
    BOARD.forEach((_, i) => {
      if (s.owner[i] === seat) {
        s.owner[i] = null
        s.houses[i] = 0
        s.mortgaged[i] = false
      }
    })
    log(s, `${name(seat)} iflas etti, mülkleri bankaya döndü.`)
    return
  }
  p.money -= amount
  if (to != null) s.players[to].money += amount
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
    p.money += GO_SALARY
    log(s, `${name(seat)} Başla'dan geçti, +200 ₺.`)
  }
  p.pos = to
}

function drawCard(s: MonopolyState, seat: number, deck: 'chance' | 'chest', diceSum: number, depth: number) {
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
      else pay(s, seat, -card.amount, null)
      return
    case 'free':
      p.cards++
      // The card leaves the deck while held; it goes back when used.
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
        if (card.amount < 0) pay(s, seat, -card.amount, o)
        else pay(s, o, card.amount, seat)
        if (s.players[seat].out) return
      }
      return
    case 'repair': {
      let total = 0
      BOARD.forEach((_, i) => {
        if (s.owner[i] !== seat) return
        total += s.houses[i] === 5 ? card.hotel : s.houses[i] * card.house
      })
      pay(s, seat, total, null)
      return
    }
  }
}

function land(s: MonopolyState, seat: number, diceSum: number, depth = 0, special?: 'rail2' | 'util10') {
  if (depth > 3) return
  const p = s.players[seat]
  const sq = BOARD[p.pos]
  if (sq.type === 'gotojail') return sendToJail(s, seat)
  if (sq.type === 'tax') {
    log(s, `${name(seat)} ${sq.name} ödedi: ${sq.amount} ₺.`)
    return pay(s, seat, sq.amount, null)
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
      log(s, `${name(seat)}, ${sq.name} için ${name(owner)} oyuncusuna ${rent} ₺ kira ödedi.`)
      pay(s, seat, rent, owner)
    }
  }
}

function afterMove(s: MonopolyState, seat: number) {
  if (s.phase === 'buy') return
  s.phase = s.again && !s.players[seat].inJail && !s.players[seat].out ? 'roll' : 'end'
}

function finishIfOver(s: MonopolyState): number[] | null {
  const live = alive(s)
  if (live.length <= 1) return live
  if (s.round > s.maxRounds) {
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
  s.players[next].doubles = 0
}

function roll(s: MonopolyState, seat: number) {
  const p = s.players[seat]
  const a = d6()
  const b = d6()
  const sum = a + b
  const dbl = a === b
  s.dice = [a, b]
  s.card = null
  s.seq++
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
    pay(s, seat, JAIL_FINE, null)
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

export function canBuild(s: MonopolyState, seat: number, pos: number) {
  const sq = BOARD[pos]
  if (sq.type !== 'property' || s.owner[pos] !== seat || !ownsGroup(s, seat, sq.group)) return false
  const group = GROUP_SQUARES[sq.group]
  if (group.some((i) => s.mortgaged[i])) return false
  if (s.houses[pos] >= 5) return false
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

export function monopolyStep(state: MonopolyState, seat: number, a: Act): MonopolyStep {
  if (state.turn !== seat) throw new Error('Sıra sende değil')
  const s = draft(state)
  const p = s.players[seat]
  if (p.out) throw new Error('İflas ettin')
  const pos = Math.floor(Number(a.pos))

  switch (a.type) {
    case 'roll':
      if (s.phase !== 'roll') throw new Error('Şu an zar atamazsın')
      roll(s, seat)
      break
    case 'payJail':
      if (s.phase !== 'roll' || !p.inJail) throw new Error('Hapiste değilsin')
      if (p.money < JAIL_FINE) throw new Error('Yeterli paran yok')
      p.money -= JAIL_FINE
      p.inJail = false
      p.jail = 0
      log(s, `${name(seat)} ${JAIL_FINE} ₺ ödeyip hapisten çıktı.`)
      break
    case 'useCard':
      if (s.phase !== 'roll' || !p.inJail || p.cards < 1) throw new Error('Kartın yok')
      p.cards--
      p.inJail = false
      p.jail = 0
      // Return the card to the bottom of a deck.
      s.chance.push(CHANCE.findIndex((c) => c.kind === 'free'))
      log(s, `${name(seat)} hapisten çıkış kartını kullandı.`)
      break
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
      s.phase = 'end'
      afterMove(s, seat)
      break
    case 'build': {
      if (!canBuild(s, seat, pos)) throw new Error('Buraya ev dikemezsin (tüm renk grubu senin olmalı, evler eşit dağılmalı).')
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
      if (s.owner[pos] !== seat || !s.mortgaged[pos]) throw new Error('Bu tapu ipotekli değil')
      const cost = unmortgageCost(pos)
      if (p.money < cost) throw new Error('Yeterli paran yok')
      p.money -= cost
      s.mortgaged[pos] = false
      log(s, `${name(seat)} ${BOARD[pos].name} ipoteğini kaldırdı.`)
      break
    }
    case 'end':
      if (s.phase !== 'end') throw new Error(s.phase === 'buy' ? 'Önce tapuyu al ya da pas geç' : 'Önce zar at')
      nextTurn(s)
      break
    default:
      throw new Error('Bilinmeyen hamle')
  }
  if (s.players[seat].out && s.turn === seat) nextTurn(s)
  return { state: s, winners: finishIfOver(s) }
}

// ---------- Bot ----------

export function monopolyBotTurn(state: MonopolyState, seat: number): MonopolyStep {
  let s = state
  const step = (a: Act) => {
    const r = monopolyStep(s, seat, a)
    s = r.state
    return r
  }
  for (let guard = 0; guard < 12 && s.turn === seat; guard++) {
    const p = s.players[seat]
    let r: MonopolyStep
    if (s.phase === 'roll') {
      if (p.inJail && p.cards > 0) r = step({ type: 'useCard' })
      else if (p.inJail && p.money > 350 && s.round < 12) r = step({ type: 'payJail' })
      else r = step({ type: 'roll' })
    } else if (s.phase === 'buy') {
      const pos = p.pos
      const sq = BOARD[pos]
      const price = sqPrice(pos)
      const completes = sq.type === 'property' && GROUP_SQUARES[sq.group].every((i) => i === pos || s.owner[i] === seat)
      r = step({ type: p.money >= price && (p.money - price >= 120 || completes) ? 'buy' : 'pass' })
    } else {
      for (let b = 0; b < 4; b++) {
        const spot = BOARD.map((_, i) => i).find((i) => canBuild(s, seat, i) && s.players[seat].money - (BOARD[i] as { house: number }).house >= 250)
        if (spot == null) break
        step({ type: 'build', pos: spot })
      }
      const m = BOARD.map((_, i) => i).find((i) => s.owner[i] === seat && s.mortgaged[i] && s.players[seat].money - unmortgageCost(i) >= 500)
      if (m != null) step({ type: 'unmortgage', pos: m })
      r = step({ type: 'end' })
    }
    if (r.winners) return r
  }
  return { state: s, winners: null }
}

export function runMonopolyBots(state: MonopolyState): MonopolyStep {
  let s = state
  for (let guard = 0; guard < 24 && s.bots.includes(s.turn); guard++) {
    const r = monopolyBotTurn(s, s.turn)
    if (r.winners) return r
    if (r.state.turn === s.turn && r.state.phase === s.phase && r.state.seq === s.seq) break
    s = r.state
  }
  return { state: s, winners: null }
}
