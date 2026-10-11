'use client'

import { useEffect, useRef, useState, useTransition, type FormEvent, type KeyboardEvent } from 'react'
import { ExternalLink, Globe, Link2, Loader2, Megaphone, MessagesSquare, Percent, Pin, RefreshCw, Send, Ticket, UserPlus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { sendChatMessage, startTelegramLink } from '@/app/actions/chat'
import { BROADCAST_CHANNELS, type BroadcastSlug, type ChannelFeed, type ChatTab } from '@/lib/telegram-channels-shared'
import { TELEGRAM_URL } from './data'
import { useChannelFeed, useChatFeed, type ChatResponse } from './use-chat-feed'
import { MemberRank } from './kp/member-rank'

const timeFormat = new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit' })
const dateTimeFormat = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

const TABS: { id: ChatTab; label: string; icon: typeof Send }[] = [
  { id: 'sohbet', label: 'Sohbet', icon: MessagesSquare },
  { id: 'duyuru', label: BROADCAST_CHANNELS[0].label, icon: Megaphone },
  { id: 'ozel-oran', label: BROADCAST_CHANNELS[1].label, icon: Percent },
  { id: 'promo', label: BROADCAST_CHANNELS[2].label, icon: Ticket },
]

const primaryCta =
  'flex h-10 items-center justify-center gap-2 rounded-lg bg-accent text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-60'

function Composer({ data, onSent, onRecheck }: { data: ChatResponse; onSent: () => void; onRecheck: () => void }) {
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const inviteUrl = data.inviteUrl ?? TELEGRAM_URL

  if (!data.me.loggedIn) {
    return (
      <a href="#giris" className="flex h-10 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90">
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
          className={primaryCta}
        >
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Link2 className="size-4" aria-hidden="true" />}
          {"Telegram'ı bağla, siteden yaz"}
        </button>
        <p className="text-xs leading-relaxed text-muted-foreground text-pretty">
          {"Açılan Telegram sohbetinde Başlat'a bas, hesabın bağlanır. Sonra sohbet grubuna katılman yeterli."}
        </p>
        {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      </div>
    )
  }

  if (!data.me.joined) {
    return (
      <div className="flex flex-col gap-2">
        <a href={inviteUrl} target="_blank" rel="noopener noreferrer" className={primaryCta}>
          <UserPlus className="size-4" aria-hidden="true" />
          Sohbete katıl
        </a>
        <button
          type="button"
          onClick={onRecheck}
          className="flex items-center justify-center gap-1.5 text-xs font-semibold text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          <RefreshCw className="size-3" aria-hidden="true" />
          Katıldım, kontrol et
        </button>
        <p className="text-xs leading-relaxed text-muted-foreground text-pretty">
          Siteden yazabilmek için Telegram sohbet grubumuza katılmış olman gerekiyor.
        </p>
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
      } else {
        setError(res.message ?? 'Mesaj gönderilemedi.')
        onRecheck()
      }
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

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <li className="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="text-xs leading-relaxed text-muted-foreground text-pretty">{body}</p>
    </li>
  )
}

function Loading() {
  return (
    <li className="flex flex-1 items-center justify-center">
      <Loader2 className="size-5 animate-spin text-muted-foreground" aria-label="Yükleniyor" />
    </li>
  )
}

function useStickToBottom(dep: unknown) {
  const ref = useRef<HTMLOListElement>(null)
  useEffect(() => {
    const el = ref.current
    if (el) el.scrollTop = el.scrollHeight
  }, [dep])
  return ref
}

function ChatPanel({ data, onRefresh }: { data: ChatResponse | undefined; onRefresh: () => void }) {
  const listRef = useStickToBottom(data?.messages.at(-1)?.id)
  const inviteUrl = data?.inviteUrl ?? TELEGRAM_URL

  return (
    <>
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
          <Loading />
        ) : !data.configured || data.messages.length === 0 ? (
          <EmptyState
            title={data.configured ? 'Henüz mesaj yok' : 'Sohbet yakında burada'}
            body={
              data.configured
                ? 'Telegram grubuna yazılan mesajlar burada anında görünecek.'
                : 'Telegram sohbet grubumuz bağlandığında konuşmalar burada canlı akacak.'
            }
          />
        ) : (
          data.messages.map((m) => (
            <li key={m.id} className="animate-slide-in flex flex-col gap-0.5 text-sm leading-relaxed">
              <span className="flex items-center gap-1.5 text-xs">
                <span className={cn('font-semibold', m.origin === 'site' ? 'text-primary' : 'text-accent')}>{m.author}</span>
                <MemberRank userId={m.userId} />
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
            <Composer data={data} onSent={onRefresh} onRecheck={onRefresh} />
            {data.me.joined && (
              <a
                href={inviteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-center text-xs font-semibold text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                {"Telegram'da aç"}
              </a>
            )}
          </>
        ) : (
          <a href={inviteUrl} target="_blank" rel="noopener noreferrer" className={primaryCta}>
            <UserPlus className="size-4" aria-hidden="true" />
            Sohbete katıl
          </a>
        )}
      </div>
    </>
  )
}

function ChannelPanel({ slug, data }: { slug: BroadcastSlug; data: ChannelFeed | undefined }) {
  const listRef = useStickToBottom(`${slug}:${data?.posts.at(-1)?.id}`)
  const label = BROADCAST_CHANNELS.find((c) => c.slug === slug)!.title

  return (
    <>
      <ol ref={listRef} aria-live="polite" className="flex flex-1 flex-col gap-3 overflow-y-auto px-3 py-4 no-scrollbar">
        {!data ? (
          <Loading />
        ) : !data.configured ? (
          <EmptyState title={`${label} yakında burada`} body="Kanalımız bağlandığında paylaşımlar burada görünecek." />
        ) : data.posts.length === 0 ? (
          <EmptyState title="Henüz paylaşım yok" body="Kanala atılan yeni paylaşımlar burada görünecek." />
        ) : (
          data.posts.map((p) => (
            <li key={p.id} className="animate-slide-in flex flex-col gap-2 rounded-xl border border-border bg-card p-3 text-sm leading-relaxed">
              {p.photo && (
                // eslint-disable-next-line @next/next/no-img-element -- Telegram CDN images are short-lived, so they skip next/image optimization.
                <img src={p.photo} alt="" loading="lazy" className="max-h-44 w-full rounded-lg object-cover" />
              )}
              {p.text && <p className="whitespace-pre-line break-words text-foreground">{p.text}</p>}
              <span className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                {p.createdAt ? (
                  <time dateTime={p.createdAt} className="tabular-nums">
                    {dateTimeFormat.format(new Date(p.createdAt))}
                  </time>
                ) : (
                  <span />
                )}
                <a href={p.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold hover:text-foreground">
                  {"Telegram'da gör"}
                  <ExternalLink className="size-2.5" aria-hidden="true" />
                </a>
              </span>
            </li>
          ))
        )}
      </ol>

      <div className="border-t border-border p-3">
        {data?.inviteUrl ? (
          <a href={data.inviteUrl} target="_blank" rel="noopener noreferrer" className={primaryCta}>
            <UserPlus className="size-4" aria-hidden="true" />
            Kanala katıl
          </a>
        ) : (
          <p className="text-center text-xs text-muted-foreground">Bu kanal sadece okunur, bildirimler için Telegram’dan takip et.</p>
        )}
      </div>
    </>
  )
}

export function LiveRail() {
  const [tab, setTab] = useState<ChatTab>('sohbet')
  const chat = useChatFeed(tab === 'sohbet')
  const channel = useChannelFeed(tab === 'sohbet' ? null : tab)

  const subtitle =
    tab === 'sohbet'
      ? chat.data?.configured
        ? chat.data.members != null
          ? `${chat.data.members.toLocaleString('tr-TR')} üye`
          : 'Canlı'
        : 'Yakında'
      : channel.data?.configured
        ? `@${channel.data.username}`
        : 'Yakında'
  const isLive = tab === 'sohbet' ? chat.data?.configured : channel.data?.configured

  return (
    <aside aria-label="Telegram canlı sohbet" className="fixed inset-y-0 right-0 z-30 hidden w-80 flex-col border-l border-border bg-surface xl:flex">
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-border px-4">
        <span className="flex size-8 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <Send className="size-4" aria-hidden="true" />
        </span>
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="truncate text-sm font-semibold text-foreground">Telegram Canlı</span>
          <span className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
            <span className={cn('size-1.5 shrink-0 rounded-full', isLive ? 'animate-glow bg-live' : 'bg-muted-foreground')} aria-hidden="true" />
            {subtitle}
          </span>
        </span>
      </div>

      <div role="tablist" aria-label="Telegram kanalları" className="grid shrink-0 grid-cols-4 gap-1 border-b border-border p-2">
        {TABS.map(({ id, label, icon: Icon }) => {
          const selected = tab === id
          return (
            <button
              key={id}
              type="button"
              role="tab"
              id={`tg-tab-${id}`}
              aria-selected={selected}
              aria-controls="tg-tabpanel"
              onClick={() => setTab(id)}
              className={cn(
                'flex flex-col items-center gap-1 rounded-lg px-1 py-1.5 text-[11px] font-semibold leading-tight transition-colors',
                selected ? 'bg-accent/15 text-accent' : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
              )}
            >
              <Icon className="size-4" aria-hidden="true" />
              <span className="truncate">{label}</span>
            </button>
          )
        })}
      </div>

      <div role="tabpanel" id="tg-tabpanel" aria-labelledby={`tg-tab-${tab}`} className="flex min-h-0 flex-1 flex-col">
        {tab === 'sohbet' ? (
          <ChatPanel data={chat.data} onRefresh={() => chat.mutate()} />
        ) : (
          <ChannelPanel key={tab} slug={tab} data={channel.data} />
        )}
      </div>
    </aside>
  )
}
