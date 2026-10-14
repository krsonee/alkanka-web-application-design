'use client'

import { useEffect, useRef, useState } from 'react'
import useSWR from 'swr'
import { Loader2, MessageCircle, Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePoints } from '../points-context'

type ChatMessage = { id: number; userId: string; name: string; player: boolean; body: string; at: string }

const fetcher = async (url: string) => {
  const r = await fetch(url, { cache: 'no-store' })
  if (!r.ok) throw new Error('Sohbet yüklenemedi')
  return (await r.json()) as { messages: ChatMessage[] }
}

/** Shared chat for everyone at a table: seated players and spectators. */
export function TableChat({ tableId, className }: { tableId: string; className?: string }) {
  const { member, requireLogin } = usePoints()
  const { data, mutate } = useSWR(`/api/tables/${tableId}/chat`, fetcher, { refreshInterval: 2500 })
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const listRef = useRef<HTMLOListElement>(null)
  const messages = data?.messages ?? []
  const lastId = messages.at(-1)?.id

  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [lastId])

  const submit = async () => {
    const body = text.trim()
    if (!body || sending) return
    if (!requireLogin()) return
    setSending(true)
    setError(null)
    const r = await fetch(`/api/tables/${tableId}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body }),
    })
    setSending(false)
    if (!r.ok) {
      setError((await r.json().catch(() => ({}))).error ?? 'Gönderilemedi.')
      return
    }
    setText('')
    mutate()
  }

  return (
    <section aria-label="Masa sohbeti" className={cn('flex min-h-0 flex-col rounded-xl border border-border bg-background', className)}>
      <header className="flex items-center gap-2 border-b border-border px-3 py-2">
        <MessageCircle className="size-4 text-primary" aria-hidden="true" />
        <h4 className="text-sm font-bold text-foreground">Masa sohbeti</h4>
        <span className="ml-auto text-xs text-muted-foreground">Oyuncular ve izleyiciler</span>
      </header>
      <ol ref={listRef} aria-live="polite" className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-3 py-2 text-sm">
        {!data && (
          <li className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> Yükleniyor
          </li>
        )}
        {data && messages.length === 0 && <li className="text-muted-foreground">Henüz mesaj yok. İlk selamı sen ver.</li>}
        {messages.map((m) => (
          <li key={m.id} className="leading-relaxed text-pretty">
            <span className={cn('font-bold', m.userId === member?.id ? 'text-primary' : 'text-foreground')}>{m.name}</span>
            {!m.player && <span className="ml-1 rounded bg-secondary px-1 text-[10px] font-semibold uppercase text-muted-foreground">izleyici</span>}
            <span className="text-muted-foreground">: </span>
            <span className="break-words text-foreground">{m.body}</span>
          </li>
        ))}
      </ol>
      <form
        className="flex items-center gap-2 border-t border-border p-2"
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <label htmlFor={`chat-${tableId}`} className="sr-only">
          Mesaj yaz
        </label>
        <input
          id={`chat-${tableId}`}
          value={text}
          maxLength={200}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.nativeEvent.isComposing || e.keyCode === 229)) e.preventDefault()
          }}
          placeholder={member ? 'Masaya yaz...' : 'Yazmak için giriş yap'}
          className="min-w-0 flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-primary"
        />
        <button
          type="submit"
          disabled={sending || !text.trim()}
          aria-label="Gönder"
          className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground disabled:opacity-50"
        >
          {sending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Send className="size-4" aria-hidden="true" />}
        </button>
      </form>
      {error && (
        <p role="alert" className="px-3 pb-2 text-xs text-destructive">
          {error}
        </p>
      )}
    </section>
  )
}
