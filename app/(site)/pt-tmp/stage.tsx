'use client'

import { useState } from 'react'
import { Bilardo } from '@/components/alkanka/arena/bilardo'
import { mutate } from 'swr'
import { BlackjackDuel } from '@/components/alkanka/arena/blackjack'
import { BlackjackLive } from '@/components/alkanka/arena/blackjack-live'
import { handValue } from '@/lib/casino'
import { OkeyPvp } from '@/components/alkanka/arena/okey-pvp'
import type { Tile } from '@/components/alkanka/arena/okey-engine'

const t = (id: number, color: number, num: number): Tile => ({ id, color, num })

const DEALS: { indicator: Tile; hand: Tile[] }[] = [
  {
    indicator: t(100, 0, 4),
    hand: [t(1, 1, 2), t(2, 1, 3), t(3, 0, 5), t(4, 2, 7), t(5, 2, 8), t(6, 2, 9), t(7, 0, 5), t(8, 3, 11), t(9, 3, 13), t(10, 1, 11), t(11, 1, 12), t(12, 0, 10), t(13, 2, 10), t(14, 3, 1), { id: 15, color: -1, num: 0, fake: true }],
  },
  {
    indicator: t(101, 2, 9),
    hand: [t(1, 1, 2), t(2, 1, 3), t(3, 0, 6), t(4, 2, 7), t(5, 2, 8), t(6, 2, 9), t(7, 0, 7), t(8, 3, 11), t(9, 3, 13), t(10, 1, 11), t(11, 1, 12), t(12, 2, 10), t(13, 0, 8), t(14, 3, 1)],
  },
  {
    indicator: t(102, 0, 5),
    hand: [t(1, 1, 2), t(2, 1, 3), t(3, 0, 6), t(4, 2, 7), t(5, 2, 8), t(6, 2, 9), t(7, 0, 7), t(8, 3, 11), t(9, 3, 13), t(10, 1, 11), t(11, 1, 12), t(12, 2, 10), t(13, 0, 8), t(14, 3, 1)],
  },
]

function OkeyHarness() {
  const [n, setN] = useState(0)
  const d = DEALS[n % DEALS.length]
  const state = {
    kind: 'okey' as const,
    seats: 4,
    team: false,
    bots: [1, 2, 3],
    deck: [],
    indicator: d.indicator,
    hands: [d.hand, [], [], []],
    discards: [[], [], [], []],
    turn: 0,
    phase: 'discard' as const,
    note: '',
    last: [],
    hand: n + 1,
    deckCount: 40,
    handCounts: [d.hand.length, 14, 14, 14],
    oppSeat: 1,
  }
  return (
    <div className="flex flex-col gap-2">
      <button id="next-deal" className="self-start rounded bg-primary px-3 py-1 text-primary-foreground" onClick={() => setN((v) => v + 1)}>
        Yeni el ({n + 1})
      </button>
      <OkeyPvp
        remote={{
          seat: 0,
          state,
          version: n,
          myTurn: true,
          busy: false,
          names: ['Sen', 'B1', 'B2', 'B3'],
          send: async () => true,
        }}
      />
    </div>
  )
}

const c = (r: number, s: number) => ({ r, s })
const DEALER = [c(6, 0), c(5, 1), c(3, 2), c(4, 3)]

function bjState(step: number, round: number) {
  const dealing = step >= 1
  const reveal = step >= 2
  const phase = step === 0 ? 'bet' : step === 1 ? 'play' : 'result'
  const seat = (n: number, name: string, mine: boolean, cards: { r: number; s: number }[], result: string, delta: number) => ({
    seat: n,
    name,
    mine,
    baseBet: 50,
    bet: 50,
    hands: dealing ? [{ cards, value: handValue(cards), doubled: false, stake: 50, active: step === 1 && mine, result: reveal ? result : null, delta: reveal ? delta : null }] : [],
    split: false,
    surrendered: false,
    natural: false,
    insurance: 0,
    insDecided: false,
    ready: true,
    leaving: false,
    idle: 0,
    done: step === 2,
    can: { double: false, split: false, surrender: false, insure: false },
    side: { pairs: 0, t213: 0, pairsHit: null, t213Hit: null, settled: dealing },
    breakdown: reveal ? { main: delta, insurance: null, pairs: null, t213: null, net: delta } : null,
  })
  const dealer = !dealing ? [] : reveal ? DEALER : [DEALER[0]]
  return {
    tableNo: 1,
    tables: [{ no: 1, phase, seated: 2, watching: 0 }],
    roundId: round,
    phase,
    phaseEndsAt: Date.now() + 60_000,
    phaseTotal: 60_000,
    serverNow: Date.now(),
    seats: [seat(1, 'Sen', true, [c(10, 1), c(7, 0)], 'lose', -50), null, seat(3, 'Doğan', false, [c(9, 2), c(9, 3)], 'push', 0), null, null, null],
    watchers: [],
    dealer,
    dealerHidden: step === 1,
    dealerValue: handValue(dealer),
    dealerBlackjack: false,
    lastRound: null,
    balance: 1000,
  }
}

const bj = { step: 0, round: 500 }
if (typeof window !== 'undefined' && !(window as unknown as { __bjPatched?: boolean }).__bjPatched) {
  ;(window as unknown as { __bjPatched?: boolean }).__bjPatched = true
  const orig = window.fetch.bind(window)
  window.fetch = (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (url.includes('/api/blackjack')) return Promise.resolve(new Response(JSON.stringify(bjState(bj.step, bj.round)), { headers: { 'content-type': 'application/json' } }))
    return orig(input, init)
  }
}

function BjLiveHarness() {
  const [, bump] = useState(0)
  const go = (step: number, newRound = false) => {
    bj.step = step
    if (newRound) bj.round += 1
    bump((v) => v + 1)
    void mutate((k) => typeof k === 'string' && k.startsWith('/api/blackjack'))
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <button id="bj-bet" className="rounded bg-primary px-3 py-1 text-primary-foreground" onClick={() => go(0, true)}>bahis</button>
        <button id="bj-play" className="rounded bg-primary px-3 py-1 text-primary-foreground" onClick={() => go(1)}>dağıt</button>
        <button id="bj-result" className="rounded bg-primary px-3 py-1 text-primary-foreground" onClick={() => go(2)}>sonuç</button>
      </div>
      <BlackjackLive settings={{ enabled: true, pvpEnabled: true, bets: [10, 25, 50], multiplier: 2, commission: 10 }} />
    </div>
  )
}

export function TmpStage({ game }: { game: string }) {
  if (game === 'bjlive') return <BjLiveHarness />
  if (game === 'bj') return <BlackjackDuel onDone={() => {}} />
  if (game === 'okey') return <OkeyHarness />
  return <Bilardo />
}
