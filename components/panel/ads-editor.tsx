'use client'

import { useActionState, useState } from 'react'
import { saveAds, type ActionState } from '@/app/panel/actions'
import { ImageField } from '@/components/panel/image-field'
import { AD_PAGES, AD_POSITIONS, type AdMap } from '@/lib/ads-shared'

const input =
  'h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none'

export function AdsEditor({ saved }: { saved: AdMap }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveAds, {})

  return (
    <form action={action} className="flex flex-col gap-5 rounded-xl border border-border bg-card p-5">
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-lg font-bold uppercase text-foreground">Sponsor reklam alanları</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Her sayfada üst banner ile sol ve sağ kule alanı var. GIF, PNG veya JPG linki yapıştır. Boş bıraktığın alan sitede görünmez.
          Kuleler geniş ekranda içeriğin iki yanında sabit durur, mobilde içeriğin altına iner.
        </p>
      </div>
      {AD_PAGES.map((page) => (
        <fieldset key={page.id} className="flex flex-col gap-3 rounded-lg border border-border p-4">
          <legend className="px-1 text-sm font-bold text-foreground">{page.label}</legend>
          <div className="grid gap-4 lg:grid-cols-3">
            {AD_POSITIONS.map((pos) => {
              const key = `${page.id}:${pos.id}` as const
              const slot = saved[key]
              return (
                <div key={key} className="flex flex-col gap-2">
                  <span className="flex items-baseline justify-between gap-2 text-xs font-semibold text-foreground">
                    {pos.label}
                    <span className="font-normal text-muted-foreground">{pos.size}</span>
                  </span>
                  <AdImage name={`${key}:image`} initial={slot?.image} label={`${page.label} ${pos.label} görsel`} />
                  <input name={`${key}:href`} defaultValue={slot?.href} placeholder="Tıklanınca gidilecek link" aria-label={`${page.label} ${pos.label} link`} className={input} />
                  <input name={`${key}:alt`} defaultValue={slot?.alt} placeholder="Site adı (erişilebilirlik)" aria-label={`${page.label} ${pos.label} açıklama`} className={input} />
                </div>
              )
            })}
          </div>
        </fieldset>
      ))}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="h-10 rounded-lg bg-primary px-5 text-sm font-bold text-primary-foreground disabled:opacity-60">
          {pending ? 'Kaydediliyor…' : 'Reklamları kaydet'}
        </button>
        {state.message && <p className={state.ok ? 'text-sm text-live' : 'text-sm text-destructive'}>{state.message}</p>}
      </div>
    </form>
  )
}

function AdImage({ name, initial, label }: { name: string; initial?: string; label: string }) {
  const [value, setValue] = useState(initial ?? '')
  return (
    <div className="flex flex-col gap-2">
      {value ? (
        // eslint-disable-next-line @next/next/no-img-element -- preview of an admin-provided creative
        <img src={value} alt="" className="h-16 w-full rounded-md border border-border bg-background object-contain" />
      ) : null}
      <ImageField name={name} label={label} value={value} onChange={setValue} placeholder="Görsel / GIF linki (https://…)" />
    </div>
  )
}
