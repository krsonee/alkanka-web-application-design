// Stress test for the Monopoly engine: `node scripts/monopoly-sim.mts [gamesPerConfig]`
import * as M from '../lib/games/monopoly.ts'

const { BOARD, GROUP_SQUARES } = M
type S = M.MonopolyState
const errors = new Map<string, { n: number; sample: string }>()
const bad = (key: string, info: string) => {
  const e = errors.get(key)
  if (e) e.n++
  else errors.set(key, { n: 1, sample: info })
}

function check(s: S, ctx: string) {
  let houses = 0
  let hotels = 0
  s.players.forEach((p, i) => {
    if (p.money < 0 && !(s.phase === 'debt' && s.turn === i)) bad('negatif para', `${ctx} seat${i} ${p.money}`)
    if (!Number.isFinite(p.money)) bad('NaN para', `${ctx} seat${i}`)
    if (p.out && s.owner.some((o) => o === i)) bad('iflas eden tapu tutuyor', ctx)
    if (p.out && p.cards) bad('iflas eden kart tutuyor', ctx)
    if (p.cards < 0 || p.cards > 2) bad('kart sayısı bozuk', `${ctx} ${p.cards}`)
  })
  BOARD.forEach((sq, i) => {
    const h = s.houses[i]
    if (h === 5) hotels++
    else houses += h
    if (h > 0) {
      if (sq.type !== 'property') return bad('mülk olmayan yerde ev', ctx)
      const o = s.owner[i]
      if (o == null) bad('sahipsiz arsada ev', ctx)
      if (!GROUP_SQUARES[sq.group].every((j) => s.owner[j] === o)) bad('grup tamam değilken ev', `${ctx} ${sq.name}`)
      if (GROUP_SQUARES[sq.group].some((j) => s.mortgaged[j])) bad('ipotekli grupta ev', `${ctx} ${sq.name}`)
      const hs = GROUP_SQUARES[sq.group].map((j) => s.houses[j])
      if (Math.max(...hs) - Math.min(...hs) > 1) bad('eşitsiz ev', `${ctx} ${sq.name} ${hs}`)
    }
    if (s.mortgaged[i] && s.owner[i] == null) bad('sahipsiz ipotekli', ctx)
    if (s.owner[i] != null && !M.isBuyable(sq)) bad('satılamaz kare sahipli', ctx)
  })
  if (houses > M.BANK_HOUSES) bad('ev stoğu aşıldı', `${ctx} ${houses}`)
  if (hotels > M.BANK_HOTELS) bad('otel stoğu aşıldı', `${ctx} ${hotels}`)
  if (s.phase === 'debt' && !s.debt) bad('debt fazı ama borç yok', ctx)
  const tp = s.players[s.turn].pos
  if (s.phase === 'buy' && !s.auction && (s.owner[tp] != null || !M.isBuyable(BOARD[tp]))) bad('buy fazı ama alınamaz', ctx)
  if (s.players[s.turn].out && !s.auction) bad('sıra iflas edende', ctx)
  if (s.auction && s.auction.active.length === 0) bad('boş mezat', ctx)
}

type Res = { stuck: boolean; round: number; stats: Record<string, number> }

function play(seats: number, humans: number[], rules: Partial<M.MonoRules>, rounds = 0): Res {
  const botSeats = Array.from({ length: seats }, (_, i) => i).filter((i) => !humans.includes(i))
  let s = M.initMonopoly({ seats, botSeats, rounds, rules })
  const stats: Record<string, number> = {}
  for (let step = 0; step < 20000; step++) {
    const who = M.monoActor(s)
    let r: M.MonopolyStep
    try {
      // Humans are driven like a turn timeout (the server's fallback path).
      r = s.bots.includes(who) ? M.runMonopolyBots(s) : M.monopolyBotTurn(s, who)
    } catch (e) {
      bad('exception', `${(e as Error).message} phase=${s.phase} who=${who}`)
      return { stuck: true, round: s.round, stats }
    }
    if (r.state.seq === s.seq && !r.winners) {
      bad('ilerlemiyor (kilit)', `phase=${s.phase} who=${who} human=${!s.bots.includes(who)} trade=${!!s.trade} auction=${!!s.auction} last=${s.log.at(-1)}`)
      return { stuck: true, round: s.round, stats }
    }
    const prevLast = s.log.at(-1)
    s = r.state
    const at = prevLast == null ? -1 : s.log.lastIndexOf(prevLast)
    const fresh = s.log.slice(at + 1)
    for (const l of fresh) {
      if (/mezatta \d+ ₺'ye aldı/.test(l)) stats.mezat = (stats.mezat ?? 0) + 1
      if (/takas yaptı/.test(l)) stats.takas = (stats.takas ?? 0) + 1
      if (/iflas etti/.test(l)) stats.iflas = (stats.iflas ?? 0) + 1
      if (/dikti/.test(l)) stats.ev = (stats.ev ?? 0) + 1
      if (/ipotek etti/.test(l)) stats.ipotek = (stats.ipotek ?? 0) + 1
    }
    check(s, `r${s.round} ${s.log.at(-1)}`)
    if (r.winners) return { stuck: false, round: s.round, stats }
  }
  bad('bitmedi', `round=${s.round}`)
  return { stuck: true, round: s.round, stats }
}

const configs: [string, number, number[], Partial<M.MonoRules>, number][] = [
  ['1 insan+7 bot', 8, [0], {}, 0],
  ['1 insan+1 bot', 2, [0], {}, 0],
  ['1 insan+3 bot', 4, [0], {}, 0],
  ['2 insan+2 bot', 4, [0, 2], {}, 0],
  ['kumbara+çift', 4, [0], { kumbara: true, goDouble: true }, 0],
  ['hızlı+çiftkira', 6, [1], { quick: true, doubleRent: true }, 0],
  ['20 tur sınırlı', 4, [0], {}, 20],
]
const N = Number(process.argv[2] ?? 150)
for (const [label, seats, humans, rules, rounds] of configs) {
  let stuck = 0
  let rsum = 0
  let maxR = 0
  const tot: Record<string, number> = {}
  for (let g = 0; g < N; g++) {
    const r = play(seats, humans, rules, rounds)
    if (r.stuck) stuck++
    rsum += r.round
    maxR = Math.max(maxR, r.round)
    for (const [k, v] of Object.entries(r.stats)) tot[k] = (tot[k] ?? 0) + v
  }
  const per = Object.entries(tot).map(([k, v]) => `${k}=${(v / N).toFixed(1)}`).join(' ')
  console.log(`${label.padEnd(16)} takıldı=${stuck}/${N} ortTur=${(rsum / N).toFixed(1)} maxTur=${maxR} | oyun başı: ${per}`)
}
// ---------- Hand-built scenarios ----------
const results: string[] = []
const expect = (label: string, ok: boolean, info = '') => results.push(`${ok ? 'OK  ' : 'FAIL'} ${label}${info ? ` (${info})` : ''}`)
const throws = (fn: () => unknown) => {
  try {
    fn()
    return ''
  } catch (e) {
    return (e as Error).message
  }
}
const base = (humans = [0, 1]) => {
  const s = M.initMonopoly({ seats: 3, botSeats: [0, 1, 2].filter((i) => !humans.includes(i)) })
  return s
}

{
  // Auction: human 0 passes, 1 bids 120, 2 (bot) answers, 0 drops out.
  const s = base([0, 1])
  s.players[0].pos = 1
  s.phase = 'buy'
  let r = M.monopolyStep(s, 0, { type: 'pass' })
  expect('mezat açılır', r.state.phase === 'auction' && r.state.auction?.pos === 1)
  r = M.monopolyStep(r.state, M.monoActor(r.state), { type: 'bid', amount: 30 })
  let st = r.state
  for (let g = 0; g < 20 && st.auction; g++) {
    const who = M.monoActor(st)
    st = (st.bots.includes(who) ? M.monopolyBotTurn(st, who) : M.monopolyStep(st, who, { type: 'fold' })).state
  }
  expect('mezat kapanır, faz geri döner', !st.auction && st.phase === 'end', `phase=${st.phase}`)
  expect('mezat kazananı öder', st.owner[1] != null && st.players[st.owner[1]!].money < 1500)
  expect('düşük teklif reddedilir', throws(() => {
    const a = M.monopolyStep(s, 0, { type: 'pass' }).state
    const w = M.monoActor(a)
    const b = M.monopolyStep(a, w, { type: 'bid', amount: 50 }).state
    M.monopolyStep(b, M.monoActor(b), { type: 'bid', amount: 40 })
  }) !== '')
  expect('kasadan fazla teklif reddedilir', throws(() => {
    const a = M.monopolyStep(s, 0, { type: 'pass' }).state
    M.monopolyStep(a, M.monoActor(a), { type: 'bid', amount: 99999 })
  }) !== '')
}
{
  // Skip: no auction, straight to end.
  const s = base()
  s.players[0].pos = 1
  s.players[0].money = 20
  s.phase = 'buy'
  const r = M.monopolyStep(s, 0, { type: 'skip' })
  expect('pas geç mezatsız tura geçer', r.state.phase === 'end' && !r.state.auction && r.state.owner[1] == null)
  expect('parası yetmeyen satın alamaz', throws(() => M.monopolyStep(s, 0, { type: 'buy' })) !== '')
}
{
  // Trade between humans: propose, counter, accept, mortgage interest.
  const s = base([0, 1])
  s.owner[1] = 0
  s.owner[3] = 1
  s.mortgaged[3] = true
  let r = M.monopolyStep(s, 0, { type: 'propose', to: 1, give: { props: [1], money: 0, cards: 0 }, take: { props: [3], money: 0, cards: 0 } })
  expect('takas teklifi bekler', !!r.state.trade && M.monoActor(r.state) === 1)
  expect('takas beklerken zar atılamaz', throws(() => M.monopolyStep(r.state, 1, { type: 'roll' })) !== '')
  const c = M.monopolyStep(r.state, 1, { type: 'counterTrade', give: { props: [3], money: 0, cards: 0 }, take: { props: [1], money: 20, cards: 0 } })
  expect('karşı teklif teklif edene döner', c.state.trade?.to === 0 && c.state.trade.counter)
  expect('karşı teklife karşı teklif yok', throws(() => M.monopolyStep(c.state, 0, { type: 'counterTrade', give: { props: [], money: 10, cards: 0 }, take: { props: [3], money: 0, cards: 0 } })) !== '')
  const done = M.monopolyStep(c.state, 0, { type: 'acceptTrade' }).state
  const fee = Math.ceil((60 / 2) * 0.1)
  expect('takas tapuları değiştirir', done.owner[3] === 0 && done.owner[1] === 1)
  expect('ipotekli tapu faizi alınır', done.players[0].money === 1500 - 20 - fee, `para=${done.players[0].money} faiz=${fee}`)
  expect('boş takas reddedilir', throws(() => M.monopolyStep(s, 0, { type: 'propose', to: 1, give: { props: [], money: 0, cards: 0 }, take: { props: [3], money: 0, cards: 0 } })) !== '')
  s.houses[1] = 0
  s.owner[3] = 0
  s.owner[1] = 0
  s.mortgaged[3] = false
  s.houses[1] = 1
  expect('evli grup takas edilemez', throws(() => M.monopolyStep(s, 0, { type: 'propose', to: 1, give: { props: [3], money: 0, cards: 0 }, take: { props: [], money: 10, cards: 0 } })) !== '')
}
{
  // Debt screen for a human on their own turn, then mortgage and pay.
  const s = base([0, 1])
  s.owner[39] = 1
  s.owner[37] = 1
  s.houses[39] = 5
  s.houses[37] = 5
  s.owner[1] = 0
  s.owner[6] = 0
  s.players[0].money = 100
  s.players[0].pos = 39
  s.phase = 'end'
  // Land on Bağdat with a hotel through the engine's own rent path: emulate with a forced move card.
  let st = s
  for (let g = 0; g < 200; g++) {
    const t = structuredClone(s)
    t.players[0].pos = 32
    t.phase = 'roll'
    const r = M.monopolyStep(t, 0, { type: 'roll' })
    if (r.state.players[0].pos === 39 || r.state.players[0].pos === 37) {
      st = r.state
      break
    }
  }
  expect('ödeyemeyen insan borç ekranı alır', st.phase === 'debt' && !!st.debt, `phase=${st.phase}`)
  if (st.debt) {
    expect('borçtayken tur bitirilemez', throws(() => M.monopolyStep(st, 0, { type: 'end' })) !== '')
    expect('borçtayken ev dikilemez', throws(() => M.monopolyStep(st, 0, { type: 'build', pos: 1 })) !== '')
    expect('yetmeyen para ile borç ödenemez', throws(() => M.monopolyStep(st, 0, { type: 'payDebt' })) !== '')
    const bk = M.monopolyStep(st, 0, { type: 'bankrupt' })
    expect('iflas: tapular alacaklıya geçer', bk.state.owner[1] === 1 && bk.state.owner[6] === 1 && bk.state.players[0].out)
    expect('iki kişide iflas oyunu bitirir mi', true, `winners=${JSON.stringify(bk.winners)} alive=${bk.state.players.filter((p) => !p.out).length}`)
    const ad = M.monopolyStep(st, 0, { type: 'autoDebt' })
    expect('otomatik ödeme ipotekler/iflas eder', ad.state.players[0].out || ad.state.players[0].money >= 0)
  }
}
{
  // Bankruptcy to the bank puts deeds up for auction and clears mortgages.
  const s = base([0, 1])
  s.owner[1] = 0
  s.mortgaged[1] = true
  s.players[0].money = 10
  s.players[0].pos = 0
  s.phase = 'roll'
  let st = s
  for (let g = 0; g < 300; g++) {
    const t = structuredClone(s)
    const r = M.monopolyStep(t, 0, { type: 'roll' })
    if (r.state.players[0].pos === 4) {
      st = r.state
      break
    }
  }
  if (st.phase === 'debt') {
    const r = M.monopolyStep(st, 0, { type: 'bankrupt' })
    expect('bankaya iflas: tapu mezata çıkar, ipotek temizlenir', !!r.state.auction && r.state.auction.pos === 1 && !r.state.mortgaged[1], `auction=${r.state.auction?.pos}`)
  } else expect('gelir vergisine düşme senaryosu kurulamadı', false, `phase=${st.phase}`)
}
{
  // Hotel break-down with a short bank keeps the group even.
  const s = base([0, 1])
  ;[37, 39].forEach((i) => {
    s.owner[i] = 0
    s.houses[i] = 5
  })
  ;[1, 3, 6, 8, 9, 11, 13, 14].forEach((i, k) => {
    s.owner[i] = 1
    s.houses[i] = 4
  })
  // 8 lots x 4 houses = 32 houses -> bank has 0 houses left.
  const r = M.monopolyStep(s, 0, { type: 'sell', pos: 39 })
  expect('ev yokken otel satışı grubu eşit bozar', r.state.houses[37] === r.state.houses[39], `37=${r.state.houses[37]} 39=${r.state.houses[39]} para=${r.state.players[0].money}`)
}
{
  // Jail: 3rd failed attempt pays the fine and moves; doubles three times sends to jail.
  const s = base([0, 1])
  s.players[0].inJail = true
  s.players[0].pos = 10
  s.players[0].jail = 2
  let hit = false
  for (let g = 0; g < 100; g++) {
    const r = M.monopolyStep(structuredClone(s), 0, { type: 'roll' })
    const p = r.state.players[0]
    if (r.state.dice && r.state.dice[0] !== r.state.dice[1]) {
      hit = !p.inJail && p.pos !== 10
      expect('3. denemede ceza ödenip çıkılır', hit && p.money <= 1500 - 50 + 400, `money=${p.money} pos=${p.pos}`)
      break
    }
  }
  expect('hapiste kart yokken kart kullanılamaz', throws(() => M.monopolyStep(s, 0, { type: 'useCard' })) !== '')
}
console.log('\nSENARYOLAR:')
results.forEach((l) => console.log('  ' + l))

console.log('\nİHLALLER:')
if (!errors.size) console.log('  yok')
for (const [k, v] of errors) console.log(`  ${k} x${v.n} -> ${v.sample}`)
