'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

type Result = { ok: true; message?: string; balance?: number } | { ok: false; error: string }

export function useAction() {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null)

  function run(fn: () => Promise<Result>, onOk?: (r: Extract<Result, { ok: true }>) => void) {
    setStatus(null)
    start(async () => {
      const r = await fn()
      if (r.ok) {
        if (r.message) setStatus({ ok: true, text: r.message })
        onOk?.(r)
        router.refresh()
      } else {
        setStatus({ ok: false, text: r.error })
      }
    })
  }

  return { pending, status, run, setStatus }
}

export function StatusLine({ status }: { status: { ok: boolean; text: string } | null }) {
  if (!status) return null
  return (
    <p role="status" className={status.ok ? 'text-xs font-medium text-primary' : 'text-xs font-medium text-destructive'}>
      {status.text}
    </p>
  )
}
