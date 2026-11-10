'use client'

import Image from 'next/image'
import { Bot, Loader2, Plus, Users } from 'lucide-react'
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
  onBot: () => void
  onWizard: () => void
}) {
  const hasBot = botAllowed && Boolean(BOT_QUICK[game])
  const active = hasBot ? tab : 'kanka'
  return (
    <section aria-labelledby="play-chooser-h" className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-center gap-4 p-4 sm:p-5">
        {image && (
          <span className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-secondary sm:size-20">
            <Image src={image || '/placeholder.svg'} alt="" fill sizes="80px" className="object-cover" />
          </span>
        )}
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-xs font-bold uppercase tracking-wider text-primary">{title}</span>
          <h2 id="play-chooser-h" className="text-balance text-xl font-black text-foreground sm:text-2xl">
            Nasıl oynamak istersin?
          </h2>
        </div>
      </div>

      {hasBot && (
        <div className="grid grid-cols-2 gap-1 border-y border-border bg-secondary/40 p-1" role="tablist" aria-label="Oyun modu">
          {(
            [
              ['bot', 'Bota karşı', Bot],
              ['kanka', 'Oyuncularla', Users],
            ] as const
          ).map(([k, label, Icon]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={active === k}
              onClick={() => onTab(k)}
              className={cn(
                'inline-flex h-10 items-center justify-center gap-2 rounded-lg text-sm font-bold transition-colors',
                active === k ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="size-4" aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-3 p-4 sm:p-5">
        {active === 'bot' ? (
          <>
            <p className="text-sm leading-relaxed text-muted-foreground">Beklemeden başla. Boş sandalyelere bot oturur, kazanırsan Kanka Coin senin.</p>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Bahis">
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
                      'rounded-lg px-3 py-1.5 text-sm font-bold tabular-nums transition-colors disabled:opacity-40',
                      stake === b ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground hover:bg-secondary/70',
                    )}
                  >
                    {`${fmt(b)} KC`}
                  </button>
                )
              })}
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={onBot}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Bot className="size-4" aria-hidden="true" />}
              {guest ? 'Üye ol ve oyna' : `Hemen başla · ${fmt(stake)} KC`}
            </button>
          </>
        ) : (
          <>
            <p className="text-sm leading-relaxed text-muted-foreground">Aşağıdaki açık masalardan birine otur ya da kurallarını seçip kendi masanı aç.</p>
            <button
              type="button"
              onClick={onWizard}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90"
            >
              <Plus className="size-4" aria-hidden="true" />
              Kendi masanı aç
            </button>
          </>
        )}
        {guest && <p className="text-center text-xs text-muted-foreground">Seçimlerini koruruz. Giriş yapınca kaldığın yerden devam edersin.</p>}
      </div>
    </section>
  )
}
