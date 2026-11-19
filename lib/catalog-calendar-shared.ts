import type { Catalog } from '@/lib/catalog-shared'
import type { HiddenMap } from '@/lib/hidden-shared'
import { STATUS_LABEL, type TournamentStatus } from '@/lib/tournaments-shared'

export type CalendarTournament = { id: number; title: string; startsAt: string; endsAt: string | null; finishedAt: string | null; status: TournamentStatus }
export type CalendarLeagueMatch = { id: number; home: string; away: string; kickoff: string; settled: boolean }
export type CalendarLists = Pick<Catalog, 'events' | 'predictions' | 'campaigns'>

/** The three lists the calendar can add to, edit and delete from. Tournaments and league matches have their own screens. */
export type ListKind = 'events' | 'predictions' | 'campaigns'
export type Group = 'events' | 'campaigns' | 'predictions' | 'tournaments'
export type EntryType = 'start' | 'end' | 'match' | 'league' | 'tournament' | 'cupEnd'
export type DateField = 'startsAt' | 'endsAt' | 'kickoffAt'
export type CalendarView = 'month' | 'week' | 'list'
export type Item = Record<string, unknown>

export type Entry = {
  key: string
  day: string
  time: string
  at: number
  type: EntryType
  group: Group
  label: string
  note?: string
  /** Set on records the calendar edits itself; `field` is the date this entry stands for. */
  open?: { kind: ListKind; id: string; field: DateField }
  href?: string
  jump?: 'league'
}

const TR_OFFSET = 3 * 3_600_000
const DAY = 86_400_000
export const WEEKDAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']
export const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']
export const PREFIX: Record<EntryType, string> = { start: 'Başlar', end: 'Biter', match: 'Maç', league: 'Lig maçı', tournament: 'Turnuva', cupEnd: 'Turnuva biter' }
export const GROUPS: { id: Group; label: string }[] = [
  { id: 'events', label: 'Etkinlik' },
  { id: 'campaigns', label: 'Kampanya' },
  { id: 'predictions', label: 'Tahmin' },
  { id: 'tournaments', label: 'Turnuva' },
]

/** Calendar days are Istanbul days (UTC+3, no DST), the same clock the date fields use. */
export const trStamp = (ms: number) => new Date(ms + TR_OFFSET).toISOString()
export const dayOf = (ms: number) => trStamp(ms).slice(0, 10)
export const toTrIso = (ms: number) => `${trStamp(ms).slice(0, 16)}:00+03:00`
export const pad = (n: number) => String(n).padStart(2, '0')
export const dayLabel = (day: string) => `${Number(day.slice(8, 10))} ${MONTHS[Number(day.slice(5, 7)) - 1]}`

const utc = (day: string) => Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)))
const plain = (ms: number) => new Date(ms).toISOString().slice(0, 10)

export const shiftDay = (day: string, by: number) => plain(utc(day) + by * DAY)

/** First day of the month `by` months away. */
export function shiftMonth(day: string, by: number) {
  const d = new Date(Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1 + by, 1))
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-01`
}

/** Monday to Sunday of the week `day` falls in. */
export function weekDays(day: string) {
  const at = utc(day)
  const monday = at - ((new Date(at).getUTCDay() + 6) % 7) * DAY
  return Array.from({ length: 7 }, (_, i) => plain(monday + i * DAY))
}

/** Weeks of a month as rows of seven; days outside the month are null. */
export function monthWeeks(month: string) {
  const year = Number(month.slice(0, 4))
  const monthNo = Number(month.slice(5, 7))
  const daysInMonth = new Date(Date.UTC(year, monthNo, 0)).getUTCDate()
  const lead = (new Date(Date.UTC(year, monthNo - 1, 1)).getUTCDay() + 6) % 7
  const cells: (string | null)[] = [...Array.from({ length: lead }, () => null), ...Array.from({ length: daysInMonth }, (_, i) => `${month}-${pad(i + 1)}`)]
  while (cells.length % 7) cells.push(null)
  return Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7))
}

export function rangeLabel(view: CalendarView, cursor: string) {
  if (view !== 'week') return `${MONTHS[Number(cursor.slice(5, 7)) - 1]} ${cursor.slice(0, 4)}`
  const days = weekDays(cursor)
  const [first, last] = [days[0], days[6]]
  const head = first.slice(0, 7) === last.slice(0, 7) ? String(Number(first.slice(8))) : dayLabel(first)
  return `${head} - ${dayLabel(last)} ${last.slice(0, 4)}`
}

export function collect(lists: CalendarLists, tournaments: CalendarTournament[], league: CalendarLeagueMatch[] | null, hidden: HiddenMap): Entry[] {
  const out: Entry[] = []
  const push = (iso: string | undefined, entry: Omit<Entry, 'day' | 'time' | 'at'>) => {
    const at = Date.parse(iso ?? '')
    if (!Number.isFinite(at)) return
    const stamp = trStamp(at)
    out.push({ ...entry, at, day: stamp.slice(0, 10), time: stamp.slice(11, 16) })
  }
  for (const e of lists.events) {
    const note = hidden.event?.includes(e.id) ? 'gizli' : undefined
    const pays = (e.rank ?? 'none') === 'none' ? undefined : 'ödül dağıtılır'
    push(e.startsAt, { key: `es-${e.id}`, type: 'start', group: 'events', label: e.title, note, open: { kind: 'events', id: e.id, field: 'startsAt' } })
    push(e.endsAt, { key: `ee-${e.id}`, type: 'end', group: 'events', label: e.title, note: [note, pays].filter(Boolean).join(', ') || undefined, open: { kind: 'events', id: e.id, field: 'endsAt' } })
  }
  for (const c of lists.campaigns) {
    const note = hidden.campaign?.includes(c.id) ? 'gizli' : undefined
    push(c.startsAt, { key: `cs-${c.id}`, type: 'start', group: 'campaigns', label: c.title, note, open: { kind: 'campaigns', id: c.id, field: 'startsAt' } })
    push(c.endsAt, { key: `ce-${c.id}`, type: 'end', group: 'campaigns', label: c.title, note, open: { kind: 'campaigns', id: c.id, field: 'endsAt' } })
  }
  for (const p of lists.predictions) {
    push(p.kickoffAt, {
      key: `p-${p.id}`,
      type: 'match',
      group: 'predictions',
      label: `${p.home} - ${p.away}`,
      note: hidden.prediction?.includes(p.id) ? 'gizli' : undefined,
      open: { kind: 'predictions', id: p.id, field: 'kickoffAt' },
    })
  }
  for (const m of league ?? []) {
    push(m.kickoff, { key: `l-${m.id}`, type: 'league', group: 'predictions', label: `${m.home} - ${m.away}`, note: m.settled ? 'sonuçlandı' : undefined, jump: 'league' })
  }
  for (const t of tournaments) {
    const href = `/panel?b=tournaments&f=tournament-${t.id}`
    push(t.startsAt, { key: `t-${t.id}`, type: 'tournament', group: 'tournaments', label: t.title, note: t.status === 'kayit' ? undefined : STATUS_LABEL[t.status].toLocaleLowerCase('tr'), href })
    // A cancelled tournament has no end to plan around; a finished one is shown at the moment it really closed.
    if (t.status === 'iptal') continue
    const closed = t.status === 'bitti'
    push(closed ? (t.finishedAt ?? t.endsAt ?? undefined) : (t.endsAt ?? undefined), { key: `te-${t.id}`, type: 'cupEnd', group: 'tournaments', label: t.title, note: closed ? 'kapandı' : undefined, href })
  }
  return out.sort((a, b) => a.at - b.at)
}

export type Moved = { ok: true; next: Item[]; iso: string } | { ok: false; error: string }

/**
 * Moves one date of a record to another day and keeps its time of day. A start may not pass its
 * end (or the other way round); a match takes its own closing time along by the same distance.
 */
export function moveDate(list: Item[], id: string, field: DateField, day: string): Moved {
  const item = list.find((x) => String(x.id) === id)
  const old = Date.parse(String(item?.[field] ?? ''))
  if (!item || !Number.isFinite(old)) return { ok: false, error: 'Kayıt bulunamadı. Sayfayı yenileyip yeniden dene.' }
  const iso = `${day}T${trStamp(old).slice(11, 16)}:00+03:00`
  const at = Date.parse(iso)
  if (!Number.isFinite(at)) return { ok: false, error: 'Geçersiz tarih.' }
  const patch: Item = { [field]: iso }
  if (field === 'startsAt') {
    const end = Date.parse(String(item.endsAt ?? ''))
    if (Number.isFinite(end) && at >= end) return { ok: false, error: 'Başlangıç, bitiş tarihinden sonraya taşınamaz. Önce bitişi ileri al ya da kaydı açıp iki tarihi birlikte değiştir.' }
  }
  if (field === 'endsAt') {
    const begin = Date.parse(String(item.startsAt ?? ''))
    if (Number.isFinite(begin) && at <= begin) return { ok: false, error: 'Bitiş, başlangıç tarihinden önceye taşınamaz. Önce başlangıcı geri al ya da kaydı açıp iki tarihi birlikte değiştir.' }
  }
  if (field === 'kickoffAt') {
    const closes = Date.parse(String(item.closesAt ?? ''))
    if (Number.isFinite(closes)) patch.closesAt = toTrIso(closes + (at - old))
  }
  return { ok: true, iso, next: list.map((x) => (x === item ? { ...x, ...patch } : x)) }
}

/** A fresh record whose dates sit on the clicked day; `base` is the list's usual blank record. */
export function blankOn(kind: ListKind, base: Item, day: string, now: number): Item {
  if (kind === 'predictions') {
    const evening = Date.parse(`${day}T20:00:00+03:00`)
    return { ...base, kickoffAt: toTrIso(evening > now ? evening : now + 2 * 3_600_000), closesAt: '' }
  }
  const start = dayOf(now) === day ? now : Date.parse(`${day}T12:00:00+03:00`)
  const from = Date.parse(String(base.startsAt ?? ''))
  const to = Date.parse(String(base.endsAt ?? ''))
  const span = Number.isFinite(from) && Number.isFinite(to) && to > from ? to - from : 7 * DAY
  return { ...base, startsAt: toTrIso(start), endsAt: toTrIso(start + span) }
}

/** What moving a date into the past sets off on the site, spelled out before the move is saved. */
export function pastWarning(kind: ListKind, field: DateField) {
  if (field === 'endsAt') return kind === 'events' ? 'Bu tarih geçmişte: etkinlik hemen biter; sıralama türü seçiliyse ödüller dağıtılır.' : 'Bu tarih geçmişte: kampanya yayından düşer.'
  if (field === 'kickoffAt') return 'Bu tarih geçmişte: maç tahmine kapanır.'
  return ''
}
