'use client'

import { useActionState, useState } from 'react'
import { saveShare, type ActionState } from '@/app/panel/actions'
import { ImageField } from '@/components/panel/image-field'
import type { ShareSettings } from '@/lib/share'

const input =
  'h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none'

const FALLBACK = {
  title: 'AL KANKA | Bahis ve Casino Topluluğu',
  description: 'Güvenilir siteler, bonuslar, tahmin ligi ve oyunlar tek yerde.',
  image: '/images/og.png',
  siteName: 'AL KANKA',
}

export function ShareEditor({ saved }: { saved: ShareSettings }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveShare, {})
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
            Başlık
            <input name="title" value={draft.title} onChange={set('title')} maxLength={90} placeholder={FALLBACK.title} className={input} />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground">
            Açıklama
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
          <div className="flex flex-col gap-1.5 text-xs font-semibold text-foreground">
            Görsel / logo linki (1200×630)
            <ImageField name="image" label="Paylaşım görseli" value={draft.image} onChange={(image) => setDraft((d) => ({ ...d, image }))} placeholder="https://… veya /images/…" />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold text-muted-foreground">Önizleme</span>
          <div className="overflow-hidden rounded-xl border border-border bg-background">
            {/* eslint-disable-next-line @next/next/no-img-element -- live preview of admin-provided image */}
            <img src={view.image} alt="" className="aspect-[1200/630] w-full object-cover" />
            <div className="flex flex-col gap-1 p-3">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">alkanka.com</span>
              <span className="line-clamp-1 text-sm font-bold text-foreground">{view.title}</span>
              <span className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{view.description}</span>
            </div>
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
