'use client'

import { useActionState, type ReactNode } from 'react'
import { Loader2, Play, Plus, Trash2, UserX } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ARENA_GAMES, ARENA_META } from '@/lib/arena'
import { STATUS_LABEL, type Tournament } from '@/lib/tournaments-shared'
import { beginTournament, kickEntry, pickMatchWinner, removeTournament, saveTournament, stopTournament } from '@/app/admin/arena-actions'
import type { ActionState } from '@/app/admin/arena-actions'
import { BracketView } from '@/components/alkanka/arena/bracket-view'
import { formatTR } from '@/components/alkanka/arena/tournament-card'

const ISTANBUL_OFFSET = -180

function toIstanbulInput(iso?: string) {
  const d = iso ? new Date(iso) : new Date(Date.now() + 86400000)
  return new Date(d.getTime() + 3 * 3600000).toISOString().slice(0, 16)
}

const field = 'rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none'
const labelCls = 'flex flex-col gap-1.5 text-xs font-semibold text-muted-foreground'

function Feedback({ state }: { state: ActionState }) {
  if (!state.message) return null
  return (
    <p role="status" className={cn('text-sm font-semibold', state.ok ? 'text-primary' : 'text-destructive')}>
      {state.message}
    </p>
  )
}

function ActionButton({
  act,
  fields,
  children,
  variant = 'ghost',
  confirm,
}: {
  act: (s: ActionState, f: FormData) => Promise<ActionState>
  fields: Record<string, string | number>
  children: ReactNode
  variant?: 'primary' | 'ghost' | 'danger'
  confirm?: string
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(act, {})
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault()
      }}
      className="flex flex-col gap-1"
    >
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <button
        type="submit"
        disabled={pending}
        className={cn(
          'flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold disabled:opacity-60',
          variant === 'primary' && 'bg-primary text-primary-foreground',
          variant === 'ghost' && 'border border-border text-foreground hover:bg-secondary',
          variant === 'danger' && 'border border-destructive/50 text-destructive hover:bg-destructive/10',
        )}
      >
        {pending && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
        {children}
      </button>
      {!state.ok && state.message && <span className="text-xs text-destructive">{state.message}</span>}
    </form>
  )
}

function TournamentForm({ t }: { t?: Tournament }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveTournament, {})
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={t?.id ?? 0} />
      <input type="hidden" name="tz" value={ISTANBUL_OFFSET} />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelCls}>
          Oyun
          <select name="game" defaultValue={t?.game ?? 'tavla'} className={field}>
            {ARENA_GAMES.map((g) => (
              <option key={g} value={g}>
                {ARENA_META[g].title} ({ARENA_META[g].group === 4 ? '4 kişilik masalar' : 'birebir'})
              </option>
            ))}
          </select>
        </label>
        <label className={labelCls}>
          Turnuva adı
          <input name="title" required minLength={3} maxLength={80} defaultValue={t?.title} placeholder="Cuma Akşamı Tavla Kupası" className={field} />
        </label>
        <label className={cn(labelCls, 'sm:col-span-2')}>
          Açıklama
          <textarea name="description" rows={2} maxLength={400} defaultValue={t?.description} placeholder="Kurallar, format, yayın bilgisi..." className={field} />
        </label>
        <label className={labelCls}>
          Başlangıç (İstanbul saati)
          <input type="datetime-local" name="startsAt" required defaultValue={toIstanbulInput(t?.startsAt)} className={field} />
        </label>
        <label className={labelCls}>
          Kontenjan (oyuncu)
          <input type="number" name="maxPlayers" min={2} max={256} required defaultValue={t?.maxPlayers ?? 16} className={field} />
        </label>
        <label className={labelCls}>
          Katılım ücreti (KC, 0 = ücretsiz)
          <input type="number" name="entryFee" min={0} max={100000} required defaultValue={t?.entryFee ?? 100} className={field} />
        </label>
        <label className={labelCls}>
          Ödül havuzu (KC)
          <input type="number" name="prizePool" min={0} max={10000000} required defaultValue={t?.prizePool ?? 5000} className={field} />
        </label>
        <label className={cn(labelCls, 'sm:col-span-2')}>
          Ödül notu (isteğe bağlı)
          <input name="prizeNote" maxLength={120} defaultValue={t?.prizeNote} placeholder="1. 3.000 KC · 2. 1.500 KC · 3. 500 KC" className={field} />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60">
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}
          {t ? 'Değişiklikleri kaydet' : 'Turnuvayı oluştur'}
        </button>
        <Feedback state={state} />
      </div>
    </form>
  )
}

function WinnerPicker({ t, round, match, players, winner }: { t: Tournament; round: number; match: number; players: (string | null)[]; winner: string | null }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(pickMatchWinner, {})
  const real = players.filter((p): p is string => Boolean(p))
  return (
    <form action={action} className="flex items-center gap-1.5">
      <input type="hidden" name="id" value={t.id} />
      <input type="hidden" name="round" value={round} />
      <input type="hidden" name="match" value={match} />
      <label className="sr-only" htmlFor={`w-${t.id}-${round}-${match}`}>
        Kazanan
      </label>
      <select
        id={`w-${t.id}-${round}-${match}`}
        name="winner"
        defaultValue={winner ?? ''}
        disabled={pending || real.length < 2}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground"
      >
        <option value="">Kazanan seç</option>
        {real.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
      {pending && <Loader2 className="size-3.5 shrink-0 animate-spin text-primary" aria-hidden="true" />}
      {!state.ok && state.message && <span className="sr-only">{state.message}</span>}
    </form>
  )
}

function TournamentRow({ t }: { t: Tournament }) {
  return (
    <article className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-bold uppercase tracking-wider text-primary">
            {ARENA_META[t.game].title} · {STATUS_LABEL[t.status]}
          </span>
          <h3 className="font-display text-xl font-bold uppercase text-foreground">{t.title}</h3>
          <p className="text-xs capitalize text-muted-foreground">
            {formatTR(t.startsAt)} · {t.entries.length}/{t.maxPlayers} oyuncu · {t.entryFee} KC giriş · {t.prizePool} KC ödül
          </p>
          {t.winner && <p className="text-sm font-bold text-primary">Şampiyon: {t.winner}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {t.status === 'kayit' && (
            <ActionButton act={beginTournament} fields={{ id: t.id }} variant="primary" confirm="Kayıtlar kapanacak ve tüm oyuncular aynı anda eşleşecek.">
              <Play className="size-3.5" aria-hidden="true" />
              Kayıtları kapat ve başlat
            </ActionButton>
          )}
          {(t.status === 'kayit' || t.status === 'basladi') && (
            <ActionButton act={stopTournament} fields={{ id: t.id }} variant="danger" confirm="Turnuva iptal edilecek, açık maçlar kapanacak ve kayıt ücretleri iade edilecek.">
              İptal et
            </ActionButton>
          )}
          <ActionButton act={removeTournament} fields={{ id: t.id }} variant="danger" confirm="Turnuva ve tüm kayıtlar silinecek.">
            <Trash2 className="size-3.5" aria-hidden="true" />
            Sil
          </ActionButton>
        </div>
      </div>

      {t.bracket && (
        <div className="flex flex-col gap-2">
          <h4 className="text-sm font-bold text-foreground">Eşleşmeler (kazananı seçince otomatik bir üst tura geçer)</h4>
          <BracketView bracket={t.bracket} renderPick={(r, m, match) => <WinnerPicker t={t} round={r} match={m} players={match.players} winner={match.winner} />} />
        </div>
      )}

      <details className="group rounded-xl border border-border">
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-foreground">Katılımcılar ({t.entries.length})</summary>
        {t.entries.length === 0 ? (
          <p className="px-4 pb-4 text-sm text-muted-foreground">Henüz kayıt yok.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border border-t border-border">
            {t.entries.map((e, i) => (
              <li key={e.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <span className="flex items-center gap-3">
                  <span className="w-6 text-xs text-muted-foreground">{i + 1}</span>
                  <span className="font-semibold text-foreground">{e.nickname}</span>
                  <span className="text-muted-foreground">{e.telegram}</span>
                </span>
                {t.status === 'kayit' && (
                  <ActionButton act={kickEntry} fields={{ entryId: e.id }} variant="danger">
                    <UserX className="size-3.5" aria-hidden="true" />
                    <span className="sr-only sm:not-sr-only">Çıkar</span>
                  </ActionButton>
                )}
              </li>
            ))}
          </ul>
        )}
      </details>

      <details className="rounded-xl border border-border">
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-foreground">Bilgileri düzenle</summary>
        <div className="border-t border-border p-4">
          <TournamentForm t={t} />
        </div>
      </details>
    </article>
  )
}

export function TournamentManager({ tournaments }: { tournaments: Tournament[] }) {
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-4 rounded-2xl border border-primary/40 bg-card p-5">
        <div className="flex flex-col gap-1">
          <h2 className="font-display text-xl font-bold uppercase text-foreground">Yeni turnuva oluştur</h2>
          <p className="text-sm text-muted-foreground">
            Oluşturduğun turnuva hemen /turnuvalar sayfasında kayda açılır. Başlattığında eşleşmeler kura ile çekilir: tavla ve bilardo birebir, okey 4 kişilik masalardır.
          </p>
        </div>
        <TournamentForm />
      </section>
      {tournaments.length === 0 ? (
        <p className="text-sm text-muted-foreground">Henüz turnuva yok.</p>
      ) : (
        tournaments.map((t) => <TournamentRow key={t.id} t={t} />)
      )}
    </div>
  )
}
