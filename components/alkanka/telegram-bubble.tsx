'use client'

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { usePathname } from 'next/navigation'
import { MessageCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { OPEN_CHAT_EVENT } from './live-rail'
import { useChatFeed } from './use-chat-feed'

/** Last message the visitor has seen, shared by the header button and the preview so opening one clears the other. */
let seenId: number | null = null
const watchers = new Set<() => void>()
const watch = (cb: () => void) => {
  watchers.add(cb)
  return () => {
    watchers.delete(cb)
  }
}
function markSeen(id: number | null) {
  if (id === seenId) return
  seenId = id
  watchers.forEach((cb) => cb())
}

function useChatSignal() {
  const pathname = usePathname()
  const onGameTable = pathname.startsWith('/oyunlar/')
  const { data } = useChatFeed(!onGameTable, { slow: true })
  const messages = data?.messages ?? []
  const lastId = messages.at(-1)?.id ?? null
  const seen = useSyncExternalStore(
    watch,
    () => seenId,
    () => null,
  )

  useEffect(() => {
    if (lastId !== null && seenId === null) markSeen(lastId)
  }, [lastId])

  const open = useCallback(() => {
    markSeen(lastId)
    window.dispatchEvent(new Event(OPEN_CHAT_EVENT))
  }, [lastId])

  const unread = seen === null ? 0 : messages.filter((m) => m.id > seen).length
  return { onGameTable, messages, lastId, seen, unread, open }
}

/** True while the page moves and for a moment after it stops. */
function useScrolling(restMs = 650) {
  const [scrolling, setScrolling] = useState(false)
  useEffect(() => {
    let rest: ReturnType<typeof setTimeout> | undefined
    const onScroll = () => {
      setScrolling(true)
      clearTimeout(rest)
      rest = setTimeout(() => setScrolling(false), restMs)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      clearTimeout(rest)
    }
  }, [restMs])
  return scrolling
}

/** Phone and tablet chat: a floating button above the bottom menu, with a short preview of each new message beside it. */
export function TelegramBubble() {
  const { onGameTable, messages, lastId, seen, unread, open } = useChatSignal()
  const [peekId, setPeekId] = useState<number | null>(null)
  const scrolling = useScrolling()

  useEffect(() => {
    if (lastId === null || seen === null || lastId <= seen) {
      setPeekId(null)
      return
    }
    setPeekId(lastId)
    const t = setTimeout(() => setPeekId(null), 6000)
    return () => clearTimeout(t)
  }, [lastId, seen])

  const peek = peekId !== null ? messages.find((m) => m.id === peekId) : undefined
  if (onGameTable) return null

  return (
    <div className="pointer-events-none fixed right-3 bottom-[calc(6.5rem+var(--safe-bottom)+var(--app-banner-h,0px)+var(--guest-gate-h,0px))] z-40 flex items-center gap-2 lg:hidden">
      {peek && (
        <button
          type="button"
          onClick={open}
          tabIndex={-1}
          aria-hidden="true"
          className="pointer-events-auto animate-in fade-in slide-in-from-right-2 max-w-[min(15rem,calc(100vw-5.5rem))] truncate rounded-2xl rounded-br-sm border border-accent/40 bg-card/95 px-3 py-2 text-left text-sm text-foreground shadow-lg backdrop-blur"
        >
          <span className="font-bold text-accent">{peek.author}: </span>
          {peek.text}
        </button>
      )}
      <button
        type="button"
        onClick={open}
        aria-label={unread > 0 ? `Sohbeti aç, ${unread} yeni mesaj` : 'Sohbeti aç'}
        // While the page is being read the button steps half off the edge, so it stops covering the right end of
        // rows and buttons; it comes back as soon as the page rests. A new message keeps it fully in view.
        className={cn(
          'pointer-events-auto relative flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-[0_10px_28px_-8px_var(--accent)] ring-2 ring-background transition-[scale,translate,opacity] duration-200 active:scale-95 motion-reduce:transition-none',
          scrolling && !peek && unread === 0 && 'translate-x-[62%] opacity-70',
        )}
      >
        {unread > 0 && <span aria-hidden="true" className="absolute inset-0 animate-ping rounded-full bg-accent/50 [animation-duration:2.4s] motion-reduce:hidden" />}
        <MessageCircle className="relative size-[1.375rem]" strokeWidth={2.25} aria-hidden="true" />
        {unread > 0 && (
          <span
            aria-hidden="true"
            className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[11px] font-bold leading-none text-destructive-foreground ring-2 ring-background"
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
    </div>
  )
}
