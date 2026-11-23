'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import { Award, ChevronDown, Coins, History, Link2, LogOut, Mail, MessageSquareText, Palette, Search, Send, Settings, UserRound } from 'lucide-react'
import { ChatButton } from './telegram-bubble'
import { getInboxStatus, type InboxStatus } from '@/app/actions/inbox'
import { getLookSummary, type LookSummary } from '@/app/actions/look'
import { AvatarFace } from './member-avatar'
import { cn } from '@/lib/utils'
import { authClient } from '@/lib/auth-client'
import { BrandLogo } from './logo-selector'
import { MobileDrawer } from './sidebar'
import { formatAC, usePoints } from './points-context'
import { MemberRank } from './kp/member-rank'
import { SiteSearch, type SearchSponsor } from './site-search'
import { RadioPlayer } from './radio-player'
import { CemberButton } from './cember/cember-pill'
import type { SocialLinks } from '@/lib/social-shared'
import type { TelegramLinks } from './data'

function PointsPill() {
  const { points, lastGain, member } = usePoints()
  if (!member) return null
  return (
    <div
      data-tour="coins"
      title="Kanka Coin bakiyen"
      className="relative flex h-9 shrink-0 items-center gap-1 rounded-lg border border-primary/30 bg-primary/10 px-2 max-lg:order-1 max-lg:h-10 max-lg:gap-1.5 max-lg:rounded-full max-lg:border-transparent max-lg:bg-foreground/[0.08] max-lg:px-3 sm:gap-1.5 lg:px-2.5"
    >
      <Coins className="size-3.5 text-primary max-lg:size-4" aria-hidden="true" />
      <span className="sr-only">Kanka Coin bakiyesi:</span>
      <span className="font-display text-xs font-bold text-foreground tabular-nums max-lg:text-sm" aria-live="polite">
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
      className="animate-badge-pulse relative hidden h-9 shrink-0 items-center gap-1 overflow-hidden rounded-lg border border-primary/40 bg-primary/[0.08] px-2 transition-colors hover:border-primary sm:flex"
    >
      <span className="tier-shine pointer-events-none absolute inset-0" aria-hidden="true" />
      <MemberRank userId={member.id} className="relative" />
      <span className="sr-only">Rozetlerim</span>
    </Link>
  )
}

const MENU = [
  { href: '/profil', label: 'Profilim', icon: UserRound },
  { href: '/profil?sekme=gorunum', label: 'Avatar & görünüm', icon: Palette },
  { href: '/profil?sekme=rozetler', label: 'Rozetlerim', icon: Award },
  { href: '/profil?sekme=hesaplar', label: 'Bağlı hesaplar', icon: Link2 },
  { href: '/profil?sekme=ayarlar', label: 'Hesap ayarları', icon: Settings },
  { href: '/profil?sekme=yorumlar', label: 'Yorumlarım', icon: MessageSquareText },
  { href: '/oyunlar/gecmis', label: 'Oyun geçmişi', icon: History },
] as const

function AccountMenu() {
  const { member, points, refresh } = usePoints()
  const router = useRouter()
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
  const { data: look } = useSWR<LookSummary | null>(member ? 'look-summary' : null, () => getLookSummary(), {
    revalidateOnFocus: false,
  })
  const unread = inbox?.unread ?? 0
  const unreadLabel = unread > 9 ? '9+' : String(unread)

  if (!member) return null
  return (
    <div ref={ref} data-tour="account" className="relative max-lg:order-2">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="hesap-menu"
        aria-label={unread ? `Hesap menüsü, ${unread} okunmamış mesaj` : undefined}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex h-9 items-center gap-2 rounded-lg border px-1.5 text-xs font-bold text-foreground transition-colors max-sm:size-10 max-sm:justify-center max-sm:rounded-full max-sm:border-transparent max-sm:bg-foreground/[0.08] max-sm:px-0 sm:px-3',
          open ? 'border-primary/60 bg-primary/10' : 'border-border hover:border-primary/50',
        )}
      >
        <span className="relative flex shrink-0">
          <AvatarFace src={look?.avatar} name={member.name} size="sm" />
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
          <div className="flex flex-col gap-2.5 border-b border-border bg-primary/[0.06] px-4 py-3">
            <div className="flex items-center gap-3">
              <Link href="/profil?sekme=gorunum" onClick={() => setOpen(false)} aria-label="Avatarını değiştir" className="rounded-full ring-2 ring-gold/60 ring-offset-2 ring-offset-popover">
                <AvatarFace src={look?.avatar} name={member.name} size="md" />
              </Link>
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-bold text-foreground">{member.name}</span>
                <span className="text-xs tabular-nums text-muted-foreground">{points.toLocaleString('tr-TR')} KC bakiye</span>
              </span>
            </div>
            {look && (
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-[11px] font-semibold">
                  <span className="text-gold">Seviye {look.level} · {look.levelName}</span>
                  <span className="tabular-nums text-muted-foreground">{look.kp.toLocaleString('tr-TR')} KP</span>
                </div>
                <div
                  role="progressbar"
                  aria-label={look.nextName ? `${look.nextName} seviyesine ilerleme` : 'En yüksek seviye'}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(look.progress)}
                  className="h-1.5 overflow-hidden rounded-full bg-secondary"
                >
                  <div className="h-full rounded-full bg-gold" style={{ width: `${Math.min(100, Math.max(2, look.progress))}%` }} />
                </div>
                {!look.avatar && (
                  <Link href="/profil?sekme=gorunum" onClick={() => setOpen(false)} className="text-[11px] font-bold text-gold hover:underline">
                    Avatarını seç, hoş geldin ödülünü al
                  </Link>
                )}
              </div>
            )}
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
                router.refresh()
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
  const { member, known } = usePoints()
  if (!member) {
    // Guest or member is not decided yet: hold the space instead of flashing "Giriş yap" at a member.
    if (!known) return <span aria-hidden="true" className="h-9 w-24 shrink-0 animate-pulse rounded-lg bg-secondary max-lg:order-2 max-sm:h-10 max-sm:rounded-xl sm:w-40" />
    return (
      <>
        <a
          href="#giris"
          className="hidden h-9 items-center rounded-lg border border-primary/50 px-4 text-xs font-bold uppercase tracking-wider text-primary transition-colors hover:bg-primary/10 max-lg:order-2 sm:flex"
        >
          Giriş
        </a>
        <a
          href="#giris"
          data-tour="account"
          className="order-2 flex h-10 shrink-0 items-center whitespace-nowrap rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-[opacity,scale] duration-150 hover:opacity-90 active:scale-[0.96] sm:hidden"
        >
          Giriş yap
        </a>
        <a
          href="#kayit"
          className="hidden h-9 shrink-0 items-center whitespace-nowrap rounded-lg bg-primary px-4 text-xs font-bold uppercase tracking-wider text-primary-foreground transition-opacity hover:opacity-90 max-lg:order-2 sm:flex"
        >
          Kayıt ol
        </a>
      </>
    )
  }
  return <AccountMenu />
}

export const OPEN_MENU_EVENT = 'alkanka:open-menu'

export function Topbar({
  social,
  sponsors = [],
  telegram,
  chat = false,
}: {
  social: SocialLinks
  sponsors?: SearchSponsor[]
  telegram: TelegramLinks
  /** Site chat is switched on: phones and tablets get its button in the bar. */
  chat?: boolean
}) {
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  const { member } = usePoints()

  useEffect(() => {
    const openMenu = () => setOpen(true)
    window.addEventListener(OPEN_MENU_EVENT, openMenu)
    return () => window.removeEventListener(OPEN_MENU_EVENT, openMenu)
  }, [])

  return (
    <>
      {/* On phones the bar stays on screen while the page scrolls (not on a game page, where the table needs the room).
          Its blur also makes it the anchor for the radio and Çember panels, so they open under the bar wherever it sits. */}
      <header
        data-member={member ? '' : undefined}
        className="relative z-[45] flex h-14 items-center gap-2 px-3 max-lg:sticky max-lg:top-0 max-lg:overflow-x-clip max-lg:bg-background/80 max-lg:backdrop-blur-xl max-lg:[body:has([data-game-page])_&]:relative sm:gap-3 sm:px-4 lg:h-16 lg:border-b lg:border-border lg:bg-background lg:px-6"
      >
        <a
          href="/"
          className="flex shrink-0 items-center lg:hidden max-[339px]:[&_.logo-text]:hidden max-[379px]:[header[data-member]_&_.logo-text]:hidden max-[379px]:[header:has([data-header-extra])_&_.logo-text]:hidden max-[439px]:[header[data-member]:has([data-header-extra])_&_.logo-text]:hidden"
        >
          <BrandLogo size="sm" />
          <span className="sr-only">AL KANKA ana sayfa</span>
        </a>

        <SiteSearch sponsors={sponsors} />

        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
          {chat && <ChatButton />}
          <BadgeButton />
          <PointsPill />
          <CemberButton />
          <RadioPlayer />
          <a
            href={telegram.duyuru}
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
      <MobileDrawer open={open} onClose={close} social={social} telegram={telegram} />
    </>
  )
}
