'use client'

import { useActionState } from 'react'
import { Loader2, Rss } from 'lucide-react'
import { saveChannelsAction } from '@/app/panel/telegram-actions'
import type { ActionState } from '@/app/panel/actions'
import { BROADCAST_CHANNELS, type BroadcastSlug } from '@/lib/telegram-channels-shared'

const input = 'rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none'

export function TelegramChannelsSetup({ usernames }: { usernames: Record<BroadcastSlug, string | null> | null }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveChannelsAction, {})

  return (
    <section aria-labelledby="tg-channels-title" className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent">
          <Rss className="size-4" aria-hidden="true" />
        </span>
        <div className="flex flex-col gap-1">
          <h2 id="tg-channels-title" className="text-base font-semibold text-foreground">
            Sohbet paneli kanalları
          </h2>
          <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
            Sağdaki Telegram Canlı panelinde Duyuru, Özel oran ve Promo kod sekmelerinde görünecek kanallar. Kanallar herkese açık
            olmalı; bot eklemene gerek yok, paylaşımlar dakikada bir otomatik çekilir. Sohbet sekmesi yukarıdaki sohbet grubunu kullanır.
          </p>
        </div>
      </div>

      <form action={action} className="flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-3">
          {BROADCAST_CHANNELS.map((c) => (
            <label key={c.slug} className="flex flex-col gap-1.5 text-sm text-foreground">
              {c.title}
              <input name={c.slug} defaultValue={usernames?.[c.slug] ? `@${usernames[c.slug]}` : ''} placeholder="@kanaladi" className={input} />
            </label>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            Kanalları kaydet
          </button>
          <p className="text-xs text-muted-foreground">Bir kanalı kaldırmak için alanı boş bırakıp kaydet.</p>
        </div>
      </form>
      {state.message && (
        <p role="status" className={`text-sm leading-relaxed ${state.ok ? 'text-primary' : 'text-destructive'}`}>
          {state.message}
        </p>
      )}
    </section>
  )
}
