import Link from 'next/link'
import { ChevronRight, Flame, Gauge, TrendingUp } from 'lucide-react'
import type { KpStatus, KpToday, PointRules } from '@/lib/kanka-puan'
import { levelTier } from '@/lib/kanka-puan'
import { LevelEmblem, TIER_BG, TIER_TEXT } from '@/components/alkanka/kp/emblem'
import { cn } from '@/lib/utils'

const TIER_NAMES: Record<string, string> = { bronz: 'Bronz', altin: 'Altın', elmas: 'Elmas', efsane: 'Efsane' }
const TIER_BAR: Record<string, string> = { bronz: 'bg-bronze', altin: 'bg-gold', elmas: 'bg-accent', efsane: 'bg-ruby' }
const fmt = (n: number) => n.toLocaleString('tr-TR')
const RING = 2 * Math.PI * 46

function paceText(remaining: number, perDay: number) {
  if (perDay <= 0) return 'Bugün biraz KP topla, hızın burada görünsün.'
  const days = Math.ceil(remaining / perDay)
  if (days <= 1) return 'Bu tempoyla yarın ulaşırsın.'
  return `Bu tempoyla yaklaşık ${days} günde ulaşırsın.`
}

function CapBar({ label, value, cap, tone }: { label: string; value: number; cap: number; tone: string }) {
  const pct = cap > 0 ? Math.min(100, Math.round((value / cap) * 100)) : 0
  const full = pct >= 100
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2 text-[11px]">
        <span className="text-muted-foreground">{label}</span>
        <span className={cn('font-display font-bold tabular-nums', full ? 'text-live' : 'text-foreground')}>
          {fmt(value)}/{fmt(cap)}
        </span>
      </div>
      <span
        className="h-1.5 overflow-hidden rounded-full bg-background/70"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label} günlük sınır`}
      >
        <span className={cn('block h-full rounded-full', full ? 'bg-live' : tone)} style={{ width: `${pct}%` }} />
      </span>
    </div>
  )
}

export function ProgressHero({
  me,
  today,
  levels,
  rules,
}: {
  me: KpStatus
  today: KpToday
  levels: { name: string; badge: string; min: number }[]
  rules: PointRules
}) {
  const lv = me.level.index + 1
  const tier = levelTier(lv)
  const next = levels[me.level.index + 1]
  const nextTier = next ? levelTier(lv + 1) : tier
  const progress = me.level.progress
  const remaining = next ? Math.max(0, next.min - me.kp) : 0
  const perDay = today.weekTotal / today.weekDays
  const minutes = rules.minute > 0 ? Math.round(today.breakdown.time / rules.minute) : 0
  const chats = rules.chat > 0 ? Math.round(today.breakdown.chat / rules.chat) : 0

  return (
    <section aria-label="Rozet ilerlemen" className={cn('overflow-hidden rounded-2xl border', TIER_BG[tier])}>
      <div className="flex items-center gap-4 p-4 sm:gap-6 sm:p-5">
        <div className={cn('relative grid size-28 shrink-0 place-items-center sm:size-32', TIER_TEXT[tier])}>
          <svg viewBox="0 0 100 100" className="absolute inset-0 size-full -rotate-90" aria-hidden>
            <circle cx="50" cy="50" r="46" fill="none" strokeWidth="5" className="stroke-background/70" />
            <circle
              cx="50"
              cy="50"
              r="46"
              fill="none"
              strokeWidth="5"
              strokeLinecap="round"
              stroke="currentColor"
              strokeDasharray={RING}
              strokeDashoffset={RING * (1 - progress / 100)}
              className="drop-shadow-[0_0_6px_currentColor] motion-safe:transition-[stroke-dashoffset] motion-safe:duration-1000"
            />
          </svg>
          <LevelEmblem level={lv} size="lg" className="size-[4.5rem] sm:size-20" />
          <span className="absolute -bottom-1 rounded-full bg-background px-2 py-0.5 font-display text-[11px] font-bold tabular-nums text-foreground shadow">
            %{progress}
          </span>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className={cn('text-[10px] font-bold uppercase tracking-widest', TIER_TEXT[tier])}>
            {TIER_NAMES[tier]} ligi · Lv {lv}
          </span>
          <span className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-display text-2xl font-bold leading-none text-foreground sm:text-3xl">{me.level.name}</span>
            <span className="font-display text-sm font-bold tabular-nums text-gold">{fmt(me.kp)} KP</span>
          </span>
          {next ? (
            <>
              <span className="flex items-center gap-1.5 text-sm text-foreground">
                <LevelEmblem level={lv + 1} size="xs" locked />
                <span className="text-pretty">
                  <span className={cn('font-bold', TIER_TEXT[nextTier])}>{next.name}</span> için{' '}
                  <span className="font-bold tabular-nums">{fmt(remaining)} KP</span>
                </span>
              </span>
              <span className="flex items-start gap-1.5 text-xs leading-snug text-muted-foreground">
                <TrendingUp className="mt-px size-3.5 shrink-0" aria-hidden />
                <span className="text-pretty">{paceText(remaining, perDay)}</span>
              </span>
            </>
          ) : (
            <span className="text-sm font-bold text-gold">Zirvedesin kanka!</span>
          )}
        </div>

        <Link
          href="/profil"
          className="hidden shrink-0 items-center gap-1 self-start rounded-full border border-border bg-background/60 px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:border-gold/50 sm:inline-flex"
        >
          Profilim <ChevronRight className="size-3.5" aria-hidden />
        </Link>
      </div>

      <div className="flex flex-col gap-3 border-t border-border/70 bg-background/40 p-4 sm:flex-row sm:items-center sm:gap-6 sm:px-5">
        <div className="flex items-center gap-4 sm:gap-6">
          <div className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-lg bg-gold/15 text-gold">
              <Flame className="size-4" aria-hidden />
            </span>
            <span className="flex flex-col">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Bugün</span>
              <span className="font-display text-base font-bold tabular-nums text-foreground">+{fmt(today.total)} KP</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-lg bg-accent/15 text-accent">
              <Gauge className="size-4" aria-hidden />
            </span>
            <span className="flex flex-col">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Sıran</span>
              <span className="font-display text-base font-bold tabular-nums text-foreground">{me.rank ? `#${me.rank}` : '-'}</span>
            </span>
          </div>
        </div>
        <div className="flex flex-1 gap-4">
          <CapBar label="Dakika" value={minutes} cap={rules.minuteDailyCap} tone={TIER_BAR[tier]} />
          <CapBar label="Sohbet" value={chats} cap={rules.chatDailyCap} tone={TIER_BAR[tier]} />
        </div>
      </div>
    </section>
  )
}
