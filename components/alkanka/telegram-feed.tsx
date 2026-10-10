'use client'

import { useState } from 'react'
import { Bell, Check, ChartBar, Copy, ExternalLink, Eye, Gift, Pin, Send, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SectionHeading } from './section-heading'
import { TELEGRAM_URL } from './data'

const POLL_OPTIONS = [
  { id: 'wheel', label: 'Double Wheel Weekend', votes: 1842 },
  { id: 'vip', label: 'VIP Chest Marathon', votes: 1310 },
  { id: 'dice', label: 'Dice Tournament', votes: 968 },
]

function ChannelAvatar() {
  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary font-display text-sm font-bold text-primary-foreground">
      A
    </span>
  )
}

function PostMeta({ views, time }: { views: string; time: string }) {
  return (
    <div className="flex items-center justify-end gap-3 text-xs text-muted-foreground">
      <span className="flex items-center gap-1">
        <Eye className="size-3.5" aria-hidden="true" />
        {views}
      </span>
      <time>{time}</time>
    </div>
  )
}

function PromoCode() {
  const [copied, setCopied] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText('ALKANKA250')
    } catch {}
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }
  return (
    <button
      type="button"
      onClick={copy}
      className="flex w-full items-center justify-between rounded-xl border border-dashed border-gold/50 bg-gold/5 px-4 py-3 text-left transition-colors hover:bg-gold/10"
    >
      <span className="flex flex-col">
        <span className="text-xs text-muted-foreground">Exclusive member code</span>
        <span className="font-display text-lg font-bold tracking-widest text-gold">ALKANKA250</span>
      </span>
      <span className="flex items-center gap-1.5 text-xs font-medium text-foreground">
        {copied ? <Check className="size-4 text-live" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
        {copied ? 'Copied' : 'Copy'}
      </span>
    </button>
  )
}

function Poll() {
  const [voted, setVoted] = useState<string | null>(null)
  const options = POLL_OPTIONS.map((o) => ({ ...o, votes: o.votes + (voted === o.id ? 1 : 0) }))
  const total = options.reduce((s, o) => s + o.votes, 0)

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
        <ChartBar className="size-4 text-accent" aria-hidden="true" />
        Which event should we launch next?
      </legend>
      {options.map((o) => {
        const pct = Math.round((o.votes / total) * 100)
        const mine = voted === o.id
        return (
          <button
            key={o.id}
            type="button"
            disabled={voted !== null}
            onClick={() => setVoted(o.id)}
            aria-pressed={mine}
            className={cn(
              'relative overflow-hidden rounded-xl border px-4 py-2.5 text-left text-sm transition-colors',
              mine ? 'border-accent/60' : 'border-border',
              voted === null && 'hover:border-accent/40',
            )}
          >
            {voted && (
              <span
                aria-hidden="true"
                className={cn('absolute inset-y-0 left-0 transition-all duration-700', mine ? 'bg-accent/25' : 'bg-secondary')}
                style={{ width: `${pct}%` }}
              />
            )}
            <span className="relative flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-foreground">
                {mine && <Check className="size-4 text-accent" aria-hidden="true" />}
                {o.label}
              </span>
              {voted && <span className="font-semibold text-foreground tabular-nums">{pct}%</span>}
            </span>
          </button>
        )
      })}
      <p className="text-xs text-muted-foreground">
        {total.toLocaleString('en-US')} votes · {voted ? 'Thanks for voting!' : 'Anonymous poll'}
      </p>
    </fieldset>
  )
}

export function TelegramFeed() {
  return (
    <section id="telegram" aria-labelledby="telegram-title" className="scroll-mt-20">
      <div className="mx-auto flex max-w-7xl flex-col gap-10 px-4 py-20 sm:px-6">
        <SectionHeading
          id="telegram-title"
          eyebrow="Telegram Community"
          title="The fastest drops happen in our channel"
          description="Promo codes, pinned partner links and community polls land in @AlkankaOfficial first — usually hours before anywhere else."
        />

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="glass flex flex-col overflow-hidden rounded-3xl">
            <div className="flex items-center gap-3 border-b border-border px-5 py-4">
              <ChannelAvatar />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="font-semibold text-foreground">Alkanka Official</span>
                <span className="text-xs text-muted-foreground">14,218 subscribers</span>
              </div>
              <Bell className="size-5 text-muted-foreground" aria-hidden="true" />
            </div>

            <div className="flex items-center gap-3 border-b border-border bg-primary/5 px-5 py-2.5">
              <Pin className="size-4 shrink-0 text-primary" aria-hidden="true" />
              <p className="truncate text-sm text-foreground">
                <span className="font-semibold text-primary">Pinned: </span>
                Read the community rules & claim your welcome chest
              </p>
            </div>

            <div className="flex flex-col gap-4 p-5">
              <article className="flex flex-col gap-3 rounded-2xl rounded-tl-sm bg-secondary/70 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Gift className="size-4 text-gold" aria-hidden="true" />
                  Weekend reward drop is LIVE
                </p>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  First 500 members get a guaranteed 250-point bonus. Paste the code on any partner campaign before
                  Sunday 23:59.
                </p>
                <PromoCode />
                <PostMeta views="9.8K" time="14:02" />
              </article>

              <article className="flex flex-col gap-3 rounded-2xl rounded-tl-sm bg-secondary/70 p-4">
                <p className="text-sm leading-relaxed text-foreground">
                  New exclusive partner link: <span className="font-semibold text-primary">Apex Club VIP Accelerator</span>{' '}
                  now runs at 5x for channel members only.
                </p>
                <a
                  href="#campaigns"
                  className="flex items-center justify-between rounded-xl border border-border bg-background/40 px-4 py-3 text-sm transition-colors hover:border-primary/40"
                >
                  <span className="flex flex-col">
                    <span className="font-medium text-foreground">alkanka.com/apex-vip</span>
                    <span className="text-xs text-muted-foreground">VIP Reward · 5x multiplier</span>
                  </span>
                  <ExternalLink className="size-4 text-primary" aria-hidden="true" />
                </a>
                <PostMeta views="7.1K" time="11:48" />
              </article>

              <article className="flex flex-col gap-3 rounded-2xl rounded-tl-sm bg-secondary/70 p-4">
                <Poll />
                <PostMeta views="12.4K" time="09:15" />
              </article>
            </div>
          </div>

          <aside className="flex flex-col gap-6">
            <div className="glass relative flex flex-col gap-5 overflow-hidden rounded-3xl p-6 glow-cyan">
              <div aria-hidden="true" className="absolute -top-24 -right-16 size-56 rounded-full bg-primary/20 blur-3xl" />
              <span className="relative flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                <Send className="size-7" aria-hidden="true" />
              </span>
              <div className="relative flex flex-col gap-1.5">
                <h3 className="font-display text-xl font-bold text-foreground">@AlkankaOfficial</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Join 14K+ members getting daily codes, early campaign access and live game events.
                </p>
              </div>
              <dl className="relative grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-background/50 p-3">
                  <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Users className="size-3.5" aria-hidden="true" />
                    Members
                  </dt>
                  <dd className="font-display text-lg font-bold text-foreground">14.2K</dd>
                </div>
                <div className="rounded-xl bg-background/50 p-3">
                  <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="size-1.5 rounded-full bg-live" />
                    Online now
                  </dt>
                  <dd className="font-display text-lg font-bold text-foreground">2,384</dd>
                </div>
              </dl>
              <a
                href={TELEGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="relative flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-transform hover:scale-[1.02]"
              >
                Open Telegram Channel
                <ExternalLink className="size-4" aria-hidden="true" />
              </a>
            </div>

            <div className="glass flex flex-col gap-3 rounded-3xl p-6">
              <h3 className="text-sm font-semibold text-foreground">Community channels</h3>
              {[
                { name: 'Alkanka Chat', desc: 'Community discussion', count: '8.9K' },
                { name: 'Alkanka Drops', desc: 'Instant code alerts', count: '11.6K' },
                { name: 'Alkanka VIP', desc: 'Members-only rewards', count: '2.1K' },
              ].map((c) => (
                <a
                  key={c.name}
                  href={TELEGRAM_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between rounded-xl px-3 py-2.5 transition-colors hover:bg-secondary"
                >
                  <span className="flex flex-col">
                    <span className="text-sm font-medium text-foreground">{c.name}</span>
                    <span className="text-xs text-muted-foreground">{c.desc}</span>
                  </span>
                  <span className="text-xs font-medium text-primary tabular-nums">{c.count}</span>
                </a>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </section>
  )
}
