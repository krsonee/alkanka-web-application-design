'use client'

import { useState } from 'react'
import { Crown, Target, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { LevelEmblem, RankChip } from './kp/emblem'
import { MemberRank } from './kp/member-rank'

export type KpRow = { userId: string; name: string; kp: number; level: number; levelName: string; specials: number }
export type TipRow = { userId: string; name: string; points: number; hits: number; exact: number; picks: number }
export type BoardPeriod = 'gun' | 'hafta' | 'ay'

const PERIODS: { id: BoardPeriod; label: string; note: string }[] = [
  { id: 'gun', label: 'Günlük', note: 'Her gece 00:00’da sıfırlanır' },
  { id: 'hafta', label: 'Haftalık', note: 'Her pazartesi sıfırlanır' },
  { id: 'ay', label: 'Aylık', note: 'Her ayın 1’inde sıfırlanır' },
]

const fmt = (n: number) => n.toLocaleString('tr-TR')

function Rank({ n }: { n: number }) {
  return (
    <span
      className={cn(
        'flex size-7 shrink-0 items-center justify-center rounded-md font-display text-xs font-bold',
        n === 1 ? 'bg-primary text-primary-foreground' : n <= 3 ? 'border border-primary/50 text-primary' : 'text-muted-foreground',
      )}
    >
      {n === 1 ? <Crown className="size-3.5" aria-label="1." /> : n}
    </span>
  )
}

function Empty({ text }: { text: string }) {
  return <p className="px-4 py-10 text-center text-sm text-muted-foreground">{text}</p>
}

export function RankBoards({ kp, tips, meId }: { kp: Record<BoardPeriod, KpRow[]>; tips: Record<BoardPeriod, TipRow[]>; meId: string | null }) {
  const [period, setPeriod] = useState<BoardPeriod>('hafta')
  const current = PERIODS.find((p) => p.id === period)!

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Dönem" className="flex rounded-lg bg-secondary p-1">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              role="tab"
              type="button"
              aria-selected={period === p.id}
              onClick={() => setPeriod(p.id)}
              className={cn(
                'h-9 rounded-md px-4 text-xs font-bold uppercase tracking-wider transition-colors',
                period === p.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{current.note}. Dönem birincisi şampiyon rozetini alır.</p>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section aria-labelledby="kp-board" className="panel-gold overflow-hidden rounded-xl">
          <header className="flex items-center gap-2 border-b border-border px-4 py-3">
            <Zap className="size-4 text-primary" aria-hidden />
            <h3 id="kp-board" className="text-xs font-bold uppercase tracking-wider text-foreground">Kanka Puan liderleri</h3>
          </header>
          {kp[period].length ? (
            <ol>
              {kp[period].map((u, i) => (
                <li key={u.userId} className={cn('flex items-center gap-3 border-b border-border px-4 py-2.5 last:border-0', i < 3 && 'bg-primary/5', u.userId === meId && 'ring-1 ring-inset ring-primary')}>
                  <Rank n={i + 1} />
                  <LevelEmblem level={u.level} size="sm" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate text-sm font-semibold text-foreground">{u.name}{u.userId === meId && ' (sen)'}</span>
                      <RankChip level={u.level} />
                    </span>
                    <span className="truncate text-[11px] text-muted-foreground">{u.levelName}{u.specials ? ` · ${u.specials} değerli rozet` : ''}</span>
                  </span>
                  <span className="font-display text-sm font-bold tabular-nums text-foreground">{fmt(u.kp)} <span className="text-[10px] text-muted-foreground">KP</span></span>
                </li>
              ))}
            </ol>
          ) : (
            <Empty text="Bu dönem henüz puan toplanmadı. İlk sen başla kanka!" />
          )}
        </section>

        <section aria-labelledby="tip-board" className="panel-gold overflow-hidden rounded-xl">
          <header className="flex items-center gap-2 border-b border-border px-4 py-3">
            <Target className="size-4 text-primary" aria-hidden />
            <h3 id="tip-board" className="text-xs font-bold uppercase tracking-wider text-foreground">Tahmin ligi liderleri</h3>
          </header>
          {tips[period].length ? (
            <ol>
              {tips[period].map((u, i) => (
                <li key={u.userId} className={cn('flex items-center gap-3 border-b border-border px-4 py-2.5 last:border-0', i < 3 && 'bg-primary/5', u.userId === meId && 'ring-1 ring-inset ring-primary')}>
                  <Rank n={i + 1} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate text-sm font-semibold text-foreground">{u.name}{u.userId === meId && ' (sen)'}</span>
                      <MemberRank userId={u.userId} />
                    </span>
                    <span className="truncate text-[11px] text-muted-foreground">{u.hits}/{u.picks} doğru · {u.exact} tam skor</span>
                  </span>
                  <span className="font-display text-sm font-bold tabular-nums text-foreground">{fmt(u.points)} <span className="text-[10px] text-muted-foreground">puan</span></span>
                </li>
              ))}
            </ol>
          ) : (
            <Empty text="Bu dönemde sonuçlanan tahmin yok. Tahmin ligine katıl!" />
          )}
        </section>
      </div>
    </div>
  )
}
