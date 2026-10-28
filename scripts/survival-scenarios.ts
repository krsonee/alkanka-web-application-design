import assert from 'node:assert/strict'
import { createSV, planSV, runSV, stepSV, svFieldSize, svPlanKind, svWinners, type SVOptions, type SVRule } from '../lib/survival-sim'

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

console.log('\n5 takim x 2 ve kaptan modu')
for (const rule of ['last', 'most'] as SVRule[]) {
  for (const captain of [false, true]) {
    for (const n of [10, 25]) {
      scenario(`5 takim kural=${rule} kaptan=${captain ? 'acik' : 'kapali'} n=${n}: tek takim kazanir`, () => {
        for (const seed of SEEDS) {
          const s = play(opts({ n, seed, teams: 5, rule, captain, shield: true }))
          assert.ok(s.winningTeam >= 0 && s.winningTeam < 5, `seed ${seed}: kazanan takim ${s.winningTeam}`)
          assert.ok(!s.teamDead[s.winningTeam], `seed ${seed}: elenen takim kazanmis`)
          const members = s.balls.flatMap((b, i) => (b.team === s.winningTeam ? [i] : []))
          assert.deepEqual(svWinners(s), members, `seed ${seed}: kazananlar takim uyeleriyle ayni degil`)
        }
      })
    }
  }
}

scenario('5 takimda sahada her takimdan esit kisi', () => {
  for (const n of [10, 25, 60]) {
    const s = createSV(opts({ n, teams: 5 }))
    const f = svFieldSize(n, 5)
    assert.equal(f % 5, 0, `n=${n}: saha ${f}`)
    for (let t = 0; t < 5; t++) assert.equal(s.balls.filter((b) => b.team === t && b.state === 1).length, f / 5, `n=${n} takim ${t}`)
  }
})

scenario('10 kisiden az ise 5 takim yerine Altin-Mavi oynanir', () => {
  const s = createSV(opts({ n: 8, teams: 5 }))
  assert.equal(s.teamCount, 2)
  assert.ok(s.balls.every((b) => b.team < 2))
})

scenario('kaptan duserse takimi aninda elenir', () => {
  let seen = 0
  for (const seed of [...SEEDS, 5, 6, 7, 8, 9, 10]) {
    const s = createSV(opts({ n: 30, seed, teams: 2, captain: true }))
    while (!s.finished) {
      stepSV(s)
      for (const t of s.teamOut) {
        const cap = s.captains[t]
        if (s.balls[cap].state !== 2) continue
        seen++
        assert.ok(s.balls.every((b) => b.team !== t || b.state === 2), `seed ${seed}: takim ${t} kaptani dustu ama oyuncusu kaldi`)
      }
    }
    assert.notEqual(s.balls[s.captains[s.winningTeam]].state, 2, `seed ${seed}: kaptani dusen takim kazanmis`)
  }
  assert.ok(seen > 0, 'hicbir turda kaptan dusmedi')
})

scenario('kaptan kapaliyken kaptan atanmaz', () => {
  const s = createSV(opts({ n: 20, teams: 2 }))
  assert.ok(s.captains.every((c) => c === -1))
})

console.log('\nTutarlilik')
scenario('ayni tohum her modda ayni sonucu verir', () => {
  const variants: Partial<SVOptions>[] = [
    { n: 20, winners: 3 },
    { n: 30, teams: 2, rule: 'last' },
    { n: 30, teams: 2, rule: 'most', shield: true },
    { n: 30, teams: 5, rule: 'most', captain: true },
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
  const results = new Set(SEEDS.map((seed) => JSON.stringify(play(opts({ n: 20, winners: 3, seed })).order)))
  assert.ok(results.size > 1, 'tum tohumlar ayni elenme sirasini verdi')
})

console.log('\nKalabalik turlar')
scenario('20 kisiye kadar takimli tur tek sahada oynanir', () => {
  assert.equal(svPlanKind(20, 2), 'single')
  assert.equal(svPlanKind(60, 0), 'single')
})

for (const teams of [2, 5] as const) {
  for (const n of [21, 40, 57, 120]) {
    scenario(`${teams} takim n=${n}: paralel maclar, tek renk kazanir`, () => {
      for (const seed of SEEDS) {
        const p = planSV(opts({ n, seed, teams, rule: 'most', shield: true }))
        assert.equal(p.kind, 'matches')
        assert.equal(p.stages.length, Math.min(6, Math.floor(n / 10)), `seed ${seed}: mac sayisi`)
        const seen = p.stages.flatMap((s) => s.entrants).sort((a, b) => a - b)
        assert.deepEqual(seen, Array.from({ length: n }, (_, i) => i), `seed ${seed}: herkes tam bir maca girmeli`)
        for (const s of p.stages) assert.ok(s.entrants.length >= 10, `seed ${seed}: mac ${s.entrants.length} kisi`)
        assert.ok(p.winningTeam >= 0 && p.winningTeam < teams, `seed ${seed}: kazanan ${p.winningTeam}`)
        const top = Math.max(...p.wins)
        assert.equal(p.wins[p.winningTeam], top, `seed ${seed}: en cok mac kazanan renk kazanmadi`)
        const expect = p.stages.flatMap((s) => s.entrants.filter((_, local) => local % teams === p.winningTeam)).sort((a, b) => a - b)
        assert.deepEqual(p.winners, expect, `seed ${seed}: kazananlar o rengin tum oyunculari degil`)
        assert.ok(p.steps / STEPS_PER_SEC <= 60 + 150, `seed ${seed}: ${Math.round(p.steps / STEPS_PER_SEC)}s surdu`)
      }
    })
  }
}

for (const [n, winners] of [[61, 1], [90, 3], [150, 5], [300, 10]] as const) {
  scenario(`tekli n=${n} kazanan=${winners}: on eleme + final`, () => {
    for (const seed of SEEDS) {
      const p = planSV(opts({ n, seed, winners, duration: 90 }))
      assert.equal(p.kind, 'heats')
      const heats = Math.min(6, Math.ceil(n / 30))
      assert.equal(p.stages.length, heats, `seed ${seed}: saha sayisi`)
      for (const s of p.stages) assert.ok(s.entrants.length <= Math.max(30, Math.ceil(n / heats)), `seed ${seed}: saha ${s.entrants.length} kisi`)
      const finalists = p.final!.entrants
      assert.ok(finalists.length > winners && finalists.length <= 30, `seed ${seed}: finalde ${finalists.length} kisi`)
      assert.equal(new Set(finalists).size, finalists.length, `seed ${seed}: finalde tekrar var`)
      assert.equal(p.winners.length, winners, `seed ${seed}: ${p.winners.length} kazanan`)
      for (const w of p.winners) assert.ok(finalists.includes(w), `seed ${seed}: finale cikmayan kazanmis`)
      assert.ok(p.final!.startStep >= Math.max(...p.stages.map((s) => s.steps)), `seed ${seed}: final elemeler bitmeden basladi`)
      assert.ok(p.steps / STEPS_PER_SEC <= 90 + 360, `seed ${seed}: ${Math.round(p.steps / STEPS_PER_SEC)}s surdu`)
    }
  })
}

scenario('kalabalik turda ayni tohum ayni plani verir', () => {
  for (const v of [{ n: 120, teams: 2 as const }, { n: 150, winners: 5 }]) {
    for (const seed of SEEDS) {
      const a = runSV(opts({ ...v, seed }))
      const b = runSV(opts({ ...v, seed }))
      assert.deepEqual([a.winners, a.steps, a.winningTeam], [b.winners, b.steps, b.winningTeam], `seed ${seed} ${JSON.stringify(v)}`)
    }
  }
})

let longest = 0
for (const seed of SEEDS) for (const n of [61, 150, 300]) longest = Math.max(longest, planSV(opts({ n, seed, winners: 5, duration: 90 })).steps / STEPS_PER_SEC)
console.log(`  bilgi: en uzun on eleme + final turu ${Math.round(longest)} sn (sure 90 sn)`)

console.log(`\n${passed} gecti, ${failures.length} kaldi\n`)
if (failures.length) process.exit(1)
