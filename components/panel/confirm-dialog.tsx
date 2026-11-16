'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, MessageSquareText, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ReasonOptions = {
  /** Field label, e.g. "Red sebebi". */
  label: string
  placeholder?: string
  required?: boolean
  initial?: string
  maxLength?: number
  /** Button text, e.g. "Reddet". */
  confirm?: string
  /** One-tap answers shown above the field. */
  presets?: string[]
}

type Request = { message: string; input?: ReasonOptions; resolve: (ok: boolean, text: string) => void }
type Toast = { id: number; ok: boolean; text: string }

let openDialog: ((request: Request) => void) | null = null
let pushToast: ((toast: Omit<Toast, 'id'>) => void) | null = null

const DANGER = /sil|ban|kaldır|sıfırla|geri al|sahte|varsayılan|dondur|düşül|çıkar|kapat|geri alınamaz/i

/** Themed replacement for window.confirm; falls back to the native box if the host is not mounted. */
export function askConfirm(message: string): Promise<boolean> {
  if (!openDialog) return Promise.resolve(window.confirm(message))
  return new Promise((resolve) => openDialog?.({ message, resolve: (ok) => resolve(ok) }))
}

/** Themed replacement for window.prompt. Resolves with the trimmed text, or null when the admin backs out. */
export function askReason(message: string, input: ReasonOptions): Promise<string | null> {
  if (!openDialog) {
    const answer = window.prompt(message, input.initial ?? '')
    return Promise.resolve(answer === null ? null : answer.trim())
  }
  return new Promise((resolve) => openDialog?.({ message, input, resolve: (ok, text) => resolve(ok ? text : null) }))
}

/** Runs the action only after the admin confirms; for actions that cannot be undone. */
export function confirmed(message: string, action: () => void) {
  void askConfirm(message).then((ok) => {
    if (ok) action()
  })
}

/** Shows a short "saved" / error notice in the panel corner. */
export function notify(ok: boolean, text: string) {
  pushToast?.({ ok, text })
}

export function PanelFeedbackHost() {
  const [request, setRequest] = useState<Request | null>(null)
  const [text, setText] = useState('')
  const [toasts, setToasts] = useState<Toast[]>([])
  const dialogRef = useRef<HTMLDialogElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const inputId = useId()

  useEffect(() => {
    openDialog = (next) => {
      setText(next.input?.initial ?? '')
      setRequest(next)
    }
    let seq = 0
    pushToast = (toast) => {
      const id = ++seq
      setToasts((list) => [...list.slice(-2), { ...toast, id }])
      window.setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), toast.ok ? 3500 : 7000)
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
      if (request.input) inputRef.current?.focus()
      else confirmRef.current?.focus()
    } else if (!request && dialog.open) dialog.close()
  }, [request])

  const answer = (ok: boolean) => {
    request?.resolve(ok, text.trim())
    setRequest(null)
  }
  const input = request?.input
  const danger = request ? !input && DANGER.test(request.message) : false
  const blocked = Boolean(input?.required) && !text.trim()

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
          <form
            className="flex flex-col gap-5 p-5"
            onSubmit={(e) => {
              e.preventDefault()
              if (!blocked) answer(true)
            }}
          >
            <div className="flex gap-3">
              <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-full', danger ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary')}>
                {input ? <MessageSquareText className="size-4" aria-hidden="true" /> : <AlertTriangle className="size-4" aria-hidden="true" />}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <h2 id="panel-confirm-title" className="text-sm font-semibold text-foreground">
                  {input ? input.label : danger ? 'Emin misin?' : 'Onayla'}
                </h2>
                <p className="text-pretty text-sm leading-relaxed text-muted-foreground">{request.message}</p>
              </div>
            </div>
            {input && (
              <div className="flex flex-col gap-2">
                {input.presets?.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {input.presets.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => {
                          setText(preset)
                          inputRef.current?.focus()
                        }}
                        className="rounded-md border border-border px-2.5 py-1.5 text-left text-xs text-foreground hover:bg-secondary"
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                ) : null}
                <label htmlFor={inputId} className="sr-only">
                  {input.label}
                </label>
                <textarea
                  id={inputId}
                  ref={inputRef}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={3}
                  maxLength={input.maxLength ?? 300}
                  placeholder={input.placeholder}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                />
                <p className="text-xs text-muted-foreground">
                  {input.required ? 'Zorunlu. ' : 'İsteğe bağlı. '}
                  {`${text.length}/${input.maxLength ?? 300}`}
                </p>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => answer(false)} className="h-9 rounded-md border border-border px-4 text-sm font-medium text-foreground hover:bg-secondary">
                Vazgeç
              </button>
              <button
                ref={confirmRef}
                type="submit"
                disabled={blocked}
                className={cn('h-9 rounded-md px-4 text-sm font-semibold disabled:opacity-50', danger ? 'bg-destructive text-destructive-foreground' : 'bg-primary text-primary-foreground')}
              >
                {input ? (input.confirm ?? 'Devam et') : danger ? 'Evet, devam et' : 'Onayla'}
              </button>
            </div>
          </form>
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
