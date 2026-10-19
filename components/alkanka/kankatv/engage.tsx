'use client'

import { useEffect, useRef, useState } from 'react'
import useSWR from 'swr'
import { Bell, BellOff, Coins, Eye, Loader2, Percent, Target } from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePoints } from '@/components/alkanka/points-context'
import { PICK_LABELS, REACTION_LABELS, REACTIONS, type PredictPick, type Reaction, type TvEngage } from '@/lib/kankatv-shared'
import type { Match } from '@/lib/kankatv'

const VIEWER_KEY = 'kankatv-viewer'

function viewerId() {
  if (typeof window === 'undefined') return ''
  let id = sessionStorage.getItem(VIEWER_KEY)
  if (!id) {
    id = crypto.randomUUID()
    sessionStorage.setItem(VIEWER_KEY, id)
  }
  return id
}

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error('Yüklenemedi')
    return r.json() as Promise<TvEngage>
  })

export function useTvEngage(refreshInterval = 20_000, enabled = true) {
  return useSWR<TvEngage>(enabled ? `/api/kankatv/engage?viewer=${viewerId()}` : null, fetcher, { refreshInterval, revalidateOnFocus: true })
}

async function post<T>(body: Record<string, unknown>): Promise<T> {
  const res = await fetch('/api/kankatv/engage', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? 'İşlem yapılamadı')
  return data as T
}

// --- Watch bar (under the player) ----------------------------------------

type Floating = { key: number; kind: Reaction; left: number }

export function WatchBar({ playing, demo }: { playing: boolean; demo?: TvEngage }) {
  const live = useTvEngage(10_000, !demo)
  const data = demo ?? live.data
  const mutate = live.mutate
  const { refresh, requireLogin } = usePoints()
  const [floating, setFloating] = useState<Floating[]>([])
  const seen = useRef<Set<number>>(new Set())
  const primed = useRef(false)
  const [error, setError] = useState<string | null>(null)

  const cfg = data?.config
  const watchOn = Boolean(cfg?.watch.enabled && cfg.watch.coin > 0)

  useEffect(() => {
    if (!data?.reactions) return
    const fresh = data.reactions.filter((r) => !seen.current.has(r.id))
    for (const r of data.reactions) seen.current.add(r.id)
    if (!primed.current) {
      primed.current = true
      return
    }
    if (!fresh.length) return
    const items = fresh.slice(0, 12).map((r) => ({ key: r.id, kind: r.kind, left: 10 + Math.random() * 80 }))
    setFloating((f) => [...f, ...items].slice(-20))
    const timer = setTimeout(() => setFloating((f) => f.filter((x) => !items.includes(x))), 2600)
    return () => clearTimeout(timer)
  }, [data?.reactions])

  useEffect(() => {
    if (!demo || !demo.config.reactions) return
    const id = setInterval(() => {
      const key = -Date.now()
      const kind = REACTIONS[Math.floor(Math.random() * REACTIONS.length)]
      setFloating((f) => [...f, { key, kind, left: 10 + Math.random() * 80 }].slice(-20))
      setTimeout(() => setFloating((f) => f.filter((x) => x.key !== key)), 2600)
    }, 900)
    return () => clearInterval(id)
  }, [demo])

  useEffect(() => {
    if (demo || !playing || !data?.member || !watchOn) return
    const tick = async () => {
      if (document.visibilityState !== 'visible') return
      try {
        const { watch } = await post<{ watch: TvEngage['watch'] }>({ action: 'tick' })
        const before = data.watch?.earned ?? 0
        mutate((d) => (d ? { ...d, watch } : d), { revalidate: false })
        if (watch && watch.earned > before) refresh()
      } catch {}
    }
    const id = setInterval(tick, 60_000)
    return () => clearInterval(id)
  }, [playing, data?.member, data?.watch?.earned, watchOn, mutate, refresh])

  const react = async (kind: Reaction) => {
    if (!data?.member) return requireLogin()
    const key = -Date.now()
    setFloating((f) => [...f, { key, kind, left: 10 + Math.random() * 80 }].slice(-20))
    setTimeout(() => setFloating((f) => f.filter((x) => x.key !== key)), 2600)
    if (demo) return
    try {
      setError(null)
      await post({ action: 'react', kind })
    } catch (e) {
      setError((e as Error).message)
    }
  }

  if (!cfg) return null
  const w = data?.watch
  const progress = w && cfg.watch.minutes ? ((cfg.watch.minutes - (w.nextIn ?? cfg.watch.minutes)) / cfg.watch.minutes) * 100 : 0

  return (
    <div className="relative flex flex-col gap-3 rounded-xl border border-border bg-card p-3">
      {cfg.reactions && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-full h-40 overflow-hidden">
          {floating.map((f) => (
            <span
              key={f.key}
              style={{ left: `${f.left}%` }}
              className="tv-float absolute bottom-0 rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground shadow"
            >
              {REACTION_LABELS[f.kind]}
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        {cfg.presence && (
          <span className="flex items-center gap-1.5 font-medium text-foreground">
            <span className="size-2 rounded-full bg-live motion-safe:animate-pulse" aria-hidden="true" />
            <Eye className="size-4 text-muted-foreground" aria-hidden="true" />
            <span className="tabular-nums">{data.viewers.toLocaleString('tr-TR')}</span> kişi izliyor
          </span>
        )}
        {watchOn &&
          (data.member && w ? (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Coins className="size-4 text-primary" aria-hidden="true" />
              Bugün <strong className="tabular-nums text-foreground">{w.earned}</strong>
              {w.cap > 0 ? ` / ${w.cap}` : ''} coin
            </span>
          ) : (
            <button type="button" onClick={() => requireLogin()} className="text-xs font-semibold text-primary hover:underline">
              Giriş yap, izledikçe coin kazan
            </button>
          ))}
      </div>

      {watchOn && data.member && w && (
        <div className="flex flex-col gap-1">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)} aria-label="Sonraki ödül">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${w.nextIn === null ? 100 : progress}%` }} />
          </div>
          <p className="text-xs text-muted-foreground">
            {w.nextIn === null
              ? 'Bugünkü izleme ödülünü tamamladın.'
              : playing
                ? `Her ${cfg.watch.minutes} dakikada ${cfg.watch.coin} coin · sonraki ödüle ${w.nextIn} dk`
                : 'Ödül sayacı için bir yayın aç.'}
          </p>
        </div>
      )}

      {cfg.reactions && (
        <div className="flex gap-1.5 overflow-x-auto" role="group" aria-label="Canlı tepki gönder">
          {REACTIONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => react(r)}
              className="shrink-0 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-bold text-foreground transition-colors hover:border-primary hover:text-primary active:scale-95"
            >
              {REACTION_LABELS[r]}
            </button>
          ))}
        </div>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

// --- Per-match engagement (inside match details) ---------------------------

const normalize = (s: string) => s.toLocaleLowerCase('tr-TR').replace(/[^a-z0-9ğüşöçı]+/g, ' ').trim()

function matchOdds(data: TvEngage, match: Match) {
  const home = normalize(match.home.name).split(' ')[0]
  const away = normalize(match.away.name).split(' ')[0]
  if (!home || !away) return []
  return data.odds.filter((o) => {
    const m = normalize(o.match)
    return m.includes(home) && m.includes(away)
  })
}

export function MatchEngage({ match, football, demo }: { match: Match; football: boolean; demo?: TvEngage }) {
  const live = useTvEngage(20_000, !demo)
  const [demoState, setDemoState] = useState(demo)
  const data = demoState ?? live.data
  const mutate = live.mutate
  const { requireLogin } = usePoints()
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  if (!data) return null
  const cfg = data.config

  const run = async (key: string, body: Record<string, unknown>, ok: string) => {
    if (demoState) {
      setDemoState((d) => {
        if (!d) return d
        if (body.action === 'predict') {
          return { ...d, predictions: [{ id: Date.now(), gameId: match.id, home: match.home.name, away: match.away.name, pick: body.pick as PredictPick, status: 'open' as const, coin: 0, createdAt: new Date().toISOString() }, ...d.predictions] }
        }
        const teamId = body.teamId as number
        return { ...d, follows: d.follows.includes(teamId) ? d.follows.filter((t) => t !== teamId) : [...d.follows, teamId] }
      })
      setMessage({ ok: true, text: ok })
      return
    }
    if (!data.member) return requireLogin()
    setBusy(key)
    setMessage(null)
    try {
      await post(body)
      await mutate()
      setMessage({ ok: true, text: ok })
    } catch (e) {
      setMessage({ ok: false, text: (e as Error).message })
    } finally {
      setBusy(null)
    }
  }

  const odds = cfg.oddsBridge ? matchOdds(data, match) : []
  const prediction = data.predictions.find((p) => p.gameId === match.id && p.status === 'open')
  const lastSettled = data.predictions.find((p) => p.gameId === match.id && p.status !== 'open')
  const canPredict = football && cfg.predict.enabled && match.state === 'in'
  const canFollow = football && cfg.goalAlerts

  if (!odds.length && !canPredict && !canFollow) return null

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-3">
      {canPredict && (
        <div className="flex flex-col gap-2">
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <Target className="size-3.5 text-primary" aria-hidden="true" />
            Sıradaki golü kim atar? <span className="normal-case tracking-normal text-primary">+{cfg.predict.coin} coin</span>
          </p>
          {prediction ? (
            <p className="rounded-lg bg-primary/10 p-2.5 text-sm text-foreground">
              Tahminin: <strong>{prediction.pick === 'home' ? match.home.name : prediction.pick === 'away' ? match.away.name : PICK_LABELS.none}</strong>. Gol olunca sonuçlanır.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-1.5">
              {(['home', 'none', 'away'] as PredictPick[]).map((pick) => (
                <button
                  key={pick}
                  type="button"
                  disabled={busy !== null}
                  onClick={() => run(`p-${pick}`, { action: 'predict', gameId: match.id, pick }, 'Tahmin alındı, bol şans kanka!')}
                  className="flex min-h-10 items-center justify-center gap-1 truncate rounded-lg border border-border bg-background px-2 text-xs font-semibold text-foreground hover:border-primary disabled:opacity-60"
                >
                  {busy === `p-${pick}` && <Loader2 className="size-3 animate-spin" aria-hidden="true" />}
                  <span className="truncate">{pick === 'home' ? match.home.name : pick === 'away' ? match.away.name : PICK_LABELS.none}</span>
                </button>
              ))}
            </div>
          )}
          {lastSettled && !prediction && (
            <p className={cn('text-xs', lastSettled.status === 'won' ? 'text-primary' : 'text-muted-foreground')}>
              Son tahminin {lastSettled.status === 'won' ? `tuttu, +${lastSettled.coin} coin yattı.` : 'tutmadı.'}
            </p>
          )}
        </div>
      )}

      {canFollow && (
        <div className="grid grid-cols-2 gap-1.5">
          {[match.home, match.away].map((team) => {
            const following = data.follows.includes(team.id)
            return (
              <button
                key={team.id}
                type="button"
                aria-pressed={following}
                disabled={busy !== null}
                onClick={() =>
                  run(`f-${team.id}`, { action: 'follow', teamId: team.id, teamName: team.name }, following ? `${team.name} takipten çıktı.` : `${team.name} golünde bildirim gelecek.`)
                }
                className={cn(
                  'flex min-h-10 items-center justify-center gap-1.5 rounded-lg border px-2 text-xs font-semibold disabled:opacity-60',
                  following ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-foreground hover:border-primary',
                )}
              >
                {busy === `f-${team.id}` ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                ) : following ? (
                  <BellOff className="size-3.5" aria-hidden="true" />
                ) : (
                  <Bell className="size-3.5" aria-hidden="true" />
                )}
                <span className="truncate">{following ? 'Takipte' : 'Takip et'}: {team.name}</span>
              </button>
            )
          })}
        </div>
      )}

      {odds.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <Percent className="size-3.5 text-primary" aria-hidden="true" />
            Bu maça özel oran
          </p>
          {odds.slice(0, 3).map((o, i) => (
            <a
              key={`${o.siteName}-${i}`}
              href={o.link || '/ozel-oranlar'}
              target={o.link ? '_blank' : undefined}
              rel={o.link ? 'noopener noreferrer sponsored' : undefined}
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background p-2.5 text-sm hover:border-primary"
            >
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-semibold text-foreground">{o.siteName}</span>
                <span className="truncate text-xs text-muted-foreground">{o.market}</span>
              </span>
              <span className="flex shrink-0 items-baseline gap-1.5 tabular-nums">
                {o.oldOdd ? <s className="text-xs text-muted-foreground">{o.oldOdd.toFixed(2)}</s> : null}
                {o.newOdd ? <strong className="text-base text-primary">{o.newOdd.toFixed(2)}</strong> : null}
              </span>
            </a>
          ))}
        </div>
      )}

      {message && (
        <p role="status" className={cn('text-xs', message.ok ? 'text-primary' : 'text-destructive')}>
          {message.text}
        </p>
      )}
    </div>
  )
}
