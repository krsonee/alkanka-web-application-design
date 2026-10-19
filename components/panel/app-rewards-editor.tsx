'use client'

import { useActionState } from 'react'
import { Gift, Loader2, Save } from 'lucide-react'
import { saveAppSettings } from '@/app/panel/app-settings-actions'
import type { ActionState } from '@/app/panel/actions'
import { APP_LIMITS, type AppSettings } from '@/lib/app-config'

const input =
  'rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none'

export function AppRewardsEditor({ settings }: { settings: AppSettings }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveAppSettings, {})
  return (
    <form action={action} className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        <Gift className="size-5 text-primary" aria-hidden />
        <h2 className="font-display text-xl font-bold uppercase text-foreground">Uygulama ödülleri</h2>
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Üye başına bir kez verilir. Bildirim ödülü aynı cihazla ikinci hesaba tekrar verilmez. 0 yazarsan ödül kapanır.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-xs font-semibold text-muted-foreground">
          Ana ekrana ekleme bonusu (KC)
          <input name="installBonus" type="number" min={0} max={APP_LIMITS.installBonus} defaultValue={settings.installBonus} className={input} />
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-semibold text-muted-foreground">
          Bildirim açma bonusu (KC)
          <input name="pushBonus" type="number" min={0} max={APP_LIMITS.pushBonus} defaultValue={settings.pushBonus} className={input} />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50"
        >
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Save className="size-4" aria-hidden />}
          Kaydet
        </button>
        {state.message ? (
          <p role="status" className={state.ok ? 'text-sm text-primary' : 'text-sm text-destructive'}>
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  )
}
