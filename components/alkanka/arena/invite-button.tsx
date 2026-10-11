'use client'

import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { Check, Loader2, Send, Timer } from 'lucide-react'
import { inviteToTable } from '@/app/actions/arena'

type Status = { enabled: boolean; wait: number }

const fetcher = (url: string) => fetch(url, { cache: 'no-store' }).then((r) => r.json() as Promise<Status>)

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

export function InviteButton({ tableId }: { tableId: string }) {
  const { data } = useSWR<Status>('/api/tables/invite', fetcher, { revalidateOnFocus: false })
  const [readyAt, setReadyAt] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const serverReadyAt = data?.wait ? Date.now() + data.wait * 1000 : null
  const effectiveReadyAt = readyAt ?? serverReadyAt
  const left = effectiveReadyAt ? Math.max(0, Math.ceil((effectiveReadyAt - now) / 1000)) : 0

  useEffect(() => {
    if (!left) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [left])

  if (!data) return null

  const send = async () => {
    setBusy(true)
    setMsg(null)
    const r = await inviteToTable(tableId)
    setBusy(false)
    if ('wait' in r && r.wait) {
      setReadyAt(Date.now() + r.wait * 1000)
      setNow(Date.now())
    }
    setMsg(r.ok ? { ok: true, text: 'Davet Telegram kanalına gönderildi.' } : { ok: false, text: r.error })
  }

  const cooling = left > 0

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={send}
        disabled={busy || cooling || !data.enabled}
        className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {busy ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : cooling ? (
          <Timer className="size-4" aria-hidden="true" />
        ) : (
          <Send className="size-4" aria-hidden="true" />
        )}
        {cooling ? `Tekrar davet ${clock(left)}` : 'Oyuncu davet et'}
      </button>
      <p role="status" aria-live="polite" className="max-w-xs text-pretty text-xs leading-relaxed text-muted-foreground">
        {msg ? (
          <span className={msg.ok ? 'inline-flex items-center gap-1 text-primary' : 'text-destructive'}>
            {msg.ok && <Check className="size-3.5" aria-hidden="true" />}
            {msg.text}
          </span>
        ) : !data.enabled ? (
          'Telegram davet kanalı yakında açılıyor.'
        ) : (
          'Telegram kanalımıza "Oyuncu aranıyor" mesajı düşer. 4 dakikada bir gönderebilirsin.'
        )}
      </p>
    </div>
  )
}
