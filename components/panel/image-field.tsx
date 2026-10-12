'use client'

import { useState } from 'react'
import { Loader2, Upload } from 'lucide-react'
import { cn } from '@/lib/utils'

const input =
  'h-9 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none'

export async function uploadPanelImage(file: File) {
  const body = new FormData()
  body.set('file', file)
  body.set('name', 'panel')
  const res = await fetch('/api/admin/upload-logo', { method: 'POST', body })
  const data = (await res.json().catch(() => null)) as { url?: string; error?: string } | null
  if (!res.ok || !data?.url) throw new Error(data?.error || 'Yüklenemedi')
  return data.url
}

export function ImageField({
  value,
  onChange,
  placeholder,
  label = 'Görsel',
  name,
  className,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  label?: string
  name?: string
  className?: string
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function onFile(file: File) {
    setBusy(true)
    setError('')
    try {
      onChange(await uploadPanelImage(file))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Yüklenemedi')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {name ? <input type="hidden" name={name} value={value} /> : null}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          aria-label={label}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? 'https://… veya /images/…'}
          className={input}
        />
        <label className="inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-primary/40 bg-card px-3 text-xs font-semibold text-primary hover:bg-primary/10">
          {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Upload className="size-3.5" aria-hidden />}
          {busy ? 'Yükleniyor…' : 'Bilgisayardan yükle'}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="sr-only"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void onFile(file)
              e.target.value = ''
            }}
          />
        </label>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">PNG, JPG, WEBP veya GIF. Hareketli GIF olduğu gibi kalır. Link de yapıştırabilirsin.</p>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}
