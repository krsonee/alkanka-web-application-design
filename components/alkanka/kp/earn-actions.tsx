import Link from 'next/link'
import { Check, ChevronRight, Clock, Gamepad2, ListChecks, MessageCircle, Send, Star, Target, Trophy, UserPlus, type LucideIcon } from 'lucide-react'
import type { KpBreakdown, PointRules } from '@/lib/kanka-puan'
import { TELEGRAM_URL } from '@/components/alkanka/data'
import { cn } from '@/lib/utils'

type Action = {
  key: keyof PointRules
  label: string
  icon: LucideIcon
  href: string
  cta: string
  status?: string
  cap?: { value: number; max: number }
  done?: boolean
}

const per = (kp: number, rate: number) => (rate > 0 ? Math.round(kp / rate) : 0)

function buildActions(rules: PointRules, today: KpBreakdown | null, telegramLinked: boolean): Action[] {
  const t = today
  return [
    {
      key: 'minute', label: 'Sitede vakit geçir', icon: Clock, href: '/kankatv', cta: 'KankaTV',
      cap: t ? { value: per(t.time, rules.minute), max: rules.minuteDailyCap } : undefined,
    },
    { key: 'game', label: 'Oyun oyna', icon: Gamepad2, href: '/oyunlar', cta: 'Oyna', status: t ? `Bugün ${per(t.games, rules.game)} oyun` : undefined },
    { key: 'task', label: 'Görev tamamla', icon: ListChecks, href: '/gorevler', cta: 'Görevler', status: t ? `Bugün ${per(t.tasks, rules.task)} görev` : undefined },
    {
      key: 'chat', label: 'Sohbete yaz', icon: MessageCircle, href: TELEGRAM_URL, cta: 'Sohbet',
      cap: t ? { value: per(t.chat, rules.chat), max: rules.chatDailyCap } : undefined,
    },
    { key: 'leaguePoint', label: 'Tahmin ligi', icon: Target, href: '/tahminler', cta: 'Tahmin yap', status: t ? `Bugün ${per(t.league, rules.leaguePoint)} lig puanı` : 'Lig puanı başına' },
    { key: 'tournamentWin', label: 'Turnuva kazan', icon: Trophy, href: '/turnuvalar', cta: 'Turnuvalar', status: 'Şampiyona tek seferde' },
    { key: 'review', label: 'Site yorumu yaz', icon: Star, href: '/guven', cta: 'Yorum yaz', status: 'Onaylanan yorum başına' },
    { key: 'referral', label: 'Arkadaş getir', icon: UserPlus, href: '/profil#davet', cta: 'Davet et', status: 'Onaylanan davet başına' },
    {
      key: 'telegram', label: 'Telegram bağla', icon: Send, href: '/profil', cta: 'Bağla',
      status: telegramLinked ? 'Bağlandı' : 'Tek seferlik', done: telegramLinked,
    },
  ]
}

export function EarnActions({
  rules,
  today,
  telegramLinked = false,
}: {
  rules: PointRules
  today: KpBreakdown | null
  telegramLinked?: boolean
}) {
  const actions = buildActions(rules, today, telegramLinked).filter((a) => rules[a.key] > 0)

  return (
    <ul className="grid grid-cols-2 gap-2 lg:grid-cols-3">
      {actions.map((a) => {
        const pct = a.cap && a.cap.max > 0 ? Math.min(100, Math.round((a.cap.value / a.cap.max) * 100)) : null
        const full = a.done || pct === 100
        const external = a.href.startsWith('http')
        const Icon = a.icon
        return (
          <li key={a.key}>
            <Link
              href={a.href}
              {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              className={cn(
                'group flex h-full flex-col gap-2 rounded-xl border bg-card p-3 transition-colors hover:border-gold/50',
                full ? 'border-live/30' : 'border-border',
              )}
            >
              <span className="flex items-center gap-2.5">
                <span className={cn('grid size-8 shrink-0 place-items-center rounded-lg', full ? 'bg-live/15 text-live' : 'bg-gold/15 text-gold')}>
                  {full ? <Check className="size-4" aria-hidden /> : <Icon className="size-4" aria-hidden />}
                </span>
                <span className="min-w-0 flex-1 text-sm font-semibold leading-tight text-foreground">{a.label}</span>
                <span className="shrink-0 rounded-full bg-gold/15 px-2 py-0.5 font-display text-xs font-bold tabular-nums text-gold">
                  +{rules[a.key]}
                </span>
              </span>

              {pct !== null && a.cap ? (
                <span className="flex flex-col gap-1">
                  <span className="flex items-baseline justify-between text-[11px] text-muted-foreground">
                    <span>{full ? 'Bugünkü sınır doldu' : 'Bugün'}</span>
                    <span className={cn('font-display font-bold tabular-nums', full ? 'text-live' : 'text-foreground')}>
                      {a.cap.value}/{a.cap.max}
                    </span>
                  </span>
                  <span className="h-1 overflow-hidden rounded-full bg-muted" aria-hidden>
                    <span className={cn('block h-full rounded-full', full ? 'bg-live' : 'bg-gold')} style={{ width: `${pct}%` }} />
                  </span>
                </span>
              ) : (
                <span className={cn('text-[11px] leading-snug', a.done ? 'font-semibold text-live' : 'text-muted-foreground')}>
                  {a.status ?? ' '}
                </span>
              )}

              <span className="mt-auto inline-flex items-center gap-0.5 text-xs font-bold text-gold">
                {a.done ? 'Tamam' : a.cta}
                <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
