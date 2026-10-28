'use client'

import { useActionState, useState } from 'react'
import { Loader2, Megaphone, Save } from 'lucide-react'
import { saveTelegramPromoAction } from '@/app/panel/telegram-promo-actions'
import type { ActionState } from '@/app/panel/actions'
import type { TelegramPromoSettings } from '@/lib/telegram-promo-config'
import { TelegramStripView } from '@/components/alkanka/telegram-strip'

const input = 'rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none'

export function TelegramPromoEditor({ settings, fallbackUrl }: { settings: TelegramPromoSettings; fallbackUrl: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveTelegramPromoAction, {})
  const [text, setText] = useState(settings.text)
  const [cta, setCta] = useState(settings.cta)
  const [reward, setReward] = useState(settings.reward)

  return (
    <form action={action} className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        <Megaphone className="size-5 text-primary" aria-hidden />
        <h2 className="font-display text-lg font-bold text-foreground">Site şeridi (Telegram çağrısı)</h2>
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Sitenin en üstünde çıkan ince şerit. Ziyaretçi kapatırsa belirlediğin gün sonra tekrar görür. Yazıyı değiştirirsen herkese hemen yeniden
        çıkar. Oyun masalarında gösterilmez.
      </p>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold text-muted-foreground">Önizleme</span>
        <div className="overflow-hidden rounded-xl border border-border">
          <TelegramStripView text={text} cta={cta} reward={reward} href="#" onClose={() => {}} />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm font-medium text-foreground">
        <input type="checkbox" name="enabled" defaultChecked={settings.enabled} className="size-4 accent-[var(--primary)]" />
        Şerit açık
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="text-sm font-medium text-foreground">Yazı</span>
          <input name="text" value={text} onChange={(e) => setText(e.target.value)} maxLength={140} className={input} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-foreground">Buton yazısı</span>
          <input name="cta" value={cta} onChange={(e) => setCta(e.target.value)} maxLength={30} className={input} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-foreground">Ödül rozeti (KP, 0 = gizle)</span>
          <input name="reward" type="number" min={0} value={reward} onChange={(e) => setReward(Number(e.target.value) || 0)} className={input} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-foreground">Link (boş = ana kanal)</span>
          <input name="url" defaultValue={settings.url} placeholder={fallbackUrl} className={input} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-foreground">Kapatınca tekrar gösterme (gün, 0 = gösterme)</span>
          <input name="reshowDays" type="number" min={0} max={60} defaultValue={settings.reshowDays} className={input} />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60"
        >
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Save className="size-4" aria-hidden />}
          Kaydet
        </button>
        {state.message && (
          <p role="status" className={state.ok ? 'text-sm text-live' : 'text-sm text-destructive'}>
            {state.message}
          </p>
        )}
      </div>
    </form>
  )
}
