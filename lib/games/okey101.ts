import { chooseDiscard, createDeck, isJoker, okeyFrom, type Okey, type Tile } from '@/components/alkanka/arena/okey-engine'

export type MeldKind = 'run' | 'set' | 'pair'
export type Meld101 = { id: number; owner: number; kind: MeldKind; tiles: Tile[] }
export type Open101 = 'seri' | 'cift' | null
export type Log101 = { seat: number; text: string; tile?: Tile }
export type FinishHow = 'normal' | 'okey' | 'elden' | 'cift' | 'cift-okey' | 'deste'
export type HandResult = {
  hand: number
  scores: number[]
  finisher: number | null
  double: boolean
  mult?: number
  how?: FinishHow
  /** Snapshot taken at hand end so the breakdown survives the next deal. */
  opened?: Open101[]
  penalties?: number[]
  /** Table melds at hand end; kept only on the latest result to keep the state small. */
  melds?: Meld101[]
}

export type Okey101State = {
  kind: 'okey101'
  seats: number
  bots: number[]
  /** Eşli 101: seats i and i+2 are partners and share one score. */
  team?: boolean
  deck: Tile[]
  indicator: Tile
  hands: Tile[][]
  discards: Tile[][]
  melds: Meld101[]
  opened: Open101[]
  openedTurn: number[]
  penalties: number[]
  totals: number[]
  handNo: number
  handsTotal: number
  dealer: number
  turn: number
  turnNo: number
  phase: 'draw' | 'play'
  /** Tile an unopened player took from the side this turn; they must open with it or give it back. */
  taken: number | null
  noTake: boolean
  nextId: number
  log: Log101[]
  results: HandResult[]
  note: string
}

export const OPEN_MIN = 101
export const PAIR_MIN = 5
export const PENALTY = 101

type Act = { type: string; [k: string]: unknown }
export type Step101 = { state: Okey101State; winners: number[] | null }

export const leftOf101 = (seat: number, n: number) => (seat - 1 + n) % n
const posNum = (p: number) => (p === 14 ? 1 : p)
const realOf = (t: Tile, ok: Okey) => (t.fake ? { color: ok.color, num: ok.num } : { color: t.color, num: t.num })

/** Points a tile counts as when it is left in hand at the end of a hand. */
export const tilePoints = (t: Tile, ok: Okey) => (isJoker(t, ok) ? ok.num : realOf(t, ok).num)

type Analysis = { kind: MeldKind; value: number; ordered: Tile[] }

function runLayout(tiles: Tile[], ok: Okey): { value: number; ordered: Tile[] } | null {
  const jokers = tiles.filter((t) => isJoker(t, ok))
  const reals = tiles.filter((t) => !isJoker(t, ok))
  const n = tiles.length
  if (n < 3 || n > 13 || reals.length === 0) return null
  const vals = reals.map((t) => realOf(t, ok))
  if (!vals.every((v) => v.color === vals[0].color)) return null
  const nums = vals.map((v) => v.num)
  if (new Set(nums).size !== nums.length) return null
  // 1 can sit low (1-2-3) or after 13 (12-13-1). 13-1-2 is not allowed, so 14 is the top position.
  const options = nums.includes(1) ? [nums, nums.map((x) => (x === 1 ? 14 : x))] : [nums]
  let best: { value: number; ordered: Tile[] } | null = null
  for (const opt of options) {
    const lo = Math.min(...opt)
    const hi = Math.max(...opt)
    if (hi - lo + 1 > n) continue
    let extra = n - (hi - lo + 1)
    let end = hi
    const up = Math.min(extra, 14 - end)
    end += up
    extra -= up
    const start = lo - extra
    if (start < 1) continue
    const byPos = new Map(opt.map((p, i) => [p, reals[i]]))
    const ordered: Tile[] = []
    let ji = 0
    let value = 0
    for (let p = start; p <= end; p++) {
      value += posNum(p)
      ordered.push(byPos.get(p) ?? jokers[ji++])
    }
    if (!best || value > best.value) best = { value, ordered }
  }
  return best
}

export function analyzeMeld(tiles: Tile[], ok: Okey): Analysis | null {
  const jokers = tiles.filter((t) => isJoker(t, ok))
  const reals = tiles.filter((t) => !isJoker(t, ok))
  if (tiles.length === 2) {
    if (jokers.length > 0) return { kind: 'pair', value: 0, ordered: tiles }
    const [a, b] = reals.map((t) => realOf(t, ok))
    return a.color === b.color && a.num === b.num ? { kind: 'pair', value: 0, ordered: tiles } : null
  }
  if (tiles.length < 3 || reals.length === 0) return null
  let best: Analysis | null = null
  const vals = reals.map((t) => realOf(t, ok))
  if (
    tiles.length <= 4 &&
    vals.every((v) => v.num === vals[0].num) &&
    new Set(vals.map((v) => v.color)).size === vals.length
  ) {
    const sorted = [...reals].sort((x, y) => realOf(x, ok).color - realOf(y, ok).color)
    best = { kind: 'set', value: vals[0].num * tiles.length, ordered: [...sorted, ...jokers] }
  }
  const run = runLayout(tiles, ok)
  if (run && (!best || run.value > best.value)) best = { kind: 'run', ...run }
  return best
}

/** True when the tile could be added to one of the run/set melds on the table. */
export function canAddToTable(tile: Tile, melds: Meld101[], ok: Okey) {
  return melds.some((m) => {
    if (m.kind === 'pair') return false
    const a = analyzeMeld([...m.tiles, tile], ok)
    return a != null && a.kind === m.kind
  })
}

/** Index of the joker in a table meld that the given real tile can replace, or -1. */
export function jokerSwapIndex(tile: Tile, meld: Meld101, ok: Okey) {
  if (meld.kind === 'pair' || isJoker(tile, ok)) return -1
  for (let i = 0; i < meld.tiles.length; i++) {
    if (!isJoker(meld.tiles[i], ok)) continue
    const swapped = meld.tiles.map((t, k) => (k === i ? tile : t))
    const a = analyzeMeld(swapped, ok)
    if (a && a.kind === meld.kind && a.ordered.length === meld.tiles.length) return i
  }
  return -1
}

/** True when an unopened player could open their hand using this side tile. */
export function canOpenWithTile(hand: Tile[], tile: Tile, ok: Okey) {
  const all = [...hand, tile]
  const best = bestPartition(all, ok)
  const groups = leaveOne(best.groups, all.length, ok)
  const value = groups.reduce((sum, g) => sum + (analyzeMeld(g, ok)?.value ?? 0), 0)
  if (value >= OPEN_MIN && groups.flat().some((t) => t.id === tile.id)) return true
  const pairs = leaveOne(findPairs(all, ok), all.length, ok)
  return pairs.length >= PAIR_MIN && pairs.flat().some((t) => t.id === tile.id)
}

/** An opened player may only take a side tile they can lay or add this turn. */
export function canUseSideTile(s: Pick<Okey101State, 'hands' | 'melds' | 'opened' | 'indicator'>, seat: number, tile: Tile) {
  const ok = okeyFrom(s.indicator)
  if (canAddToTable(tile, s.melds, ok)) return true
  if (s.melds.some((m) => jokerSwapIndex(tile, m, ok) >= 0)) return true
  const all = [...s.hands[seat], tile]
  if (s.opened[seat] === 'seri' && bestPartition(all, ok).groups.flat().some((t) => t.id === tile.id)) return true
  const pairsAllowed = s.opened[seat] === 'cift' || s.opened.some((o) => o === 'cift')
  return pairsAllowed && findPairs(all, ok).flat().some((t) => t.id === tile.id)
}

// ---------- Bot search ----------

type Cand = { need: [number, number][]; jokers: number; value: number }

function toCounts(tiles: Tile[], ok: Okey) {
  const counts = Array.from({ length: 4 }, () => Array(15).fill(0) as number[])
  let jokers = 0
  for (const t of tiles) {
    if (isJoker(t, ok)) jokers++
    else {
      const v = realOf(t, ok)
      counts[v.color][v.num]++
    }
  }
  return { counts, jokers }
}

function candidates(counts: number[][], jokers: number): Cand[] {
  const out: Cand[] = []
  for (let c = 0; c < 4; c++) {
    for (let start = 1; start <= 12; start++) {
      let missing = 0
      let value = 0
      const need: [number, number][] = []
      for (let end = start; end <= Math.min(start + 12, 14); end++) {
        const num = posNum(end)
        if (counts[c][num] > 0) need.push([c, num])
        else missing++
        value += num
        if (missing > jokers) break
        if (end - start + 1 >= 3 && need.length > 0) out.push({ need: [...need], jokers: missing, value })
      }
    }
  }
  for (let num = 1; num <= 13; num++) {
    const colors = [0, 1, 2, 3].filter((c) => counts[c][num] > 0)
    for (let mask = 1; mask < 1 << colors.length; mask++) {
      const picked = colors.filter((_, i) => mask & (1 << i))
      for (let j = 0; j <= jokers; j++) {
        const size = picked.length + j
        if (size < 3 || size > 4) continue
        out.push({ need: picked.map((c) => [c, num] as [number, number]), jokers: j, value: num * size })
      }
    }
  }
  return out.sort((a, b) => b.value - a.value)
}

/** Best set of non-overlapping runs/sets from a hand (bounded search). */
export function bestPartition(hand: Tile[], ok: Okey): { groups: Tile[][]; value: number } {
  const { counts, jokers } = toCounts(hand, ok)
  const cands = candidates(counts, jokers)
  let best: { value: number; pick: Cand[] } = { value: 0, pick: [] }
  const pick: Cand[] = []
  let nodes = 0
  const dfs = (from: number, jLeft: number, val: number) => {
    if (++nodes > 30000) return
    if (val > best.value) best = { value: val, pick: [...pick] }
    for (let k = from; k < cands.length; k++) {
      const c = cands[k]
      if (c.jokers > jLeft || !c.need.every(([col, n]) => counts[col][n] > 0)) continue
      c.need.forEach(([col, n]) => counts[col][n]--)
      pick.push(c)
      dfs(k, jLeft - c.jokers, val + c.value)
      pick.pop()
      c.need.forEach(([col, n]) => counts[col][n]++)
      if (nodes > 30000) return
    }
  }
  dfs(0, jokers, 0)
  const used = new Set<number>()
  const groups: Tile[][] = []
  for (const c of best.pick) {
    const g: Tile[] = []
    for (const [col, n] of c.need) {
      const t = hand.find((x) => !used.has(x.id) && !isJoker(x, ok) && realOf(x, ok).color === col && realOf(x, ok).num === n)
      if (t) {
        used.add(t.id)
        g.push(t)
      }
    }
    for (let j = 0; j < c.jokers; j++) {
      const t = hand.find((x) => !used.has(x.id) && isJoker(x, ok))
      if (t) {
        used.add(t.id)
        g.push(t)
      }
    }
    const a = analyzeMeld(g, ok)
    if (a && a.kind !== 'pair') groups.push(a.ordered)
  }
  return { groups, value: groups.reduce((s, g) => s + (analyzeMeld(g, ok)?.value ?? 0), 0) }
}

export function findPairs(hand: Tile[], ok: Okey): Tile[][] {
  const jokers = hand.filter((t) => isJoker(t, ok))
  const map = new Map<string, Tile[]>()
  for (const t of hand) {
    if (isJoker(t, ok)) continue
    const v = realOf(t, ok)
    const k = `${v.color}-${v.num}`
    map.set(k, [...(map.get(k) ?? []), t])
  }
  const pairs: Tile[][] = []
  const singles: Tile[] = []
  for (const list of map.values()) {
    for (let i = 0; i + 1 < list.length; i += 2) pairs.push([list[i], list[i + 1]])
    if (list.length % 2) singles.push(list[list.length - 1])
  }
  singles.sort((a, b) => realOf(b, ok).num - realOf(a, ok).num)
  for (const j of jokers) {
    const s = singles.shift()
    if (s) pairs.push([s, j])
  }
  return pairs
}

/** Keeps at least one tile in hand so the player can still discard. */
function leaveOne(groups: Tile[][], handSize: number, ok: Okey): Tile[][] {
  const used = groups.reduce((s, g) => s + g.length, 0)
  if (used < handSize) return groups
  const out = groups.map((g) => [...g])
  const last = out[out.length - 1]
  if (last && last.length > 3) {
    const trimmed = analyzeMeld(last.slice(0, -1), ok) ? last.slice(0, -1) : last.slice(1)
    out[out.length - 1] = trimmed
    return out
  }
  return out.slice(0, -1)
}

// ---------- Game flow ----------

function deal(seats: number, dealer: number) {
  const deck = createDeck()
  const idx = deck.findIndex((t) => !t.fake)
  const [indicator] = deck.splice(idx, 1)
  const hands = Array.from({ length: seats }, (_, i) => deck.splice(0, i === dealer ? 22 : 21))
  return { deck, indicator, hands }
}

export const partnerOf101 = (seat: number, n: number) => (n === 4 ? (seat + 2) % 4 : seat)
/** Score that decides the ranking: a seat's own total, or the pair's combined total in eşli 101. */
export const rankTotals101 = (s: Pick<Okey101State, 'totals' | 'team' | 'seats'>) =>
  s.totals.map((t, i) => (s.team ? t + s.totals[partnerOf101(i, s.seats)] : t))

export function initOkey101(opts: { seats?: number; botSeats?: number[]; rounds?: number; team?: boolean }): Okey101State {
  const seats = opts.seats === 2 ? 2 : 4
  const dealer = Math.floor(Math.random() * seats)
  const d = deal(seats, dealer)
  return {
    kind: 'okey101',
    seats,
    bots: opts.botSeats ?? [],
    team: seats === 4 && opts.team === true,
    ...d,
    discards: Array.from({ length: seats }, () => []),
    melds: [],
    opened: Array(seats).fill(null),
    openedTurn: Array(seats).fill(-1),
    penalties: Array(seats).fill(0),
    totals: Array(seats).fill(0),
    handNo: 1,
    handsTotal: opts.rounds && opts.rounds > 1 ? Math.min(5, Math.floor(opts.rounds)) : 1,
    dealer,
    turn: dealer,
    turnNo: 0,
    phase: 'play',
    taken: null,
    noTake: false,
    nextId: 1,
    log: [],
    results: [],
    note: 'Taşlar dağıtıldı. 22 taşı olan oyuncu bir taş atarak başlar.',
  }
}

const pushLog = (s: Okey101State, entry: Log101) => [...s.log, entry].slice(-10)

function endHand(s: Okey101State, finisher: number | null, mult: number, how: FinishHow): Step101 {
  const ok = okeyFrom(s.indicator)
  const double = mult > 1
  const scores = s.hands.map((h, i) => {
    if (i === finisher) return -PENALTY * mult + s.penalties[i]
    if (!s.opened[i]) return 202 * mult + s.penalties[i]
    // An okey still in an opened hand is written as 101: it could have been played anywhere.
    const rest = h.reduce((sum, t) => sum + (isJoker(t, ok) ? PENALTY : tilePoints(t, ok)), 0)
    return rest * (s.opened[i] === 'cift' ? 2 : 1) * mult + s.penalties[i]
  })
  const totals = s.totals.map((t, i) => t + scores[i])
  const results = [
    ...s.results.map(({ melds: _melds, ...r }) => r),
    { hand: s.handNo, scores, finisher, double, mult, how, opened: [...s.opened], penalties: [...s.penalties], melds: s.melds },
  ]
  const note =
    finisher == null
      ? `${s.handNo}. el: ortada taş kalmadı, el kapandı.`
      : `${s.handNo}. el bitti${double ? ` (cezalar ${mult} kat)` : ''}.`
  if (s.handNo < s.handsTotal) {
    const dealer = (s.dealer + 1) % s.seats
    const d = deal(s.seats, dealer)
    return {
      state: {
        ...s,
        ...d,
        discards: Array.from({ length: s.seats }, () => []),
        melds: [],
        opened: Array(s.seats).fill(null),
        openedTurn: Array(s.seats).fill(-1),
        penalties: Array(s.seats).fill(0),
        totals,
        results,
        handNo: s.handNo + 1,
        dealer,
        turn: dealer,
        turnNo: s.turnNo + 1,
        phase: 'play',
        taken: null,
        noTake: false,
        log: [],
        note: `${note} Yeni el dağıtıldı.`,
      },
      winners: null,
    }
  }
  const ranked = rankTotals101({ totals, team: s.team, seats: s.seats })
  const min = Math.min(...ranked)
  const winners = ranked.map((t, i) => (t === min ? i : -1)).filter((i) => i >= 0)
  return { state: { ...s, totals, results, note: `${note} Oyun bitti.` }, winners }
}

function takeTiles(hand: Tile[], ids: number[]) {
  if (new Set(ids).size !== ids.length) throw new Error('Aynı taşı iki kez kullanamazsın.')
  const picked = ids.map((id) => {
    const t = hand.find((x) => x.id === id)
    if (!t) throw new Error('Taş elinde değil.')
    return t
  })
  return { picked, rest: hand.filter((t) => !ids.includes(t.id)) }
}

function parseGroups(raw: unknown): number[][] {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 12) throw new Error('Per seçilmedi.')
  return raw.map((g) => {
    if (!Array.isArray(g) || g.length < 2 || g.length > 13) throw new Error('Geçersiz per.')
    return g.map((x) => Number(x))
  })
}

function placeGroups(s: Okey101State, seat: number, groups: number[][], mode: 'seri' | 'cift' | 'karma') {
  const ok = okeyFrom(s.indicator)
  const { rest } = takeTiles(s.hands[seat], groups.flat())
  if (rest.length < 1) throw new Error('Atmak için elinde en az bir taş kalmalı.')
  let nextId = s.nextId
  let value = 0
  const melds: Meld101[] = groups.map((ids) => {
    const tiles = ids.map((id) => s.hands[seat].find((t) => t.id === id)!)
    const a = analyzeMeld(tiles, ok)
    if (!a) throw new Error('Perlerden biri geçerli değil.')
    if (mode === 'seri' && a.kind === 'pair') throw new Error('Seri açışta çift kullanılamaz.')
    if (mode === 'cift' && a.kind !== 'pair') throw new Error('Çift açışta sadece çiftler olur.')
    value += a.value
    return { id: nextId++, owner: seat, kind: a.kind, tiles: a.ordered }
  })
  return { rest, melds, nextId, value }
}

/** One 101 step for any seat. Validates everything; never trusts the client. */
export function okey101Step(s: Okey101State, seat: number, a: Act): Step101 {
  if (s.turn !== seat) throw new Error('Sıra sende değil')
  const n = s.seats
  const ok = okeyFrom(s.indicator)
  const hands = s.hands.map((h) => [...h])
  const discards = s.discards.map((d) => [...d])

  if (a.type === 'draw') {
    if (s.phase !== 'draw') throw new Error('Önce taş at')
    if (a.from === 'discard') {
      if (s.noTake) throw new Error('Bu tur yandan taş alamazsın, desteden çek.')
      const t = discards[leftOf101(seat, n)].at(-1)
      if (!t) throw new Error('Alınacak taş yok')
      if (!s.opened[seat] && !canOpenWithTile(hands[seat], t, ok)) {
        throw new Error('Elin açmıyor: yandan taş alamazsın, ortadan çek.')
      }
      if (s.opened[seat] && !canUseSideTile(s, seat, t)) {
        throw new Error('Bu taşı işleyemez ya da per yapamazsın: ortadan çek.')
      }
      discards[leftOf101(seat, n)].pop()
      hands[seat].push(t)
      return {
        state: { ...s, hands, discards, phase: 'play', taken: t.id, log: pushLog(s, { seat, text: 'yandan aldı', tile: t }) },
        winners: null,
      }
    }
    const deck = [...s.deck]
    const t = deck.shift()
    if (!t) return endHand(s, null, 1, 'deste')
    hands[seat].push(t)
    return { state: { ...s, deck, hands, phase: 'play', taken: null, log: pushLog(s, { seat, text: 'desteden çekti' }) }, winners: null }
  }

  if (s.phase !== 'play') throw new Error('Önce taş çek')

  if (a.type === 'giveBack') {
    if (s.taken == null) throw new Error('Geri verilecek taş yok')
    const idx = hands[seat].findIndex((t) => t.id === s.taken)
    if (idx < 0) throw new Error('Taş bulunamadı')
    const [t] = hands[seat].splice(idx, 1)
    discards[leftOf101(seat, n)].push(t)
    const penalties = s.penalties.map((p, i) => (i === seat ? p + PENALTY : p))
    return {
      state: { ...s, hands, discards, penalties, taken: null, noTake: true, phase: 'draw', log: pushLog(s, { seat, text: 'yandan aldığı taşı geri verdi (+101 ceza)', tile: t }) },
      winners: null,
    }
  }

  if (a.type === 'open') {
    if (s.opened[seat]) throw new Error('Elin zaten açık')
    const mode = a.mode === 'cift' ? 'cift' : 'seri'
    const groups = parseGroups(a.groups)
    const placed = placeGroups(s, seat, groups, mode)
    if (mode === 'seri' && placed.value < OPEN_MIN) throw new Error(`Açmak için en az ${OPEN_MIN} sayı gerekir (şu an ${placed.value}).`)
    if (mode === 'cift' && groups.length < PAIR_MIN) throw new Error(`Çiftten açmak için en az ${PAIR_MIN} çift gerekir.`)
    if (s.taken != null && !groups.flat().includes(s.taken)) throw new Error('Yandan aldığın taşı açtığın perlerde kullanmalısın.')
    hands[seat] = placed.rest
    const opened = s.opened.map((o, i) => (i === seat ? mode : o))
    const openedTurn = s.openedTurn.map((o, i) => (i === seat ? s.turnNo : o))
    return {
      state: {
        ...s,
        hands,
        melds: [...s.melds, ...placed.melds],
        nextId: placed.nextId,
        opened,
        openedTurn,
        taken: null,
        log: pushLog(s, { seat, text: mode === 'cift' ? `${groups.length} çiftle açtı` : `${placed.value} ile elini açtı` }),
      },
      winners: null,
    }
  }

  if (a.type === 'lay') {
    const mode = s.opened[seat]
    if (!mode) throw new Error('Önce elini açmalısın')
    const groups = parseGroups(a.groups)
    // A series opener may also lay pairs once someone at the table has opened with pairs.
    const anyPairOpener = s.opened.some((o) => o === 'cift')
    const placed = placeGroups(s, seat, groups, mode === 'seri' && anyPairOpener ? 'karma' : mode)
    hands[seat] = placed.rest
    const taken = s.taken != null && groups.flat().includes(s.taken) ? null : s.taken
    return {
      state: { ...s, hands, taken, melds: [...s.melds, ...placed.melds], nextId: placed.nextId, log: pushLog(s, { seat, text: 'yeni per açtı' }) },
      winners: null,
    }
  }

  if (a.type === 'add') {
    if (!s.opened[seat]) throw new Error('İşlemek için önce elini açmalısın')
    const meld = s.melds.find((m) => m.id === Number(a.meldId))
    if (!meld) throw new Error('Per bulunamadı')
    if (meld.kind === 'pair') throw new Error('Çiftlere taş işlenmez')
    const ids = Array.isArray(a.tileIds) ? a.tileIds.map(Number) : []
    if (!ids.length) throw new Error('Taş seçilmedi')
    const { picked, rest } = takeTiles(hands[seat], ids)
    if (rest.length < 1) throw new Error('Atmak için elinde en az bir taş kalmalı.')
    const an = analyzeMeld([...meld.tiles, ...picked], ok)
    if (!an || an.kind !== meld.kind) throw new Error('Bu taş bu pere işlenmiyor')
    hands[seat] = rest
    return {
      state: {
        ...s,
        hands,
        taken: s.taken != null && ids.includes(s.taken) ? null : s.taken,
        melds: s.melds.map((m) => (m.id === meld.id ? { ...m, tiles: an.ordered } : m)),
        log: pushLog(s, { seat, text: 'taş işledi', tile: picked[0] }),
      },
      winners: null,
    }
  }

  if (a.type === 'swapJoker') {
    if (!s.opened[seat]) throw new Error('Okeyi almak için önce elini açmalısın')
    const meld = s.melds.find((m) => m.id === Number(a.meldId))
    if (!meld) throw new Error('Per bulunamadı')
    const idx = hands[seat].findIndex((t) => t.id === Number(a.tileId))
    if (idx < 0) throw new Error('Taş elinde değil')
    const tile = hands[seat][idx]
    const j = jokerSwapIndex(tile, meld, ok)
    if (j < 0) throw new Error('Bu taş perdeki okeyin yerini tutmuyor')
    const joker = meld.tiles[j]
    hands[seat].splice(idx, 1, joker)
    const swapped = analyzeMeld(meld.tiles.map((t, k) => (k === j ? tile : t)), ok)!
    return {
      state: {
        ...s,
        hands,
        taken: s.taken === tile.id ? null : s.taken,
        melds: s.melds.map((m) => (m.id === meld.id ? { ...m, tiles: swapped.ordered } : m)),
        log: pushLog(s, { seat, text: 'gerçek taşı koyup okeyi aldı', tile }),
      },
      winners: null,
    }
  }

  if (a.type === 'discard') {
    if (s.taken != null) {
      throw new Error(
        s.opened[seat]
          ? 'Yandan aldığın taşı bu tur işlemeli ya da per yapmalısın; yoksa geri ver (101 ceza).'
          : 'Yandan aldığın taşla el açmalı ya da taşı geri vermelisin (101 ceza).',
      )
    }
    const idx = hands[seat].findIndex((t) => t.id === Number(a.tileId))
    if (idx < 0) throw new Error('Taş bulunamadı')
    const [tile] = hands[seat].splice(idx, 1)
    discards[seat].push(tile)
    const joker = isJoker(tile, ok)
    if (hands[seat].length === 0) {
      const fromHand = s.openedTurn[seat] === s.turnNo
      const pairOpener = s.opened[seat] === 'cift'
      const mult = (joker || fromHand ? 2 : 1) * (pairOpener ? 2 : 1)
      const how: FinishHow = pairOpener ? (joker ? 'cift-okey' : 'cift') : fromHand ? 'elden' : joker ? 'okey' : 'normal'
      const label = { normal: 'elini bitirdi!', okey: 'okeyle bitirdi!', elden: 'elden bitirdi!', cift: 'çiftten bitirdi!', 'cift-okey': 'okeyle çiftten bitirdi!', deste: '' }[how]
      const text = mult > 1 ? `${label} (cezalar ${mult} kat)` : label
      return endHand({ ...s, hands, discards, log: pushLog(s, { seat, text, tile }) }, seat, mult, how)
    }
    let penalty = 0
    let text = 'taş attı'
    if (joker) {
      penalty = PENALTY
      text = 'okey attı (+101 ceza)'
    } else if (canAddToTable(tile, s.melds, ok)) {
      penalty = PENALTY
      text = 'işlek taş attı (+101 ceza)'
    }
    const penalties = s.penalties.map((p, i) => (i === seat ? p + penalty : p))
    const next: Okey101State = {
      ...s,
      hands,
      discards,
      penalties,
      turn: (seat + 1) % n,
      turnNo: s.turnNo + 1,
      phase: 'draw',
      taken: null,
      noTake: false,
      log: pushLog(s, { seat, text, tile }),
      note: '',
    }
    if (next.deck.length === 0) return endHand(next, null, 1, 'deste')
    return { state: next, winners: null }
  }
  throw new Error('Bilinmeyen hamle')
}

/** Full turn for a bot (or for a human whose clock ran out). */
export function okey101BotTurn(state: Okey101State, seat: number): Step101 {
  let s = state
  const ok = okeyFrom(s.indicator)
  const run = (a: Act) => {
    const r = okey101Step(s, seat, a)
    s = r.state
    return r
  }

  if (s.phase === 'draw') {
    const top = s.discards[leftOf101(seat, s.seats)].at(-1)
    let from: 'pile' | 'discard' = 'pile'
    if (top && !s.noTake) {
      if (s.opened[seat]) from = canAddToTable(top, s.melds, ok) ? 'discard' : 'pile'
      else if (canOpenWithTile(s.hands[seat], top, ok)) from = 'discard'
    }
    const r = run({ type: 'draw', from })
    if (r.winners || s.turn !== seat || s.handNo !== state.handNo) return r
  }

  if (!s.opened[seat]) {
    const hand = s.hands[seat]
    const best = bestPartition(hand, ok)
    const groups = leaveOne(best.groups, hand.length, ok)
    const value = groups.reduce((sum, g) => sum + (analyzeMeld(g, ok)?.value ?? 0), 0)
    const takenOk = (gs: Tile[][]) => s.taken == null || gs.flat().some((t) => t.id === s.taken)
    if (value >= OPEN_MIN && takenOk(groups)) {
      run({ type: 'open', mode: 'seri', groups: groups.map((g) => g.map((t) => t.id)) })
    } else {
      const pairs = leaveOne(findPairs(hand, ok), hand.length, ok)
      if (pairs.length >= PAIR_MIN && takenOk(pairs)) run({ type: 'open', mode: 'cift', groups: pairs.map((g) => g.map((t) => t.id)) })
    }
    if (s.taken != null) {
      run({ type: 'giveBack' })
      const r = run({ type: 'draw', from: 'pile' })
      if (r.winners || s.handNo !== state.handNo) return r
    }
  }

  const playOpened = () => {
    if (s.opened[seat] === 'seri') {
      const extra = leaveOne(bestPartition(s.hands[seat], ok).groups, s.hands[seat].length, ok)
      if (extra.length) run({ type: 'lay', groups: extra.map((g) => g.map((t) => t.id)) })
    } else {
      const pairs = leaveOne(findPairs(s.hands[seat], ok), s.hands[seat].length, ok)
      if (pairs.length) run({ type: 'lay', groups: pairs.map((g) => g.map((t) => t.id)) })
    }
    for (let guard = 0; guard < 20 && s.hands[seat].length > 1; guard++) {
      const addable = (t: Tile) => canAddToTable(t, s.melds, ok)
      const tile = s.hands[seat].find((t) => t.id === s.taken && addable(t)) ?? s.hands[seat].find(addable)
      if (!tile) break
      const meld = s.melds.find((m) => m.kind !== 'pair' && analyzeMeld([...m.tiles, tile], ok)?.kind === m.kind)!
      run({ type: 'add', meldId: meld.id, tileIds: [tile.id] })
    }
  }

  if (s.opened[seat]) {
    playOpened()
    if (s.taken != null) {
      run({ type: 'giveBack' })
      const r = run({ type: 'draw', from: 'pile' })
      if (r.winners || s.handNo !== state.handNo) return r
      playOpened()
    }
  }

  const hand = s.hands[seat]
  let out: Tile
  if (hand.length === 1) out = hand[0]
  else {
    const safe = hand.filter((t) => !isJoker(t, ok) && !canAddToTable(t, s.melds, ok))
    const pool = safe.length ? safe : hand
    out = s.opened[seat] ? [...pool].sort((x, y) => tilePoints(y, ok) - tilePoints(x, ok))[0] : chooseDiscard(pool, ok)
  }
  return run({ type: 'discard', tileId: out.id })
}

export function runOkey101Bots(state: Okey101State): Step101 {
  let s = state
  for (let guard = 0; guard < 40 && s.bots.includes(s.turn); guard++) {
    const r = okey101BotTurn(s, s.turn)
    if (r.winners) return r
    s = r.state
  }
  return { state: s, winners: null }
}

export function viewOkey101(s: Okey101State, seat: number) {
  return {
    ...s,
    deck: [],
    deckCount: s.deck.length,
    hands: s.hands.map((h, i) => (i === seat ? h : [])),
    handCounts: s.hands.map((h) => h.length),
  }
}
export type Okey101View = ReturnType<typeof viewOkey101>
