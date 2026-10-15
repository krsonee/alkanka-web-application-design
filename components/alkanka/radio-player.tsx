'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import useSWR from 'swr'
import { Loader2, Pause, Play, Radio, RadioReceiver, Search, Volume2, VolumeX, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { RadioStation } from '@/app/api/radyo/route'

const fetcher = (url: string) => fetch(url).then((r) => r.json() as Promise<{ stations: RadioStation[] }>)

type Status = 'idle' | 'loading' | 'playing' | 'error'

function Equalizer({ active }: { active: boolean }) {
  return (
    <span aria-hidden="true" className="flex h-3.5 items-end gap-0.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={cn('w-0.5 rounded-full bg-primary', active ? 'animate-eq' : 'h-1')}
          style={active ? { animationDelay: `${i * 0.18}s` } : undefined}
        />
      ))}
    </span>
  )
}

function StationLogo({ station }: { station: RadioStation }) {
  const [broken, setBroken] = useState(false)
  if (!station.favicon || broken) {
    return (
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary font-display text-xs font-bold text-primary">
        {station.name.slice(0, 2).toUpperCase()}
      </span>
    )
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={station.favicon}
      alt=""
      loading="lazy"
      onError={() => setBroken(true)}
      className="size-9 shrink-0 rounded-lg bg-secondary object-contain p-1"
    />
  )
}

export function RadioPlayer() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [current, setCurrent] = useState<RadioStation | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [muted, setMuted] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  const { data, isLoading } = useSWR(open || current ? '/api/radyo' : null, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 3_600_000,
  })

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => !wrapRef.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const stations = useMemo(() => {
    const list = data?.stations ?? []
    const q = query.trim().toLocaleLowerCase('tr-TR')
    if (!q) return list
    return list.filter(
      (s) => s.name.toLocaleLowerCase('tr-TR').includes(q) || s.tags.some((t) => t.toLocaleLowerCase('tr-TR').includes(q)),
    )
  }, [data, query])

  const play = async (station: RadioStation) => {
    const audio = audioRef.current
    if (!audio) return
    if (current?.id === station.id && status === 'playing') {
      audio.pause()
      setStatus('idle')
      return
    }
    setCurrent(station)
    setStatus('loading')
    audio.src = station.url
    try {
      await audio.play()
    } catch {
      setStatus('error')
    }
  }

  const stop = () => {
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
    }
    setCurrent(null)
    setStatus('idle')
  }

  const playing = status === 'playing'

  return (
    <div ref={wrapRef} className="relative">
      <audio
        ref={audioRef}
        muted={muted}
        preload="none"
        onPlaying={() => setStatus('playing')}
        onWaiting={() => setStatus('loading')}
        onError={() => current && setStatus('error')}
      />
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={playing && current ? `Radyo: ${current.name} çalıyor` : 'Radyo'}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'relative flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-2 text-foreground transition-colors sm:px-2.5',
          open || playing ? 'border-primary/60 bg-primary/10' : 'border-border hover:border-primary/50',
        )}
      >
        <RadioReceiver className={cn('size-[18px] text-primary', playing ? 'animate-radio-wave' : 'animate-radio-idle')} aria-hidden="true" />
        {playing ? <Equalizer active /> : <span className="hidden text-xs font-semibold md:inline">Radyo</span>}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Canlı radyolar"
          className="fixed inset-x-3 top-16 z-50 flex max-h-[min(70vh,560px)] flex-col sm:absolute sm:inset-x-auto sm:right-0 sm:top-11 sm:w-[22rem] overflow-hidden rounded-xl border border-border bg-popover shadow-2xl shadow-background/60"
        >
          <div className="flex items-center justify-between gap-2 border-b border-border bg-primary/[0.06] px-4 py-3">
            <span className="flex items-center gap-2">
              <Radio className="size-4 text-primary" aria-hidden="true" />
              <span className="font-display text-sm font-bold text-foreground">Kanka Radyo</span>
              <span className="rounded bg-live/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-live">Canlı</span>
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Kapat"
              className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>

          {current && (
            <div className="flex items-center gap-3 border-b border-border px-4 py-3">
              <StationLogo station={current} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-bold text-foreground">{current.name}</span>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  {status === 'loading' && 'Bağlanıyor...'}
                  {status === 'playing' && (
                    <>
                      <Equalizer active /> Çalıyor
                    </>
                  )}
                  {status === 'error' && <span className="text-destructive">Yayın açılamadı, başka kanal dene</span>}
                  {status === 'idle' && 'Durduruldu'}
                </span>
              </span>
              <button
                type="button"
                onClick={() => setMuted((m) => !m)}
                aria-label={muted ? 'Sesi aç' : 'Sesi kapat'}
                className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                {muted ? <VolumeX className="size-4" aria-hidden="true" /> : <Volume2 className="size-4" aria-hidden="true" />}
              </button>
              <button
                type="button"
                onClick={stop}
                className="rounded-md border border-border px-2 py-1 text-xs font-semibold text-muted-foreground hover:border-destructive/50 hover:text-destructive"
              >
                Kapat
              </button>
            </div>
          )}

          <div className="border-b border-border p-3">
            <label className="flex items-center gap-2 rounded-lg border border-border bg-background px-3">
              <Search className="size-4 text-muted-foreground" aria-hidden="true" />
              <span className="sr-only">Radyo ara</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Radyo veya tür ara (pop, arabesk...)"
                className="h-9 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
            </label>
          </div>

          <ul className="flex-1 overflow-y-auto p-1.5">
            {isLoading && (
              <li className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Radyolar yükleniyor...
              </li>
            )}
            {!isLoading && stations.length === 0 && (
              <li className="py-8 text-center text-sm text-muted-foreground">Radyo bulunamadı kanka.</li>
            )}
            {stations.map((s) => {
              const isCurrent = current?.id === s.id
              const isPlaying = isCurrent && playing
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => play(s)}
                    aria-pressed={isPlaying}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors',
                      isCurrent ? 'bg-primary/10' : 'hover:bg-secondary',
                    )}
                  >
                    <StationLogo station={s} />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-semibold text-foreground">{s.name}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {s.tags.length ? s.tags.join(' · ') : 'Genel'}
                        {s.bitrate ? ` · ${s.bitrate} kbps` : ''}
                      </span>
                    </span>
                    <span
                      className={cn(
                        'flex size-8 shrink-0 items-center justify-center rounded-full',
                        isCurrent ? 'bg-primary text-primary-foreground' : 'bg-secondary text-primary',
                      )}
                    >
                      {isCurrent && status === 'loading' ? (
                        <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                      ) : isPlaying ? (
                        <Pause className="size-3.5" aria-hidden="true" />
                      ) : (
                        <Play className="size-3.5" aria-hidden="true" />
                      )}
                      <span className="sr-only">{isPlaying ? 'Durdur' : 'Çal'}</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
          <p className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
            {data?.stations.length ? `${data.stations.length} canlı Türk radyosu` : 'Canlı Türk radyoları'} · Sayfa değiştirsen de çalmaya devam eder
          </p>
        </div>
      )}
    </div>
  )
}
