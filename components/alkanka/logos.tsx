import { cn } from '@/lib/utils'
import type { LogoConcept } from './brand-context'

type LogoProps = { className?: string; size?: 'sm' | 'md' }

function WordmarkLogo({ className, size = 'md' }: LogoProps) {
  return (
    <span
      className={cn(
        'inline-flex items-baseline font-display font-bold tracking-tight text-foreground',
        size === 'sm' ? 'text-lg' : 'text-2xl',
        className,
      )}
    >
      alkanka
      <span
        aria-hidden="true"
        className={cn(
          'ml-0.5 inline-block rounded-full bg-primary shadow-[0_0_12px_var(--primary)]',
          size === 'sm' ? 'size-1.5' : 'size-2',
        )}
      />
    </span>
  )
}

function MonogramLogo({ className, size = 'md' }: LogoProps) {
  const box = size === 'sm' ? 'size-7' : 'size-9'
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <svg viewBox="0 0 40 40" className={box} aria-hidden="true">
        <rect x="1" y="1" width="38" height="38" rx="10" fill="var(--card)" stroke="var(--accent)" strokeWidth="1.5" />
        <path d="M9 30 L16 10 L23 30 M11.5 23 H20.5" fill="none" stroke="var(--primary)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M26 10 V30 M26 20 L33 10 M28.5 17 L33 30" fill="none" stroke="var(--accent)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className={cn('logo-text font-display font-semibold tracking-wide text-foreground', size === 'sm' ? 'text-base' : 'text-xl')}>
        ALKANKA
      </span>
    </span>
  )
}

function NetworkLogo({ className, size = 'md' }: LogoProps) {
  const box = size === 'sm' ? 'size-7' : 'size-9'
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <svg viewBox="0 0 40 40" className={box} aria-hidden="true">
        <g stroke="var(--primary)" strokeWidth="1.4" opacity="0.7">
          <line x1="20" y1="20" x2="8" y2="9" />
          <line x1="20" y1="20" x2="33" y2="11" />
          <line x1="20" y1="20" x2="10" y2="32" />
          <line x1="20" y1="20" x2="31" y2="31" />
          <line x1="8" y1="9" x2="33" y2="11" />
          <line x1="10" y1="32" x2="31" y2="31" />
        </g>
        <circle cx="8" cy="9" r="3" fill="var(--primary)" />
        <circle cx="33" cy="11" r="3" fill="var(--accent)" />
        <circle cx="10" cy="32" r="3" fill="var(--accent)" />
        <circle cx="31" cy="31" r="3" fill="var(--primary)" />
        <circle cx="20" cy="20" r="5.5" fill="var(--gold)" />
      </svg>
      <span className={cn('logo-text font-display font-semibold lowercase text-foreground', size === 'sm' ? 'text-base' : 'text-xl')}>
        alkanka<span className="text-primary">.com</span>
      </span>
    </span>
  )
}

function ShieldLogo({ className, size = 'md' }: LogoProps) {
  const box = size === 'sm' ? 'size-7' : 'size-9'
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <svg viewBox="0 0 40 40" className={box} aria-hidden="true">
        <path d="M20 2 L35 8 V19 C35 28 28.5 35 20 38 C11.5 35 5 28 5 19 V8 Z" fill="var(--card)" stroke="var(--gold)" strokeWidth="1.8" />
        <path d="M12 27 L20 11 L28 27" fill="none" stroke="var(--gold)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M15.5 22 H24.5" stroke="var(--primary)" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
      <span className="logo-text flex flex-col leading-none">
        <span className={cn('font-display font-bold uppercase tracking-widest text-foreground', size === 'sm' ? 'text-sm' : 'text-lg')}>
          Alkanka
        </span>
      </span>
    </span>
  )
}

export type LogoOption = { id: LogoConcept; name: string; description: string; image?: string }

export const PRO_LOGOS: LogoOption[] = [
  { id: 'pro-wolf', name: 'Kurt Başı', description: 'Espor tarzı, sürü ve sadakat', image: '/images/logos/pro-wolf.png' },
  { id: 'pro-lion', name: 'Aslan Başı', description: 'Espor tarzı, güç ve liderlik', image: '/images/logos/pro-lion.png' },
  { id: 'pro-eagle', name: 'Kartal Başı', description: 'Espor tarzı, keskin ve hızlı', image: '/images/logos/pro-eagle.png' },
  { id: 'pro-monogram', name: 'AK Monogram', description: 'Lüks harf birleşimi', image: '/images/logos/pro-monogram.png' },
  { id: 'pro-crown', name: 'Taçlı A', description: 'VIP, favicon dostu', image: '/images/logos/pro-crown.png' },
  { id: 'pro-badge', name: 'K Arması', description: 'Takım kalkanı rozeti', image: '/images/logos/pro-badge.png' },
  { id: 'pro-chip', name: 'K Çip', description: 'Casino çipi, Kanka Coin', image: '/images/logos/pro-chip.png' },
  { id: 'pro-handshake', name: 'Kanka Eli', description: 'Kardeşlik ve güven', image: '/images/logos/pro-handshake.png' },
]

export const EMBLEM_LOGOS: LogoOption[] = [
  { id: 'lion', name: 'Aslan', description: 'Güç ve liderlik', image: '/images/logos/lion.png' },
  { id: 'wolf', name: 'Kurt', description: 'Sürü, sadakat, kanka ruhu', image: '/images/logos/wolf.png' },
  { id: 'tiger', name: 'Kaplan', description: 'Hız ve cesaret', image: '/images/logos/tiger.png' },
  { id: 'eagle', name: 'Kartal', description: 'Keskin göz, yüksek hedef', image: '/images/logos/eagle.png' },
  { id: 'horse', name: 'At', description: 'Yarış ve zafer', image: '/images/logos/horse.png' },
  { id: 'crown', name: 'Taç', description: 'VIP ve premium', image: '/images/logos/crown.png' },
  { id: 'coin', name: 'Altın Para', description: 'Kanka Coin vurgusu', image: '/images/logos/coin.png' },
  { id: 'diamond', name: 'Elmas', description: 'Değer ve kalite', image: '/images/logos/diamond.png' },
  { id: 'shield-emblem', name: 'Kalkan', description: 'Güvenilir rehber', image: '/images/logos/shield.png' },
  { id: 'bolt', name: 'Şimşek', description: 'Anlık ödül, hızlı drop', image: '/images/logos/bolt.png' },
  { id: 'laurel', name: 'Defne', description: 'Kazananların çelengi', image: '/images/logos/laurel.png' },
  { id: 'fist', name: 'Yumruk', description: 'Topluluk gücü', image: '/images/logos/fist.png' },
]

export const SVG_LOGOS: LogoOption[] = [
  { id: 'shield', name: 'Altın Kalkan', description: 'Premium güven rozeti' },
  { id: 'monogram', name: 'A+K Monogram', description: 'Geometrik çift harf' },
  { id: 'wordmark', name: 'Yazı Logo', description: 'Sade tipografi + nokta' },
  { id: 'network', name: 'Ağ Düğümü', description: 'Bağlantılı dijital merkez' },
]

export const LOGO_CONCEPTS: LogoOption[] = [...PRO_LOGOS, ...EMBLEM_LOGOS, ...SVG_LOGOS]

function EmblemLogo({ image, flat, className, size = 'md' }: LogoProps & { image: string; flat?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <img
        src={image}
        alt=""
        aria-hidden="true"
        className={cn(
          'shrink-0 object-cover',
          flat ? 'rounded-lg' : 'rounded-full ring-1 ring-gold/50',
          size === 'sm' ? 'size-9' : 'size-11',
        )}
      />
      <span className="logo-text flex flex-col leading-none">
        <span className={cn('font-display font-bold uppercase tracking-widest text-foreground', size === 'sm' ? 'text-sm' : 'text-lg')}>
          Alkanka
        </span>
      </span>
    </span>
  )
}

export function AlkankaLogo({ concept, ...props }: LogoProps & { concept: LogoConcept }) {
  const pro = PRO_LOGOS.find((l) => l.id === concept)
  if (pro?.image) return <EmblemLogo image={pro.image} flat {...props} />
  const emblem = EMBLEM_LOGOS.find((l) => l.id === concept)
  if (emblem?.image) return <EmblemLogo image={emblem.image} {...props} />
  switch (concept) {
    case 'monogram':
      return <MonogramLogo {...props} />
    case 'network':
      return <NetworkLogo {...props} />
    case 'shield':
      return <ShieldLogo {...props} />
    default:
      return <WordmarkLogo {...props} />
  }
}
