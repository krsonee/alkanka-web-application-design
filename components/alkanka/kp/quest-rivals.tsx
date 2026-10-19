import { Check, Flag, Users } from 'lucide-react'
import { LevelEmblem, SpecialEmblem, TIER_BG, TIER_TEXT } from '@/components/alkanka/kp/emblem'
import { TIER_NAMES } from '@/lib/kanka-puan-shared'
import type { Rival, WeeklyQuest } from '@/lib/kp-extras'
import { cn } from '@/lib/utils'

const fmt = (n: number) => n.toLocaleString('tr-TR')

export function WeeklyQuestCard({ quest, signedIn }: { quest: WeeklyQuest; signedIn: boolean }) {
  const progress = Math.min(quest.progress ?? 0, quest.target)
  const pct = Math.round((progress / quest.target) * 100)
  return (
    <section aria-labelledby="haftalik-gorev" className={cn('flex flex-col gap-4 rounded-2xl border p-4 sm:flex-row sm:items-center sm:gap-5 sm:p-5', TIER_BG[quest.badge.tier])}>
      <div className="flex items-center gap-4 sm:flex-col sm:gap-2">
        <span className={cn('relative flex rounded-full', !quest.done && 'animate-badge-pulse')}>
          <SpecialEmblem icon={quest.badge.icon} tier={quest.badge.tier} size="lg" />
        </span>
        <div className="flex min-w-0 flex-col sm:hidden">
          <span className="text-[10px] font-bold uppercase tracking-widest text-gold">Haftalık görev</span>
          <h2 id="haftalik-gorev" className="font-display text-lg font-bold leading-tight text-foreground">{quest.title}</h2>
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="hidden flex-col sm:flex">
          <span className="text-[10px] font-bold uppercase tracking-widest text-gold">Haftalık görev</span>
          <span className="font-display text-xl font-bold leading-tight text-foreground">{quest.title}</span>
        </div>
        <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
          Bu hafta <b className="text-foreground">{fmt(quest.target)} {quest.unit}</b> tamamla, <b className="text-foreground">{quest.badge.name}</b> rozeti
          {quest.badge.bonus > 0 ? ` ve +${fmt(quest.badge.bonus)} KP` : ''} senin olsun.
        </p>
        {signedIn ? (
          quest.done ? (
            <p className="flex items-center gap-2 rounded-xl bg-gold/15 p-3 text-sm font-semibold text-foreground">
              <Check className="size-4 shrink-0 text-gold" aria-hidden /> Bu haftanın rozetini kaptın, helal kanka.
            </p>
          ) : (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold tabular-nums text-foreground">
                  {fmt(progress)}/{fmt(quest.target)} {quest.unit}
                </span>
                <span className="font-display font-bold tabular-nums text-gold">%{pct}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Görev ilerlemesi">
                <div className="h-full rounded-full bg-gold transition-[width] duration-700" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )
        ) : (
          <a href="#giris" className="inline-flex h-10 w-fit items-center justify-center rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground">Giriş yap, göreve katıl</a>
        )}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Flag className="size-3.5" aria-hidden /> {quest.daysLeft > 0 ? `${quest.daysLeft} gün kaldı` : 'Bugün son gün'}
          </span>
          <span className="flex items-center gap-1">
            <Users className="size-3.5" aria-hidden /> Bu hafta {fmt(quest.winners)} kişi tamamladı
          </span>
        </div>
      </div>
    </section>
  )
}

export function LeagueRivals({ tier, rivals }: { tier: string; rivals: Rival[] }) {
  const me = rivals.find((r) => r.me)
  const ahead = rivals.filter((r) => r.gap > 0).at(-1)
  return (
    <section aria-labelledby="lig-rakipler" className={cn('flex flex-col gap-3 rounded-2xl border p-4', TIER_BG[tier])}>
      <div className="flex flex-col gap-0.5">
        <h2 id="lig-rakipler" className={cn('font-display text-base font-bold', TIER_TEXT[tier])}>{TIER_NAMES[tier]} Ligi&apos;nde yanındakiler</h2>
        <p className="text-xs text-muted-foreground">
          {ahead && me ? `${fmt(ahead.gap)} KP daha topla, ${ahead.name} kişisini geç.` : 'Ligin zirvesindesin, arkandakilere dikkat.'}
        </p>
      </div>
      <ol className="flex flex-col gap-1.5">
        {rivals.map((r, i) => (
          <li key={i} className={cn('flex items-center gap-3 rounded-xl px-3 py-2', r.me ? 'border border-gold bg-card' : 'bg-background/60')}>
            <LevelEmblem level={r.level} size="xs" />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className={cn('truncate text-sm', r.me ? 'font-bold text-foreground' : 'font-semibold text-foreground')}>{r.name}</span>
              <span className="truncate text-[11px] text-muted-foreground">{r.levelName}</span>
            </span>
            <span className="flex shrink-0 flex-col items-end">
              <span className="font-display text-sm font-bold tabular-nums text-foreground">{fmt(r.kp)}</span>
              {!r.me && <span className={cn('text-[10px] font-semibold tabular-nums', r.gap > 0 ? 'text-muted-foreground' : 'text-gold')}>{r.gap > 0 ? `+${fmt(r.gap)}` : fmt(r.gap)}</span>}
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}
