'use client'

import { useRef, useState } from 'react'
import { ImageIcon, Images, Loader2, Upload, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export async function uploadPanelImage(file: File, id = 'img'): Promise<string> {
  const body = new FormData()
  body.append('file', file)
  body.append('id', id)
  const res = await fetch('/api/logo-upload', { method: 'POST', body })
  const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string }
  if (!res.ok || !data.url) throw new Error(data.error ?? 'Yükleme başarısız oldu.')
  return data.url
}

export function ImageField({
  name,
  label,
  hint,
  value,
  defaultValue = '',
  onChange,
  library,
  uploadId = 'img',
  placeholder = 'https://… veya /images/…',
  previewClassName = 'aspect-video w-full',
  compact = false,
}: {
  name?: string
  label?: string
  hint?: string
  value?: string
  defaultValue?: string
  onChange?: (url: string) => void
  library?: string[]
  uploadId?: string
  placeholder?: string
  previewClassName?: string
  compact?: boolean
}) {
  const [inner, setInner] = useState(defaultValue)
  const url = value ?? inner
  const set = (next: string) => {
    if (value === undefined) setInner(next)
    onChange?.(next)
  }
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [picker, setPicker] = useState(false)

  async function handleFile(file: File) {
    setBusy(true)
    setError('')
    try {
      set(await uploadPanelImage(file, uploadId))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Yükleme başarısız oldu.')
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {label && <span className="text-xs font-semibold text-foreground">{label}</span>}
      <div className={cn('flex gap-3', compact ? 'items-center' : 'flex-col sm:flex-row sm:items-start')}>
        <div
          className={cn(
            'relative flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed border-border bg-background',
            compact ? 'size-14' : cn(previewClassName, 'sm:w-48'),
          )}
        >
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element -- preview of uploaded or linked image
            <img src={url} alt="" className="size-full object-contain" />
          ) : (
            <ImageIcon className="size-6 text-muted-foreground" aria-hidden="true" />
          )}
          {url && (
            <button
              type="button"
              onClick={() => set('')}
              aria-label="Görseli kaldır"
              className="absolute right-1 top-1 rounded-full bg-card/90 p-1 text-foreground hover:bg-card"
            >
              <X className="size-3" aria-hidden="true" />
            </button>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          {name && <input type="hidden" name={name} value={url} />}
          <input
            value={url}
            onChange={(e) => set(e.target.value)}
            placeholder={placeholder}
            inputMode="url"
            aria-label={label ? `${label} linki` : 'Görsel linki'}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
          />
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleFile(f)
              }}
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-1.5 rounded-md border border-primary/40 bg-card px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10 disabled:opacity-50"
            >
              {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Upload className="size-3.5" aria-hidden="true" />}
              {busy ? 'Yükleniyor…' : 'Bilgisayardan yükle'}
            </button>
            {library && library.length > 0 && (
              <button
                type="button"
                onClick={() => setPicker((p) => !p)}
                aria-expanded={picker}
                className="flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary"
              >
                <Images className="size-3.5" aria-hidden="true" />
                {picker ? 'Galeriyi kapat' : 'Galeriden seç'}
              </button>
            )}
          </div>
          {hint && <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p>}
          {error && (
            <p role="alert" className="text-xs text-live">
              {error}
            </p>
          )}
        </div>
      </div>
      {picker && library && (
        <ul className="grid max-h-64 grid-cols-3 gap-2 overflow-y-auto rounded-lg border border-border bg-background p-2 sm:grid-cols-5">
          {library.map((src) => (
            <li key={src}>
              <button
                type="button"
                onClick={() => {
                  set(src)
                  setPicker(false)
                }}
                className={cn(
                  'block aspect-video w-full overflow-hidden rounded-md border-2',
                  src === url ? 'border-primary' : 'border-transparent hover:border-border',
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- gallery thumbnail */}
                <img src={src} alt="" className="size-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="sr-only">PNG, JPG, WEBP, SVG veya GIF, en fazla 2 MB.</p>
    </div>
  )
}
