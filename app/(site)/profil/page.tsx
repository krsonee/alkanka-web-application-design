import type { Metadata } from 'next'
import Link from 'next/link'
import { Award, Lock, Star } from 'lucide-react'
import { getMember } from '@/lib/member'
import { SITE_URL } from '@/lib/seo'
import { getKpConfig, getKpStatus, type KpBreakdown } from '@/lib/kanka-puan'
import { LevelEmblem, SpecialEmblem } from '@/components/alkanka/kp/emblem'
import {
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

const KP_SOURCES: [keyof KpBreakdown, string][] = [
  ['time', 'Sitede geçen süre'],
  ['games', 'Oyunlar'],
  ['tasks', 'Görevler'],
  ['chat', 'Sohbet'],
  ['league', 'Tahmin ligi'],
  ['reviews', 'Yorumlar'],
  ['referrals', 'Davetler'],
  ['telegram', 'Telegram'],
  ['bonus', 'Rozet ve ödüller'],
]

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

  const [kpStatus, kpConfig, profile, code, referrals, alerts, hits, reviews, complaints] = await Promise.all([
    getKpStatus(member.id),
    getKpConfig(),
    getProfile(member.id),
    getRefCode(member.id),
    listReferrals(member.id),
    listAlerts(member.id),
    alertHits(member.id),
    myReviews(member.id),
    myComplaints(member.id),
  ])
  const { level, kp, breakdown } = kpStatus
  const ready = referrals.filter((r) => !r.rewarded && r.games >= REFERRAL_MIN_GAMES).length
  const pending = referrals.filter((r) => !r.rewarded && r.games < REFERRAL_MIN_GAMES).length

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="seviye" className="panel-gold flex flex-col gap-5 rounded-xl p-5 md:flex-row md:items-center">
        <LevelEmblem level={level.index + 1} size="lg" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 id="seviye" className="font-display text-2xl font-bold text-foreground">{member.name}</h1>
            <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-primary">Seviye {level.index + 1} · {level.name}</span>
          </div>
          <p className="text-sm text-muted-foreground">Rozetin: <b className="text-foreground">{level.badge}</b>{kpStatus.rank ? ` · KP sıralamasında ${kpStatus.rank}.` : ''}</p>
          <div className="h-2.5 overflow-hidden rounded-full bg-background" role="progressbar" aria-valuenow={level.progress} aria-valuemin={0} aria-valuemax={100} aria-label="Sonraki seviye ilerlemesi">
            <div className="h-full rounded-full bg-primary" style={{ width: `${level.progress}%` }} />
          </div>
          <p className="text-sm text-muted-foreground">
            <b className="text-foreground tabular-nums">{kp.toLocaleString('tr-TR')} KP</b>
            {level.next ? ` · ${level.next.name} (${level.next.badge}) için ${(level.next.min - kp).toLocaleString('tr-TR')} KP kaldı` : ' · En yüksek seviyedesin'}
          </p>
        </div>
        <Link href="/rozetler" className="h-10 shrink-0 rounded-lg border border-primary/40 px-4 text-sm font-semibold leading-10 text-primary hover:bg-primary/10">
          Tüm seviyeler
        </Link>
      </section>

      <section aria-labelledby="kp-kaynak" className="flex flex-col gap-3">
        <h2 id="kp-kaynak" className="font-display text-lg font-bold text-foreground">KP nereden geldi?</h2>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {KP_SOURCES.map(([key, label]) => (
            <li key={key} className="flex flex-col gap-0.5 rounded-xl border border-border bg-card p-3">
              <span className="text-xs text-muted-foreground">{label}</span>
              <span className="font-display text-lg font-bold tabular-nums text-foreground">{breakdown[key].toLocaleString('tr-TR')}</span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">
          Bugün sitede {kpStatus.todayMinutes} / {kpConfig.rules.minuteDailyCap} dakika puan kazandın.
        </p>
      </section>

      <section aria-labelledby="degerli" className="flex flex-col gap-3">
        <h2 id="degerli" className="font-display text-lg font-bold text-foreground">Değerli rozetlerin</h2>
        {kpStatus.badges.length ? (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {kpStatus.badges.map((b) => (
              <li key={b.id} className="flex items-center gap-3 rounded-xl border border-primary/30 bg-card p-4">
                <SpecialEmblem icon={b.icon} tier={b.tier} />
                <div className="flex min-w-0 flex-col">
                  <span className="font-display text-sm font-bold text-foreground">{b.name}{b.count > 1 ? ` ×${b.count}` : ''}</span>
                  <span className="text-xs leading-relaxed text-muted-foreground">{b.description}</span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            Henüz değerli rozetin yok. Tahmin ligi, sohbet yarışması ve turnuvalarda birinci ol. <Link href="/rozetler" className="font-semibold text-primary underline-offset-4 hover:underline">Rozetleri gör</Link>
          </p>
        )}
      </section>

      <section aria-labelledby="rozetler" className="flex flex-col gap-3">
        <h2 id="rozetler" className="font-display text-lg font-bold text-foreground">Başarımlar</h2>
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
