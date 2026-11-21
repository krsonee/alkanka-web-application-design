'use client'

import { TrClock } from '@/components/panel/tr-clock'
import { useEffect, useRef, useState, useTransition } from 'react'
import { useUnsavedGuard, UnsavedBar } from '@/components/panel/unsaved-guard'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  Loader2,
  ChevronRight,
  LayoutDashboard,
  ExternalLink,
  Search,
  Globe,
  Handshake,
  Users,
  Gamepad2,
  Send,
  Wrench,
  Settings,
  Menu,
  X,
  Inbox,
  MessageSquare,
  type LucideIcon,
} from 'lucide-react'
import { askConfirm, PanelFeedbackHost } from '@/components/panel/confirm-dialog'
import { useActionPulse } from '@/components/panel/flash'
import { panelSearchAction, type SearchHit } from '@/app/panel/search-actions'
import { cn } from '@/lib/utils'
import { MERGED_ROWS, PANEL_GROUPS, PANEL_VIEWS, TELEGRAM_MODULES, foldedInto, type PanelModule, type PanelView } from '@/lib/panel-modules'

type PanelTab = PanelModule | PanelView | 'staff' | 'account' | 'audit' | 'dashboard' | 'moderation'

const HIT_LABEL: Record<SearchHit['kind'], string> = {
  setting: 'Ayar',
  member: 'Üye',
  sponsor: 'Sponsor',
  post: 'Yazı',
  task: 'Görev',
  product: 'Ürün',
  tournament: 'Turnuva',
  faq: 'SSS',
}

const FOUND_MARK = ['ring-2', 'ring-primary', 'ring-offset-2', 'ring-offset-background']

export function ContentEditor({
  slide,
  hero,
  logos,
  texts,
  games,
  tournaments,
  cember,
  push,
  messages,
  rewards,
  catalog,
  telegram,
  seo,
  studio,
  community,
  home,
  withdrawals,
  referral,
  badges,
  tasks,
  faqs,
  tour,
  market,
  pending = {},
  growth,
  marketing,
  social,
  sponsors,
  allowed,
  isOwner,
  branding,
  limits,
  staff,
  account,
  users,
  audit,
  dashboard,
  moderation = null,
  userName,
  siteUrl,
  logout,
  initialTab,
  dataGaps = 0,
}: {
  initialTab: string
  /** How many lists on this screen could not be read and are shown empty instead. */
  dataGaps?: number
  moderation?: React.ReactNode | null
  userName: string
  siteUrl: string
  logout: React.ReactNode
  dashboard: React.ReactNode
  users: React.ReactNode
  audit: React.ReactNode
  allowed: string[]
  isOwner: boolean
  branding: React.ReactNode
  limits: React.ReactNode
  staff: React.ReactNode
  account: React.ReactNode
  growth: React.ReactNode
  marketing: React.ReactNode
  social: React.ReactNode
  slide: React.ReactNode
  hero: React.ReactNode
  logos: React.ReactNode
  texts: React.ReactNode
  games: React.ReactNode
  tournaments: React.ReactNode
  cember: React.ReactNode
  push: React.ReactNode
  messages: React.ReactNode
  rewards: React.ReactNode
  catalog: React.ReactNode
  telegram: React.ReactNode
  seo: React.ReactNode
  studio: React.ReactNode
  community: React.ReactNode
  home: React.ReactNode
  withdrawals: React.ReactNode
  referral: React.ReactNode
  badges: React.ReactNode
  tasks: React.ReactNode
  faqs: React.ReactNode
  tour: React.ReactNode
  market: React.ReactNode
  pending?: Record<string, number>
  sponsors: React.ReactNode
}) {
  const can = (m: PanelModule) => allowed.includes(m)
  const groups: NavGroup[] = [
    ...PANEL_GROUPS.map((g) => ({
      id: g.id as string,
      label: g.label as string,
      items: g.modules.flatMap((m): NavItem[] => {
        // The three Telegram permissions open one shared section; what it shows inside depends on which ones the account holds.
        // A section folded into another screen has no row of its own for an account that can open both.
        const visible =
          m.id === 'telegram' ? TELEGRAM_MODULES.some((id) => allowed.includes(id)) : m.id !== 'roles' && !TELEGRAM_MODULES.includes(m.id) && allowed.includes(m.id) && !foldedInto(m.id, can)
        const merged = MERGED_ROWS[m.id]
        const own: NavItem = {
          id: m.id,
          pending: pending[m.id] ?? 0,
          hint: m.id === 'telegram' ? 'Postlar, botlar, koruma ve otomasyonlar' : (merged?.hint ?? m.hint),
          label: m.id === 'telegram' ? 'Telegram botları' : (merged?.label ?? m.label),
        }
        // A view sits right under the module it is listed after, whether or not the account can open that module.
        const views = PANEL_VIEWS.filter((v) => v.after === m.id && allowed.includes(v.needs) && !foldedInto(v.id, can)).map((v): NavItem => ({ id: v.id, label: v.label, hint: v.hint, pending: pending[v.id] ?? 0 }))
        return visible ? [own, ...views] : views
      }),
    })),
    {
      id: 'settings',
      label: 'Ayarlar',
      items: [
        ...(isOwner
          ? [
              { id: 'staff' as PanelTab, label: 'Personel & yetkiler', hint: 'Çalışan hesapları ve hangi bölüme girebilecekleri', pending: 0 },
              { id: 'audit' as PanelTab, label: 'İşlem logları', hint: 'Kim, ne zaman, ne yaptı', pending: 0 },
            ]
          : []),
        { id: 'account' as PanelTab, label: 'Hesabım & 2FA', hint: 'Şifre ve iki adımlı doğrulama', pending: 0 },
      ],
    },
  ].filter((g) => g.items.length > 0)
  const hasModeration = moderation !== null
  const tabs: PanelTab[] = ['dashboard', ...(hasModeration ? (['moderation'] as PanelTab[]) : []), ...groups.flatMap((g) => g.items.map((i) => i.id))]
  const [navOpen, setNavOpen] = useState(false)
  const router = useRouter()
  const [loading, startLoading] = useTransition()
  const [tab, setTab] = useState<PanelTab>(initialTab as PanelTab)
  const [filter, setFilter] = useState('')
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    if (!loading) {
      setSlow(false)
      return
    }
    const t = setTimeout(() => setSlow(true), 8000)
    return () => clearTimeout(t)
  }, [loading])
  useEffect(() => {
    // Old bookmarks used #section; move them to ?b=section so the server loads only that section.
    const legacy = window.location.hash.replace('#', '') as PanelTab
    if (legacy && tabs.includes(legacy) && legacy !== initialTab) {
      setTab(legacy)
      startLoading(() => router.replace(`/panel?b=${legacy}`, { scroll: false }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const q = filter.trim().toLocaleLowerCase('tr')
  const shown = groups
    .map((g) => ({
      ...g,
      items: q
        ? g.items.filter((i) => `${i.label} ${i.hint} ${g.label}`.toLocaleLowerCase('tr').includes(q))
        : g.items,
    }))
    .filter((g) => g.items.length > 0)
  const [hits, setHits] = useState<SearchHit[]>([])
  const [searching, setSearching] = useState(false)
  useEffect(() => {
    const term = filter.trim()
    if (term.length < 2) {
      setHits([])
      return
    }
    let cancelled = false
    setSearching(true)
    const t = setTimeout(async () => {
      const r = await panelSearchAction(term).catch(() => [])
      if (!cancelled) {
        setHits(r)
        setSearching(false)
      }
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [filter])
  const contentRef = useRef<HTMLDivElement>(null)
  const filterRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setNavOpen(true)
        requestAnimationFrame(() => filterRef.current?.focus())
      }
      if (e.key === 'Escape') setNavOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    // A search hit opens its section with `f`; bring that record into view and mark it for a moment.
    const find = new URLSearchParams(window.location.search).get('f')
    const el = find ? contentRef.current?.querySelector<HTMLElement>(`[data-find="${CSS.escape(find)}"]`) : null
    if (!el) return
    el.scrollIntoView({ block: 'center' })
    el.classList.add(...FOUND_MARK)
    const t = setTimeout(() => {
      el.classList.remove(...FOUND_MARK)
      const url = new URL(window.location.href)
      url.searchParams.delete('f')
      window.history.replaceState(window.history.state, '', url)
    }, 4000)
    return () => {
      clearTimeout(t)
      el.classList.remove(...FOUND_MARK)
    }
  }, [])
  const guard = useUnsavedGuard(contentRef)
  useActionPulse()
  const pick = async (id: PanelTab) => {
    setNavOpen(false)
    if (id === tab) return
    if (guard.count && !(await askConfirm('Kaydedilmemiş değişiklikler var. Kaydetmeden çıkılsın mı?'))) return
    guard.clear()
    setTab(id)
    window.scrollTo({ top: 0 })
    startLoading(() => router.push(id === 'dashboard' ? '/panel' : `/panel?b=${id}`, { scroll: false }))
  }
  const openHit = async (h: SearchHit) => {
    setFilter('')
    setNavOpen(false)
    if (guard.count && !(await askConfirm('Kaydedilmemiş değişiklikler var. Kaydetmeden çıkılsın mı?'))) return
    guard.clear()
    // The open section reads its tab and filters from the address only when it mounts, so a hit inside it needs a fresh load.
    if (h.tab === tab) {
      window.location.assign(h.href)
      return
    }
    setTab(h.tab as PanelTab)
    startLoading(() => router.push(h.href, { scroll: false }))
  }
  const moderationItem = { id: 'moderation' as PanelTab, label: 'Moderasyon kuyruğu', hint: 'Onay bekleyen kanıt, yorum, şikayet, görev ve market talepleri tek yerde', pending: 0 }
  const currentGroup = groups.find((g) => g.items.some((i) => i.id === tab))
  const current = tab === 'moderation' ? moderationItem : currentGroup?.items.find((i) => i.id === tab)
  const totalPending = pending.moderation ?? groups.reduce((n, g) => n + g.items.reduce((m, i) => m + i.pending, 0), 0)
  return (
    <div className="flex min-h-dvh bg-background lg:pl-72">
      <PanelFeedbackHost />
      {navOpen && (
        <button type="button" aria-label="Menüyü kapat" onClick={() => setNavOpen(false)} className="fixed inset-0 z-30 bg-foreground/40 lg:hidden" />
      )}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-72 max-w-[85vw] flex-col border-r border-border bg-card transition-transform lg:translate-x-0',
          navOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <button type="button" aria-label="Menüyü kapat" onClick={() => setNavOpen(false)} className="absolute right-2 top-3 flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary lg:hidden">
          <X className="size-4" aria-hidden="true" />
        </button>
        <div className="flex flex-col gap-0.5 border-b border-border px-4 py-4">
          <span className="font-display text-base font-bold uppercase tracking-tight text-foreground">AL KANKA panel</span>
          <span className="truncate text-xs text-muted-foreground">
            {userName}
            {isOwner ? ' · Ana yönetici' : ' · Personel'}
          </span>
        </div>
        <div className="px-3 pt-3">
          <label className="sr-only" htmlFor="panel-nav-filter">
            Bölüm ara
          </label>
          <div className="flex items-center gap-2 rounded-md border border-input bg-background px-2.5">
            <Search className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <input
              id="panel-nav-filter"
              ref={filterRef}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setFilter('')
                  e.currentTarget.blur()
                }
                if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229) {
                  const first = shown[0]?.items[0]
                  if (first) {
                    setFilter('')
                    pick(first.id as PanelTab)
                  } else if (hits[0]) {
                    openHit(hits[0])
                  }
                }
              }}
              placeholder="Bölüm, ayar, üye, kayıt ara"
              className="h-8 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
            <kbd className="hidden shrink-0 rounded border border-border px-1.5 text-xs text-muted-foreground lg:inline">Ctrl K</kbd>
          </div>
        </div>
        <nav aria-label="Panel bölümleri" className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-3 pb-20 pt-3">
          {!q && (
            <div className="flex flex-col gap-0.5">
              <NavButton active={tab === 'dashboard'} onClick={() => pick('dashboard')} label="Genel bakış" pending={0} icon={LayoutDashboard} />
              {hasModeration && <NavButton active={tab === 'moderation'} onClick={() => pick('moderation')} label="Moderasyon kuyruğu" pending={totalPending} icon={Inbox} />}
            </div>
          )}
          {shown.map((g) => {
            const Icon = GROUP_ICONS[g.id] ?? Wrench
            return (
              <div key={g.id} className="flex flex-col gap-0.5">
                <span className="flex items-center gap-2 px-2 pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <Icon className="size-3.5" aria-hidden="true" />
                  {g.label}
                </span>
                {g.items.map((i) => (
                  <NavButton key={i.id} active={tab === i.id} onClick={() => pick(i.id)} label={i.label} pending={i.pending} />
                ))}
              </div>
            )
          })}
          {q && shown.length === 0 && hits.length === 0 && !searching && <p className="px-2 text-sm text-muted-foreground">Sonuç bulunamadı.</p>}
          {q.length >= 2 && (hits.length > 0 || searching) && (
            <div className="flex flex-col gap-0.5" aria-live="polite">
              <span className="flex items-center gap-2 px-2 pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Search className="size-3.5" aria-hidden="true" />
                Ayarlar ve kayıtlar
              </span>
              {searching && hits.length === 0 && <p className="px-2 text-sm text-muted-foreground">Aranıyor...</p>}
              {hits.map((h) => (
                <button
                  key={`${h.kind}-${h.id}`}
                  type="button"
                  onClick={() => openHit(h)}
                  className="flex flex-col items-start rounded-md px-2 py-1.5 text-left hover:bg-secondary max-lg:min-h-9"
                >
                  <span className="flex w-full items-center gap-2 text-sm text-foreground">
                    <span className="truncate">{h.title}</span>
                    <span className="ml-auto shrink-0 rounded border border-border px-1.5 text-xs text-muted-foreground">{HIT_LABEL[h.kind]}</span>
                  </span>
                  {h.detail && <span className="w-full truncate text-xs text-muted-foreground">{h.detail}</span>}
                </button>
              ))}
            </div>
          )}
        </nav>
        <TrClock />
        <div className="flex items-center gap-2 border-t border-border p-3">
          <a
            href={siteUrl}
            target="_blank"
            rel="noopener"
            className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-border px-3 py-2 text-[13px] text-foreground hover:bg-secondary"
          >
            <ExternalLink className="size-3.5" aria-hidden="true" />
            Siteyi aç
          </a>
          {logout}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-background/95 px-4 backdrop-blur lg:gap-6 lg:px-8">
          <button type="button" aria-label="Menüyü aç" aria-expanded={navOpen} onClick={() => setNavOpen(true)} className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border text-foreground lg:hidden">
            <Menu className="size-4" aria-hidden="true" />
          </button>
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-center gap-1.5 text-[13px]">
              <span className="hidden text-muted-foreground sm:inline">{currentGroup?.label ?? 'Panel'}</span>
              <ChevronRight className="hidden size-3.5 text-muted-foreground sm:block" aria-hidden="true" />
              <h1 className="truncate font-semibold text-foreground">{current?.label ?? 'Genel bakış'}</h1>
            </div>
            {current?.hint && <p className="truncate text-xs text-muted-foreground">{current.hint}</p>}
          </div>
          {totalPending > 0 && tab !== 'moderation' && (
            <button
              type="button"
              onClick={() => pick(hasModeration ? 'moderation' : 'dashboard')}
              className="flex shrink-0 items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-secondary max-sm:min-h-9"
            >
              <MessageSquare className="size-3.5 sm:hidden" aria-hidden="true" />
              <span className="hidden sm:inline">Bekleyen iş</span>
              <span className="rounded-full bg-destructive px-1.5 text-xs font-bold tabular-nums text-destructive-foreground">{totalPending}</span>
            </button>
          )}
        </header>
        <UnsavedBar count={guard.count} onSave={guard.saveAll} onDiscard={guard.discardAll} />
        {dataGaps > 0 && !loading && (
          <div role="alert" className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-foreground lg:px-8">
            <AlertTriangle className="size-4 shrink-0 text-destructive" aria-hidden="true" />
            <span className="min-w-0 flex-1 text-pretty">
              {`Bu ekrandaki ${dataGaps} liste okunamadı ve boş gösteriliyor. Boş görünen bir liste "kayıt yok" anlamına gelmeyebilir; kaydetmeden önce sayfayı yenile.`}
            </span>
            <button type="button" onClick={() => window.location.reload()} className="h-8 shrink-0 rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground hover:bg-secondary">
              Yenile
            </button>
          </div>
        )}
        <div
          ref={contentRef}
          className={cn(
            'mx-auto w-full overflow-x-auto px-4 pb-24 pt-6 lg:px-8',
            tab === 'dashboard' ? 'max-w-none' : 'max-w-[1600px]',
            '[&_h2.font-display]:text-lg [&_h3.font-display]:text-base [&_.text-2xl]:text-xl',
          )}
        >
      {loading && tab !== 'account' ? (
        <div role="status" className="flex flex-col items-start gap-3 py-16 text-sm text-muted-foreground">
          <span className="flex items-center gap-2">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            {current?.label ?? 'Bölüm'} açılıyor...
          </span>
          {slow && (
            <span className="flex flex-wrap items-center gap-2">
              Beklenenden uzun sürüyor.
              <button
                type="button"
                onClick={() => window.location.assign(tab === 'dashboard' ? '/panel' : `/panel?b=${tab}`)}
                className="rounded-md border border-border px-3 py-1.5 text-foreground hover:bg-secondary"
              >
                Sayfayı yenile
              </button>
            </span>
          )}
        </div>
      ) : !tabs.includes(tab) ? (
        <p className="text-sm text-muted-foreground">Bu bölüme erişim yetkin yok.</p>
      ) : tab === 'moderation' ? (
        moderation
      ) : tab === 'staff' ? (
        staff
      ) : tab === 'dashboard' ? (
        <div className="flex flex-col gap-8">
          {dashboard}
          <SectionMap groups={groups} onPick={pick} />
        </div>
      ) : tab === 'audit' ? (
        audit
      ) : tab === 'users' ? (
        users
      ) : tab === 'account' ? (
        account
      ) : tab === 'branding' ? (
        branding
      ) : tab === 'limits' ? (
        limits
      ) : tab === 'growth' ? (
        growth
      ) : tab === 'marketing' ? (
        marketing
      ) : tab === 'social' ? (
        social
      ) : tab === 'games' ? (
        games
      ) : tab === 'tournaments' ? (
        tournaments
      ) : tab === 'cember' ? (
        cember
      ) : tab === 'push' ? (
        push
      ) : tab === 'messages' ? (
        messages
      ) : tab === 'rewards' ? (
        rewards
      ) : tab === 'catalog' ? (
        catalog
      ) : tab === 'telegram' ? (
        telegram
      ) : tab === 'seo' ? (
        seo
      ) : tab === 'community' ? (
        community
      ) : tab === 'home' ? (
        home
      ) : tab === 'withdrawals' ? (
        withdrawals
      ) : tab === 'referral' ? (
        referral
      ) : tab === 'badges' ? (
        badges
      ) : tab === 'tasks' ? (
        tasks
      ) : tab === 'faqs' ? (
        faqs
      ) : tab === 'tour' ? (
        tour
      ) : tab === 'market' ? (
        market
      ) : tab === 'studio' ? (
        studio
      ) : tab === 'texts' ? (
        texts
      ) : tab === 'sponsors' ? (
        sponsors
      ) : tab === 'logo' ? (
        logos
      ) : tab === 'slide' ? (
        slide
      ) : (
        hero
      )}
        </div>
      </div>
    </div>
  )
}

type NavItem = { id: PanelTab; label: string; hint: string; pending: number }
type NavGroup = { id: string; label: string; items: NavItem[] }

const GROUP_ICONS: Record<string, LucideIcon> = {
  site: Globe,
  sponsors: Handshake,
  members: Users,
  games: Gamepad2,
  telegram: Send,
  comms: MessageSquare,
  settings: Settings,
}

function NavButton({ active, onClick, label, pending, icon: Icon }: { active: boolean; onClick: () => void; label: string; pending: number; icon?: LucideIcon }) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] font-medium transition-colors max-lg:min-h-9',
        active ? 'bg-primary text-primary-foreground' : 'text-foreground/80 hover:bg-secondary hover:text-foreground',
      )}
    >
      {Icon && <Icon className="size-4 shrink-0" aria-hidden="true" />}
      <span className="min-w-0 flex-1 text-pretty leading-snug">
        {label}
      </span>
      {pending > 0 && (
        <span
          className={cn(
            'shrink-0 rounded-full px-1.5 text-xs font-bold tabular-nums',
            active ? 'bg-primary-foreground text-primary' : 'bg-destructive text-destructive-foreground',
          )}
        >
          {pending > 99 ? '99+' : pending}
          <span className="sr-only"> bekleyen</span>
        </span>
      )}
    </button>
  )
}

function SectionMap({ groups, onPick }: { groups: NavGroup[]; onPick: (id: PanelTab) => void }) {
  return (
    <details className="group flex flex-col rounded-lg border border-border bg-card">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 hover:bg-secondary [&::-webkit-details-marker]:hidden">
        <span className="flex flex-col gap-0.5">
          <span className="text-sm font-semibold text-foreground">Bölüm rehberi</span>
          <span className="text-xs text-muted-foreground">Hangi bölüm ne işe yarar? Yeni personel için açıklamalı liste.</span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" aria-hidden="true" />
      </summary>
      <div className="grid grid-cols-1 gap-4 border-t border-border p-4 sm:grid-cols-2 xl:grid-cols-4">
        {groups.map((g) => {
          const Icon = GROUP_ICONS[g.id] ?? Wrench
          return (
            <div key={g.id} className="flex flex-col rounded-lg border border-border bg-card">
              <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
                <Icon className="size-4 text-primary" aria-hidden="true" />
                <h3 className="text-[13px] font-semibold uppercase tracking-wider text-foreground">{g.label}</h3>
              </div>
              <ul className="flex flex-col p-1.5">
                {g.items.map((i) => (
                  <li key={i.id}>
                    <button onClick={() => onPick(i.id)} className="flex w-full items-start gap-2 rounded-md px-2.5 py-2 text-left hover:bg-secondary">
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-[13px] font-medium text-foreground">{i.label}</span>
                        <span className="text-xs leading-relaxed text-muted-foreground">{i.hint}</span>
                      </span>
                      {i.pending > 0 && (
                        <span className="mt-0.5 shrink-0 rounded-full bg-destructive px-1.5 text-xs font-bold tabular-nums text-destructive-foreground">{i.pending}</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
    </details>
  )
}
