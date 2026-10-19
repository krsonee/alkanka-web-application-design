'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Award, Gift, LogIn, Sparkles, Trophy, UserPlus, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePoints } from './points-context'

const PREVIEW_SECONDS = 5

const MEMBER_ONLY = ['/gorevler', '/tahminler', '/biletler', '/turnuvalar', '/market', '/rozetler', '/oyunlar', '/siralama', '/kankatv', '/profil']

const OPEN_PAGES = ['/kankatv/onizleme']

const PERKS = [
  { icon: Gift, label: 'Günlük çark, sandık ve görevler' },
  { icon: Trophy, label: 'Turnuva, tahmin ligi ve biletler' },
  { icon: Award, label: 'Rozetler ve Kanka Coin marketi' },
]

function isMemberOnly(pathname: string) {
  return MEMBER_ONLY.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

export function GuestGate() {
  const pathname = usePathname()
  const { member, loading } = usePoints()
  const [remaining, setRemaining] = useState(PREVIEW_SECONDS)
  const [dismissed, setDismissed] = useState(false)

  const isGuest = !loading && !member && !OPEN_PAGES.includes(pathname)
  const hard = isMemberOnly(pathname)

  useEffect(() => {
    setRemaining(PREVIEW_SECONDS)
  }, [pathname])

  useEffect(() => {
    if (!isGuest || remaining <= 0) return
    const id = window.setTimeout(() => setRemaining((r) => r - 1), 1000)
    return () => window.clearTimeout(id)
  }, [isGuest, remaining])

  const locked = isGuest && remaining <= 0 && !(dismissed && !hard)

  useEffect(() => {
    if (!locked || !hard) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [locked, hard])

  if (!isGuest) return null

  if (!locked) {
    if (!hard || remaining <= 0) return null
    return (
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-30 flex justify-center px-4 lg:bottom-6 lg:left-[var(--sidebar-w)] xl:right-80">
        <p className="flex items-center gap-2 rounded-full border border-primary/30 bg-card/95 px-4 py-2 text-xs font-semibold text-foreground shadow-lg backdrop-blur">
          <Sparkles className="size-3.5 text-primary" aria-hidden="true" />
          Önizleme modu · {remaining} sn sonra üyelik gerekli
        </p>
      </div>
    )
  }

  return (
    <div
      role="dialog"
      aria-modal={hard}
      aria-labelledby="guest-gate-title"
      className={cn(
        'fixed z-30 flex justify-center px-4',
        hard
          ? 'inset-x-0 top-16 bottom-0 items-center bg-background/70 backdrop-blur-md lg:left-[var(--sidebar-w)] xl:right-80'
          : 'inset-x-0 bottom-20 lg:bottom-6 lg:left-[var(--sidebar-w)] xl:right-80',
      )}
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-primary/30 bg-card shadow-2xl animate-pop">
        <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-primary" />
        {!hard && (
          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="Kapat"
            className="absolute top-3 right-3 z-10 flex size-8 items-center justify-center rounded-full bg-background/80 text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        )}
        <div className="flex items-center gap-4 bg-primary/10 p-5">
          <Image
            src="/images/mascots/jako-merhaba.png"
            alt="Maskotumuz Jako el sallıyor"
            width={112}
            height={112}
            className={cn('shrink-0 rounded-xl object-cover object-top ring-1 ring-primary/30', hard ? 'size-24' : 'size-16')}
          />
          <div className="flex flex-col gap-1 pr-6">
            <span className="text-[11px] font-bold uppercase tracking-wider text-primary">Jako diyor ki</span>
            <h2 id="guest-gate-title" className="font-display text-xl font-bold leading-tight text-foreground text-balance">
              {hard ? 'Devamı üyelere özel, kanka!' : 'Aramıza katıl, kanka!'}
            </h2>
          </div>
        </div>

        <div className="flex flex-col gap-4 p-5">
          <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
            {hard
              ? 'Etkinliklere katılmak, detayları görmek ve ödül toplamak için ücretsiz hesap aç. 30 saniye sürer.'
              : 'Ücretsiz üye ol; görevlerden, oyunlardan ve etkinliklerden Kanka Coin kazanmaya başla.'}
          </p>
          {hard && (
            <ul className="flex flex-col gap-2">
              {PERKS.map(({ icon: Icon, label }) => (
                <li key={label} className="flex items-center gap-2.5 text-sm text-foreground">
                  <span className="flex size-7 items-center justify-center rounded-lg bg-primary/15 text-primary">
                    <Icon className="size-3.5" aria-hidden="true" />
                  </span>
                  {label}
                </li>
              ))}
            </ul>
          )}
          <div className="grid grid-cols-2 gap-2">
            <a
              href="#kayit"
              className="flex h-11 items-center justify-center gap-2 rounded-lg bg-primary text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90"
            >
              <UserPlus className="size-4" aria-hidden="true" />
              Ücretsiz kayıt ol
            </a>
            <a
              href="#giris"
              className="flex h-11 items-center justify-center gap-2 rounded-lg border border-border bg-background text-sm font-semibold text-foreground hover:border-primary/40"
            >
              <LogIn className="size-4" aria-hidden="true" />
              Giriş yap
            </a>
          </div>
          {hard && (
            <Link href="/" className="text-center text-xs font-semibold text-muted-foreground hover:text-foreground">
              Ana sayfaya dön
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
