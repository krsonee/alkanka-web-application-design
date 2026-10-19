'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronLeft, ChevronRight, ChevronUp, Maximize2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePoints } from '@/components/alkanka/points-context'
import type { Channel } from '@/lib/kankatv'

type DockState = { channel: Channel | null; channels: Channel[]; watch: boolean }

type DockContext = DockState & {
  open: (channel: Channel, channels: Channel[], watch: boolean) => void
  select: (slug: string) => void
  close: () => void
}

const Ctx = createContext<DockContext | null>(null)

export function useTvDock() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useTvDock must be used inside TvDockProvider')
  return ctx
}

export function TvDockProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<DockState>({ channel: null, channels: [], watch: false })

  const open = useCallback((channel: Channel, channels: Channel[], watch: boolean) => {
    setState((s) =>
      s.channel?.slug === channel.slug && s.channels === channels && s.watch === watch ? s : { channel, channels, watch },
    )
  }, [])
  const select = useCallback((slug: string) => {
    setState((s) => {
      const next = s.channels.find((c) => c.slug === slug)
      return next ? { ...s, channel: next } : s
    })
  }, [])
  const close = useCallback(() => setState((s) => (s.channel ? { ...s, channel: null } : s)), [])

  const value = useMemo(() => ({ ...state, open, select, close }), [state, open, select, close])
  return (
    <Ctx.Provider value={value}>
      {children}
      <DockPlayer />
    </Ctx.Provider>
  )
}

const noopSubscribe = () => () => {}

function useEmbedSrc(embedUrl: string | null) {
  const host = useSyncExternalStore(noopSubscribe, () => window.location.hostname, () => null)
  if (!embedUrl || !embedUrl.startsWith('https://player.twitch.tv/')) return embedUrl
  return host ? `${embedUrl}&parent=${encodeURIComponent(host)}` : null
}

function useWatchTicker(active: boolean) {
  const { refresh } = usePoints()
  useEffect(() => {
    if (!active) return
    const id = setInterval(async () => {
      if (document.visibilityState !== 'visible') return
      try {
        const res = await fetch('/api/kankatv/engage', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'tick' }),
        })
        if (res.ok) refresh()
      } catch {}
    }, 60_000)
    return () => clearInterval(id)
  }, [active, refresh])
}

function DockPlayer() {
  const { channel, channels, watch, select, close } = useTvDock()
  const pathname = usePathname()
  const onTv = pathname.startsWith('/kankatv')
  const visible = Boolean(channel?.embedUrl) && !onTv
  const src = useEmbedSrc(visible ? (channel?.embedUrl ?? null) : null)
  const [listOpen, setListOpen] = useState(false)

  useWatchTicker(visible && watch)

  if (!visible || !channel || !src) return null

  const index = channels.findIndex((c) => c.slug === channel.slug)
  const step = (dir: 1 | -1) => {
    if (channels.length < 2) return
    const next = channels[(index + dir + channels.length) % channels.length]
    select(next.slug)
  }
  const canSwitch = channels.length > 1

  return (
    <aside
      aria-label="Mini oynatıcı"
      className="fixed bottom-24 right-3 z-40 flex w-64 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl sm:w-80 lg:bottom-6"
    >
      <div className="relative aspect-video w-full bg-foreground">
        <iframe
          key={src}
          src={src}
          title={`${channel.name} canlı yayın`}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          className="absolute inset-0 size-full"
        />
        <Link
          href="/kankatv"
          aria-label="KankaTV'de büyüt"
          className="absolute left-1.5 top-1.5 flex size-7 items-center justify-center rounded-full bg-background/90 text-foreground shadow"
        >
          <Maximize2 className="size-3.5" aria-hidden="true" />
        </Link>
        <button
          type="button"
          onClick={close}
          aria-label="Mini oynatıcıyı kapat"
          className="absolute right-1.5 top-1.5 flex size-7 items-center justify-center rounded-full bg-background/90 text-foreground shadow"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>

      {listOpen && canSwitch && (
        <ul className="flex max-h-44 flex-col overflow-y-auto border-t border-border" aria-label="Canlı kanallar">
          {channels.map((c) => (
            <li key={c.slug}>
              <button
                type="button"
                onClick={() => {
                  select(c.slug)
                  setListOpen(false)
                }}
                aria-pressed={c.slug === channel.slug}
                className={cn(
                  'flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs transition-colors',
                  c.slug === channel.slug ? 'bg-primary/10 font-bold text-primary' : 'text-foreground hover:bg-muted',
                )}
              >
                <ChannelAvatar channel={c} />
                <span className="min-w-0 flex-1 truncate">{c.name}</span>
                {c.viewers != null && (
                  <span className="shrink-0 tabular-nums text-muted-foreground">{c.viewers.toLocaleString('tr-TR')}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-1 border-t border-border px-1 py-1">
        <button
          type="button"
          onClick={() => step(-1)}
          disabled={!canSwitch}
          aria-label="Önceki kanal"
          className="flex size-8 shrink-0 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-muted disabled:opacity-40"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => setListOpen((o) => !o)}
          disabled={!canSwitch}
          aria-expanded={listOpen}
          aria-label="Kanal listesini aç"
          className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1.5 py-1 text-left transition-colors hover:bg-muted disabled:hover:bg-transparent"
        >
          <ChannelAvatar channel={channel} />
          <span className="flex min-w-0 flex-1 flex-col leading-tight">
            <span className="truncate text-xs font-bold text-foreground">{channel.name}</span>
            <span className="flex items-center gap-1 text-[10px] font-semibold uppercase text-live">
              <span className="size-1.5 rounded-full bg-live motion-safe:animate-pulse" aria-hidden="true" />
              Canlı{canSwitch ? ` · ${index + 1}/${channels.length}` : ''}
            </span>
          </span>
          {canSwitch && (
            <ChevronUp className={cn('size-4 shrink-0 text-muted-foreground transition-transform', !listOpen && 'rotate-180')} aria-hidden="true" />
          )}
        </button>
        <button
          type="button"
          onClick={() => step(1)}
          disabled={!canSwitch}
          aria-label="Sonraki kanal"
          className="flex size-8 shrink-0 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-muted disabled:opacity-40"
        >
          <ChevronRight className="size-4" aria-hidden="true" />
        </button>
      </div>
    </aside>
  )
}

function ChannelAvatar({ channel }: { channel: Channel }) {
  if (channel.avatar) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={channel.avatar} alt="" className="size-6 shrink-0 rounded-md object-cover" loading="lazy" />
  }
  return (
    <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-[9px] font-bold text-foreground">
      {channel.name.slice(0, 2).toUpperCase()}
    </span>
  )
}
