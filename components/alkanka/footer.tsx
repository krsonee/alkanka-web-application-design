import { TELEGRAM_URL } from './data'
import { JakoAvatar } from './jako'
import { BrandLogo } from './logo-selector'

const LINKS = [
  { label: 'Sponsorlar', href: '/sponsorlar' },
  { label: 'Kampanyalar', href: '/kampanyalar' },
  { label: 'Çark', href: '/oyunlar/cark' },
  { label: 'Market', href: '/market' },
  { label: 'Görevler', href: '/gorevler' },
  { label: 'Sıralama', href: '/siralama' },
  { label: 'SSS', href: '/sss' },
]

export function Footer() {
  return (
    <footer className="flex flex-col gap-6 border-t border-border pt-8 pb-24 lg:pb-8">
      <a
        href={TELEGRAM_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="panel-gold flex flex-col items-start gap-4 rounded-2xl p-5 transition-colors hover:border-primary/50 sm:flex-row sm:items-center"
      >
        <JakoAvatar pose="telegram" size="lg" />
        <span className="flex flex-1 flex-col gap-1">
          <span className="font-display text-lg font-bold text-foreground text-balance">Kaçırma kanka, Jako her şeyi Telegram’da öter!</span>
          <span className="text-sm leading-relaxed text-muted-foreground">
            Yeni bonus kodları, özel oranlar ve etkinlik duyuruları ilk orada.
          </span>
        </span>
        <span className="rounded-lg bg-accent px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-accent-foreground">
          Kanala katıl
        </span>
      </a>
      <div className="flex flex-col justify-between gap-6 md:flex-row md:items-start">
        <div className="flex max-w-sm flex-col gap-3">
          <BrandLogo size="sm" />
          <p className="text-sm leading-relaxed text-muted-foreground">
            AL KANKA bağımsız bir tanıtım ve ödül rehberidir. Mini oyunlar ücretsizdir; Kanka Coin nakde çevrilmez.
          </p>
        </div>
        <nav aria-label="Alt menü" className="flex flex-wrap gap-x-6 gap-y-2">
          {LINKS.map((l) => (
            <a key={l.label} href={l.href} className="text-sm text-muted-foreground transition-colors hover:text-primary">
              {l.label}
            </a>
          ))}
          <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer" className="text-sm text-accent hover:underline">
            Telegram
          </a>
        </nav>
      </div>
      <div className="flex flex-col justify-between gap-2 border-t border-border pt-4 text-xs text-muted-foreground sm:flex-row">
        <span>© 2026 AL KANKA — Tüm hakları saklıdır.</span>
        <span>18+ · Sorumlu davran · info@alkanka.com</span>
      </div>
    </footer>
  )
}
