'use client'

import Image from 'next/image'
import { useActionState } from 'react'
import { Loader2, Save } from 'lucide-react'
import { ARENA_GAMES, ARENA_META, type ArenaSettings } from '@/lib/arena'
import { saveArenaSettings } from '@/app/admin/arena-actions'
import type { ActionState } from '@/app/admin/arena-actions'

export function ArenaSettingsEditor({ settings }: { settings: ArenaSettings }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveArenaSettings, {})
  return (
    <form action={action} className="flex flex-col gap-5">
      <div className="grid gap-5 lg:grid-cols-3">
        {ARENA_GAMES.map((g) => {
          const meta = ARENA_META[g]
          const s = settings[g]
          return (
            <fieldset key={g} className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card">
              <div className="relative aspect-[16/9]">
                <Image src={meta.image || '/placeholder.svg'} alt="" fill sizes="(min-width: 1024px) 33vw, 100vw" className="object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
                <legend className="absolute bottom-3 left-4 font-display text-2xl font-bold uppercase text-foreground">{meta.title}</legend>
              </div>
              <div className="flex flex-col gap-4 p-4">
                <label className="flex items-center justify-between gap-3 rounded-xl bg-secondary px-3 py-2.5 text-sm font-semibold text-foreground">
                  Sitede yayında
                  <input type="checkbox" name={`${g}:enabled`} defaultChecked={s.enabled} className="size-5 accent-primary" />
                </label>
                <label className="flex items-center justify-between gap-3 rounded-xl bg-secondary px-3 py-2.5 text-sm font-semibold text-foreground">
                  Kanka masası
                  <input type="hidden" name={`${g}:pvp-set`} value="1" />
                  <input type="checkbox" name={`${g}:pvp`} defaultChecked={s.pvpEnabled} className="size-5 accent-primary" />
                </label>
                <label className="flex flex-col gap-1.5 text-xs font-semibold text-muted-foreground">
                  Bahis seçenekleri (KC, virgülle ayır, en fazla 6)
                  <input name={`${g}:bets`} defaultValue={s.bets.join(', ')} className="rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none" />
                </label>
                <label className="flex flex-col gap-1.5 text-xs font-semibold text-muted-foreground">
                  Kazanç çarpanı (bahis × çarpan ödenir)
                  <input name={`${g}:multiplier`} type="number" step="0.1" min={1} max={20} defaultValue={s.multiplier} className="rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none" />
                </label>
                <p className="text-xs leading-relaxed text-muted-foreground">Oyuncu sayısı: {meta.players}</p>
              </div>
            </fieldset>
          )
        })}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60">
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />}
          Oyun ayarlarını kaydet
        </button>
        {state.message && (
          <p role="status" className={state.ok ? 'text-sm font-semibold text-primary' : 'text-sm font-semibold text-destructive'}>
            {state.message}
          </p>
        )}
      </div>
    </form>
  )
}
