'use client'

import { useState } from 'react'
import { Menu, Send, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useBrand } from './brand-context'
import { AlkankaLogo } from './logos'
import { TELEGRAM_URL } from './data'

const NAV = [
  { label: 'Home', href: '#home' },
  { label: 'Campaigns', href: '#campaigns' },
  { label: 'Mini-Games', href: '#games' },
  { label: 'Telegram Community', href: '#telegram' },
  { label: 'Partners', href: '#partners' },
]

export function SiteHeader() {
  const { concept } = useBrand()
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <a href="#home" aria-label="Alkanka home" className="shrink-0">
          <span key={concept} className="inline-flex animate-pop">
            <AlkankaLogo concept={concept} />
          </span>
        </a>

        <nav aria-label="Main" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {NAV.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  className="rounded-full px-3.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          <a
            href={TELEGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative hidden items-center gap-2 rounded-full bg-primary py-2 pr-2 pl-4 text-sm font-semibold text-primary-foreground transition-transform hover:scale-[1.03] sm:flex glow-cyan"
          >
            <Send className="size-4" aria-hidden="true" />
            Join @AlkankaOfficial
            <span className="flex items-center gap-1.5 rounded-full bg-primary-foreground/90 px-2.5 py-0.5 text-xs font-medium text-primary">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-live opacity-75" />
                <span className="relative inline-flex size-1.5 rounded-full bg-live" />
              </span>
              14.2K Active
            </span>
          </a>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? 'Close menu' : 'Open menu'}
            className="flex size-10 items-center justify-center rounded-full border border-border text-foreground lg:hidden"
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      <nav
        id="mobile-nav"
        aria-label="Mobile"
        className={cn(
          'overflow-hidden border-border transition-all duration-300 lg:hidden',
          open ? 'max-h-[420px] border-t' : 'max-h-0',
        )}
      >
        <ul className="flex flex-col gap-1 px-4 py-3">
          {NAV.map((item) => (
            <li key={item.href}>
              <a
                href={item.href}
                onClick={() => setOpen(false)}
                className="block rounded-lg px-3 py-2.5 text-sm text-foreground hover:bg-secondary"
              >
                {item.label}
              </a>
            </li>
          ))}
          <li className="pt-2 sm:hidden">
            <a
              href={TELEGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
            >
              <Send className="size-4" aria-hidden="true" />
              Join @AlkankaOfficial · 14.2K
            </a>
          </li>
        </ul>
      </nav>
    </header>
  )
}
