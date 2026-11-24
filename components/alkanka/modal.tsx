'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Modal({
  open,
  onClose,
  title,
  children,
  className,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  className?: string
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-label={title}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      // Phones: a sheet that rises from the bottom edge. From tablets up: the centered window.
      className={cn(
        'm-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-hidden rounded-2xl border border-border bg-card p-0 text-foreground shadow-2xl backdrop:bg-background/80 backdrop:backdrop-blur-sm open:animate-pop max-sm:mb-0 max-sm:w-full max-sm:max-w-none max-sm:rounded-b-none max-sm:rounded-t-3xl max-sm:border-x-0 max-sm:border-b-0 max-sm:open:animate-rise',
        className,
      )}
    >
      {open && (
        <div className="relative flex max-h-[90dvh] flex-col overflow-y-auto max-sm:pb-[env(safe-area-inset-bottom)]">
          <span aria-hidden="true" className="absolute left-1/2 top-2 z-10 h-1 w-10 -translate-x-1/2 rounded-full bg-foreground/25 sm:hidden" />
          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            className="absolute top-3 right-3 z-10 flex size-8 items-center justify-center rounded-full bg-background/80 text-muted-foreground transition-colors hover:text-foreground max-sm:size-11"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
          {children}
        </div>
      )}
    </dialog>
  )
}
