import type { Metadata } from 'next'
import Link from 'next/link'
import { permanentRedirect } from 'next/navigation'
import { BadgeCheck, CheckCircle2, MessageSquareWarning, PenLine, SearchCheck, Send, Star } from 'lucide-react'
import { siteComplaints, siteReviews, siteTrustTable, type SiteTrust } from '@/lib/community'
import type { Sponsor } from '@/components/alkanka/data'
import { SponsorLogoPlate } from '@/components/alkanka/partner-sites'
import { TrustForms } from '@/components/alkanka/community/trust-forms'
import { COMPLAINT_STATUS } from '@/components/alkanka/community/labels'
import { PageHero } from '@/components/alkanka/page-hero'
import { SnapSlider } from '@/components/alkanka/home/snap-slider'
import { WithdrawWall } from '@/components/alkanka/community/withdraw-wall'
import { recentWithdrawals, siteWithdrawals, withdrawStats } from '@/lib/withdrawals'
import { cn } from '@/lib/utils'
import { getMember } from '@/lib/member'
import {
  complaintTracker,
  helpfulThisWeek,
  lastSponsorOfMonth,
  monthKey,
  monthLabel,
  mySponsorVote,
  reviewExtras,
  sponsorVoteBoard,
  HELPFUL_COIN,
  HELPFUL_KP,
  type ReviewExtra,
} from '@/lib/trust-extra'
import { HelpfulButton } from '@/components/alkanka/community/helpful-button'
import { SponsorVote } from '@/components/alkanka/community/sponsor-vote'
import { ShieldCheck, ThumbsUp, Timer, Trophy } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Güven merkezi: site yorumları ve şikâyetler',
  description: 'Doğrulanmış üyelerin site yorumları, puanları ve şikâyet çözüm oranları.',
  alternates: { canonical: '/guven' },
}
export const dynamic = 'force-dynamic'

const fmtDate = (s: string) => new Date(s).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })

const STEPS = [
  { icon: PenLine, title: 'Paylaş', text: 'Yorum, şikâyet ya da çekim ekran görüntüsü gönder.' },
  { icon: SearchCheck, title: 'İnceleriz', text: 'Ekip içeriği kontrol eder, sahte kayıtları ayıklar.' },
  { icon: Send, title: 'İletiriz', text: 'Şikâyet siteye iletilir, yanıt burada yayınlanır.' },
  { icon: CheckCircle2, title: 'Ödüllenir', text: 'Onaylı çekime ödül, çözülen şikâyete karne puanı.' },
]

function score(t: SiteTrust) {
  return t.rating ?? t.editorRating
}

function asSponsor(t: SiteTrust): Sponsor {
  return {
    id: t.slug,
    name: t.name,
    initials: t.initials,
    tier: 'guvenilir',
    tagline: t.tagline,
    welcome: '',
    perks: [],
    rating: t.editorRating,
    payout: t.payout,
    logoUrl: t.logoUrl || undefined,
  }
}

function resolveRate(t: SiteTrust) {
  return t.complaints ? Math.round((t.resolved / t.complaints) * 100) : null
}

export default async function TrustPage({ searchParams }: { searchParams: Promise<{ site?: string; tab?: string }> }) {
  const { site, tab } = await searchParams
  const table = await siteTrustTable()
  const view = tab === 'sikayet' ? 'sikayet' : tab === 'cekim' ? 'cekim' : 'yorum'
  const [stats, recent] = await Promise.all([withdrawStats().catch(() => []), recentWithdrawals(8).catch(() => [])])
  const statOf = (id: string) => stats.find((s) => s.siteId === id)
  const totalWithdraws = stats.reduce((a, s) => a + s.count, 0)
  const totals = table.reduce((a, t) => ({ reviews: a.reviews + t.reviews, complaints: a.complaints + t.complaints, resolved: a.resolved + t.resolved }), { reviews: 0, complaints: 0, resolved: 0 })
  const ranked = [...table].sort((a, b) => score(b) - score(a) || b.reviews - a.reviews)
  const current = ranked.find((item) => item.slug === site) ?? ranked.find((item) => item.siteId === site) ?? ranked[0]
  if (current && site && site !== current.slug) {
    permanentRedirect(`/guven?site=${current.slug}${view !== 'yorum' ? `&tab=${view}` : ''}`)
  }
  const sponsor = current ? asSponsor(current) : null
  const selected = current?.siteId ?? ''
  const [reviews, complaints, withdraws] = current
    ? await Promise.all([siteReviews(selected), siteComplaints(selected), siteWithdrawals(selected).catch(() => [])])
    : [[], [], []]
  const member = await getMember().catch(() => null)
  const [extras, tracker, voteBoard, myVote, helpfulTop, lastWinner] = await Promise.all([
    reviewExtras(reviews.map((r) => r.id), member?.id ?? null).catch(() => ({}) as Record<number, ReviewExtra>),
    complaintTracker().catch(() => null),
    sponsorVoteBoard().catch(() => []),
    member ? mySponsorVote(member.id).catch(() => null) : null,
    helpfulThisWeek().catch(() => []),
    lastSponsorOfMonth().catch(() => null),
  ])
  const voteOptions = ranked
    .map((t) => ({ siteId: t.siteId, name: t.name, votes: voteBoard.find((v) => v.siteId === t.siteId)?.votes ?? 0 }))
    .sort((a, b) => b.votes - a.votes)
  const rate = current ? resolveRate(current) : null
  const currentStat = current ? statOf(current.siteId) : undefined
  const href = (slug: string, t: string = view) => `/guven?site=${slug}${t !== 'yorum' ? `&tab=${t}` : ''}`

  return (
    <div className="flex flex-col gap-6">
      <PageHero
        eyebrow="Güven merkezi"
        title="Sitelerin gerçek karnesi"
        description="Yorumları yalnızca doğrulanmış AL KANKA üyeleri yazar. Puanlar, şikâyetler ve çözüm oranları herkese açık."
        image="/images/heroes/guven.png"
        tone="accent"
        compact
        stats={
          totals.reviews || totals.complaints || totalWithdraws
            ? [
                { label: 'Yorum', value: String(totals.reviews) },
                { label: 'Onaylı çekim', value: String(totalWithdraws) },
                { label: 'Çözüm oranı', value: totals.complaints ? `%${Math.round((totals.resolved / totals.complaints) * 100)}` : '-' },
              ]
            : undefined
        }
      />

      {recent.length > 0 && (
        <section aria-label="Son onaylı çekimler" className="relative -mx-4 overflow-hidden border-y border-border bg-card py-2 sm:mx-0 sm:rounded-xl sm:border">
          <div className="flex w-max animate-marquee gap-6 pl-4 motion-reduce:animate-none">
            {[...recent, ...recent].map((s, i) => (
              <span key={`${s.id}-${i}`} aria-hidden={i >= recent.length} className="flex shrink-0 items-center gap-2 text-xs">
                <BadgeCheck className="size-3.5 text-live" aria-hidden />
                <b className="text-foreground">{s.userName}</b>
                <span className="text-muted-foreground">{s.siteName} çekimi</span>
                <b className="tabular-nums text-primary">{s.amount.toLocaleString('tr-TR')} TL</b>
              </span>
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="nasil" className="flex flex-col gap-2">
        <h2 id="nasil" className="sr-only">Nasıl işler?</h2>
        <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {STEPS.map(({ icon: Icon, title, text }, i) => (
            <li
              key={title}
              className="step-cycle flex items-start gap-2.5 rounded-xl border border-border bg-card p-2.5 sm:gap-3 sm:p-3"
              style={{ animationDelay: `${i * 1.2}s` }}
            >
              <span className="relative flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary sm:size-9">
                <Icon className="size-4" aria-hidden />
                <span className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground" aria-hidden>
                  {i + 1}
                </span>
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="text-sm font-bold text-foreground">{title}</span>
                <span className="line-clamp-2 text-[11px] leading-snug text-muted-foreground sm:text-xs sm:leading-relaxed">{text}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      {ranked.length === 0 || !current || !sponsor ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Şu an listelenecek sponsor yok, yakında burada olacak.
        </p>
      ) : (
      <>
      <section aria-labelledby="siralama" className="flex flex-col gap-3">
        <div className="flex items-end justify-between gap-2">
          <h2 id="siralama" className="font-display text-lg font-bold text-foreground sm:font-sans sm:text-xs sm:uppercase sm:tracking-wider sm:text-muted-foreground">
            Güven sıralaması<span className="hidden sm:inline"> · bir site seç</span>
          </h2>
          <span className="text-xs font-semibold text-primary sm:hidden">Karnesi için siteye dokun</span>
        </div>
        <SnapSlider label="Siteler" autoplay={3800} itemClassName="w-[calc(50%-0.375rem)] sm:w-44 lg:w-48">
          {ranked.map((t, i) => {
            const s = asSponsor(t)
            const active = t.siteId === selected
            const r = resolveRate(t)
            return (
                <Link
                  key={t.siteId}
                  href={href(t.slug)}
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
                      {score(t).toFixed(1)}
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
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-live">
                    <BadgeCheck className="size-3" aria-hidden />
                    {statOf(t.siteId)?.count ?? 0} onaylı çekim
                  </span>
                </Link>
            )
          })}
        </SnapSlider>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <section aria-labelledby="karne" className="panel-gold flex flex-col gap-4 rounded-xl p-4 sm:p-5">
            <div className="flex items-center gap-4">
              <span className="flex h-14 w-24 shrink-0 items-center justify-center overflow-hidden">
                <SponsorLogoPlate sponsor={sponsor} compact className="h-14 w-24" />
              </span>
              <div className="flex min-w-0 flex-col">
                <h2 id="karne" className="truncate font-display text-xl font-bold text-foreground">
                  <Link href={`/siteler/${current.slug}`} className="hover:text-primary">{current.name} karnesi</Link>
                </h2>
                <span className="text-sm text-muted-foreground">{sponsor.tagline} · Ortalama çekim {sponsor.payout}</span>
              </div>
            </div>
            <dl className="grid grid-cols-3 gap-1.5 sm:gap-2 [&>div]:p-2.5 sm:[&>div]:p-3 [&_dd.font-display]:text-xl sm:[&_dd.font-display]:text-2xl">
              <div className="flex flex-col gap-0.5 rounded-lg bg-background p-3">
                <dt className="text-[11px] text-muted-foreground">Üye puanı</dt>
                <dd className="flex items-center gap-1 font-display text-2xl font-bold text-foreground">
                  <Star className="size-5 fill-primary text-primary" aria-hidden />
                  {score(current).toFixed(1)}
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
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-live/10 px-3 py-2 text-xs text-foreground">
              <span className="flex items-center gap-1 font-bold text-live">
                <BadgeCheck className="size-3.5" aria-hidden />
                {currentStat?.count ?? 0} onaylı çekim
              </span>
              {currentStat?.count ? (
                <>
                  <span>Toplam {currentStat.total.toLocaleString('tr-TR')} TL</span>
                  {currentStat.last && <span className="text-muted-foreground">Son: {fmtDate(currentStat.last)}</span>}
                </>
              ) : (
                <span className="text-muted-foreground">İlk çekimi sen paylaş, ödülü kap.</span>
              )}
            </p>
          </section>

          <div role="tablist" aria-label="İçerik" className="grid w-full grid-cols-3 gap-1 rounded-lg border border-border bg-card p-1 sm:w-fit">
            {(
              [
                ['yorum', `Yorum (${reviews.length})`],
                ['sikayet', `Şikâyet (${complaints.length})`],
                ['cekim', `Çekim (${withdraws.length})`],
              ] as const
            ).map(([id, label]) => (
              <Link
                key={id}
                role="tab"
                aria-selected={view === id}
                href={href(current.slug, id)}
                scroll={false}
                className={cn('flex h-9 items-center justify-center rounded-md px-2 text-[11px] font-bold uppercase tracking-wide sm:px-4 sm:text-xs', view === id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
              >
                {label}
              </Link>
            ))}
          </div>

          {view === 'cekim' ? (
            <WithdrawWall shares={withdraws} showSite={false} className="xl:grid-cols-3" empty={`${current.name} için henüz onaylı çekim yok. İlk çekimini paylaş, ödülünü al.`} />
          ) : view === 'yorum' ? (
            reviews.length ? (
              <ul className="flex flex-col gap-3">
                {reviews.map((r) => (
                  <li key={r.id} className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                        {r.userName.split(' ')[0]}
                        <BadgeCheck className="size-4 text-primary" aria-label="Doğrulanmış üye" />
                        {extras[r.id]?.verified && (
                          <span className="flex items-center gap-1 rounded-full bg-live/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-live">
                            <ShieldCheck className="size-3" aria-hidden />
                            Kanıtlı
                          </span>
                        )}
                      </span>
                      <span className="flex items-center gap-0.5" aria-label={`${r.rating} yıldız`}>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Star key={n} className={cn('size-3.5', n <= r.rating ? 'fill-primary text-primary' : 'text-muted-foreground/40')} aria-hidden />
                        ))}
                      </span>
                    </div>
                    <p className="text-pretty text-sm leading-relaxed text-foreground">{r.body}</p>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs text-muted-foreground">{fmtDate(r.createdAt)}</span>
                      <HelpfulButton reviewId={r.id} count={extras[r.id]?.helpful ?? 0} voted={extras[r.id]?.mine ?? false} own={!member || (extras[r.id]?.own ?? false)} />
                    </div>
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
          <TrustForms siteId={selected} siteName={current.name} initialMode={view === 'sikayet' ? 'complaint' : view === 'cekim' ? 'cekim' : 'review'} />
          <p className="px-1 text-xs leading-relaxed text-muted-foreground">
            Şifre, kart veya kimlik bilgisi paylaşma. Hakaret ve reklam içeren kayıtlar yayınlanmaz.
          </p>
        </aside>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {tracker && (
          <section aria-labelledby="sikayet-takip" className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 id="sikayet-takip" className="font-display text-lg font-bold text-foreground">Şikâyet takip sayacı</h2>
              {tracker.avgDays !== null && (
                <span className="flex items-center gap-1 text-xs font-semibold text-primary">
                  <Timer className="size-3.5" aria-hidden />
                  Ortalama {tracker.avgDays} günde çözüm
                </span>
              )}
            </div>
            <dl className="grid grid-cols-3 gap-2">
              {[
                ['Bekliyor', tracker.open],
                ['Sponsora iletildi', tracker.forwarded],
                ['Çözüldü', tracker.resolved],
              ].map(([label, value]) => (
                <div key={label} className="flex flex-col gap-0.5 rounded-lg bg-background p-3">
                  <dt className="text-[11px] text-muted-foreground">{label}</dt>
                  <dd className="font-display text-2xl font-bold tabular-nums text-foreground">{value}</dd>
                </div>
              ))}
            </dl>
            {tracker.recentResolved.length ? (
              <ul className="flex flex-col divide-y divide-border">
                {tracker.recentResolved.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <CheckCircle2 className="size-4 shrink-0 text-live" aria-hidden />
                      <span className="truncate text-foreground">{c.title}</span>
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {c.days === 0 ? 'aynı gün' : `${c.days} günde`}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Çözülen şikâyetler burada canlı listelenir.</p>
            )}
          </section>
        )}

        <section id="ayin-sponsoru" aria-labelledby="ayin-sponsoru-baslik" className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 id="ayin-sponsoru-baslik" className="font-display text-lg font-bold text-foreground">Ayın güvenilir sponsoru</h2>
            {lastWinner && (
              <span className="flex items-center gap-1 text-xs font-semibold text-primary">
                <Trophy className="size-3.5" aria-hidden />
                {monthLabel(lastWinner.month)}: {lastWinner.name}
              </span>
            )}
          </div>
          <SponsorVote options={voteOptions} mine={myVote} month={monthLabel(monthKey())} />
        </section>
      </div>

      <section aria-labelledby="faydali" className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 id="faydali" className="font-display text-lg font-bold text-foreground">Haftanın en faydalı yorumcuları</h2>
          <span className="text-xs text-muted-foreground">
            Pazartesi birinciye {HELPFUL_KP} KP + {HELPFUL_COIN} KC
          </span>
        </div>
        {helpfulTop.length ? (
          <ol className="flex flex-wrap gap-2">
            {helpfulTop.map((h, i) => (
              <li key={h.userId} className={cn('flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm', i === 0 ? 'border-primary bg-primary/10' : 'border-border')}>
                <span className="text-xs font-bold tabular-nums text-muted-foreground">{i + 1}.</span>
                <b className="text-foreground">{h.name}</b>
                <span className="flex items-center gap-1 text-xs tabular-nums text-primary">
                  <ThumbsUp className="size-3" aria-hidden />
                  {h.votes}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-muted-foreground">Bu hafta henüz faydalı oyu yok. İşine yarayan yorumlara oy ver, yazarı ödül kazansın.</p>
        )}
      </section>

      <section aria-labelledby="cekim-duvari" className="flex flex-col gap-3">
        <div className="flex items-end justify-between gap-2">
          <h2 id="cekim-duvari" className="font-display text-lg font-bold text-foreground">Çekim duvarı</h2>
          <span className="text-xs text-muted-foreground">Tüm sitelerden son onaylılar</span>
        </div>
        <WithdrawWall shares={recent} empty="Henüz onaylı çekim yok. Çekim paylaş sekmesinden ilk paylaşımı sen yap." />
      </section>
      </>
      )}
    </div>
  )
}
