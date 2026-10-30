'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import useSWR from 'swr'
import { Loader2, MessageCircle, Send, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePoints } from '../points-context'
import { useIdle } from '../use-idle'
import { MemberAvatar } from '../member-avatar'
import { AudienceSwitch, chatFetcher, ONLY_EMOJI, QUICK } from './table-chat'
import { playSound } from '@/lib/sound'

type Toast = { id: number; name: string; body: string; mine: boolean }
type Floater = { id: number; emoji: string; drift: number; left: number }

const PHRASES = ['İyi şanslar', 'Helal olsun', 'Kart ver kanka', 'Yazık oldu', 'GG']

const fetcher = chatFetcher

/**
 * Mobile in-game chat that lives on the table itself: a pill in the table header, live-stream style
 * message toasts and rising emoji reactions over the felt, and a compact quick-chat panel.
 * Must be rendered inside a `relative` container (the table section).
 */
export function MobileTableChat({ tableId }: { tableId: string }) {
  const { member, requireLogin } = usePoints()
  const idle = useIdle()
  const { data, mutate } = useSWR(`/api/tables/${tableId}/chat`, fetcher, { refreshInterval: idle ? 20000 : 5000 })
  const messages = data?.messages ?? []
  const lastId = messages.at(-1)?.id ?? null

  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [floaters, setFloaters] = useState<Floater[]>([])
  const [unread, setUnread] = useState(0)
  const [partnerOnly, setPartnerOnly] = useState(false)
  const canPartner = !!data?.team
  const toPartner = canPartner && partnerOnly
  const seenRef = useRef<number | null>(null)
  const openRef = useRef(open)
  openRef.current = open

  useEffect(() => {
    if (lastId === null) return
    if (seenRef.current === null) {
      seenRef.current = lastId
      return
    }
    const fresh = messages.filter((m) => m.id > (seenRef.current ?? 0))
    seenRef.current = lastId
    if (fresh.length === 0) return
    if (fresh.some((m) => m.userId !== member?.id)) playSound('message')

    const emojis = fresh.filter((m) => ONLY_EMOJI.test(m.body))
    const texts = fresh.filter((m) => !ONLY_EMOJI.test(m.body))

    if (emojis.length) {
      const next = emojis.slice(-6).map((m, i) => ({
        id: m.id,
        emoji: [...m.body.trim()].slice(0, 2).join(''),
        drift: Math.round((Math.random() - 0.5) * 60),
        left: 62 + ((m.id * 7 + i * 11) % 28),
      }))
      setFloaters((f) => [...f, ...next].slice(-10))
      const ids = new Set(next.map((n) => n.id))
      setTimeout(() => setFloaters((f) => f.filter((x) => !ids.has(x.id))), 3000)
    }

    if (openRef.current) return
    if (texts.length) {
      const next = texts.slice(-3).map((m) => ({ id: m.id, name: m.name, body: m.body, mine: m.userId === member?.id }))
      setToasts((t) => [...t, ...next].slice(-3))
      const ids = new Set(next.map((n) => n.id))
      setTimeout(() => setToasts((t) => t.filter((x) => !ids.has(x.id))), 5000)
    }
    setUnread((u) => u + fresh.filter((m) => m.userId !== member?.id).length)
    // messages is derived from lastId; only react when a new message arrives
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastId])

  useEffect(() => {
    if (!open) return
    setUnread(0)
    setToasts([])
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const submit = async (override?: string) => {
    const body = (override ?? text).trim()
    if (!body || sending) return
    if (!requireLogin()) return
    setSending(true)
    setError(null)
    const r = await fetch(`/api/tables/${tableId}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body, partner: toPartner }),
    })
    setSending(false)
    if (!r.ok) {
      setError((await r.json().catch(() => ({}))).error ?? 'Gönderilemedi.')
      return
    }
    playSound('sent')
    if (override == null) setText('')
    mutate()
  }

  const recent = messages.slice(-6)

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={`quick-chat-${tableId}`}
        aria-label={unread > 0 ? `Masa sohbeti, ${unread} yeni mesaj` : 'Masa sohbeti'}
        className={cn(
          'relative flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold transition-colors',
          open ? 'border-primary bg-primary text-primary-foreground' : 'border-primary/40 bg-background/70 text-foreground',
        )}
      >
        <MessageCircle className="size-3.5" aria-hidden="true" />
        Sohbet
        {unread > 0 && !open && (
          <span className="absolute -top-1.5 -right-1.5 flex min-w-4 items-center justify-center rounded-full bg-live px-1 text-[10px] font-bold leading-4 text-background">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      <div className="pointer-events-none absolute inset-x-3 top-28 z-20 flex flex-col items-start gap-1.5" aria-hidden="true">
        {toasts.map((t) => (
          <p
            key={t.id}
            className="chat-toast max-w-[80%] truncate rounded-2xl rounded-tl-sm border border-primary/25 bg-background/80 px-3 py-1.5 text-xs text-foreground shadow-lg backdrop-blur-md"
          >
            <span className={cn('font-bold', t.mine ? 'text-primary' : 'text-foreground')}>{t.name} </span>
            <span className="text-muted-foreground">{t.body}</span>
          </p>
        ))}
      </div>

      <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden" aria-hidden="true">
        {floaters.map((f) => (
          <span
            key={f.id}
            className="chat-emoji-rise absolute bottom-[38%] text-3xl drop-shadow-lg"
            style={{ left: `${f.left}%`, '--drift': `${f.drift}px` } as CSSProperties}
          >
            {f.emoji}
          </span>
        ))}
      </div>

      {open && (
        <>
          <button
            type="button"
            tabIndex={-1}
            aria-label="Sohbeti kapat"
            onClick={() => setOpen(false)}
            className="absolute inset-0 z-30 cursor-default rounded-3xl bg-background/30"
          />
          <div
            id={`quick-chat-${tableId}`}
            role="dialog"
            aria-label="Masa sohbeti"
            className="animate-in fade-in slide-in-from-bottom-4 absolute inset-x-2 bottom-2 z-40 flex max-h-[50%] flex-col overflow-hidden rounded-2xl border border-primary/40 bg-card/95 shadow-2xl backdrop-blur-md duration-200"
          >
            <div className="flex items-center gap-2 border-b border-border px-3 py-2">
              <span className="size-1.5 rounded-full bg-live animate-glow" aria-hidden="true" />
              <span className="text-xs font-bold uppercase tracking-wide text-foreground">Masa sohbeti</span>
              {canPartner && (
                <span className="ml-auto">
                  <AudienceSwitch partner={partnerOnly} onChange={setPartnerOnly} compact />
                </span>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Sohbeti kapat"
                className={cn('flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary', !canPartner && 'ml-auto')}
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>

            <ol aria-live="polite" className="flex max-h-36 flex-col gap-1 overflow-y-auto px-3 py-2 text-[13px]">
              {!data && (
                <li className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> Yükleniyor
                </li>
              )}
              {data && recent.length === 0 && <li className="text-muted-foreground">Masa sessiz. İlk selamı sen ver.</li>}
              {recent.map((m) => (
                <li key={m.id} className={cn('leading-snug text-pretty', m.partner && '-mx-1.5 rounded-md bg-accent/15 px-1.5')}>
                  <MemberAvatar userId={m.userId} name={m.name} size="xs" className="mr-1.5 inline-flex align-middle" />
                  <span className={cn('font-bold', m.userId === member?.id ? 'text-primary' : 'text-foreground')}>{m.name}</span>
                  {m.partner && <span className="ml-1 text-[10px] font-semibold uppercase text-accent">eşine</span>}
                  {!m.player && <span className="ml-1 text-[10px] font-semibold uppercase text-muted-foreground">izleyici</span>}
                  <span className="text-muted-foreground">: </span>
                  <span className={cn('break-words text-foreground', ONLY_EMOJI.test(m.body) && 'align-middle text-xl leading-none')}>{m.body}</span>
                </li>
              ))}
            </ol>

            <div className="flex gap-1 overflow-x-auto px-2" role="group" aria-label="Hızlı tepki gönder">
              {QUICK.map((e) => (
                <button
                  key={e}
                  type="button"
                  disabled={sending}
                  onClick={() => void submit(e)}
                  aria-label={`${e} gönder`}
                  className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary/60 text-lg transition-transform active:scale-90 disabled:opacity-50"
                >
                  {e}
                </button>
              ))}
            </div>
            <div className="flex gap-1.5 overflow-x-auto px-2 pt-2" role="group" aria-label="Hazır mesaj gönder">
              {PHRASES.map((p) => (
                <button
                  key={p}
                  type="button"
                  disabled={sending}
                  onClick={() => void submit(p)}
                  className="shrink-0 rounded-full border border-primary/30 px-3 py-1 text-xs font-semibold text-foreground transition-colors active:bg-primary active:text-primary-foreground disabled:opacity-50"
                >
                  {p}
                </button>
              ))}
            </div>

            <form
              className="flex items-center gap-2 p-2"
              onSubmit={(e) => {
                e.preventDefault()
                void submit()
              }}
            >
              <label htmlFor={`qchat-${tableId}`} className="sr-only">
                Mesaj yaz
              </label>
              <input
                id={`qchat-${tableId}`}
                value={text}
                maxLength={200}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.nativeEvent.isComposing || e.keyCode === 229)) e.preventDefault()
                }}
                placeholder={!member ? 'Yazmak için giriş yap' : toPartner ? 'Sadece eşin görür...' : 'Masaya yaz...'}
                className="min-w-0 flex-1 rounded-full border border-border bg-background px-4 py-2 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-primary"
              />
              <button
                type="submit"
                disabled={sending || !text.trim()}
                aria-label="Gönder"
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-50"
              >
                {sending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Send className="size-4" aria-hidden="true" />}
              </button>
            </form>
            {error && (
              <p role="alert" className="px-3 pb-2 text-xs text-destructive">
                {error}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
