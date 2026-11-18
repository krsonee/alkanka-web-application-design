'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { applyAction, initState, type OkeyState } from '@/lib/pvp/rules'
import { OkeyPvp } from '@/components/alkanka/arena/okey-pvp'
import type { Remote, RemoteAction } from '@/components/alkanka/arena/remote'

const NAMES = ['KralTavlacı', 'Zeynep_34', 'çok uzun bir oyuncu adı', 'Mert']

function Table() {
  const q = useSearchParams()
  const n = q.get('n') === '4' ? 4 : 2
  const me = q.get('spec') ? -1 : Math.min(n - 1, Number(q.get('seat') ?? 0))
  const rounds = q.get('scored') ? 20 : 0
  const [state, setState] = useState<OkeyState>(() => initState('okey', { seats: n, rounds, team: Boolean(q.get('team')) }) as OkeyState)
  const [version, setVersion] = useState(1)

  const step = (s: OkeyState, seat: number, action: RemoteAction): OkeyState | null => {
    try {
      return applyAction(s, seat, action).state as OkeyState
    } catch {
      return null
    }
  }

  const others = (s: OkeyState) => {
    let cur = s
    for (let guard = 0; guard < 8 && cur.turn !== me; guard++) {
      const seat = cur.turn
      if (cur.phase === 'draw') cur = step(cur, seat, { type: 'draw', from: 'pile' }) ?? cur
      const tile = cur.hands[seat]?.at(-1)
      if (!tile) break
      const next = step(cur, seat, { type: 'discard', tileId: tile.id })
      if (!next) break
      cur = next
    }
    return cur
  }

  const view = {
    ...state,
    deckCount: state.deck.length,
    handCounts: state.hands.map((h) => h.length),
    oppSeat: me < 0 ? 1 : (me + 1) % n,
    seats: n,
    team: Boolean(state.team),
    bots: state.bots ?? [],
    last: state.last ?? [],
  }

  const remote: Remote<typeof view> = {
    id: q.get('chat') ? 'deneme-okey' : undefined,
    seat: me,
    state: view,
    version,
    myTurn: me >= 0 && state.turn === me,
    busy: false,
    names: NAMES.slice(0, n),
    userIds: NAMES.slice(0, n).map(() => null),
    spectator: me < 0,
    send: async (action) => {
      const next = step(state, me, action)
      if (!next) return false
      setState(next)
      setVersion((v) => v + 1)
      return true
    },
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span data-testid="durum">
          sıra {state.turn} · {state.phase} · deste {state.deck.length} · elim {me >= 0 ? state.hands[me].length : '-'}
        </span>
        <button
          type="button"
          className="rounded-lg border border-border px-3 py-1.5 font-bold text-foreground"
          onClick={() => {
            setState(others(state))
            setVersion((v) => v + 1)
          }}
        >
          Rakipler oynasın
        </button>
      </div>
      <OkeyPvp remote={remote} />
    </div>
  )
}

export default function Page() {
  return (
    <main className="mx-auto max-w-5xl bg-background p-2 text-foreground sm:p-4">
      <Suspense fallback={null}>
        <Table />
      </Suspense>
    </main>
  )
}
