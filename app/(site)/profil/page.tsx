import type { Metadata } from 'next'
import Link from 'next/link'
import { Award, Lock, Star } from 'lucide-react'
import { getMember } from '@/lib/member'
import { SITE_URL } from '@/lib/seo'
import {
  LEVELS,
  REFERRAL_MIN_GAMES,
  REFERRED_REWARD,
  REFERRER_REWARD,
  alertHits,
  getProfile,
  getRefCode,
  listAlerts,
  listReferrals,
  myComplaints,
  myReviews,
  siteName,
} from '@/lib/community'
import { AlertsCard, ReferralCard } from '@/components/alkanka/community/profile-widgets'
import { COMPLAINT_STATUS } from '@/components/alkanka/community/labels'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Profilim', robots: { index: false } }
export const dynamic = 'force-dynamic'

export default async function ProfilePage() {
  const member = await getMember()
  if (!member) {
    return (
      <section className="panel-gold mx-auto flex max-w-lg flex-col items-center gap-4 rounded-xl p-8 text-center">
        <Lock className="size-8 text-primary" aria-hidden />
        <h1 className="font-display text-2xl font-bold text-foreground">Profilini görmek için giriş yap</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">Seviye, rozetler, davet linki ve oran alarmların burada.</p>
        <a href="#giris" className="h-11 rounded-lg bg-primary px-5 text-sm font-bold leading-[2.75rem] text-primary-foreground">Giriş yap</a>
      </section>
    )
  }

  const [profile, code, referrals, alerts, hits, reviews, complaints] = await Promise.all([
    getProfile(member.id),
    getRefCode(member.id),
    listReferrals(member.id),
    listAlerts(member.id),
    alertHits(member.id),
    myReviews(member.id),
    myComplaints(member.id),
  ])
  const { level, xp } = profile
  const progress = level.next ? Math.round(((xp - level.min) / (level.next.min - level.min)) * 100) : 100
  const ready = referrals.filter((r) => !r.rewarded && r.games >= REFERRAL_MIN_GAMES).length
  const pending = referrals.filter((r) => !r.rewarded && r.games < REFERRAL_MIN_GAMES).length

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="seviye" className="panel-gold flex flex-col gap-5 rounded-xl p-5 md:flex-row md:items-center">
        <div className="flex size-20 shrink-0 flex-col items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <span className="text-[10px] font-semibold uppercase tracking-widest">Seviye</span>
          <span className="font-display text-3xl font-bold">{level.index + 1}</span>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 id="seviye" className="font-display text-2xl font-bold text-foreground">{member.name}</h1>
            <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-primary">{level.name}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-background" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Sonraki seviye ilerlemesi">
            <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-sm text-muted-foreground">
            <b className="text-foreground tabular-nums">{xp.toLocaleString('tr-TR')} XP</b>
            {level.next ? ` · ${level.next.name} için ${(level.next.min - xp).toLocaleString('tr-TR')} XP kaldı` : ' · En yüksek seviyedesin'}
          </p>
        </div>
        <ol className="hidden gap-1 lg:flex" aria-label="Seviyeler">
          {LEVELS.map((l, i) => (
            <li key={l.name} className={cn('rounded-md px-2.5 py-1.5 text-center text-[11px] font-semibold', i <= level.index ? 'bg-primary/15 text-primary' : 'bg-background text-muted-foreground')}>
              {l.name}
              <span className="block font-normal tabular-nums">{l.min}</span>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="rozetler" className="flex flex-col gap-3">
        <h2 id="rozetler" className="font-display text-lg font-bold text-foreground">Rozetler</h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {profile.badges.map((b) => (
            <li key={b.id} className={cn('flex flex-col gap-2 rounded-xl border p-4', b.earned ? 'border-primary/40 bg-primary/10' : 'border-border bg-card opacity-60')}>
              <Award className={cn('size-6', b.earned ? 'text-primary' : 'text-muted-foreground')} aria-hidden />
              <span className="font-display text-sm font-bold text-foreground">{b.label}</span>
              <span className="text-xs leading-relaxed text-muted-foreground">{b.earned ? 'Kazanıldı' : b.hint}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <ReferralCard
          url={`${SITE_URL}/davet/${code}`}
          pending={pending}
          ready={ready}
          reward={REFERRER_REWARD}
          friendReward={REFERRED_REWARD}
          minGames={REFERRAL_MIN_GAMES}
        />
        <AlertsCard alerts={alerts} telegramLinked={profile.stats.telegram} />
      </div>

      {hits.length > 0 && (
        <section aria-labelledby="eslesen" className="flex flex-col gap-3">
          <h2 id="eslesen" className="font-display text-lg font-bold text-foreground">Alarmına uyan oranlar</h2>
          <ul className="grid gap-2 md:grid-cols-2">
            {hits.map((h, i) => (
              <li key={`${h.dealId}-${i}`} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3">
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-semibold text-foreground">{h.odd.match}</span>
                  <span className="truncate text-xs text-muted-foreground">{h.brand} · {h.odd.market}</span>
                </div>
                <a href={h.link} target="_blank" rel="noopener noreferrer sponsored" className="shrink-0 rounded-lg bg-primary px-3 py-2 font-display text-sm font-bold tabular-nums text-primary-foreground">
                  {h.odd.newOdd.toFixed(2)}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {referrals.length > 0 && (
        <section aria-labelledby="davetlerim" className="flex flex-col gap-3">
          <h2 id="davetlerim" className="font-display text-lg font-bold text-foreground">Davet ettiklerin</h2>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {referrals.map((r, i) => (
              <li key={i} className="flex items-center justify-between rounded-xl border border-border bg-card p-3 text-sm">
                <span className="font-semibold text-foreground">{r.name}</span>
                <span className={r.rewarded ? 'text-primary' : 'text-muted-foreground'}>
                  {r.rewarded ? 'Ödül alındı' : `${Math.min(r.games, REFERRAL_MIN_GAMES)}/${REFERRAL_MIN_GAMES} oyun`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <section aria-labelledby="yorumlarim" className="flex flex-col gap-3">
          <h2 id="yorumlarim" className="font-display text-lg font-bold text-foreground">Yorumlarım</h2>
          {reviews.length ? (
            <ul className="flex flex-col gap-2">
              {reviews.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3 text-sm">
                  <span className="flex items-center gap-2 font-semibold text-foreground">
                    {siteName(r.siteId)}
                    <span className="flex items-center gap-0.5 text-primary"><Star className="size-3.5 fill-current" aria-hidden />{r.rating}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">{r.status === 'approved' ? 'Yayında' : r.status === 'pending' ? 'Onay bekliyor' : 'Reddedildi'}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Henüz yorum yazmadın. <Link href="/guven" className="font-semibold text-primary underline-offset-4 hover:underline">Güven merkezine git</Link></p>
          )}
        </section>
        <section aria-labelledby="sikayetlerim" className="flex flex-col gap-3">
          <h2 id="sikayetlerim" className="font-display text-lg font-bold text-foreground">Şikâyetlerim</h2>
          {complaints.length ? (
            <ul className="flex flex-col gap-2">
              {complaints.map((c) => (
                <li key={c.id} className="flex flex-col gap-1.5 rounded-xl border border-border bg-card p-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate font-semibold text-foreground">{siteName(c.siteId)} · {c.title}</span>
                    <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold', COMPLAINT_STATUS[c.status].className)}>{COMPLAINT_STATUS[c.status].label}</span>
                  </div>
                  {c.reply && <p className="text-xs leading-relaxed text-muted-foreground">Yanıt: {c.reply}</p>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Açık şikâyetin yok.</p>
          )}
        </section>
      </div>
    </div>
  )
}
