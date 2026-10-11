import Link from 'next/link'
import { pageMeta } from '@/lib/seo'
import { getMember } from '@/lib/member'
import { AUTO_LABELS, RULE_FIELDS, badgeHolders, getKpConfig, getKpStatus, leaderboard, listSpecialBadges, levelTier } from '@/lib/kanka-puan'
import { LevelEmblem, SpecialEmblem, TIER_TEXT } from '@/components/alkanka/kp/emblem'
import { cn } from '@/lib/utils'

export const metadata = pageMeta('rozetler')
export const dynamic = 'force-dynamic'

const TIER_NAMES: Record<string, string> = { bronz: 'Bronz', altin: 'Altın', elmas: 'Elmas', efsane: 'Efsane' }

export default async function BadgesPage() {
  const member = await getMember()
  const [cfg, specials, holders, board, me] = await Promise.all([
    getKpConfig(),
    listSpecialBadges(),
    badgeHolders(),
    leaderboard(15),
    member ? getKpStatus(member.id) : Promise.resolve(null),
  ])
  const myLevel = me?.level.index ?? -1
  const earnRules = RULE_FIELDS.filter((f) => !f.key.endsWith('Cap') && cfg.rules[f.key] > 0)

  return (
    <div className="flex flex-col gap-10">
      <section className="panel-gold flex flex-col gap-5 rounded-xl p-6 md:flex-row md:items-center">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-widest text-primary">Kanka Puan</span>
          <h1 className="text-balance font-display text-3xl font-bold text-foreground">Puan topla, seviye atla, rozetini kap</h1>
          <p className="max-w-2xl text-pretty text-sm leading-relaxed text-muted-foreground">
            Sitede geçirdiğin her dakika, oynadığın her oyun, bitirdiğin her görev ve sohbette yazdığın her mesaj Kanka Puan kazandırır. {cfg.levels.length} seviyenin her birinin kendi rozeti var. Şampiyonlara ise değerli rozetler verilir.
          </p>
        </div>
        {me ? (
          <Link href="/profil" className="flex shrink-0 items-center gap-3 rounded-xl border border-border bg-background p-3 pr-5">
            <LevelEmblem level={me.level.index + 1} size="md" />
            <span className="flex flex-col">
              <span className="text-xs text-muted-foreground">Senin seviyen</span>
              <span className="font-display text-base font-bold text-foreground">{me.level.name}</span>
              <span className="text-xs tabular-nums text-primary">{me.kp.toLocaleString('tr-TR')} KP</span>
            </span>
          </Link>
        ) : (
          <a href="#giris" className="h-11 shrink-0 rounded-lg bg-primary px-5 text-sm font-bold leading-[2.75rem] text-primary-foreground">Giriş yap, puan kazanmaya başla</a>
        )}
      </section>

      <section aria-labelledby="kazan" className="flex flex-col gap-4">
        <h2 id="kazan" className="font-display text-xl font-bold text-foreground">Nasıl KP kazanılır?</h2>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {earnRules.map((f) => (
            <li key={f.key} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3">
              <span className="text-sm text-foreground">{f.label}</span>
              <span className="shrink-0 font-display text-sm font-bold tabular-nums text-primary">+{cfg.rules[f.key]}</span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">
          Günde en fazla {cfg.rules.minuteDailyCap} dakika ve {cfg.rules.chatDailyCap} sohbet mesajı puan kazandırır.
        </p>
      </section>

      <section aria-labelledby="seviyeler" className="flex flex-col gap-4">
        <h2 id="seviyeler" className="font-display text-xl font-bold text-foreground">Seviyeler ve rozetleri</h2>
        <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {cfg.levels.map((l, i) => {
            const reached = i <= myLevel
            const current = i === myLevel
            return (
              <li key={i} className={cn('flex flex-col items-center gap-2 rounded-xl border p-4 text-center', current ? 'border-primary bg-primary/10' : 'border-border bg-card')}>
                <LevelEmblem level={i + 1} size="md" locked={member ? !reached : false} />
                <span className="font-display text-sm font-bold text-foreground">{l.name}</span>
                <span className={cn('text-xs font-semibold', TIER_TEXT[levelTier(i + 1)])}>{l.badge}</span>
                <span className="text-xs tabular-nums text-muted-foreground">{l.min.toLocaleString('tr-TR')} KP</span>
                {current && <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase text-primary-foreground">Buradasın</span>}
              </li>
            )
          })}
        </ol>
        <p className="text-xs text-muted-foreground">Her 5 seviyede rozetin malzemesi değişir: {Object.values(TIER_NAMES).join(', ')}.</p>
      </section>

      <section aria-labelledby="degerli" className="flex flex-col gap-4">
        <h2 id="degerli" className="font-display text-xl font-bold text-foreground">Değerli rozetler</h2>
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {specials.map((b) => (
            <li key={b.id} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-3">
                <SpecialEmblem icon={b.icon} tier={b.tier} />
                <div className="flex min-w-0 flex-col">
                  <span className="font-display text-base font-bold text-foreground">{b.name}</span>
                  <span className={cn('text-xs font-semibold', TIER_TEXT[b.tier])}>{TIER_NAMES[b.tier]}{b.bonus ? ` · +${b.bonus.toLocaleString('tr-TR')} KP` : ''}</span>
                </div>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">{b.description}</p>
              {b.auto && <p className="text-xs text-muted-foreground">{AUTO_LABELS[b.auto]}</p>}
              <div className="mt-auto border-t border-border pt-3 text-xs text-muted-foreground">
                {holders[b.id]?.length ? (
                  <span>
                    Sahipleri: <span className="text-foreground">{holders[b.id].map((h) => (h.count > 1 ? `${h.name} ×${h.count}` : h.name)).join(', ')}</span>
                  </span>
                ) : (
                  'Henüz kimse kazanmadı. İlk sen ol.'
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="liderler" className="flex flex-col gap-4">
        <h2 id="liderler" className="font-display text-xl font-bold text-foreground">KP liderleri</h2>
        {board.length ? (
          <ol className="grid gap-2 lg:grid-cols-3">
            {board.map((r, i) => (
              <li key={r.userId} className={cn('flex items-center gap-3 rounded-xl border bg-card p-3', r.userId === member?.id ? 'border-primary' : 'border-border')}>
                <span className="w-5 text-right font-display text-sm font-bold tabular-nums text-muted-foreground">{i + 1}</span>
                <LevelEmblem level={r.level} size="sm" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-semibold text-foreground">{r.name}</span>
                  <span className="truncate text-xs text-muted-foreground">{r.levelName}{r.specials ? ` · ${r.specials} değerli rozet` : ''}</span>
                </span>
                <span className="font-display text-sm font-bold tabular-nums text-primary">{r.kp.toLocaleString('tr-TR')}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-muted-foreground">Henüz puan toplayan yok.</p>
        )}
      </section>
    </div>
  )
}
