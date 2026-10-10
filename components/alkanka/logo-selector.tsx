'use client'

import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useBrand } from './brand-context'
import { AlkankaLogo, LOGO_CONCEPTS } from './logos'

export function LogoSelector() {
  const { concept, setConcept } = useBrand()

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-background/40 p-3">
      <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Logo konsepti</span>
      <div role="radiogroup" aria-label="AL KANKA logo konseptleri" className="grid grid-cols-2 gap-1.5">
        {LOGO_CONCEPTS.map((c) => {
          const selected = c.id === concept
          return (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setConcept(c.id)}
              title={c.description}
              className={cn(
                'relative flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-left text-xs transition-colors',
                selected
                  ? 'border-primary/60 bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground',
              )}
            >
              {selected && <Check className="size-3 shrink-0" aria-hidden="true" />}
              <span className="truncate">{c.name}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function BrandLogo({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const { concept } = useBrand()
  return <AlkankaLogo concept={concept} size={size} />
}
