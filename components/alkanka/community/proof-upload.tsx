'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldCheck } from 'lucide-react'
import { StatusLine } from './use-action'

export function ProofUpload({ siteId, kp }: { siteId: string; kp: number }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null)

  return (
    <form
      className="flex flex-col gap-2 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3"
      onSubmit={(e) => {
        e.preventDefault()
        const form = new FormData(e.currentTarget)
        form.set('siteId', siteId)
        const el = e.currentTarget
        start(async () => {
          setStatus(null)
          const res = await fetch('/api/guven/kanit', { method: 'POST', body: form })
          const data = (await res.json().catch(() => ({}))) as { message?: string; error?: string }
          if (res.ok) {
            setStatus({ ok: true, text: data.message ?? 'Kanıtın alındı.' })
            el.reset()
            router.refresh()
          } else setStatus({ ok: false, text: data.error ?? 'Yükleme başarısız oldu.' })
        })
      }}
    >
      <span className="flex items-center gap-1.5 text-xs font-bold text-foreground">
        <ShieldCheck className="size-4 text-primary" aria-hidden />
        Yorumunu doğrula, +{kp} KP kazan
      </span>
      <span className="text-[11px] leading-relaxed text-muted-foreground">
        Sitedeki hesabından bir ekran görüntüsü ekle (yatırım, çekim veya bonus). Yalnızca ekip görür, yorumuna Doğrulanmış rozeti eklenir.
      </span>
      <input
        name="file"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        required
        className="text-xs text-muted-foreground file:mr-2 file:rounded-md file:border-0 file:bg-secondary file:px-2.5 file:py-1.5 file:text-xs file:font-semibold file:text-secondary-foreground"
      />
      <button disabled={pending} className="h-9 rounded-lg bg-secondary text-xs font-bold uppercase tracking-wider text-secondary-foreground disabled:opacity-50">
        {pending ? 'Yükleniyor...' : 'Kanıtı gönder'}
      </button>
      <StatusLine status={status} />
    </form>
  )
}
