import Image from 'next/image'
import { Gift, Lock } from 'lucide-react'
import type { SponsorState } from '@/lib/sponsor-access'
import { AgeConfirm } from './age-confirm'

type Props = { state: Exclude<SponsorState, 'open'>; title?: string; embedded?: boolean }

export function MembersOnly({ state, title = 'Üyelere özel fırsatlar', embedded = false }: Props) {
  // Standing in for a whole page, this is the page's only heading.
  const Heading = embedded ? 'h2' : 'h1'
  const guest = state === 'guest'
  return (
    <section
      aria-labelledby="members-only-title"
      className="panel-gold relative isolate flex overflow-hidden rounded-2xl"
    >
      <Image
        src="/images/heroes/market.png"
        alt=""
        fill
        sizes="(min-width: 1024px) 1200px, 100vw"
        className="-z-10 scale-110 object-cover opacity-25 blur-xl"
        aria-hidden="true"
      />
      <div className="flex w-full items-end gap-4 p-5 md:p-7">
        <div className="flex min-w-0 flex-1 flex-col gap-3 py-1">
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1 text-xs font-bold text-primary">
            <Lock className="size-3.5" aria-hidden="true" />
            {guest ? 'Sadece üyeler' : 'Son adım'}
          </span>
          <Heading id="members-only-title" className="font-display text-2xl font-bold leading-tight text-foreground text-balance md:text-3xl">
            {guest ? title : '18+ onayı gerekiyor'}
          </Heading>
          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground text-pretty md:text-base">
            {guest
              ? 'Bu bölüm sadece AL KANKA üyelerine açık. Ücretsiz üye ol ya da giriş yap, ardından 18 yaşından büyük olduğunu onayla.'
              : 'Bu bölümde sponsorlu içerik var. Devam etmek için 18 yaşından büyük olduğunu bir kez onaylaman yeterli.'}
          </p>
          {guest ? (
            <div className="flex flex-wrap items-center gap-3">
              <a
                href="#kayit"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90"
              >
                <Gift className="size-4" aria-hidden="true" />
                Ücretsiz üye ol
              </a>
              <a href="#giris" className="text-sm font-semibold text-foreground underline-offset-4 hover:underline">
                Giriş yap
              </a>
            </div>
          ) : (
            <AgeConfirm />
          )}
        </div>
        <div className="relative -mb-5 hidden aspect-square w-36 shrink-0 sm:block md:-mb-7 lg:w-44" aria-hidden="true">
          <Image
            src="/images/mascots/jako-merhaba-cut.png"
            alt=""
            fill
            sizes="176px"
            className="object-contain object-bottom drop-shadow-2xl"
          />
        </div>
      </div>
    </section>
  )
}
