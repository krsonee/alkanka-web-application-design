'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { usePathname } from 'next/navigation'
import useSWR from 'swr'
import { ArrowRight, Send } from 'lucide-react'
import { getTelegramStripJoined } from '@/app/actions/telegram-strip'
import { usePoints } from './points-context'

const STORE_KEY = 'alkanka-tg-strip'

type Click = { sig: string; at: number }

function signature(text: string, cta: string, href: string) {
  let h = 0
  for (const ch of `${text}|${cta}|${href}`) h = (h * 31 + ch.charCodeAt(0)) | 0
  return String(h)
}

function readClick(): Click | null {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    return raw ? (JSON.parse(raw) as Click) : null
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
  onFollow,
}: {
  text: string
  cta: string
  reward: number
  href: string
  onFollow?: () => void
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onFollow}
      className="group flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-accent px-4 py-2 text-center text-accent-foreground"
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
  )
}

/**
 * Sticky bar that stays on top until the visitor follows the Telegram channel.
 * Members with a verified channel membership never see it; guests who tap it get a
 * break of `reshowDays` days, since their membership cannot be verified.
 */
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
  const { member } = usePoints()
  const sig = signature(text, cta, href)
  const mounted = useSyncExternalStore(subscribe, () => true, () => false)
  const [followed, setFollowed] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const { data: joined } = useSWR(member ? ['tg-strip-joined', member.id] : null, () => getTelegramStripJoined(), {
    revalidateOnFocus: true,
    dedupingInterval: 60_000,
  })

  const prev = mounted ? readClick() : null
  const recentlyClicked =
    !!prev && prev.sig === sig && (reshowDays === 0 || Date.now() - prev.at < reshowDays * 86_400_000)
  const hidden = !mounted || followed || joined === true || recentlyClicked || pathname.startsWith('/oyunlar/')

  useEffect(() => {
    const root = document.documentElement
    const el = ref.current
    if (hidden || !el) {
      root.style.setProperty('--tg-strip-h', '0px')
      return
    }
    const sync = () => root.style.setProperty('--tg-strip-h', `${el.offsetHeight}px`)
    sync()
    const ro = new ResizeObserver(sync)
    ro.observe(el)
    return () => {
      ro.disconnect()
      root.style.setProperty('--tg-strip-h', '0px')
    }
  }, [hidden])

  if (hidden) return null

  const follow = () => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ sig, at: Date.now() } satisfies Click))
    } catch {}
    // Let the new tab open before the bar collapses.
    setTimeout(() => setFollowed(true), 300)
  }

  return (
    <div ref={ref} className="sticky top-0 z-[46]">
      <TelegramStripView text={text} cta={cta} reward={reward} href={href} onFollow={follow} />
    </div>
  )
}
