'use client'

import Image from 'next/image'
import type { ReactNode } from 'react'
import { Bot, Loader2, Play, Plus, UserPlus, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ArenaGame } from '@/lib/arena'

const fmt = (n: number) => n.toLocaleString('tr-TR')

export type PlayTab = 'bot' | 'kanka'

export const BOT_QUICK: Partial<Record<ArenaGame, Record<string, unknown>>> = {
  okey: { seats: 4, team: false, bots: 3 },
  okey101: { seats: 4, team: false, bots: 3, rounds: 1 },
  batak: { seats: 4, bots: 3, rounds: 1, variant: 'klasik', extras: ['batma'] },
  pisti: { seats: 2, bots: 1, variant: '151', team: false },
  papaz: { seats: 4, bots: 3, extras: [] },
  monopoly: { seats: 4, bots: 3, extras: [] },
}

const BOT_HINT: Partial<Record<ArenaGame, string>> = {
  okey: '3 botla tekli masa. Beklemeden başlar.',
  okey101: '3 botla tekli masa, tek el. Beklemeden başlar.',
  batak: '3 botla klasik batak, tek el. Beklemeden başlar.',
  pisti: 'Bire bir bota karşı, 151 puan. Beklemeden başlar.',
  papaz: '3 botla masa. Beklemeden başlar.',
  monopoly: '3 botla masa. Beklemeden başlar.',
}

export function PlayChooser({
  game,
  title,
  image,
  bets,
  stake,
  onStake,
  tab,
  onTab,
  botAllowed,
  guest,
  balance,
  busy,
  commission,
  openCount,
  tables,
  onBot,
  onWizard,
}: {
  game: ArenaGame
  title: string
  image?: string
  bets: number[]
  stake: number
  onStake: (n: number) => void
  tab: PlayTab
  onTab: (t: PlayTab) => void
  botAllowed: boolean
  guest: boolean
  balance: number
  busy: boolean
  commission: number
  openCount: number | null
  tables: ReactNode
  onBot: () => void
  onWizard: () => void
}) {
  const quick = botAllowed ? BOT_QUICK[game] : undefined
  const hasBot = Boolean(quick)
  const active: PlayTab = hasBot ? tab : 'kanka'
  const botSeats = Number(quick?.seats ?? 4)
  const pot = stake * botSeats
  const prize = pot - Math.round((pot * commission) / 100)
  const openLabel = openCount == null ? 'Yükleniyor' : openCount === 0 ? 'Açık masa yok' : `${openCount} açık masa`

  return (
    <section aria-labelledby="play-chooser-h" className="flex flex-col gap-4">
      <div className="relative flex items-center gap-4 overflow-hidden rounded-2xl border border-border bg-card p-4 sm:gap-5 sm:p-6">
        {image && (
          <span className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-secondary ring-1 ring-border sm:size-24">
            <Image src={image || '/placeholder.svg'} alt="" fill sizes="96px" className="object-cover" />
          </span>
        )}
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-xs font-bold uppercase tracking-wider text-primary">{title}</span>
          <h2 id="play-chooser-h" className="text-balance text-xl font-black leading-tight text-foreground sm:text-3xl">
            Nasıl oynamak istersin?
          </h2>
          <p className="hidden text-pretty text-sm leading-relaxed text-muted-foreground sm:block">
            {hasBot
              ? 'Beklemeden botlara karşı başla ya da oyuncuların açtığı bir masaya otur. İstersen kendi masanı da açabilirsin.'
              : 'Oyuncuların açtığı bir masaya otur ya da kurallarını seçip kendi masanı aç.'}
          </p>
          {guest && (
            <p className="mt-1 text-pretty text-xs leading-relaxed text-muted-foreground">
              Oynamak için üye olman yeterli. Seçimlerini koruruz, üye olunca kaldığın yerden devam edersin.
            </p>
          )}
        </div>
      </div>

      {hasBot && (
        <div className="grid grid-cols-2 gap-1 rounded-2xl border border-border bg-card p-1 lg:hidden" role="tablist" aria-label="Oyun şekli">
          {(
            [
              ['bot', 'Bota karşı', 'Hemen başla', Bot],
              ['kanka', 'Oyuncularla', openLabel, Users],
            ] as const
          ).map(([k, label, sub, Icon]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={active === k}
              onClick={() => onTab(k)}
              className={cn(
                'flex items-center justify-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition-colors',
                active === k ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
              )}
            >
              <Icon className="size-5 shrink-0" aria-hidden="true" />
              <span className="flex min-w-0 flex-col">
                <span className="text-sm font-bold leading-tight">{label}</span>
                <span className={cn('truncate text-xs leading-tight', active === k ? 'text-primary-foreground/80' : 'text-muted-foreground')}>{sub}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      <div className={cn('grid grid-cols-1 gap-4', hasBot && 'lg:grid-cols-2')}>
        {hasBot && (
          <div
            className={cn(
              'flex-col gap-4 rounded-2xl border border-border bg-card p-4 sm:p-5',
              active === 'bot' ? 'flex' : 'hidden lg:flex',
            )}
          >
            <CardHead icon={<Bot className="size-5" aria-hidden="true" />} title="Bota karşı hemen oyna" hint={BOT_HINT[game] ?? 'Beklemeden başlar.'} />
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2 text-xs font-semibold text-muted-foreground">
                <span>Bahis (KC)</span>
                {!guest && <span className="tabular-nums">{`Bakiye: ${fmt(balance)} KC`}</span>}
              </div>
              <div className="grid grid-cols-4 gap-1.5" role="radiogroup" aria-label="Bahis">
                {bets.map((b) => {
                  const off = !guest && b > balance
                  return (
                    <button
                      key={b}
                      type="button"
                      role="radio"
                      aria-checked={stake === b}
                      disabled={off}
                      onClick={() => onStake(b)}
                      className={cn(
                        'h-10 min-w-0 truncate rounded-lg border text-sm font-bold tabular-nums transition-colors disabled:cursor-not-allowed disabled:opacity-35',
                        stake === b
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-secondary/60 text-foreground hover:border-muted-foreground/40',
                      )}
                    >
                      {fmt(b)}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/25 bg-primary/10 px-4 py-3">
              <span className="text-sm text-muted-foreground">Kazanırsan</span>
              <span className="text-lg font-black tabular-nums text-primary">{`${fmt(prize)} KC`}</span>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={onBot}
              className="mt-auto inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : guest ? (
                <UserPlus className="size-4" aria-hidden="true" />
              ) : (
                <Play className="size-4" aria-hidden="true" />
              )}
              {guest ? 'Üye ol ve oyna' : 'Bota karşı hemen oyna'}
            </button>
          </div>
        )}

        <div
          className={cn(
            'flex-col gap-4 rounded-2xl border border-border bg-card p-4 sm:p-5',
            active === 'kanka' ? 'flex' : 'hidden lg:flex',
          )}
        >
          <CardHead icon={<Users className="size-5" aria-hidden="true" />} title="Oyuncularla oyna" hint="Açık bir masaya otur ya da kendi masanı kur." />
          <div className="flex min-h-0 flex-col gap-2">
            <div className="flex items-center justify-between gap-2 text-xs font-semibold text-muted-foreground">
              <span>Açık masalar</span>
              <span>{openLabel}</span>
            </div>
            <div className="flex max-h-80 flex-col gap-2 overflow-y-auto pr-0.5">{tables}</div>
          </div>
          <button
            type="button"
            onClick={onWizard}
            className="mt-auto inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90"
          >
            <Plus className="size-4" aria-hidden="true" />
            Kendi masanı aç
          </button>
        </div>
      </div>
    </section>
  )
}

function CardHead({ icon, title, hint }: { icon: ReactNode; title: string; hint: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">{icon}</span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <h3 className="font-bold leading-tight text-foreground">{title}</h3>
        <p className="text-pretty text-sm leading-relaxed text-muted-foreground">{hint}</p>
      </div>
    </div>
  )
}
