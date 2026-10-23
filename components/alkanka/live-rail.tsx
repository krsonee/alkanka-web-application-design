'use client'

import { useEffect, useRef, useState, useTransition, type FormEvent, type KeyboardEvent } from 'react'
import {
  ChevronDown,
  ExternalLink,
  Globe,
  Link2,
  Loader2,
  Lock,
  Megaphone,
  MessageCircle,
  MessagesSquare,
  Percent,
  Pin,
  RefreshCw,
  Send,
  Ticket,
  UserPlus,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { sendChannelCommentAction, sendChatMessage, startTelegramLink } from '@/app/actions/chat'
import {
  BROADCAST_CHANNELS,
  type BroadcastSlug,
  type ChannelComment,
  type ChannelFeed,
  type ChannelPost,
  type ChatTab,
  type TelegramAccess,
} from '@/lib/telegram-channels-shared'
import { TELEGRAM_URL } from './data'
import { useChannelFeed, useChatFeed, type ChatResponse } from './use-chat-feed'
import { MemberRank } from './kp/member-rank'

export const OPEN_CHAT_EVENT = 'alkanka:open-chat'

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

const isSubmitKey = (e: KeyboardEvent<HTMLTextAreaElement>) =>
  e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && e.keyCode !== 229

function LinkTelegramButton() {
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  return (
    <>
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
        {"Telegram'ı bağla"}
      </button>
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    </>
  )
}

/** Steps a visitor through login → Telegram link → joining, before any content is shown. */
function JoinGate({
  me,
  inviteUrl,
  place,
  onRecheck,
}: {
  me: TelegramAccess
  inviteUrl: string
  place: { name: string; join: string }
  onRecheck: () => void
}) {
  const step = !me.loggedIn ? 1 : !me.link ? 2 : 3
  const steps = ['Giriş yap', "Telegram'ı bağla", place.join]

  return (
    <li className="flex flex-1 flex-col items-center justify-center gap-4 px-2 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-accent/15 text-accent">
        <Lock className="size-5" aria-hidden="true" />
      </span>
      <div className="flex flex-col gap-1.5">
        <p className="text-sm font-semibold text-foreground text-balance">{place.name} üyelere özel</p>
        <p className="text-xs leading-relaxed text-muted-foreground text-pretty">
          {`Mesajları görmek ve yorum yapmak için Telegram'da ${place.name.toLocaleLowerCase('tr-TR')} katılmış olman gerekiyor.`}
        </p>
      </div>

      <ol className="flex w-full flex-col gap-1.5 text-left" aria-label="Katılım adımları">
        {steps.map((label, i) => {
          const n = i + 1
          const done = n < step
          const current = n === step
          return (
            <li
              key={label}
              aria-current={current ? 'step' : undefined}
              className={cn(
                'flex items-center gap-2.5 rounded-lg border px-3 py-2 text-xs font-semibold',
                current ? 'border-accent/40 bg-accent/10 text-foreground' : 'border-border text-muted-foreground',
              )}
            >
              <span
                className={cn(
                  'flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] tabular-nums',
                  done ? 'bg-live text-background' : current ? 'bg-accent text-accent-foreground' : 'bg-secondary',
                )}
              >
                {done ? '✓' : n}
              </span>
              <span className={cn(done && 'line-through')}>{label}</span>
            </li>
          )
        })}
      </ol>

      <div className="flex w-full flex-col gap-2">
        {step === 1 && (
          <a href="#giris" className="flex h-10 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90">
            Giriş yap
          </a>
        )}
        {step === 2 && (
          <>
            <LinkTelegramButton />
            <p className="text-xs leading-relaxed text-muted-foreground text-pretty">
              {"Açılan Telegram sohbetinde Başlat'a bas, hesabın bağlanır."}
            </p>
          </>
        )}
        {step === 3 && (
          <>
            <a href={inviteUrl} target="_blank" rel="noopener noreferrer" className={primaryCta}>
              <UserPlus className="size-4" aria-hidden="true" />
              {place.join}
            </a>
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">{me.link?.tgName}</span> olarak bağlısın
            </p>
          </>
        )}
        {step >= 2 && (
          <button
            type="button"
            onClick={onRecheck}
            className="flex items-center justify-center gap-1.5 text-xs font-semibold text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            <RefreshCw className="size-3" aria-hidden="true" />
            {step === 2 ? 'Bağladım, kontrol et' : 'Katıldım, kontrol et'}
          </button>
        )}
      </div>
    </li>
  )
}

function ConnectedAs({ me, url, label }: { me: TelegramAccess; url: string; label: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
        <span className="size-1.5 shrink-0 rounded-full bg-live" aria-hidden="true" />
        <span className="truncate">
          <span className="font-semibold text-foreground">{me.link?.tgName}</span> olarak bağlı
        </span>
      </span>
      <a href={url} target="_blank" rel="noopener noreferrer" className="shrink-0 font-semibold text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
        {label}
      </a>
    </div>
  )
}

function Composer({ data, onSent }: { data: ChatResponse; onSent: () => void }) {
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function submit(e?: FormEvent) {
    e?.preventDefault()
    const message = text.trim()
    if (!message || pending) return
    startTransition(async () => {
      setError(null)
      const res = await sendChatMessage(message)
      if (res.ok) setText('')
      else setError(res.message ?? 'Mesaj gönderilemedi.')
      onSent()
    })
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
          onKeyDown={(e) => {
            if (!isSubmitKey(e)) return
            e.preventDefault()
            submit()
          }}
          maxLength={500}
          rows={1}
          placeholder={`${data.me.link?.tgName ?? ''} olarak yaz…`}
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

function SiteBadge() {
  return (
    <span className="inline-flex items-center gap-0.5 rounded bg-primary/10 px-1 text-[10px] font-semibold text-primary">
      <Globe className="size-2.5" aria-hidden="true" />
      site
    </span>
  )
}

function ChatPanel({ data, onRefresh }: { data: ChatResponse | undefined; onRefresh: () => void }) {
  const listRef = useStickToBottom(data?.messages.at(-1)?.id)
  const inviteUrl = data?.inviteUrl ?? TELEGRAM_URL
  const locked = Boolean(data?.configured && data.locked)

  return (
    <>
      {data?.pinned && !locked && (
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
        ) : locked ? (
          <JoinGate me={data.me} inviteUrl={inviteUrl} place={{ name: 'Sohbet grubu', join: 'Sohbete katıl' }} onRecheck={onRefresh} />
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
                {m.origin === 'site' && <SiteBadge />}
                <time dateTime={m.createdAt} className="ml-auto text-[10px] text-muted-foreground tabular-nums">
                  {timeFormat.format(new Date(m.createdAt))}
                </time>
              </span>
              {m.media?.type === 'photo' && (
                <a href={m.media.url} target="_blank" rel="noopener noreferrer" className="block">
                  {/* eslint-disable-next-line @next/next/no-img-element -- Proxied Telegram file, not a static asset. */}
                  <img src={m.media.url} alt={`${m.author} paylaşımı`} loading="lazy" className="max-h-72 w-full rounded-lg border border-border object-contain" />
                </a>
              )}
              {m.media?.type === 'animation' && (
                <video src={m.media.url} autoPlay loop muted playsInline className="max-h-72 w-full rounded-lg border border-border object-contain" />
              )}
              {m.media?.type === 'video' && (
                <video src={m.media.url} controls preload="metadata" playsInline className="max-h-72 w-full rounded-lg border border-border bg-background object-contain" />
              )}
              {m.text && <span className="whitespace-pre-line break-words text-foreground">{m.text}</span>}
            </li>
          ))
        )}
      </ol>

      {data && !locked && (
        <div className="flex flex-col gap-2 border-t border-border p-3">
          {data.configured && data.me.joined ? (
            <>
              <Composer data={data} onSent={onRefresh} />
              <ConnectedAs me={data.me} url={inviteUrl} label={"Telegram'da aç"} />
            </>
          ) : (
            <a href={inviteUrl} target="_blank" rel="noopener noreferrer" className={primaryCta}>
              <UserPlus className="size-4" aria-hidden="true" />
              Sohbete katıl
            </a>
          )}
        </div>
      )}
    </>
  )
}

function CommentList({ comments }: { comments: ChannelComment[] }) {
  if (!comments.length) return <p className="text-xs text-muted-foreground">İlk yorumu sen yap.</p>
  return (
    <ul className="flex flex-col gap-2">
      {comments.map((c) => (
        <li key={c.id} className="flex flex-col gap-0.5 text-xs leading-relaxed">
          <span className="flex items-center gap-1.5">
            <span className={cn('font-semibold', c.origin === 'site' ? 'text-primary' : 'text-accent')}>{c.author}</span>
            <MemberRank userId={c.userId} />
            {c.origin === 'site' && <SiteBadge />}
            <time dateTime={c.createdAt} className="ml-auto text-[10px] text-muted-foreground tabular-nums">
              {timeFormat.format(new Date(c.createdAt))}
            </time>
          </span>
          <span className="break-words text-foreground">{c.text}</span>
        </li>
      ))}
    </ul>
  )
}

function CommentComposer({ slug, post, onSent }: { slug: BroadcastSlug; post: ChannelPost; onSent: () => void }) {
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const inputId = `comment-${slug}-${post.id}`

  if (!post.commentable) {
    return (
      <a href={`${post.url}?comment=1`} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-accent underline-offset-2 hover:underline">
        {"Telegram'da yorum yap"}
      </a>
    )
  }

  function submit(e?: FormEvent) {
    e?.preventDefault()
    const message = text.trim()
    if (!message || pending) return
    startTransition(async () => {
      setError(null)
      const res = await sendChannelCommentAction(slug, post.id, message)
      if (res.ok) setText('')
      else setError(res.message ?? 'Yorum gönderilemedi.')
      onSent()
    })
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-1">
      <div className="flex items-end gap-1.5">
        <label htmlFor={inputId} className="sr-only">
          Yorumun
        </label>
        <textarea
          id={inputId}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (!isSubmitKey(e)) return
            e.preventDefault()
            submit()
          }}
          maxLength={500}
          rows={1}
          placeholder="Yorum yaz…"
          className="max-h-20 min-h-9 flex-1 resize-none rounded-lg border border-input bg-background px-2.5 py-2 text-xs leading-relaxed text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
        />
        <button
          type="submit"
          disabled={pending || !text.trim()}
          aria-label="Yorumu gönder"
          className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Send className="size-3.5" aria-hidden="true" />}
        </button>
      </div>
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    </form>
  )
}

function PostCard({ slug, post, onRefresh }: { slug: BroadcastSlug; post: ChannelPost; onRefresh: () => void }) {
  const [open, setOpen] = useState(false)
  const threadId = `thread-${slug}-${post.id}`

  return (
    <li className="animate-slide-in flex flex-col gap-2 rounded-xl border border-border bg-card p-3 text-sm leading-relaxed">
      {post.photo && (
        // eslint-disable-next-line @next/next/no-img-element -- Telegram CDN images are short-lived, so they skip next/image optimization.
        <img src={post.photo} alt="" loading="lazy" className="max-h-44 w-full rounded-lg object-cover" />
      )}
      {post.text && <p className="whitespace-pre-line break-words text-foreground">{post.text}</p>}
      <span className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
        {post.createdAt ? (
          <time dateTime={post.createdAt} className="tabular-nums">
            {dateTimeFormat.format(new Date(post.createdAt))}
          </time>
        ) : (
          <span />
        )}
        <a href={post.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold hover:text-foreground">
          {"Telegram'da gör"}
          <ExternalLink className="size-2.5" aria-hidden="true" />
        </a>
      </span>

      <div className="border-t border-border pt-2">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={threadId}
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          <MessageCircle className="size-3.5" aria-hidden="true" />
          {post.comments.length ? `${post.comments.length} yorum` : 'Yorum yap'}
          <ChevronDown className={cn('ml-auto size-3.5 transition-transform', open && 'rotate-180')} aria-hidden="true" />
        </button>
        {open && (
          <div id={threadId} className="mt-2.5 flex flex-col gap-2.5">
            <CommentList comments={post.comments} />
            <CommentComposer slug={slug} post={post} onSent={onRefresh} />
          </div>
        )}
      </div>
    </li>
  )
}

function ChannelPanel({ slug, data, onRefresh }: { slug: BroadcastSlug; data: ChannelFeed | undefined; onRefresh: () => void }) {
  const listRef = useStickToBottom(`${slug}:${data?.locked}:${data?.posts.at(-1)?.id}`)
  const label = BROADCAST_CHANNELS.find((c) => c.slug === slug)!.title
  const name = label.charAt(0).toLocaleUpperCase('tr-TR') + label.slice(1)

  return (
    <>
      <ol ref={listRef} aria-live="polite" className="flex flex-1 flex-col gap-3 overflow-y-auto px-3 py-4 no-scrollbar">
        {!data ? (
          <Loading />
        ) : !data.configured ? (
          <EmptyState title={`${name} yakında burada`} body="Kanalımız bağlandığında paylaşımlar burada görünecek." />
        ) : data.locked ? (
          <JoinGate me={data.me} inviteUrl={data.inviteUrl ?? TELEGRAM_URL} place={{ name, join: 'Kanala katıl' }} onRecheck={onRefresh} />
        ) : data.posts.length === 0 ? (
          <EmptyState title="Henüz paylaşım yok" body="Kanala atılan yeni paylaşımlar burada görünecek." />
        ) : (
          data.posts.map((p) => <PostCard key={p.id} slug={slug} post={p} onRefresh={onRefresh} />)
        )}
      </ol>

      {data?.configured && !data.locked && data.inviteUrl && (
        <div className="border-t border-border p-3">
          <ConnectedAs me={data.me} url={data.inviteUrl} label={"Kanalı Telegram'da aç"} />
        </div>
      )}
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
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const open = () => setMobileOpen(true)
    window.addEventListener(OPEN_CHAT_EVENT, open)
    return () => window.removeEventListener(OPEN_CHAT_EVENT, open)
  }, [])

  useEffect(() => {
    if (!mobileOpen) return
    const onKey = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && setMobileOpen(false)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [mobileOpen])

  return (
    <>
    <button
      type="button"
      onClick={() => setMobileOpen(true)}
      className="fixed bottom-5 right-5 z-30 hidden items-center gap-2 rounded-full bg-accent px-4 py-3 text-sm font-semibold text-accent-foreground shadow-lg transition-opacity hover:opacity-90 lg:flex xl:hidden"
    >
      <MessagesSquare className="size-4" aria-hidden="true" />
      Sohbet
    </button>
    {mobileOpen && (
      <button
        type="button"
        tabIndex={-1}
        aria-label="Sohbeti kapat"
        onClick={() => setMobileOpen(false)}
        className="animate-in fade-in fixed inset-0 z-50 bg-background/60 backdrop-blur-sm xl:hidden"
      />
    )}
    <aside
      data-live-rail
      aria-label="Telegram canlı sohbet"
      className={cn(
        'fixed inset-x-0 bottom-0 z-50 h-[85dvh] w-full flex-col overflow-hidden rounded-t-3xl border-t border-accent/40 bg-surface shadow-2xl',
        'xl:top-0 xl:left-auto xl:z-30 xl:flex xl:h-auto xl:w-80 xl:rounded-none xl:border-t-0 xl:border-l xl:border-border xl:shadow-none',
        mobileOpen ? 'animate-in slide-in-from-bottom flex pb-[env(safe-area-inset-bottom)] duration-300 xl:animate-none xl:pb-0' : 'hidden',
      )}
    >
      <span className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-border xl:hidden" aria-hidden="true" />
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-4 xl:h-16">
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
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          aria-label="Sohbeti kapat"
          className="ml-auto flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground xl:hidden"
        >
          <X className="size-5" aria-hidden="true" />
        </button>
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
          <ChannelPanel key={tab} slug={tab} data={channel.data} onRefresh={() => channel.mutate()} />
        )}
      </div>
    </aside>
    </>
  )
}
