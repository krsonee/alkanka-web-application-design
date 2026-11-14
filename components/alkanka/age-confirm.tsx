'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldCheck } from 'lucide-react'
import { confirmAdult } from '@/app/actions/age'

export function AgeConfirm() {
  const router = useRouter()
  const [checked, setChecked] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const submit = () =>
    start(async () => {
      setError(null)
      try {
        await confirmAdult()
        router.refresh()
      } catch {
        setError('Onay kaydedilemedi, tekrar dene.')
      }
    })

  return (
    <div className="flex flex-col gap-3">
      <label className="flex cursor-pointer items-start gap-2.5 text-sm leading-relaxed text-foreground">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
          className="mt-1 size-4 shrink-0 accent-primary"
        />
        <span>18 yaşından büyüğüm ve bu bölümde sponsorlu içerik olduğunu biliyorum.</span>
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={!checked || pending}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ShieldCheck className="size-4" aria-hidden="true" />
          {pending ? 'Kaydediliyor...' : 'Onayla ve devam et'}
        </button>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </div>
    </div>
  )
}
