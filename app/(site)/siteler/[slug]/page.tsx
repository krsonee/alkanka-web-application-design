import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowRight, Check, ShieldCheck, Star, Wallet } from 'lucide-react'
import { SPONSORS } from '@/components/alkanka/data'
import { FollowButton } from '@/components/alkanka/growth-widgets'
import { getMember } from '@/lib/member'
import { myFollows } from '@/lib/growth'
import { SITE_URL } from '@/lib/seo'

export const dynamic = 'force-dynamic'

const TIER_LABEL: Record<string, string> = { platinum: 'Platin sponsor', gold: 'Altın sponsor', silver: 'Gümüş sponsor' }

function findSponsor(slug: string) {
  return SPONSORS.find((s) => s.id === slug)
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const s = findSponsor(slug)
  if (!s) return { title: 'Site bulunamadı', robots: { index: false } }
  const title = `${s.name} güncel giriş, bonus ve inceleme`
  const description = `${s.name}: ${s.welcome}. Çekim süresi ${s.payout}, puan ${s.rating.toFixed(1)}. Adres değişince haber almak için takip et.`
  return { title, description, alternates: { canonical: `${SITE_URL}/siteler/${s.id}` }, openGraph: { title, description } }
}

export default async function SiteDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const s = findSponsor(slug)
  if (!s) notFound()

  const member = await getMember()
  const following = member ? (await myFollows(member.id).catch(() => [] as string[])).includes(s.id) : false
  const others = SPONSORS.filter((x) => x.id !== s.id).slice(0, 4)

  return (
    <div className="flex flex-col gap-8">
      <nav aria-label="Konum" className="text-xs text-muted-foreground">
        <Link href="/sponsorlar" className="hover:text-foreground">Sponsorlar</Link>
        <span aria-hidden> / </span>
        <span className="text-foreground">{s.name}</span>
      </nav>

      <section aria-labelledby="site-ad" className="flex flex-col gap-6 rounded-2xl border border-border bg-card p-5 md:flex-row md:items-center md:p-8">
        <div className="flex size-20 shrink-0 items-center justify-center rounded-2xl bg-primary font-display text-2xl font-bold text-primary-foreground">
          {s.initials}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <span className="text-xs font-bold uppercase tracking-widest text-primary">{TIER_LABEL[s.tier] ?? 'Sponsor'}</span>
          <h1 id="site-ad" className="font-display text-3xl font-bold text-balance text-foreground">{s.name}</h1>
          <p className="text-sm leading-relaxed text-muted-foreground text-pretty">{s.tagline}</p>
        </div>
        <div className="flex flex-col gap-2 md:w-64">
          <a
            href={`/git/${s.id}`}
            rel="nofollow sponsored"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-bold text-primary-foreground hover:opacity-90"
          >
            Güncel adrese git
            <ArrowRight className="size-4" aria-hidden />
          </a>
          <FollowButton siteId={s.id} initial={following} loggedIn={!!member} />
        </div>
      </section>

      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { icon: Star, label: 'Kanka puanı', value: `${s.rating.toFixed(1)} / 5` },
          { icon: Wallet, label: 'Çekim süresi', value: s.payout },
          { icon: ShieldCheck, label: 'Hoş geldin bonusu', value: s.welcome },
        ].map((x) => (
          <div key={x.label} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
              <x.icon className="size-5" aria-hidden />
            </span>
            <div className="flex min-w-0 flex-col">
              <dt className="text-xs text-muted-foreground">{x.label}</dt>
              <dd className="font-display text-base font-bold text-foreground">{x.value}</dd>
            </div>
          </div>
        ))}
      </dl>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <section aria-labelledby="avantajlar" className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
          <h2 id="avantajlar" className="font-display text-lg font-bold text-foreground">Öne çıkanlar</h2>
          <ul className="flex flex-col gap-2">
            {s.perks.map((p) => (
              <li key={p} className="flex items-start gap-2 text-sm leading-relaxed text-foreground">
                <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                {p}
              </li>
            ))}
          </ul>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Adres engellendiğinde bu sayfadaki buton otomatik olarak yeni adrese yönlendirir. Takip edersen değişiklikte Telegram ve bildirimle haber veririz.
            18 yaş altı kullanıcılar katılamaz. Sorumlu oyna.
          </p>
          <Link href="/guven" className="text-sm font-semibold text-primary hover:underline">Kullanıcı yorumları ve şikâyetler</Link>
        </section>

        <aside aria-labelledby="diger" className="flex flex-col gap-3">
          <h2 id="diger" className="font-display text-base font-bold text-foreground">Diğer sponsorlar</h2>
          <ul className="flex flex-col gap-2">
            {others.map((o) => (
              <li key={o.id}>
                <Link href={`/siteler/${o.id}`} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 hover:bg-secondary">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-secondary text-xs font-bold text-foreground">{o.initials}</span>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{o.name}</span>
                  <span className="text-xs tabular-nums text-muted-foreground">{o.rating.toFixed(1)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  )
}
