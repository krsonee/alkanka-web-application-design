'use client'

import useSWR from 'swr'
import { formatAC } from '../points-context'
import { useIdle } from '../use-idle'
import { TableRowCard, type TableSummary } from './table-lobby'

type LobbyData = { open: (TableSummary & { ambient?: boolean })[] }

const fetcher = async (url: string) => {
  const r = await fetch(url, { cache: 'no-store' })
  if (!r.ok) throw new Error('Yüklenemedi')
  return r.json()
}

/** Shows tables waiting for an opponent right on the game landing, so nobody has to dig into the kanka lobby to find them. */
export function WaitingTables({ game, onJoin }: { game: string; onJoin: (id: string, stake: number) => void }) {
  const idle = useIdle()
  const { data } = useSWR<LobbyData>(`/api/tables?game=${game}`, fetcher, { refreshInterval: idle ? 30000 : 5000 })
  const waiting = (data?.open ?? []).filter((t) => t.status === 'bekliyor' && t.seat < 0 && !t.ambient)
  if (waiting.length === 0) return null

  return (
    <section aria-labelledby="waiting-title" className="flex flex-col gap-2 rounded-2xl border border-primary bg-primary/10 p-4">
      <h3 id="waiting-title" className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-foreground">
        <span className="relative flex size-2.5" aria-hidden="true">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-75" />
          <span className="relative inline-flex size-2.5 rounded-full bg-primary" />
        </span>
        Rakip bekleyen masalar ({waiting.length})
      </h3>
      {waiting.map((t) => (
        <TableRowCard key={t.id} t={t}>
          <button
            type="button"
            onClick={() => onJoin(t.id, t.stake)}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
          >
            Otur · {formatAC(t.stake)} KC
          </button>
        </TableRowCard>
      ))}
    </section>
  )
}
