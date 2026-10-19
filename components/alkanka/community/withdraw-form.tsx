'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ImagePlus, Loader2, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const field =
  'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring'

const MAX = 5 * 1024 * 1024
const TYPES = ['image/png', 'image/jpeg', 'image/webp']

function nowLocal() {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

export function WithdrawForm({ siteId, siteName }: { siteId: string; siteName: string }) {
  const router = useRouter()
  const input = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    if (!file) return setPreview(null)
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  function pick(f: File | undefined) {
    setStatus(null)
    if (!f) return
    if (!TYPES.includes(f.type)) return setStatus({ ok: false, text: 'Sadece PNG, JPG veya WEBP yükleyebilirsin.' })
    if (f.size > MAX) return setStatus({ ok: false, text: 'Görüntü en fazla 5 MB olabilir.' })
    setFile(f)
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!file) return setStatus({ ok: false, text: 'Çekim sayfasının ekran görüntüsünü ekle.' })
    const form = new FormData(e.currentTarget)
    form.set('file', file)
    form.set('siteId', siteId)
    form.set('paidAt', new Date(String(form.get('paidAt'))).toISOString())
    setBusy(true)
    setStatus(null)
    try {
      const res = await fetch('/api/cekim', { method: 'POST', body: form })
      const data = (await res.json().catch(() => ({}))) as { message?: string; error?: string }
      if (!res.ok) throw new Error(data.error || 'Yükleme başarısız oldu.')
      setStatus({ ok: true, text: data.message || 'Onaya gönderildi.' })
      ;(e.target as HTMLFormElement).reset()
      setFile(null)
      router.refresh()
    } catch (error) {
      setStatus({ ok: false, text: error instanceof Error ? error.message : 'Yükleme başarısız oldu.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <p className="text-xs leading-relaxed text-muted-foreground">
        {siteName} çekimini paylaş, ekip onaylayınca ödülün hesabına eklenir ve çekimin herkesin görebileceği duvara düşer.
      </p>
      <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
        {siteName} kullanıcı adın
        <input name="siteUsername" required minLength={3} maxLength={40} autoComplete="off" placeholder="Sitedeki kullanıcı adın" className={field} />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
          Tutar (TL)
          <input name="amount" required inputMode="decimal" placeholder="2.500" className={field} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
          Çekim saati
          <input name="paidAt" type="datetime-local" required max={nowLocal()} defaultValue={nowLocal()} className={field} />
        </label>
      </div>

      <input ref={input} type="file" accept={TYPES.join(',')} className="sr-only" aria-label="Ekran görüntüsü" onChange={(e) => pick(e.target.files?.[0])} />
      {preview ? (
        <div className="relative overflow-hidden rounded-lg border border-border bg-background">
          <img src={preview || '/placeholder.svg'} alt="Seçilen çekim ekran görüntüsü" className="max-h-56 w-full object-contain" />
          <button
            type="button"
            onClick={() => {
              setFile(null)
              if (input.current) input.current.value = ''
            }}
            aria-label="Görüntüyü kaldır"
            className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-full bg-card/90 text-foreground"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => input.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            pick(e.dataTransfer.files?.[0])
          }}
          className="flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-primary/50 bg-primary/5 p-5 text-center transition-colors hover:bg-primary/10"
        >
          <ImagePlus className="size-6 text-primary" aria-hidden />
          <span className="text-sm font-bold text-foreground">Çekim ekran görüntüsü ekle</span>
          <span className="text-[11px] text-muted-foreground">Tutar, saat ve &quot;onaylandı&quot; durumu görünsün · max 5 MB</span>
        </button>
      )}

      <label className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
        <input name="consent" type="checkbox" required className="mt-0.5 size-4 shrink-0 accent-primary" />
        <span>Görüntüde IBAN, ad soyad ve kart bilgimi kapattım. Görüntünün Güven merkezinde ve Telegram kanalında herkese açık yayınlanmasını kabul ediyorum.</span>
      </label>

      {status && (
        <p role="status" className={cn('rounded-lg px-3 py-2 text-xs font-semibold', status.ok ? 'bg-live/15 text-live' : 'bg-destructive/15 text-destructive')}>
          {status.text}
        </p>
      )}

      <button disabled={busy} className="btn-sheen flex h-10 items-center justify-center gap-2 rounded-lg bg-primary text-xs font-bold uppercase tracking-wider text-primary-foreground disabled:opacity-60">
        {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
        Onaya gönder
      </button>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Haftada sınırlı paylaşım hakkın var. Aynı görüntü tekrar kabul edilmez, sahte paylaşım kalıcı engel ve ödül iadesi demektir.
      </p>
    </form>
  )
}
