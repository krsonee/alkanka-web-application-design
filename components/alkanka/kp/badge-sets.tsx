import { Check, Layers } from 'lucide-react'
import type { SetProgress } from '@/lib/badge-value'
import { SpecialEmblem } from './emblem'
import { cn } from '@/lib/utils'

type BadgeLite = { id: string; name: string; icon: string; tier: string }

export function BadgeSets({ sets, badges, signedIn }: { sets: SetProgress[]; badges: BadgeLite[]; signedIn: boolean }) {
  const byId = new Map(badges.map((b) => [b.id, b]))
  return (
    <section aria-labelledby="setler" className="flex scroll-mt-32 flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="setler" className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
          <Layers className="size-5 text-gold" aria-hidden /> Koleksiyon setleri
        </h2>
        <p className="text-xs text-muted-foreground">Setin tüm rozetlerini topla, büyük KP ödülü otomatik hesabına geçsin.</p>
      </div>
      <ul className="no-scrollbar grid gap-3 max-sm:-mx-4 max-sm:flex max-sm:snap-x max-sm:scroll-px-4 max-sm:overflow-x-auto max-sm:px-4 max-sm:*:w-[84%] max-sm:*:shrink-0 max-sm:*:snap-start sm:grid-cols-2">
        {sets.map((s) => {
          const total = s.badgeIds.length
          const done = s.owned.length === total
          const share = total ? Math.round((s.owned.length / total) * 100) : 0
          return (
            <li
              key={s.id}
              className={cn(
                'flex flex-col gap-3 rounded-2xl border p-3.5 shadow-[inset_0_1px_0_0_oklch(1_0_0/0.05)] sm:p-4',
                s.claimed ? 'border-gold/50 bg-gold/5' : 'border-border bg-card bg-gradient-to-b from-foreground/[0.03] to-transparent',
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="font-display text-base font-bold leading-tight text-foreground">{s.name}</span>
                  <span className="line-clamp-2 text-xs leading-relaxed text-muted-foreground text-pretty">{s.description}</span>
                </div>
                <span className="shrink-0 rounded-full bg-gold/15 px-2.5 py-1 font-display text-xs font-bold tabular-nums text-gold">+{s.reward.toLocaleString('tr-TR')} KP</span>
              </div>
              <ul className="grid grid-cols-2 gap-1.5">
                {s.badgeIds.map((id) => {
                  const b = byId.get(id)
                  if (!b) return null
                  const have = s.owned.includes(id)
                  return (
                    <li
                      key={id}
                      className={cn('flex min-w-0 items-center gap-2 rounded-xl border px-2 py-1.5', have ? 'border-gold/40 bg-gold/10' : 'border-border bg-background/60')}
                    >
                      <SpecialEmblem icon={b.icon} tier={b.tier} size="xs" locked={signedIn && !have} />
                      <span className={cn('min-w-0 truncate text-xs font-semibold', have ? 'text-foreground' : 'text-muted-foreground')}>{b.name}</span>
                    </li>
                  )
                })}
              </ul>
              <div className="mt-auto flex flex-col gap-1.5">
                <span className="h-1 overflow-hidden rounded-full bg-foreground/10" aria-hidden="true">
                  <span className="block h-full rounded-full bg-gold" style={{ width: `${signedIn ? share : 0}%` }} />
                </span>
                <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                  {s.claimed ? (
                    <span className="flex items-center gap-1 font-bold text-gold">
                      <Check className="size-3.5" aria-hidden /> Tamamladın, ödül alındı
                    </span>
                  ) : signedIn ? (
                    <span className="font-semibold tabular-nums text-foreground">{done ? 'Tamamlandı' : `${s.owned.length}/${total} rozet`}</span>
                  ) : (
                    <span>Giriş yap, ilerlemeni gör</span>
                  )}
                  <span className="truncate">{s.completedBy ? `${s.completedBy} kişi tamamladı` : 'Henüz tamamlayan yok'}</span>
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
