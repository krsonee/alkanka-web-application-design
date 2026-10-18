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

const LEGAL_LINKS = [
  { label: 'Kullanım Koşulları', href: '/yasal/kullanim-kosullari' },
  { label: 'Gizlilik', href: '/yasal/gizlilik' },
  { label: 'KVKK', href: '/yasal/kvkk' },
  { label: 'Çerezler', href: '/yasal/cerez' },
  { label: 'Sorumlu Oyun', href: '/yasal/sorumlu-oyun' },
]

export function Footer() {
  return (
    <footer className="flex flex-col gap-6 border-t border-border pt-8 pb-24 lg:pb-8">
      <a
        href={TELEGRAM_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="panel-gold flex flex-wrap items-center gap-3 rounded-2xl p-4 transition-colors hover:border-primary/50 sm:flex-nowrap sm:gap-4 sm:p-5"
      >
        <JakoAvatar pose="telegram" size="sm" className="sm:size-32" />
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="font-display text-base font-bold text-foreground text-balance sm:text-lg">Kaçırma kanka, Jako her şeyi Telegram’da öter!</span>
          <span className="text-sm leading-relaxed text-muted-foreground">
            Yeni bonus kodları, özel oranlar ve etkinlik duyuruları ilk orada.
          </span>
        </span>
        <span className="w-full rounded-lg bg-accent px-4 py-2.5 text-center text-xs font-bold uppercase tracking-wider text-accent-foreground sm:w-auto">
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
      <nav aria-label="Yasal" className="flex flex-wrap gap-x-4 gap-y-2 text-xs">
        {LEGAL_LINKS.map((l) => (
          <a key={l.href} href={l.href} className="text-muted-foreground transition-colors hover:text-primary">
            {l.label}
          </a>
        ))}
      </nav>
      <div className="flex flex-col justify-between gap-2 border-t border-border pt-4 text-xs text-muted-foreground sm:flex-row">
        <span>© 2026 AL KANKA — Tüm hakları saklıdır.</span>
        <span>
          18+ ·{' '}
          <a href="/yasal/sorumlu-oyun" className="hover:text-primary">
            Sorumlu oyun
          </a>{' '}
          · info@alkanka.com
        </span>
      </div>
    </footer>
  )
}
