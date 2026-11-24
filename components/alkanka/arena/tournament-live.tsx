'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import useSWR from 'swr'
import { CalendarDays, Send, Swords, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ARENA_META, type ArenaGame } from '@/lib/arena'
import { TOURNAMENT_FILTER_PARAM } from '@/lib/record-links'
import { DUEL_TOURNAMENT_GAMES, TABLE_TOURNAMENT_GAMES, listPulse, type Tournament } from '@/lib/tournaments-shared'
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

const FILTER_ADDRESS: Record<Exclude<Filter, 'all'>, string> = { running: 'devam', open: 'kayit', past: 'tamamlanan', mine: 'benim' }
const FILTER_OF: Record<string, Filter | undefined> = { devam: 'running', kayit: 'open', tamamlanan: 'past', benim: 'mine' }

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
export function TournamentLive({ initial, only }: { initial: Tournament[]; only?: number }) {
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
  const everything = data ?? initial
  // A tournament's own page keeps reading the shared list and shows its one card from it.
  const list = useMemo(() => (only == null ? everything : everything.filter((t) => t.id === only)), [everything, only])

  // The page is static HTML, so the filter of a shared address is read here, once the page is on screen.
  useEffect(() => {
    if (only != null) return
    const wanted = FILTER_OF[new URLSearchParams(window.location.search).get(TOURNAMENT_FILTER_PARAM) ?? '']
    if (wanted) setFilter(wanted)
  }, [only])
  const pick = (key: Filter) => {
    setFilter(key)
    const url = new URL(window.location.href)
    if (key === 'all') url.searchParams.delete(TOURNAMENT_FILTER_PARAM)
    else url.searchParams.set(TOURNAMENT_FILTER_PARAM, FILTER_ADDRESS[key])
    window.history.replaceState(null, '', url)
  }
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
  const tabs = only == null && kinds.length > 1 ? [{ key: 'all' as const, label: 'Tümü', count: running.length + open.length + past.length }, ...kinds] : []
  // The member signed out, or the last tournament of a kind closed: that filter is gone, so the list falls back to everything.
  const shown: Filter = tabs.some((tab) => tab.key === filter) ? filter : 'all'
  const show = (key: Filter) => shown === 'all' || shown === key
  const pastList = allPast || shown === 'past' ? past : past.slice(0, PAST_SHOWN)
  const card = (t: Tournament) => <TournamentCard key={t.id} t={t} onChanged={reload} defaultOpen={only != null || (active === 1 && t.status !== 'bitti')} />

  if (only != null && list.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm leading-relaxed text-muted-foreground">
        Bu turnuva artık listede değil.{' '}
        <Link href="/turnuvalar" className="font-bold text-primary underline-offset-4 hover:underline">
          Tüm turnuvalara dön
        </Link>
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      {tabs.length > 0 && (
        <div role="group" aria-label="Turnuvaları süz" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-wrap lg:px-0">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              aria-pressed={shown === tab.key}
              onClick={() => pick(tab.key)}
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
          {only == null && shown === 'all' && active === 0 && <NoneOpen />}
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

const TOURNAMENT_GAMES = [...DUEL_TOURNAMENT_GAMES, ...TABLE_TOURNAMENT_GAMES].filter((game): game is ArenaGame => game in ARENA_META)

/** Shown while there is nothing to join or watch: what comes next, where it is announced, which games host tournaments, and how one goes. */
function NoneOpen() {
  const telegramUrl = useTelegramUrl()
  return (
    <section
      aria-labelledby="turnuva-yok"
      className="@container overflow-hidden rounded-2xl border border-border bg-card bg-gradient-to-br from-primary/[0.07] via-transparent to-transparent shadow-[inset_0_1px_0_0_oklch(1_0_0/0.05)]"
    >
      <div className="flex flex-col @3xl:flex-row">
        <div className="flex min-w-0 flex-1 flex-col items-start justify-center gap-2.5 p-4 @md:gap-4 @md:p-6 @2xl:p-8">
          <p className="flex items-center gap-2 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-widest text-primary @md:bg-transparent @md:p-0 @md:text-xs">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-primary @md:h-px @md:w-6 @md:rounded-none" />
            Şu an açık turnuva yok
          </p>
          <h2 id="turnuva-yok" className="font-display text-2xl font-bold uppercase leading-none text-foreground text-balance @md:text-3xl @2xl:text-4xl @5xl:text-5xl">
            Yeni turnuva yakında
          </h2>
          <p className="max-w-md text-sm leading-relaxed text-muted-foreground text-pretty @md:text-base @5xl:max-w-lg @5xl:text-lg">
            Kayıtlar bu sayfada açılır, aynı anda Telegram kanalımızda duyurulur. O zamana kadar turnuva oyunlarında ısınabilirsin.
          </p>
          <div className="flex w-full gap-2 pt-1 @md:w-auto @md:flex-wrap">
            <a
              href={telegramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-11 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-primary px-4 text-sm font-bold uppercase tracking-wide text-primary-foreground hover:brightness-110 @md:flex-none @md:px-5"
            >
              <Send className="size-4 shrink-0" aria-hidden="true" />
              Telegram&apos;da haber al
              <span className="sr-only"> (yeni sekmede açılır)</span>
            </a>
            <Link href="/oyunlar" className="flex h-11 items-center justify-center whitespace-nowrap rounded-xl border border-border bg-background/40 px-4 text-sm font-bold uppercase tracking-wide text-foreground hover:bg-secondary @md:px-5">
              Tüm oyunlar
            </Link>
          </div>
        </div>

        <div className="flex flex-col gap-2.5 border-t border-border bg-background/50 p-4 @md:gap-3 @md:p-6 @3xl:w-[42%] @3xl:border-t-0 @3xl:border-l @5xl:w-[36rem]">
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Turnuva açılan oyunlar</h3>
          <ul className="grid grid-cols-3 gap-2">
            {TOURNAMENT_GAMES.map((game) => (
              <li key={game}>
                <Link
                  href={`/oyunlar/${game}`}
                  className="group relative block overflow-hidden rounded-xl bg-surface ring-1 ring-border transition hover:ring-primary aspect-[2/1] @3xl:aspect-[4/3] @5xl:aspect-[3/2]"
                >
                  <Image
                    src={ARENA_META[game].image || '/placeholder.svg'}
                    alt=""
                    fill
                    sizes="(min-width: 768px) 180px, 33vw"
                    className="object-cover object-[center_30%] transition-transform duration-300 group-hover:scale-105"
                  />
                  <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
                  <span className="absolute inset-x-0 bottom-0 px-2 pb-1.5 text-xs font-bold leading-tight text-foreground">{ARENA_META[game].title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <ol aria-label="Turnuva nasıl işler" className="flex flex-col border-t border-border p-4 @md:p-6 @2xl:flex-row @2xl:px-8">
        {HOW_IT_WORKS.map((step, i) => (
          <li key={step.title} className="flex flex-1 gap-3 @2xl:flex-col">
            <div className="flex flex-col items-center gap-1 @2xl:flex-row @2xl:gap-3">
              <span
                aria-hidden="true"
                className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15 font-display text-xs font-bold text-primary ring-1 ring-primary/40 @2xl:size-8 @2xl:text-sm"
              >
                {i + 1}
              </span>
              {i < HOW_IT_WORKS.length - 1 && (
                <span aria-hidden="true" className="w-px flex-1 bg-gradient-to-b from-primary/40 to-border @2xl:mr-3 @2xl:h-px @2xl:w-auto @2xl:bg-none @2xl:bg-border" />
              )}
            </div>
            <div className={cn('flex min-w-0 flex-col gap-0.5 @2xl:gap-1 @2xl:pb-0 @2xl:pr-8', i < HOW_IT_WORKS.length - 1 && 'pb-3')}>
              <span className="font-display text-sm font-bold uppercase leading-6 text-foreground @2xl:text-base">{step.title}</span>
              <span className="text-sm leading-snug text-muted-foreground text-pretty @2xl:leading-relaxed">{step.text}</span>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}

const FORMATS = [
  { icon: Swords, tint: 'bg-primary/15 text-primary', name: 'Eleme', text: 'Kaybeden elenir, kazanan tur atlar. Tek oturumda biter; finali kazanan şampiyon olur.' },
  { icon: CalendarDays, tint: 'bg-accent/15 text-accent', name: 'Fikstürlü lig', text: 'Herkes herkesle oynar. Turlar art arda, her gün ya da her hafta açılır; en çok puanı toplayan şampiyon olur.' },
  { icon: TrendingUp, tint: 'bg-live/15 text-live', name: 'Puan ligi', text: 'Eşleşme yok. Lig süresince o oyunda oynadığın masalar puan getirir; bitişte ilk sıralar ödülü alır.' },
]

/** The three kinds of tournament a card can name, so the word on the card means something. */
function FormatGuide() {
  return (
    <Group id="turnuva-turleri" title="Turnuva türleri">
      <div className="@container">
        <ul className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border @2xl:grid-cols-3">
          {FORMATS.map(({ icon: Icon, tint, name, text }) => (
            <li key={name} className="flex gap-3 bg-card px-3.5 py-3 @2xl:flex-col @2xl:p-5">
              <span aria-hidden="true" className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg', tint)}>
                <Icon className="size-4" />
              </span>
              <div className="flex min-w-0 flex-col gap-0.5 @2xl:gap-1">
                <span className="font-display text-sm font-bold uppercase text-foreground @2xl:text-base">{name}</span>
                <span className="text-sm leading-snug text-muted-foreground text-pretty @2xl:leading-relaxed">{text}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Group>
  )
}
