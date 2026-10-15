'use client'

import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { MessageCircle, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TableChat } from './table-chat'

type ChatPeek = { messages: { id: number; name: string; body: string }[] }

const fetcher = async (url: string) => {
  const r = await fetch(url, { cache: 'no-store' })
  if (!r.ok) throw new Error('Sohbet yüklenemedi')
  return (await r.json()) as ChatPeek
}

/** Mobile-only floating chat: a bubble above the bottom nav that opens a bottom sheet, so the table never has to scroll. */
export function MobileTableChat({ tableId }: { tableId: string }) {
  const [open, setOpen] = useState(false)
  const [seenId, setSeenId] = useState<number | null>(null)
  const { data } = useSWR(open ? null : `/api/tables/${tableId}/chat`, fetcher, { refreshInterval: 8000 })
  const messages = data?.messages ?? []
  const lastId = messages.at(-1)?.id ?? null

  useEffect(() => {
    if (seenId === null && lastId !== null) setSeenId(lastId)
  }, [lastId, seenId])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const unread = seenId === null ? 0 : messages.filter((m) => m.id > seenId).length
  const latest = unread > 0 ? messages.at(-1) : undefined

  const close = () => {
    setOpen(false)
    setSeenId(null)
  }

  return (
    <div className="lg:hidden">
      {!open && (
        <div className="fixed right-3 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-40 flex items-end gap-2">
          {latest && (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="animate-in fade-in slide-in-from-right-2 max-w-52 truncate rounded-2xl rounded-br-sm border border-primary/40 bg-card/95 px-3 py-2 text-left text-xs text-foreground shadow-lg backdrop-blur"
            >
              <span className="font-bold text-primary">{latest.name}: </span>
              {latest.body}
            </button>
          )}
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label={unread > 0 ? `Masa sohbetini aç, ${unread} yeni mesaj` : 'Masa sohbetini aç'}
            className="relative flex size-12 items-center justify-center rounded-full border border-primary/60 bg-card text-primary shadow-lg shadow-black/40 transition-transform active:scale-95"
          >
            <MessageCircle className="size-5" aria-hidden="true" />
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 flex min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-bold text-primary-foreground">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>
        </div>
      )}

      <div
        className={cn('fixed inset-0 z-50 transition-opacity', open ? 'opacity-100' : 'pointer-events-none opacity-0')}
        aria-hidden={!open}
      >
        <button type="button" tabIndex={-1} aria-label="Sohbeti kapat" onClick={close} className="absolute inset-0 bg-background/60 backdrop-blur-sm" />
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Masa sohbeti"
          className={cn(
            'absolute inset-x-0 bottom-0 flex h-[65dvh] flex-col rounded-t-3xl border-t border-primary/40 bg-card pb-[env(safe-area-inset-bottom)] shadow-2xl transition-transform duration-300',
            open ? 'translate-y-0' : 'translate-y-full',
          )}
        >
          <div className="flex items-center justify-between px-4 pt-2 pb-1">
            <span className="mx-auto h-1 w-10 rounded-full bg-border" aria-hidden="true" />
            <button
              type="button"
              onClick={close}
              aria-label="Sohbeti kapat"
              className="absolute top-2 right-3 flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
          {open && <TableChat tableId={tableId} className="mx-3 mb-3 flex-1 border-0" />}
        </div>
      </div>
    </div>
  )
}
