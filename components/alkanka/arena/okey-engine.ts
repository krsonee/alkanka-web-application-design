export type Tile = { id: number; color: number; num: number; fake?: boolean }
export const COLOR_NAMES = ['Kırmızı', 'Siyah', 'Mavi', 'Sarı']

export function createDeck(): Tile[] {
  const tiles: Tile[] = []
  let id = 0
  for (let copy = 0; copy < 2; copy++)
    for (let c = 0; c < 4; c++) for (let n = 1; n <= 13; n++) tiles.push({ id: id++, color: c, num: n })
  tiles.push({ id: id++, color: -1, num: 0, fake: true }, { id: id++, color: -1, num: 0, fake: true })
  for (let i = tiles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[tiles[i], tiles[j]] = [tiles[j], tiles[i]]
  }
  return tiles
}

export type Okey = { color: number; num: number }

export function okeyFrom(indicator: Tile): Okey {
  return { color: indicator.color, num: indicator.num === 13 ? 1 : indicator.num + 1 }
}

export const isJoker = (t: Tile, ok: Okey) => !t.fake && t.color === ok.color && t.num === ok.num
export const valueOf = (t: Tile, ok: Okey) => (t.fake ? ok : { color: t.color, num: t.num })

type Counts = number[][]

function toCounts(tiles: Tile[], ok: Okey) {
  const counts: Counts = Array.from({ length: 4 }, () => Array(15).fill(0))
  let jokers = 0
  for (const t of tiles) {
    if (isJoker(t, ok)) jokers++
    else {
      const v = valueOf(t, ok)
      counts[v.color][v.num]++
    }
  }
  return { counts, jokers }
}

function first(counts: Counts): [number, number] | null {
  for (let c = 0; c < 4; c++) for (let n = 1; n <= 13; n++) if (counts[c][n] > 0) return [c, n]
  return null
}

function solve(counts: Counts, jokers: number): boolean {
  const f = first(counts)
  if (!f) return jokers === 0
  const [c, n] = f
  counts[c][n]--

  // Set: same number, distinct colours.
  const others = [0, 1, 2, 3].filter((o) => o !== c && counts[o][n] > 0)
  for (let mask = 0; mask < 1 << others.length; mask++) {
    const picked = others.filter((_, i) => mask & (1 << i))
    for (let j = 0; j <= Math.min(jokers, 3); j++) {
      const size = 1 + picked.length + j
      if (size < 3 || size > 4) continue
      picked.forEach((o) => counts[o][n]--)
      const ok = solve(counts, jokers - j)
      picked.forEach((o) => counts[o][n]++)
      if (ok) return (counts[c][n]++, true)
    }
  }

  // Run upward from n, optional leading jokers; 13 may be followed by 1.
  const runUp = (lead: number): boolean => {
    const walk = (num: number, len: number, j: number, used: number[]): boolean => {
      if (len >= 3 && solve(counts, j)) return true
      if (num > 14) return false
      const actual = num === 14 ? 1 : num
      if (counts[c][actual] > 0) {
        counts[c][actual]--
        const ok = walk(num + 1, len + 1, j, [...used, actual])
        counts[c][actual]++
        if (ok) return true
      }
      if (j > 0 && walk(num + 1, len + 1, j - 1, used)) return true
      return false
    }
    return walk(n + 1, 1 + lead, jokers - lead, [])
  }
  for (let lead = 0; lead <= jokers && n - lead >= 1; lead++) if (runUp(lead)) return (counts[c][n]++, true)

  // 1 used as the top of 12-13-1.
  if (n === 1) {
    const walkDown = (num: number, len: number, j: number): boolean => {
      if (len >= 3 && solve(counts, j)) return true
      if (num < 2) return false
      if (counts[c][num] > 0) {
        counts[c][num]--
        const ok = walkDown(num - 1, len + 1, j)
        counts[c][num]++
        if (ok) return true
      }
      return j > 0 && walkDown(num - 1, len + 1, j - 1)
    }
    if (walkDown(13, 1, jokers)) return (counts[c][n]++, true)
  }

  counts[c][n]++
  return false
}

export function isWinningHand(tiles: Tile[], ok: Okey): 'seri' | 'cift' | null {
  if (tiles.length !== 14) return null
  const { counts, jokers } = toCounts(tiles, ok)
  let singles = 0
  for (let c = 0; c < 4; c++) for (let n = 1; n <= 13; n++) if (counts[c][n] === 1) singles++
  if (singles <= jokers && (jokers - singles) % 2 === 0) return 'cift'
  return solve(counts, jokers) ? 'seri' : null
}

export function findWinningDiscard(hand: Tile[], ok: Okey) {
  for (const t of hand) {
    const rest = hand.filter((x) => x.id !== t.id)
    const kind = isWinningHand(rest, ok)
    if (kind) return { tile: t, kind }
  }
  return null
}

function tileScore(t: Tile, hand: Tile[], ok: Okey) {
  if (isJoker(t, ok)) return 100
  const v = valueOf(t, ok)
  let s = 0
  for (const o of hand) {
    if (o.id === t.id || isJoker(o, ok)) continue
    const w = valueOf(o, ok)
    if (w.color === v.color) {
      const d = Math.abs(w.num - v.num)
      const wrap = (w.num === 1 && v.num === 13) || (w.num === 13 && v.num === 1)
      if (d === 1 || wrap) s += 3
      else if (d === 2) s += 1.2
      else if (d === 0) s += 1
    } else if (w.num === v.num) s += 2.6
  }
  return s
}

export function handScore(hand: Tile[], ok: Okey) {
  return hand.reduce((acc, t) => acc + Math.min(tileScore(t, hand, ok), 9), 0)
}

export function chooseDiscard(hand: Tile[], ok: Okey): Tile {
  let worst = hand[0]
  let worstScore = Infinity
  for (const t of hand) {
    const s = tileScore(t, hand, ok) + Math.random() * 0.3
    if (s < worstScore) {
      worstScore = s
      worst = t
    }
  }
  return worst
}

export function wantsDiscard(hand: Tile[], tile: Tile, ok: Okey) {
  if (isJoker(tile, ok)) return true
  if (findWinningDiscard([...hand, tile], ok)) return true
  return tileScore(tile, [...hand, tile], ok) >= 5.5
}

export function sortHand(hand: Tile[], ok: Okey, mode: 'seri' | 'cift'): Tile[] {
  const key = (t: Tile) => {
    if (isJoker(t, ok)) return 10000
    const v = valueOf(t, ok)
    return mode === 'seri' ? v.color * 100 + v.num : v.num * 10 + v.color
  }
  return [...hand].sort((a, b) => key(a) - key(b))
}
