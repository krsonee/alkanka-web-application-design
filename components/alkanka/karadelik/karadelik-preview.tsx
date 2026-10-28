'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { Play, RotateCcw, Timer, Trophy, Users, Volume2, VolumeX } from 'lucide-react'
import { TableBrand } from '@/components/alkanka/arena/table-brand'
import { KaraDelikCanvas, type KDEvent, type KDPlayer } from './karadelik-canvas'
import { kdSound } from './kd-sound'
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

const PLAYER_OPTIONS = [10, 20, 40, 64]
const WINNER_OPTIONS = [1, 3, 5, 10]
const DURATION_OPTIONS = [30, 60, 90]
const PRIZE_POOL = 1000

type Run = { key: number; players: KDPlayer[]; duration: number; winners: number }
type Feed = { id: number; text: string; me: boolean }

function makePlayers(count: number): KDPlayer[] {
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

function Segmented({ label, options, value, onChange, suffix }: { label: string; options: number[]; value: number; onChange: (v: number) => void; suffix: string }) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</legend>
      <div className="flex gap-1 rounded-lg border border-border bg-background p-1">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => onChange(o)}
            aria-pressed={value === o}
            className={cn(
              'flex-1 rounded-md px-2.5 py-1.5 text-sm font-semibold tabular-nums transition-colors',
              value === o ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {o}
            <span className="sr-only"> {suffix}</span>
          </button>
        ))}
      </div>
    </fieldset>
  )
}

export function KaraDelikPreview() {
  const [playerCount, setPlayerCount] = useState(40)
  const [winnerCount, setWinnerCount] = useState(5)
  const [duration, setDuration] = useState(60)
  const [muted, setMuted] = useState(false)
  const [run, setRun] = useState<Run | null>(null)
  const [left, setLeft] = useState(0)
  const [alive, setAlive] = useState(0)
  const [outRank, setOutRank] = useState<Record<number, number>>({})
  const [feed, setFeed] = useState<Feed[]>([])
  const [final, setFinal] = useState(false)
  const [finalFlash, setFinalFlash] = useState(false)
  const [result, setResult] = useState<{ winners: number[]; seconds: number } | null>(null)

  useEffect(() => {
    kdSound.setMuted(muted)
  }, [muted])

  useEffect(() => {
    if (!finalFlash) return
    const t = setTimeout(() => setFinalFlash(false), 2600)
    return () => clearTimeout(t)
  }, [finalFlash])

  const start = () => {
    kdSound.unlock()
    const winners = Math.min(winnerCount, playerCount - 1)
    const players = makePlayers(playerCount)
    setRun({ key: Date.now(), players, duration, winners })
    setLeft(duration)
    setAlive(playerCount)
    setOutRank({})
    setFeed([])
    setFinal(false)
    setFinalFlash(false)
    setResult(null)
  }

  const players = run?.players
  const onEvent = useCallback(
    (e: KDEvent) => {
      if (!players) return
      if (e.type === 'tick') setLeft(e.left)
      else if (e.type === 'out') {
        setAlive(e.alive)
        setOutRank((m) => ({ ...m, [e.index]: e.alive + 1 }))
        const p = players[e.index]
        setFeed((f) => [{ id: Date.now() + e.index, text: `${p.me ? 'Sen' : p.name} kara deliğe düştü · ${e.alive} kaldı`, me: p.me }, ...f].slice(0, 3))
      } else if (e.type === 'final') {
        setFinal(true)
        setFinalFlash(true)
      } else if (e.type === 'done') setResult({ winners: e.winners, seconds: e.seconds })
    },
    [players],
  )

  const eliminated = Object.keys(outRank).length
  const share = result ? Math.floor(PRIZE_POOL / Math.max(1, result.winners.length)) : 0
  const meWon = useMemo(() => !!result && !!players && result.winners.some((i) => players[i].me), [result, players])

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <span className="w-fit rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-primary">
          Tasarım ön izlemesi
        </span>
        <h1 className="font-display text-3xl font-bold uppercase tracking-tight text-foreground text-balance sm:text-4xl">Kara Delik Arenası</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground text-pretty">
          Altın kollar dönüyor, ortadaki kapak uyarıyla açılıyor ve yakındakileri içine çekiyor. Süre bitince Final Savaşı başlar: delik artık kapanmaz ve büyür,
          ödül sayısı kadar kişi kalana kadar devam eder. Bu sayfa sadece senin ekranında oynar, kimseye ödül verilmez.
        </p>
      </header>

      <section aria-label="Ön izleme ayarları" className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 sm:flex-row sm:flex-wrap sm:items-end">
        <Segmented label="Katılımcı" options={PLAYER_OPTIONS} value={playerCount} onChange={setPlayerCount} suffix="kişi" />
        <Segmented label="Ödül alan" options={WINNER_OPTIONS} value={winnerCount} onChange={setWinnerCount} suffix="kişi" />
        <Segmented label="Süre (sn)" options={DURATION_OPTIONS} value={duration} onChange={setDuration} suffix="saniye" />
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
      </section>

      <section aria-label="Arena" className="mx-auto flex w-full max-w-2xl flex-col gap-3">
        <div className="grid grid-cols-3 items-center gap-2 rounded-xl border border-border bg-card px-4 py-3">
          <div className="flex items-center gap-2">
            <Timer className={cn('size-5', final ? 'text-ruby' : 'text-primary')} aria-hidden />
            <span className={cn('font-display text-2xl font-bold tabular-nums', final ? 'text-ruby' : left <= 10 && run ? 'text-ruby' : 'text-foreground')}>
              {final ? 'FİNAL' : mmss(run ? left : duration)}
            </span>
          </div>
          <div className="flex items-center justify-center gap-2 text-sm">
            <Users className="size-4 text-muted-foreground" aria-hidden />
            <span className="font-semibold tabular-nums text-foreground">{run ? alive : playerCount}</span>
            <span className="text-muted-foreground">kaldı</span>
          </div>
          <div className="flex items-center justify-end gap-2 text-sm">
            <Trophy className="size-4 text-primary" aria-hidden />
            <span className="text-muted-foreground">
              İlk <span className="font-semibold text-foreground">{run?.winners ?? winnerCount}</span> kazanır
            </span>
          </div>
        </div>

        <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-primary/25 bg-background">
          <TableBrand className="z-10" center={false} plaque="top" corners jako />
          {run ? (
            <KaraDelikCanvas key={run.key} players={run.players} duration={run.duration} winners={run.winners} prizePool={PRIZE_POOL} onEvent={onEvent} />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
              <div className="flex size-28 items-center justify-center rounded-full border-4 border-primary/60 bg-card shadow-[0_0_60px_-10px] shadow-primary/50">
                <span className="font-display text-4xl font-bold text-primary">A</span>
              </div>
              <p className="max-w-xs text-sm leading-relaxed text-muted-foreground text-pretty">
                Ayarları seç ve <span className="font-semibold text-foreground">Başlat</span>&apos;a bas. Sarı halkalı top sensin.
              </p>
            </div>
          )}

          {finalFlash && (
            <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center gap-1 bg-background/50 backdrop-blur-[2px]">
              <span className="font-display text-4xl font-bold uppercase tracking-widest text-ruby sm:text-6xl">Final Savaşı</span>
              <span className="text-sm font-semibold text-foreground">Delik artık kapanmıyor · son {run?.winners} kişi kalana kadar</span>
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
              <span className="text-[11px] font-semibold uppercase tracking-[0.35em] text-primary">
                Kara delikten sağ çıkanlar · {mmss(result.seconds)}
              </span>
              <h2 className="font-display text-3xl font-bold uppercase leading-none tracking-tight text-foreground text-balance sm:text-5xl">
                {meWon ? 'Sağ çıktın!' : result.winners.length === 1 ? 'Tek kurtulan' : `${result.winners.length} kişi kurtuldu`}
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                <span className="font-semibold tabular-nums text-foreground">{players.length}</span> kişi girdi ·{' '}
                <span className="font-semibold tabular-nums text-foreground">{eliminated}</span> kişi yutuldu · kişi başı{' '}
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
                return (
                  <li key={p.id} className="relative" title={rank ? `${p.name} · ${rank}. sırada elendi` : p.name}>
                    <Image
                      src={p.image}
                      alt={p.me ? 'Sen' : p.name}
                      width={40}
                      height={40}
                      className={cn(
                        'aspect-square w-full rounded-full border object-cover transition-all',
                        rank ? 'border-transparent opacity-25 grayscale' : 'border-foreground/30',
                        p.me && !rank && 'border-2 border-primary',
                        won && 'border-2 border-primary',
                      )}
                    />
                    {rank && (
                      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold tabular-nums text-foreground">{rank}</span>
                    )}
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
