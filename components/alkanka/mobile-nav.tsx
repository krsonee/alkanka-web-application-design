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

const itemClass = 'group flex h-16 w-full flex-col items-center justify-center gap-0.5 text-xs font-semibold transition-colors'
const pillClass = 'relative flex h-7 w-12 items-center justify-center rounded-full transition-[background-color,scale] duration-150 group-active:scale-90'

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
        'fixed inset-x-2.5 bottom-[calc(0.5rem+env(safe-area-inset-bottom))] z-30 mx-auto max-w-md rounded-3xl border border-border bg-surface/95 shadow-2xl shadow-background backdrop-blur-xl transition-transform duration-300 lg:hidden',
        hidden && 'translate-y-[calc(100%+3.5rem)]',
      )}
    >
      <ul className="grid h-16 grid-cols-[1fr_1fr_4.75rem_1fr_1fr]">
        {ITEMS.map((item) => {
          const Icon = item.icon
          const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
          if (item.primary) {
            return (
              <li key={item.label}>
                <Link
                  href={item.href}
                  data-tour={item.tour}
                  aria-current={active ? 'page' : undefined}
                  className={cn('group flex h-16 w-full flex-col items-center justify-end gap-1 pb-2 text-xs font-bold', active ? 'text-primary' : 'text-foreground')}
                >
                  <span className="flex size-[4.125rem] shrink-0 items-center justify-center rounded-full border-[5px] border-background bg-primary text-primary-foreground glow-gold transition-[scale] duration-150 group-active:scale-95">
                    <Icon className="size-6" aria-hidden="true" />
                  </span>
                  <span>{item.label}</span>
                </Link>
              </li>
            )
          }
          return (
            <li key={item.label}>
              <Link
                href={item.href}
                data-tour={item.tour}
                aria-current={active ? 'page' : undefined}
                className={cn(itemClass, active ? 'text-primary' : 'text-muted-foreground')}
              >
                <span className={cn(pillClass, active && 'bg-primary/15')}>
                  <Icon className="size-5" aria-hidden="true" />
                  {item.tasks && openTasks > 0 && (
                    <span className="absolute -top-1 right-0 flex min-w-[1.125rem] items-center justify-center rounded-full bg-primary px-1 text-[11px] font-bold leading-[1.125rem] text-primary-foreground ring-2 ring-surface">
                      {openTasks > 9 ? '9+' : openTasks}
                      <span className="sr-only"> açık görev</span>
                    </span>
                  )}
                </span>
                <span>{item.label}</span>
              </Link>
            </li>
          )
        })}
        <li>
          <button
            type="button"
            data-tour="menu-btn"
            aria-haspopup="dialog"
            onClick={() => window.dispatchEvent(new Event(OPEN_MENU_EVENT))}
            className={cn(itemClass, 'text-muted-foreground')}
          >
            <span className={pillClass}>
              <Menu className="size-5" aria-hidden="true" />
            </span>
            <span>Menü</span>
          </button>
        </li>
      </ul>
    </nav>
  )
}
