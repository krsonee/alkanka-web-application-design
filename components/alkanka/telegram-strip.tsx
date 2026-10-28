'use client'

import { useSyncExternalStore, useState } from 'react'
import { usePathname } from 'next/navigation'
import { ArrowRight, Send, X } from 'lucide-react'

const STORE_KEY = 'alkanka-tg-strip'

type Dismissal = { sig: string; at: number }

function signature(text: string, cta: string) {
  let h = 0
  for (const ch of `${text}|${cta}`) h = (h * 31 + ch.charCodeAt(0)) | 0
  return String(h)
}

function readDismissal(): Dismissal | null {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    return raw ? (JSON.parse(raw) as Dismissal) : null
  } catch {
    return null
  }
}

const subscribe = () => () => {}

export function TelegramStripView({
  text,
  cta,
  reward,
  href,
  onClose,
}: {
  text: string
  cta: string
  reward: number
  href: string
  onClose: () => void
}) {
  return (
    <div className="relative flex items-center justify-center gap-2 bg-accent px-10 py-2 text-accent-foreground sm:gap-3">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onClose}
        className="group flex min-w-0 flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center"
      >
        <span className="flex min-w-0 items-center gap-2 text-xs font-medium leading-snug sm:text-sm">
          <Send className="size-4 shrink-0" aria-hidden="true" />
          <span className="text-pretty">{text}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-accent-foreground px-3 py-1 text-xs font-bold text-accent transition-transform group-hover:translate-x-0.5">
          {cta}
          {reward > 0 && <span className="rounded-full bg-primary px-1.5 text-[11px] leading-4 text-primary-foreground">+{reward} KP</span>}
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </span>
      </a>
      <button
        type="button"
        onClick={onClose}
        aria-label="Şeridi kapat"
        className="absolute top-1/2 right-2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full transition-colors hover:bg-accent-foreground/15"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  )
}

/** Thin dismissible bar at the top of the site that sends visitors to the Telegram channel. */
export function TelegramStrip({
  text,
  cta,
  reward,
  href,
  reshowDays,
}: {
  text: string
  cta: string
  reward: number
  href: string
  reshowDays: number
}) {
  const pathname = usePathname()
  const sig = signature(text, cta)
  const mounted = useSyncExternalStore(subscribe, () => true, () => false)
  const [closed, setClosed] = useState(false)

  if (!mounted || closed || pathname.startsWith('/oyunlar/')) return null

  const prev = readDismissal()
  if (prev && prev.sig === sig) {
    const expired = reshowDays > 0 && Date.now() - prev.at > reshowDays * 86_400_000
    if (!expired) return null
  }

  const close = () => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ sig, at: Date.now() } satisfies Dismissal))
    } catch {}
    setClosed(true)
  }

  return <TelegramStripView text={text} cta={cta} reward={reward} href={href} onClose={close} />
}
