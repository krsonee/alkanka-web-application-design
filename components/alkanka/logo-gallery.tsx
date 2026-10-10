'use client'

import Link from 'next/link'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useBrand, type LogoConcept } from './brand-context'
import { AlkankaLogo, EMBLEM_LOGOS, LOGO_CONCEPTS, PRO_LOGOS, SVG_LOGOS, type LogoOption } from './logos'

function ImageLogoGrid({
  id,
  title,
  note,
  logos,
  concept,
  onSelect,
}: {
  id: string
  title: string
  note: string
  logos: LogoOption[]
  concept: LogoConcept
  onSelect: (id: LogoConcept) => void
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id={id} className="font-display text-lg font-bold">
          {title} <span className="text-sm font-normal text-muted-foreground">({logos.length})</span>
        </h2>
        <p className="text-sm text-muted-foreground">{note}</p>
      </div>
      <div role="radiogroup" aria-labelledby={id} className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {logos.map((logo) => {
          const selected = logo.id === concept
          return (
            <button
              key={logo.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onSelect(logo.id)}
              className={cn(
                'group relative flex flex-col gap-3 rounded-xl border-2 bg-card p-3 text-left transition-all',
                selected ? 'border-primary shadow-[0_0_24px_-6px_var(--primary)]' : 'border-border hover:border-primary/50',
              )}
            >
              <div className="relative aspect-square overflow-hidden rounded-lg bg-[#000]">
                <img
                  src={logo.image}
                  alt={`${logo.name} logosu`}
                  className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                {selected && (
                  <span className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="size-4" aria-hidden="true" />
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="font-semibold">{logo.name}</span>
                <span className="text-xs text-muted-foreground">{logo.description}</span>
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )
}

export function LogoGallery() {
  const { concept, setConcept } = useBrand()
  const current = LOGO_CONCEPTS.find((c) => c.id === concept)

  return (
    <main className="min-h-dvh bg-background px-4 pb-32 pt-8 text-foreground">
      <div className="mx-auto flex max-w-5xl flex-col gap-10">
        <header className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link href="/" className="text-sm text-primary hover:underline">
              {'← Ana sayfaya dön'}
            </Link>
            <Link
              href="/maskot"
              className="rounded-lg border border-primary/50 px-3 py-1.5 text-sm font-semibold text-primary hover:bg-primary/10"
            >
              {'Maskot seçeneklerine bak →'}
            </Link>
          </div>
          <h1 className="font-display text-3xl font-bold text-balance">Logo Seçenekleri</h1>
          <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
            Bir logoya tıkla, seçilsin. Seçimin kaydedilir; ana sayfadaki menü ve üst bar o logoyla açılır.
          </p>
        </header>

        <ImageLogoGrid
          id="pro-title"
          title="Profesyonel logolar"
          note="Düz vektör, espor / bahis markası tarzı. Küçük boyutta da okunur."
          logos={PRO_LOGOS}
          concept={concept}
          onSelect={setConcept}
        />

        <ImageLogoGrid
          id="amblem-title"
          title="3D amblemler"
          note="Önceki madalyon tarzı seçenekler."
          logos={EMBLEM_LOGOS}
          concept={concept}
          onSelect={setConcept}
        />

        <section aria-labelledby="yazi-title" className="flex flex-col gap-4">
          <h2 id="yazi-title" className="font-display text-lg font-bold">
            Yazı logoları
          </h2>
          <div role="radiogroup" aria-labelledby="yazi-title" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {SVG_LOGOS.map((logo) => {
              const selected = logo.id === concept
              return (
                <button
                  key={logo.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setConcept(logo.id)}
                  className={cn(
                    'flex flex-col gap-3 rounded-xl border-2 bg-card p-4 text-left transition-all',
                    selected ? 'border-primary' : 'border-border hover:border-primary/50',
                  )}
                >
                  <div className="flex h-16 items-center">
                    <AlkankaLogo concept={logo.id} />
                  </div>
                  <span className="text-xs text-muted-foreground">{logo.name}</span>
                </button>
              )
            })}
          </div>
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="hidden text-xs uppercase tracking-widest text-muted-foreground sm:block">Önizleme</span>
            <AlkankaLogo concept={concept} />
          </div>
          <Link
            href="/"
            className="shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:opacity-90"
          >
            {`${current?.name ?? ''} ile devam et`}
          </Link>
        </div>
      </div>
    </main>
  )
}
