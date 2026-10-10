'use client'

import { useActionState, useState } from 'react'
import { Save } from 'lucide-react'
import { cn } from '@/lib/utils'
import { saveLogos, type ActionState } from '@/app/panel/actions'

export type LogoItem = { id: string; label: string; initials: string }

export function LogoEditor({
  kind,
  title,
  hint,
  items,
  saved,
}: {
  kind: 'sponsors' | 'teams'
  title: string
  hint: string
  items: LogoItem[]
  saved: Record<string, string>
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveLogos, {})
  const [urls, setUrls] = useState<Record<string, string>>(saved)
  const [query, setQuery] = useState('')
  const q = query.trim().toLocaleLowerCase('tr')

  return (
    <form action={action} className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4">
      <input type="hidden" name="kind" value={kind} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="font-display text-lg font-bold text-foreground">{title}</h2>
          <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p>
        </div>
        <input
          type="search"
          aria-label={`${title} içinde ara`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ara…"
          className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary sm:w-56"
        />
      </div>

      <ul className="grid gap-2 md:grid-cols-2">
        {items.map((item) => {
          const url = urls[item.id] ?? ''
          const hidden = q && !item.label.toLocaleLowerCase('tr').includes(q)
          return (
            <li key={item.id} className={cn('flex items-center gap-3 rounded-xl border border-border bg-background p-2', hidden && 'hidden')}>
              <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-primary/30 bg-card font-display text-sm font-bold text-primary">
                {url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- preview of any https logo URL
                  <img src={url || '/placeholder.svg'} alt="" className="size-full object-contain p-1" />
                ) : (
                  item.initials
                )}
              </span>
              <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs font-semibold text-foreground">
                {item.label}
                <input
                  name={`logo:${item.id}`}
                  value={url}
                  onChange={(e) => setUrls((u) => ({ ...u, [item.id]: e.target.value }))}
                  placeholder="https://…/logo.png"
                  inputMode="url"
                  className="w-full rounded-md border border-input bg-card px-2 py-1.5 text-sm font-normal text-foreground outline-none focus:border-primary"
                />
              </label>
            </li>
          )
        })}
      </ul>

      <div className="sticky bottom-0 -mx-4 -mb-4 flex flex-wrap items-center gap-3 border-t border-border bg-card/95 px-4 py-3 backdrop-blur">
        <button
          disabled={pending}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          <Save className="size-4" aria-hidden="true" />
          {pending ? 'Kaydediliyor…' : 'Logoları kaydet'}
        </button>
        <span className="text-xs text-muted-foreground">Boş bıraktığın alanlarda baş harfler görünür.</span>
        {state.message && (
          <p role="status" className={cn('text-sm', state.ok ? 'text-primary' : 'text-live')}>
            {state.message}
          </p>
        )}
      </div>
    </form>
  )
}
