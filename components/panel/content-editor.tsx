'use client'

import { useActionState, useEffect, useRef, useState, useTransition } from 'react'
import { useUnsavedGuard, UnsavedBar } from '@/components/panel/unsaved-guard'
import { formatLocal, scheduleState } from '@/lib/schedule'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import {
  Loader2,
  ChevronRight,
  LayoutDashboard,
  ExternalLink,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  Search,
  Globe,
  Handshake,
  Users,
  Gamepad2,
  Send,
  Wrench,
  Settings,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { addSlide, duplicateSlide, moveSlide, resetHero, resetSlide, saveHero, saveSlide, type ActionState } from '@/app/panel/actions'
import { ArrowDown, ArrowUp, Copy, Eye, MousePointerClick, CalendarClock } from 'lucide-react'
import { ImageField } from '@/components/panel/image-field'
import { JAKO_POSES } from '@/lib/site-registry'
import { PANEL_GROUPS, type PanelModule } from '@/lib/panel-modules'
import { HideButton } from '@/components/panel/hide-button'

type Fields = {
  eyebrow?: string
  title?: string
  description?: string
  cta?: string
  speech?: string
  image?: string
  pose?: string
  href?: string
  startAt?: string
  endAt?: string
}

type PanelTab = PanelModule | 'staff' | 'account' | 'audit' | 'dashboard'

export type EditorItem = {
  kind: 'slide' | 'hero'
  id: string
  label: string
  path: string
  defaults: Fields
  saved: Fields | null
  hidden?: boolean
  custom?: boolean
  stats?: { views: number; clicks: number }
}

export function ContentEditor({
  slides,
  heroes,
  library,
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
  badges,
  tasks,
  faqs,
  tour,
  market,
  pending = {},
  growth,
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
  userName,
  siteUrl,
  logout,
  initialTab,
}: {
  initialTab: string
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
  social: React.ReactNode
  slides: EditorItem[]
  heroes: EditorItem[]
  library: string[]
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
  badges: React.ReactNode
  tasks: React.ReactNode
  faqs: React.ReactNode
  tour: React.ReactNode
  market: React.ReactNode
  pending?: Record<string, number>
  sponsors: React.ReactNode
}) {
  const groups: NavGroup[] = [
    ...PANEL_GROUPS.map((g) => ({
      id: g.id as string,
      label: g.label as string,
      items: g.modules
        .filter((m) => m.id !== 'roles' && allowed.includes(m.id))
        .map((m) => ({
          id: m.id as PanelTab,
          pending: pending[m.id] ?? 0,
          hint: m.hint as string,
          label:
            m.id === 'slide'
                ? `Slider (${slides.length})`
                : m.id === 'hero'
                  ? `Sayfa başlıkları (${heroes.length})`
                  : (m.label as string),
        })),
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
  const tabs: PanelTab[] = ['dashboard', ...groups.flatMap((g) => g.items.map((i) => i.id))]
  const router = useRouter()
  const [loading, startLoading] = useTransition()
  const [tab, setTab] = useState<PanelTab>(initialTab as PanelTab)
  const [filter, setFilter] = useState('')
  useEffect(() => {
    // Old bookmarks used #section; move them to ?b=section so the server loads only that section.
    const legacy = window.location.hash.replace('#', '') as PanelTab
    if (legacy && tabs.includes(legacy) && legacy !== initialTab) {
      setTab(legacy)
      startLoading(() => router.replace(`/panel?b=${legacy}`, { scroll: false }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const items = tab === 'slide' ? slides : heroes
  const q = filter.trim().toLocaleLowerCase('tr')
  const shown = groups
    .map((g) => ({
      ...g,
      items: q
        ? g.items.filter((i) => `${i.label} ${i.hint} ${g.label}`.toLocaleLowerCase('tr').includes(q))
        : g.items,
    }))
    .filter((g) => g.items.length > 0)
  const contentRef = useRef<HTMLDivElement>(null)
  const guard = useUnsavedGuard(contentRef)
  const pick = (id: PanelTab) => {
    if (id === tab) return
    if (guard.count && !confirm('Kaydedilmemiş değişiklikler var. Kaydetmeden çıkılsın mı?')) return
    guard.clear()
    setTab(id)
    window.scrollTo({ top: 0 })
    startLoading(() => router.push(id === 'dashboard' ? '/panel' : `/panel?b=${id}`, { scroll: false }))
  }
  const currentGroup = groups.find((g) => g.items.some((i) => i.id === tab))
  const current = currentGroup?.items.find((i) => i.id === tab)
  const totalPending = groups.reduce((n, g) => n + g.items.reduce((m, i) => m + i.pending, 0), 0)
  return (
    <div className="flex min-h-dvh min-w-[1024px] bg-background pl-72">
      <aside className="fixed inset-y-0 left-0 z-30 flex w-72 flex-col border-r border-border bg-card">
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
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Bölüm ara (ör. ban, logo, bot)"
              className="h-8 w-full bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>
        </div>
        <nav aria-label="Panel bölümleri" className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-3 pb-20 pt-3">
          {!q && (
            <NavButton active={tab === 'dashboard'} onClick={() => pick('dashboard')} label="Genel bakış" pending={totalPending} icon={LayoutDashboard} />
          )}
          {shown.map((g) => {
            const Icon = GROUP_ICONS[g.id] ?? Wrench
            return (
              <div key={g.id} className="flex flex-col gap-0.5">
                <span className="flex items-center gap-2 px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <Icon className="size-3.5" aria-hidden="true" />
                  {g.label}
                </span>
                {g.items.map((i) => (
                  <NavButton key={i.id} active={tab === i.id} onClick={() => pick(i.id)} label={i.label} pending={i.pending} />
                ))}
              </div>
            )
          })}
          {shown.length === 0 && <p className="px-2 text-sm text-muted-foreground">Bölüm bulunamadı.</p>}
        </nav>
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
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between gap-6 border-b border-border bg-background/95 px-8 backdrop-blur">
          <div className="flex min-w-0 flex-col">
            <div className="flex items-center gap-1.5 text-[13px]">
              <span className="text-muted-foreground">{currentGroup?.label ?? 'Panel'}</span>
              <ChevronRight className="size-3.5 text-muted-foreground" aria-hidden="true" />
              <h1 className="truncate font-semibold text-foreground">{current?.label ?? 'Genel bakış'}</h1>
            </div>
            {current?.hint && <p className="truncate text-xs text-muted-foreground">{current.hint}</p>}
          </div>
          {totalPending > 0 && tab !== 'dashboard' && (
            <button
              onClick={() => pick('dashboard')}
              className="flex shrink-0 items-center gap-2 rounded-md border border-border px-3 py-1.5 text-[13px] text-foreground hover:bg-secondary"
            >
              Bekleyen iş
              <span className="rounded-full bg-destructive px-1.5 text-xs font-bold tabular-nums text-destructive-foreground">{totalPending}</span>
            </button>
          )}
        </header>
        <UnsavedBar count={guard.count} onSave={guard.saveAll} onDiscard={guard.discardAll} />
        <div
          ref={contentRef}
          className={cn(
            'mx-auto w-full px-8 pb-24 pt-6',
            tab === 'dashboard' ? 'max-w-none' : 'max-w-[1600px]',
            '[&_h2.font-display]:text-lg [&_h3.font-display]:text-base [&_.text-2xl]:text-xl',
          )}
        >
      {loading && tab !== 'slide' && tab !== 'hero' && tab !== 'account' ? (
        <div role="status" className="flex items-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          {current?.label ?? 'Bölüm'} açılıyor...
        </div>
      ) : !tabs.includes(tab) ? (
        <p className="text-sm text-muted-foreground">Bu bölüme erişim yetkin yok.</p>
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
        <div className="flex flex-col gap-6">{logos}</div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2 2xl:grid-cols-3">
          {tab === 'slide' && <AddSlideCard />}
          {items.map((item, i) => (
            <ItemCard
              key={`${item.kind}-${item.id}`}
              item={item}
              library={library}
              position={tab === 'slide' ? { index: i, total: items.length } : undefined}
            />
          ))}
        </div>
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
  tools: Wrench,
  settings: Settings,
}

function NavButton({ active, onClick, label, pending, icon: Icon }: { active: boolean; onClick: () => void; label: string; pending: number; icon?: LucideIcon }) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] font-medium transition-colors',
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
            'shrink-0 rounded-full px-1.5 text-[11px] font-bold tabular-nums',
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
      <div className="grid grid-cols-4 gap-4 border-t border-border p-4">
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
                        <span className="mt-0.5 shrink-0 rounded-full bg-destructive px-1.5 text-[11px] font-bold tabular-nums text-destructive-foreground">{i.pending}</span>
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

const SLIDE_PRESETS = [
  { label: 'Tavla turnuvası', eyebrow: 'B��yük Tavla Turnuvası', title: 'Zarı at, kupayı kap', description: 'Yüksek ödüllü tavla turnuvasına kaydını şimdi yap, yerini kapan kazansın.', cta: 'Turnuvaya katıl' },
  { label: 'Ücretsiz Okey & 101', eyebrow: 'Canlı Masalar', title: 'Okey ve 101 masaları seni bekliyor', description: 'Ücretsiz canlı masalara otur, kankalarınla aynı masada taşları diz.', cta: 'Masaya otur' },
  { label: 'Batak ligi', eyebrow: 'Batak Ligi', title: 'Koz senden, zafer senden', description: 'Haftalık Batak liginde puan topla, sıralamanın zirvesine çık.', cta: 'Lige katıl' },
  { label: 'Bilardo düellosu', eyebrow: 'Amerikan Bilardo', title: 'Istakanı hazırla', description: 'Birebir bilardo düellolarında rakibini yen, Kanka Coin kazan.', cta: 'Düelloya başla' },
]

function AddSlideCard() {
  const [state, action, pending] = useActionState<ActionState>(addSlide, {})
  return (
    <form
      action={action}
      className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-primary/40 bg-card p-6 text-center"
    >
      <Plus className="size-8 text-primary" aria-hidden="true" />
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-lg font-bold text-foreground">Yeni slayt ekle</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Ana sayfa slider&apos;ına istediğin kadar yeni slayt ekle. Eklenen slayt listenin sonuna düşer, görselini bilgisayardan yükleyebilirsin.
        </p>
      </div>
      <button
        disabled={pending}
        className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
      >
        <Plus className="size-4" aria-hidden="true" />
        {pending ? 'Ekleniyor…' : 'Slayt ekle'}
      </button>
      {state.message && (
        <p role="status" className={cn('text-sm', state.ok ? 'text-primary' : 'text-live')}>
          {state.message}
        </p>
      )}
    </form>
  )
}

const POSE_LABELS: Record<string, string> = {
  jako: 'Klasik',
  merhaba: 'Merhaba',
  kazandi: 'Kazandı',
  duyuru: 'Duyuru',
  sandik: 'Sandık',
  dusunen: 'Düşünen',
  zar: 'Zar',
  market: 'Market',
  uzgun: 'Üzgün',
  telegram: 'Telegram',
}

const poseImage = (p: string) => (p === 'jako' ? '/images/mascots/jako.png' : `/images/mascots/jako-${p}.png`)

const PREVIEW_KEYS = ['eyebrow', 'title', 'description', 'cta', 'speech'] as const
type LiveFields = Record<(typeof PREVIEW_KEYS)[number], string>

function SlideOrderTools({ id, index, total }: { id: string; index: number; total: number }) {
  const [moveState, moveAction, moving] = useActionState<ActionState, FormData>(moveSlide, {})
  const [dupState, dupAction, duplicating] = useActionState<ActionState, FormData>(duplicateSlide, {})
  const btn =
    'flex size-7 items-center justify-center rounded-md bg-background/80 text-foreground backdrop-blur hover:bg-background disabled:opacity-30'
  const failed = (!moveState.ok && moveState.message) || (!dupState.ok && dupState.message)
  return (
    <div className="flex items-center gap-1">
      <span className="rounded-md bg-background/80 px-2 py-1 text-xs font-semibold tabular-nums text-foreground backdrop-blur">
        {`${index + 1}/${total}`}
      </span>
      <form action={moveAction} data-no-guard>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="dir" value="up" />
        <button disabled={moving || index === 0} className={btn} aria-label="Öne al" title="Öne al">
          <ArrowUp className="size-3.5" aria-hidden="true" />
        </button>
      </form>
      <form action={moveAction} data-no-guard>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="dir" value="down" />
        <button disabled={moving || index === total - 1} className={btn} aria-label="Arkaya al" title="Arkaya al">
          <ArrowDown className="size-3.5" aria-hidden="true" />
        </button>
      </form>
      <form action={dupAction} data-no-guard>
        <input type="hidden" name="id" value={id} />
        <button disabled={duplicating} className={btn} aria-label="Kopyasını oluştur" title="Kopyala">
          {duplicating ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
        </button>
      </form>
      {failed && (
        <span role="alert" className="rounded-md bg-destructive px-2 py-1 text-xs text-destructive-foreground">
          {failed}
        </span>
      )}
    </div>
  )
}

function ScheduleBadge({ startAt, endAt }: { startAt?: string; endAt?: string }) {
  if (!startAt && !endAt) return null
  const state = scheduleState({ startAt, endAt })
  const text =
    state === 'upcoming'
      ? `${formatLocal(startAt)} başlar`
      : state === 'ended'
        ? `${formatLocal(endAt)} bitti`
        : endAt
          ? `${formatLocal(endAt)} tarihine kadar`
          : 'Yayında'
  return (
    <span
      className={cn(
        'flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium backdrop-blur',
        state === 'live' ? 'bg-background/80 text-foreground' : 'bg-destructive/90 text-destructive-foreground',
      )}
    >
      <CalendarClock className="size-3" aria-hidden="true" />
      {text}
    </span>
  )
}

function ItemCard({
  item,
  library,
  position,
}: {
  item: EditorItem
  library: string[]
  position?: { index: number; total: number }
}) {
  const isSlide = item.kind === 'slide'
  const [saveState, saveAction, saving] = useActionState<ActionState, FormData>(isSlide ? saveSlide : saveHero, {})
  const [resetState, resetAction, resetting] = useActionState<ActionState, FormData>(isSlide ? resetSlide : resetHero, {})
  const [image, setImage] = useState(item.saved?.image || '')
  const value = (k: keyof Fields) => item.saved?.[k] ?? ''
  const initialLive = (): LiveFields =>
    Object.fromEntries(PREVIEW_KEYS.map((k) => [k, value(k) || item.defaults[k] || ''])) as LiveFields
  const [live, setLive] = useState<LiveFields>(initialLive)
  const [speechLength, setSpeechLength] = useState(value('speech').length)
  const [confirming, setConfirming] = useState(false)
  const [presetPending, setPresetPending] = useState<(typeof SLIDE_PRESETS)[number] | null>(null)
  const preview = image || item.defaults.image || '/placeholder.svg'
  const status = resetState.message && !saveState.message ? resetState : saveState
  const changed = !!item.saved && Object.values(item.saved).some(Boolean)
  const ctr = item.stats && item.stats.views > 0 ? (item.stats.clicks / item.stats.views) * 100 : 0

  useEffect(() => {
    if (!confirming) return
    const t = setTimeout(() => setConfirming(false), 4000)
    return () => clearTimeout(t)
  }, [confirming])

  const syncPreview = (form: HTMLFormElement) => {
    const read = (k: string) => (form.elements.namedItem(k) as HTMLInputElement | null)?.value ?? ''
    setLive(Object.fromEntries(PREVIEW_KEYS.map((k) => [k, read(k) || item.defaults[k] || ''])) as LiveFields)
    setSpeechLength(read('speech').length)
  }

  const applyPreset = (form: HTMLFormElement, p: (typeof SLIDE_PRESETS)[number]) => {
    for (const key of ['eyebrow', 'title', 'description', 'cta'] as const) {
      const el = form.elements.namedItem(key) as HTMLInputElement | HTMLTextAreaElement | null
      if (el) {
        el.value = p[key]
        el.dispatchEvent(new Event('input', { bubbles: true }))
      }
    }
    syncPreview(form)
    setPresetPending(null)
  }

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card">
      <div className="relative aspect-[16/7] bg-secondary">
        <Image src={preview || '/placeholder.svg'} alt="" fill sizes="(min-width: 1536px) 520px, 600px" className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/50 to-transparent" />
        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
          <div className="flex flex-wrap items-center gap-1">
            {position && <SlideOrderTools id={item.id} index={position.index} total={position.total} />}
            {item.hidden && (
              <span className="rounded-md bg-background/80 px-2 py-1 text-xs text-muted-foreground backdrop-blur">Siteden gizli</span>
            )}
            <ScheduleBadge startAt={item.saved?.startAt} endAt={item.saved?.endAt} />
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {isSlide && (
              <HideButton
                key={`${item.id}-${!!item.hidden}`}
                kind="slide"
                id={item.id}
                hidden={!!item.hidden}
                label={item.label}
                className="bg-background/80 backdrop-blur"
              />
            )}
            <a
              href={item.path}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 rounded-md bg-background/80 px-2 py-1 text-xs text-foreground backdrop-blur hover:bg-background"
            >
              Sitede aç <ExternalLink className="size-3" aria-hidden="true" />
            </a>
          </div>
        </div>
        <div className="absolute inset-y-0 left-0 flex w-3/4 flex-col justify-end gap-1 p-4">
          {live.eyebrow && <span className="truncate text-[11px] font-bold uppercase tracking-wider text-primary">{live.eyebrow}</span>}
          <h2 className="line-clamp-2 text-balance font-display text-lg font-bold leading-tight text-foreground">
            {live.title || item.label}
          </h2>
          {live.description && <p className="line-clamp-2 text-xs leading-relaxed text-foreground/80">{live.description}</p>}
          {isSlide && live.cta && (
            <span className="mt-1 w-fit rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground">{live.cta}</span>
          )}
          {!isSlide && live.speech && (
            <span className="mt-1 w-fit max-w-full truncate rounded-lg bg-card/90 px-2.5 py-1 text-xs text-foreground">
              {`Jako: ${live.speech}`}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <span className="truncate text-sm font-semibold text-foreground">{item.label}</span>
        <div className="flex shrink-0 items-center gap-2">
          {isSlide && item.stats && (
            <span className="flex items-center gap-2.5 text-xs tabular-nums text-muted-foreground" title="Son 30 gün">
              <span className="flex items-center gap-1">
                <Eye className="size-3.5" aria-hidden="true" />
                <span className="sr-only">Gösterim</span>
                {item.stats.views.toLocaleString('tr-TR')}
              </span>
              <span className="flex items-center gap-1">
                <MousePointerClick className="size-3.5" aria-hidden="true" />
                <span className="sr-only">Tıklanma</span>
                {item.stats.clicks.toLocaleString('tr-TR')}
              </span>
              {item.stats.views > 0 && <span className="text-foreground">{`%${ctr.toFixed(1)}`}</span>}
            </span>
          )}
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-[11px] font-semibold',
              item.custom ? 'bg-secondary text-foreground' : changed ? 'bg-primary/15 text-primary' : 'bg-secondary text-muted-foreground',
            )}
          >
            {item.custom ? 'Yeni slayt' : changed ? 'Değiştirildi' : 'Varsayılan'}
          </span>
        </div>
      </div>

      <form
        action={saveAction}
        onInput={(e) => syncPreview(e.currentTarget)}
        onReset={(e) => {
          const form = e.currentTarget
          setImage(item.saved?.image || '')
          setTimeout(() => syncPreview(form))
        }}
        className="flex flex-col gap-3 p-4"
      >
        <input type="hidden" name={isSlide ? 'id' : 'slug'} value={item.id} />
        <ImageField
          name="image"
          label="Görsel"
          value={image}
          onChange={setImage}
          library={library}
          uploadId={isSlide ? 'slide' : 'hero'}
          placeholder="Hazır görsel kullanılıyor"
          hint={`Bilgisayardan yükle, galeriden seç ya da link yapıştır. Önerilen boyut ${isSlide ? '1600×600' : '1600×500'}.`}
        />
        {item.custom && (
          <label className="flex flex-col gap-1.5 text-sm text-foreground">
            Butonun gideceği link
            <input
              name="href"
              defaultValue={item.saved?.href ?? '/'}
              placeholder="/oyunlar/tavla veya https://…"
              className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />
          </label>
        )}

        {isSlide && (
          <div className="flex flex-col gap-2 rounded-lg border border-border bg-background p-2.5">
            <span className="text-xs font-semibold text-muted-foreground">Hazır şablonlar</span>
            {presetPending ? (
              <div className="flex flex-wrap items-center gap-2 text-xs text-foreground">
                <span>{`"${presetPending.label}" yazıları mevcut metnin yerine geçsin mi?`}</span>
                <button
                  type="button"
                  onClick={(e) => e.currentTarget.form && applyPreset(e.currentTarget.form, presetPending)}
                  className="rounded-md bg-primary px-2.5 py-1 font-semibold text-primary-foreground"
                >
                  Evet, doldur
                </button>
                <button type="button" onClick={() => setPresetPending(null)} className="rounded-md border border-border px-2.5 py-1">
                  Vazgeç
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {SLIDE_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => setPresetPending(p)}
                    className="rounded-full border border-border px-2.5 py-1 text-xs font-semibold text-foreground hover:border-primary hover:text-primary"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <Text name="eyebrow" label="Üst etiket" value={value('eyebrow')} placeholder={item.defaults.eyebrow || 'Boş bırakılırsa gösterilmez'} />
        <Text name="title" label="Başlık" value={value('title')} placeholder={item.defaults.title} />
        <Text name="description" label="Açıklama" value={value('description')} placeholder={item.defaults.description} multiline />
        {isSlide ? (
          <>
            <Text name="cta" label="Buton yazısı" value={value('cta')} placeholder={item.defaults.cta} />
            <fieldset className="flex flex-col gap-2 rounded-lg border border-border bg-background p-2.5">
              <legend className="px-1 text-xs font-semibold text-muted-foreground">Yayın zamanı (isteğe bağlı)</legend>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1 text-xs text-foreground">
                  Başlangıç
                  <input
                    type="datetime-local"
                    name="startAt"
                    defaultValue={value('startAt')}
                    className="rounded-md border border-input bg-card px-2 py-1.5 text-sm text-foreground outline-none [color-scheme:dark] focus:border-primary"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-foreground">
                  Bitiş
                  <input
                    type="datetime-local"
                    name="endAt"
                    defaultValue={value('endAt')}
                    className="rounded-md border border-input bg-card px-2 py-1.5 text-sm text-foreground outline-none [color-scheme:dark] focus:border-primary"
                  />
                </label>
              </div>
              <span className="text-xs text-muted-foreground">Boş bırakırsan slayt hep yayında kalır. Türkiye saatiyle.</span>
            </fieldset>
          </>
        ) : (
          <>
            <label className="flex flex-col gap-1.5 text-sm text-foreground">
              <span className="flex items-center justify-between">
                Jako konuşma balonu
                <span className={cn('text-xs tabular-nums', speechLength > 80 ? 'text-destructive' : 'text-muted-foreground')}>
                  {`${speechLength}/80`}
                </span>
              </span>
              <input
                name="speech"
                defaultValue={value('speech')}
                maxLength={140}
                placeholder={item.defaults.speech || 'Boş bırakılırsa varsayılan metin kullanılır'}
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              />
              {speechLength > 80 && <span className="text-xs text-destructive">Mobilde taşabilir, 80 karakterin altında tut.</span>}
            </label>
            <fieldset className="flex flex-col gap-1.5">
              <legend className="pb-1.5 text-sm text-foreground">Jako pozu</legend>
              <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
                {['', ...JAKO_POSES].map((p) => (
                  <label
                    key={p || 'default'}
                    className="flex cursor-pointer flex-col items-center gap-1 rounded-lg border border-border bg-background p-1.5 text-center text-[11px] text-foreground has-[:checked]:border-primary has-[:checked]:bg-primary/10"
                  >
                    <input type="radio" name="pose" value={p} defaultChecked={value('pose') === p} className="sr-only" />
                    {p ? (
                      <Image src={poseImage(p)} alt="" width={40} height={40} className="size-10 object-contain" />
                    ) : (
                      <span className="flex size-10 items-center justify-center text-muted-foreground">
                        <RotateCcw className="size-4" aria-hidden="true" />
                      </span>
                    )}
                    <span className="w-full truncate">{p ? (POSE_LABELS[p] ?? p) : 'Varsayılan'}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            <Save className="size-4" aria-hidden="true" />
            {saving ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
          <button
            formAction={resetAction}
            disabled={resetting || !item.saved}
            onClick={(e) => {
              if (!confirming) {
                e.preventDefault()
                setConfirming(true)
                return
              }
              setConfirming(false)
              setImage('')
            }}
            className={cn(
              'flex items-center gap-2 rounded-lg border px-4 py-2 text-sm disabled:opacity-40',
              confirming
                ? 'border-destructive bg-destructive text-destructive-foreground'
                : item.custom
                  ? 'border-destructive/40 text-destructive hover:bg-secondary'
                  : 'border-border text-foreground hover:bg-secondary',
            )}
          >
            {item.custom ? <Trash2 className="size-4" aria-hidden="true" /> : <RotateCcw className="size-4" aria-hidden="true" />}
            {confirming ? (item.custom ? 'Emin misin? Sil' : 'Emin misin? Sıfırla') : item.custom ? 'Slaytı sil' : 'Varsayılana dön'}
          </button>
          {status.message && (
            <p role="status" className={cn('text-sm', status.ok ? 'text-primary' : 'text-destructive')}>
              {status.message}
            </p>
          )}
        </div>
      </form>
    </article>
  )
}

function Text({
  name,
  label,
  value,
  placeholder,
  multiline,
}: {
  name: string
  label: string
  value: string
  placeholder?: string
  multiline?: boolean
}) {
  const cls = 'rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary'
  return (
    <label className="flex flex-col gap-1.5 text-sm text-foreground">
      {label}
      {multiline ? (
        <textarea name={name} defaultValue={value} placeholder={placeholder} rows={2} className={cn(cls, 'resize-y leading-relaxed')} />
      ) : (
        <input name={name} defaultValue={value} placeholder={placeholder} className={cls} />
      )}
    </label>
  )
}
