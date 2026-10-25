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
        accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
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
  const [filter, setFilter] = useState<'all' | 'filled' | 'empty'>('all')
  const [dragOver, setDragOver] = useState('')
  const q = query.trim().toLocaleLowerCase('tr')
  const filled = items.filter((i) => urls[i.id]).length

  async function dropUpload(item: LogoItem, file: File) {
    setDragOver('')
    if (!file.type.startsWith('image/')) return setUploadError(`${item.label}: sadece görsel dosyası bırakabilirsin.`)
    setUploadError('')
    try {
      const body = new FormData()
      body.append('file', file)
      body.append('id', item.id)
      const res = await fetch('/api/logo-upload', { method: 'POST', body })
      const data = (await res.json()) as { url?: string; error?: string }
      if (!res.ok || !data.url) throw new Error(data.error ?? 'Yükleme başarısız oldu.')
      setUrls((u) => ({ ...u, [item.id]: data.url! }))
    } catch (e) {
      setUploadError(`${item.label}: ${e instanceof Error ? e.message : 'Yükleme başarısız oldu.'}`)
    }
  }

  return (
    <form action={action} className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4">
      <input type="hidden" name="kind" value={kind} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="font-display text-lg font-bold text-foreground">{title}</h2>
          <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded-lg bg-secondary p-1" role="tablist" aria-label="Filtre">
            {([
              ['all', `Tümü ${items.length}`],
              ['filled', `Logolu ${filled}`],
              ['empty', `Eksik ${items.length - filled}`],
            ] as const).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={filter === id}
                onClick={() => setFilter(id)}
                className={cn(
                  'rounded-md px-2.5 py-1 text-xs tabular-nums',
                  filter === id ? 'bg-card font-semibold text-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {label}
              </button>
            ))}
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
      </div>
      <div className="flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${items.length ? (filled / items.length) * 100 : 0}%` }} />
        </div>
        <span className="text-xs tabular-nums text-muted-foreground">{`${filled}/${items.length} logo hazır · dosyayı satırın üstüne sürükleyip bırakabilirsin`}</span>
      </div>

      <ul className="grid gap-2 md:grid-cols-2">
        {items.map((item) => {
          const url = urls[item.id] ?? ''
          const hidden =
            (q && !item.label.toLocaleLowerCase('tr').includes(q)) || (filter === 'filled' && !url) || (filter === 'empty' && !!url)
          return (
            <li
              key={item.id}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(item.id)
              }}
              onDragLeave={() => setDragOver((d) => (d === item.id ? '' : d))}
              onDrop={(e) => {
                e.preventDefault()
                const file = e.dataTransfer.files?.[0]
                if (file) dropUpload(item, file)
              }}
              className={cn(
                'flex items-center gap-3 rounded-xl border bg-background p-2 transition-colors',
                dragOver === item.id ? 'border-primary bg-primary/10' : url ? 'border-border' : 'border-dashed border-border',
                hidden && 'hidden',
              )}
            >
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
          Link yapıştır ya da yükle butonuyla dosya seç (PNG, JPG, WEBP, SVG · en fazla 2 MB). Kaydetmeyi unutma.
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
