'use client'

import { useActionState } from 'react'
import { Save } from 'lucide-react'
import { saveTexts, type ActionState } from '@/app/panel/actions'
import { TEXT_GROUPS, type SiteTexts } from '@/lib/site-texts-shared'

export function TextsEditor({ saved }: { saved: SiteTexts }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveTexts, {})
  return (
    <form action={action} className="flex flex-col gap-6">
      <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
        Görsellerin üstündeki yazılar resmin içinde değil, sayfa metnidir. Buradan değiştirdiğin her şey web, mobil tarayıcı ve
        uygulamada aynı anda güncellenir. Boş bıraktığın alan varsayılan metne döner. Slider ve sayfa başlığı yazıları kendi
        sekmelerinden düzenlenir.
      </p>
      {TEXT_GROUPS.map((group) => (
        <section key={group.id} className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
          <div className="flex flex-col gap-1">
            <h2 className="font-display text-lg font-bold uppercase text-foreground">{group.title}</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">{group.description}</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {group.fields.map((f) => (
              <label key={f.key} className="flex flex-col gap-1.5 text-xs font-semibold text-foreground">
                {f.label}
                <input
                  name={f.key}
                  defaultValue={saved[f.key] ?? ''}
                  placeholder={f.default}
                  maxLength={f.max}
                  inputMode={f.key === 'auth.bonus' ? 'numeric' : undefined}
                  className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm font-normal text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none"
                />
                {f.hint && <span className="font-normal text-muted-foreground">{f.hint}</span>}
              </label>
            ))}
          </div>
        </section>
      ))}
      <div className="sticky bottom-4 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card/95 p-3 backdrop-blur">
        <button
          type="submit"
          disabled={pending}
          className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-bold text-primary-foreground disabled:opacity-60"
        >
          <Save className="size-4" aria-hidden="true" />
          {pending ? 'Kaydediliyor…' : 'Metinleri kaydet'}
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
