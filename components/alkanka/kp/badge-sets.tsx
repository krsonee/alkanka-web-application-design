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
      <ul className="grid gap-3 sm:grid-cols-2">
        {sets.map((s) => {
          const done = s.owned.length === s.badgeIds.length
          return (
            <li key={s.id} className={cn('flex flex-col gap-3 rounded-2xl border p-4', s.claimed ? 'border-gold/50 bg-gold/5' : 'border-border bg-card')}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-0.5">
                  <span className="font-display text-base font-bold text-foreground">{s.name}</span>
                  <span className="text-xs leading-relaxed text-muted-foreground">{s.description}</span>
                </div>
                <span className="shrink-0 rounded-full bg-gold/15 px-2.5 py-1 font-display text-xs font-bold text-gold">+{s.reward.toLocaleString('tr-TR')} KP</span>
              </div>
              <ul className="flex flex-wrap gap-2">
                {s.badgeIds.map((id) => {
                  const b = byId.get(id)
                  if (!b) return null
                  const have = s.owned.includes(id)
                  return (
                    <li key={id} className="flex items-center gap-1.5 rounded-lg bg-background/70 px-2 py-1">
                      <SpecialEmblem icon={b.icon} tier={b.tier} size="xs" locked={signedIn && !have} />
                      <span className={cn('text-[11px] font-semibold', have ? 'text-foreground' : 'text-muted-foreground')}>{b.name}</span>
                    </li>
                  )
                })}
              </ul>
              <div className="flex items-center justify-between gap-2 border-t border-border pt-2 text-[11px] text-muted-foreground">
                {s.claimed ? (
                  <span className="flex items-center gap-1 font-bold text-gold"><Check className="size-3.5" aria-hidden /> Tamamladın, ödül alındı</span>
                ) : signedIn ? (
                  <span>{done ? 'Tamamlandı' : `${s.owned.length}/${s.badgeIds.length} rozet`}</span>
                ) : (
                  <span>Giriş yap, ilerlemeni gör</span>
                )}
                <span>{s.completedBy ? `${s.completedBy} kişi tamamladı` : 'Henüz tamamlayan yok'}</span>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
