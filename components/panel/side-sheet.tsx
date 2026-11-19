'use client'

import { useEffect, useId, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { askConfirm } from '@/components/panel/confirm-dialog'
import { cn } from '@/lib/utils'

const FIELDS = ['input', 'textarea', 'select']

function fieldsOf(root: HTMLElement, marked: boolean) {
  const parts: string[] = []
  const selector = FIELDS.map((tag) => (marked ? `[data-sheet-guard] ${tag}` : tag)).join(', ')
  for (const el of Array.from(root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(selector))) {
    if (el instanceof HTMLInputElement && el.type === 'file') continue
    if (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio')) parts.push(`${el.name}:${el.value}:${el.checked}`)
    else parts.push(`${el.name}=${el.value}`)
  }
  return parts.join('\u0001')
}

/**
 * Editing pane that slides in from the right, so the list stays where it was and it is always clear
 * which record is open. Closing with typed but unsaved changes asks first. Forms inside should carry
 * `data-no-guard`: the pane does its own unsaved check, the page-wide bar would sit behind it.
 *
 * A pane that also shows live records (lists, pickers that come and go) passes `guard="marked"`: only
 * the fields inside `[data-sheet-guard]` then count as unsaved work. `resetKey` changes when the pane's
 * content was saved or swapped, so what is shown now becomes the new starting point.
 */
export function SideSheet({
  title,
  eyebrow,
  onClose,
  children,
  footer,
  size = 'md',
  guard = 'all',
  resetKey,
}: {
  title: string
  eyebrow?: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  size?: 'md' | 'lg' | 'xl'
  guard?: 'all' | 'marked'
  resetKey?: string | number
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const start = useRef<string | null>(null)
  const titleId = useId()
  const marked = guard === 'marked'

  const changed = () => Boolean(ref.current && start.current !== null && fieldsOf(ref.current, marked) !== start.current)

  async function requestClose() {
    if (changed() && !(await askConfirm('Kaydedilmemiş değişiklikler var. Kaydetmeden kapatılsın mı?'))) return
    onClose()
  }

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (!dialog.open) dialog.showModal()
    const root = document.documentElement
    const before = root.style.overflow
    root.style.overflow = 'hidden'
    const warn = (event: BeforeUnloadEvent) => {
      if (start.current !== null && fieldsOf(dialog, marked) !== start.current) event.preventDefault()
    }
    window.addEventListener('beforeunload', warn)
    return () => {
      window.removeEventListener('beforeunload', warn)
      root.style.overflow = before
      if (dialog.open) dialog.close()
    }
  }, [marked])

  useEffect(() => {
    // Read after the fields have settled, so what the pane opened with is not mistaken for a change.
    const snap = window.setTimeout(() => {
      if (ref.current) start.current = fieldsOf(ref.current, marked)
    }, 0)
    return () => window.clearTimeout(snap)
  }, [marked, resetKey])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        void requestClose()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) void requestClose()
      }}
      className={cn(
        'fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-dvh w-full border-l border-border bg-card p-0 text-card-foreground shadow-2xl backdrop:bg-foreground/50',
        'animate-in slide-in-from-right-8 fade-in duration-200',
        size === 'xl' ? 'max-w-5xl' : size === 'lg' ? 'max-w-3xl' : 'max-w-xl',
      )}
    >
      <div className="flex h-full flex-col">
        <header className="flex shrink-0 items-start gap-3 border-b border-border px-4 py-3 sm:px-5">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            {eyebrow && <span className="truncate text-xs font-semibold uppercase tracking-wider text-muted-foreground">{eyebrow}</span>}
            <h2 id={titleId} className="truncate text-base font-semibold text-foreground">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => void requestClose()}
            aria-label="Kapat"
            className="flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">{children}</div>
        {footer && <footer className="flex shrink-0 flex-wrap items-center gap-2 border-t border-border bg-card px-4 py-3 sm:px-5">{footer}</footer>}
      </div>
    </dialog>
  )
}
