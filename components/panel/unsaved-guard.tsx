'use client'

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { RotateCcw, Save } from 'lucide-react'

function formState(form: HTMLFormElement) {
  const parts: string[] = []
  for (const el of Array.from(form.elements)) {
    if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement)) continue
    if (el.dataset.noGuard !== undefined) continue
    if (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio')) parts.push(`${el.name}:${el.checked}`)
    else if (el instanceof HTMLInputElement && el.type === 'file') parts.push(`${el.name}#${el.files?.length ?? 0}`)
    else parts.push(`${el.name}=${el.value}`)
  }
  return parts.join('\u0001')
}

export function useUnsavedGuard(ref: RefObject<HTMLElement | null>) {
  const [dirty, setDirty] = useState<Set<HTMLFormElement>>(() => new Set())
  // What each form held before it was touched; null when the first change came without a chance to look.
  const baseline = useRef(new WeakMap<HTMLFormElement, string | null>())

  useEffect(() => {
    const root = ref.current
    if (!root) return
    const guarded = (e: Event) => {
      const target = e.target as HTMLElement | null
      const form = target?.closest('form')
      return form && form.dataset.noGuard === undefined && target?.dataset.noGuard === undefined ? form : null
    }
    const remember = (e: Event) => {
      const form = guarded(e)
      if (form && !baseline.current.has(form)) baseline.current.set(form, formState(form))
    }
    const mark = (e: Event) => {
      const form = guarded(e)
      if (!form) return
      if (!baseline.current.has(form)) baseline.current.set(form, null)
      const before = baseline.current.get(form)
      // Compared after React has settled the fields: a change typed back to where it started is not a change.
      setTimeout(() => {
        // Saved or reset in the meantime (Enter fires change and submit in one go).
        if (baseline.current.get(form) !== before) return
        const same = before != null && form.isConnected && formState(form) === before
        setDirty((prev) => {
          if (prev.has(form) !== same) return prev
          const next = new Set(prev)
          if (same) next.delete(form)
          else next.add(form)
          return next
        })
      }, 0)
    }
    const unmark = (e: Event) => {
      const form = e.target as HTMLFormElement
      baseline.current.delete(form)
      setDirty((prev) => {
        if (!prev.has(form)) return prev
        const next = new Set(prev)
        next.delete(form)
        return next
      })
    }
    root.addEventListener('focusin', remember)
    root.addEventListener('pointerdown', remember, true)
    root.addEventListener('input', mark)
    root.addEventListener('change', mark)
    root.addEventListener('submit', unmark, true)
    root.addEventListener('reset', unmark, true)
    return () => {
      root.removeEventListener('focusin', remember)
      root.removeEventListener('pointerdown', remember, true)
      root.removeEventListener('input', mark)
      root.removeEventListener('change', mark)
      root.removeEventListener('submit', unmark, true)
      root.removeEventListener('reset', unmark, true)
    }
  }, [ref])

  const live = [...dirty].filter((f) => f.isConnected)
  const count = live.length

  useEffect(() => {
    if (!count) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [count])

  const clear = useCallback(() => setDirty(new Set()), [])
  const saveAll = () => live.forEach((f) => f.requestSubmit())
  const discardAll = () => {
    live.forEach((f) => f.reset())
    clear()
  }
  return { count, saveAll, discardAll, clear }
}

export function UnsavedBar({ count, onSave, onDiscard }: { count: number; onSave: () => void; onDiscard: () => void }) {
  if (!count) return null
  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-4 z-40 flex justify-center pl-72 animate-in fade-in slide-in-from-bottom-2"
    >
      <div className="flex items-center gap-4 rounded-xl border border-primary/40 bg-card px-4 py-2.5 shadow-lg">
        <span className="size-2 rounded-full bg-primary" aria-hidden="true" />
        <span className="text-sm text-foreground">
          Kaydedilmemiş değişiklik var
          {count > 1 && <span className="text-muted-foreground">{` · ${count} bölüm`}</span>}
        </span>
        <button
          type="button"
          onClick={onDiscard}
          className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-[13px] text-foreground hover:bg-secondary"
        >
          <RotateCcw className="size-3.5" aria-hidden="true" />
          Vazgeç
        </button>
        <button
          type="button"
          onClick={onSave}
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[13px] font-semibold text-primary-foreground hover:opacity-90"
        >
          <Save className="size-3.5" aria-hidden="true" />
          {count > 1 ? 'Hepsini kaydet' : 'Kaydet'}
        </button>
      </div>
    </div>
  )
}
