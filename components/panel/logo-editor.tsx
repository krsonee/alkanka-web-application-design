'use client'

import { useActionState, useRef, useState } from 'react'
import { Loader2, Save, Upload } from 'lucide-react'
import { cn } from '@/lib/utils'
import { saveLogos, type ActionState } from '@/app/panel/actions'

export type LogoItem = { id: string; label: string; initials: string }

function UploadButton({
  id,
  label,
  onUploaded,
  onError,
}: {
  id: string
  label: string
  onUploaded: (url: string) => void
  onError: (message: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  async function upload(file: File) {
    setBusy(true)
    onError('')
    try {
      const body = new FormData()
      body.append('file', file)
      body.append('id', id)
      const res = await fetch('/api/logo-upload', { method: 'POST', body })
      const data = (await res.json()) as { url?: string; error?: string }
      if (!res.ok || !data.url) throw new Error(data.error ?? 'Yükleme başarısız oldu.')
      onUploaded(data.url)
    } catch (e) {
      onError(`${label}: ${e instanceof Error ? e.message : 'Yükleme başarısız oldu.'}`)
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) upload(file)
        }}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        aria-label={`${label} için logo dosyası yükle`}
        className="flex shrink-0 items-center gap-1.5 rounded-md border border-primary/40 bg-card px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10 disabled:opacity-50"
      >
        {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Upload className="size-3.5" aria-hidden="true" />}
        <span className="hidden sm:inline">{busy ? 'Yükleniyor' : 'Yükle'}</span>
      </button>
    </>
  )
}

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
  const [uploadError, setUploadError] = useState('')
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
                <span className="flex items-center gap-2">
                  <input
                    name={`logo:${item.id}`}
                    value={url}
                    onChange={(e) => setUrls((u) => ({ ...u, [item.id]: e.target.value }))}
                    placeholder="https://…/logo.png"
                    inputMode="url"
                    className="min-w-0 flex-1 rounded-md border border-input bg-card px-2 py-1.5 text-sm font-normal text-foreground outline-none focus:border-primary"
                  />
                  <UploadButton
                    id={item.id}
                    label={item.label}
                    onUploaded={(next) => setUrls((u) => ({ ...u, [item.id]: next }))}
                    onError={setUploadError}
                  />
                </span>
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
        <span className="text-xs text-muted-foreground">
          Link yapıştır ya da bilgisayardan yükle (PNG, JPG, WEBP, GIF · en fazla 8 MB). Kaydetmeyi unutma.
        </span>
        {uploadError && (
          <p role="alert" className="text-sm text-live">
            {uploadError}
          </p>
        )}
        {state.message && (
          <p role="status" className={cn('text-sm', state.ok ? 'text-primary' : 'text-live')}>
            {state.message}
          </p>
        )}
      </div>
    </form>
  )
}
