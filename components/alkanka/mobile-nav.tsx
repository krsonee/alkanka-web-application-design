import { CircleDot, Home, LayoutGrid, ShoppingBag, UserPlus } from 'lucide-react'

const ITEMS = [
  { label: 'Ana', href: '/', icon: Home },
  { label: 'Sponsorlar', href: '/sponsorlar', icon: LayoutGrid },
  { label: 'Çark', href: '/oyunlar/cark', icon: CircleDot, primary: true, tour: 'mobile-cark' },
  { label: 'Market', href: '/market', icon: ShoppingBag, tour: 'mobile-market' },
  { label: 'Kayıt', href: '#kayit', icon: UserPlus },
]

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
              <a href={item.href} data-tour={'tour' in item ? item.tour : undefined} className="flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-muted-foreground">
                <span
                  className={
                    item.primary
                      ? 'flex size-9 -mt-5 items-center justify-center rounded-full bg-primary text-primary-foreground glow-gold'
                      : 'flex size-5 items-center justify-center'
                  }
                >
                  <Icon className={item.primary ? 'size-5' : 'size-5'} aria-hidden="true" />
                </span>
                {item.label}
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
