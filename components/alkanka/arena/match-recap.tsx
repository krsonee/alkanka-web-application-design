'use client'

import Link from 'next/link'
import { useRef } from 'react'
import useSWR from 'swr'
import { Target, TrendingUp, Zap } from 'lucide-react'
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

function Bar({ value, className }: { value: number; className?: string }) {
  return (
    <span className="block h-1.5 w-full overflow-hidden rounded-full bg-secondary" aria-hidden="true">
      <span className={cn('block h-full rounded-full bg-primary transition-[width] duration-700', className)} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </span>
  )
}

function Row({ icon: Icon, title, value, note, children }: { icon: typeof Zap; title: string; value: string; note?: string; children?: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 rounded-xl border border-border bg-background/40 px-3 py-2">
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="min-w-0 truncate text-sm font-bold text-foreground">{title}</span>
          <span className="shrink-0 text-sm font-black tabular-nums text-primary">{value}</span>
        </span>
        {children}
        {note && <span className="text-xs leading-relaxed text-muted-foreground">{note}</span>}
      </span>
    </li>
  )
}

/** KP earned, the nearest task and the next level; the shared footer of every match-end card. */
export function MatchRecapBlock({ recap, loading }: { recap: MatchRecap | null; loading: boolean }) {
  if (loading && !recap) {
    return (
      <div className="flex w-full flex-col gap-1.5" aria-hidden="true">
        <span className="h-12 animate-pulse rounded-xl bg-secondary" />
        <span className="h-12 animate-pulse rounded-xl bg-secondary" />
      </div>
    )
  }
  if (!recap) return null
  const { kp, level, task } = recap
  return (
    <ul className="flex w-full flex-col gap-1.5 text-left" aria-label="Bu maçın kazandırdıkları">
      <Row
        icon={Zap}
        title="Kanka Puanı"
        value={kp.earned > 0 ? `+${formatAC(kp.earned)} KP` : '0 KP'}
        note={
          kp.earned > 0
            ? kp.gamesLeftToday > 0
              ? `Bugün ${kp.gamesLeftToday} maç daha KP kazandırır.`
              : 'Bugünkü oyun KP sınırına ulaştın.'
            : recap.kc
              ? 'Bugünkü oyun KP sınırı doldu, yarın yeniden kazanırsın.'
              : undefined
        }
      />
      {task && (
        <Row
          icon={Target}
          title={task.title}
          value={`${task.progress}/${task.target}`}
          note={
            task.done
              ? undefined
              : `${task.target - task.progress} ${LEFT_LABEL[task.kind] ?? 'adım kaldı'} · ödül ${formatAC(task.points)} KC`
          }
        >
          <Bar value={(task.progress / task.target) * 100} />
          {task.done && (
            <Link href="/gorevler" className="text-xs font-bold text-primary underline-offset-2 hover:underline">
              Görev tamam, {formatAC(task.points)} KC ödülünü al
            </Link>
          )}
        </Row>
      )}
      <Row
        icon={TrendingUp}
        title={level.nextName ? `Sıradaki seviye: ${level.nextName}` : `Seviye: ${level.name}`}
        value={level.nextName ? `${formatAC(level.toNext)} KP kaldı` : 'Zirve'}
        note={level.nextName ? undefined : 'En yüksek seviyedesin kanka.'}
      >
        {level.nextName && <Bar value={level.progress} />}
      </Row>
    </ul>
  )
}
