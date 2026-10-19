'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { Award, Banknote, Clock, ListChecks, Megaphone, X, type LucideIcon } from 'lucide-react'
import type { Feed, FeedItem, FeedKind } from '@/lib/online-rewards'
import { usePoints } from '@/components/alkanka/points-context'
import { RewardChips } from './reward-chips'
import { MemberAvatar } from '@/components/alkanka/member-avatar'
import { cn } from '@/lib/utils'

const fetcher = (url: string) => fetch(url).then((r) => r.json() as Promise<Feed>)

const KIND: Record<FeedKind, { icon: LucideIcon; verb: string; tone: string }> = {
  gorev: { icon: ListChecks, verb: 'görevi tamamladı', tone: 'bg-primary/15 text-primary' },
  rozet: { icon: Award, verb: 'rozetini kazandı', tone: 'bg-ruby/15 text-ruby' },
  online: { icon: Clock, verb: 'ödülünü aldı', tone: 'bg-live/15 text-live' },
  cekim: { icon: Banknote, verb: 'çekti', tone: 'bg-live/15 text-live' },
  duyuru: { icon: Megaphone, verb: '', tone: 'bg-primary text-primary-foreground' },
}

function Line({ item }: { item: FeedItem }) {
  if (item.kind === 'duyuru') return <span className="font-semibold text-foreground">{item.title}</span>
  return (
    <>
      <span className="font-bold text-foreground">{item.name}</span> <span className="text-foreground/90">{item.title}</span> {KIND[item.kind].verb}
    </>
  )
}

function ago(iso: string) {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (m < 1) return 'şimdi'
  if (m < 60) return `${m} dk`
  const h = Math.round(m / 60)
  return h < 24 ? `${h} sa` : `${Math.round(h / 24)} gün`
}

function FeedEntry({ item }: { item: FeedItem }) {
  const k = KIND[item.kind]
  const Icon = k.icon
  return (
    <span className="flex shrink-0 items-center gap-2 px-4">
      <span className={cn('flex size-6 items-center justify-center rounded-full', k.tone)}>
        <Icon className="size-3.5" aria-hidden="true" />
      </span>
      {item.userId && <MemberAvatar userId={item.userId} name={item.name} size="sm" />}
      <span className="whitespace-nowrap text-xs text-muted-foreground">
        <Line item={item} />
      </span>
      <RewardChips coin={item.coin} kp={item.kind === 'gorev' ? 0 : item.kp} size="xs" className="flex-nowrap" />
      <span className="text-[10px] text-muted-foreground/70">{ago(item.at)}</span>
    </span>
  )
}

/** Slim marquee of recent wins plus a short toast when a new one lands. */
export function WinnersTicker() {
  const { data } = useSWR('/api/kp/feed', fetcher, { refreshInterval: 30_000 })
  const { member } = usePoints()
  const items = data?.items ?? []
  const seen = useRef<Set<string> | null>(null)
  const [toast, setToast] = useState<FeedItem | null>(null)

  useEffect(() => {
    if (!data) return
    if (!seen.current) {
      seen.current = new Set(data.items.map((i) => i.id))
      return
    }
    const fresh = data.items.find((i) => !seen.current!.has(i.id))
    data.items.forEach((i) => seen.current!.add(i.id))
    if (fresh && data.toast && (fresh.kind === 'duyuru' || fresh.name !== member?.name?.split(' ')[0])) setToast(fresh)
  }, [data, member])

  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => setToast(null), 6000)
    return () => window.clearTimeout(id)
  }, [toast])

  if (!items.length) return null
  const loop = [...items, ...items]
  const duration = `${Math.max(30, items.length * 6)}s`

  return (
    <>
      <div className="mx-auto w-full max-w-screen-2xl px-4 pt-4 lg:px-6">
      <div className="group relative flex h-10 items-center overflow-hidden rounded-xl border border-border bg-surface">
        <Link href="/gorevler" className="relative z-10 flex h-full shrink-0 items-center gap-2 border-r border-border bg-surface px-3 text-[10px] font-bold uppercase tracking-widest text-primary sm:px-4">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-live opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-live" />
          </span>
          <span className="hidden sm:inline">Canlı kazananlar</span>
          <span className="sm:hidden">Canlı</span>
        </Link>
        <div className="relative min-w-0 flex-1 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_24px,black_calc(100%-24px),transparent)]">
          <div className="flex w-max animate-marquee group-hover:[animation-play-state:paused] motion-reduce:animate-none" style={{ animationDuration: duration }} aria-hidden="true">
            {loop.map((item, i) => (
              <FeedEntry key={`${item.id}-${i}`} item={item} />
            ))}
          </div>
          <ul className="sr-only">
            {items.slice(0, 10).map((item) => (
              <li key={item.id}>
                <Line item={item} />
              </li>
            ))}
          </ul>
        </div>
      </div>
      </div>

      {toast && (
        <div role="status" className="fixed left-4 top-28 z-40 flex max-w-[calc(100vw-2rem)] animate-slide-in items-center gap-3 rounded-full border border-border bg-card/95 py-1.5 pl-1.5 pr-2 shadow-xl backdrop-blur-md sm:max-w-sm lg:left-72">
          <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-full', KIND[toast.kind].tone)}>
            {(() => {
              const Icon = KIND[toast.kind].icon
              return <Icon className="size-4" aria-hidden="true" />
            })()}
          </span>
          <span className="min-w-0 truncate text-xs text-muted-foreground">
            <Line item={toast} />
          </span>
          <RewardChips coin={toast.coin} kp={toast.kind === 'gorev' ? 0 : toast.kp} size="xs" className="shrink-0 flex-nowrap" />
          <button onClick={() => setToast(null)} aria-label="Bildirimi kapat" className="shrink-0 rounded-full p-1 text-muted-foreground hover:text-foreground">
            <X className="size-3.5" />
          </button>
        </div>
      )}
    </>
  )
}
