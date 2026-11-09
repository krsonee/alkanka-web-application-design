'use client'

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import useSWR from 'swr'
import { ChevronDown, ChevronsLeft, ChevronsRight, Coins, Megaphone, MessagesSquare, Percent, Send, Ticket, X, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { NAV_SECTIONS, TELEGRAM_URL, type NavGroup, type NavItem, type TelegramLinks } from './data'
import { JakoAvatar } from './jako'
import { BrandLogo } from './logo-selector'
import { TourButton } from './app/site-tour'
import { useChatFeed } from './use-chat-feed'
import { SocialIcon, PLATFORM_TINT } from './social-icons'
import { AvatarFace } from './member-avatar'
import { formatAC, usePoints } from './points-context'
import { getNavSignals, type NavSignals } from '@/app/actions/nav'
import { getLookSummary, type LookSummary } from '@/app/actions/look'
import { DEFAULT_SOCIAL_LINKS, PLATFORM_LABEL, SOCIAL_PLATFORMS, type SocialLinks } from '@/lib/social-shared'

const isActiveHref = (pathname: string, href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href))

const COLLAPSE_KEY = 'alkanka:sidebar'
const COLLAPSE_EVENT = 'alkanka:sidebar-change'

function readCollapsed() {
  return typeof document !== 'undefined' && document.documentElement.dataset.sidebar === 'collapsed'
}

/** Desktop rail width preference; mirrored on <html data-sidebar> so the layout padding follows via CSS. */
function useCollapsed() {
  const collapsed = useSyncExternalStore(
    (cb) => {
      window.addEventListener(COLLAPSE_EVENT, cb)
      return () => window.removeEventListener(COLLAPSE_EVENT, cb)
    },
    readCollapsed,
    () => false,
  )
  const toggle = useCallback(() => {
    const next = !readCollapsed()
    document.documentElement.dataset.sidebar = next ? 'collapsed' : 'open'
    try {
      localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0')
    } catch {}
    window.dispatchEvent(new Event(COLLAPSE_EVENT))
  }, [])
  useEffect(() => {
    try {
      if (localStorage.getItem(COLLAPSE_KEY) === '1' && !readCollapsed()) {
        document.documentElement.dataset.sidebar = 'collapsed'
        window.dispatchEvent(new Event(COLLAPSE_EVENT))
      }
    } catch {}
  }, [])
  return [collapsed, toggle] as const
}

export function useNavSignals() {
  const { member } = usePoints()
  const { data } = useSWR<NavSignals>(['nav-signals', member?.id ?? 'guest'], () => getNavSignals(), {
    refreshInterval: 90_000,
    revalidateOnFocus: true,
  })
  return data ?? { openTasks: 0, tvLive: false }
}

function ItemBadge({ item, signals, compact }: { item: NavItem; signals: NavSignals; compact?: boolean }) {
  if (item.signal === 'live') {
    if (!signals.tvLive) return null
    return compact ? (
      <span aria-label="Canlı yayın var" className="absolute right-1.5 top-1.5 size-2 animate-pulse rounded-full bg-destructive" />
    ) : (
      <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-destructive">
        <span aria-hidden="true" className="size-1.5 animate-pulse rounded-full bg-destructive" />
        Canlı
      </span>
    )
  }
  if (item.signal === 'tasks') {
    if (!signals.openTasks) return null
    const n = signals.openTasks > 9 ? '9+' : String(signals.openTasks)
    return (
      <span
        aria-label={`${signals.openTasks} açık görev`}
        className={cn(
          'flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold leading-5 text-primary-foreground',
          compact && 'absolute -right-0.5 -top-0.5 min-w-4 px-1 leading-4',
        )}
      >
        {n}
      </span>
    )
  }
  if (!compact && item.newUntil && Date.now() < Date.parse(item.newUntil)) {
    return <span className="rounded bg-live/15 px-1.5 py-0.5 text-[10px] font-semibold text-live">Yeni</span>
  }
  return null
}

type NavCtx = { pathname: string; onNavigate?: () => void; signals: NavSignals; compact: boolean }

function NavLink({ item, ctx, nested }: { item: NavItem; ctx: NavCtx; nested?: boolean }) {
  const isActive = isActiveHref(ctx.pathname, item.href)
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      onClick={ctx.onNavigate}
      data-tour-nav={item.id}
      aria-current={isActive ? 'page' : undefined}
      title={ctx.compact ? item.label : undefined}
      className={cn(
        'group relative flex items-center rounded-lg text-sm font-medium transition-colors',
        ctx.compact ? 'size-10 justify-center self-center' : nested ? 'gap-3 px-2.5 py-2' : 'gap-3 px-3 py-2',
        isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
      )}
    >
      {isActive && !ctx.compact && <span aria-hidden="true" className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-primary" />}
      <Icon className={cn('shrink-0', ctx.compact ? 'size-5' : 'size-4')} aria-hidden="true" />
      {ctx.compact ? <span className="sr-only">{item.label}</span> : <span className="flex-1 truncate">{item.label}</span>}
      <ItemBadge item={item} signals={ctx.signals} compact={ctx.compact} />
    </Link>
  )
}

function NavGroupBlock({ group, ctx }: { group: NavGroup; ctx: NavCtx }) {
  const hasActive = group.items.some((i) => isActiveHref(ctx.pathname, i.href))
  const [open, setOpen] = useState(hasActive)
  const Icon = group.icon
  const panelId = `nav-${group.id}`

  if (ctx.compact) {
    return (
      <>
        {group.items.map((item) => (
          <NavLink key={item.id} item={item} ctx={ctx} />
        ))}
      </>
    )
  }

  const openTasks = ctx.signals.openTasks
  return (
    <div className={cn('rounded-xl border transition-colors', hasActive ? 'border-primary/25 bg-primary/[0.04]' : 'border-border bg-card/40')}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        data-tour-nav="gorev-merkezi"
        className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left"
      >
        <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
          <Icon className="size-3.5" aria-hidden="true" />
        </span>
        <span className="flex-1 truncate text-sm font-bold text-foreground">{group.label}</span>
        {!open && openTasks > 0 && (
          <span className="flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold leading-5 text-primary-foreground">
            {openTasks > 9 ? '9+' : openTasks}
          </span>
        )}
        <ChevronDown className={cn('size-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} aria-hidden="true" />
      </button>
      {open && (
        <div id={panelId} className="px-1.5 pb-1.5">
          <div className="ml-3 flex flex-col gap-0.5 border-l border-border pl-1.5">
            {group.items.map((item) => (
              <NavLink key={item.id} item={item} ctx={ctx} nested />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function NavSections({ ctx, onTour }: { ctx: NavCtx; onTour?: () => void }) {
  return (
    <nav aria-label="Ana menü" className="flex flex-col gap-4">
      {NAV_SECTIONS.map((section) => (
        <div key={section.id} className={cn('flex flex-col gap-0.5', ctx.compact && 'items-center border-t border-border pt-3 first:border-t-0 first:pt-0')}>
          {ctx.compact ? (
            <span className="sr-only">{section.title}</span>
          ) : (
            <span className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">{section.title}</span>
          )}
          {section.entries.map((entry) =>
            'kind' in entry && entry.kind === 'group' ? (
              <NavGroupBlock key={entry.id} group={entry} ctx={ctx} />
            ) : (
              <NavLink key={entry.id} item={entry as NavItem} ctx={ctx} />
            ),
          )}
          {section.id === 'destek' && !ctx.compact && <TourButton className="w-full" onStart={onTour} />}
        </div>
      ))}
    </nav>
  )
}

function MemberCard({ onNavigate, compact }: { onNavigate?: () => void; compact: boolean }) {
  const { member, points } = usePoints()
  const { data: look } = useSWR<LookSummary | null>(member ? 'look-summary' : null, () => getLookSummary(), {
    revalidateOnFocus: false,
  })

  if (!member) {
    if (compact) return null
    return (
      <div className="flex flex-col gap-2 rounded-xl border border-primary/25 bg-primary/[0.06] p-3">
        <p className="text-pretty text-xs leading-relaxed text-muted-foreground">
          Üye ol, oyun oyna, görev yap. <span className="font-semibold text-foreground">Kanka Coin</span> topla.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <a href="#giris" onClick={onNavigate} className="flex h-9 items-center justify-center rounded-lg border border-primary/50 text-xs font-bold text-primary transition-colors hover:bg-primary/10">
            Giriş yap
          </a>
          <a href="#kayit" onClick={onNavigate} className="flex h-9 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground transition-opacity hover:opacity-90">
            Kayıt ol
          </a>
        </div>
      </div>
    )
  }

  if (compact) {
    return (
      <Link href="/profil" title={member.name} className="self-center rounded-full ring-2 ring-primary/50 ring-offset-2 ring-offset-surface">
        <AvatarFace src={look?.avatar} name={member.name} size="sm" />
        <span className="sr-only">Profilim</span>
      </Link>
    )
  }

  const progress = Math.min(100, Math.max(0, Math.round(look?.progress ?? 0)))
  return (
    <Link
      href="/profil"
      onClick={onNavigate}
      className="flex items-center gap-3 rounded-xl border border-border bg-card/60 p-3 transition-colors hover:border-primary/40"
    >
      <span className="rounded-full ring-2 ring-primary/50 ring-offset-2 ring-offset-card">
        <AvatarFace src={look?.avatar} name={member.name} size="md" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-bold text-foreground">{member.name}</span>
          <span className="flex shrink-0 items-center gap-1 text-xs font-bold text-primary">
            <Coins className="size-3.5" aria-hidden="true" />
            {formatAC(points)}
          </span>
        </span>
        <span className="truncate text-[11px] font-medium text-muted-foreground">
          {look ? `Seviye ${look.level} · ${look.levelName}` : 'Profilim'}
        </span>
        <span
          role="progressbar"
          aria-label="Seviye ilerlemesi"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          className="h-1.5 overflow-hidden rounded-full bg-secondary"
        >
          <span className="block h-full rounded-full bg-primary transition-[width]" style={{ width: `${progress}%` }} />
        </span>
      </span>
    </Link>
  )
}

function SocialIcons({ links, compact }: { links: SocialLinks; compact: boolean }) {
  return (
    <nav aria-label="AL KANKA sosyal medya hesapları" className="flex flex-col gap-2">
      {!compact && <span className="px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">Bizi takip et</span>}
      <ul className={cn('flex gap-2', compact ? 'flex-col items-center' : 'justify-between')}>
        {SOCIAL_PLATFORMS.map((p) => (
          <li key={p} className={compact ? undefined : 'flex-1'}>
            <a
              href={links[p] || DEFAULT_SOCIAL_LINKS[p]}
              target="_blank"
              rel="noopener noreferrer"
              title={PLATFORM_LABEL[p]}
              aria-label={`AL KANKA ${PLATFORM_LABEL[p]} hesabını takip et`}
              className={cn(
                'flex h-10 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors',
                compact ? 'w-10' : 'w-full',
                PLATFORM_TINT[p],
              )}
            >
              <SocialIcon platform={p} className="size-4" />
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}

const TG_CHANNELS: { key: keyof TelegramLinks; label: string; icon: LucideIcon }[] = [
  { key: 'duyuru', label: 'Duyuru', icon: Megaphone },
  { key: 'sohbet', label: 'Sohbet', icon: MessagesSquare },
  { key: 'ozelOran', label: 'Özel oran', icon: Percent },
  { key: 'promo', label: 'Promo kod', icon: Ticket },
]

function TelegramChannels({ links, compact }: { links: TelegramLinks; compact: boolean }) {
  return (
    <nav aria-label="AL KANKA Telegram kanalları" className="flex flex-col gap-2">
      {!compact && (
        <span className="flex items-center gap-1.5 px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
          <Send className="size-3 text-accent" aria-hidden="true" />
          Telegram kanallarımız
        </span>
      )}
      <ul className={cn(compact ? 'flex flex-col items-center gap-2' : 'grid grid-cols-2 gap-2')}>
        {TG_CHANNELS.map(({ key, label, icon: Icon }) => (
          <li key={key}>
            <a
              href={links[key]}
              target="_blank"
              rel="noopener noreferrer"
              title={compact ? `Telegram · ${label}` : undefined}
              aria-label={`Telegram ${label} kanalına git`}
              className={cn(
                'flex h-10 items-center rounded-lg border border-accent/25 bg-accent/[0.07] text-foreground transition-colors hover:border-accent/60 hover:bg-accent/15',
                compact ? 'w-10 justify-center' : 'gap-2 px-2.5',
              )}
            >
              <Icon className="size-4 shrink-0 text-accent" aria-hidden="true" />
              {!compact && <span className="truncate text-xs font-semibold">{label}</span>}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}

function TelegramCard({ compact }: { compact: boolean }) {
  const { data } = useChatFeed()
  const subtitle =
    data?.configured && data.members != null ? `${data.members.toLocaleString('tr-TR')} üye · canlı sohbet` : 'Topluluğa katıl, sohbete gel'
  return (
    <a
      href={data?.inviteUrl ?? TELEGRAM_URL}
      data-tour="telegram"
      target="_blank"
      rel="noopener noreferrer"
      title={compact ? 'Jako Telegram’da!' : undefined}
      className={cn(
        'flex items-center rounded-xl border border-accent/30 bg-accent/10 transition-colors hover:bg-accent/15',
        compact ? 'justify-center p-1.5' : 'gap-3 p-3',
      )}
    >
      <JakoAvatar pose="telegram" size="sm" />
      {compact ? (
        <span className="sr-only">Jako Telegram’da!</span>
      ) : (
        <>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-sm font-semibold text-foreground">Jako Telegram’da!</span>
            <span className="truncate text-xs text-muted-foreground">{subtitle}</span>
          </span>
          <Send className="size-4 shrink-0 text-accent" aria-hidden="true" />
        </>
      )}
    </a>
  )
}

type BodyProps = { onNavigate?: () => void; social: SocialLinks; telegram: TelegramLinks; compact?: boolean }

function SidebarBody({ onNavigate, social, telegram, compact = false }: BodyProps) {
  const pathname = usePathname()
  const signals = useNavSignals()
  const ctx: NavCtx = { pathname, onNavigate, signals, compact }
  return (
    <>
      <div className={cn('flex flex-1 flex-col gap-5 overflow-y-auto py-4 no-scrollbar', compact ? 'px-2' : 'px-3')}>
        <MemberCard onNavigate={onNavigate} compact={compact} />
        <NavSections ctx={ctx} onTour={onNavigate} />
        <div className="flex flex-col gap-4 border-t border-border pt-4">
          <SocialIcons links={social} compact={compact} />
          <TelegramChannels links={telegram} compact={compact} />
        </div>
      </div>
      <div className={cn('border-t border-border pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3', compact ? 'px-2' : 'px-3')}>
        <TelegramCard compact={compact} />
      </div>
    </>
  )
}

export function Sidebar({ social, telegram }: { social: SocialLinks; telegram: TelegramLinks }) {
  const [collapsed, toggle] = useCollapsed()
  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-border bg-surface transition-[width] duration-200 lg:flex',
        collapsed ? 'w-[72px]' : 'w-64',
      )}
    >
      <div className={cn('flex h-16 shrink-0 items-center border-b border-border', collapsed ? 'justify-center px-2' : 'justify-between pl-5 pr-2')}>
        {!collapsed && (
          <Link href="/" className="flex min-w-0 items-center">
            <BrandLogo size="sm" />
            <span className="sr-only">AL KANKA ana sayfa</span>
          </Link>
        )}
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? 'Menüyü genişlet' : 'Menüyü daralt'}
          title={collapsed ? 'Menüyü genişlet' : 'Menüyü daralt'}
          className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          {collapsed ? <ChevronsRight className="size-4" aria-hidden="true" /> : <ChevronsLeft className="size-4" aria-hidden="true" />}
        </button>
      </div>
      <SidebarBody social={social} telegram={telegram} compact={collapsed} />
    </aside>
  )
}

export function MobileDrawer({
  open,
  onClose,
  social,
  telegram,
}: {
  open: boolean
  onClose: () => void
  social: SocialLinks
  telegram: TelegramLinks
}) {
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
          'absolute inset-y-0 left-0 flex w-80 max-w-[86vw] flex-col border-r border-border bg-surface transition-transform duration-300',
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
        {open && <SidebarBody onNavigate={onClose} social={social} telegram={telegram} />}
      </aside>
    </div>
  )
}
