import Link from 'next/link'
import { Award, LayoutDashboard, Link2, Mail, MessageSquareText, Palette, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

export const PROFILE_TABS = [
  { id: 'genel', label: 'Genel bakış', icon: LayoutDashboard },
  { id: 'gorunum', label: 'Avatar & görünüm', icon: Palette },
  { id: 'mesajlar', label: 'Mesajlar', icon: Mail },
  { id: 'rozetler', label: 'Rozetlerim', icon: Award },
  { id: 'hesaplar', label: 'Bağlı hesaplar', icon: Link2 },
  { id: 'yorumlar', label: 'Yorumlarım', icon: MessageSquareText },
  { id: 'ayarlar', label: 'Hesap ayarları', icon: Settings },
] as const

export type ProfileTab = (typeof PROFILE_TABS)[number]['id']

export function ProfileTabs({ active, unread = 0 }: { active: ProfileTab; unread?: number }) {
  return (
    <nav aria-label="Profil bölümleri" className="sticky top-16 z-10 -mx-4 border-b border-border bg-background/90 px-4 backdrop-blur lg:-mx-6 lg:px-6">
      <ul role="tablist" className="flex gap-1 overflow-x-auto">
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
                  'relative flex items-center gap-2 whitespace-nowrap px-3 py-3.5 text-sm font-semibold transition-colors',
                  selected ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <t.icon className={cn('size-4', selected ? 'text-gold' : '')} aria-hidden />
                {t.label}
                {badge && (
                  <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-primary-foreground">
                    {unread > 9 ? '9+' : unread}
                    <span className="sr-only"> okunmamış</span>
                  </span>
                )}
                {selected && <span aria-hidden className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-gold" />}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
