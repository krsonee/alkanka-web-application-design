'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Catalog } from '@/lib/catalog-shared'
import type { HiddenMap } from '@/lib/hidden-shared'
import { STATUS_LABEL, type TournamentStatus } from '@/lib/tournaments-shared'
import { cn } from '@/lib/utils'

export type CalendarTournament = { id: number; title: string; startsAt: string; status: TournamentStatus }
type ListKind = 'events' | 'predictions' | 'campaigns'
type EntryType = 'start' | 'end' | 'match' | 'tournament'
type Entry = { key: string; day: string; time: string; at: number; type: EntryType; label: string; note?: string; open?: { kind: ListKind; id: string }; href?: string }

const TR_OFFSET = 3 * 3_600_000
const WEEKDAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']
const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']
const PREFIX: Record<EntryType, string> = { start: 'Başlar', end: 'Biter', match: 'Maç', tournament: 'Turnuva' }
const TONE: Record<EntryType, string> = {
  start: 'border-primary/50 bg-primary/15',
  end: 'border-destructive/50 bg-destructive/10',
  match: 'border-border bg-secondary',
  tournament: 'border-success/50 bg-success/15',
}

/** Calendar days are Istanbul days (UTC+3, no DST), the same clock the date fields use. */
const trStamp = (ms: number) => new Date(ms + TR_OFFSET).toISOString()
const pad = (n: number) => String(n).padStart(2, '0')
const dayLabel = (day: string) => `${Number(day.slice(8, 10))} ${MONTHS[Number(day.slice(5, 7)) - 1]}`

function collect(catalog: Pick<Catalog, 'events' | 'predictions' | 'campaigns'>, tournaments: CalendarTournament[], hidden: HiddenMap): Entry[] {
  const out: Entry[] = []
  const push = (iso: string | undefined, entry: Omit<Entry, 'day' | 'time' | 'at'>) => {
    const at = Date.parse(iso ?? '')
    if (!Number.isFinite(at)) return
    const stamp = trStamp(at)
    out.push({ ...entry, at, day: stamp.slice(0, 10), time: stamp.slice(11, 16) })
  }
  for (const e of catalog.events) {
    const note = hidden.event?.includes(e.id) ? 'gizli' : undefined
    const pays = (e.rank ?? 'none') === 'none' ? undefined : 'ödül dağıtılır'
    const open = { kind: 'events' as const, id: e.id }
    push(e.startsAt, { key: `es-${e.id}`, type: 'start', label: e.title, note, open })
    push(e.endsAt, { key: `ee-${e.id}`, type: 'end', label: e.title, note: [note, pays].filter(Boolean).join(', ') || undefined, open })
  }
  for (const c of catalog.campaigns) {
    const note = hidden.campaign?.includes(c.id) ? 'gizli' : undefined
    const open = { kind: 'campaigns' as const, id: c.id }
    push(c.startsAt, { key: `cs-${c.id}`, type: 'start', label: c.title, note, open })
    push(c.endsAt, { key: `ce-${c.id}`, type: 'end', label: c.title, note, open })
  }
  for (const p of catalog.predictions) {
    push(p.kickoffAt, { key: `p-${p.id}`, type: 'match', label: `${p.home} - ${p.away}`, note: hidden.prediction?.includes(p.id) ? 'gizli' : undefined, open: { kind: 'predictions', id: p.id } })
  }
  for (const t of tournaments) {
    push(t.startsAt, {
      key: `t-${t.id}`,
      type: 'tournament',
      label: t.title,
      note: t.status === 'kayit' ? undefined : STATUS_LABEL[t.status].toLocaleLowerCase('tr'),
      href: `/panel?b=tournaments&f=tournament-${t.id}`,
    })
  }
  return out.sort((a, b) => a.at - b.at)
}

function Chip({ entry, onOpen, wide }: { entry: Entry; onOpen: (kind: ListKind, id: string) => void; wide?: boolean }) {
  const cls = cn('flex min-w-0 items-baseline gap-1 rounded-md border px-1.5 py-1 text-left text-xs leading-tight text-foreground hover:border-primary', TONE[entry.type], wide && 'px-2.5 py-2 text-sm')
  const body = (
    <>
      <span className="shrink-0 font-semibold">{PREFIX[entry.type]}</span>
      <span className={cn('min-w-0', !wide && 'truncate')}>{entry.label}</span>
      <span className="shrink-0 tabular-nums text-muted-foreground">
        {entry.time}
        {entry.note ? ` · ${entry.note}` : ''}
      </span>
    </>
  )
  const title = `${PREFIX[entry.type]}: ${entry.label} · ${entry.time}${entry.note ? ` · ${entry.note}` : ''}`
  if (!entry.open) {
    return (
      <Link href={entry.href ?? '/panel?b=tournaments'} title={title} className={cls}>
        {body}
      </Link>
    )
  }
  const target = entry.open
  return (
    <button type="button" title={title} onClick={() => onOpen(target.kind, target.id)} className={cls}>
      {body}
    </button>
  )
}

export function CatalogCalendar({
  catalog,
  tournaments,
  hidden,
  onOpen,
}: {
  catalog: Pick<Catalog, 'events' | 'predictions' | 'campaigns' | 'bonuses'>
  tournaments: CalendarTournament[]
  hidden: HiddenMap
  onOpen: (kind: ListKind, id: string) => void
}) {
  const [now] = useState(() => Date.now())
  const today = trStamp(now).slice(0, 10)
  const [month, setMonth] = useState(() => today.slice(0, 7))
  const [year, monthNo] = month.split('-').map(Number)

  const entries = collect(catalog, tournaments, hidden)
  const inMonth = entries.filter((e) => e.day.startsWith(month))
  const byDay = new Map<string, Entry[]>()
  for (const e of inMonth) byDay.set(e.day, [...(byDay.get(e.day) ?? []), e])

  const dated = catalog.campaigns.filter((c) => c.startsAt || c.endsAt)
  const liveOn = (day: string) => {
    const from = Date.parse(`${day}T00:00:00+03:00`)
    const to = from + 86_400_000
    return dated.filter((c) => (!c.startsAt || Date.parse(c.startsAt) < to) && (!c.endsAt || Date.parse(c.endsAt) > from)).length
  }

  const daysInMonth = new Date(Date.UTC(year, monthNo, 0)).getUTCDate()
  const lead = (new Date(Date.UTC(year, monthNo - 1, 1)).getUTCDay() + 6) % 7
  const cells: (string | null)[] = [...Array.from({ length: lead }, () => null), ...Array.from({ length: daysInMonth }, (_, i) => `${month}-${pad(i + 1)}`)]
  while (cells.length % 7) cells.push(null)
  const weeks = Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7))

  const shift = (by: number) => {
    const d = new Date(Date.UTC(year, monthNo - 1 + by, 1))
    setMonth(`${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`)
  }

  const ended = entries.filter((e) => (e.type === 'end' || e.type === 'match') && e.at <= now).reverse()
  const undated = [
    { label: 'Etkinlik', n: catalog.events.filter((e) => !e.endsAt).length, why: 'bitiş tarihi boş, sitede geri sayım görünmez' },
    { label: 'Kampanya', n: catalog.campaigns.length - dated.length, why: 'başlangıç ve bitiş boş, hep yayında' },
    { label: 'Tahmin', n: catalog.predictions.filter((p) => !p.kickoffAt).length, why: 'maç tarihi boş' },
    { label: 'Bonus', n: catalog.bonuses.length, why: 'bonuslarda tarih yok' },
  ].filter((x) => x.n > 0)

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-sm font-semibold text-foreground">Takvim</h3>
          <p className="text-xs leading-relaxed text-muted-foreground">Kaydedilmiş etkinlik, kampanya, maç ve turnuva tarihleri, İstanbul saatiyle. Bir kayda basınca düzenleme ekranı açılır.</p>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => shift(-1)} aria-label="Önceki ay" className="flex size-9 items-center justify-center rounded-lg border border-border text-foreground hover:bg-secondary">
            <ChevronLeft className="size-4" aria-hidden="true" />
          </button>
          <p aria-live="polite" className="min-w-32 text-center text-sm font-semibold text-foreground">{`${MONTHS[monthNo - 1]} ${year}`}</p>
          <button type="button" onClick={() => shift(1)} aria-label="Sonraki ay" className="flex size-9 items-center justify-center rounded-lg border border-border text-foreground hover:bg-secondary">
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>
          {month !== today.slice(0, 7) && (
            <button type="button" onClick={() => setMonth(today.slice(0, 7))} className="ml-1 h-9 rounded-lg border border-border px-3 text-xs font-semibold text-foreground hover:bg-secondary">
              Bugün
            </button>
          )}
        </div>
      </header>

      <table className="hidden w-full table-fixed border-separate border-spacing-1 md:table">
        <caption className="sr-only">{`${MONTHS[monthNo - 1]} ${year} içerik takvimi`}</caption>
        <thead>
          <tr>
            {WEEKDAYS.map((d) => (
              <th key={d} scope="col" className="pb-1 text-left text-xs font-semibold text-muted-foreground">
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, w) => (
            <tr key={w}>
              {week.map((day, i) => {
                if (!day) return <td key={i} className="rounded-lg bg-background/40" />
                const list = byDay.get(day) ?? []
                const live = liveOn(day)
                return (
                  <td key={day} className={cn('h-28 rounded-lg border border-border bg-background p-1.5 align-top', day === today && 'border-primary')}>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-baseline justify-between gap-1">
                        <span className={cn('text-xs font-bold tabular-nums', day === today ? 'text-primary' : 'text-foreground')}>
                          {Number(day.slice(8))}
                          {day === today && <span className="ml-1 font-semibold">bugün</span>}
                        </span>
                        {live > 0 && <span className="truncate text-xs text-muted-foreground" title={`${live} tarihli kampanya yayında`}>{`${live} yayında`}</span>}
                      </div>
                      {list.slice(0, 3).map((e) => (
                        <Chip key={e.key} entry={e} onOpen={onOpen} />
                      ))}
                      {list.length > 3 && <span className="text-xs text-muted-foreground">{`+${list.length - 3} kayıt daha`}</span>}
                    </div>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex flex-col gap-3 md:hidden">
        {byDay.size === 0 && <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">Bu ay tarihli kayıt yok.</p>}
        {[...byDay.entries()].map(([day, list]) => (
          <div key={day} className="flex flex-col gap-1.5">
            <h4 className={cn('text-xs font-bold', day === today ? 'text-primary' : 'text-foreground')}>
              {dayLabel(day)}
              {day === today ? ' · bugün' : ''}
            </h4>
            {list.map((e) => (
              <Chip key={e.key} entry={e} onOpen={onOpen} wide />
            ))}
          </div>
        ))}
      </div>
      {byDay.size === 0 && <p className="hidden text-sm text-muted-foreground md:block">Bu ay tarihli kayıt yok.</p>}

      <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground" aria-label="Takvimdeki kayıt türleri">
        {(Object.keys(PREFIX) as EntryType[]).map((type) => (
          <li key={type} className="flex items-center gap-1.5">
            <span className={cn('size-3 rounded-sm border', TONE[type])} aria-hidden="true" />
            {type === 'start' ? 'Başlar: kampanya başlangıcı' : type === 'end' ? 'Biter: kampanya bitişi' : type === 'match' ? 'Maç: tahmin maçı' : 'Turnuva: başlangıç saati'}
          </li>
        ))}
      </ul>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-background p-3">
          <h4 className="text-xs font-semibold text-foreground">Süresi geçenler · {ended.length}</h4>
          {ended.length === 0 ? (
            <p className="text-xs text-muted-foreground">Bitmiş kampanya ya da saati geçmiş maç yok.</p>
          ) : (
            <>
              <p className="text-xs leading-relaxed text-muted-foreground">Bitiş tarihi geçen kampanya yayından düşer, saati geçen maç tahmine kapanır. Kayıtlar listede durur; işin bittiyse açıp sil.</p>
              <ul className="flex flex-col gap-1.5">
                {ended.slice(0, 12).map((e) => (
                  <li key={e.key} className="flex flex-col gap-0.5">
                    <span className="text-xs tabular-nums text-muted-foreground">{dayLabel(e.day)}</span>
                    <Chip entry={e} onOpen={onOpen} wide />
                  </li>
                ))}
              </ul>
              {ended.length > 12 && <p className="text-xs text-muted-foreground">{`ve ${ended.length - 12} kayıt daha.`}</p>}
            </>
          )}
        </div>
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-background p-3">
          <h4 className="text-xs font-semibold text-foreground">Takvimde görünmeyenler</h4>
          {undated.length === 0 ? (
            <p className="text-xs text-muted-foreground">Tüm kayıtların tarihi var.</p>
          ) : (
            <ul className="flex flex-col gap-1.5 text-xs leading-relaxed text-muted-foreground">
              {undated.map((x) => (
                <li key={x.label}>
                  <span className="font-semibold text-foreground">{`${x.n} ${x.label.toLocaleLowerCase('tr')}`}</span>
                  {`: ${x.why}.`}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}
