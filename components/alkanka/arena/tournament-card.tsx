'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useActionState, useEffect, useRef } from 'react'
import { CalendarClock, Coins, Crown, Gamepad2, Trophy, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ARENA_META } from '@/lib/arena'
import { STATUS_LABEL, type Tournament } from '@/lib/tournaments-shared'
import { joinTournament, type JoinState } from '@/app/(site)/turnuvalar/actions'
import { formatAC, usePoints } from '../points-context'
import { BracketView } from './bracket-view'

export function formatTR(iso: string) {
  return new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'long', weekday: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
}

const STATUS_STYLE = {
  kayit: 'bg-primary text-primary-foreground',
  basladi: 'bg-destructive text-destructive-foreground',
  bitti: 'bg-secondary text-foreground',
  iptal: 'bg-muted text-muted-foreground',
} as const

export function TournamentCard({ t }: { t: Tournament }) {
  const meta = ARENA_META[t.game]
  const { points, spend } = usePoints()
  const [state, action, pending] = useActionState<JoinState, FormData>(joinTournament, {})
  const charged = useRef<JoinState | null>(null)
  const full = t.entries.length >= t.maxPlayers
  const canAfford = points >= t.entryFee
  const fill = Math.min(100, Math.round((t.entries.length / t.maxPlayers) * 100))

  useEffect(() => {
    if (state.ok && state.fee && charged.current !== state) {
      charged.current = state
      spend(state.fee)
    }
  }, [state, spend])

  return (
    <article className="flex flex-col overflow-hidden rounded-3xl border border-border bg-card">
      <div className="grid md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="relative min-h-56 md:min-h-full">
          <Image src={meta.image || '/placeholder.svg'} alt="" fill sizes="(min-width: 768px) 40vw, 100vw" className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-card via-card/20 to-transparent md:bg-gradient-to-r md:from-transparent md:via-transparent md:to-card" />
          <span className={cn('absolute left-4 top-4 rounded-md px-2.5 py-1 text-xs font-bold uppercase tracking-wider', STATUS_STYLE[t.status])}>{STATUS_LABEL[t.status]}</span>
        </div>

        <div className="flex flex-col gap-5 p-5 md:p-7">
          <div className="flex flex-col gap-2">
            <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-primary">
              <Gamepad2 className="size-4" aria-hidden="true" />
              {meta.title} turnuvası · {meta.players}
            </span>
            <h2 className="font-display text-3xl font-bold uppercase leading-none text-foreground text-balance">{t.title}</h2>
            {t.description && <p className="text-sm leading-relaxed text-muted-foreground text-pretty">{t.description}</p>}
          </div>

          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1 rounded-xl bg-secondary p-3">
              <dt className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                <Trophy className="size-3.5" aria-hidden="true" /> Ödül havuzu
              </dt>
              <dd className="font-display text-xl font-bold text-primary">{formatAC(t.prizePool)} KC</dd>
            </div>
            <div className="flex flex-col gap-1 rounded-xl bg-secondary p-3">
              <dt className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                <Coins className="size-3.5" aria-hidden="true" /> Katılım
              </dt>
              <dd className="font-display text-xl font-bold text-foreground">{t.entryFee ? `${formatAC(t.entryFee)} KC` : 'Ücretsiz'}</dd>
            </div>
            <div className="col-span-2 flex flex-col gap-1 rounded-xl bg-secondary p-3 sm:col-span-1">
              <dt className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                <CalendarClock className="size-3.5" aria-hidden="true" /> Başlangıç
              </dt>
              <dd className="text-sm font-semibold capitalize text-foreground">{formatTR(t.startsAt)}</dd>
            </div>
          </dl>
          {t.prizeNote && <p className="text-sm font-semibold text-foreground">{t.prizeNote}</p>}

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Users className="size-3.5" aria-hidden="true" /> Kayıtlı oyuncu
              </span>
              <span className="text-foreground">
                {t.entries.length} / {t.maxPlayers}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-secondary" role="progressbar" aria-valuenow={fill} aria-valuemin={0} aria-valuemax={100} aria-label="Kontenjan doluluğu">
              <div className="h-full rounded-full bg-primary" style={{ width: `${fill}%` }} />
            </div>
          </div>

          {t.status === 'bitti' && t.winner && (
            <div className="flex items-center gap-3 rounded-2xl border border-primary/50 bg-primary/10 p-4">
              <Crown className="size-7 text-primary" aria-hidden="true" />
              <div className="flex flex-col">
                <span className="text-xs font-bold uppercase tracking-wider text-primary">Şampiyon</span>
                <span className="font-display text-2xl font-bold uppercase text-foreground">{t.winner}</span>
              </div>
            </div>
          )}

          {t.status === 'kayit' &&
            (state.ok ? (
              <p className="rounded-xl border border-primary/50 bg-primary/10 p-4 text-sm font-semibold text-foreground" role="status">
                {state.message}
              </p>
            ) : (
              <form action={action} className="flex flex-col gap-3">
                <input type="hidden" name="id" value={t.id} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1.5 text-xs font-semibold text-muted-foreground">
                    Kullanıcı adın
                    <input name="nickname" required minLength={3} maxLength={20} autoComplete="nickname" placeholder="kanka_34" className="rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none" />
                  </label>
                  <label className="flex flex-col gap-1.5 text-xs font-semibold text-muted-foreground">
                    Telegram
                    <input name="telegram" required placeholder="@kullaniciadi" className="rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none" />
                  </label>
                </div>
                {state.message && (
                  <p className="text-sm font-semibold text-destructive" role="alert">
                    {state.message}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={pending || full || !canAfford}
                  className="rounded-xl bg-primary px-5 py-3 text-sm font-bold uppercase tracking-wide text-primary-foreground hover:brightness-110 disabled:opacity-50"
                >
                  {full ? 'Kontenjan doldu' : !canAfford ? `Bakiye yetersiz (${formatAC(t.entryFee)} KC gerekli)` : pending ? 'Kaydediliyor...' : t.entryFee ? `${formatAC(t.entryFee)} KC ile katıl` : 'Ücretsiz katıl'}
                </button>
                <Link href={`/oyunlar/${t.game}`} className="text-center text-xs font-semibold text-muted-foreground hover:text-foreground">
                  Turnuvadan önce {meta.title.toLowerCase()} masasında ısın
                </Link>
              </form>
            ))}

          {t.entries.length > 0 && !t.bracket && (
            <ul className="flex flex-wrap gap-1.5" aria-label="Katılımcılar">
              {t.entries.map((e) => (
                <li key={e.id} className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-foreground">
                  {e.nickname}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {t.bracket && (
        <div className="flex flex-col gap-3 border-t border-border p-5 md:p-7">
          <h3 className="font-display text-lg font-bold uppercase text-foreground">Eşleşmeler</h3>
          <BracketView bracket={t.bracket} />
        </div>
      )}
    </article>
  )
}
