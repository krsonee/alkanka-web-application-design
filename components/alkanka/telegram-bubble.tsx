'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Send } from 'lucide-react'
import { OPEN_CHAT_EVENT } from './live-rail'
import { useChatFeed } from './use-chat-feed'

/** Mobile-only floating Telegram button above the bottom nav; peeks new messages and opens the Telegram sheet. */
export function TelegramBubble() {
  const pathname = usePathname()
  const onGameTable = pathname.startsWith('/oyunlar/')
  const { data } = useChatFeed(!onGameTable, { slow: true })
  const messages = data?.messages ?? []
  const lastId = messages.at(-1)?.id ?? null
  const [seenId, setSeenId] = useState<number | null>(null)
  const [peekId, setPeekId] = useState<number | null>(null)

  useEffect(() => {
    if (lastId === null) return
    if (seenId === null) {
      setSeenId(lastId)
      return
    }
    if (lastId > seenId) {
      setPeekId(lastId)
      const t = setTimeout(() => setPeekId(null), 6000)
      return () => clearTimeout(t)
    }
  }, [lastId, seenId])

  const unread = seenId === null ? 0 : messages.filter((m) => m.id > seenId).length
  const peek = peekId !== null ? messages.find((m) => m.id === peekId) : undefined

  const open = () => {
    setSeenId(lastId)
    setPeekId(null)
    window.dispatchEvent(new Event(OPEN_CHAT_EVENT))
  }

  if (onGameTable) return null

  return (
    <div className="fixed right-3 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-40 flex items-end gap-2 lg:hidden">
      {peek && (
        <button
          type="button"
          onClick={open}
          className="animate-in fade-in slide-in-from-right-2 max-w-56 truncate rounded-2xl rounded-br-sm border border-accent/40 bg-card/95 px-3 py-2 text-left text-xs text-foreground shadow-lg backdrop-blur"
        >
          <span className="font-bold text-accent">{peek.author}: </span>
          {peek.text}
        </button>
      )}
      <button
        type="button"
        onClick={open}
        aria-label={unread > 0 ? `Telegram sohbetini aç, ${unread} yeni mesaj` : 'Telegram sohbetini aç'}
        className="relative flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-lg shadow-black/40 transition-transform active:scale-95"
      >
        <Send className="size-5 -translate-x-px translate-y-px" aria-hidden="true" />
        {data?.configured && (
          <span className="absolute top-0.5 right-0.5 size-2.5 rounded-full bg-live ring-2 ring-accent" aria-hidden="true" />
        )}
        {unread > 0 && (
          <span className="absolute -top-1 -left-1 flex min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-bold leading-5 text-primary-foreground">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
    </div>
  )
}
