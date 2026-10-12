import type { SocialLinks, SocialPlatform } from '@/lib/social-shared'
import { DEFAULT_SOCIAL_LINKS, PLATFORM_LABEL, PLATFORM_SHORT, SOCIAL_PLATFORMS } from '@/lib/social-shared'
import { cn } from '@/lib/utils'

type IconProps = { className?: string }

function XIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M18.9 1.15h3.68l-8.04 9.19L24 22.85h-7.4l-5.8-7.58-6.64 7.58H.47l8.6-9.83L0 1.15h7.6l5.24 6.93zm-1.3 19.5h2.04L6.49 3.24H4.3z" />
    </svg>
  )
}

function InstagramIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className={className}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

function YoutubeIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8zM9.6 15.6V8.4l6.2 3.6z" />
    </svg>
  )
}

export function SocialIcon({ platform, className }: { platform: SocialPlatform; className?: string }) {
  if (platform === 'x') return <XIcon className={className} />
  if (platform === 'instagram') return <InstagramIcon className={className} />
  return <YoutubeIcon className={className} />
}

export const PLATFORM_TINT: Record<SocialPlatform, string> = {
  x: 'hover:border-foreground/40 hover:text-foreground',
  instagram: 'hover:border-ruby/50 hover:text-ruby',
  youtube: 'hover:border-destructive/50 hover:text-destructive',
}

/** The brand's official accounts as three side-by-side tiles. Panel links override the defaults. */
export function SocialRow({ links, className }: { links: SocialLinks; className?: string }) {
  return (
    <nav aria-label="AL KANKA sosyal medya hesapları" className={cn('flex flex-col gap-2', className)}>
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Bizi takip et</span>
      <ul className="grid grid-cols-3 gap-2">
        {SOCIAL_PLATFORMS.map((p) => (
          <li key={p}>
            <a
              href={links[p] || DEFAULT_SOCIAL_LINKS[p]}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`AL KANKA ${PLATFORM_LABEL[p]} hesabını takip et`}
              className={cn(
                'flex flex-col items-center gap-1.5 rounded-lg border border-border bg-card py-2.5 text-muted-foreground transition-colors',
                PLATFORM_TINT[p],
              )}
            >
              <SocialIcon platform={p} className="size-4" />
              <span className="text-[11px] font-medium leading-none">{PLATFORM_SHORT[p]}</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
