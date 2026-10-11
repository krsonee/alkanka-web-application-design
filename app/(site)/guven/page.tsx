import type { Metadata } from 'next'
import Link from 'next/link'
import { BadgeCheck, CheckCircle2, MessageSquareWarning, PenLine, SearchCheck, Send, Star } from 'lucide-react'
import { isSite, siteComplaints, siteName, siteReviews, siteTrustTable, type SiteTrust } from '@/lib/community'
import { SPONSORS } from '@/components/alkanka/data'
import { SponsorLogoPlate } from '@/components/alkanka/partner-sites'
import { TrustForms } from '@/components/alkanka/community/trust-forms'
import { COMPLAINT_STATUS } from '@/components/alkanka/community/labels'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Güven merkezi: site yorumları ve şikâyetler',
  description: 'Doğrulanmış üyelerin site yorumları, puanları ve şikâyet çözüm oranları.',
  alternates: { canonical: '/guven' },
}
export const dynamic = 'force-dynamic'

const fmtDate = (s: string) => new Date(s).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })

const STEPS = [
  { icon: PenLine, title: 'Yaz', text: 'Doğrulanmış üye olarak yorum ya da şikâyet bırak.' },
  { icon: SearchCheck, title: 'İnceleriz', text: 'Ekip içeriği kontrol eder, sahte kayıtları ayıklar.' },
  { icon: Send, title: 'İletiriz', text: 'Şikâyet siteye iletilir, yanıt burada yayınlanır.' },
  { icon: CheckCircle2, title: 'Çözülür', text: 'Çözüm oranı her sitenin karnesine işlenir.' },
]

function score(t: SiteTrust, fallback: number) {
  return t.rating ?? fallback
}

function resolveRate(t: SiteTrust) {
  return t.complaints ? Math.round((t.resolved / t.complaints) * 100) : null
}

export default async function TrustPage({ searchParams }: { searchParams: Promise<{ site?: string; tab?: string }> }) {
  const { site, tab } = await searchParams
  const table = await siteTrustTable()
  const fallbackOf = (id: string) => SPONSORS.find((s) => s.id === id)?.rating ?? 0
  const ranked = [...table].sort((a, b) => score(b, fallbackOf(b.siteId)) - score(a, fallbackOf(a.siteId)) || b.reviews - a.reviews)
  const selected = site && isSite(site) ? site : ranked[0]?.siteId ?? SPONSORS[0].id
  const current = table.find((t) => t.siteId === selected)!
  const sponsor = SPONSORS.find((s) => s.id === selected)!
  const view = tab === 'sikayet' ? 'sikayet' : 'yorum'
  const [reviews, complaints] = await Promise.all([siteReviews(selected), siteComplaints(selected)])
  const rate = resolveRate(current)
  const totals = table.reduce((a, t) => ({ reviews: a.reviews + t.reviews, complaints: a.complaints + t.complaints, resolved: a.resolved + t.resolved }), { reviews: 0, complaints: 0, resolved: 0 })
  const href = (s: string, t = view) => `/guven?site=${s}${t === 'sikayet' ? '&tab=sikayet' : ''}`

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-widest text-primary">Güven merkezi</span>
          <h1 className="text-balance font-display text-3xl font-bold text-foreground md:text-4xl">Sitelerin gerçek karnesi</h1>
          <p className="max-w-2xl text-pretty leading-relaxed text-muted-foreground">
            Yorumları yalnızca doğrulanmış AL KANKA üyeleri yazar. Toplam {totals.reviews} yorum, {totals.complaints} şikâyet ve
            {totals.complaints ? ` %${Math.round((totals.resolved / totals.complaints) * 100)}` : ' -'} çözüm oranı herkese açık.
          </p>
        </div>
        <ol className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {STEPS.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex items-start gap-3 rounded-xl border border-border bg-card p-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <Icon className="size-4" aria-hidden />
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="text-sm font-bold text-foreground">{title}</span>
                <span className="text-xs leading-relaxed text-muted-foreground">{text}</span>
              </span>
            </li>
          ))}
        </ol>
      </header>

      <section aria-labelledby="siralama" className="flex flex-col gap-3">
        <h2 id="siralama" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Güven sıralaması · bir site seç</h2>
        <ul className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-2">
          {ranked.map((t, i) => {
            const s = SPONSORS.find((x) => x.id === t.siteId)!
            const active = t.siteId === selected
            const r = resolveRate(t)
            return (
              <li key={t.siteId} className="w-40 shrink-0 snap-start">
                <Link
                  href={href(t.siteId)}
                  scroll={false}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex h-full flex-col gap-2 rounded-xl border p-3 transition-colors',
                    active ? 'border-primary bg-primary/10' : 'border-border bg-card hover:border-primary/50',
                  )}
                >
                  <span className="flex items-center justify-between text-[11px] font-bold text-muted-foreground">
                    <span>#{i + 1}</span>
                    <span className="flex items-center gap-0.5 text-primary">
                      <Star className="size-3 fill-current" aria-hidden />
                      {score(t, s.rating).toFixed(1)}
                    </span>
                  </span>
                  <span className="flex h-12 items-center justify-center overflow-hidden">
                    <SponsorLogoPlate sponsor={s} compact className="h-12 w-full" />
                  </span>
                  <span className="truncate text-sm font-bold text-foreground">{t.name}</span>
                  <span className="flex justify-between text-[11px] text-muted-foreground">
                    <span>{t.reviews} yorum</span>
                    <span>{r === null ? 'Şikâyet yok' : `%${r} çözüm`}</span>
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <section aria-labelledby="karne" className="panel-gold flex flex-col gap-4 rounded-xl p-4 sm:p-5">
            <div className="flex items-center gap-4">
              <span className="flex h-14 w-24 shrink-0 items-center justify-center overflow-hidden">
                <SponsorLogoPlate sponsor={sponsor} compact className="h-14 w-24" />
              </span>
              <div className="flex min-w-0 flex-col">
                <h2 id="karne" className="truncate font-display text-xl font-bold text-foreground">{current.name} karnesi</h2>
                <span className="text-sm text-muted-foreground">{sponsor.tagline} · Ortalama çekim {sponsor.payout}</span>
              </div>
            </div>
            <dl className="grid grid-cols-3 gap-2">
              <div className="flex flex-col gap-0.5 rounded-lg bg-background p-3">
                <dt className="text-[11px] text-muted-foreground">Üye puanı</dt>
                <dd className="flex items-center gap-1 font-display text-2xl font-bold text-foreground">
                  <Star className="size-5 fill-primary text-primary" aria-hidden />
                  {score(current, sponsor.rating).toFixed(1)}
                </dd>
                <dd className="text-[11px] text-muted-foreground">{current.reviews ? `${current.reviews} yorum` : 'Editör puanı'}</dd>
              </div>
              <div className="flex flex-col gap-0.5 rounded-lg bg-background p-3">
                <dt className="text-[11px] text-muted-foreground">Şikâyet</dt>
                <dd className="font-display text-2xl font-bold tabular-nums text-foreground">{current.complaints}</dd>
                <dd className="text-[11px] text-muted-foreground">{current.resolved} çözüldü</dd>
              </div>
              <div className="flex flex-col gap-0.5 rounded-lg bg-background p-3">
                <dt className="text-[11px] text-muted-foreground">Çözüm oranı</dt>
                <dd className="font-display text-2xl font-bold tabular-nums text-foreground">{rate === null ? '-' : `%${rate}`}</dd>
                <dd className="h-1.5 overflow-hidden rounded-full bg-secondary" aria-hidden>
                  <span className="block h-full bg-primary" style={{ width: `${rate ?? 0}%` }} />
                </dd>
              </div>
            </dl>
          </section>

          <div role="tablist" aria-label="İçerik" className="grid w-full grid-cols-2 gap-1 rounded-lg border border-border bg-card p-1 sm:w-fit">
            {(
              [
                ['yorum', `Yorumlar (${reviews.length})`],
                ['sikayet', `Şikâyetler (${complaints.length})`],
              ] as const
            ).map(([id, label]) => (
              <Link
                key={id}
                role="tab"
                aria-selected={view === id}
                href={href(selected, id)}
                scroll={false}
                className={cn('flex h-9 items-center justify-center rounded-md px-4 text-xs font-bold uppercase tracking-wider', view === id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
              >
                {label}
              </Link>
            ))}
          </div>

          {view === 'yorum' ? (
            reviews.length ? (
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
              <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                {current.name} için henüz yorum yok. İlk yorumu sen yaz, Güvenilir ses rozetini kap.
              </p>
            )
          ) : complaints.length ? (
            <ul className="flex flex-col gap-3">
              {complaints.map((c) => (
                <li key={c.id} className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex items-start gap-2 text-sm font-semibold text-foreground">
                      <MessageSquareWarning className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                      {c.title}
                    </span>
                    <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold', COMPLAINT_STATUS[c.status].className)}>{COMPLAINT_STATUS[c.status].label}</span>
                  </div>
                  <p className="line-clamp-4 text-sm leading-relaxed text-muted-foreground">{c.body}</p>
                  {c.reply && (
                    <p className="rounded-lg bg-primary/10 p-3 text-sm leading-relaxed text-foreground">
                      <b className="text-primary">AL KANKA yanıtı:</b> {c.reply}
                    </p>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {c.userName.split(' ')[0]} · {fmtDate(c.createdAt)}
                    {c.updatedAt !== c.createdAt && ` · güncellendi ${fmtDate(c.updatedAt)}`}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">{current.name} için kayıtlı şikâyet yok.</p>
          )}
        </div>

        <aside className="flex flex-col gap-3 xl:sticky xl:top-20 xl:self-start">
          <TrustForms siteId={selected} siteName={siteName(selected)} initialMode={view === 'sikayet' ? 'complaint' : 'review'} />
          <p className="px-1 text-xs leading-relaxed text-muted-foreground">
            Şifre, kart veya kimlik bilgisi paylaşma. Hakaret ve reklam içeren kayıtlar yayınlanmaz.
          </p>
        </aside>
      </div>
    </div>
  )
}
