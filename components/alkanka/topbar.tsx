'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { Award, ChevronDown, Coins, History, Link2, LogOut, Mail, Menu, MessageSquareText, Search, Send, Settings, UserRound } from 'lucide-react'
import { getInboxStatus, type InboxStatus } from '@/app/actions/inbox'
import { cn } from '@/lib/utils'
import { authClient } from '@/lib/auth-client'
import { TELEGRAM_URL } from './data'
import { BrandLogo } from './logo-selector'
import { MobileDrawer } from './sidebar'
import { formatAC, usePoints } from './points-context'
import { MemberRank } from './kp/member-rank'
import { SiteSearch, type SearchSponsor } from './site-search'
import { RadioPlayer } from './radio-player'
import type { SocialLinks } from '@/lib/social-shared'

function PointsPill() {
  const { points, lastGain, member } = usePoints()
  if (!member) return null
  return (
    <div
      data-tour="coins"
      title="Kanka Coin bakiyen"
      className="relative flex h-9 shrink-0 items-center gap-1 rounded-lg border border-primary/30 bg-primary/10 px-2 sm:gap-1.5 sm:px-2.5"
    >
      <Coins className="size-3.5 text-primary" aria-hidden="true" />
      <span className="sr-only">Kanka Coin bakiyesi:</span>
      <span className="font-display text-xs font-bold text-foreground tabular-nums" aria-live="polite">
        {formatAC(points)}
      </span>
      <span className="hidden text-[10px] font-semibold uppercase text-muted-foreground sm:inline" aria-hidden="true">
        KC
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

function BadgeButton() {
  const { member } = usePoints()
  if (!member) return null
  return (
    <Link
      href="/profil?sekme=rozetler"
      title="Aktif rozetin"
      className="animate-badge-pulse relative flex h-9 shrink-0 items-center gap-1 overflow-hidden rounded-lg border border-primary/40 bg-primary/[0.08] px-1.5 transition-colors hover:border-primary sm:px-2"
    >
      <span className="tier-shine pointer-events-none absolute inset-0" aria-hidden="true" />
      <MemberRank userId={member.id} className="relative" />
      <span className="sr-only">Rozetlerim</span>
    </Link>
  )
}

const MENU = [
  { href: '/profil', label: 'Profilim', icon: UserRound },
  { href: '/profil?sekme=rozetler', label: 'Rozetlerim', icon: Award },
  { href: '/profil?sekme=hesaplar', label: 'Bağlı hesaplar', icon: Link2 },
  { href: '/profil?sekme=ayarlar', label: 'Hesap ayarları', icon: Settings },
  { href: '/profil?sekme=yorumlar', label: 'Yorumlarım', icon: MessageSquareText },
  { href: '/oyunlar/gecmis', label: 'Oyun geçmişi', icon: History },
] as const

function AccountMenu() {
  const { member, points, refresh } = usePoints()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const { data: inbox } = useSWR<InboxStatus>(member ? 'inbox-status' : null, () => getInboxStatus(), {
    refreshInterval: 30_000,
    revalidateOnFocus: true,
  })
  const unread = inbox?.unread ?? 0
  const unreadLabel = unread > 9 ? '9+' : String(unread)

  if (!member) return null
  return (
    <div ref={ref} data-tour="account" className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="hesap-menu"
        aria-label={unread ? `Hesap menüsü, ${unread} okunmamış mesaj` : undefined}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex h-9 items-center gap-2 rounded-lg border px-1.5 text-xs font-bold text-foreground transition-colors sm:px-3',
          open ? 'border-primary/60 bg-primary/10' : 'border-border hover:border-primary/50',
        )}
      >
        <span className="relative flex size-6 shrink-0 items-center justify-center rounded-full bg-primary font-display text-[11px] font-bold text-primary-foreground">
          {member.name.slice(0, 1).toUpperCase()}
          {unread > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex" aria-hidden="true">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-destructive opacity-60" />
              <span className="relative flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold leading-none text-destructive-foreground ring-2 ring-background">
                {unreadLabel}
              </span>
            </span>
          )}
        </span>
        <span className="sr-only sm:not-sr-only sm:max-w-28 sm:truncate">{member.name}</span>
        <ChevronDown className={cn('hidden size-3.5 text-muted-foreground transition-transform sm:block', open && 'rotate-180')} aria-hidden="true" />
      </button>
      {open && (
        <div
          id="hesap-menu"
          role="menu"
          aria-label="Hesap menüsü"
          className="absolute right-0 top-11 z-50 w-64 overflow-hidden rounded-xl border border-border bg-popover shadow-2xl shadow-background/60"
        >
          <div className="flex items-center gap-3 border-b border-border bg-primary/[0.06] px-4 py-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary font-display text-sm font-bold text-primary-foreground">
              {member.name.slice(0, 1).toUpperCase()}
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-bold text-foreground">{member.name}</span>
              <span className="text-xs tabular-nums text-muted-foreground">{points.toLocaleString('tr-TR')} KC bakiye</span>
            </span>
          </div>
          <div className="p-1.5 pb-0">
            <Link
              role="menuitem"
              href="/profil?sekme=mesajlar"
              onClick={() => setOpen(false)}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors',
                unread
                  ? 'bg-primary/10 text-foreground ring-1 ring-primary/40 hover:bg-primary/15'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
              )}
            >
              <Mail className="size-4 text-primary" aria-hidden="true" />
              <span className="flex-1">Mesajlarım</span>
              {unread > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground">
                  {unreadLabel} yeni
                </span>
              )}
            </Link>
          </div>
          <ul className="flex flex-col p-1.5">
            {MENU.map((item) => (
              <li key={item.href} role="none">
                <Link
                  role="menuitem"
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  <item.icon className="size-4 text-primary" aria-hidden="true" />
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="border-t border-border p-1.5">
            <button
              type="button"
              role="menuitem"
              onClick={async () => {
                setOpen(false)
                await authClient.signOut()
                refresh()
              }}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
              <LogOut className="size-4" aria-hidden="true" />
              Çıkış yap
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function AccountArea() {
  const { member } = usePoints()
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
          href="#giris"
          data-tour="account"
          className="flex h-9 shrink-0 items-center whitespace-nowrap rounded-lg bg-primary px-3 text-xs font-bold uppercase tracking-wider text-primary-foreground transition-opacity hover:opacity-90 sm:hidden"
        >
          Giriş yap
        </a>
        <a
          href="#kayit"
          className="hidden h-9 shrink-0 items-center whitespace-nowrap rounded-lg bg-primary px-4 text-xs font-bold uppercase tracking-wider text-primary-foreground transition-opacity hover:opacity-90 sm:flex"
        >
          Kayıt ol
        </a>
      </>
    )
  }
  return <AccountMenu />
}

export function Topbar({ social, sponsors = [] }: { social: SocialLinks; sponsors?: SearchSponsor[] }) {
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-border bg-background/90 px-3 backdrop-blur-md sm:gap-3 sm:px-4 lg:px-6">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Menüyü aç"
          data-tour="menu-btn"
          className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border text-foreground lg:hidden"
        >
          <Menu className="size-5" aria-hidden="true" />
        </button>
        <a href="/" className="flex shrink-0 items-center lg:hidden max-[459px]:[&_.logo-text]:hidden">
          <BrandLogo size="sm" />
          <span className="sr-only">AL KANKA ana sayfa</span>
        </a>

        <SiteSearch sponsors={sponsors} />

        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
          <BadgeButton />
          <PointsPill />
          <RadioPlayer />
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
      <MobileDrawer open={open} onClose={close} social={social} />
    </>
  )
}
