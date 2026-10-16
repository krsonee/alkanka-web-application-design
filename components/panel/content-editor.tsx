'use client'

import { useActionState, useEffect, useState } from 'react'
import Image from 'next/image'
import { ChevronRight, LayoutDashboard, ExternalLink, ImageIcon, RotateCcw, Save } from 'lucide-react'
import { cn } from '@/lib/utils'
import { resetHero, resetSlide, saveHero, saveSlide, type ActionState } from '@/app/panel/actions'
import { JAKO_POSES } from '@/lib/site-registry'
import { PANEL_GROUPS, type PanelModule } from '@/lib/panel-modules'
import { HideButton } from '@/components/panel/hide-button'

type Fields = { eyebrow?: string; title?: string; description?: string; cta?: string; speech?: string; image?: string; pose?: string }

type PanelTab = PanelModule | 'staff' | 'account' | 'audit' | 'dashboard'

export type EditorItem = {
  kind: 'slide' | 'hero'
  id: string
  label: string
  path: string
  defaults: Fields
  saved: Fields | null
  hidden?: boolean
}

export function ContentEditor({
  slides,
  heroes,
  library,
  logos,
  texts,
  games,
  tournaments,
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
  market,
  marketPending = 0,
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
}: {
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
  market: React.ReactNode
  marketPending?: number
  sponsors: React.ReactNode
}) {
  const groups = [
    ...PANEL_GROUPS.map((g) => ({
      label: g.label,
      items: g.modules
        .filter((m) => m.id !== 'roles' && allowed.includes(m.id))
        .map((m) => ({
          id: m.id as PanelTab,
          label:
            m.id === 'market' && marketPending > 0
              ? `Market (${marketPending})`
              : m.id === 'slide'
                ? `Slider (${slides.length})`
                : m.id === 'hero'
                  ? `Sayfa başlıkları (${heroes.length})`
                  : m.label,
        })),
    })),
    {
      label: 'Ayarlar',
      items: [
        ...(isOwner ? [{ id: 'staff' as PanelTab, label: 'Personel & yetkiler' }, { id: 'audit' as PanelTab, label: 'İşlem logları' }] : []),
        { id: 'account' as PanelTab, label: 'Hesabım & 2FA' },
      ],
    },
  ].filter((g) => g.items.length > 0)
  const tabs: PanelTab[] = ['dashboard', ...groups.flatMap((g) => g.items.map((i) => i.id))]
  const initial: PanelTab = 'dashboard'
  const [tab, setTab] = useState<PanelTab>(initial)
  const [filter, setFilter] = useState('')
  const groupOf = (id: PanelTab) => groups.find((g) => g.items.some((i) => i.id === id))?.label ?? ''
  const [open, setOpen] = useState<string[]>(() => [groupOf(initial)])
  useEffect(() => {
    const saved = window.location.hash.replace('#', '') as PanelTab
    if (tabs.includes(saved)) {
      setTab(saved)
      setOpen((o) => Array.from(new Set([...o, groupOf(saved)])))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const toggle = (label: string) => setOpen((o) => (o.includes(label) ? o.filter((l) => l !== label) : [...o, label]))
  const items = tab === 'slide' ? slides : heroes
  const q = filter.trim().toLocaleLowerCase('tr')
  const shown = groups
    .map((g) => ({ ...g, items: q ? g.items.filter((i) => i.label.toLocaleLowerCase('tr').includes(q) || g.label.toLocaleLowerCase('tr').includes(q)) : g.items }))
    .filter((g) => g.items.length > 0)
  const pick = (id: PanelTab) => {
    setTab(id)
    window.history.replaceState(null, '', `#${id}`)
  }
  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <nav aria-label="Panel bölümleri" className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)] lg:w-64 lg:shrink-0 lg:overflow-y-auto lg:overflow-x-hidden">
        <label className="sr-only" htmlFor="panel-nav-filter">
          Bölüm ara
        </label>
        <input
          id="panel-nav-filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Bölüm ara…"
          className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
        />
        <button
          onClick={() => pick('dashboard')}
          aria-current={tab === 'dashboard' ? 'page' : undefined}
          className={cn(
            'flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold',
            tab === 'dashboard' ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-secondary',
          )}
        >
          <LayoutDashboard className="size-4" aria-hidden="true" />
          Dashboard
        </button>
        <div className="flex max-h-[60dvh] flex-col gap-1 overflow-y-auto overflow-x-hidden lg:max-h-none lg:overflow-visible">
          {shown.map((g) => {
            const expanded = !!q || open.includes(g.label)
            const active = g.items.some((i) => i.id === tab)
            return (
            <div key={g.label} className="flex flex-col gap-1">
              <button
                onClick={() => toggle(g.label)}
                aria-expanded={expanded}
                className={cn(
                  'flex items-center justify-between rounded-lg px-2 py-2 text-left text-xs font-semibold uppercase tracking-wider hover:bg-secondary',
                  active ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                <span className="truncate">{g.label}</span>
                <ChevronRight className={cn('size-4 shrink-0 transition-transform duration-200', expanded && 'rotate-90')} aria-hidden="true" />
              </button>
              <div className={cn('ml-2 flex-col gap-1 border-l border-border pl-3', expanded ? 'flex' : 'hidden')}>
                {g.items.map((i) => (
                  <button
                    key={i.id}
                    onClick={() => pick(i.id)}
                    aria-current={tab === i.id ? 'page' : undefined}
                    className={cn(
                      'truncate rounded-lg px-3 py-2 text-left text-sm font-medium',
                      tab === i.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                    )}
                  >
                    {i.label}
                  </button>
                ))}
              </div>
            </div>
            )
          })}
          {shown.length === 0 && <p className="px-2 text-sm text-muted-foreground">Bölüm bulunamadı.</p>}
        </div>
      </nav>
      <div className="min-w-0 flex-1">
      {!tabs.includes(tab) ? (
        <p className="text-sm text-muted-foreground">Bu bölüme erişim yetkin yok.</p>
      ) : tab === 'staff' ? (
        staff
      ) : tab === 'dashboard' ? (
        dashboard
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
        <div className="grid gap-5 lg:grid-cols-2">
          {items.map((item) => (
            <ItemCard key={`${item.kind}-${item.id}`} item={item} library={library} />
          ))}
        </div>
      )}
      </div>
    </div>
  )
}

const SLIDE_PRESETS = [
  { label: 'Tavla turnuvası', eyebrow: 'Büyük Tavla Turnuvası', title: 'Zarı at, kupayı kap', description: 'Yüksek ödüllü tavla turnuvasına kaydını şimdi yap, yerini kapan kazansın.', cta: 'Turnuvaya katıl' },
  { label: 'Ücretsiz Okey & 101', eyebrow: 'Canlı Masalar', title: 'Okey ve 101 masaları seni bekliyor', description: 'Ücretsiz canlı masalara otur, kankalarınla aynı masada taşları diz.', cta: 'Masaya otur' },
  { label: 'Batak ligi', eyebrow: 'Batak Ligi', title: 'Koz senden, zafer senden', description: 'Haftalık Batak liginde puan topla, sıralamanın zirvesine çık.', cta: 'Lige katıl' },
  { label: 'Bilardo düellosu', eyebrow: 'Amerikan Bilardo', title: 'Istakanı hazırla', description: 'Birebir bilardo düellolarında rakibini yen, Kanka Coin kazan.', cta: 'Düelloya başla' },
]

function ItemCard({ item, library }: { item: EditorItem; library: string[] }) {
  const isSlide = item.kind === 'slide'
  const [saveState, saveAction, saving] = useActionState<ActionState, FormData>(isSlide ? saveSlide : saveHero, {})
  const [resetState, resetAction, resetting] = useActionState<ActionState, FormData>(isSlide ? resetSlide : resetHero, {})
  const [image, setImage] = useState(item.saved?.image || '')
  const [picker, setPicker] = useState(false)
  const preview = image || item.defaults.image || '/placeholder.svg'
  const status = resetState.message && !saveState.message ? resetState : saveState
  const value = (k: keyof Fields) => item.saved?.[k] ?? ''

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card">
      <div className="relative aspect-[21/8] bg-secondary">
        <Image src={preview || '/placeholder.svg'} alt="" fill sizes="600px" className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-card via-card/30 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-4">
          <div className="flex flex-col">
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">
              {isSlide ? 'Slayt' : 'Sayfa'}
              {item.hidden && <span className="ml-2 text-muted-foreground">· Siteden gizli</span>}
            </span>
            <h2 className="font-display text-lg font-bold text-foreground">{item.label}</h2>
          </div>
          <div className="flex items-center gap-2">
          {isSlide && <HideButton key={`${item.id}-${!!item.hidden}`} kind="slide" id={item.id} hidden={!!item.hidden} label={item.label} className="bg-background/80 backdrop-blur" />}
          <a
            href={item.path}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 rounded-md bg-background/80 px-2 py-1 text-xs text-foreground backdrop-blur hover:bg-background"
          >
            Önizle <ExternalLink className="size-3" aria-hidden="true" />
          </a>
          </div>
        </div>
      </div>

      <form action={saveAction} className="flex flex-col gap-3 p-4">
        <input type="hidden" name={isSlide ? 'id' : 'slug'} value={item.id} />
        <input type="hidden" name="image" value={image} />

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">Görsel</span>
            <button
              type="button"
              onClick={() => setPicker((v) => !v)}
              aria-expanded={picker}
              className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs text-foreground hover:bg-secondary"
            >
              <ImageIcon className="size-3.5" aria-hidden="true" />
              {picker ? 'Kapat' : 'Galeriden seç'}
            </button>
          </div>
          {picker && (
            <div className="grid max-h-56 grid-cols-4 gap-2 overflow-y-auto rounded-lg border border-border bg-background p-2 sm:grid-cols-5">
              {library.map((src) => (
                <button
                  key={src}
                  type="button"
                  onClick={() => {
                    setImage(src)
                    setPicker(false)
                  }}
                  aria-label={`Görsel seç: ${src.split('/').pop()}`}
                  className={cn(
                    'relative aspect-square overflow-hidden rounded-md border-2',
                    preview === src ? 'border-primary' : 'border-transparent hover:border-border',
                  )}
                >
                  <Image src={src || '/placeholder.svg'} alt="" fill sizes="96px" className="object-cover" />
                </button>
              ))}
            </div>
          )}
          <input
            aria-label="Görsel adresi"
            value={image}
            onChange={(e) => setImage(e.target.value)}
            placeholder={`Varsayılan: ${item.defaults.image}`}
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
          />
          <p className="text-xs leading-relaxed text-muted-foreground">
            Galeriden seç ya da https:// ile başlayan bir görsel linki yapıştır.
          </p>
        </div>

        {isSlide && (
          <div className="flex flex-col gap-2 rounded-lg border border-border bg-background p-2">
            <span className="text-xs font-semibold text-muted-foreground">Hazır oyun slaytları (metni doldurur, kaydetmeyi unutma)</span>
            <div className="flex flex-wrap gap-1.5">
              {SLIDE_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={(e) => {
                    const form = e.currentTarget.form
                    if (!form) return
                    for (const key of ['eyebrow', 'title', 'description', 'cta'] as const) {
                      const el = form.elements.namedItem(key) as HTMLInputElement | HTMLTextAreaElement | null
                      if (el) el.value = p[key]
                    }
                  }}
                  className="rounded-full border border-border px-2.5 py-1 text-xs font-semibold text-foreground hover:border-primary hover:text-primary"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        )}
        <Text name="eyebrow" label="Üst etiket" value={value('eyebrow')} placeholder={item.defaults.eyebrow} />
        <Text name="title" label="Başlık" value={value('title')} placeholder={item.defaults.title} />
        <Text name="description" label="Açıklama" value={value('description')} placeholder={item.defaults.description} multiline />
        {isSlide ? (
          <Text name="cta" label="Buton yazısı" value={value('cta')} placeholder={item.defaults.cta} />
        ) : (
          <>
            <Text name="speech" label="Jako konuşma balonu" value={value('speech')} placeholder="Varsayılan metin kullanılır" />
            <label className="flex flex-col gap-1.5 text-sm text-foreground">
              Jako pozu
              <select
                name="pose"
                defaultValue={value('pose')}
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              >
                <option value="">Varsayılan</option>
                {JAKO_POSES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
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
            onClick={() => setImage('')}
            className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm text-foreground hover:bg-secondary disabled:opacity-40"
          >
            <RotateCcw className="size-4" aria-hidden="true" />
            Varsayılana dön
          </button>
          {status.message && (
            <p role="status" className={cn('text-sm', status.ok ? 'text-primary' : 'text-live')}>
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
