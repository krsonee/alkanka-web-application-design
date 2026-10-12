'use client'

import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { ExternalLink, ImageIcon, Plus, RotateCcw, Save } from 'lucide-react'
import { cn } from '@/lib/utils'
import { resetHero, resetSlide, saveHero, saveSlide, type ActionState } from '@/app/panel/actions'
import { JAKO_POSES } from '@/lib/site-registry'
import { ImageField } from '@/components/panel/image-field'

type Fields = { eyebrow?: string; title?: string; description?: string; cta?: string; speech?: string; image?: string; pose?: string; href?: string; hidden?: boolean }

export type EditorItem = {
  kind: 'slide' | 'hero'
  id: string
  label: string
  path: string
  custom?: boolean
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
  only,
}: {
  growth?: React.ReactNode
  social?: React.ReactNode
  slides: EditorItem[]
  heroes: EditorItem[]
  library: string[]
  logos?: React.ReactNode
  texts?: React.ReactNode
  games?: React.ReactNode
  tournaments?: React.ReactNode
  push?: React.ReactNode
  telegram?: React.ReactNode
  seo?: React.ReactNode
  studio?: React.ReactNode
  community?: React.ReactNode
  badges?: React.ReactNode
  market?: React.ReactNode
  marketPending?: number
  /** Kabuk menüsü bir türü seçtiyse sekme şeridini gösterme. */
  only?: 'slide' | 'hero'
}) {
  const [tab, setTab] = useState<'slide' | 'hero' | 'texts' | 'logo' | 'games' | 'tournaments' | 'push' | 'telegram' | 'seo' | 'studio' | 'community' | 'badges' | 'market' | 'growth' | 'social'>(
    only ?? (marketPending > 0 ? 'market' : 'slide'),
  )
  const items = (only ?? tab) === 'slide' ? slides : heroes
  if (only) {
    return (
      <div className="flex flex-col gap-5">
        <AddCard kind={only} />
        <div className="grid gap-5 lg:grid-cols-2">
          {items.map((item) => (
            <ItemCard key={`${item.kind}-${item.id}`} item={item} library={library} />
          ))}
        </div>
      </div>
    )
  }
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
            onClick={() => setTab(key)}
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
      ) : tab === 'logo' ? (
        <div className="flex flex-col gap-6">{logos}</div>
      ) : (
        <div className="flex flex-col gap-5">
          {(tab === 'slide' || tab === 'hero') && <AddCard kind={tab} />}
          <div className="grid gap-5 lg:grid-cols-2">
            {items.map((item) => (
              <ItemCard key={`${item.kind}-${item.id}`} item={item} library={library} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ItemCard({ item, library }: { item: EditorItem; library: string[] }) {
  const router = useRouter()
  const isSlide = item.kind === 'slide'
  const [saveState, saveAction, saving] = useActionState<ActionState, FormData>(isSlide ? saveSlide : saveHero, {})
  const [resetState, resetAction, resetting] = useActionState<ActionState, FormData>(isSlide ? resetSlide : resetHero, {})
  const [image, setImage] = useState(item.saved?.image || '')
  const [picker, setPicker] = useState(false)
  const preview = image || item.defaults.image || '/placeholder.svg'
  const status = resetState.message && !saveState.message ? resetState : saveState
  const value = (k: keyof Fields) => {
    const raw = item.saved?.[k]
    return typeof raw === 'string' ? raw : ''
  }
  useEffect(() => {
    if (saveState.ok || resetState.ok) router.refresh()
  }, [saveState.ok, saveState.message, resetState.ok, resetState.message, router])

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
        {item.custom ? <input type="hidden" name="custom" value="1" /> : null}

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
          <ImageField
            label="Görsel adresi"
            value={image}
            onChange={setImage}
            placeholder={item.defaults.image ? `Varsayılan: ${item.defaults.image}` : 'https://… veya boş bırak'}
          />
        </div>

        <Text name="eyebrow" label="Üst etiket" value={value('eyebrow')} placeholder={item.defaults.eyebrow} />
        <Text name="title" label="Başlık" value={value('title')} placeholder={item.defaults.title} />
        <Text name="description" label="Açıklama" value={value('description')} placeholder={item.defaults.description} multiline />
        {isSlide ? (
          <>
            <Text name="cta" label="Buton yazısı" value={value('cta')} placeholder={item.defaults.cta} />
            <Text name="href" label="Buton linki" value={String(item.saved?.href ?? '')} placeholder={item.defaults.href || '/'} />
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input type="checkbox" name="hidden" value="1" defaultChecked={Boolean(item.saved?.hidden)} className="size-4 accent-primary" />
              Sitede gizle
            </label>
          </>
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
            disabled={resetting || (!item.saved && !item.custom)}
            onClick={() => setImage('')}
            className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm text-foreground hover:bg-secondary disabled:opacity-40"
          >
            <RotateCcw className="size-4" aria-hidden="true" />
            {item.custom ? 'Sil' : 'Varsayılana dön'}
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

function AddCard({ kind }: { kind: 'slide' | 'hero' }) {
  const router = useRouter()
  const isSlide = kind === 'slide'
  const [state, action, pending] = useActionState<ActionState, FormData>(isSlide ? saveSlide : saveHero, {})
  const [image, setImage] = useState('')
  const [id, setId] = useState(() => `x${Date.now().toString(36)}`)
  useEffect(() => {
    if (!state.ok) return
    setImage('')
    setId(`x${Date.now().toString(36)}`)
    router.refresh()
  }, [state.ok, state.message, router])

  return (
    <form key={id} action={action} className="flex flex-col gap-3 rounded-2xl border border-dashed border-primary/40 bg-card p-4">
      <div className="flex items-center gap-2">
        <Plus className="size-4 text-primary" aria-hidden />
        <h2 className="font-display text-lg font-bold text-foreground">{isSlide ? 'Yeni slayt' : 'Yeni sayfa başlığı'}</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        {isSlide
          ? 'Eklediğin slayt ana sayfadaki kaydırmalı banner’a eklenir. Kaydettikten sonra silebilirsin.'
          : 'Yeni başlık /sayfa/adres altında yayınlanır. Mevcut sayfaların başlığını alttaki kartlardan değiştir.'}
      </p>
      <input type="hidden" name="create" value="1" />
      {isSlide ? <input type="hidden" name="id" value={id} /> : null}
      <input type="hidden" name="image" value={image} />
      {!isSlide ? <Text name="label" label="Sayfa adı" value="" placeholder="Örn. Deneme bonusu" /> : null}
      <Text name="eyebrow" label="Üst etiket" value="" placeholder="Kampanya" />
      <Text name="title" label="Başlık" value="" placeholder={isSlide ? 'Slayt başlığı' : 'Sayfa başlığı'} />
      <Text name="description" label="Açıklama" value="" placeholder="Kısa açıklama" multiline />
      {isSlide ? (
        <>
          <Text name="cta" label="Buton yazısı" value="" placeholder="İncele" />
          <Text name="href" label="Buton linki" value="" placeholder="/" />
        </>
      ) : null}
      <ImageField label="Görsel adresi" value={image} onChange={setImage} />
      <div className="flex flex-wrap items-center gap-2">
        <button disabled={pending} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
          <Save className="size-4" aria-hidden />
          {pending ? 'Kaydediliyor…' : 'Ekle'}
        </button>
        {state.message ? <p className={cn('text-sm', state.ok ? 'text-primary' : 'text-live')}>{state.message}</p> : null}
      </div>
    </form>
  )
}
