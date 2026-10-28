import Link from 'next/link'
import { ArrowRight, Goal, Orbit } from 'lucide-react'

export function KaraDelikEntry() {
  return (
    <section aria-label="Yeni arena ön izlemeleri" className="mx-auto grid w-full max-w-6xl gap-3 px-4 pt-4 md:grid-cols-2">
      <Link
        href="/survival-onizleme"
        className="group flex items-center gap-4 rounded-2xl border border-primary/40 bg-card p-4 text-card-foreground transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <Goal className="size-6" aria-hidden="true" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-xs font-semibold uppercase tracking-widest text-primary">Yeni · Ön izleme</span>
          <span className="text-base font-bold text-balance">Survival Arena</span>
          <span className="text-sm leading-relaxed text-muted-foreground text-pretty">Tekli ya da Altın–Mavi takım. Kaleye giren elenir.</span>
        </span>
        <ArrowRight className="size-5 shrink-0 text-primary transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
      </Link>
      <Link
        href="/arena-onizleme"
        className="group flex items-center gap-4 rounded-2xl border border-primary/40 bg-card p-4 text-card-foreground transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <Orbit className="size-6" aria-hidden="true" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-xs font-semibold uppercase tracking-widest text-primary">Yeni · Ön izleme</span>
          <span className="text-base font-bold text-balance">Kara Delik Arenası</span>
          <span className="text-sm leading-relaxed text-muted-foreground text-pretty">
            Kişi sayısını ve kazanan sayısını seç, Başlat&apos;a bas ve izle.
          </span>
        </span>
        <span className="hidden shrink-0 items-center gap-1 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground sm:flex">
          Oynat
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </span>
        <ArrowRight className="size-5 shrink-0 text-primary sm:hidden" aria-hidden="true" />
      </Link>
    </section>
  )
}
