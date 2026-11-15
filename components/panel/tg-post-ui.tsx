'use client'

import { useState, useTransition } from 'react'
import { cn } from '@/lib/utils'
import type { ActionResult } from '@/components/panel/tg-hub-ui'
import { CheckList } from '@/components/panel/tg-post-fields'
import { TR_ZONE, type TargetCheck } from '@/lib/tg-posts-shared'

export type Outcome = ActionResult & { checks?: TargetCheck[]; id?: number }
export type Run = (fn: () => Promise<Outcome>, after?: (result: Outcome) => void) => void

export function useRun() {
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<Outcome | null>(null)
  const run: Run = (fn, after) =>
    start(async () => {
      const result = await fn()
      setMsg(result)
      after?.(result)
    })
  return { pending, msg, run }
}

export function Note({ msg }: { msg: Outcome | null }) {
  if (!msg) return null
  return (
    <div className="flex flex-col gap-2">
      <p role="status" className={cn('text-sm leading-relaxed [overflow-wrap:anywhere]', msg.ok ? 'text-primary' : 'text-destructive')}>
        {msg.message}
      </p>
      {msg.checks && <CheckList checks={msg.checks} />}
    </div>
  )
}

/** The panel is run from Turkey; a fixed zone also keeps the server and the browser printing the same text. */
export const when = (iso: string | number | null) =>
  iso ? new Date(iso).toLocaleString('tr-TR', { timeZone: TR_ZONE, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'

export const badge = 'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold'
