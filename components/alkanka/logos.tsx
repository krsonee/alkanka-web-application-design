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
      <span className={cn('font-display font-semibold tracking-wide text-foreground', size === 'sm' ? 'text-base' : 'text-xl')}>
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
      <span className={cn('font-display font-semibold lowercase text-foreground', size === 'sm' ? 'text-base' : 'text-xl')}>
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
      <span className="flex flex-col leading-none">
        <span className={cn('font-display font-bold uppercase tracking-widest text-foreground', size === 'sm' ? 'text-sm' : 'text-lg')}>
          Alkanka
        </span>
        <span className="text-[10px] font-medium uppercase tracking-[0.3em] text-gold">Kanka</span>
      </span>
    </span>
  )
}

export const LOGO_CONCEPTS: { id: LogoConcept; name: string; description: string }[] = [
  { id: 'shield', name: 'Altın Kalkan', description: 'Premium güven rozeti' },
  { id: 'monogram', name: 'A+K Monogram', description: 'Geometrik çift harf' },
  { id: 'wordmark', name: 'Yazı Logo', description: 'Sade tipografi + nokta' },
  { id: 'network', name: 'Ağ Düğümü', description: 'Bağlantılı dijital merkez' },
]

export function AlkankaLogo({ concept, ...props }: LogoProps & { concept: LogoConcept }) {
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
