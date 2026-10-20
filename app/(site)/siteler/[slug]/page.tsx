import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, permanentRedirect } from 'next/navigation'
import { ArrowRight, ArrowUpRight, BadgeCheck, Check, ChevronRight, Crown, MessageSquareWarning, ShieldCheck, Star, Wallet } from 'lucide-react'
import { FollowButton } from '@/components/alkanka/growth-widgets'
import { getMember } from '@/lib/member'
import { myFollows } from '@/lib/growth'
import { SITE_URL } from '@/lib/seo'
import { listPublicSponsors, resolvePublicSite } from '@/lib/sites'

export const dynamic = 'force-dynamic'

const TIER_LABEL: Record<string, string> = { ana: 'Ana sponsor', vip: 'VIP sponsor', guvenilir: 'Güvenilir sponsor' }

async function findSponsor(slug: string) {
  const site = await resolvePublicSite(slug).catch(() => null)
  return site
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const s = await findSponsor(slug)
  if (!s) return { title: 'Site bulunamadı', robots: { index: false } }
  const title = `${s.name} güncel giriş, bonus ve inceleme`
  const description = `${s.name}: ${s.welcome}. Çekim süresi ${s.payout}, puan ${s.rating.toFixed(1)}. Adres değişince haber almak için takip et.`
  return { title, description, alternates: { canonical: `${SITE_URL}/siteler/${s.id}` }, openGraph: { title, description } }
}

function RatingStars({ value }: { value: number }) {
  return (
    <span className="flex items-center gap-0.5" aria-label={`${value.toFixed(1)} / 5 puan`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          aria-hidden
          className={`size-4 ${i < Math.round(value) ? 'fill-primary text-primary' : 'text-muted-foreground/40'}`}
        />
      ))}
    </span>
  )
}

export default async function SiteDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const s = await findSponsor(slug)
  if (!s) notFound()
  if (slug !== s.id) permanentRedirect(`/siteler/${s.id}`)

  const member = await getMember()
  const following = member ? (await myFollows(member.id).catch(() => [] as string[])).includes(s.recordId) : false
  const others = (await listPublicSponsors().catch(() => [])).filter((item) => item.id !== s.id).slice(0, 4)
  const tierLabel = TIER_LABEL[s.tier] ?? 'Sponsor'

  const stats = [
    { icon: Star, label: 'Kanka puanı', value: `${s.rating.toFixed(1)} / 5` },
    { icon: Wallet, label: 'Çekim süresi', value: s.payout },
    { icon: ShieldCheck, label: 'Hoş geldin bonusu', value: s.welcome },
  ]

  return (
    <div className="flex flex-col gap-4 md:gap-8">
      <nav aria-label="Konum" className="sd-rise flex items-center gap-1 text-xs text-muted-foreground">
        <Link href="/sponsorlar" className="transition-colors hover:text-foreground">Sponsorlar</Link>
        <ChevronRight className="size-3" aria-hidden />
        <span className="text-foreground">{s.name}</span>
      </nav>

      <section aria-labelledby="site-ad" className="sd-hero sd-rise rounded-3xl p-3 md:p-8">
        <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-center md:gap-8">
          <div className="sd-logo-wrap relative flex h-28 w-full shrink-0 items-center justify-center overflow-hidden rounded-2xl md:h-40 md:w-72">
            <span className="sd-logo-sheen" aria-hidden />
            {s.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- logos can come from any https host saved with the sponsor
              <img src={s.logoUrl} alt={`${s.name} logosu`} className="sd-logo relative max-h-[68%] w-auto max-w-[70%] object-contain md:max-w-[82%]" />
            ) : (
              <span className="sd-logo relative font-display text-5xl font-bold text-primary">{s.initials}</span>
            )}
            <span className="sd-tier absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest md:hidden">
              <Crown className="size-3" aria-hidden />
              {tierLabel}
            </span>
            <span className="absolute right-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-background/70 px-2 py-0.5 text-[11px] font-bold tabular-nums text-foreground backdrop-blur-sm md:hidden">
              <Star className="size-3 fill-primary text-primary" aria-hidden />
              {s.rating.toFixed(1)}
            </span>
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-1.5 px-1 md:gap-3 md:px-0">
            <span className="sd-tier hidden w-fit items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-widest md:inline-flex">
              <Crown className="size-3.5" aria-hidden />
              {tierLabel}
            </span>
            <h1 id="site-ad" className="flex items-center gap-2 font-display text-2xl font-bold text-balance text-foreground md:text-4xl">
              {s.name}
              <BadgeCheck className="size-5 shrink-0 text-primary md:size-6" aria-label="Doğrulanmış sponsor" />
            </h1>
            {s.tagline ? <p className="text-sm leading-relaxed text-muted-foreground text-pretty md:text-base">{s.tagline}</p> : null}
            <div className="hidden items-center gap-2 text-sm md:flex">
              <RatingStars value={s.rating} />
              <span className="font-bold tabular-nums text-foreground">{s.rating.toFixed(1)}</span>
              <span className="text-muted-foreground">Kanka puanı</span>
            </div>
          </div>

          <div className="flex flex-col gap-2 md:w-64">
            <a
              href={`/git/${s.id}`}
              target="_blank"
              rel="nofollow sponsored noopener"
              className="sd-cta relative inline-flex h-12 items-center justify-center gap-2 overflow-hidden rounded-xl bg-primary px-5 text-sm font-bold uppercase tracking-wide text-primary-foreground"
            >
              <span className="relative">Güncel adrese git</span>
              <ArrowRight className="relative size-4" aria-hidden />
            </a>
            <FollowButton siteId={s.recordId} initial={following} loggedIn={!!member} />
            <p className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="sd-live-dot" aria-hidden />
              Adres her gün kontrol ediliyor
            </p>
          </div>
        </div>
      </section>

      <dl className="grid grid-cols-3 gap-2 sm:gap-3">
        {stats.map((x, i) => (
          <div
            key={x.label}
            className="sd-stat sd-rise flex min-w-0 flex-col items-center gap-2 rounded-2xl px-2 py-3 text-center sm:flex-row sm:items-center sm:gap-3 sm:p-4 sm:text-left"
            style={{ animationDelay: `${120 + i * 80}ms` }}
          >
            <span className="sd-stat-icon flex size-9 shrink-0 items-center justify-center rounded-xl text-primary sm:size-11">
              <x.icon className="size-4 sm:size-5" aria-hidden />
            </span>
            <div className="flex w-full min-w-0 flex-col gap-0.5">
              <dt className="truncate text-[10px] uppercase tracking-wider text-muted-foreground sm:text-xs sm:normal-case sm:tracking-normal">{x.label}</dt>
              <dd className="line-clamp-2 break-words font-display text-sm font-bold leading-tight text-foreground sm:text-base">{x.value}</dd>
            </div>
          </div>
        ))}
      </dl>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <section aria-labelledby="avantajlar" className="sd-panel sd-rise flex min-w-0 flex-col gap-3 rounded-2xl p-4 md:gap-4 md:p-5" style={{ animationDelay: '360ms' }}>
          <h2 id="avantajlar" className="font-display text-lg font-bold text-foreground">Öne çıkanlar</h2>
          <ul className="flex flex-col gap-2">
            {s.perks.map((p) => (
              <li key={p} className="sd-perk flex items-start gap-3 rounded-xl px-3 py-2.5 text-sm leading-relaxed text-foreground">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="size-3" aria-hidden strokeWidth={3} />
                </span>
                <span className="min-w-0 break-words">{p}</span>
              </li>
            ))}
          </ul>
          <p className="rounded-xl border border-border/60 bg-background/40 p-3 text-xs leading-relaxed text-muted-foreground">
            Adres engellendiğinde bu sayfadaki buton otomatik olarak yeni adrese yönlendirir. Takip edersen değişiklikte Telegram ve bildirimle haber veririz.
            18 yaş altı kullanıcılar katılamaz. Sorumlu oyna.
          </p>
          <Link href="/guven" className="group inline-flex w-fit items-center gap-2 text-sm font-semibold text-primary">
            <MessageSquareWarning className="size-4" aria-hidden />
            Kullanıcı yorumları ve şikâyetler
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden />
          </Link>
        </section>

        {others.length > 0 ? (
          <aside aria-labelledby="diger" className="sd-rise flex flex-col gap-3" style={{ animationDelay: '440ms' }}>
            <h2 id="diger" className="font-display text-base font-bold text-foreground">Diğer sponsorlar</h2>
            <ul className="flex flex-col gap-2">
              {others.map((o) => (
                <li key={o.id}>
                  <Link href={`/siteler/${o.id}`} className="sd-other group flex items-center gap-3 rounded-xl p-2.5">
                    <span className="sponsor-logo-plate flex h-11 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg text-xs font-bold text-primary">
                      {o.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- logos can come from any https host saved with the sponsor
                        <img src={o.logoUrl} alt="" className="size-full object-contain p-1.5" />
                      ) : o.initials}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-semibold text-foreground">{o.name}</span>
                      <span className="flex items-center gap-1 text-xs tabular-nums text-muted-foreground">
                        <Star className="size-3 fill-primary text-primary" aria-hidden />
                        {o.rating.toFixed(1)}
                      </span>
                    </span>
                    <ArrowUpRight className="size-4 text-muted-foreground transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </aside>
        ) : null}
      </div>
    </div>
  )
}
