'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { Play, RotateCcw, Shield, Timer, Trophy, Users, Volume2, VolumeX } from 'lucide-react'
import { TableBrand } from '@/components/alkanka/arena/table-brand'
import { type SVEvent, type SVPlayer } from './survival-canvas'
import { SurvivalArena } from './survival-arena'
import { kdSound } from '../karadelik/kd-sound'
import type { SVRule } from '@/lib/survival-sim'
import { cn } from '@/lib/utils'

const JAKO_PP = [
  '02-jako-goz-kirpan',
  '03-jako-coin-isiriyor',
  '04-jako-gunes-gozluklu',
  '05-flat-ikon-jako',
  '06-jako-tac-kral',
  '08-jako-neon',
  '09-jako-telefonda',
  '10-jako-coin-ustunde',
  '11-jako-cizgi-sticker',
  '12-jako-mafya-silueti',
  '14-jako-kulaklikli-dj',
  '15-jako-coin-yagmuru',
  '17-jako-selam-veren',
  '19-jako-oyun-kolu',
  '20-jako-minimal-cizgi',
  '21-jako-turk-bayrakli',
  '22-jako-pop-art',
].map((n) => `/images/cember-pp/${n}.webp`)

const NAMES = ['alexbey', 'bozkurt', 'pasa', 'reis', 'efe', 'aslan', 'sultan', 'tilki', 'kartal', 'ayaz', 'dolunay', 'yildiz', 'zeybek', 'kanka', 'jakofan', 'serdar']
const PLAYER_OPTIONS = [10, 20, 40, 80]
const WINNER_OPTIONS = [1, 2, 3]
const DURATION_OPTIONS = [30, 60, 90]
const PRIZE_POOL = 1000
const RULE_LABEL: Record<SVRule, string> = { last: 'Son Kalan', most: 'Çoğunluk' }
const RULE_HINT: Record<SVRule, string> = {
  last: 'Rakip takımı tamamen kaleye gönderen kazanır. Süre biterse Final Savaşı tek takım kalana kadar sürer.',
  most: 'Süre bitince daha çok kişisi kalan takım kazanır. Eşitlikte ilk oyuncusunu kaybeden takım kaybeder.',
}

type Mode = 'solo' | 'team'
type Run = { key: number; players: SVPlayer[]; duration: number; winners: number; teams: 0 | 2; rule: SVRule; shield: boolean }
type Feed = { id: number; text: string; me: boolean }

function makePlayers(count: number): SVPlayer[] {
  const deck = JAKO_PP.slice().sort(() => Math.random() - 0.5)
  return Array.from({ length: count }, (_, i) => ({
    id: `p-${i}`,
    name: i === 0 ? 'krsone2' : `${NAMES[i % NAMES.length]}${i >= NAMES.length ? Math.floor(i / NAMES.length) + 1 : ''}`,
    image: deck[i % deck.length],
    me: i === 0,
  }))
}

function mmss(s: number) {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

function Segmented<T extends string | number>({
  label,
  options,
  value,
  onChange,
  format = (o) => String(o),
}: {
  label: string
  options: T[]
  value: T
  onChange: (v: T) => void
  format?: (o: T) => string
}) {
  return (
    <fieldset className="flex flex-col">
      <legend className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</legend>
      <div className="flex gap-1 rounded-lg border border-border bg-background p-1">
        {options.map((o) => (
          <button
            key={String(o)}
            type="button"
            onClick={() => onChange(o)}
            aria-pressed={value === o}
            className={cn(
              'flex-1 whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm font-semibold tabular-nums transition-colors',
              value === o ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {format(o)}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

export function SurvivalPreview() {
  const [mode, setMode] = useState<Mode>('solo')
  const [rule, setRule] = useState<SVRule>('last')
  const [shield, setShield] = useState(false)
  const [playerCount, setPlayerCount] = useState(10)
  const [winnerCount, setWinnerCount] = useState(3)
  const [duration, setDuration] = useState(60)
  const [muted, setMuted] = useState(false)
  const [run, setRun] = useState<Run | null>(null)
  const [left, setLeft] = useState(0)
  const [waiting, setWaiting] = useState(0)
  const [alive, setAlive] = useState(0)
  const [teamAlive, setTeamAlive] = useState<number[]>([0, 0])
  const [outRank, setOutRank] = useState<Record<number, number>>({})
  const [feed, setFeed] = useState<Feed[]>([])
  const [final, setFinal] = useState(false)
  const [banner, setBanner] = useState<string | null>(null)
  const [result, setResult] = useState<{ winners: number[]; winningTeam: number; seconds: number } | null>(null)

  useEffect(() => {
    kdSound.setMuted(muted)
  }, [muted])

  useEffect(() => {
    if (!banner) return
    const t = setTimeout(() => setBanner(null), 2600)
    return () => clearTimeout(t)
  }, [banner])

  const start = () => {
    kdSound.unlock()
    const teams = mode === 'team' ? 2 : 0
    const winners = Math.min(winnerCount, playerCount - 1)
    const players = makePlayers(playerCount)
    setRun({ key: Date.now(), players, duration, winners, teams, rule, shield: teams ? shield : false })
    setLeft(duration)
    setWaiting(0)
    setAlive(playerCount)
    setTeamAlive([Math.ceil(playerCount / 2), Math.floor(playerCount / 2)])
    setOutRank({})
    setFeed([])
    setFinal(false)
    setResult(null)
    setBanner(teams ? `Bu tur: ${RULE_LABEL[rule]}` : null)
  }

  const players = run?.players
  const onEvent = useCallback(
    (e: SVEvent) => {
      if (!players || !run) return
      if (e.type === 'tick') {
        setLeft(e.left)
        setWaiting(e.waiting)
      } else if (e.type === 'out') {
        setAlive(e.alive)
        setTeamAlive(e.teamAlive)
        setOutRank((m) => ({ ...m, [e.index]: e.alive + 1 }))
        const p = players[e.index]
        const tail = run.teams ? `Altın ${e.teamAlive[0]} – Mavi ${e.teamAlive[1]}` : `${e.alive} kaldı`
        setFeed((f) => [{ id: Date.now() + e.index, text: `${p.me ? 'Sen' : p.name} kaleye gitti · ${tail}`, me: p.me }, ...f].slice(0, 3))
      } else if (e.type === 'enter') {
        const p = players[e.index]
        setFeed((f) => [{ id: Date.now() + e.index + 0.5, text: `${p.me ? 'Sen' : p.name} sahaya girdi`, me: p.me }, ...f].slice(0, 3))
      } else if (e.type === 'final') {
        setFinal(true)
        setBanner(e.suddenDeath ? 'Eşitlik! İlk düşen kaybeder' : 'Final Savaşı')
      } else if (e.type === 'done') setResult({ winners: e.winners, winningTeam: e.winningTeam, seconds: e.seconds })
    },
    [players, run],
  )

  const eliminated = Object.keys(outRank).length
  const teamMode = run ? run.teams === 2 : mode === 'team'
  const meWon = useMemo(() => !!result && !!players && result.winners.some((i) => players[i].me), [result, players])
  const share = result ? Math.floor(PRIZE_POOL / Math.max(1, result.winners.length)) : 0

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <span className="w-fit rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-primary">
          Tasarım ön izlemesi
        </span>
        <h1 className="font-display text-3xl font-bold uppercase tracking-tight text-foreground text-balance sm:text-4xl">Survival Arena</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground text-pretty">
          Dikey bir futbol sahası, iki yanda kenar boyunca kayan kaleler. Kaleye giren elenir, sıradaki sahaya girer. Sıra bitince süre başlar; süre
          dolunca Final Savaşı&apos;nda kaleler büyür ve hızlanır. Bu sayfa sadece senin ekranında oynar, kimseye ödül verilmez.
        </p>
      </header>

      <section aria-label="Ön izleme ayarları" className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
          <Segmented<Mode> label="Mod" options={['solo', 'team']} value={mode} onChange={setMode} format={(o) => (o === 'solo' ? 'Tekli' : 'Takımlı')} />
          <Segmented label="Katılımcı" options={PLAYER_OPTIONS} value={playerCount} onChange={setPlayerCount} />
          {mode === 'solo' && <Segmented label="Ödül alan" options={WINNER_OPTIONS} value={winnerCount} onChange={setWinnerCount} />}
          <Segmented label="Süre (sn)" options={DURATION_OPTIONS} value={duration} onChange={setDuration} />
          <div className="flex gap-2 sm:ml-auto">
            <button
              type="button"
              onClick={() => setMuted((m) => !m)}
              aria-label={muted ? 'Sesi aç' : 'Sesi kapat'}
              className="flex size-10 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground"
            >
              {muted ? <VolumeX className="size-5" aria-hidden /> : <Volume2 className="size-5" aria-hidden />}
            </button>
            <button
              type="button"
              onClick={start}
              className="flex h-10 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-bold uppercase tracking-wide text-primary-foreground"
            >
              {run ? <RotateCcw className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
              {run ? 'Yeniden başlat' : 'Başlat'}
            </button>
          </div>
        </div>
        {mode === 'team' && (
          <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-end">
            <Segmented<SVRule> label="Kazanma kuralı" options={['last', 'most']} value={rule} onChange={setRule} format={(o) => RULE_LABEL[o]} />
            <button
              type="button"
              onClick={() => setShield((s) => !s)}
              aria-pressed={shield}
              className={cn(
                'flex h-10 items-center gap-2 rounded-lg border px-3 text-sm font-semibold transition-colors',
                shield ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:text-foreground',
              )}
            >
              <Shield className="size-4" aria-hidden />
              Takım kalkanı {shield ? 'açık' : 'kapalı'}
            </button>
            <p className="text-xs leading-relaxed text-muted-foreground text-pretty sm:flex-1">{RULE_HINT[rule]}</p>
          </div>
        )}
      </section>

      <section aria-label="Saha" className="mx-auto flex w-full max-w-xl flex-col gap-3">
        <div className="grid grid-cols-3 items-center gap-2 rounded-xl border border-border bg-card px-4 py-3">
          <div className="flex items-center gap-2">
            <Timer className={cn('size-5', final ? 'text-ruby' : 'text-primary')} aria-hidden />
            <span className={cn('font-display text-2xl font-bold tabular-nums', final || (left <= 10 && run && !waiting) ? 'text-ruby' : 'text-foreground')}>
              {final ? 'FİNAL' : mmss(run ? left : duration)}
            </span>
          </div>
          {teamMode ? (
            <div className="flex items-center justify-center gap-2 font-display text-lg font-bold tabular-nums" aria-live="polite">
              <span className="rounded-md bg-primary px-2 text-primary-foreground">Altın {run ? teamAlive[0] : Math.ceil(playerCount / 2)}</span>
              <span className="text-muted-foreground">–</span>
              <span className="rounded-md bg-team-blue px-2 text-team-blue-foreground">Mavi {run ? teamAlive[1] : Math.floor(playerCount / 2)}</span>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 text-sm">
              <Users className="size-4 text-muted-foreground" aria-hidden />
              <span className="font-semibold tabular-nums text-foreground">{run ? alive : playerCount}</span>
              <span className="text-muted-foreground">kaldı</span>
            </div>
          )}
          <div className="flex items-center justify-end gap-2 text-sm">
            <Trophy className="size-4 text-primary" aria-hidden />
            <span className="text-right text-muted-foreground">
              {teamMode ? (
                <span className="font-semibold text-foreground">{RULE_LABEL[run?.rule ?? rule]}</span>
              ) : (
                <>
                  Son <span className="font-semibold text-foreground">{run?.winners ?? winnerCount}</span> kazanır
                </>
              )}
            </span>
          </div>
        </div>

        <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl border border-primary/25 bg-background">
          <TableBrand className="z-10" center={false} plaque="top" corners jako />
          {run ? (
            <SurvivalArena
              key={run.key}
              players={run.players}
              duration={run.duration}
              winners={run.winners}
              teams={run.teams}
              rule={run.rule}
              shield={run.shield}
              prizePool={PRIZE_POOL}
              seed={run.key % 2147483647}
              onEvent={onEvent}
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
              <div className="flex size-28 items-center justify-center rounded-full border-4 border-primary/60 bg-card shadow-[0_0_60px_-10px] shadow-primary/50">
                <span className="font-display text-4xl font-bold text-primary">A</span>
              </div>
              <p className="max-w-xs text-sm leading-relaxed text-muted-foreground text-pretty">
                Ayarları seç ve <span className="font-semibold text-foreground">Başlat</span>&apos;a bas. &quot;SEN&quot; etiketli oyuncu sensin.
              </p>
            </div>
          )}

          {run && run.teams === 2 && !result && (
            <span className="pointer-events-none absolute right-3 top-12 z-20 rounded-full bg-background/80 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-foreground backdrop-blur">
              Kural: {RULE_LABEL[run.rule]}
              {run.shield ? ' · Kalkan' : ''}
            </span>
          )}

          {run && waiting > 0 && !result && (
            <span className="pointer-events-none absolute left-3 top-12 z-20 rounded-full bg-background/80 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-foreground backdrop-blur">
              Sırada {waiting} kişi · süre bekliyor
            </span>
          )}

          {banner && (
            <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center gap-1 bg-background/45 px-4 text-center backdrop-blur-[2px]">
              <span className={cn('font-display text-4xl font-bold uppercase tracking-widest text-balance sm:text-5xl', final ? 'text-ruby' : 'text-primary')}>
                {banner}
              </span>
              {final && <span className="text-sm font-semibold text-foreground">Kaleler büyüyor ve hızlanıyor</span>}
            </div>
          )}

          {feed.length > 0 && !result && (
            <ol className="pointer-events-none absolute bottom-3 left-3 right-3 z-20 flex flex-col items-start gap-1" aria-live="polite">
              {feed.map((f, k) => (
                <li
                  key={f.id}
                  className={cn(
                    'rounded-full px-3 py-1 text-xs font-semibold backdrop-blur',
                    f.me ? 'bg-ruby text-foreground' : 'bg-background/75 text-foreground',
                    k > 0 && 'opacity-60',
                  )}
                >
                  {f.text}
                </li>
              ))}
            </ol>
          )}

          {result && players && (
            <div
              className="absolute inset-x-0 bottom-0 z-30 flex flex-col items-center gap-3 bg-linear-to-t from-background via-background/90 to-transparent px-4 pb-5 pt-20 text-center animate-in fade-in slide-in-from-bottom-6 duration-700"
              aria-live="polite"
            >
              <span className="text-[11px] font-semibold uppercase tracking-[0.35em] text-primary">Maç bitti · {mmss(result.seconds)}</span>
              <h2 className="font-display text-3xl font-bold uppercase leading-none tracking-tight text-foreground text-balance sm:text-5xl">
                {meWon ? 'Kazandın!' : run?.teams ? `${result.winningTeam === 1 ? 'Mavi' : 'Altın'} takım kazandı` : `${result.winners.length} kişi ayakta`}
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                <span className="font-semibold tabular-nums text-foreground">{players.length}</span> kişi girdi ·{' '}
                <span className="font-semibold tabular-nums text-foreground">{eliminated}</span> kişi kaleye gitti · kişi başı{' '}
                <span className="font-display font-bold tabular-nums text-primary">{share.toLocaleString('tr-TR')} KC</span>
              </p>
              <button
                type="button"
                onClick={start}
                className="mt-1 flex h-11 w-full max-w-xs items-center justify-center gap-2 rounded-lg bg-primary text-sm font-bold uppercase tracking-wide text-primary-foreground transition-transform hover:scale-[1.02]"
              >
                <RotateCcw className="size-4" aria-hidden />
                Yeni tur
              </button>
            </div>
          )}
        </div>

        {run && (
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider">
              <span className="text-muted-foreground">Elenenler</span>
              <span className="tabular-nums text-foreground">
                {eliminated} / {run.players.length}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-background">
              <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${(eliminated / run.players.length) * 100}%` }} />
            </div>
            <ul className="grid grid-cols-8 gap-1.5 sm:grid-cols-10">
              {run.players.map((p, i) => {
                const rank = outRank[i]
                const won = result?.winners.includes(i)
                const team = run.teams ? i % 2 : -1
                return (
                  <li key={p.id} className="relative" title={rank ? `${p.name} · ${rank}. sırada elendi` : p.name}>
                    <Image
                      src={p.image}
                      alt={p.me ? 'Sen' : p.name}
                      width={40}
                      height={40}
                      className={cn(
                        'aspect-square w-full rounded-full border-2 object-cover transition-all',
                        team === 0 ? 'border-primary' : team === 1 ? 'border-team-blue' : 'border-foreground/30',
                        rank && 'opacity-25 grayscale',
                        won && 'ring-2 ring-primary ring-offset-1 ring-offset-card',
                      )}
                    />
                    {rank && <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold tabular-nums text-foreground">{rank}</span>}
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </section>
    </div>
  )
}
