'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'
import { useBrand } from './brand-context'
import { useLogos } from './logo-context'
import { AlkankaLogo, EMBLEM_LOGOS, LOGO_CONCEPTS } from './logos'

export function LogoSelector() {
  const { concept, setConcept } = useBrand()
  const current = LOGO_CONCEPTS.find((c) => c.id === concept)

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-background/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Logo seç</span>
        <Link href="/logolar" className="text-[11px] font-semibold text-primary hover:underline">
          Büyük gör
        </Link>
      </div>
      <div role="radiogroup" aria-label="Logo seçenekleri" className="grid grid-cols-4 gap-1.5">
        {EMBLEM_LOGOS.map((c) => {
          const selected = c.id === concept
          return (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={c.name}
              title={c.name}
              onClick={() => setConcept(c.id)}
              className={cn(
                'overflow-hidden rounded-lg border-2 transition-all',
                selected ? 'border-primary scale-105' : 'border-transparent opacity-70 hover:opacity-100',
              )}
            >
              <img src={c.image} alt="" className="aspect-square w-full object-cover" />
            </button>
          )
        })}
      </div>
      <span className="truncate text-xs text-muted-foreground">
        Seçili: <span className="font-semibold text-foreground">{current?.name}</span>
      </span>
    </div>
  )
}

export function BrandLogo({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const { concept } = useBrand()
  const custom = useLogos().brand
  if (custom?.logoUrl) {
    const height = size === 'sm' ? Math.round((custom.logoHeight ?? 36) * 0.85) : custom.logoHeight ?? 36
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={custom.logoUrl || '/placeholder.svg'} alt="AL KANKA" style={{ height }} className="w-auto max-w-44 object-contain" />
    )
  }
  return <AlkankaLogo concept={concept} size={size} />
}
