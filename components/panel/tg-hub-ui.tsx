'use client'

import { createContext, useContext, useEffect, useRef, useState, useTransition, type ReactNode } from 'react'
import type { TelegramAccess } from '@/lib/panel-modules'
import type { KnownChat } from '@/lib/tg-hub-shared'

const NO_ACCESS: TelegramAccess = { posts: false, mod: false, setup: false, owner: false }

/**
 * Which Telegram areas the signed-in account may use. It only decides what the screen offers;
 * every server action checks the permission again.
 */
export const TgAccessContext = createContext<TelegramAccess>(NO_ACCESS)

export function useTgAccess() {
  return useContext(TgAccessContext)
}

export const OWNER_ONLY = 'Bu işlemi sadece ana yönetici yapabilir.'

/** Groups and channels the panel already has a name for; chat pickers offer these first. */
export const TgChatsContext = createContext<KnownChat[]>([])

export function useKnownChats() {
  return useContext(TgChatsContext)
}

/** Wraps the whole Telegram section once, so any form inside can read the account's access and the known chats. */
export function TgPanelProvider({ access, chats, children }: { access: TelegramAccess; chats: KnownChat[]; children: ReactNode }) {
  return (
    <TgAccessContext.Provider value={access}>
      <TgChatsContext.Provider value={chats}>{children}</TgChatsContext.Provider>
    </TgAccessContext.Provider>
  )
}

export const input = 'h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground'
export const btn = 'inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50'
export const btnGhost = 'inline-flex h-9 items-center justify-center rounded-lg border border-border px-3 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50'
export const btnDanger = 'inline-flex h-9 items-center justify-center rounded-lg border border-destructive/40 px-3 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50'
export const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—')

/**
 * Every tab of the panel is mounted at once and only the open one is visible. A screen that reads on
 * its own waits for the first time it is actually shown, so opening the panel does not pay for all of them.
 */
export function useFirstShown<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || shown) return
    const watcher = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) setShown(true)
    })
    watcher.observe(el)
    return () => watcher.disconnect()
  }, [shown])
  return { ref, shown }
}

export type ActionResult = { ok: boolean; message: string }

export function useAction() {
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<ActionResult | null>(null)
  const run = (fn: () => Promise<ActionResult>) =>
    start(async () => {
      setMsg(await fn())
    })
  const note = msg ? (
    <p role="status" className={msg.ok ? 'text-sm text-primary' : 'text-sm text-destructive'}>
      {msg.message}
    </p>
  ) : null
  return { pending, run, note }
}

export function Card({ title, hint, children }: { title: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {hint && <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </section>
  )
}

export function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start gap-3 rounded-lg border border-border p-3">
      <input type="checkbox" className="mt-1 size-4 accent-primary" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-foreground">{label}</span>
        {hint && <span className="text-xs leading-relaxed text-muted-foreground">{hint}</span>}
      </span>
    </label>
  )
}

export function NumberField({ label, value, onChange, suffix }: { label: string; value: number; onChange: (v: number) => void; suffix?: string }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
      {label}
      <span className="flex items-center gap-2">
        <input type="number" className={input} value={value} onChange={(e) => onChange(Number(e.target.value))} />
        {suffix && <span className="shrink-0 text-xs">{suffix}</span>}
      </span>
    </label>
  )
}
