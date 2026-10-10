'use client'

import { LifeBuoy, Send, ShieldCheck } from 'lucide-react'
import { useBrand } from './brand-context'
import { AlkankaLogo } from './logos'
import { TELEGRAM_URL } from './data'

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

const LINK_GROUPS = [
  { title: 'Explore', links: [['Home', '#home'], ['Campaigns', '#campaigns'], ['Mini-Games', '#games'], ['Partners', '#partners']] },
  { title: 'Community', links: [['Telegram Channel', TELEGRAM_URL], ['Community Chat', TELEGRAM_URL], ['Reward Drops', '#telegram'], ['Leaderboard', '#games']] },
  { title: 'Trust Center', links: [['Terms of Use', '#'], ['Privacy Policy', '#'], ['Fair Play Rules', '#'], ['Contact Support', '#']] },
] as const

const SOCIALS = [
  { label: 'Telegram', href: TELEGRAM_URL, icon: Send },
  { label: 'X (Twitter)', href: 'https://x.com', icon: XIcon },
  { label: 'Support', href: '#', icon: LifeBuoy },
]

export function SiteFooter() {
  const { concept } = useBrand()
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto flex max-w-7xl flex-col gap-12 px-4 py-16 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_2fr]">
          <div className="flex flex-col gap-5">
            <AlkankaLogo concept={concept} />
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
              Premium digital marketing and rewards hub. Daily drops, verified partner campaigns and free bonus
              mini-games for our community.
            </p>
            <ul className="flex gap-2">
              {SOCIALS.map(({ label, href, icon: Icon }) => (
                <li key={label}>
                  <a
                    href={href}
                    target={href.startsWith('http') ? '_blank' : undefined}
                    rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
                    aria-label={label}
                    className="flex size-10 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
                  >
                    <Icon className="size-4" />
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <nav aria-label="Footer" className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {LINK_GROUPS.map((group) => (
              <div key={group.title} className="flex flex-col gap-3">
                <h3 className="text-sm font-semibold text-foreground">{group.title}</h3>
                <ul className="flex flex-col gap-2">
                  {group.links.map(([label, href]) => (
                    <li key={label}>
                      <a href={href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                        {label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-background/40 p-5">
          <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
            Affiliate disclosure
          </p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Alkanka may earn a commission when you engage with partner campaigns listed on this site. This never
            affects the rewards you receive. Mini-games are free promotional features with no purchase or deposit
            required and contain no gambling or casino mechanics. Rewards are subject to partner terms.
          </p>
        </div>

        <div className="flex flex-col items-start justify-between gap-4 border-t border-border pt-6 sm:flex-row sm:items-center">
          <p className="text-xs text-muted-foreground">{`© ${new Date().getFullYear()} Alkanka. All rights reserved.`}</p>
          <p className="flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs text-foreground">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-live opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-live" />
            </span>
            All Systems Operational
          </p>
        </div>
      </div>
    </footer>
  )
}
