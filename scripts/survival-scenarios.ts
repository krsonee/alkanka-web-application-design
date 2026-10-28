import assert from 'node:assert/strict'
import { createSV, runSV, stepSV, svFieldSize, svWinners, type SVOptions, type SVRule } from '../lib/survival-sim'

const SEEDS = [1, 77, 999, 4242, 31337]
const STEPS_PER_SEC = 120
/** Hard ceiling: countdown + queue drain + final battle must never run away. */
const MAX_ROUND_SEC = 600

let passed = 0
const failures: string[] = []

function scenario(name: string, fn: () => void) {
  try {
    fn()
    passed++
    console.log(`  ok   ${name}`)
  } catch (err) {
    failures.push(name)
    console.log(`  FAIL ${name}\n       ${(err as Error).message.split('\n')[0]}`)
  }
}

function opts(partial: Partial<SVOptions>): SVOptions {
  return { n: 10, seed: 1, duration: 60, winners: 1, teams: 0, rule: 'last', shield: false, ...partial }
}

function play(o: SVOptions) {
  const s = createSV(o)
  while (!s.finished) {
    stepSV(s)
    if (s.step > MAX_ROUND_SEC * STEPS_PER_SEC) throw new Error(`round did not finish within ${MAX_ROUND_SEC}s (${JSON.stringify(o)})`)
  }
  return s
}

console.log('\nSurvival Arena senaryolari\n')

console.log('Tekli mod')
for (const [n, winners] of [[10, 1], [10, 3], [20, 3], [45, 3], [80, 5]] as const) {
  scenario(`n=${n} kazanan=${winners}: biter, tam ${winners} kisi kalir`, () => {
    for (const seed of SEEDS) {
      const s = play(opts({ n, winners, seed }))
      const w = svWinners(s)
      assert.equal(w.length, winners, `seed ${seed}: ${w.length} kazanan`)
      for (const i of w) assert.notEqual(s.balls[i].state, 2, `seed ${seed}: elenen oyuncu kazanmis (${i})`)
    }
  })
}

scenario('elenme sirasi: her elenen bir kez, kazananlar listede yok', () => {
  for (const seed of SEEDS) {
    const s = play(opts({ n: 20, winners: 3, seed }))
    const w = new Set(svWinners(s))
    assert.equal(new Set(s.order).size, s.order.length, `seed ${seed}: sirada tekrar var`)
    for (const i of s.order) assert.ok(!w.has(i), `seed ${seed}: kazanan elenme sirasinda (${i})`)
    assert.equal(s.order.length + w.size, 20, `seed ${seed}: elenen + kazanan != katilimci`)
  }
})

scenario('kalabalik turda saha 20 kisiyi gecmez', () => {
  for (const n of [5, 20, 21, 50, 200]) {
    const f = svFieldSize(n, 0)
    assert.ok(f >= 1 && f <= 20 && f <= n, `n=${n}: saha ${f}`)
  }
})

console.log('\nTakimli mod')
for (const rule of ['last', 'most'] as SVRule[]) {
  for (const shield of [false, true]) {
    for (const n of [10, 30]) {
      scenario(`kural=${rule} kalkan=${shield ? 'acik' : 'kapali'} n=${n}: tek takim kazanir`, () => {
        for (const seed of SEEDS) {
          const s = play(opts({ n, seed, teams: 2, rule, shield }))
          assert.ok(s.winningTeam === 0 || s.winningTeam === 1, `seed ${seed}: kazanan takim ${s.winningTeam}`)
          const w = svWinners(s)
          const members = s.balls.flatMap((b, i) => (b.team === s.winningTeam ? [i] : []))
          assert.deepEqual(w, members, `seed ${seed}: kazananlar takim uyeleriyle ayni degil`)
        }
      })
    }
  }
}

scenario('takimlar dengeli dagilir (fark en fazla 1)', () => {
  for (const n of [10, 11, 30, 47]) {
    const s = createSV(opts({ n, teams: 2 }))
    const gold = s.balls.filter((b) => b.team === 0).length
    assert.ok(Math.abs(gold - (n - gold)) <= 1, `n=${n}: ${gold} - ${n - gold}`)
  }
})

scenario('takimli sahada kisi sayisi cift', () => {
  for (const n of [10, 25, 50, 200]) assert.equal(svFieldSize(n, 2) % 2, 0, `n=${n}`)
})

console.log('\nTutarlilik')
scenario('ayni tohum her modda ayni sonucu verir', () => {
  const variants: Partial<SVOptions>[] = [
    { n: 20, winners: 3 },
    { n: 30, teams: 2, rule: 'last' },
    { n: 30, teams: 2, rule: 'most', shield: true },
  ]
  for (const v of variants) {
    for (const seed of SEEDS) {
      const a = runSV(opts({ ...v, seed }))
      const b = runSV(opts({ ...v, seed }))
      assert.deepEqual(a, b, `seed ${seed} ${JSON.stringify(v)}`)
    }
  }
})

scenario('farkli tohumlar farkli turlar uretir', () => {
  const results = new Set(SEEDS.map((seed) => JSON.stringify(runSV(opts({ n: 20, winners: 3, seed })).order)))
  assert.ok(results.size > 1, 'tum tohumlar ayni elenme sirasini verdi')
})

console.log(`\n${passed} gecti, ${failures.length} kaldi\n`)
if (failures.length) process.exit(1)
