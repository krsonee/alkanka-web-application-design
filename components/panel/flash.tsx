'use client'

import { useEffect, useRef, useState } from 'react'
import { useAction } from '@/components/alkanka/community/use-action'
import { notify } from '@/components/panel/confirm-dialog'
import { cn } from '@/lib/utils'

const ACTION_EVENT = 'panel:action'

function isServerAction(init?: RequestInit) {
  if (!init || String(init.method ?? '').toUpperCase() !== 'POST' || !init.headers) return false
  if (init.headers instanceof Headers) return init.headers.has('next-action')
  const names = Array.isArray(init.headers) ? init.headers.map(([name]) => name) : Object.keys(init.headers)
  return names.some((name) => name.toLowerCase() === 'next-action')
}

/**
 * Announces every server action as it starts, so a result line left over from an earlier action
 * can step aside instead of looking like the outcome of the new one.
 */
export function useActionPulse() {
  useEffect(() => {
    const original = window.fetch
    const patched: typeof window.fetch = (input, init) => {
      try {
        if (isServerAction(init)) window.dispatchEvent(new Event(ACTION_EVENT))
      } catch {
        // Announcing is a nicety; the request itself must never be affected.
      }
      return original(input, init)
    }
    window.fetch = patched
    return () => {
      if (window.fetch === patched) window.fetch = original
    }
  }, [])
}

/**
 * Result line for a panel action. It hides as soon as any other action starts and returns when
 * `token` changes, so pass the object the action returned rather than its text.
 */
export function Flash({ ok, text, token, className }: { ok?: boolean; text?: string | null; token?: unknown; className?: string }) {
  const key = token ?? text
  const latest = useRef(key)
  latest.current = key
  const [dismissed, setDismissed] = useState<unknown>(undefined)

  useEffect(() => {
    const hide = () => setDismissed(latest.current)
    window.addEventListener(ACTION_EVENT, hide)
    return () => window.removeEventListener(ACTION_EVENT, hide)
  }, [])

  if (!text || dismissed === key) return null
  return (
    <p role="status" className={cn('text-sm', ok ? 'text-primary' : 'text-destructive', className)}>
      {text}
    </p>
  )
}

/** The shared action runner, plus a corner notice: rows often leave the list on success and take their own status line with them. */
export function usePanelAction(done = 'Kaydedildi.') {
  const base = useAction()
  const run: typeof base.run = (fn, onOk) =>
    base.run(async () => {
      const result = await fn()
      notify(result.ok, result.ok ? result.message || done : result.error)
      return result
    }, onOk)
  return { ...base, run }
}
