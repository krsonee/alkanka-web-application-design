'use client'

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { usePathname } from 'next/navigation'
import { MessageCircle } from 'lucide-react'
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

/** Phone and tablet chat button in the top bar; opens the site chat sheet. */
export function ChatButton() {
  const { onGameTable, unread, open } = useChatSignal()
  if (onGameTable) return null
  return (
    <button
      type="button"
      onClick={open}
      aria-label={unread > 0 ? `Sohbeti aç, ${unread} yeni mesaj` : 'Sohbeti aç'}
      className="relative flex size-10 shrink-0 items-center justify-center rounded-full bg-foreground/[0.08] text-foreground transition-[scale] duration-150 active:scale-95 lg:hidden"
    >
      <MessageCircle className="size-5" aria-hidden="true" />
      {unread > 0 && (
        <span
          aria-hidden="true"
          className="absolute -right-0.5 -top-0.5 flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-destructive px-1 text-[11px] font-bold leading-none text-destructive-foreground ring-2 ring-background"
        >
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </button>
  )
}

/** Phone and tablet preview of a new chat message, floating above the bottom menu; tapping it opens the chat. */
export function TelegramBubble() {
  const { onGameTable, messages, lastId, seen, open } = useChatSignal()
  const [peekId, setPeekId] = useState<number | null>(null)

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
  if (onGameTable || !peek) return null

  return (
    <div className="fixed right-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom)+var(--app-banner-h,0px)+var(--guest-gate-h,0px))] z-40 flex lg:hidden">
      <button
        type="button"
        onClick={open}
        className="animate-in fade-in slide-in-from-right-2 max-w-64 truncate rounded-2xl rounded-br-sm border border-accent/40 bg-card/95 px-3 py-2.5 text-left text-sm text-foreground shadow-lg backdrop-blur"
      >
        <span className="font-bold text-accent">{peek.author}: </span>
        {peek.text}
      </button>
    </div>
  )
}
