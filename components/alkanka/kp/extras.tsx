import { Crown, Flame, Radio, Sparkles } from 'lucide-react'
import { SpecialEmblem, TIER_BG, TIER_TEXT } from '@/components/alkanka/kp/emblem'
import type { FeedItem, HiddenBadge, Streak, WeeklyStar } from '@/lib/kp-extras'
import { cn } from '@/lib/utils'

const fmt = (n: number) => n.toLocaleString('tr-TR')

export function StreakCard({ streak }: { streak: Streak }) {
  const next = streak.current < 7 ? 7 : streak.current < 30 ? 30 : null
  return (
    <section aria-label="Günlük seri" className="kp-card flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <span className={cn('flex size-11 shrink-0 items-center justify-center rounded-xl', streak.current > 0 ? 'bg-gold/15 text-gold' : 'bg-muted text-muted-foreground')}>
          <Flame className={cn('size-6', streak.current > 0 && 'kp-flame')} aria-hidden />
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="font-display text-xl font-bold leading-tight text-foreground">
            {streak.current} gün <span className="text-sm font-semibold text-muted-foreground">seri</span>
          </span>
          <span className="text-xs text-muted-foreground">
            {streak.activeToday ? 'Bugün buradasın, seri devam.' : 'Bugün uğra, seri kopmasın.'} En iyi: {streak.best} gün
          </span>
        </div>
      </div>
      <ol className="grid grid-cols-7 gap-1.5" aria-label="Son 7 gün">
        {streak.week.map((d, i) => (
          <li key={i} className="flex flex-col items-center gap-1">
            <span
              className={cn(
                'flex size-7 items-center justify-center rounded-full border',
                d.active ? 'border-gold bg-gold text-gold-foreground' : 'border-border bg-background text-muted-foreground',
                i === 6 && d.active ? 'kp-today' : 'kp-dot',
              )}
              style={{ '--i': i } as React.CSSProperties}
              aria-label={`${d.day}: ${d.active ? 'aktif' : 'yok'}`}
            >
              <Flame className="size-3.5" aria-hidden />
            </span>
            <span className={cn('text-[10px] font-semibold', i === 6 ? 'text-foreground' : 'text-muted-foreground')}>{i === 6 ? 'Bugün' : d.day}</span>
          </li>
        ))}
      </ol>
      {next && (
        <p className="text-xs text-muted-foreground">
          <span className="font-bold text-gold">{next - streak.current} gün</span> daha gel, gizli bir rozet açılsın.
        </p>
      )}
    </section>
  )
}

export function WeeklyStarCard({ star }: { star: WeeklyStar }) {
  return (
    <section aria-label="Haftanın kankası" className="kp-card kp-glow flex flex-col gap-3 rounded-2xl border border-gold/30 bg-gold/5 p-4" style={{ '--i': 2 } as React.CSSProperties}>
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-gold">
          <Crown className="kp-crown size-3.5" aria-hidden /> Haftanın kankası
        </span>
        <span className="rounded-full bg-background/70 px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
          {star.daysLeft > 0 ? `${star.daysLeft} gün kaldı` : 'Bu gece bitiyor'}
        </span>
      </div>
      {star.name ? (
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate font-display text-xl font-bold text-foreground">{star.name}</span>
          <span className="shrink-0 font-display text-sm font-bold tabular-nums text-gold">{fmt(star.kp)} KP</span>
        </div>
      ) : (
        <p className="font-display text-base font-bold text-foreground">Bu hafta tahtta kimse yok, ilk sen otur.</p>
      )}
      <p className="text-xs leading-relaxed text-muted-foreground">
        {star.mine
          ? star.mine.rank === 1
            ? 'Şu an zirvedesin. Pazar gecesine kadar koru.'
            : `Bu hafta ${fmt(star.mine.kp)} KP topladın${star.mine.rank ? `, ${star.mine.rank}. sıradasın` : ''}.`
          : 'Pazartesi sıfırlanır. Haftanın en çok KP toplayanı tahta çıkar.'}
      </p>
    </section>
  )
}

export function HiddenBadges({ badges, signedIn }: { badges: HiddenBadge[]; signedIn: boolean }) {
  const found = badges.filter((b) => b.unlocked).length
  return (
    <section aria-labelledby="gizli" className="flex scroll-mt-32 flex-col gap-3">
      <div className="flex items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="gizli" className="font-display text-lg font-bold text-foreground">Gizli rozetler</h2>
          <p className="text-xs text-muted-foreground">Nasıl açılacağı yazmıyor, sadece ipucu var.</p>
        </div>
        {signedIn && (
          <span className="shrink-0 rounded-full border border-border bg-card px-2.5 py-1 font-display text-xs font-bold tabular-nums text-foreground">
            {found}/{badges.length}
          </span>
        )}
      </div>
      <ul className="grid grid-cols-3 gap-2 lg:grid-cols-6">
        {badges.map((b) => (
          <li
            key={b.id}
            className={cn('flex flex-col items-center gap-2 rounded-xl border p-3 text-center', b.unlocked ? TIER_BG[b.tier] : 'border-dashed border-border bg-card/60')}
          >
            <SpecialEmblem icon={b.unlocked ? b.icon : 'award'} tier={b.tier} size="sm" locked={!b.unlocked} />
            <span className={cn('text-xs font-bold leading-tight', b.unlocked ? TIER_TEXT[b.tier] : 'text-muted-foreground')}>
              {b.unlocked ? b.name : '???'}
            </span>
            <span className="text-pretty text-[11px] leading-snug text-muted-foreground">{b.unlocked ? b.description : b.hint}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

const rtf = new Intl.RelativeTimeFormat('tr', { numeric: 'auto' })
function ago(iso: string) {
  const s = Math.round((new Date(iso).getTime() - Date.now()) / 1000)
  if (s > -60) return 'az önce'
  if (s > -3600) return rtf.format(Math.round(s / 60), 'minute')
  if (s > -86400) return rtf.format(Math.round(s / 3600), 'hour')
  return rtf.format(Math.round(s / 86400), 'day')
}

const VERB: Record<FeedItem['kind'], string> = { rozet: 'rozetini aldı', turnuva: 'turnuvasını kazandı', gorev: 'tamamladı' }

export function LiveFeed({ items }: { items: FeedItem[] }) {
  return (
    <section aria-labelledby="akis" className="flex scroll-mt-32 flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 id="akis" className="inline-flex items-center gap-2 font-display text-lg font-bold text-foreground">
          <span className="relative flex size-2.5" aria-hidden>
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-gold opacity-60" />
            <span className="relative inline-flex size-2.5 rounded-full bg-gold" />
          </span>
          Canlı akış
        </h2>
        <p className="text-xs text-muted-foreground">Toplulukta son kazananlar.</p>
      </div>
      {items.length ? (
        <ol className="flex flex-col divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {items.map((it) => (
            <li key={it.id} className="flex items-center gap-3 px-3 py-2.5">
              <SpecialEmblem icon={it.icon} tier={it.tier ?? (it.kind === 'turnuva' ? 'efsane' : 'altin')} size="xs" />
              <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                <span className="font-bold text-foreground">{it.name}</span>{' '}
                {it.kind === 'gorev' ? 'bir görev' : <span className="font-semibold text-foreground">{it.text}</span>} {VERB[it.kind]}
              </p>
              <time dateTime={it.at} className="shrink-0 text-[11px] text-muted-foreground">{ago(it.at)}</time>
            </li>
          ))}
        </ol>
      ) : (
        <p className="flex items-center gap-2 rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
          <Radio className="size-4" aria-hidden /> Henüz hareket yok. İlk rozeti sen kap.
        </p>
      )}
    </section>
  )
}

export function ExtrasGuestHint() {
  return (
    <p className="flex items-center gap-2 text-xs text-muted-foreground">
      <Sparkles className="size-3.5 text-gold" aria-hidden /> Giriş yapınca serin ve gizli rozetlerin burada görünür.
    </p>
  )
}
