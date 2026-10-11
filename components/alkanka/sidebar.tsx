'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Send, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { NAV_ITEMS, TELEGRAM_URL } from './data'
import { JakoAvatar } from './jako'
import { BrandLogo, LogoSelector } from './logo-selector'
import { TourButton } from './app/site-tour'
import { useChatFeed } from './use-chat-feed'

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()

  return (
    <nav aria-label="Ana menü" className="flex flex-col gap-0.5">
      {NAV_ITEMS.map((item) => {
        const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
        const Icon = item.icon
        return (
          <Link
            key={item.id}
            href={item.href}
            onClick={onNavigate}
            data-tour-nav={item.id}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
              isActive
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
            )}
          >
            {isActive && <span aria-hidden="true" className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-primary" />}
            <Icon className="size-4 shrink-0" aria-hidden="true" />
            <span className="flex-1">{item.label}</span>
            {item.badge && (
              <span className="rounded bg-live/15 px-1.5 py-0.5 text-[10px] font-semibold text-live">{item.badge}</span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}

function TelegramCard() {
  const { data } = useChatFeed()
  const subtitle =
    data?.configured && data.members != null ? `${data.members.toLocaleString('tr-TR')} üye · canlı sohbet` : 'Topluluğa katıl, sohbete gel'
  return (
    <a
      href={data?.inviteUrl ?? TELEGRAM_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 rounded-xl border border-accent/30 bg-accent/10 p-3 transition-colors hover:bg-accent/15"
    >
      <JakoAvatar pose="telegram" size="sm" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm font-semibold text-foreground">Jako Telegram’da!</span>
        <span className="truncate text-xs text-muted-foreground">{subtitle}</span>
      </span>
      <Send className="size-4 shrink-0 text-accent" aria-hidden="true" />
    </a>
  )
}

function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      <div className="flex-1 overflow-y-auto px-3 py-4 no-scrollbar">
        <NavList onNavigate={onNavigate} />
        <TourButton className="mt-0.5 w-full" />
      </div>
      <div className="flex flex-col gap-3 border-t border-border p-3">
        <TelegramCard />
      </div>
    </>
  )
}

export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-border bg-surface lg:flex">
      <Link href="/" className="flex h-16 shrink-0 items-center border-b border-border px-5">
        <BrandLogo size="sm" />
        <span className="sr-only">AL KANKA ana sayfa</span>
      </Link>
      <SidebarBody />
    </aside>
  )
}

export function MobileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  return (
    <div className={cn('fixed inset-0 z-50 lg:hidden', open ? 'pointer-events-auto' : 'pointer-events-none')} aria-hidden={!open}>
      <button
        type="button"
        aria-label="Menüyü kapat"
        tabIndex={open ? 0 : -1}
        onClick={onClose}
        className={cn('absolute inset-0 bg-background/80 backdrop-blur-sm transition-opacity', open ? 'opacity-100' : 'opacity-0')}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Menü"
        className={cn(
          'absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-border bg-surface transition-transform duration-300',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-border px-5">
          <BrandLogo size="sm" />
          <button
            type="button"
            onClick={onClose}
            tabIndex={open ? 0 : -1}
            aria-label="Menüyü kapat"
            className="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>
        {open && <SidebarBody onNavigate={onClose} />}
      </aside>
    </div>
  )
}
