'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Eye, Loader2, Radio } from 'lucide-react'
import { ARENA_META, type ArenaGame } from '@/lib/arena'
import { cn } from '@/lib/utils'
import { TableRoom, TableRowCard, type TableSummary } from './table-lobby'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export function LiveLobby({ game }: { game?: ArenaGame }) {
  const [filter, setFilter] = useState<string>('all')
  const [watching, setWatching] = useState<string | null>(null)
  const { data, isLoading } = useSWR<{ live: TableSummary[] }>('/api/tables/live', fetcher, { refreshInterval: 5000 })

  if (watching) return <TableRoom id={watching} onLeave={() => setWatching(null)} />

  const all = data?.live ?? []
  const live = game ? all.filter((t) => t.game === game) : all
  const games = Array.from(new Set(live.map((t) => t.game)))
  const shown = filter === 'all' ? live : live.filter((t) => t.game === filter)
  const titleId = game ? `live-title-${game}` : 'live-title'

  return (
    <section className="flex flex-col gap-4" aria-labelledby={titleId}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={titleId} className="flex items-center gap-2 font-display text-xl font-bold text-foreground">
          <Radio className="size-5 text-primary" aria-hidden="true" />
          {game ? 'Aktif masalar' : 'Şu an oynanan masalar'}
          <span className="rounded-full bg-secondary px-2 py-0.5 text-sm font-semibold text-muted-foreground">{live.length}</span>
        </h2>
        {!game && <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Oyun filtresi">
          {['all', ...games].map((g) => (
            <button
              key={g}
              role="tab"
              aria-selected={filter === g}
              onClick={() => setFilter(g)}
              className={cn(
                'shrink-0 rounded-full border px-3 py-1.5 text-sm font-semibold',
                filter === g ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-foreground hover:bg-secondary',
              )}
            >
              {g === 'all' ? 'Hepsi' : (ARENA_META[g as ArenaGame]?.title ?? g)}
            </button>
          ))}
        </div>}
      </div>

      {isLoading && (
        <div className="flex justify-center py-10">
          <Loader2 className="size-6 animate-spin text-muted-foreground" aria-label="Yükleniyor" />
        </div>
      )}

      {!isLoading && shown.length === 0 && (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {game ? 'Bu oyunda şu an aktif masa yok. Çok oyunculu sekmesinden masa aç, burada görünsün.' : 'Şu an oynanan masa yok. Bir oyuna girip masa aç, burada görünsün.'}
        </p>
      )}

      <div className="flex flex-col gap-2">
        {shown.map((t) => (
          <TableRowCard key={t.id} t={t}>
            <div className="flex items-center gap-2">
              {!game && (
                <span className="rounded-md bg-secondary px-2 py-1 text-xs font-semibold text-foreground">
                  {ARENA_META[t.game as ArenaGame]?.title ?? t.game}
                </span>
              )}
              <button
                onClick={() => setWatching(t.id)}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:opacity-90"
              >
                <Eye className="size-4" aria-hidden="true" />
                {t.seat >= 0 ? 'Masaya dön' : 'İzle'}
              </button>
            </div>
          </TableRowCard>
        ))}
      </div>
    </section>
  )
}
