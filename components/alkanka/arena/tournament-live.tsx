'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { Swords } from 'lucide-react'
import { cn } from '@/lib/utils'
import { listPulse, type Tournament } from '@/lib/tournaments-shared'
import { usePoints } from '../points-context'
import { TournamentCard } from './tournament-card'

const LIVE_URL = '/api/tournaments/live'
const POLL_MS = 15_000
/** A league between two rounds, or a points league, is asked about this often instead. */
const SLOW_POLL_MS = 2 * 60_000
const STARTS_SOON_MS = 2 * 60_000
/** Finished tournaments listed before the rest is folded away. */
const PAST_SHOWN = 5

const read = async (url: string) => {
  const r = await fetch(url, { cache: 'no-store' })
  if (!r.ok) throw new Error(`turnuvalar ${r.status}`)
  return ((await r.json()) as { tournaments: Tournament[] }).tournaments
}

type Filter = 'all' | 'running' | 'open' | 'past' | 'mine'

const closedAt = (t: Tournament) => Date.parse(t.finishedAt ?? t.endsAt ?? t.startsAt)

function Group({ id, title, count, children }: { id: string; title: string; count: number; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h2 id={id} className="flex items-baseline gap-2 font-display text-lg font-bold uppercase text-foreground">
        {title}
        <span className="text-sm font-semibold text-muted-foreground">{count}</span>
      </h2>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  )
}

/**
 * The page itself is static HTML and can be minutes old. This list starts from that copy and, only
 * while a tournament is running or about to start and the tab is in view, asks for the current one:
 * every few seconds while a match is on, every couple of minutes for a league that is only waiting.
 */
export function TournamentLive({ initial }: { initial: Tournament[] }) {
  const { data, mutate } = useSWR<Tournament[]>(LIVE_URL, read, {
    fallbackData: initial,
    revalidateOnMount: false,
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  })
  const { member } = usePoints()
  const [filter, setFilter] = useState<Filter>('all')
  const [allPast, setAllPast] = useState(false)
  const list = data ?? initial
  const latest = useRef(list)
  const pageCopy = useRef(initial)
  const lastRead = useRef(0)
  useEffect(() => {
    latest.current = list
  }, [list])

  useEffect(() => {
    const check = (remembered = false) => {
      if (document.visibilityState !== 'visible') return
      const now = Date.now()
      const pulse = listPulse(latest.current, now, STARTS_SOON_MS)
      if (!remembered && pulse !== 'fast' && !(pulse === 'slow' && now - lastRead.current >= SLOW_POLL_MS)) return
      lastRead.current = now
      void mutate()
    }
    // A list kept from an earlier visit to this page can be older than the page itself, so it is read again once.
    lastRead.current = Date.now()
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

  const running = list.filter((t) => t.status === 'basladi')
  const open = list.filter((t) => t.status === 'kayit').sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
  const past = list.filter((t) => t.status === 'bitti').sort((a, b) => closedAt(b) - closedAt(a))
  const myId = member?.id ?? null
  const isMine = (t: Tournament) => myId != null && t.entries.some((e) => e.userId === myId)
  const mine = [...running, ...open].filter(isMine)
  const active = running.length + open.length

  const tabs: { key: Filter; label: string; count: number }[] = [
    { key: 'all', label: 'Tümü', count: list.length },
    { key: 'running', label: 'Devam eden', count: running.length },
    { key: 'open', label: 'Kayıtlar açık', count: open.length },
    ...(mine.length ? [{ key: 'mine' as const, label: 'Kayıtlı olduklarım', count: mine.length }] : []),
    { key: 'past', label: 'Tamamlanan', count: past.length },
  ]
  // The member signed out, or left the last tournament: that tab is gone, so the list falls back to everything.
  const shown: Filter = tabs.some((tab) => tab.key === filter) ? filter : 'all'
  const show = (key: Filter) => shown === 'all' || shown === key
  const pastList = allPast || shown === 'past' ? past : past.slice(0, PAST_SHOWN)
  const card = (t: Tournament) => <TournamentCard key={t.id} t={t} onChanged={reload} defaultOpen={active === 1 && t.status !== 'bitti'} />

  if (list.length === 0) return <Empty />

  return (
    <div className="flex flex-col gap-6">
      <div role="group" aria-label="Turnuvaları süz" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-wrap lg:px-0">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            aria-pressed={shown === tab.key}
            onClick={() => setFilter(tab.key)}
            className={cn(
              'flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold transition-colors',
              shown === tab.key ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-foreground hover:bg-secondary',
            )}
          >
            {tab.label}
            <span className={cn('rounded-full px-1.5 text-xs tabular-nums', shown === tab.key ? 'bg-primary-foreground/20' : 'bg-secondary text-muted-foreground')}>{tab.count}</span>
          </button>
        ))}
      </div>

      {shown === 'mine' ? (
        <Group id="benim" title="Kayıtlı olduklarım" count={mine.length}>
          {mine.map(card)}
        </Group>
      ) : (
        <>
          {show('running') && running.length > 0 && (
            <Group id="devam" title="Devam eden" count={running.length}>
              {running.map(card)}
            </Group>
          )}
          {show('open') && open.length > 0 && (
            <Group id="kayit" title="Kayıtlar açık" count={open.length}>
              {open.map(card)}
            </Group>
          )}
          {shown === 'all' && active === 0 && <Empty />}
          {shown === 'running' && running.length === 0 && <Quiet text="Şu an oynanan bir turnuva yok." />}
          {shown === 'open' && open.length === 0 && <Quiet text="Şu an kayıtları açık bir turnuva yok. Yenisi açılınca burada görünür." />}
          {show('past') && past.length > 0 && (
            <Group id="gecmis" title="Tamamlanan" count={past.length}>
              {pastList.map(card)}
              {pastList.length < past.length && (
                <button
                  type="button"
                  onClick={() => setAllPast(true)}
                  className="self-center rounded-xl border border-border px-4 py-2.5 text-sm font-bold text-foreground hover:bg-secondary"
                >
                  {past.length - pastList.length} turnuva daha göster
                </button>
              )}
            </Group>
          )}
          {shown === 'past' && past.length === 0 && <Quiet text="Henüz tamamlanan bir turnuva yok." />}
        </>
      )}
    </div>
  )
}

function Quiet({ text }: { text: string }) {
  return <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">{text}</p>
}

function Empty() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-8 text-center">
      <Swords className="size-9 text-primary" aria-hidden="true" />
      <h2 className="font-display text-2xl font-bold uppercase text-foreground">Yeni turnuva yakında</h2>
      <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
        Şu an kayıtları açık bir turnuva yok. Duyurular Telegram kanalımızda. O zamana kadar masalarda ısınabilirsin.
      </p>
      <Link href="/oyunlar" className="mt-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold uppercase tracking-wide text-primary-foreground">
        Masa oyunlarına git
      </Link>
    </div>
  )
}
