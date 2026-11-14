'use client'

import { useState } from 'react'
import { Bilardo } from '@/components/alkanka/arena/bilardo'
import { BlackjackDuel } from '@/components/alkanka/arena/blackjack'
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

export function TmpStage({ game }: { game: string }) {
  if (game === 'bj') return <BlackjackDuel onDone={() => {}} />
  if (game === 'okey') return <OkeyHarness />
  return <Bilardo />
}
