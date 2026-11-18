'use client'

import { useCallback, useEffect, useRef } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { Swords } from 'lucide-react'
import type { Tournament } from '@/lib/tournaments-shared'
import { TournamentCard } from './tournament-card'

const LIVE_URL = '/api/tournaments/live'
const POLL_MS = 15_000
const STARTS_SOON_MS = 2 * 60_000
const START_GRACE_MS = 10 * 60_000

const read = async (url: string) => {
  const r = await fetch(url, { cache: 'no-store' })
  if (!r.ok) throw new Error(`turnuvalar ${r.status}`)
  return ((await r.json()) as { tournaments: Tournament[] }).tournaments
}

/** Something can change without this visitor doing anything: a tournament is being played, or one is about to start. */
function changing(list: Tournament[], now: number) {
  return list.some((t) => {
    if (t.status === 'basladi') return true
    const untilStart = Date.parse(t.startsAt) - now
    return t.status === 'kayit' && untilStart < STARTS_SOON_MS && untilStart > -START_GRACE_MS
  })
}

/**
 * The page itself is static HTML and can be minutes old. This list starts from that copy and, only
 * while a tournament is running or about to start and the tab is in view, asks for the current one.
 */
export function TournamentLive({ initial }: { initial: Tournament[] }) {
  const { data, mutate } = useSWR<Tournament[]>(LIVE_URL, read, {
    fallbackData: initial,
    revalidateOnMount: false,
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  })
  const list = data ?? initial
  const latest = useRef(list)
  const pageCopy = useRef(initial)
  useEffect(() => {
    latest.current = list
  }, [list])

  useEffect(() => {
    const check = (remembered = false) => {
      if (document.visibilityState !== 'visible') return
      if (remembered || changing(latest.current, Date.now())) void mutate()
    }
    // A list kept from an earlier visit to this page can be older than the page itself, so it is read again once.
    check(latest.current !== pageCopy.current)
    const tick = () => check()
    const id = window.setInterval(tick, POLL_MS)
    document.addEventListener('visibilitychange', tick)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [mutate])

  // After the member's own join or leave the shared answer may still be a few seconds old, so this read skips the caches.
  const reload = useCallback(() => {
    void mutate(read(`${LIVE_URL}?fresh=${Date.now()}`), { revalidate: false })
  }, [mutate])

  const live = list.filter((t) => t.status !== 'bitti')
  const done = list.filter((t) => t.status === 'bitti')

  return (
    <>
      {live.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-border bg-card p-10 text-center">
          <Swords className="size-9 text-primary" aria-hidden="true" />
          <h2 className="font-display text-2xl font-bold uppercase text-foreground">Yeni turnuva yakında</h2>
          <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
            Şu an kayıtları açık bir turnuva yok. Duyurular Telegram kanalımızda. O zamana kadar masalarda ısınabilirsin.
          </p>
          <Link href="/oyunlar" className="mt-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold uppercase tracking-wide text-primary-foreground">
            Masa oyunlarına git
          </Link>
        </div>
      ) : (
        <section aria-label="Aktif turnuvalar" className="flex flex-col gap-6">
          {live.map((t) => (
            <TournamentCard key={t.id} t={t} onChanged={reload} />
          ))}
        </section>
      )}

      {done.length > 0 && (
        <section aria-labelledby="gecmis" className="flex flex-col gap-4">
          <h2 id="gecmis" className="font-display text-2xl font-bold uppercase text-foreground">
            Geçmiş turnuvalar
          </h2>
          <div className="flex flex-col gap-6">
            {done.map((t) => (
              <TournamentCard key={t.id} t={t} />
            ))}
          </div>
        </section>
      )}
    </>
  )
}
