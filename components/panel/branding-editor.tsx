'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Upload } from 'lucide-react'
import { resetAppIcon, saveHeaderLogo } from '@/app/panel/branding-actions'
import { cn } from '@/lib/utils'
import { AlkankaLogo } from '@/components/alkanka/logos'

type Msg = { ok: boolean; text: string } | null

export function BrandingEditor({
  logoUrl,
  logoHeight,
  iconSrc,
  hasCustomIcon,
}: {
  logoUrl: string
  logoHeight: number
  iconSrc: string
  hasCustomIcon: boolean
}) {
  const router = useRouter()
  const [url, setUrl] = useState(logoUrl)
  const [height, setHeight] = useState(logoHeight)
  const [msg, setMsg] = useState<Msg>(null)
  const [pending, start] = useTransition()
  const [uploading, setUploading] = useState<'logo' | 'icon' | null>(null)
  const logoInput = useRef<HTMLInputElement>(null)
  const iconInput = useRef<HTMLInputElement>(null)

  async function upload(file: File, kind: 'logo' | 'icon') {
    setUploading(kind)
    setMsg(null)
    try {
      const body = new FormData()
      body.append('file', file)
      body.append('id', 'header-logo')
      const res = await fetch(kind === 'logo' ? '/api/logo-upload' : '/api/app-icon-upload', { method: 'POST', body })
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Yükleme başarısız oldu.')
      if (kind === 'logo' && data.url) {
        setUrl(data.url)
        setMsg({ ok: true, text: 'Logo yüklendi. Kaydet ile yayına al.' })
      } else {
        setMsg({ ok: true, text: 'Uygulama ikonu güncellendi. Telefonlarda yeni ikon, uygulama yeniden eklenince görünür.' })
        router.refresh()
      }
    } catch (error) {
      setMsg({ ok: false, text: error instanceof Error ? error.message : 'Yükleme başarısız oldu.' })
    } finally {
      setUploading(null)
    }
  }

  const run = (fn: () => Promise<{ ok: true; message?: string } | { ok: false; error: string }>) =>
    start(async () => {
      const res = await fn()
      setMsg(res.ok ? { ok: true, text: res.message ?? 'Kaydedildi.' } : { ok: false, text: res.error })
      if (res.ok) router.refresh()
    })

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      {msg && (
        <p className={cn('text-sm', msg.ok ? 'text-success' : 'text-destructive')} aria-live="polite">
          {msg.text}
        </p>
      )}

      <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
        <h2 className="font-semibold text-foreground">Header logosu</h2>
        <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
          Sitenin üst kısmında, yan menüde ve alt bilgide görünen logo. Yatay, şeffaf arka planlı PNG veya SVG en iyi sonucu verir. Boş bırakırsan hazır AL KANKA logosu kullanılır.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {(['dark', 'light'] as const).map((tone) => (
            <div
              key={tone}
              className={cn(
                'flex h-16 items-center justify-between gap-3 rounded-lg border border-border px-4',
                tone === 'dark' ? 'bg-background' : 'bg-foreground',
              )}
            >
              {url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={url || '/placeholder.svg'} alt={`Header logosu, ${tone === 'dark' ? 'koyu' : 'açık'} zemin`} style={{ height }} className="w-auto max-w-44 object-contain" />
              ) : (
                <AlkankaLogo concept="fist" size="md" />
              )}
              <span className={cn('text-xs', tone === 'dark' ? 'text-muted-foreground' : 'text-background/70')}>
                {tone === 'dark' ? 'Koyu zemin' : 'Açık zemin'}
              </span>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{url ? 'Özel logo kullanılıyor.' : 'Hazır AL KANKA logosu kullanılıyor.'}</p>
        <label className="flex flex-col gap-1 text-sm text-foreground">
          Yükseklik: {height}px
          <input type="range" min={20} max={64} value={height} onChange={(e) => setHeight(Number(e.target.value))} className="accent-primary" />
        </label>
        <input
          ref={logoInput}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) upload(file, 'logo')
            e.target.value = ''
          }}
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={uploading !== null}
            onClick={() => logoInput.current?.click()}
            className="flex h-10 items-center gap-2 rounded-lg border border-border px-4 text-sm text-foreground hover:bg-secondary disabled:opacity-60"
          >
            <Upload className="size-4" aria-hidden="true" />
            {uploading === 'logo' ? 'Yükleniyor…' : 'Logo yükle'}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => saveHeaderLogo(url, height))}
            className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            Kaydet
          </button>
          {url && (
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setUrl('')
                run(() => saveHeaderLogo('', height))
              }}
              className="h-10 rounded-lg px-4 text-sm text-muted-foreground hover:text-foreground"
            >
              Varsayılana dön
            </button>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
        <h2 className="font-semibold text-foreground">Uygulama ikonu</h2>
        <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
          Telefona &quot;Ana ekrana ekle&quot; ile kurulan uygulamanın ikonu. Kare görsel yükle (en az 192, önerilen 512x512). 512, 192 ve iPhone için 180 boyutları otomatik üretilir.
        </p>
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={iconSrc || '/placeholder.svg'} alt="Uygulama ikonu önizleme" width={96} height={96} className="size-24 rounded-2xl border border-border object-cover" />
          <span className="text-sm text-muted-foreground">{hasCustomIcon ? 'Özel ikon kullanılıyor' : 'Varsayılan ikon kullanılıyor'}</span>
        </div>
        <input
          ref={iconInput}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) upload(file, 'icon')
            e.target.value = ''
          }}
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={uploading !== null}
            onClick={() => iconInput.current?.click()}
            className="flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            <Upload className="size-4" aria-hidden="true" />
            {uploading === 'icon' ? 'İşleniyor…' : 'İkon yükle'}
          </button>
          {hasCustomIcon && (
            <button
              type="button"
              disabled={pending}
              onClick={() => run(resetAppIcon)}
              className="h-10 rounded-lg px-4 text-sm text-muted-foreground hover:text-foreground"
            >
              Varsayılana dön
            </button>
          )}
        </div>
      </section>
    </div>
  )
}
