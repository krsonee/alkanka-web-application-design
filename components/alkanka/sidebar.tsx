'use client'

import { useEffect, useState } from 'react'
import { Send, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { NAV_ITEMS, TELEGRAM_URL } from './data'
import { BrandLogo, LogoSelector } from './logo-selector'

const SECTION_IDS = ['anasayfa', 'siteler', 'gorevler', 'market', 'oyunlar', 'etkinlikler', 'siralama', 'sss']

function useActiveSection() {
  const [active, setActive] = useState('anasayfa')
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setActive(visible[0].target.id)
      },
      { rootMargin: '-30% 0px -60% 0px' },
    )
    SECTION_IDS.forEach((id) => {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [])
  return active
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const active = useActiveSection()
  const seen = new Set<string>()

  return (
    <nav aria-label="Ana menü" className="flex flex-col gap-0.5">
      {NAV_ITEMS.map((item) => {
        const target = item.href.slice(1)
        const isActive = active === target && !seen.has(target)
        seen.add(target)
        const Icon = item.icon
        return (
          <a
            key={item.id}
            href={item.href}
            onClick={onNavigate}
            aria-current={isActive ? 'true' : undefined}
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
          </a>
        )
      })}
    </nav>
  )
}

function TelegramCard() {
  return (
    <a
      href={TELEGRAM_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 rounded-xl border border-accent/30 bg-accent/10 p-3 transition-colors hover:bg-accent/15"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
        <Send className="size-4" aria-hidden="true" />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-sm font-semibold text-foreground">Telegram</span>
        <span className="truncate text-xs text-muted-foreground">14.2K üye · 2.384 çevrimiçi</span>
      </span>
    </a>
  )
}

function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      <div className="flex-1 overflow-y-auto px-3 py-4 no-scrollbar">
        <NavList onNavigate={onNavigate} />
      </div>
      <div className="flex flex-col gap-3 border-t border-border p-3">
        <TelegramCard />
        <LogoSelector />
      </div>
    </>
  )
}

export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-border bg-surface lg:flex">
      <a href="#anasayfa" className="flex h-16 shrink-0 items-center border-b border-border px-5">
        <BrandLogo size="sm" />
        <span className="sr-only">AL KANKA ana sayfa</span>
      </a>
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
