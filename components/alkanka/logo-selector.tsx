'use client'

import { useState } from 'react'
import { Check, ChevronDown, Palette } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useBrand } from './brand-context'
import { AlkankaLogo, LOGO_CONCEPTS } from './logos'

export function LogoSelector() {
  const { concept, setConcept } = useBrand()
  const [open, setOpen] = useState(false)
  const active = LOGO_CONCEPTS.find((c) => c.id === concept)

  return (
    <div className="border-b border-border bg-surface/80">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-2.5 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-xs text-muted-foreground sm:text-sm">
            <Palette className="size-4 text-accent" aria-hidden="true" />
            <span>
              <span className="hidden sm:inline">Brand identity preview — </span>
              <span className="font-medium text-foreground">{active?.name}</span>
            </span>
          </p>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="logo-concepts"
            className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-medium text-foreground transition-colors hover:border-accent hover:text-accent"
          >
            Choose logo
            <ChevronDown className={cn('size-3.5 transition-transform', open && 'rotate-180')} aria-hidden="true" />
          </button>
        </div>

        <div
          id="logo-concepts"
          role="radiogroup"
          aria-label="Alkanka logo concepts"
          className={cn(
            'grid grid-cols-2 gap-2 overflow-hidden transition-all duration-500 lg:grid-cols-4',
            open ? 'max-h-96 pb-1 opacity-100' : 'max-h-0 opacity-0',
          )}
        >
          {LOGO_CONCEPTS.map((c, i) => {
            const selected = c.id === concept
            return (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={selected}
                tabIndex={open ? 0 : -1}
                onClick={() => setConcept(c.id)}
                className={cn(
                  'group relative flex flex-col items-start gap-3 rounded-xl border p-3 text-left transition-all',
                  selected
                    ? 'border-primary/60 bg-primary/5 glow-cyan'
                    : 'border-border bg-card/50 hover:border-accent/50 hover:bg-card',
                )}
              >
                <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                  Concept {i + 1}
                </span>
                <span className="flex h-10 items-center">
                  <AlkankaLogo concept={c.id} size="sm" />
                </span>
                <span className="flex flex-col">
                  <span className="text-sm font-semibold text-foreground">{c.name}</span>
                  <span className="text-xs text-muted-foreground">{c.description}</span>
                </span>
                {selected && (
                  <span className="absolute top-3 right-3 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground animate-pop">
                    <Check className="size-3" aria-hidden="true" />
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
