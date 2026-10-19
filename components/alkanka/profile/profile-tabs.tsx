import Link from 'next/link'
import { Award, LayoutDashboard, Link2, Mail, MessageSquareText, Palette, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

export const PROFILE_TABS = [
  { id: 'genel', label: 'Genel bakış', short: 'Genel', icon: LayoutDashboard },
  { id: 'gorunum', label: 'Avatar & görünüm', short: 'Avatar', icon: Palette },
  { id: 'mesajlar', label: 'Mesajlar', short: 'Mesajlar', icon: Mail },
  { id: 'rozetler', label: 'Rozetlerim', short: 'Rozetler', icon: Award },
  { id: 'hesaplar', label: 'Bağlı hesaplar', short: 'Hesaplar', icon: Link2 },
  { id: 'yorumlar', label: 'Yorumlarım', short: 'Yorumlar', icon: MessageSquareText },
  { id: 'ayarlar', label: 'Hesap ayarları', short: 'Ayarlar', icon: Settings },
] as const

export type ProfileTab = (typeof PROFILE_TABS)[number]['id']

export function ProfileTabs({ active, unread = 0 }: { active: ProfileTab; unread?: number }) {
  return (
    <nav aria-label="Profil bölümleri" className="sticky top-16 z-10 -mx-4 border-b border-border bg-background/90 px-4 backdrop-blur lg:-mx-6 lg:px-6">
      <ul role="tablist" className="flex flex-wrap gap-1.5 py-2.5 md:no-scrollbar md:flex-nowrap md:gap-1 md:overflow-x-auto md:py-0">
        {PROFILE_TABS.map((t) => {
          const selected = t.id === active
          const badge = t.id === 'mesajlar' && unread > 0 && !selected
          return (
            <li key={t.id} role="presentation" className="shrink-0">
              <Link
                id={`tab-${t.id}`}
                role="tab"
                aria-selected={selected}
                aria-controls={`panel-${t.id}`}
                href={t.id === 'genel' ? '/profil' : `/profil?sekme=${t.id}`}
                scroll={false}
                className={cn(
                  'relative flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors md:gap-2 md:rounded-none md:border-0 md:py-3.5',
                  selected
                    ? 'border-gold/60 bg-gold/10 text-foreground md:bg-transparent'
                    : 'border-border text-muted-foreground hover:text-foreground',
                )}
              >
                <t.icon className={cn('size-4', selected ? 'text-gold' : '')} aria-hidden />
                <span className="md:hidden">{t.short}</span>
                <span className="hidden md:inline">{t.label}</span>
                {badge && (
                  <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-primary-foreground">
                    {unread > 9 ? '9+' : unread}
                    <span className="sr-only"> okunmamış</span>
                  </span>
                )}
                {selected && <span aria-hidden className="absolute inset-x-2 -bottom-px hidden h-0.5 rounded-full bg-gold md:block" />}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
