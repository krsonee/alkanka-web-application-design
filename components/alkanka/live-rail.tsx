'use client'

import { useEffect, useRef, useState, useTransition, type FormEvent, type KeyboardEvent } from 'react'
import { Globe, Link2, Loader2, Pin, Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import { sendChatMessage, startTelegramLink } from '@/app/actions/chat'
import { TELEGRAM_URL } from './data'
import { useChatFeed, type ChatResponse } from './use-chat-feed'

const timeFormat = new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit' })

function Composer({ data, onSent }: { data: ChatResponse; onSent: () => void }) {
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const inviteUrl = data.inviteUrl ?? TELEGRAM_URL

  if (!data.me.loggedIn) {
    return (
      <a
        href="#giris"
        className="flex h-10 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
      >
        Sohbete yazmak için giriş yap
      </a>
    )
  }

  if (!data.me.link) {
    return (
      <div className="flex flex-col gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setError(null)
              const res = await startTelegramLink()
              if (res.ok && res.url) window.open(res.url, '_blank', 'noopener,noreferrer')
              else setError(res.message ?? 'Bağlantı başlatılamadı.')
            })
          }
          className="flex h-10 items-center justify-center gap-2 rounded-lg bg-accent text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Link2 className="size-4" aria-hidden="true" />}
          {"Telegram'ı bağla, siteden yaz"}
        </button>
        <p className="text-xs leading-relaxed text-muted-foreground text-pretty">
          {"Açılan Telegram sohbetinde Başlat'a bas, hesabın bağlanır. Yazmak için "}
          <a href={inviteUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-accent underline-offset-2 hover:underline">
            gruba katılmış
          </a>
          {' olman gerekir.'}
        </p>
        {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      </div>
    )
  }

  function submit(e?: FormEvent) {
    e?.preventDefault()
    const message = text.trim()
    if (!message || pending) return
    startTransition(async () => {
      setError(null)
      const res = await sendChatMessage(message)
      if (res.ok) {
        setText('')
        onSent()
      } else setError(res.message ?? 'Mesaj gönderilemedi.')
    })
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing || e.keyCode === 229) return
    e.preventDefault()
    submit()
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-1.5">
      <div className="flex items-end gap-2">
        <label htmlFor="live-chat-input" className="sr-only">
          Mesajın
        </label>
        <textarea
          id="live-chat-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          maxLength={500}
          rows={1}
          placeholder={`${data.me.link.tgName} olarak yaz…`}
          className="max-h-24 min-h-10 flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2.5 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
        />
        <button
          type="submit"
          disabled={pending || !text.trim()}
          aria-label="Gönder"
          className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Send className="size-4" aria-hidden="true" />}
        </button>
      </div>
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    </form>
  )
}

export function LiveRail() {
  const { data, mutate } = useChatFeed()
  const listRef = useRef<HTMLOListElement>(null)
  const lastId = data?.messages.at(-1)?.id

  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [lastId])

  const inviteUrl = data?.inviteUrl ?? TELEGRAM_URL

  return (
    <aside aria-label="Telegram canlı sohbet" className="fixed inset-y-0 right-0 z-30 hidden w-80 flex-col border-l border-border bg-surface xl:flex">
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-border px-4">
        <span className="flex size-8 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <Send className="size-4" aria-hidden="true" />
        </span>
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="truncate text-sm font-semibold text-foreground">{data?.title ?? 'Telegram Canlı'}</span>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className={cn('size-1.5 rounded-full', data?.configured ? 'animate-glow bg-live' : 'bg-muted-foreground')} aria-hidden="true" />
            {data?.configured
              ? data.members != null
                ? `${data.members.toLocaleString('tr-TR')} üye`
                : 'Canlı'
              : 'Yakında'}
          </span>
        </span>
      </div>

      {data?.pinned && (
        <div className="flex items-start gap-2 border-b border-border bg-primary/5 px-4 py-2.5 text-xs">
          <Pin className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden="true" />
          <p className="line-clamp-3 leading-relaxed text-foreground">
            <span className="font-semibold text-primary">Sabit: </span>
            {data.pinned}
          </p>
        </div>
      )}

      <ol ref={listRef} aria-live="polite" className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4 no-scrollbar">
        {!data ? (
          <li className="flex flex-1 items-center justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" aria-label="Yükleniyor" />
          </li>
        ) : !data.configured || data.messages.length === 0 ? (
          <li className="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center">
            <p className="text-sm font-semibold text-foreground">{data.configured ? 'Henüz mesaj yok' : 'Sohbet yakında burada'}</p>
            <p className="text-xs leading-relaxed text-muted-foreground text-pretty">
              {data.configured
                ? 'Telegram grubuna yazılan mesajlar burada anında görünecek.'
                : 'Telegram sohbet grubumuz bağlandığında konuşmalar burada canlı akacak.'}
            </p>
          </li>
        ) : (
          data.messages.map((m) => (
            <li key={m.id} className="animate-slide-in flex flex-col gap-0.5 text-sm leading-relaxed">
              <span className="flex items-center gap-1.5 text-xs">
                <span className={cn('font-semibold', m.origin === 'site' ? 'text-primary' : 'text-accent')}>{m.author}</span>
                {m.origin === 'site' && (
                  <span className="inline-flex items-center gap-0.5 rounded bg-primary/10 px-1 text-[10px] font-semibold text-primary">
                    <Globe className="size-2.5" aria-hidden="true" />
                    site
                  </span>
                )}
                <time dateTime={m.createdAt} className="ml-auto text-[10px] text-muted-foreground tabular-nums">
                  {timeFormat.format(new Date(m.createdAt))}
                </time>
              </span>
              <span className="break-words text-foreground">{m.text}</span>
            </li>
          ))
        )}
      </ol>

      <div className="flex flex-col gap-2 border-t border-border p-3">
        {data?.configured ? (
          <>
            <Composer data={data} onSent={() => mutate()} />
            <a
              href={inviteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-center text-xs font-semibold text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              {"Telegram'da aç"}
            </a>
          </>
        ) : (
          <a
            href={inviteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-10 items-center justify-center gap-2 rounded-lg bg-accent text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90"
          >
            <Send className="size-4" aria-hidden="true" />
            {"Telegram'da sohbete katıl"}
          </a>
        )}
      </div>
    </aside>
  )
}
