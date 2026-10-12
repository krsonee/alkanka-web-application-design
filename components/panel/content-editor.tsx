'use client'

import { useActionState, useEffect, useState } from 'react'
import Image from 'next/image'
import { ExternalLink, ImageIcon, RotateCcw, Save } from 'lucide-react'
import { cn } from '@/lib/utils'
import { resetHero, resetSlide, saveHero, saveSlide, type ActionState } from '@/app/panel/actions'
import { JAKO_POSES } from '@/lib/site-registry'

type Fields = { eyebrow?: string; title?: string; description?: string; cta?: string; speech?: string; image?: string; pose?: string }

type PanelTab = 'slide' | 'hero' | 'texts' | 'sponsors' | 'logo' | 'games' | 'tournaments' | 'push' | 'telegram' | 'seo' | 'studio' | 'community' | 'badges' | 'market' | 'growth' | 'social'
const PANEL_TABS: PanelTab[] = ['growth', 'social', 'slide', 'hero', 'texts', 'sponsors', 'logo', 'games', 'tournaments', 'push', 'telegram', 'seo', 'studio', 'community', 'badges', 'market']

export type EditorItem = {
  kind: 'slide' | 'hero'
  id: string
  label: string
  path: string
  defaults: Fields
  saved: Fields | null
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
  telegram,
  seo,
  studio,
  community,
  badges,
  market,
  marketPending = 0,
  growth,
  social,
  sponsors,
}: {
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
  telegram: React.ReactNode
  seo: React.ReactNode
  studio: React.ReactNode
  community: React.ReactNode
  badges: React.ReactNode
  market: React.ReactNode
  marketPending?: number
  sponsors: React.ReactNode
}) {
  const [tab, setTab] = useState<PanelTab>(marketPending > 0 ? 'market' : 'slide')
  useEffect(() => {
    const saved = window.location.hash.replace('#', '')
    if (PANEL_TABS.includes(saved as PanelTab)) setTab(saved as PanelTab)
  }, [])
  const items = tab === 'slide' ? slides : heroes
  return (
    <div className="flex flex-col gap-6">
      <div role="tablist" aria-label="İçerik türü" className="flex max-w-full gap-1 overflow-x-auto rounded-xl border border-border bg-card p-1 sm:w-fit">
        {(
          [
            ['growth', 'Trafik & Siteler'],
            ['social', 'Sosyal medya'],
            ['slide', `Ana sayfa slider (${slides.length})`],
            ['hero', `Sayfa başlıkları (${heroes.length})`],
            ['texts', 'Site metinleri'],
            ['sponsors', 'Sponsorlar'],
            ['logo', 'Logolar'],
            ['games', 'Oyunlar'],
            ['tournaments', 'Turnuvalar'],
            ['push', 'Bildirimler'],
            ['telegram', 'Telegram'],
            ['seo', 'SEO & Rehber'],
            ['studio', 'Stüdyo'],
            ['community', 'Topluluk'],
            ['badges', 'Rozetler'],
            ['market', marketPending > 0 ? `Market (${marketPending} yeni talep)` : 'Market'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => {
              setTab(key)
              window.history.replaceState(null, '', `#${key}`)
            }}
            className={cn(
              'shrink-0 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold',
              tab === key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'growth' ? (
        growth
      ) : tab === 'social' ? (
        social
      ) : tab === 'games' ? (
        games
      ) : tab === 'tournaments' ? (
        tournaments
      ) : tab === 'push' ? (
        push
      ) : tab === 'telegram' ? (
        telegram
      ) : tab === 'seo' ? (
        seo
      ) : tab === 'community' ? (
        community
      ) : tab === 'badges' ? (
        badges
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
  )
}

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
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">{isSlide ? 'Slayt' : 'Sayfa'}</span>
            <h2 className="font-display text-lg font-bold text-foreground">{item.label}</h2>
          </div>
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
