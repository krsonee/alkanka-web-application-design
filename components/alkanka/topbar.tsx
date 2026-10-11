'use client'

import { useCallback, useState } from 'react'
import Link from 'next/link'
import { Coins, History, LogOut, Menu, Search, Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import { authClient } from '@/lib/auth-client'
import { TELEGRAM_URL } from './data'
import { BrandLogo } from './logo-selector'
import { MobileDrawer } from './sidebar'
import { formatAC, usePoints } from './points-context'

function PointsPill() {
  const { points, lastGain } = usePoints()
  return (
    <div data-tour="coins" className="relative flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5">
      <Coins className="size-4 text-primary" aria-hidden="true" />
      <span className="flex flex-col leading-none">
        <span className="hidden text-[10px] uppercase tracking-wider text-muted-foreground sm:block">Kanka Coin</span>
        <span className="font-display text-sm font-bold text-foreground tabular-nums" aria-live="polite">
          {formatAC(points)}
        </span>
      </span>
      {lastGain && (
        <span
          key={lastGain.id}
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute -bottom-5 right-2 animate-rise text-xs font-bold',
            lastGain.value > 0 ? 'text-live' : 'text-destructive',
          )}
        >
          {lastGain.value > 0 ? '+' : ''}
          {formatAC(lastGain.value)}
        </span>
      )}
    </div>
  )
}

function AccountArea() {
  const { member, refresh } = usePoints()
  if (!member) {
    return (
      <>
        <a
          href="#giris"
          className="hidden h-9 items-center rounded-lg border border-primary/50 px-4 text-xs font-bold uppercase tracking-wider text-primary transition-colors hover:bg-primary/10 sm:flex"
        >
          Giriş
        </a>
        <a
          href="#kayit"
          data-tour="account"
          className="flex h-9 shrink-0 items-center whitespace-nowrap rounded-lg bg-primary px-3 text-xs sm:px-4 font-bold uppercase tracking-wider text-primary-foreground transition-opacity hover:opacity-90"
        >
          Kayıt ol
        </a>
      </>
    )
  }
  return (
    <div data-tour="account" className="flex items-center gap-1.5">
      <Link
        href="/oyunlar/gecmis"
        className="flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-xs font-bold text-foreground transition-colors hover:border-primary/50"
      >
        <History className="size-3.5 text-primary" aria-hidden="true" />
        <span className="max-w-28 truncate">{member.name}</span>
      </Link>
      <button
        type="button"
        aria-label="Çıkış yap"
        onClick={async () => {
          await authClient.signOut()
          refresh()
        }}
        className="flex size-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground"
      >
        <LogOut className="size-4" aria-hidden="true" />
      </button>
    </div>
  )
}

export function Topbar() {
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/90 px-4 backdrop-blur-md lg:px-6">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Menüyü aç"
          data-tour="menu-btn"
          className="flex size-9 items-center justify-center rounded-lg border border-border text-foreground lg:hidden"
        >
          <Menu className="size-5" aria-hidden="true" />
        </button>
        <a href="/" className="lg:hidden">
          <BrandLogo size="sm" />
          <span className="sr-only">AL KANKA ana sayfa</span>
        </a>

        <label className="relative hidden max-w-md flex-1 md:flex">
          <span className="sr-only">Sayfa, site veya oyun ara</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input
            type="search"
            placeholder="Site, kampanya veya oyun ara…"
            className="h-10 w-full rounded-lg border border-border bg-card pr-14 pl-9 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none"
          />
          <kbd className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
            Ctrl K
          </kbd>
        </label>

        <div className="ml-auto flex items-center gap-2">
          <PointsPill />
          <a
            href={TELEGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-semibold uppercase tracking-wider text-foreground transition-colors hover:border-accent/50 hover:text-accent xl:hidden 2xl:flex"
          >
            <Send className="size-3.5" aria-hidden="true" />
            Telegram
          </a>
          <AccountArea />
        </div>
      </header>
      <MobileDrawer open={open} onClose={close} />
    </>
  )
}
