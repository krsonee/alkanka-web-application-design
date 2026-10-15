'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import useSWR from 'swr'
import { ArrowRight, Check, ExternalLink, Mail, X } from 'lucide-react'
import { getMiniStatus, type MiniGame, type MiniStatus } from '@/app/actions/wallet'
import { getInboxStatus, markInboxRead, type InboxStatus } from '@/app/actions/inbox'
import { JakoAvatar, type JakoPose } from './jako'
import { cn } from '@/lib/utils'

const REWARDS: Record<MiniGame, { label: string; href: string; pose: JakoPose; line: string }> = {
  cark: { label: 'Şans Çarkı', href: '/oyunlar/cark', pose: 'kazandi', line: 'Çark hakkın yenilendi kanka, çevir de görelim!' },
  sandik: { label: 'Gizemli Sandık', href: '/oyunlar/sandik', pose: 'sandik', line: 'Sandığın hazır, içinde ne var bakalım mı?' },
  zar: { label: 'Zar At', href: '/oyunlar/zar', pose: 'zar', line: 'Zar hakların geldi, şansını dene!' },
}

const PENDING_KEY = 'ak-reward-pending'
const POPPED_KEY = 'ak-inbox-popped'

type Alert =
  | { kind: 'reward'; id: string; game: MiniGame }
  | {
      kind: 'message'
      id: string
      messageId: number
      title: string
      body: string
      url: string | null
      unread: number
      image?: string | null
    }

type MessageAlertData = Extract<Alert, { kind: 'message' }>

function readPending(): Partial<Record<MiniGame, number>> {
  try {
    return JSON.parse(localStorage.getItem(PENDING_KEY) ?? '{}')
  } catch {
    return {}
  }
}

function systemNotify(title: string, body: string, url: string) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted' || !document.hidden) return
  navigator.serviceWorker?.getRegistration().then((reg) => {
    if (reg) reg.showNotification(title, { body, icon: '/icon-192.png', badge: '/icon-192.png', data: { url }, tag: url })
    else new Notification(title, { body, icon: '/icon-192.png' })
  }).catch(() => {})
}

export function JakoAlerts() {
  const pathname = usePathname()
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [popup, setPopup] = useState<MessageAlertData | null>(null)
  const pathRef = useRef(pathname)
  useEffect(() => {
    pathRef.current = pathname
  }, [pathname])

  const { data: mini, mutate: refreshMini } = useSWR<MiniStatus>('mini-status', () => getMiniStatus(), {
    refreshInterval: 5 * 60_000,
    revalidateOnFocus: true,
  })
  const { data: inbox, mutate: refreshInbox } = useSWR<InboxStatus>('inbox-status', () => getInboxStatus(), {
    refreshInterval: 30_000,
    revalidateOnFocus: true,
  })

  const push = useCallback((alert: Alert) => {
    setAlerts((list) => (list.some((a) => a.id === alert.id) ? list : [alert, ...list].slice(0, 3)))
  }, [])
  const dismiss = (id: string) => setAlerts((list) => list.filter((a) => a.id !== id))

  useEffect(() => {
    if (!mini) return
    const pending = readPending()
    for (const game of Object.keys(REWARDS) as MiniGame[]) {
      if (mini.hidden?.includes(game)) {
        delete pending[game]
        continue
      }
      const next = mini[game]
      if (next) pending[game] = next
    }
    localStorage.setItem(PENDING_KEY, JSON.stringify(pending))

    const due = Object.values(pending).filter((t): t is number => typeof t === 'number')
    if (!due.length) return
    const wait = Math.max(0, Math.min(...due) - Date.now()) + 500

    const timer = setTimeout(() => {
      const current = readPending()
      const now = Date.now()
      for (const game of Object.keys(current) as MiniGame[]) {
        const at = current[game]
        if (!at || at > now) continue
        delete current[game]
        const reward = REWARDS[game]
        if (!reward) continue
        if (!pathRef.current?.startsWith(reward.href)) {
          push({ kind: 'reward', id: `reward-${game}-${at}`, game })
          systemNotify(`${reward.label} hazır!`, reward.line, reward.href)
        }
      }
      localStorage.setItem(PENDING_KEY, JSON.stringify(current))
      refreshMini()
    }, Math.min(wait, 2_147_000_000))
    return () => clearTimeout(timer)
  }, [mini, push, refreshMini])

  useEffect(() => {
    const latest = inbox?.latest
    if (!latest) return
    const popped = Number(localStorage.getItem(POPPED_KEY) ?? 0)
    if (latest.id <= popped) return
    localStorage.setItem(POPPED_KEY, String(latest.id))
    if (pathRef.current === '/profil' && window.location.search.includes('sekme=mesajlar')) return
    setPopup({
      kind: 'message',
      id: `msg-${latest.id}`,
      messageId: latest.id,
      title: latest.title,
      body: latest.body,
      url: latest.url,
      unread: inbox.unread,
      image: latest.imageUrl,
    })
    systemNotify('Sana özel mesaj var kanka!', latest.title, '/profil?sekme=mesajlar')
  }, [inbox])

  const deferPopup = useCallback(() => {
    setPopup((current) => {
      if (current) push(current)
      return null
    })
  }, [push])

  const readPopup = useCallback(() => {
    setPopup((current) => {
      if (current) {
        markInboxRead([current.messageId])
          .then(() => refreshInbox())
          .catch(() => {})
      }
      return null
    })
  }, [refreshInbox])

  const reopen = (alert: MessageAlertData) => {
    dismiss(alert.id)
    setPopup(alert)
  }

  useEffect(() => {
    if (pathname === '/profil') setPopup(null)
    setAlerts((list) =>
      list.filter((a) => {
        if (a.kind === 'reward') return !pathname.startsWith(REWARDS[a.game].href)
        return pathname !== '/profil'
      }),
    )
  }, [pathname])

  if (!alerts.length && !popup) return null

  return (
    <>
    {popup && <MessagePopup alert={popup} onLater={deferPopup} onRead={readPopup} />}
    <section
      aria-label="Bildirimler"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-3 top-20 z-[55] flex flex-col items-end gap-3 sm:left-auto sm:w-96 lg:right-6 xl:right-[21.5rem]"
    >
      {alerts.map((alert) =>
        alert.kind === 'message' ? (
          <MessageAlert key={alert.id} alert={alert} onClose={() => dismiss(alert.id)} onOpen={() => reopen(alert)} />
        ) : (
          <RewardAlert key={alert.id} game={alert.game} onClose={() => dismiss(alert.id)} />
        ),
      )}
    </section>
    </>
  )
}

function MessagePopup({
  alert,
  onLater,
  onRead,
}: {
  alert: MessageAlertData
  onLater: () => void
  onRead: () => void
}) {
  const laterRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    laterRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onLater()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onLater])

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Sonra bak"
        tabIndex={-1}
        onClick={onLater}
        className="absolute inset-0 bg-background/70 backdrop-blur-sm animate-in fade-in duration-300"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="jako-popup-title"
        className="relative flex max-h-[calc(100dvh-2rem)] w-full max-w-md flex-col gap-4 overflow-hidden rounded-3xl border border-primary/40 bg-card px-5 pt-6 pb-5 shadow-2xl animate-in fade-in zoom-in-90 slide-in-from-bottom-6 duration-500 sm:px-6"
      >
        <div className="flex items-center gap-3">
          <span className="relative block shrink-0">
            <JakoAvatar pose="duyuru" size="md" className="ring-2 ring-primary/30" />
            {alert.unread > 1 && (
              <span className="absolute -top-2 -right-2 flex min-w-6 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-primary-foreground ring-2 ring-card">
                {alert.unread > 9 ? '9+' : alert.unread}
              </span>
            )}
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-primary">
              <Mail className="size-3.5" aria-hidden />
              Jako diyor ki
            </span>
            <h2 id="jako-popup-title" className="font-display text-lg font-bold leading-snug text-foreground text-balance">
              {alert.title}
            </h2>
          </div>
        </div>
        <div className="flex min-h-0 flex-col gap-3 overflow-y-auto overscroll-contain rounded-2xl border border-border bg-secondary/40 p-4">
          {alert.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={alert.image} alt="" className="max-h-56 w-full rounded-xl border border-border bg-secondary object-cover" />
          )}
          {alert.body ? (
            <p className="whitespace-pre-line break-words text-sm leading-relaxed text-foreground text-pretty">{alert.body}</p>
          ) : (
            <p className="text-sm leading-relaxed text-muted-foreground">Sana özel mesaj geldi kanka!</p>
          )}
          {alert.url && (
            <a
              href={alert.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 self-start text-sm font-semibold text-primary hover:underline"
            >
              Bağlantıyı aç
              <ExternalLink className="size-3.5" aria-hidden />
            </a>
          )}
        </div>
        <div className="flex w-full flex-col gap-2">
          <button
            ref={laterRef}
            type="button"
            onClick={onRead}
            className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90"
          >
            <Check className="size-4" aria-hidden />
            Okudum, devam et
          </button>
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={onLater}
              className="rounded-xl px-3 py-2 text-sm font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              Sonra bakarım
            </button>
            <a
              href="/profil?sekme=mesajlar"
              target="_blank"
              rel="noopener"
              className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              Tüm mesajlar
              <ExternalLink className="size-3.5" aria-hidden />
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

function Shell({ children, onClose, tone }: { children: React.ReactNode; onClose: () => void; tone: 'gold' | 'primary' }) {
  return (
    <div
      className={cn(
        'pointer-events-auto relative w-full overflow-hidden rounded-2xl border bg-card/95 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-4 zoom-in-95 duration-500',
        tone === 'gold' ? 'border-gold/40' : 'border-primary/40',
      )}
    >
      <span aria-hidden className={cn('absolute inset-x-0 top-0 h-0.5', tone === 'gold' ? 'bg-gold' : 'bg-primary')} />
      <button
        type="button"
        onClick={onClose}
        aria-label="Bildirimi kapat"
        className="absolute top-2 right-2 z-10 flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
      >
        <X className="size-4" aria-hidden />
      </button>
      {children}
    </div>
  )
}

function RewardAlert({ game, onClose }: { game: MiniGame; onClose: () => void }) {
  const r = REWARDS[game]
  return (
    <Shell onClose={onClose} tone="gold">
      <div className="flex items-center gap-3 p-3 pr-10">
        <JakoAvatar pose={r.pose} size="sm" className="ring-gold/50" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gold">
            <span aria-hidden className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-gold opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-gold" />
            </span>
            Hakkın hazır
          </span>
          <p className="font-display text-sm font-bold text-foreground">{r.label}</p>
          <p className="text-xs leading-relaxed text-muted-foreground text-pretty">{r.line}</p>
        </div>
      </div>
      <Link
        href={r.href}
        onClick={onClose}
        className="flex items-center justify-center gap-2 border-t border-border bg-gold/10 px-3 py-2.5 text-sm font-bold text-gold hover:bg-gold/20"
      >
        Hemen oyna
        <ArrowRight className="size-4" aria-hidden />
      </Link>
    </Shell>
  )
}

function MessageAlert({
  alert,
  onClose,
  onOpen,
}: {
  alert: MessageAlertData
  onClose: () => void
  onOpen: () => void
}) {
  return (
    <Shell onClose={onClose} tone="primary">
      <div className="flex items-center gap-3 p-3 pr-10">
        <span className="relative block shrink-0">
          <JakoAvatar
            pose="duyuru"
            size="md"
            className="ring-2 ring-primary/40 animate-bounce [animation-iteration-count:2]"
          />
          <span className="absolute -top-2 -right-2 flex min-w-6 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-primary-foreground ring-2 ring-card">
            {alert.unread > 9 ? '9+' : alert.unread}
          </span>
        </span>
        <div className="relative flex min-w-0 flex-1 flex-col gap-1 rounded-xl rounded-tl-sm border border-primary/25 bg-primary/5 px-3 py-2.5">
          <span
            aria-hidden
            className="absolute top-4 -left-1.5 size-3 rotate-45 border-b border-l border-primary/25 bg-card"
          />
          <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-primary">
            <Mail className="size-3" aria-hidden />
            Jako diyor ki
          </span>
          <p className="text-sm font-semibold leading-snug text-foreground text-pretty">Sana özel mesaj geldi kanka, kontrol et!</p>
          <p className="truncate text-xs text-muted-foreground">{alert.title}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-center justify-center gap-2 border-t border-border bg-primary px-3 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90"
      >
        Mesajı oku
        <ArrowRight className="size-4" aria-hidden />
      </button>
    </Shell>
  )
}
