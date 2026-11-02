'use client'

import { useState } from 'react'
import { BatakPvp } from '@/components/alkanka/arena/batak-pvp'
import { batakStep, initBatak, runBatakBots, viewBatak, type BatakState } from '@/lib/games/batak'

export function BatakTmpPreview() {
  const [state, setState] = useState<BatakState>(() => runBatakBots(initBatak({ botSeats: [1, 2, 3] })).state)
  const [version, setVersion] = useState(0)
  return (
    <BatakPvp
      remote={{
        id: 'bk-tmp',
        seat: 0,
        state: viewBatak(state, 0),
        version,
        myTurn: state.turn === 0,
        busy: false,
        names: ['Sen', 'Baykuş Bot', 'Kartal Bot', 'Aslan Bot'],
        send: async (a) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const next = runBatakBots(batakStep(state, 0, a as any).state).state
          setState(next)
          setVersion((v) => v + 1)
          return true
        },
      }}
    />
  )
}
