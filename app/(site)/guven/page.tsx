import type { Metadata } from 'next'
import Link from 'next/link'
import { BadgeCheck, MessageSquareWarning, Star } from 'lucide-react'
import { isSite, siteComplaints, siteName, siteReviews, siteTrustTable } from '@/lib/community'
import { SPONSORS } from '@/components/alkanka/data'
import { TrustForms } from '@/components/alkanka/community/trust-forms'
import { COMPLAINT_STATUS } from '@/components/alkanka/community/labels'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Güven merkezi: site yorumları ve şikâyetler',
  description: 'Doğrulanmış üyelerin site yorumları, puanları ve şikâyet çözüm oranları.',
  alternates: { canonical: '/guven' },
}
export const dynamic = 'force-dynamic'

const fmtDate = (s: string) => new Date(s).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })

export default async function TrustPage({ searchParams }: { searchParams: Promise<{ site?: string }> }) {
  const { site } = await searchParams
  const table = await siteTrustTable()
  const ranked = [...table].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || b.reviews - a.reviews)
  const selected = site && isSite(site) ? site : ranked[0]?.siteId ?? SPONSORS[0].id
  const current = table.find((t) => t.siteId === selected)!
  const [reviews, complaints] = await Promise.all([siteReviews(selected), siteComplaints(selected)])
  const fallback = SPONSORS.find((s) => s.id === selected)?.rating ?? null
  const resolveRate = current.complaints ? Math.round((current.resolved / current.complaints) * 100) : null

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <span className="text-xs font-semibold uppercase tracking-widest text-primary">Güven merkezi</span>
        <h1 className="text-balance font-display text-3xl font-bold text-foreground md:text-4xl">Sitelerin gerçek karnesi</h1>
        <p className="max-w-2xl text-pretty leading-relaxed text-muted-foreground">
          Yorumları yalnızca doğrulanmış AL KANKA üyeleri yazar, her yorum yayından önce kontrol edilir. Şikâyetlerin çözüm oranı herkese açıktır.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
        <nav aria-label="Siteler" className="panel-gold flex max-h-[36rem] flex-col overflow-y-auto rounded-xl p-2">
          {ranked.map((t) => (
            <Link
              key={t.siteId}
              href={`/guven?site=${t.siteId}`}
              scroll={false}
              aria-current={t.siteId === selected ? 'page' : undefined}
              className={cn('flex items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-sm', t.siteId === selected ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-secondary')}
            >
              <span className="truncate font-semibold">{t.name}</span>
              <span className="flex shrink-0 items-center gap-2 text-xs tabular-nums">
                {t.rating !== null && (
                  <span className="flex items-center gap-0.5"><Star className="size-3 fill-current" aria-hidden />{t.rating.toFixed(1)}</span>
                )}
                <span className={t.siteId === selected ? '' : 'text-muted-foreground'}>{t.reviews}</span>
              </span>
            </Link>
          ))}
        </nav>

        <div className="flex flex-col gap-6">
          <section aria-labelledby="karne" className="grid gap-3 sm:grid-cols-3">
            <h2 id="karne" className="sr-only">{current.name} karnesi</h2>
            <div className="panel-gold flex flex-col gap-1 rounded-xl p-4">
              <span className="text-xs text-muted-foreground">Üye puanı</span>
              <span className="flex items-center gap-1.5 font-display text-3xl font-bold text-foreground">
                <Star className="size-6 fill-primary text-primary" aria-hidden />
                {(current.rating ?? fallback ?? 0).toFixed(1)}
              </span>
              <span className="text-xs text-muted-foreground">{current.reviews ? `${current.reviews} doğrulanmış yorum` : 'Editör puanı, henüz yorum yok'}</span>
            </div>
            <div className="panel-gold flex flex-col gap-1 rounded-xl p-4">
              <span className="text-xs text-muted-foreground">Şikâyet</span>
              <span className="font-display text-3xl font-bold text-foreground tabular-nums">{current.complaints}</span>
              <span className="text-xs text-muted-foreground">Toplam kayıt</span>
            </div>
            <div className="panel-gold flex flex-col gap-1 rounded-xl p-4">
              <span className="text-xs text-muted-foreground">Çözüm oranı</span>
              <span className="font-display text-3xl font-bold text-foreground tabular-nums">{resolveRate === null ? '-' : `%${resolveRate}`}</span>
              <span className="text-xs text-muted-foreground">{current.resolved} şikâyet çözüldü</span>
            </div>
          </section>

          <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
            <div className="flex flex-col gap-6">
              <section aria-labelledby="yorumlar" className="flex flex-col gap-3">
                <h2 id="yorumlar" className="font-display text-lg font-bold text-foreground">{siteName(selected)} yorumları</h2>
                {reviews.length ? (
                  <ul className="flex flex-col gap-3">
                    {reviews.map((r) => (
                      <li key={r.id} className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
                        <div className="flex items-center justify-between gap-3">
                          <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                            {r.userName.split(' ')[0]}
                            <BadgeCheck className="size-4 text-primary" aria-label="Doğrulanmış üye" />
                          </span>
                          <span className="flex items-center gap-0.5" aria-label={`${r.rating} yıldız`}>
                            {[1, 2, 3, 4, 5].map((n) => (
                              <Star key={n} className={cn('size-3.5', n <= r.rating ? 'fill-primary text-primary' : 'text-muted-foreground/40')} aria-hidden />
                            ))}
                          </span>
                        </div>
                        <p className="text-pretty text-sm leading-relaxed text-foreground">{r.body}</p>
                        <span className="text-xs text-muted-foreground">{fmtDate(r.createdAt)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">İlk yorumu sen yaz, Güvenilir ses rozetini kap.</p>
                )}
              </section>

              <section aria-labelledby="sikayetler" className="flex flex-col gap-3">
                <h2 id="sikayetler" className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
                  <MessageSquareWarning className="size-5 text-primary" aria-hidden />
                  Şikâyetler
                </h2>
                {complaints.length ? (
                  <ul className="flex flex-col gap-3">
                    {complaints.map((c) => (
                      <li key={c.id} className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
                        <div className="flex items-start justify-between gap-3">
                          <span className="text-sm font-semibold text-foreground">{c.title}</span>
                          <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold', COMPLAINT_STATUS[c.status].className)}>{COMPLAINT_STATUS[c.status].label}</span>
                        </div>
                        <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">{c.body}</p>
                        {c.reply && (
                          <p className="rounded-lg bg-primary/10 p-3 text-sm leading-relaxed text-foreground">
                            <b className="text-primary">AL KANKA yanıtı:</b> {c.reply}
                          </p>
                        )}
                        <span className="text-xs text-muted-foreground">{c.userName.split(' ')[0]} · {fmtDate(c.createdAt)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">Bu site için kayıtlı şikâyet yok.</p>
                )}
              </section>
            </div>
            <aside className="xl:sticky xl:top-20 xl:self-start">
              <TrustForms siteId={selected} siteName={siteName(selected)} />
            </aside>
          </div>
        </div>
      </div>
    </div>
  )
}
