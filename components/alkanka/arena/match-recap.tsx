'use client'

import Link from 'next/link'
import { useRef } from 'react'
import useSWR from 'swr'
import { cn } from '@/lib/utils'
import type { MatchRecap } from '@/lib/match-recap'
import { formatAC } from '../points-context'

const MAX_RETRIES = 3

const fetchRecap = (url: string) =>
  fetch(url)
    .then((r) => r.json())
    .then((d: { recap: MatchRecap | null }) => d.recap)

/**
 * What the match that just ended changed for the member. `round` separates back-to-back matches
 * of the same game so each one is looked up again.
 */
export function useMatchRecap(match: { game: string; tableId?: string | null; round?: number | string } | null) {
  const tries = useRef(0)
  const key = match ? `/api/arena/recap?game=${encodeURIComponent(match.game)}&table=${encodeURIComponent(match.tableId ?? '')}&n=${match.round ?? 0}` : null
  const { data, isLoading } = useSWR(key, fetchRecap, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    // A table settles a moment after its last move, so the history row can trail the result card briefly.
    refreshInterval: (d) => (d && !d.kc && tries.current < MAX_RETRIES ? 1500 : 0),
    onSuccess: () => {
      tries.current += 1
    },
  })
  return { recap: data ?? null, loading: isLoading }
}

const LEFT_LABEL: Record<string, string> = { game_play: 'maç kaldı', game_win: 'galibiyet kaldı', games_distinct: 'farklı oyun kaldı' }

function Bar({ value }: { value: number }) {
  return (
    <span className="mt-auto block h-1 w-full overflow-hidden rounded-full bg-secondary" aria-hidden="true">
      <span className="block h-full rounded-full bg-primary transition-[width] duration-700" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </span>
  )
}

function Tile({ value, label, bar, strong }: { value: string; label: string; bar?: number; strong?: boolean }) {
  return (
    <li className="flex min-w-0 flex-col gap-1 px-2.5 py-2">
      <span className={cn('text-sm font-black leading-tight tabular-nums', strong ? 'text-primary' : 'text-foreground')}>{value}</span>
      <span className="text-xs leading-tight text-muted-foreground text-pretty">{label}</span>
      {bar != null && <Bar value={bar} />}
    </li>
  )
}

/** KP earned, the nearest task and the next level; the shared footer of every match-end card. */
export function MatchRecapBlock({ recap, loading }: { recap: MatchRecap | null; loading: boolean }) {
  if (loading && !recap) return <span className="h-14 w-full animate-pulse rounded-xl bg-secondary" aria-hidden="true" />
  if (!recap) return null
  const { kp, level, task } = recap
  const notes: string[] = []
  if (kp.earned > 0) notes.push(kp.gamesLeftToday > 0 ? `Bugün ${kp.gamesLeftToday} maç daha KP kazandırır.` : 'Bugünkü oyun KP sınırına ulaştın.')
  else if (recap.kc) notes.push('Bugünkü oyun KP sınırı doldu, yarın yeniden kazanırsın.')
  if (task && !task.done) notes.push(`Görevde ${task.target - task.progress} ${LEFT_LABEL[task.kind] ?? 'adım kaldı'}, ödülü ${formatAC(task.points)} KC.`)

  return (
    <div className="flex w-full flex-col gap-1.5 text-left">
      <ul
        aria-label="Bu maçın kazandırdıkları"
        className={cn('grid divide-x divide-border overflow-hidden rounded-xl border border-border bg-background/40', task ? 'grid-cols-3' : 'grid-cols-2')}
      >
        <Tile value={kp.earned > 0 ? `+${formatAC(kp.earned)} KP` : '0 KP'} label="Kanka Puanı" strong={kp.earned > 0} />
        {task && <Tile value={`${task.progress}/${task.target}`} label={task.title} bar={(task.progress / task.target) * 100} />}
        {level.nextName ? (
          <Tile value={`${formatAC(level.toNext)} KP`} label={`${level.nextName} için kalan`} bar={level.progress} />
        ) : (
          <Tile value={level.name} label="En yüksek seviye" />
        )}
      </ul>
      {(notes.length > 0 || task?.done) && (
        <p className="text-xs leading-relaxed text-muted-foreground text-pretty">
          {notes.join(' ')}
          {task?.done && (
            <>
              {notes.length > 0 && ' '}
              <Link href="/gorevler" className="font-bold text-primary underline-offset-2 hover:underline">
                {`Görev tamam, ${formatAC(task.points)} KC ödülünü al`}
              </Link>
            </>
          )}
        </p>
      )}
    </div>
  )
}
