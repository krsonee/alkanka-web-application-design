import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowRight, Check } from 'lucide-react'
import { LANDING_PAGES, getLandingPage } from '@/lib/landing-pages'
import { SITE_URL } from '@/lib/seo'

export const dynamicParams = false

export function generateStaticParams() {
  return LANDING_PAGES.map((p) => ({ slug: p.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const p = getLandingPage(slug)
  if (!p) return {}
  const url = `${SITE_URL}/oyna/${p.slug}`
  return {
    title: p.title,
    description: p.description,
    keywords: p.keywords,
    alternates: { canonical: url },
    openGraph: { title: p.title, description: p.description, url, images: [{ url: p.image }] },
    twitter: { card: 'summary_large_image', title: p.title, description: p.description, images: [p.image] },
  }
}

export default async function LandingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const p = getLandingPage(slug)
  if (!p) notFound()

  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: p.faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  }

  return (
    <div className="flex flex-col gap-8 md:gap-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd).replace(/</g, '\\u003c') }} />

      <section className="sd-panel grid items-center gap-6 overflow-hidden rounded-3xl p-5 md:grid-cols-2 md:gap-10 md:p-10">
        <div className="flex flex-col gap-4">
          <span className="w-fit rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">{p.kicker}</span>
          <h1 className="font-display text-3xl font-bold leading-tight text-foreground text-balance md:text-5xl">{p.heading}</h1>
          <p className="text-base leading-relaxed text-muted-foreground text-pretty md:text-lg">{p.lead}</p>
          <div className="flex flex-wrap gap-3 pt-2">
            <a href="#kayit" className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground">
              Ücretsiz üye ol
              <ArrowRight className="size-4" aria-hidden />
            </a>
            <Link href={p.playHref} className="inline-flex items-center rounded-xl border border-border px-5 py-3 font-semibold text-foreground">
              Önce bir göz at
            </Link>
          </div>
          <p className="text-xs text-muted-foreground">Gerçek para yok, tamamen ücretsiz. 18 yaş ve üzeri içindir.</p>
        </div>
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl">
          <Image src={p.image} alt={p.heading} fill priority sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" />
        </div>
      </section>

      <section aria-labelledby="ozellikler" className="flex flex-col gap-4">
        <h2 id="ozellikler" className="font-display text-xl font-bold text-foreground md:text-2xl">Neden Alkanka?</h2>
        <ul className="grid gap-3 md:grid-cols-3">
          {p.features.map((f) => (
            <li key={f.title} className="sd-panel flex flex-col gap-2 rounded-2xl p-5">
              <h3 className="font-display font-bold text-foreground">{f.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{f.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="nasil" className="sd-panel flex flex-col gap-4 rounded-2xl p-5 md:p-8">
        <h2 id="nasil" className="font-display text-xl font-bold text-foreground md:text-2xl">Nasıl başlarım?</h2>
        <ol className="grid gap-3 md:grid-cols-3">
          {p.steps.map((s, i) => (
            <li key={s} className="flex items-center gap-3 rounded-xl bg-background/50 p-4">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground">{i + 1}</span>
              <span className="font-semibold text-foreground">{s}</span>
            </li>
          ))}
        </ol>
        <a href="#kayit" className="inline-flex w-fit items-center gap-2 rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground">
          Hemen başla
          <ArrowRight className="size-4" aria-hidden />
        </a>
      </section>

      <section aria-labelledby="sss" className="flex flex-col gap-3">
        <h2 id="sss" className="font-display text-xl font-bold text-foreground md:text-2xl">Sık sorulan sorular</h2>
        {p.faqs.map((f) => (
          <details key={f.q} className="sd-panel rounded-xl p-4">
            <summary className="flex cursor-pointer items-center gap-2 font-semibold text-foreground">
              <Check className="size-4 text-primary" aria-hidden />
              {f.q}
            </summary>
            <p className="pt-2 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
          </details>
        ))}
      </section>
    </div>
  )
}
