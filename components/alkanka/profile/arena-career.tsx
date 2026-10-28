import Link from 'next/link'
import { Crown, Flame, Medal, Target } from 'lucide-react'
import { GAME_META, type CemberGame } from '@/lib/cember-shared'
import type { CemberCareer } from '@/lib/cember'
import { cn } from '@/lib/utils'

const GAMES: CemberGame[] = ['cember', 'karadelik', 'survival']
const fmt = (n: number) => n.toLocaleString('tr-TR')
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0)
const day = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' })

export function ArenaCareer({ career }: { career: CemberCareer }) {
  const { played, wins, podiums, bestStreak, byGame, recent, predictions } = career

  if (played === 0 && predictions.made === 0) {
    return (
      <section aria-labelledby="arena-kariyer" className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-border bg-card p-5">
        <h2 id="arena-kariyer" className="font-display text-lg font-bold text-foreground">Arena kariyerin</h2>
        <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
          Henüz bir arena turuna katılmadın. İlk turuna gir, galibiyetlerin ve podyumların burada birikmeye başlasın.
        </p>
        <Link href="/" className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">
          Sıradaki tura bak
        </Link>
      </section>
    )
  }

  const stats = [
    { icon: Crown, label: 'Galibiyet', value: fmt(wins), sub: `%${pct(wins, played)} oran` },
    { icon: Medal, label: 'Podyum', value: fmt(podiums), sub: `${fmt(played)} turda` },
    { icon: Flame, label: 'En uzun seri', value: fmt(bestStreak), sub: 'üst üste kazanma' },
    { icon: Target, label: 'Tahmin isabeti', value: `%${pct(predictions.hits, predictions.made * 3)}`, sub: `${fmt(predictions.perfect)} tam isabet` },
  ]

  return (
    <section aria-labelledby="arena-kariyer" className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-5">
      <div className="flex items-end justify-between gap-3">
        <h2 id="arena-kariyer" className="font-display text-lg font-bold text-foreground">Arena kariyerin</h2>
        <span className="text-xs text-muted-foreground tabular-nums">{fmt(played)} tur oynandı</span>
      </div>

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="flex flex-col gap-1 rounded-xl bg-secondary/60 p-3">
            <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <s.icon className="size-4 text-gold" aria-hidden />
              {s.label}
            </dt>
            <dd className="font-display text-2xl font-bold tabular-nums text-foreground">{s.value}</dd>
            <dd className="text-xs text-muted-foreground">{s.sub}</dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-5 lg:grid-cols-[1fr_1.3fr]">
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-foreground">Oyunlara göre</h3>
          <ul className="flex flex-col gap-3">
            {GAMES.map((g) => {
              const s = byGame[g]
              return (
                <li key={g} className="flex flex-col gap-1.5">
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="text-muted-foreground">{GAME_META[g].label}</span>
                    <span className="tabular-nums text-foreground">
                      <span className="font-display font-bold">{fmt(s.wins)}</span>
                      <span className="text-muted-foreground"> / {fmt(s.played)}</span>
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full rounded-full bg-gold" style={{ width: `${pct(s.wins, s.played)}%` }} />
                  </div>
                </li>
              )
            })}
          </ul>
        </div>

        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-foreground">Son turların</h3>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sonucu açıklanmış tur yok.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {recent.map((r) => (
                <li key={r.slot} className="flex items-center justify-between gap-3 py-2">
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium text-foreground">{r.title || GAME_META[r.game].label}</span>
                    <span className="text-xs text-muted-foreground">
                      {GAME_META[r.game].short} · {day.format(new Date(r.slot))} · {fmt(r.players)} kişi
                    </span>
                  </div>
                  <span
                    className={cn(
                      'shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold',
                      r.won ? 'bg-gold text-gold-foreground' : r.place ? 'bg-gold/15 text-foreground' : 'bg-secondary text-muted-foreground',
                    )}
                  >
                    {r.won ? 'Kazandı' : r.place ? `${r.place}. sıra` : 'Elendi'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}
