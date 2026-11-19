'use client'

import { useCallback, useEffect, useRef, useState, useTransition, type DragEvent, type ReactNode } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, ExternalLink, Loader2, Plus, Save, Trash2 } from 'lucide-react'
import { saveCatalogList } from '@/app/panel/catalog-actions'
import { askConfirm } from '@/components/panel/confirm-dialog'
import { SideSheet } from '@/components/panel/side-sheet'
import {
  GROUPS,
  PREFIX,
  WEEKDAYS,
  blankOn,
  collect,
  dayLabel,
  dayOf,
  monthWeeks,
  moveDate,
  pastWarning,
  rangeLabel,
  shiftDay,
  shiftMonth,
  weekDays,
  type CalendarLeagueMatch,
  type CalendarTournament,
  type CalendarView,
  type Entry,
  type EntryType,
  type Group,
  type Item,
  type ListKind,
} from '@/lib/catalog-calendar-shared'
import type { Catalog } from '@/lib/catalog-shared'
import type { HiddenMap } from '@/lib/hidden-shared'
import { cn } from '@/lib/utils'

export type { CalendarTournament } from '@/lib/catalog-calendar-shared'

const TONE: Record<EntryType, string> = {
  start: 'border-primary/50 bg-primary/15',
  end: 'border-destructive/50 bg-destructive/10',
  match: 'border-border bg-secondary',
  league: 'border-foreground/40 bg-background',
  tournament: 'border-success/50 bg-success/15',
  cupEnd: 'border-success/50 bg-background',
}
const LEGEND: Record<EntryType, string> = {
  start: 'Başlar: etkinlik ya da kampanya başlangıcı',
  end: 'Biter: etkinlik ya da kampanya bitişi',
  match: 'Maç: seçenekli tahmin',
  league: 'Lig maçı: tahmin ligi',
  tournament: 'Turnuva: başlangıç saati',
  cupEnd: 'Turnuva biter: en geç kapanacağı saat (maçlar erken biterse daha önce kapanır)',
}
const VIEWS: { id: CalendarView; label: string }[] = [
  { id: 'month', label: 'Ay' },
  { id: 'week', label: 'Hafta' },
  { id: 'list', label: 'Liste' },
]
const NOUN: Record<ListKind, string> = { events: 'etkinlik', campaigns: 'kampanya', predictions: 'seçenekli tahmin' }
const SWATCH: Record<Group, string> = { events: 'bg-primary', campaigns: 'bg-destructive', predictions: 'bg-muted-foreground', tournaments: 'bg-success' }

const nameOf = (kind: ListKind, item: Item) => (kind === 'predictions' ? `${String(item.home ?? '')} - ${String(item.away ?? '')}` : String(item.title || 'Adsız'))

type DragHandlers = { onStart: (event: DragEvent<HTMLElement>) => void; onEnd: () => void }

function Chip({ entry, onOpen, wide, drag, lifted }: { entry: Entry; onOpen: () => void; wide?: boolean; drag?: DragHandlers; lifted?: boolean }) {
  const cls = cn(
    'flex min-w-0 rounded-md border text-left leading-tight text-foreground hover:border-primary',
    TONE[entry.type],
    wide ? 'items-baseline gap-1 px-2.5 py-2 text-sm' : 'flex-col gap-0.5 overflow-hidden px-1.5 py-1 text-xs',
    drag && 'cursor-grab active:cursor-grabbing',
    lifted && 'opacity-40',
  )
  // A day cell is too narrow for one line: the kind gets the first, the time and the name share the second.
  const body = wide ? (
    <>
      <span className="shrink-0 font-semibold">{PREFIX[entry.type]}</span>
      <span className="min-w-0">{entry.label}</span>
      <span className="shrink-0 tabular-nums text-muted-foreground">
        {entry.time}
        {entry.note ? ` · ${entry.note}` : ''}
      </span>
    </>
  ) : (
    <>
      <span className="truncate font-semibold">{PREFIX[entry.type]}</span>
      <span className="flex min-w-0 items-baseline gap-1">
        <span className="shrink-0 tabular-nums text-muted-foreground">{entry.time}</span>
        <span className="truncate">{entry.label}</span>
      </span>
      {entry.note && <span className="truncate text-muted-foreground">{entry.note}</span>}
    </>
  )
  const title = `${PREFIX[entry.type]}: ${entry.label} · ${entry.time}${entry.note ? ` · ${entry.note}` : ''}`
  if (entry.href) {
    return (
      <Link href={entry.href} title={title} draggable={false} className={cls}>
        {body}
      </Link>
    )
  }
  return (
    <button type="button" title={drag ? `${title} · başka güne sürükleyip tarihini değiştirebilirsin` : title} onClick={onOpen} draggable={Boolean(drag)} onDragStart={drag?.onStart} onDragEnd={drag?.onEnd} className={cls}>
      {body}
    </button>
  )
}

const menuItem = 'flex h-9 w-full items-center gap-2 rounded-md px-2.5 text-left text-xs font-semibold text-foreground hover:bg-secondary'

function AddMenu({ day, align, league, onPick, onLeague, onClose }: { day: string; align: 'start' | 'end'; league: boolean; onPick: (kind: ListKind) => void; onLeague: () => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    ref.current?.querySelector('button')?.focus()
    const away = (event: PointerEvent) => {
      const target = event.target as Element | null
      if (!target || ref.current?.contains(target) || target.closest('[data-add-toggle]')) return
      onClose()
    }
    document.addEventListener('pointerdown', away)
    return () => document.removeEventListener('pointerdown', away)
  }, [onClose])

  return (
    <div
      ref={ref}
      role="group"
      aria-label={`${dayLabel(day)} için kayıt ekle`}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return
        event.stopPropagation()
        onClose()
      }}
      className={cn('absolute top-9 z-20 flex w-52 flex-col rounded-lg border border-border bg-card p-1 shadow-xl', align === 'end' ? 'right-1' : 'left-1')}
    >
      <p className="px-2.5 pb-1 pt-1.5 text-xs font-semibold text-muted-foreground">{`${dayLabel(day)} için ekle`}</p>
      <button type="button" className={menuItem} onClick={() => onPick('events')}>
        Etkinlik
      </button>
      <button type="button" className={menuItem} onClick={() => onPick('campaigns')}>
        Kampanya
      </button>
      <button type="button" className={menuItem} onClick={() => onPick('predictions')}>
        Seçenekli tahmin
      </button>
      {league && (
        <button type="button" className={menuItem} onClick={onLeague}>
          <span className="min-w-0 flex-1">Tahmin ligi maçı</span>
          <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        </button>
      )}
      <Link href="/panel?b=tournaments" className={menuItem}>
        <span className="min-w-0 flex-1">Turnuva</span>
        <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      </Link>
    </div>
  )
}

type Sheet = { kind: ListKind; item: Item; isNew: boolean }
type AddAt = { day: string; where: 'head' | 'grid' | 'list' }

export function CatalogCalendar({
  catalog,
  tournaments,
  league,
  hidden,
  blank,
  renderFields,
  onSaved,
  onOpen,
  onJump,
}: {
  catalog: Pick<Catalog, 'events' | 'predictions' | 'campaigns' | 'bonuses'>
  tournaments: CalendarTournament[]
  league: CalendarLeagueMatch[] | null
  hidden: HiddenMap
  /** The list's usual empty record; the calendar puts the clicked day on it. */
  blank: (kind: ListKind) => Item
  renderFields: (kind: ListKind, item: Item, set: (patch: Item) => void) => ReactNode
  onSaved: (kind: ListKind, next: Item[]) => void
  /** Opens the record in its own list, where standings, participants and links live. */
  onOpen: (kind: ListKind, id: string) => void
  onJump: (tab: 'league') => void
}) {
  const [now] = useState(() => Date.now())
  const today = dayOf(now)
  const [view, setView] = useState<CalendarView>('month')
  const [cursor, setCursor] = useState(today)
  const [off, setOff] = useState<Group[]>([])
  const [addAt, setAddAt] = useState<AddAt | null>(null)
  const [sheet, setSheet] = useState<Sheet | null>(null)
  const [sheetError, setSheetError] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null)
  const [drag, setDrag] = useState<string | null>(null)
  const [over, setOver] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const closeAdd = useCallback(() => setAddAt(null), [])

  const month = cursor.slice(0, 7)
  const week = weekDays(cursor)
  const inRange = (day: string) => (view === 'week' ? week.includes(day) : day.startsWith(month))
  const listOf = (kind: ListKind) => catalog[kind] as unknown as Item[]

  const entries = collect(catalog, tournaments, league, hidden)
  const ranged = entries.filter((e) => inRange(e.day))
  const shown = ranged.filter((e) => !off.includes(e.group))
  const byDay = new Map<string, Entry[]>()
  for (const e of shown) byDay.set(e.day, [...(byDay.get(e.day) ?? []), e])

  const dated = catalog.campaigns.filter((c) => c.startsAt || c.endsAt)
  const liveOn = (day: string) => {
    if (off.includes('campaigns')) return 0
    const from = Date.parse(`${day}T00:00:00+03:00`)
    const to = from + 86_400_000
    return dated.filter((c) => (!c.startsAt || Date.parse(c.startsAt) < to) && (!c.endsAt || Date.parse(c.endsAt) > from)).length
  }

  const shift = (by: number) => {
    setAddAt(null)
    setCursor(view === 'week' ? shiftDay(cursor, by * 7) : shiftMonth(cursor, by))
  }

  const openNew = (kind: ListKind, day: string) => {
    setAddAt(null)
    setSheetError(null)
    setSheet({ kind, isNew: true, item: { ...blankOn(kind, blank(kind), day, now), id: `${kind}-${Date.now().toString(36)}` } })
  }

  const openEntry = (entry: Entry) => {
    if (entry.jump) return onJump(entry.jump)
    if (!entry.open) return
    const { kind, id } = entry.open
    const item = listOf(kind).find((x) => String(x.id) === id)
    if (!item) return setNotice({ ok: false, text: 'Kayıt bulunamadı. Sayfayı yenileyip yeniden dene.' })
    setSheetError(null)
    setSheet({ kind, isNew: false, item: { ...item } })
  }

  const saveSheet = () => {
    if (!sheet) return
    const { kind, item, isNew } = sheet
    const list = listOf(kind)
    const next = isNew ? [item, ...list] : list.map((x) => (String(x.id) === String(item.id) ? item : x))
    start(async () => {
      const r = await saveCatalogList(kind, next)
      if (!r.ok) return setSheetError(r.error)
      onSaved(kind, next)
      setSheet(null)
      setNotice({ ok: true, text: `${nameOf(kind, item)}: ${isNew ? 'eklendi' : 'kaydedildi'}, sitede hemen geçerli.` })
    })
  }

  const removeSheet = () => {
    if (!sheet || sheet.isNew) return
    const { kind, item } = sheet
    const name = nameOf(kind, item)
    void askConfirm(`"${name}" silinsin mi? Sitede hemen kalkar, geri alınamaz.`).then((ok) => {
      if (!ok) return
      const next = listOf(kind).filter((x) => String(x.id) !== String(item.id))
      start(async () => {
        const r = await saveCatalogList(kind, next)
        if (!r.ok) return setSheetError(r.error)
        onSaved(kind, next)
        setSheet(null)
        setNotice({ ok: true, text: `${name}: silindi.` })
      })
    })
  }

  const drop = (day: string) => {
    const entry = entries.find((e) => e.key === drag)
    setDrag(null)
    setOver(null)
    if (!entry?.open || entry.day === day) return
    const { kind, id, field } = entry.open
    const moved = moveDate(listOf(kind), id, field, day)
    if (!moved.ok) return setNotice({ ok: false, text: moved.error })
    const warning = Date.parse(moved.iso) <= now ? pastWarning(kind, field) : ''
    const what = `${PREFIX[entry.type]}: ${entry.label}`
    void askConfirm(`${what}. ${dayLabel(entry.day)} ${entry.time} yerine ${dayLabel(day)} ${entry.time} olsun mu? Kaydedilir ve sitede hemen geçerli olur.${warning ? ` ${warning}` : ''}`).then((ok) => {
      if (!ok) return
      start(async () => {
        const r = await saveCatalogList(kind, moved.next)
        if (!r.ok) return setNotice({ ok: false, text: r.error })
        onSaved(kind, moved.next)
        setNotice({ ok: true, text: `${what}: ${dayLabel(day)} ${entry.time} olarak kaydedildi.` })
      })
    })
  }

  const dropZone = (day: string) => ({
    onDragOver: (event: DragEvent<HTMLElement>) => {
      if (!drag) return
      event.preventDefault()
      event.dataTransfer.dropEffect = 'move'
      if (over !== day) setOver(day)
    },
    onDrop: (event: DragEvent<HTMLElement>) => {
      event.preventDefault()
      drop(day)
    },
  })

  const chip = (entry: Entry, mode: 'cell' | 'wide') => (
    <Chip
      key={entry.key}
      entry={entry}
      wide={mode === 'wide'}
      lifted={drag === entry.key}
      onOpen={() => openEntry(entry)}
      drag={
        mode === 'cell' && entry.open && !pending
          ? {
              onStart: (event) => {
                event.dataTransfer.setData('text/plain', entry.key)
                event.dataTransfer.effectAllowed = 'move'
                setAddAt(null)
                setDrag(entry.key)
              },
              onEnd: () => {
                setDrag(null)
                setOver(null)
              },
            }
          : undefined
      }
    />
  )

  const addToggle = (day: string, where: AddAt['where'], label: ReactNode) => {
    const open = addAt?.day === day && addAt.where === where
    return (
      <button
        type="button"
        data-add-toggle
        aria-expanded={open}
        aria-label={`${dayLabel(day)}${day === today ? ' (bugün)' : ''} gününe kayıt ekle`}
        onClick={() => setAddAt(open ? null : { day, where })}
        className={cn('flex h-6 shrink-0 items-center gap-1 rounded-md px-1 text-xs font-bold tabular-nums hover:bg-secondary', day === today ? 'text-primary' : 'text-foreground')}
      >
        <span className="whitespace-nowrap">{label}</span>
        <Plus className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      </button>
    )
  }

  const addMenu = (day: string, where: AddAt['where'], align: 'start' | 'end') =>
    addAt?.day === day && addAt.where === where ? (
      <AddMenu
        day={day}
        align={align}
        league={league !== null}
        onClose={closeAdd}
        onPick={(kind) => openNew(kind, day)}
        onLeague={() => {
          setAddAt(null)
          onJump('league')
        }}
      />
    ) : null

  const cellTone = (day: string) => cn('relative rounded-lg border border-border bg-background', day === today && 'border-primary', over === day && 'border-primary bg-primary/10')
  const headDay = inRange(today) ? today : view === 'week' ? week[0] : `${month}-01`

  const dayList = (
    <div className="flex flex-col gap-3">
      {byDay.size === 0 && <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">Bu aralıkta tarihli kayıt yok. Sağ üstteki Ekle düğmesiyle yeni kayıt açabilirsin.</p>}
      {[...byDay.entries()].map(([day, list]) => (
        <div key={day} className="relative flex flex-col gap-1.5">
          <div className="flex">{addToggle(day, 'list', `${dayLabel(day)}${day === today ? ' · bugün' : ''}`)}</div>
          {list.map((e) => chip(e, 'wide'))}
          {addMenu(day, 'list', 'start')}
        </div>
      ))}
    </div>
  )

  const ended = entries.filter((e) => (e.type === 'end' || e.type === 'match') && e.at <= now).reverse()
  const undated = [
    { label: 'Etkinlik', n: catalog.events.filter((e) => !e.endsAt).length, why: 'bitiş tarihi boş, sitede geri sayım görünmez' },
    { label: 'Kampanya', n: catalog.campaigns.length - dated.length, why: 'başlangıç ve bitiş boş, hep yayında' },
    { label: 'Tahmin', n: catalog.predictions.filter((p) => !p.kickoffAt).length, why: 'maç tarihi boş' },
    { label: 'Bonus', n: catalog.bonuses.length, why: 'bonuslarda tarih yok' },
  ].filter((x) => x.n > 0)

  const sheetName = sheet ? nameOf(sheet.kind, sheet.item) : ''

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 max-w-xl flex-col gap-0.5">
          <h3 className="text-sm font-semibold text-foreground">Takvim</h3>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Etkinlik, kampanya, maç ve turnuva tarihleri, İstanbul saatiyle. Bir güne basıp kayıt ekle, bir kayda basıp yandan düzenle ya da sil. Tarihi değiştirmek için kaydı başka güne sürükle; dokunmatik ekranda kaydı açıp tarihini yaz.
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => shift(-1)} aria-label={view === 'week' ? 'Önceki hafta' : 'Önceki ay'} className="flex size-9 items-center justify-center rounded-lg border border-border text-foreground hover:bg-secondary">
            <ChevronLeft className="size-4" aria-hidden="true" />
          </button>
          <p aria-live="polite" className="min-w-36 text-center text-sm font-semibold text-foreground">
            {rangeLabel(view, cursor)}
          </p>
          <button type="button" onClick={() => shift(1)} aria-label={view === 'week' ? 'Sonraki hafta' : 'Sonraki ay'} className="flex size-9 items-center justify-center rounded-lg border border-border text-foreground hover:bg-secondary">
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>
          {!inRange(today) && (
            <button type="button" onClick={() => setCursor(today)} className="ml-1 h-9 rounded-lg border border-border px-3 text-xs font-semibold text-foreground hover:bg-secondary">
              Bugün
            </button>
          )}
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <div role="group" aria-label="Takvim görünümü" className="flex gap-1 rounded-lg border border-border bg-background p-1">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              aria-pressed={view === v.id}
              onClick={() => {
                setAddAt(null)
                setView(v.id)
              }}
              className={cn('h-8 rounded-md px-3 text-xs font-bold', view === v.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
            >
              {v.label}
            </button>
          ))}
        </div>
        <div role="group" aria-label="Gösterilen kayıt türleri" className="order-last flex w-full flex-wrap gap-1.5 sm:order-none sm:w-auto sm:min-w-0 sm:flex-1">
          {GROUPS.map((g) => {
            const on = !off.includes(g.id)
            return (
              <button
                key={g.id}
                type="button"
                aria-pressed={on}
                onClick={() => setOff((list) => (on ? [...list, g.id] : list.filter((x) => x !== g.id)))}
                className={cn('flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold', on ? 'border-border bg-background text-foreground' : 'border-dashed border-border text-muted-foreground')}
              >
                <span className={cn('size-2 shrink-0 rounded-full', on ? SWATCH[g.id] : 'bg-border')} aria-hidden="true" />
                <span className={cn(!on && 'line-through')}>{g.label}</span>
                <span className="tabular-nums text-muted-foreground">{ranged.filter((e) => e.group === g.id).length}</span>
              </button>
            )
          })}
        </div>
        <div className="relative ml-auto">
          <button
            type="button"
            data-add-toggle
            aria-expanded={addAt?.where === 'head'}
            onClick={() => setAddAt(addAt?.where === 'head' ? null : { day: headDay, where: 'head' })}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground"
          >
            <Plus className="size-3.5" aria-hidden="true" />
            Ekle
          </button>
          {addMenu(headDay, 'head', 'end')}
        </div>
      </div>

      {(notice || pending) && (
        <p role="status" className={cn('flex items-center gap-2 rounded-lg border px-3 py-2 text-xs', !notice || notice.ok ? 'border-border text-foreground' : 'border-destructive/40 bg-destructive/10 text-foreground')}>
          {pending && <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden="true" />}
          {pending ? 'Kaydediliyor...' : notice?.text}
        </p>
      )}

      {view === 'month' && (
        <>
          <table className="hidden w-full table-fixed border-separate border-spacing-1 md:table">
            <caption className="sr-only">{`${rangeLabel('month', cursor)} içerik takvimi`}</caption>
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
              {monthWeeks(month).map((row, w) => (
                <tr key={w}>
                  {row.map((day, i) => {
                    if (!day) return <td key={i} className="rounded-lg bg-background/40" />
                    const list = byDay.get(day) ?? []
                    const live = liveOn(day)
                    return (
                      <td
                        key={day}
                        {...dropZone(day)}
                        onClick={(event) => {
                          if (event.target === event.currentTarget) setAddAt({ day, where: 'grid' })
                        }}
                        className={cn(cellTone(day), 'h-28 p-1.5 align-top')}
                      >
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center justify-between gap-1">
                            {addToggle(day, 'grid', String(Number(day.slice(8))))}
                            {live > 0 && <span className="hidden min-w-0 truncate text-xs text-muted-foreground xl:inline" title={`${live} tarihli kampanya yayında`}>{`${live} yayında`}</span>}
                          </div>
                          {list.slice(0, 3).map((e) => chip(e, 'cell'))}
                          {list.length > 3 && (
                            <button
                              type="button"
                              onClick={() => {
                                setCursor(day)
                                setView('week')
                              }}
                              className="rounded-md px-1 py-0.5 text-left text-xs font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground"
                            >
                              {`+${list.length - 3} kayıt daha`}
                            </button>
                          )}
                        </div>
                        {addMenu(day, 'grid', i >= 5 ? 'end' : 'start')}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {byDay.size === 0 && <p className="hidden text-sm text-muted-foreground md:block">Bu ay tarihli kayıt yok. Bir güne basıp ekleyebilirsin.</p>}
          <div className="md:hidden">{dayList}</div>
        </>
      )}

      {view === 'week' && (
        <div className="grid gap-2 md:grid-cols-7">
          {week.map((day, i) => {
            const list = byDay.get(day) ?? []
            return (
              <div
                key={day}
                {...dropZone(day)}
                onClick={(event) => {
                  if (event.target === event.currentTarget) setAddAt({ day, where: 'grid' })
                }}
                className={cn(cellTone(day), 'flex min-w-0 flex-col gap-1 p-1.5 md:min-h-64')}
              >
                <div className="flex">{addToggle(day, 'grid', `${WEEKDAYS[i]} ${Number(day.slice(8))}`)}</div>
                {list.map((e) => chip(e, 'cell'))}
                {list.length === 0 && <span className="px-1 text-xs text-muted-foreground">Kayıt yok</span>}
                {addMenu(day, 'grid', i >= 5 ? 'end' : 'start')}
              </div>
            )
          })}
        </div>
      )}

      {view === 'list' && dayList}

      <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground" aria-label="Takvimdeki kayıt türleri">
        {(Object.keys(PREFIX) as EntryType[])
          .filter((type) => type !== 'league' || league !== null)
          .map((type) => (
            <li key={type} className="flex items-center gap-1.5">
              <span className={cn('size-3 shrink-0 rounded-sm border', TONE[type])} aria-hidden="true" />
              {LEGEND[type]}
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
                    {chip(e, 'wide')}
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

      {sheet && (
        <SideSheet
          title={sheet.isNew ? `Yeni ${NOUN[sheet.kind]}` : sheetName}
          eyebrow={sheet.isNew ? 'Takvimden ekle' : `Takvim · ${NOUN[sheet.kind]}`}
          size="lg"
          onClose={() => setSheet(null)}
          footer={
            <>
              <button type="button" onClick={saveSheet} disabled={pending} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60">
                {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />}
                {sheet.isNew ? 'Ekle ve kaydet' : 'Kaydet'}
              </button>
              {!sheet.isNew && (
                <button type="button" onClick={removeSheet} disabled={pending} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm text-destructive hover:bg-destructive/10 disabled:opacity-60">
                  <Trash2 className="size-4" aria-hidden="true" />
                  Sil
                </button>
              )}
              {sheetError && (
                <p role="alert" className="w-full text-sm text-destructive">
                  {sheetError}
                </p>
              )}
            </>
          }
        >
          <div data-no-guard className="flex flex-col gap-4">
            {renderFields(sheet.kind, sheet.item, (patch) => setSheet((s) => (s ? { ...s, item: { ...s.item, ...patch } } : s)))}
            {!sheet.isNew && (
              <button
                type="button"
                onClick={() => {
                  const { kind, item } = sheet
                  setSheet(null)
                  onOpen(kind, String(item.id))
                }}
                className="self-start rounded-lg border border-border px-3 py-2 text-xs font-semibold text-foreground hover:bg-secondary"
              >
                {sheet.kind === 'events' ? 'Listede aç: sıralama ve katılımcılar' : sheet.kind === 'predictions' ? 'Listede aç: tahmin yapanlar' : 'Listede aç: link ve gizleme'}
              </button>
            )}
          </div>
        </SideSheet>
      )}
    </section>
  )
}
