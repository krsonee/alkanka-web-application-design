'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { QUICK_TILES } from './data'

function DistributedCounter({ total }: { total: number | null }) {
  const [value, setValue] = useState(total ?? 0)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (total == null || total <= 0) return
    const el = ref.current
    if (!el) return
    let raf = 0
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      observer.disconnect()
      const start = performance.now()
      const from = total * 0.82
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / 1600)
        const eased = 1 - Math.pow(1 - t, 3)
        setValue(Math.round(from + (total - from) * eased))
        if (t < 1) raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    })
    observer.observe(el)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(raf)
    }
  }, [total])

  if (total == null || total <= 0) {
    return (
      <div className="panel-gold flex items-center justify-center rounded-2xl px-6 py-5 text-center">
        <p className="text-sm font-medium text-muted-foreground">Topluluk puanı yakında burada birikecek</p>
      </div>
    )
  }

  return (
    <div
      ref={ref}
      className="panel-gold relative flex items-center justify-between gap-3 overflow-hidden rounded-xl px-4 py-2.5 sm:px-6 sm:py-3"
    >
      <span className="counter-sheen" aria-hidden="true" />
      <span className="relative flex min-w-0 items-center gap-2.5">
        <span className="relative flex size-2 shrink-0" aria-hidden="true">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60" />
          <span className="relative inline-flex size-2 rounded-full bg-primary" />
        </span>
        <span className="truncate text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          <span className="sm:hidden">Topluluğa dağıtılan</span>
          <span className="hidden sm:inline">Bugüne kadar topluluğa dağıttık</span>
        </span>
      </span>
      <p className="relative flex shrink-0 items-baseline gap-1.5 font-display font-bold tabular-nums">
        <span className="text-xl text-primary sm:text-2xl">{value.toLocaleString('tr-TR')}</span>
        <span className="text-xs uppercase tracking-wider text-foreground">Kanka Coin</span>
      </p>
    </div>
  )
}

export function QuickTiles({ distributed }: { distributed: number | null }) {
  return (
    <section aria-label="Hızlı erişim" className="flex flex-col gap-4">
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {QUICK_TILES.map((tile, i) => (
          <li key={tile.id} className="animate-rise" style={{ animationDelay: `${i * 60}ms` }}>
            <a
              href={tile.href}
              className="panel-gold group flex h-full flex-col gap-3 rounded-xl p-2.5 transition-all hover:-translate-y-0.5 hover:glow-gold"
            >
              <span className="relative block aspect-[16/10] overflow-hidden rounded-lg">
                <Image
                  src={tile.image}
                  alt=""
                  fill
                  sizes="(min-width: 1280px) 160px, (min-width: 640px) 30vw, 45vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-110"
                />
              </span>
              <span className="text-center font-display text-base font-bold text-foreground">{tile.label}</span>
              <span className="rounded-md bg-primary py-2 text-center text-[11px] font-bold uppercase tracking-wider text-primary-foreground">
                {tile.cta}
              </span>
            </a>
          </li>
        ))}
      </ul>
      <DistributedCounter total={distributed} />
    </section>
  )
}
