'use client'

import { useMemo, useState, useTransition } from 'react'
import { ArrowDown, ArrowUp, Check, ChevronDown, Copy, Download, Globe, Loader2, Pencil, Search, TriangleAlert } from 'lucide-react'
import { loadLinksAction, saveShortDomainAction, type LinkQuery } from '@/app/panel/link-actions'
import { Flash } from '@/components/panel/flash'
import { LINK_KINDS, LINK_RANGES, linkKindLabel, linksCsv, shortUrl, type LinkKind, type LinkReport, type LinkRow } from '@/lib/links-shared'
import { cn } from '@/lib/utils'

type SiteOption = { id: number; name: string }
type Props = {
  report: LinkReport
  sites: SiteOption[]
  siteUrl: string
  /** Where each kind of link is edited; null when this account cannot open that screen. */
  editHrefs: { sponsor: string; campaigns: string | null; earnings: string | null }
}
type Msg = { ok: boolean; message: string } | null
type SortKey = 'clicks' | 'uniques' | 'signups' | 'lastClick'

const input = 'rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none'
const btn = 'inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:opacity-50'
const ghost = 'inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-semibold text-foreground hover:bg-secondary disabled:opacity-50'
const chip = 'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors'

const WHEN = new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
const DAY = new Intl.DateTimeFormat('tr-TR', { timeZone: 'UTC', day: '2-digit', month: 'short', year: 'numeric' })
const num = (n: number) => n.toLocaleString('tr-TR')
const day = (iso: string) => DAY.format(new Date(`${iso}T00:00:00Z`))

function rangeId(report: LinkReport, today: string) {
  if (report.to !== today) return 'custom'
  const span = Math.round((Date.parse(`${report.to}T00:00:00Z`) - Date.parse(`${report.from}T00:00:00Z`)) / 86_400_000) + 1
  return LINK_RANGES.find((r) => r.days === span)?.id ?? 'custom'
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      className="inline-flex size-7 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value)
          setDone(true)
          setTimeout(() => setDone(false), 1500)
        } catch {
          setDone(false)
        }
      }}
    >
      {done ? <Check className="size-3.5 text-emerald" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
      <span className="sr-only" aria-live="polite">
        {done ? 'Kopyalandı' : label}
      </span>
    </button>
  )
}

function ShortDomainCard({ host, onSaved }: { host: string; onSaved: (host: string) => void }) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(host)
  const [msg, setMsg] = useState<Msg>(null)
  const [pending, start] = useTransition()

  const save = (next: string) =>
    start(async () => {
      const r = await saveShortDomainAction(next)
      setMsg({ ok: r.ok, message: r.message })
      if (r.ok) {
        setValue(r.host ?? '')
        onSaved(r.host ?? '')
      }
    })

  return (
    <section className="rounded-xl border border-border bg-card">
      <button
        type="button"
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
        aria-expanded={open}
        aria-controls="short-domain-body"
        onClick={() => setOpen((v) => !v)}
      >
        <Globe className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-sm font-semibold text-foreground">Kısa link alan adı</span>
          <span className="truncate text-xs text-muted-foreground">
            {host ? `${host} kayıtlı: kısa linkler bu adresle paylaşılır` : 'Ayarlı değil: linkler ana alan adından açılır'}
          </span>
        </span>
        <ChevronDown className={cn('size-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} aria-hidden="true" />
      </button>
      {open ? (
        <div id="short-domain-body" className="flex flex-col gap-3 border-t border-border px-4 py-4">
          <p className="text-sm leading-relaxed text-muted-foreground">
            Buraya yazdığın alan adından gelen istek sadece yönlendirme yapar, siteyi göstermez. Önce alan adını satın al, Vercel projesine ekle ve
            DNS kaydını gir; o adım sende. Alan adı projeye bağlanmadan buraya yazarsan kopyalanan linkler açılmaz.
          </p>
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              save(value)
            }}
          >
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs font-semibold text-muted-foreground">
              Alan adı
              <input
                className={cn(input, 'w-full font-mono')}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="alk.link"
                inputMode="url"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
            </label>
            <button type="submit" className={btn} disabled={pending || value.trim() === host}>
              {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Check className="size-4" aria-hidden="true" />}
              Kaydet
            </button>
            {host ? (
              <button type="button" className={cn(ghost, 'h-9')} disabled={pending} onClick={() => save('')}>
                Kaldır
              </button>
            ) : null}
          </form>
          <Flash ok={msg?.ok} text={msg?.message} token={msg} />
        </div>
      ) : null}
    </section>
  )
}

function SortHead({ id, label, sort, onSort, className }: { id: SortKey; label: string; sort: { key: SortKey; dir: 1 | -1 }; onSort: (key: SortKey) => void; className?: string }) {
  const active = sort.key === id
  return (
    <th scope="col" className={cn('px-3 py-2 text-right', className)} aria-sort={active ? (sort.dir === -1 ? 'descending' : 'ascending') : 'none'}>
      <button type="button" className={cn('inline-flex items-center gap-1 font-semibold', active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground')} onClick={() => onSort(id)}>
        {label}
        {active ? sort.dir === -1 ? <ArrowDown className="size-3" aria-hidden="true" /> : <ArrowUp className="size-3" aria-hidden="true" /> : null}
      </button>
    </th>
  )
}

function Row({ row, url, editHref }: { row: LinkRow; url: string; editHref: string | null }) {
  return (
    <tr className={cn('border-t border-border align-top', !row.active && 'opacity-60')} data-find={row.code}>
      <td className="px-3 py-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="min-w-0 break-words text-sm font-semibold text-foreground">{row.name}</span>
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">{linkKindLabel(row.kind)}</span>
            {row.active ? null : <span className="rounded-full border border-border px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">Kapalı</span>}
          </div>
          <div className="flex min-w-0 items-center gap-2">
            <span className="min-w-0 truncate font-mono text-xs text-muted-foreground">{url.replace(/^https?:\/\//, '')}</span>
            <CopyButton value={url} label={`${row.name} linkini kopyala`} />
          </div>
          <p className="break-all text-xs text-muted-foreground md:hidden">
            {row.siteName ? `${row.siteName} · ` : ''}
            {row.target ?? 'Sponsorun güncel giriş adresi'}
          </p>
          {row.note ? (
            <p className="flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              {row.note}
            </p>
          ) : null}
          {editHref ? (
            <a href={editHref} className="inline-flex items-center gap-1.5 self-start text-xs font-semibold text-primary underline-offset-4 hover:underline sm:hidden">
              <Pencil className="size-3.5" aria-hidden="true" />
              Düzenle
              <span className="sr-only">: {row.name}</span>
            </a>
          ) : null}
        </div>
      </td>
      <td className="hidden px-3 py-3 md:table-cell">
        <div className="flex flex-col gap-1">
          <span className="text-sm text-foreground">{row.siteName ?? 'Sponsorsuz'}</span>
          <span className="break-all text-xs text-muted-foreground">{row.target ?? 'Sponsorun güncel giriş adresi'}</span>
        </div>
      </td>
      <td className="hidden px-3 py-3 text-sm text-muted-foreground lg:table-cell">{row.source || 'Belirsiz'}</td>
      <td className="px-3 py-3 text-right text-sm font-semibold tabular-nums text-foreground">{num(row.clicks)}</td>
      <td className="hidden px-3 py-3 text-right text-sm tabular-nums text-foreground sm:table-cell">
        {num(row.uniques)}
        {row.uniqueBasis === 'uye' ? <span className="block text-[11px] text-muted-foreground">sadece üyeler</span> : null}
      </td>
      <td className="hidden px-3 py-3 text-right text-sm tabular-nums text-foreground sm:table-cell">
        {row.signups === null ? <span className="text-muted-foreground" title="Kayıt sadece kendi sayfamıza getiren linklerde ölçülür">Ölçülmez</span> : num(row.signups)}
      </td>
      <td className="hidden whitespace-nowrap px-3 py-3 text-right text-xs text-muted-foreground lg:table-cell">
        {row.lastClick ? WHEN.format(new Date(row.lastClick)) : 'Hiç tıklanmadı'}
      </td>
      <td className="hidden px-3 py-3 text-right sm:table-cell">
        {editHref ? (
          <a href={editHref} className={ghost}>
            <Pencil className="size-3.5" aria-hidden="true" />
            Düzenle
            <span className="sr-only">: {row.name}</span>
          </a>
        ) : null}
      </td>
    </tr>
  )
}

export function LinksTable({ report: initial, sites, siteUrl, editHrefs }: Props) {
  const [report, setReport] = useState(initial)
  const [kind, setKind] = useState<LinkKind | 'all'>('all')
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'clicks', dir: -1 })
  const [custom, setCustom] = useState({ from: initial.from, to: initial.to })
  const [msg, setMsg] = useState<Msg>(null)
  const [pending, start] = useTransition()
  // The first report is always "the last 30 days", so its end date is today in Istanbul.
  const [today] = useState(initial.to)

  const load = (query: LinkQuery) =>
    start(async () => {
      const r = await loadLinksAction(query)
      if (!r.ok) return setMsg({ ok: false, message: r.message })
      setMsg(null)
      setReport(r.report)
      setCustom({ from: r.report.from, to: r.report.to })
    })

  const activeRange = rangeId(report, today)
  const shown = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase('tr-TR')
    const list = report.rows.filter((r) => {
      if (kind !== 'all' && r.kind !== kind) return false
      if (!needle) return true
      return [r.name, r.code, r.target ?? '', r.siteName ?? '', r.source].some((v) => v.toLocaleLowerCase('tr-TR').includes(needle))
    })
    const value = (r: LinkRow) => (sort.key === 'lastClick' ? (r.lastClick ? Date.parse(r.lastClick) : 0) : (r[sort.key] ?? -1))
    return [...list].sort((a, b) => (value(a) - value(b)) * sort.dir || a.name.localeCompare(b.name, 'tr'))
  }, [report.rows, kind, q, sort])

  const perKind = useMemo(
    () => LINK_KINDS.map((k) => ({ ...k, rows: report.rows.filter((r) => r.kind === k.id) })).filter((k) => k.rows.length > 0),
    [report.rows],
  )
  const signups = report.rows.reduce((sum, r) => sum + (r.signups ?? 0), 0)
  const site = report.siteId === null ? null : sites.find((s) => s.id === report.siteId) ?? null

  const onSort = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: s.dir === -1 ? 1 : -1 } : { key, dir: -1 }))

  const download = () => {
    const blob = new Blob([linksCsv(shown, siteUrl, report.shortDomain)], { type: 'text/csv;charset=utf-8' })
    const href = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = href
    a.download = `alkanka-linkler-${report.from}_${report.to}.csv`
    a.click()
    URL.revokeObjectURL(href)
  }

  const editHref = (row: LinkRow) => (row.kind === 'sayfa' ? editHrefs.campaigns : row.kind === 'git' ? null : editHrefs.sponsor)

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h2 className="text-lg font-bold text-foreground">Linkler</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Sponsor linkleri, kampanya linkleri ve sitedeki Git düğmeleri tek listede. Rakamlar {day(report.from)} ile {day(report.to)} arasını gösterir;
          son tıklama tüm zamanlara bakar.
        </p>
      </header>

      <ShortDomainCard host={report.shortDomain} onSaved={(host) => setReport((r) => ({ ...r, shortDomain: host }))} />

      <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4" aria-label="Süzgeçler">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Tarih aralığı">
          {LINK_RANGES.map((r) => (
            <button
              key={r.id}
              type="button"
              aria-pressed={activeRange === r.id}
              disabled={pending}
              className={cn(chip, activeRange === r.id ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-foreground hover:bg-secondary')}
              onClick={() => load({ days: r.days, siteId: report.siteId })}
            >
              {r.label}
            </button>
          ))}
          {pending ? <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Yükleniyor" /> : null}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
            Başlangıç
            <input type="date" className={input} value={custom.from} max={custom.to} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
            Bitiş
            <input type="date" className={input} value={custom.to} min={custom.from} max={today} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} />
          </label>
          <button
            type="button"
            className={cn(ghost, 'h-9')}
            disabled={pending || !custom.from || !custom.to || (custom.from === report.from && custom.to === report.to)}
            onClick={() => load({ from: custom.from, to: custom.to, siteId: report.siteId })}
          >
            Tarihi uygula
          </button>
          <label className="flex min-w-40 flex-col gap-1 text-xs font-semibold text-muted-foreground">
            Sponsor
            <select
              className={input}
              value={report.siteId ?? ''}
              disabled={pending}
              onChange={(e) => load({ from: report.from, to: report.to, siteId: e.target.value ? Number(e.target.value) : null })}
            >
              <option value="">Tüm sponsorlar</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-w-48 flex-1 flex-col gap-1 text-xs font-semibold text-muted-foreground">
            Ara
            <span className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <input className={cn(input, 'w-full pl-9')} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ad, kod, hedef ya da kaynak" type="search" />
            </span>
          </label>
        </div>
        <Flash ok={msg?.ok} text={msg?.message} token={msg} />
      </section>

      {site ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-secondary px-4 py-3">
          <p className="min-w-0 flex-1 text-sm text-foreground">
            <span className="font-semibold">{site.name}</span>: {report.rows.length} link listeleniyor.
          </p>
          {editHrefs.earnings ? (
            <a href={editHrefs.earnings} className={ghost}>
              Hakedişe git
            </a>
          ) : null}
          <button type="button" className={ghost} disabled={pending} onClick={() => load({ from: report.from, to: report.to, siteId: null })}>
            Tüm sponsorlar
          </button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Link türü">
        <button
          type="button"
          aria-pressed={kind === 'all'}
          className={cn(chip, kind === 'all' ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-foreground hover:bg-secondary')}
          onClick={() => setKind('all')}
        >
          Hepsi <span className="tabular-nums opacity-80">{report.rows.length}</span>
        </button>
        {perKind.map((k) => (
          <button
            key={k.id}
            type="button"
            title={k.hint}
            aria-pressed={kind === k.id}
            className={cn(chip, kind === k.id ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-foreground hover:bg-secondary')}
            onClick={() => setKind(k.id)}
          >
            {k.label}
            <span className="tabular-nums opacity-80">
              {k.rows.length} link · {num(k.rows.reduce((sum, r) => sum + r.clicks, 0))} tıklama
            </span>
          </button>
        ))}
        <span className="flex-1" />
        <button type="button" className={ghost} disabled={shown.length === 0} onClick={download}>
          <Download className="size-3.5" aria-hidden="true" /> Excel
        </button>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Tıklamalar tür tür ayrı gösterilir, toplanmaz: sponsorun ana linki varsa Git düğmesi tıklaması o linkin satırında da sayılır.
        {signups > 0 ? ` Bu aralıkta kampanya linklerinden ${num(signups)} kayıt geldi.` : ''}
      </p>

      {shown.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          {report.rows.length === 0
            ? site
              ? 'Bu sponsora bağlı link yok.'
              : 'Henüz link yok. Sponsor linkini "Trafik & hesaplar" sekmesinden, kampanya linkini Pazarlama bölümünden eklersin.'
            : 'Bu süzgece uyan link yok.'}
        </p>
      ) : (
        <div className={cn('overflow-x-auto rounded-xl border border-border bg-card', pending && 'opacity-60')} aria-busy={pending}>
          <table className="w-full table-fixed border-collapse text-left">
            <caption className="sr-only">
              Kısa linkler: {day(report.from)} ile {day(report.to)} arası tıklama, tekil ziyaretçi ve kayıt sayıları
            </caption>
            <thead className="bg-secondary text-xs">
              <tr>
                <th scope="col" className="px-3 py-2 font-semibold text-muted-foreground">Link</th>
                <th scope="col" className="hidden w-52 px-3 py-2 font-semibold text-muted-foreground md:table-cell xl:w-56">Sponsor ve hedef</th>
                <th scope="col" className="hidden w-24 px-3 py-2 font-semibold text-muted-foreground lg:table-cell">Kaynak</th>
                <SortHead id="clicks" label="Tıklama" sort={sort} onSort={onSort} className="w-24" />
                <SortHead id="uniques" label="Tekil" sort={sort} onSort={onSort} className="hidden w-24 sm:table-cell" />
                <SortHead id="signups" label="Kayıt" sort={sort} onSort={onSort} className="hidden w-24 sm:table-cell" />
                <SortHead id="lastClick" label="Son tıklama" sort={sort} onSort={onSort} className="hidden w-36 lg:table-cell" />
                <th scope="col" className="hidden w-28 px-3 py-2 sm:table-cell">
                  <span className="sr-only">İşlem</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map((row) => (
                <Row key={row.key} row={row} url={shortUrl(row, siteUrl, report.shortDomain)} editHref={editHref(row)} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
