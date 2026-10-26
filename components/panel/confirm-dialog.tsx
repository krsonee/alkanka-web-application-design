'use client'

import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

type Request = { message: string; resolve: (ok: boolean) => void }
type Toast = { id: number; ok: boolean; text: string }

let openDialog: ((request: Request) => void) | null = null
let pushToast: ((toast: Omit<Toast, 'id'>) => void) | null = null

const DANGER = /sil|ban|kaldır|sıfırla|geri al|sahte|varsayılan/i

/** Themed replacement for window.confirm; falls back to the native box if the host is not mounted. */
export function askConfirm(message: string): Promise<boolean> {
  if (!openDialog) return Promise.resolve(window.confirm(message))
  return new Promise((resolve) => openDialog?.({ message, resolve }))
}

/** Shows a short "saved" / error notice in the panel corner. */
export function notify(ok: boolean, text: string) {
  pushToast?.({ ok, text })
}

export function PanelFeedbackHost() {
  const [request, setRequest] = useState<Request | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  const dialogRef = useRef<HTMLDialogElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    openDialog = (next) => setRequest(next)
    let seq = 0
    pushToast = (toast) => {
      const id = ++seq
      setToasts((list) => [...list.slice(-2), { ...toast, id }])
      window.setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 3500)
    }
    return () => {
      openDialog = null
      pushToast = null
    }
  }, [])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (request && !dialog.open) {
      dialog.showModal()
      confirmRef.current?.focus()
    } else if (!request && dialog.open) dialog.close()
  }, [request])

  const answer = (ok: boolean) => {
    request?.resolve(ok)
    setRequest(null)
  }
  const danger = request ? DANGER.test(request.message) : false

  return (
    <>
      <dialog
        ref={dialogRef}
        aria-labelledby="panel-confirm-title"
        onCancel={(e) => {
          e.preventDefault()
          answer(false)
        }}
        onClick={(e) => e.target === e.currentTarget && answer(false)}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border border-border bg-card p-0 text-card-foreground shadow-xl backdrop:bg-foreground/40"
      >
        {request && (
          <div className="flex flex-col gap-5 p-5">
            <div className="flex gap-3">
              <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-full', danger ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary')}>
                <AlertTriangle className="size-4" aria-hidden="true" />
              </span>
              <div className="flex flex-col gap-1">
                <h2 id="panel-confirm-title" className="text-sm font-semibold text-foreground">
                  {danger ? 'Emin misin?' : 'Onayla'}
                </h2>
                <p className="text-pretty text-sm leading-relaxed text-muted-foreground">{request.message}</p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => answer(false)} className="h-9 rounded-md border border-border px-4 text-sm font-medium text-foreground hover:bg-secondary">
                Vazgeç
              </button>
              <button
                ref={confirmRef}
                type="button"
                onClick={() => answer(true)}
                className={cn('h-9 rounded-md px-4 text-sm font-semibold', danger ? 'bg-destructive text-destructive-foreground' : 'bg-primary text-primary-foreground')}
              >
                {danger ? 'Evet, devam et' : 'Onayla'}
              </button>
            </div>
          </div>
        )}
      </dialog>
      <div aria-live="polite" className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-end gap-2 sm:left-auto">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={cn(
              'pointer-events-auto flex max-w-sm items-center gap-2 rounded-lg border px-3.5 py-2.5 text-sm font-medium shadow-lg',
              t.ok ? 'border-success/30 bg-card text-foreground' : 'border-destructive/30 bg-card text-destructive',
            )}
          >
            {t.ok ? <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden="true" /> : <XCircle className="size-4 shrink-0" aria-hidden="true" />}
            {t.text}
          </div>
        ))}
      </div>
    </>
  )
}
