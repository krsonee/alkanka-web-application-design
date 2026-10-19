'use client'

import { useMemo, useState } from 'react'
import useSWR, { useSWRConfig } from 'swr'
import { Coins, Loader2, Lock, Radio, Trophy } from 'lucide-react'
import { cn } from '@/lib/utils'
import { poolMultiplier, type BetsState, type TvBet, type TvMarket } from '@/lib/tv-bets-shared'

const fetcher = async (url: string) => {
  const r = await fetch(url)
  if (!r.ok) throw new Error('Etkinlikler yüklenemedi')
  return (await r.json()) as BetsState
}

const BET_STATUS: Record<TvBet['status'], { text: string; cls: string }> = {
  open: { text: 'Bekliyor', cls: 'bg-secondary text-muted-foreground' },
  won: { text: 'Kazandı', cls: 'bg-primary/15 text-primary' },
  lost: { text: 'Kaybetti', cls: 'bg-destructive/10 text-destructive' },
  refund: { text: 'İade', cls: 'bg-secondary text-foreground' },
}

function MarketCard({ market, state, onPlaced }: { market: TvMarket; state: BetsState; onPlaced: () => void }) {
  const { config } = state
  const [pick, setPick] = useState<string | null>(null)
  const [stake, setStake] = useState(config.minStake)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const suspended = Boolean(market.suspendedUntil && new Date(market.suspendedUntil).getTime() > Date.now())
  const closed = market.status !== 'open' || suspended
  const canBet = state.member && state.eligibility.ok && !closed

  const potential = (key: string) => {
    if (market.mode === 'fixed') {
      const odd = market.options.find((o) => o.key === key)?.odd
      return odd ? Math.floor(stake * odd) : null
    }
    const mult = poolMultiplier(market, key, config.rake, stake)
    return mult ? Math.floor(stake * mult) : null
  }

  const submit = async () => {
    if (!pick) return
    setBusy(true)
    setMsg(null)
    try {
      const r = await fetch('/api/kankatv/bets', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ marketId: market.id, pick, stake }),
      })
      const body = (await r.json().catch(() => ({}))) as { error?: string }
      if (!r.ok) throw new Error(body.error ?? 'Katılım başarısız')
      setMsg({ ok: true, text: `${stake} coin ile katıldın kanka, bol şans!` })
      setPick(null)
      onPlaced()
    } catch (error) {
      setMsg({ ok: false, text: (error as Error).message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-bold text-foreground text-pretty">{market.title}</span>
        <span
          className={cn(
            'flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide',
            closed ? 'bg-secondary text-muted-foreground' : 'bg-live/15 text-live',
          )}
        >
          {closed ? <Lock className="size-3" aria-hidden="true" /> : <span className="size-1.5 rounded-full bg-live motion-safe:animate-pulse" aria-hidden="true" />}
          {suspended ? 'Gol arası' : closed ? 'Kapalı' : market.phase === 'live' ? `${market.closeMinute}' kapanır` : 'Maç öncesi'}
        </span>
      </div>
      <div role="radiogroup" aria-label={market.title} className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {market.options.map((o) => {
          const share = market.total > 0 ? Math.round((o.pool / market.total) * 100) : 0
          const mult = market.mode === 'fixed' ? o.odd : poolMultiplier(market, o.key, config.rake)
          return (
            <button
              key={o.key}
              type="button"
              role="radio"
              aria-checked={pick === o.key}
              disabled={!canBet}
              onClick={() => setPick(o.key)}
              className={cn(
                'relative flex flex-col items-start gap-0.5 overflow-hidden rounded-lg border px-3 py-2 text-left transition-colors disabled:cursor-not-allowed',
                pick === o.key ? 'border-primary bg-primary/10' : 'border-border bg-background hover:border-primary/60',
                market.result === o.key && 'border-primary',
              )}
            >
              <span className="absolute inset-y-0 left-0 bg-primary/10" style={{ width: `${share}%` }} aria-hidden="true" />
              <span className="relative text-sm font-semibold text-foreground">{o.label}</span>
              <span className="relative text-xs tabular-nums text-muted-foreground">
                {mult ? `x${mult.toFixed(2)}` : 'x—'} · %{share}
              </span>
            </button>
          )
        })}
      </div>
      {pick && canBet ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="flex flex-1 items-center gap-2 rounded-lg border border-input bg-background px-3 py-2">
            <Coins className="size-4 shrink-0 text-primary" aria-hidden="true" />
            <span className="sr-only">Yatırılacak coin</span>
            <input
              type="number"
              inputMode="numeric"
              min={config.minStake}
              max={config.maxStake}
              value={stake}
              onChange={(e) => setStake(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
              className="w-full bg-transparent text-sm font-semibold tabular-nums text-foreground focus:outline-none"
            />
          </label>
          <div className="flex gap-1.5">
            {[config.minStake, Math.min(config.maxStake, config.minStake * 5), config.maxStake].map((v) => (
              <button key={v} type="button" onClick={() => setStake(v)} className="rounded-md border border-border px-2 py-1.5 text-xs font-semibold tabular-nums text-foreground hover:bg-muted">
                {v}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={submit}
            disabled={busy || stake < config.minStake || stake > config.maxStake}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            Katıl{potential(pick) ? ` · ~${potential(pick)!.toLocaleString('tr-TR')}` : ''}
          </button>
        </div>
      ) : null}
      <p className="text-[11px] text-muted-foreground">
        {market.mode === 'pool' ? `Havuz: ${market.total.toLocaleString('tr-TR')} coin · kazananlar paylaşır (%${config.rake} kesinti)` : 'Sabit oran · oran katıldığın an kilitlenir'}
      </p>
      {msg && (
        <p role="status" className={cn('text-xs', msg.ok ? 'text-primary' : 'text-destructive')}>
          {msg.text}
        </p>
      )}
    </li>
  )
}

export function LiveEvents() {
  const { data, mutate } = useSWR<BetsState>('/api/kankatv/bets', fetcher, { refreshInterval: 10_000, revalidateOnFocus: true })
  const { mutate: globalMutate } = useSWRConfig()
  const [gameId, setGameId] = useState<number | null>(null)

  const games = useMemo(() => {
    if (!data) return []
    const withMarkets = new Set(data.markets.map((m) => m.gameId))
    return data.games.filter((g) => withMarkets.has(g.gameId)).sort((a, b) => Number(b.state === 'in') - Number(a.state === 'in'))
  }, [data])

  if (!data?.config.enabled || !games.length) return null
  const activeId = games.some((g) => g.gameId === gameId) ? gameId! : games[0].gameId
  const game = games.find((g) => g.gameId === activeId)!
  const markets = data.markets.filter((m) => m.gameId === activeId)
  const refresh = () => {
    mutate()
    globalMutate('/api/me')
  }
  const { eligibility } = data

  return (
    <section aria-labelledby="live-events-title" className="flex flex-col gap-4 rounded-2xl border border-primary/30 bg-card p-4 sm:p-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Radio className="size-5 text-live" aria-hidden="true" />
          <h2 id="live-events-title" className="font-display text-lg font-bold text-foreground">
            Canlı etkinlikler
          </h2>
        </div>
        {data.member && data.balance != null && (
          <span className="flex items-center gap-1.5 rounded-lg bg-background px-2.5 py-1 text-sm font-bold tabular-nums text-foreground">
            <Coins className="size-4 text-primary" aria-hidden="true" />
            {data.balance.toLocaleString('tr-TR')}
          </span>
        )}
      </header>

      {games.length > 1 && (
        <div role="tablist" aria-label="Maç" className="flex gap-2 overflow-x-auto pb-1">
          {games.map((g) => (
            <button
              key={g.gameId}
              type="button"
              role="tab"
              aria-selected={g.gameId === activeId}
              onClick={() => setGameId(g.gameId)}
              className={cn(
                'flex shrink-0 items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold',
                g.gameId === activeId ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-foreground hover:bg-muted',
              )}
            >
              {g.state === 'in' && <span className="size-1.5 rounded-full bg-live" aria-hidden="true" />}
              {g.home} - {g.away}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 rounded-xl bg-background px-4 py-3">
        <span className="min-w-0 flex-1 truncate text-right text-sm font-bold text-foreground">{game.home}</span>
        <span className="flex flex-col items-center">
          <span className="font-display text-xl font-bold tabular-nums text-foreground">{game.state === 'pre' ? 'vs' : game.score}</span>
          <span className={cn('text-[11px] font-bold tabular-nums', game.state === 'in' ? 'text-live' : 'text-muted-foreground')}>
            {game.state === 'in'
              ? `${game.minute}'`
              : game.state === 'post'
                ? 'Bitti'
                : new Date(game.kickoff).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' })}
          </span>
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-bold text-foreground">{game.away}</span>
      </div>

      {!data.member ? (
        <p className="rounded-lg bg-background px-3 py-2 text-xs text-muted-foreground">Katılmak için giriş yap kanka.</p>
      ) : !eligibility.ok ? (
        <p className="rounded-lg bg-background px-3 py-2 text-xs leading-relaxed text-muted-foreground">
          Katılmak için bugün en az {eligibility.need} dk KankaTV izlemelisin. Şu an {eligibility.minutes} dk, yayını açık bırak yeter.
        </p>
      ) : null}

      <ul className="grid gap-3 lg:grid-cols-2">
        {markets.map((m) => (
          <MarketCard key={m.id} market={m} state={data} onPlaced={refresh} />
        ))}
      </ul>

      {data.bets.length > 0 && (
        <details className="rounded-xl border border-border bg-background p-3">
          <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-foreground">
            <Trophy className="size-4 text-primary" aria-hidden="true" />
            Katılımlarım ({data.bets.length})
          </summary>
          <ul className="mt-3 flex flex-col gap-2">
            {data.bets.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-3 rounded-lg bg-card px-3 py-2 text-xs">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-foreground">
                    {b.title}: {b.pick}
                  </span>
                  <span className="block truncate text-muted-foreground">{b.match}</span>
                </span>
                <span className="shrink-0 text-right tabular-nums">
                  <span className="block font-semibold text-foreground">
                    {b.stake} → {b.status === 'won' || b.status === 'refund' ? b.payout : b.status === 'open' ? '?' : 0}
                  </span>
                  <span className={cn('mt-0.5 inline-block rounded px-1.5 py-0.5 text-[10px] font-bold', BET_STATUS[b.status].cls)}>{BET_STATUS[b.status].text}</span>
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}
