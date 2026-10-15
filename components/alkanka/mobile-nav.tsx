'use client'

import { Dices, Home, LayoutGrid, MessagesSquare, ShoppingBag } from 'lucide-react'
import { OPEN_CHAT_EVENT } from './live-rail'

const ITEMS = [
  { label: 'Ana', href: '/', icon: Home },
  { label: 'Sponsorlar', href: '/sponsorlar', icon: LayoutGrid },
  { label: 'Oyunlar', href: '/oyunlar', icon: Dices, primary: true, tour: 'mobile-oyunlar' },
  { label: 'Market', href: '/market', icon: ShoppingBag, tour: 'mobile-market' },
]

const itemClass = 'flex w-full flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-muted-foreground'

export function MobileNav() {
  return (
    <nav
      aria-label="Hızlı menü"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
    >
      <ul className="grid grid-cols-5">
        {ITEMS.map((item) => {
          const Icon = item.icon
          return (
            <li key={item.label}>
              <a href={item.href} data-tour={'tour' in item ? item.tour : undefined} className={itemClass}>
                <span
                  className={
                    item.primary
                      ? 'flex size-12 -mt-7 items-center justify-center rounded-full bg-primary text-primary-foreground ring-4 ring-surface glow-gold'
                      : 'flex size-5 items-center justify-center'
                  }
                >
                  <Icon className={item.primary ? 'size-6' : 'size-5'} aria-hidden="true" />
                </span>
                <span className={item.primary ? 'font-bold text-primary' : undefined}>{item.label}</span>
              </a>
            </li>
          )
        })}
        <li>
          <button type="button" onClick={() => window.dispatchEvent(new Event(OPEN_CHAT_EVENT))} className={itemClass}>
            <span className="relative flex size-5 items-center justify-center text-accent">
              <MessagesSquare className="size-5" aria-hidden="true" />
              <span className="absolute -right-1 -top-0.5 size-2 rounded-full bg-live ring-2 ring-surface" aria-hidden="true" />
            </span>
            Sohbet
          </button>
        </li>
      </ul>
    </nav>
  )
}
