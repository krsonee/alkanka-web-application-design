'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { CalendarDays, Send, Swords, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { listPulse, type Tournament } from '@/lib/tournaments-shared'
import { JakoAvatar } from '../jako'
import { usePoints } from '../points-context'
import { useTelegramUrl } from '../telegram-address'
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

const groupTitle = 'flex items-center gap-3 font-display text-lg font-bold uppercase text-foreground'

function Group({ id, title, count, children }: { id: string; title: string; count?: number; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h2 id={id} className={groupTitle}>
        {title}
        {count != null && <span className="rounded-full bg-secondary px-2 py-0.5 font-sans text-xs font-bold tabular-nums text-muted-foreground">{count}</span>}
        <span aria-hidden="true" className="h-px flex-1 bg-border" />
      </h2>
      {children}
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

  // A filter that would show nothing is not offered; with a single kind of tournament on the page there is nothing to filter.
  const kinds: { key: Filter; label: string; count: number }[] = [
    { key: 'running' as const, label: 'Devam eden', count: running.length },
    { key: 'open' as const, label: 'Kayıtlar açık', count: open.length },
    { key: 'mine' as const, label: 'Kayıtlı olduklarım', count: mine.length },
    { key: 'past' as const, label: 'Tamamlanan', count: past.length },
  ].filter((tab) => tab.count > 0)
  const tabs = kinds.length > 1 ? [{ key: 'all' as const, label: 'Tümü', count: running.length + open.length + past.length }, ...kinds] : []
  // The member signed out, or the last tournament of a kind closed: that filter is gone, so the list falls back to everything.
  const shown: Filter = tabs.some((tab) => tab.key === filter) ? filter : 'all'
  const show = (key: Filter) => shown === 'all' || shown === key
  const pastList = allPast || shown === 'past' ? past : past.slice(0, PAST_SHOWN)
  const card = (t: Tournament) => <TournamentCard key={t.id} t={t} onChanged={reload} defaultOpen={active === 1 && t.status !== 'bitti'} />

  return (
    <div className="flex flex-col gap-8">
      {tabs.length > 0 && (
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
      )}

      {shown === 'mine' ? (
        <Group id="benim" title="Kayıtlı olduklarım" count={mine.length}>
          {mine.map(card)}
        </Group>
      ) : (
        <>
          {shown === 'all' && active === 0 && <NoneOpen />}
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
        </>
      )}

      <FormatGuide />
    </div>
  )
}

const HOW_IT_WORKS = [
  { title: 'Kaydol', text: 'Turnuva açılınca kartındaki düğmeyle kaydolursun. Ücretliyse ücret kayıtta bir kez kesilir.' },
  { title: 'Masana gir', text: 'Maçın açılınca bildirim gelir, tek tıkla masana girersin. Puan liginde kendi oyunlarını oynaman yeter.' },
  { title: 'Ödülünü al', text: 'Turnuva bitince ödül sıralamaya göre Kanka Coin olarak hesabına yüklenir.' },
]

/** Shown while there is nothing to join or watch: what comes next, where it is announced, and how a tournament goes. */
function NoneOpen() {
  const telegramUrl = useTelegramUrl()
  return (
    <section aria-labelledby="turnuva-yok" className="@container overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex flex-col items-center gap-5 p-6 text-center @2xl:flex-row @2xl:gap-7 @2xl:p-8 @2xl:text-left">
        <JakoAvatar pose="duyuru" size="lg" />
        <div className="flex min-w-0 flex-1 flex-col items-center gap-3 @2xl:items-start">
          <p className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-primary" />
            Şu an açık turnuva yok
          </p>
          <h2 id="turnuva-yok" className="font-display text-2xl font-bold uppercase leading-tight text-foreground text-balance @2xl:text-3xl">
            Yeni turnuva yakında
          </h2>
          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground text-pretty">
            Yeni bir turnuva açıldığında kayıtlar bu sayfada başlar ve Telegram kanalımızda duyurulur. O zamana kadar masalarda ısınabilirsin.
          </p>
          <div className="flex w-full flex-col gap-2 pt-1 @md:w-auto @md:flex-row">
            <a
              href={telegramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold uppercase tracking-wide text-primary-foreground hover:brightness-110"
            >
              <Send className="size-4 shrink-0" aria-hidden="true" />
              Telegram&apos;da haber al
              <span className="sr-only"> (yeni sekmede açılır)</span>
            </a>
            <Link href="/oyunlar" className="flex items-center justify-center rounded-xl border border-border px-5 py-3 text-sm font-bold uppercase tracking-wide text-foreground hover:bg-secondary">
              Masalarda ısın
            </Link>
          </div>
        </div>
      </div>
      <ol aria-label="Turnuva nasıl işler" className="grid gap-px border-t border-border bg-border @2xl:grid-cols-3">
        {HOW_IT_WORKS.map((step, i) => (
          <li key={step.title} className="flex gap-3 bg-card p-4 @2xl:p-5">
            <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary font-display text-sm font-bold text-primary-foreground">
              {i + 1}
            </span>
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-sm font-bold text-foreground">{step.title}</span>
              <span className="text-sm leading-relaxed text-muted-foreground text-pretty">{step.text}</span>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}

const FORMATS = [
  { icon: Swords, name: 'Eleme', text: 'Kaybeden elenir, kazanan tur atlar. Tek oturumda biter; finali kazanan şampiyon olur.' },
  { icon: CalendarDays, name: 'Fikstürlü lig', text: 'Herkes herkesle oynar. Turlar art arda, her gün ya da her hafta açılır; en çok puanı toplayan şampiyon olur.' },
  { icon: TrendingUp, name: 'Puan ligi', text: 'Eşleşme yok. Lig süresince o oyunda oynadığın masalar puan getirir; bitişte ilk sıralar ödülü alır.' },
]

/** The three kinds of tournament a card can name, so the word on the card means something. */
function FormatGuide() {
  return (
    <Group id="turnuva-turleri" title="Turnuva türleri">
      <div className="@container">
        <ul className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border @2xl:grid-cols-3">
          {FORMATS.map(({ icon: Icon, name, text }) => (
            <li key={name} className="flex gap-3 bg-card p-4 @2xl:flex-col @2xl:p-5">
              <Icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
              <div className="flex min-w-0 flex-col gap-1">
                <span className="font-display text-base font-bold uppercase text-foreground">{name}</span>
                <span className="text-sm leading-relaxed text-muted-foreground text-pretty">{text}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Group>
  )
}
