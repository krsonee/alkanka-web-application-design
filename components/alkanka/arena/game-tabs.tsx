'use client'

import Link from 'next/link'
import { useEffect, useRef } from 'react'

export function GameTabs({ items, current }: { items: { key: string; title: string }[]; current: string }) {
  const navRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const nav = navRef.current
    const active = nav?.querySelector<HTMLElement>('[aria-current="page"]')
    if (!nav || !active) return
    nav.scrollLeft = active.offsetLeft - nav.clientWidth / 2 + active.clientWidth / 2
  }, [current])

  return (
    <nav
      ref={navRef}
      aria-label="Oyun seç"
      className="flex w-full max-w-full gap-1 overflow-x-auto rounded-lg border border-border bg-card p-1 [scrollbar-width:none] sm:w-auto"
    >
      {items.map((it) => (
        <Link
          key={it.key}
          href={`/oyunlar/${it.key}`}
          aria-current={it.key === current ? 'page' : undefined}
          className="shrink-0 rounded-md px-3 py-1.5 text-sm font-semibold text-muted-foreground aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground"
        >
          {it.title}
        </Link>
      ))}
    </nav>
  )
}
