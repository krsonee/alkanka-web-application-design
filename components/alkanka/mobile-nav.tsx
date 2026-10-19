'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Dices, Home, ListChecks, Menu, ShoppingBag } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useNavSignals } from './sidebar'
import { OPEN_MENU_EVENT } from './topbar'

const ITEMS = [
  { label: 'Ana', href: '/', icon: Home },
  { label: 'Görevler', href: '/gorevler', icon: ListChecks, tasks: true },
  { label: 'Oyunlar', href: '/oyunlar', icon: Dices, primary: true, tour: 'mobile-oyunlar' },
  { label: 'Market', href: '/market', icon: ShoppingBag, tour: 'mobile-market' },
]

const itemClass = 'relative flex w-full flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors'

/** Hides while scrolling down so content has room, comes back as soon as the user scrolls up. */
function useHideOnScroll() {
  const [hidden, setHidden] = useState(false)
  const last = useRef(0)
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY
      const delta = y - last.current
      if (Math.abs(delta) > 8) {
        setHidden(delta > 0 && y > 120)
        last.current = y
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  return hidden
}

export function MobileNav() {
  const pathname = usePathname()
  const { openTasks } = useNavSignals()
  const hidden = useHideOnScroll()

  return (
    <nav
      aria-label="Hızlı menü"
      className={cn(
        'fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md transition-transform duration-300 lg:hidden',
        hidden && 'translate-y-full',
      )}
    >
      <ul className="grid grid-cols-5">
        {ITEMS.map((item) => {
          const Icon = item.icon
          const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
          return (
            <li key={item.label}>
              <Link
                href={item.href}
                data-tour={item.tour}
                aria-current={active ? 'page' : undefined}
                className={cn(itemClass, active ? 'text-primary' : 'text-muted-foreground')}
              >
                <span
                  className={
                    item.primary
                      ? 'flex size-12 -mt-7 items-center justify-center rounded-full bg-primary text-primary-foreground ring-4 ring-surface glow-gold'
                      : 'relative flex size-5 items-center justify-center'
                  }
                >
                  <Icon className={item.primary ? 'size-6' : 'size-5'} aria-hidden="true" />
                  {item.tasks && openTasks > 0 && (
                    <span className="absolute -right-2.5 -top-1.5 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold leading-4 text-primary-foreground">
                      {openTasks > 9 ? '9+' : openTasks}
                      <span className="sr-only"> açık görev</span>
                    </span>
                  )}
                </span>
                <span className={item.primary ? 'font-bold text-primary' : active ? 'font-semibold' : undefined}>{item.label}</span>
              </Link>
            </li>
          )
        })}
        <li>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event(OPEN_MENU_EVENT))}
            className={cn(itemClass, 'text-muted-foreground')}
          >
            <span className="flex size-5 items-center justify-center">
              <Menu className="size-5" aria-hidden="true" />
            </span>
            <span>Menü</span>
          </button>
        </li>
      </ul>
    </nav>
  )
}
