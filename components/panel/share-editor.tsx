'use client'

import { useActionState, useState } from 'react'
import { saveShare, type ActionState } from '@/app/panel/actions'
import type { ShareSettings } from '@/lib/share'
import { ImageField } from '@/components/panel/image-field'

const input =
  'h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none'

const FALLBACK = {
  title: 'AL KANKA | Bahis ve Casino Topluluğu',
  description: 'Güvenilir siteler, bonuslar, tahmin ligi ve oyunlar tek yerde.',
  image: '/images/og.png',
  siteName: 'AL KANKA',
}

const PLATFORMS = [
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'telegram', label: 'Telegram' },
  { id: 'x', label: 'X' },
  { id: 'discord', label: 'Discord' },
] as const
type Platform = (typeof PLATFORMS)[number]['id']
type View = { title: string; description: string; image: string; siteName: string }

function Counter({ value, max }: { value: string; max: number }) {
  return (
    <span className={value.length > max * 0.9 ? 'font-normal tabular-nums text-destructive' : 'font-normal tabular-nums text-muted-foreground'}>
      {`${value.length}/${max}`}
    </span>
  )
}

function SharePreview({ platform, view }: { platform: Platform; view: View }) {
  /* eslint-disable @next/next/no-img-element -- live preview of admin-provided image */
  if (platform === 'whatsapp') {
    return (
      <div className="flex justify-end rounded-xl bg-background p-4">
        <div className="flex w-full max-w-sm flex-col gap-1 rounded-lg bg-secondary p-1">
          <img src={view.image || '/placeholder.svg'} alt="" className="aspect-[1200/630] w-full rounded-md object-cover" />
          <div className="flex flex-col gap-0.5 px-2 py-1.5">
            <span className="line-clamp-1 text-sm font-semibold text-foreground">{view.title}</span>
            <span className="line-clamp-2 text-xs text-muted-foreground">{view.description}</span>
            <span className="text-xs text-muted-foreground">alkanka.com</span>
          </div>
          <span className="px-2 pb-1 text-sm text-primary">https://alkanka.com</span>
        </div>
      </div>
    )
  }
  if (platform === 'telegram') {
    return (
      <div className="rounded-xl bg-background p-4">
        <div className="flex max-w-sm flex-col gap-1.5 rounded-lg bg-secondary p-2.5">
          <span className="text-sm text-primary">https://alkanka.com</span>
          <div className="flex flex-col gap-1 border-l-2 border-primary pl-2">
            <span className="text-sm font-semibold text-primary">{view.siteName}</span>
            <span className="text-sm font-semibold text-foreground">{view.title}</span>
            <span className="line-clamp-3 text-xs text-foreground/80">{view.description}</span>
            <img src={view.image || '/placeholder.svg'} alt="" className="mt-1 aspect-[1200/630] w-full rounded-md object-cover" />
          </div>
        </div>
      </div>
    )
  }
  if (platform === 'x') {
    return (
      <div className="rounded-xl bg-background p-4">
        <div className="relative overflow-hidden rounded-2xl border border-border">
          <img src={view.image || '/placeholder.svg'} alt="" className="aspect-[1200/630] w-full object-cover" />
          <span className="absolute bottom-2 left-2 rounded bg-background/80 px-1.5 py-0.5 text-xs text-foreground">{view.title}</span>
        </div>
        <span className="mt-1 block text-xs text-muted-foreground">alkanka.com adresinden</span>
      </div>
    )
  }
  return (
    <div className="rounded-xl bg-background p-4">
      <div className="flex max-w-sm flex-col gap-1.5 rounded-md border-l-4 border-primary bg-secondary p-3">
        <span className="text-xs text-muted-foreground">{view.siteName}</span>
        <span className="text-sm font-semibold text-primary">{view.title}</span>
        <span className="line-clamp-3 text-xs text-foreground/80">{view.description}</span>
        <img src={view.image || '/placeholder.svg'} alt="" className="mt-1 aspect-[1200/630] w-full rounded object-cover" />
      </div>
    </div>
  )
  /* eslint-enable @next/next/no-img-element */
}

export function ShareEditor({ saved }: { saved: ShareSettings }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveShare, {})
  const [platform, setPlatform] = useState<Platform>('whatsapp')
  const [draft, setDraft] = useState({
    title: saved.title ?? '',
    description: saved.description ?? '',
    image: saved.image ?? '',
    siteName: saved.siteName ?? '',
  })
  const set = (k: keyof typeof draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setDraft((d) => ({ ...d, [k]: e.target.value }))
  const view = {
    title: draft.title || FALLBACK.title,
    description: draft.description || FALLBACK.description,
    image: draft.image || FALLBACK.image,
    siteName: draft.siteName || FALLBACK.siteName,
  }

  return (
    <form action={action} className="flex flex-col gap-5 rounded-xl border border-border bg-card p-5">
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-lg font-bold uppercase text-foreground">Link paylaşım önizlemesi</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          alkanka.com linkini WhatsApp, Telegram, X veya Discord&apos;da paylaşınca çıkan kart. Görsel 1200×630 olmalı. Boş alanlar varsayılanı kullanır.
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground">
            <span className="flex justify-between">Başlık <Counter value={draft.title} max={90} /></span>
            <input name="title" value={draft.title} onChange={set('title')} maxLength={90} placeholder={FALLBACK.title} className={input} />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground">
            <span className="flex justify-between">Açıklama <Counter value={draft.description} max={200} /></span>
            <textarea
              name="description"
              value={draft.description}
              onChange={set('description')}
              maxLength={200}
              rows={3}
              placeholder={FALLBACK.description}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground">
            Site adı
            <input name="siteName" value={draft.siteName} onChange={set('siteName')} maxLength={40} placeholder={FALLBACK.siteName} className={input} />
          </label>
          <ImageField
            name="image"
            label="Görsel (1200×630)"
            value={draft.image}
            onChange={(url) => setDraft((d) => ({ ...d, image: url }))}
            uploadId="og"
            hint="Bilgisayardan yükle, galeriden seç ya da link yapıştır."
          />
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-muted-foreground">Önizleme</span>
            <div className="flex gap-1 rounded-lg bg-secondary p-1" role="tablist" aria-label="Platform">
              {PLATFORMS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  role="tab"
                  aria-selected={platform === p.id}
                  onClick={() => setPlatform(p.id)}
                  className={
                    platform === p.id
                      ? 'rounded-md bg-card px-2.5 py-1 text-xs font-semibold text-foreground'
                      : 'rounded-md px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground'
                  }
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <SharePreview platform={platform} view={view} />
          <div className="flex flex-col gap-1.5 rounded-lg bg-background p-3 text-xs leading-relaxed text-muted-foreground">
            <span className="font-semibold text-foreground">Eski önizleme mi çıkıyor?</span>
            <span>
              Platformlar kartı bir süre önbellekte tutar. Telegram&apos;da{' '}
              <a href="https://t.me/WebpageBot" target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2">
                @WebpageBot
              </a>
              {"'a linki gönder; Facebook/WhatsApp için "}
              <a
                href="https://developers.facebook.com/tools/debug/?q=https%3A%2F%2Falkanka.com"
                target="_blank"
                rel="noreferrer"
                className="text-primary underline underline-offset-2"
              >
                Sharing Debugger
              </a>
              {"'da \"Yeniden kazı\" de."}
            </span>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-primary px-5 py-2 text-sm font-bold text-primary-foreground disabled:opacity-60"
        >
          {pending ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
        {state.message && (
          <p role="status" className={state.ok ? 'text-sm text-primary' : 'text-sm text-destructive'}>
            {state.message}
          </p>
        )}
      </div>
    </form>
  )
}
