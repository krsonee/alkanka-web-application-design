'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { QUICK_TILES } from './data'

function DistributedCounter({ total }: { total: number }) {
  const [value, setValue] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
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

  return (
    <div ref={ref} className="panel-gold flex flex-col items-center justify-between gap-2 rounded-2xl px-6 py-5 text-center sm:flex-row sm:text-left">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Bugüne kadar topluluğa</p>
      <p className="font-display text-3xl font-bold text-primary tabular-nums sm:text-4xl">
        {value.toLocaleString('tr-TR')} <span className="text-lg text-foreground">Kanka Coin</span>
      </p>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">dağıttık</p>
    </div>
  )
}

export function QuickTiles({ coins = 0 }: { coins?: number }) {
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
      {coins > 0 ? <DistributedCounter total={coins} /> : null}
    </section>
  )
}
