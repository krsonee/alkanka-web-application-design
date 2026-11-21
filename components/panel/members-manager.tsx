'use client'


import { askConfirm, confirmed, notify } from '@/components/panel/confirm-dialog'
import { useEffect, useState, useTransition } from 'react'
import { AlertTriangle, Ban, ChevronLeft, ChevronRight, Coins, Download, Link2Off, Lock, LogOut, NotebookPen, Search, ShieldCheck, Snowflake, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { parseAmount } from '@/lib/amount'
import {
  banAction,
  exportMembersAction,
  memberActivityAction,
  memberDetailAction,
  restoreAction,
  revokeSessionsAction,
  searchMembersAction,
  type MemberDetailFull,
  type MemberExtra,
  suspendAction,
  unlinkTelegramAction,
  walletAction,
} from '@/app/panel/members-actions'
import type { MemberRow, MemberStatus } from '@/lib/members-admin'
import { BULK_LIMIT } from '@/lib/members-bulk-shared'
import { MemberActivityTabs, type ActivityTab } from '@/components/panel/member-activity-tabs'
import { MemberLedger } from '@/components/panel/member-ledger'
import { BulkBar, type Picked } from '@/components/panel/member-bulk'
import { MemberNotes } from '@/components/panel/member-notes'

type Filter = MemberStatus | 'tumu'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'tumu', label: 'Tümü' },
  { id: 'aktif', label: 'Aktif' },
  { id: 'donduruldu', label: 'Geçici donduruldu' },
  { id: 'banli', label: 'Kalıcı banlı' },
  { id: 'supheli', label: 'Şüpheli hesap' },
]

const STATUS: Record<MemberStatus, { label: string; cls: string }> = {
  aktif: { label: 'Aktif', cls: 'bg-primary/15 text-primary' },
  donduruldu: { label: 'Donduruldu', cls: 'bg-secondary text-foreground' },
  banli: { label: 'Kalıcı banlı', cls: 'bg-destructive/15 text-destructive' },
  supheli: { label: 'Şüpheli', cls: 'bg-live/15 text-live' },
}

const input = 'rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary'
const date = (iso: string | null) => (iso ? new Date(iso).toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Istanbul' }) : '—')

const WALLET_LIMIT = 1_000_000

function walletAmount(raw: string): { value: number | null; problem: string | null } {
  const text = raw.trim()
  if (!text || text === '-') return { value: null, problem: null }
  const negative = text.startsWith('-')
  const n = parseAmount(negative ? text.slice(1) : text)
  if (n === null) return { value: null, problem: 'Tutar bir sayı olmalı. Örn. 500 ya da -200.' }
  if (!Number.isInteger(n)) return { value: null, problem: `Tutar tam sayı olmalı (yazdığın ${text}). Kanka Coin küsuratlı olmaz.` }
  if (n === 0) return { value: null, problem: 'Tutar sıfır olamaz.' }
  if (n > WALLET_LIMIT) return { value: null, problem: `Tek seferde en fazla ${WALLET_LIMIT.toLocaleString('tr-TR')} KC eklenebilir ya da düşülebilir.` }
  return { value: negative ? -n : n, problem: null }
}

const NO_EXTRA: MemberExtra = { sort: 'yeni', source: '', from: '', to: '', minBalance: null, maxBalance: null, telegram: '' }
const EXTRA_KEYS = ['sort', 'source', 'from', 'to', 'minBalance', 'maxBalance', 'telegram'] as const

function Avatar({ name, image }: { name: string; image: string | null }) {
  return image ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={image || '/placeholder.svg'} alt="" className="size-9 shrink-0 rounded-full object-cover" />
  ) : (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-bold text-foreground">{name.slice(0, 1).toLocaleUpperCase('tr')}</span>
  )
}

export function MembersManager({
  initial,
  counts: initialCounts,
  levels,
  canMessage,
}: {
  initial: MemberRow[]
  counts: Record<Filter, number>
  levels: Record<string, string>
  canMessage: boolean
}) {
  const [q, setQ] = useState('')
  const [picked, setPicked] = useState<Map<string, Picked>>(new Map())
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('q')
    if (fromUrl) setQ(fromUrl)
  }, [])
  const [filter, setFilter] = useState<Filter>('tumu')
  const [extra, setExtra] = useState<MemberExtra>(NO_EXTRA)
  const extraCount = EXTRA_KEYS.filter((k) => extra[k] !== NO_EXTRA[k] && extra[k] != null && extra[k] !== '').length
  const [list, setList] = useState(initial)
  const [counts, setCounts] = useState(initialCounts)
  const [openId, setOpenId] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(initialCounts.tumu ?? initial.length)
  const [pageSize, setPageSize] = useState(100)
  const [exporting, setExporting] = useState(false)
  const [loading, start] = useTransition()

  const load = (targetPage: number) =>
    start(async () => {
      const r = await searchMembersAction(q, filter, targetPage, extra)
      if (r) {
        setList(r.members)
        setCounts(r.counts)
        setTotal(r.total)
        setPage(r.page)
        setPageSize(r.pageSize)
      }
    })

  useEffect(() => {
    const t = setTimeout(() => load(0), 250)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, filter, extra])

  const refresh = () => load(page)

  const pageAllPicked = list.length > 0 && list.every((m) => picked.has(m.id))
  const tooMany = () => notify(false, `Tek seferde en fazla ${BULK_LIMIT} üye seçilebilir.`)

  const togglePick = (m: MemberRow) => {
    if (!picked.has(m.id) && picked.size >= BULK_LIMIT) return tooMany()
    const next = new Map(picked)
    if (!next.delete(m.id)) next.set(m.id, { id: m.id, name: m.name, status: m.status })
    setPicked(next)
  }

  const togglePage = () => {
    const next = new Map(picked)
    if (pageAllPicked) {
      for (const m of list) next.delete(m.id)
    } else {
      for (const m of list) {
        if (next.has(m.id)) continue
        if (next.size >= BULK_LIMIT) {
          tooMany()
          break
        }
        next.set(m.id, { id: m.id, name: m.name, status: m.status })
      }
    }
    setPicked(next)
  }

  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : page * pageSize + 1
  const to = Math.min(total, (page + 1) * pageSize)

  const exportCsv = async () => {
    setExporting(true)
    try {
      const r = await exportMembersAction(q, filter, extra)
      if (!r.ok) return notify(false, r.error)
      if (r.capped) notify(false, `Dosyaya ilk ${r.count.toLocaleString('tr-TR')} üye sığdı. Daha dar bir süzgeçle tekrar indir.`)
      const url = URL.createObjectURL(new Blob([r.csv], { type: 'text/csv;charset=utf-8' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `alkanka-uyeler-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="font-display text-xl font-bold text-foreground">Tüm üyeler</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Üye ara, hesabı dondur, banla ya da bakiyesini düzelt. Birden fazla üyeyi kutucukla seçip toplu mesaj, hediye ya da dondurma yapabilirsin. Her işlem İşlem Loglarına yazılır.
          </p>
        </div>
        <button
          type="button"
          onClick={exportCsv}
          disabled={exporting || total === 0}
          className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground hover:bg-secondary disabled:opacity-50"
        >
          <Download className="size-4" aria-hidden="true" />
          {exporting ? 'Hazırlanıyor…' : `CSV indir (${total})`}
        </button>
      </header>

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3">
        <label className="relative flex items-center">
          <span className="sr-only">Üye ara</span>
          <Search className="pointer-events-none absolute left-3 size-4 text-muted-foreground" aria-hidden="true" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Kullanıcı adı, e-posta, telefon ya da Telegram ID…" className={cn(input, 'w-full pl-9')} />
        </label>
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Durum filtresi">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              role="tab"
              aria-selected={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-semibold',
                filter === f.id ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:text-foreground',
              )}
            >
              {f.label} ({counts[f.id] ?? 0})
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-3 border-t border-border pt-3">
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            Sıralama
            <select value={extra.sort ?? 'yeni'} onChange={(e) => setExtra({ ...extra, sort: e.target.value as MemberExtra['sort'] })} className={input}>
              <option value="yeni">En yeni kayıt</option>
              <option value="eski">En eski kayıt</option>
              <option value="bakiye">En yüksek bakiye</option>
              <option value="puan">En yüksek puan</option>
              <option value="son">Son görülen</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            Kayıt kaynağı
            <input value={extra.source ?? ''} onChange={(e) => setExtra({ ...extra, source: e.target.value })} placeholder="örn. telegram" className={cn(input, 'w-36')} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            Kayıt tarihi (ilk)
            <input type="date" value={extra.from ?? ''} max={extra.to || undefined} onChange={(e) => setExtra({ ...extra, from: e.target.value })} className={input} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            Kayıt tarihi (son)
            <input type="date" value={extra.to ?? ''} min={extra.from || undefined} onChange={(e) => setExtra({ ...extra, to: e.target.value })} className={input} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            En az bakiye (KC)
            <input
              inputMode="numeric"
              value={extra.minBalance ?? ''}
              onChange={(e) => setExtra({ ...extra, minBalance: e.target.value.replace(/\D/g, '') === '' ? null : Number(e.target.value.replace(/\D/g, '')) })}
              className={cn(input, 'w-28')}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            En çok bakiye (KC)
            <input
              inputMode="numeric"
              value={extra.maxBalance ?? ''}
              onChange={(e) => setExtra({ ...extra, maxBalance: e.target.value.replace(/\D/g, '') === '' ? null : Number(e.target.value.replace(/\D/g, '')) })}
              className={cn(input, 'w-28')}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            Telegram
            <select value={extra.telegram ?? ''} onChange={(e) => setExtra({ ...extra, telegram: e.target.value as MemberExtra['telegram'] })} className={input}>
              <option value="">Fark etmez</option>
              <option value="var">Bağlı</option>
              <option value="yok">Bağlı değil</option>
            </select>
          </label>
          {(extraCount > 0 || q) && (
            <button
              type="button"
              onClick={() => {
                setExtra(NO_EXTRA)
                setQ('')
              }}
              className="h-9 rounded-lg border border-border px-3 text-sm text-foreground hover:bg-secondary"
            >
              Süzgeçleri temizle
            </button>
          )}
        </div>
      </div>

      <div className={cn('overflow-x-auto rounded-xl border border-border bg-card', loading && 'opacity-70')}>
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="w-10 py-3 pl-4">
                <input
                  type="checkbox"
                  checked={pageAllPicked}
                  onChange={togglePage}
                  disabled={list.length === 0}
                  aria-label="Bu sayfadaki üyelerin hepsini seç"
                  className="size-4 accent-primary"
                />
              </th>
              <th className="px-4 py-3 font-semibold">Üye</th>
              <th className="px-4 py-3 font-semibold">Rozet seviyesi</th>
              <th className="px-4 py-3 font-semibold">Bakiye</th>
              <th className="px-4 py-3 font-semibold">Kayıt</th>
              <th className="px-4 py-3 font-semibold">Durum</th>
              <th className="px-4 py-3 font-semibold">
                <span className="sr-only">Aksiyonlar</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {list.map((m) => (
              <tr
                key={m.id}
                onClick={() => setOpenId(m.id)}
                className={cn('cursor-pointer border-b border-border last:border-0 hover:bg-secondary/50', picked.has(m.id) && 'bg-primary/5')}
              >
                <td className="w-10 py-3 pl-4" onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" checked={picked.has(m.id)} onChange={() => togglePick(m)} aria-label={`${m.name} seç`} className="size-4 accent-primary" />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={m.name} image={m.image} />
                    <div className="flex min-w-0 flex-col">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate font-medium text-foreground">{m.name}</span>
                        {m.notes > 0 && (
                          <span className="flex shrink-0 items-center gap-1 rounded-full bg-secondary px-1.5 py-0.5 text-xs font-semibold text-foreground" title={`${m.notes} personel notu`}>
                            <NotebookPen className="size-3" aria-hidden="true" />
                            {m.notes}
                            <span className="sr-only">personel notu</span>
                          </span>
                        )}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">{m.email}</span>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-foreground">{levels[m.id] ?? 'Çaylak'}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-col">
                    <span className="whitespace-nowrap font-semibold text-foreground">{m.balance.toLocaleString('tr-TR')} KC</span>
                    <span className="text-xs text-muted-foreground">{m.points.toLocaleString('tr-TR')} puan</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col">
                    <span className="text-foreground">{new Date(m.createdAt).toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul' })}</span>
                    <span className="text-xs text-muted-foreground">{m.source ?? 'Doğrudan'}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={cn('rounded-full px-2 py-1 text-xs font-semibold', STATUS[m.status].cls)}>{STATUS[m.status].label}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setOpenId(m.id)
                    }}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary"
                  >
                    Yönet
                  </button>
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  Bu filtreyle eşleşen üye yok.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <nav aria-label="Üye sayfaları" className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <span className="tabular-nums">{`${from}–${to} / ${total} üye`}</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => load(page - 1)}
            disabled={page === 0 || loading}
            className="flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-1.5 font-semibold text-foreground hover:bg-secondary disabled:opacity-40"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
            Önceki
          </button>
          <span className="tabular-nums">{`Sayfa ${page + 1} / ${pageCount}`}</span>
          <button
            type="button"
            onClick={() => load(page + 1)}
            disabled={page + 1 >= pageCount || loading}
            className="flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-1.5 font-semibold text-foreground hover:bg-secondary disabled:opacity-40"
          >
            Sonraki
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>
        </div>
      </nav>

      <BulkBar
        picked={[...picked.values()]}
        canMessage={canMessage}
        onClear={() => setPicked(new Map())}
        onDone={() => {
          setPicked(new Map())
          refresh()
        }}
      />

      {openId && <MemberDrawer key={openId} id={openId} level={levels[openId] ?? 'Çaylak'} onClose={() => setOpenId(null)} onChanged={refresh} />}
    </section>
  )
}

function MemberDrawer({ id, level, onClose, onChanged }: { id: string; level: string; onClose: () => void; onChanged: () => void }) {
  const [m, setM] = useState<MemberDetailFull | null | undefined>(undefined)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, start] = useTransition()
  const [duration, setDuration] = useState('7')
  const [suspendReason, setSuspendReason] = useState('')
  const [banReason, setBanReason] = useState('')
  const [ipBlock, setIpBlock] = useState(false)
  const [amount, setAmount] = useState('')
  const [walletReason, setWalletReason] = useState('')
  const wallet = walletAmount(amount)

  const [tab, setTab] = useState<'genel' | 'coin' | ActivityTab>('genel')
  const [act, setAct] = useState<Awaited<ReturnType<typeof memberActivityAction>> | undefined>(undefined)

  const load = () =>
    Promise.all([memberDetailAction(id).then(setM), memberActivityAction(id).then(setAct).catch(() => setAct(null))])
  useEffect(() => {
    load()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const run = (fn: () => Promise<{ ok: true; message: string } | { ok: false; error: string }>, after?: () => void) =>
    start(async () => {
      const r = await fn()
      setMsg(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error })
      if (r.ok) {
        after?.()
        await load()
        onChanged()
      }
    })

  const blocked = m && (m.status === 'banli' || m.status === 'donduruldu')

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Üye yönetimi">
      <button aria-label="Kapat" onClick={onClose} className="absolute inset-0 bg-background/70 backdrop-blur-sm" />
      <aside className="relative flex h-full w-full max-w-2xl flex-col overflow-y-auto border-l border-border bg-card">
        <header className="sticky top-0 z-10 flex flex-col gap-3 border-b border-border bg-card px-5 pt-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-display text-lg font-bold text-foreground">Üye detayı</h3>
            <button onClick={onClose} aria-label="Kapat" className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground">
              <X className="size-5" aria-hidden="true" />
            </button>
          </div>
          <div role="tablist" aria-label="Üye detay sekmeleri" className="-mb-px flex gap-1 overflow-x-auto">
            {(
              [
                ['genel', 'Genel ve yönetim'],
                ['oyunlar', `Oyunlar${act ? ` (${act.activity.gameSummary.played})` : ''}`],
                ['coin', 'Coin dökümü'],
                ['islemler', 'İşlemler'],
                ['odul', 'Hediye ve rozet'],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                role="tab"
                aria-selected={tab === k}
                onClick={() => setTab(k)}
                className={cn(
                  'shrink-0 border-b-2 px-3 py-2 text-sm font-semibold',
                  tab === k ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </header>

        {m === undefined ? (
          <p className="p-5 text-sm text-muted-foreground">Yükleniyor…</p>
        ) : m === null ? (
          <p className="p-5 text-sm text-muted-foreground">Üye bulunamadı.</p>
        ) : (
          <div className="flex flex-col gap-5 p-5">
            <div className="flex items-center gap-3">
              <Avatar name={m.name} image={m.image} />
              <div className="flex min-w-0 flex-col">
                <span className="truncate font-semibold text-foreground">{m.name}</span>
                <span className="truncate text-xs text-muted-foreground">{m.email}</span>
              </div>
              <span className={cn('ml-auto shrink-0 rounded-full px-2 py-1 text-xs font-semibold', STATUS[m.status].cls)}>{STATUS[m.status].label}</span>
            </div>

            <dl className="grid grid-cols-2 gap-3 text-sm">
              {[
                ['Bakiye', `${m.balance.toLocaleString('tr-TR')} KC`],
                ['Kanka puanı', m.points.toLocaleString('tr-TR')],
                ['Rozet', level],
                ['Telefon', m.phone ?? '—'],
                ['Kayıt', date(m.createdAt)],
                ['Kaynak', m.source ?? 'Doğrudan'],
                ['Son görülme', date(m.lastSeen)],
                ['Açık oturum', String(m.sessions)],
              ].map(([k, v]) => (
                <div key={k} className="flex flex-col rounded-lg bg-background px-3 py-2">
                  <dt className="text-xs text-muted-foreground">{k}</dt>
                  <dd className="truncate font-medium text-foreground">{v}</dd>
                </div>
              ))}
            </dl>

            {msg && (
              <p role="status" className={cn('rounded-lg px-3 py-2 text-sm', msg.ok ? 'bg-primary/15 text-primary' : 'bg-destructive/15 text-destructive')}>
                {msg.text}
              </p>
            )}

            {tab === 'coin' && <MemberLedger key={m.balance} userId={m.id} balance={m.balance} />}

            {tab !== 'genel' &&
              tab !== 'coin' &&
              (act === undefined ? (
                <p className="text-sm text-muted-foreground">Yükleniyor…</p>
              ) : act === null ? (
                <p className="text-sm text-muted-foreground">Etkinlik bilgisi alınamadı.</p>
              ) : (
                <MemberActivityTabs
                  tab={tab}
                  userId={m.id}
                  activity={act.activity}
                  badges={act.badges}
                  roles={act.roles}
                  roleId={act.roleId}
                  canRoles={act.canRoles}
                  onDone={(r) => {
                    setMsg(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error })
                    if (r.ok) {
                      load()
                      onChanged()
                    }
                  }}
                />
              ))}

            {tab === 'genel' && blocked && (
              <div className="flex flex-col gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-4">
                <p className="text-sm font-semibold text-foreground">
                  {m.status === 'banli' ? 'Kalıcı banlı' : `Donduruldu · ${m.banUntil ? `${date(m.banUntil)} tarihine kadar` : 'Süresiz'}`}
                </p>
                {m.banReason && <p className="text-sm leading-relaxed text-muted-foreground">Sebep: {m.banReason}</p>}
                {m.ipBlocked && <p className="text-xs text-muted-foreground">IP adresi de engelli.</p>}
                <button disabled={busy} onClick={() => run(() => restoreAction(m.id))} className="mt-1 flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
                  <ShieldCheck className="size-4" aria-hidden="true" />
                  Hesabı tekrar aç
                </button>
              </div>
            )}

            {tab === 'genel' && (
              <>
            <Section icon={<NotebookPen className="size-4" aria-hidden="true" />} title={`Personel notları${m.staffNotes.length ? ` (${m.staffNotes.length})` : ''}`}>
              <MemberNotes userId={m.id} notes={m.staffNotes} busy={busy} run={run} />
            </Section>

            <Section icon={<Snowflake className="size-4" aria-hidden="true" />} title="Hesabı dondur">
              <select aria-label="Süre" value={duration} onChange={(e) => setDuration(e.target.value)} className={input}>
                <option value="1">1 gün</option>
                <option value="7">7 gün</option>
                <option value="30">30 gün</option>
                <option value="sure">Süresiz</option>
              </select>
              <textarea aria-label="Dondurma sebebi" value={suspendReason} onChange={(e) => setSuspendReason(e.target.value)} rows={2} placeholder="Dondurma sebebi (zorunlu)" className={cn(input, 'resize-y leading-relaxed')} />
              <button
                disabled={busy || suspendReason.trim().length < 3}
                onClick={() =>
                  confirmed(`${m.name} ${duration === 'sure' ? 'süresiz' : `${duration} gün`} dondurulsun mu? Bu sürede hesabına giremez.`, () =>
                    run(() => suspendAction(m.id, duration, suspendReason), () => setSuspendReason('')),
                  )
                }
                className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-secondary disabled:opacity-40"
              >
                Dondur
              </button>
            </Section>

            <Section icon={<Ban className="size-4" aria-hidden="true" />} title="Kalıcı ban">
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input type="checkbox" checked={ipBlock} onChange={(e) => setIpBlock(e.target.checked)} className="size-4 accent-primary" />
                Son giriş yaptığı IP adresini de engelle
              </label>
              <textarea aria-label="Ban sebebi" value={banReason} onChange={(e) => setBanReason(e.target.value)} rows={2} placeholder="Ban sebebi notu (zorunlu)" className={cn(input, 'resize-y leading-relaxed')} />
              <button
                disabled={busy || banReason.trim().length < 3}
                onClick={() => {
                  void askConfirm(`${m.name} kalıcı olarak banlansın mı?`).then((ok) => {
      if (ok) run(() => banAction(m.id, banReason, ipBlock), () => setBanReason(''))
    })
  }}
                className="rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground disabled:opacity-40"
              >
                Kalıcı banla
              </button>
            </Section>

            <Section icon={<Coins className="size-4" aria-hidden="true" />} title="Bakiye düzeltme">
              <input
                aria-label="Tutar"
                inputMode="text"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^\d.,\s-]/g, ''))}
                placeholder="Örn. 500 ya da -200"
                aria-invalid={Boolean(wallet.problem)}
                aria-describedby={wallet.problem ? 'wallet-amount-problem' : undefined}
                className={input}
              />
              {wallet.problem && (
                <p id="wallet-amount-problem" role="alert" className="text-sm leading-relaxed text-live">
                  {wallet.problem}
                </p>
              )}
              <input aria-label="İşlem gerekçesi" value={walletReason} onChange={(e) => setWalletReason(e.target.value)} placeholder="İşlem gerekçesi (zorunlu)" className={input} />
              <button
                disabled={busy || wallet.value === null || walletReason.trim().length < 3}
                onClick={() => {
                  const value = wallet.value
                  if (value === null) return
                  confirmed(
                    value < 0
                      ? `${m.name} bakiyesinden ${Math.abs(value).toLocaleString('tr-TR')} KC düşülsün mü?`
                      : `${m.name} bakiyesine ${value.toLocaleString('tr-TR')} KC eklensin mi?`,
                    () => run(() => walletAction(m.id, value, walletReason), () => (setAmount(''), setWalletReason(''))),
                  )
                }}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40"
              >
                {amount.trim().startsWith('-') ? 'Bakiyeden düş' : 'Bakiyeye ekle'}
              </button>
            </Section>

            <Section icon={<Lock className="size-4" aria-hidden="true" />} title="Güvenlik ve bağlı hesaplar">
              <div className="flex items-center justify-between gap-3 rounded-lg bg-background px-3 py-2 text-sm">
                <div className="flex min-w-0 flex-col">
                  <span className="text-xs text-muted-foreground">Telegram</span>
                  <span className="truncate font-medium text-foreground">{m.telegramId ? `${m.telegramName ?? ''} · ID ${m.telegramId}` : 'Bağlı değil'}</span>
                </div>
                {m.telegramId && (
                  <button disabled={busy} onClick={() => confirmed(`${m.name} hesabının Telegram bağlantısı kaldırılsın mı? Üye yeniden bağlamak zorunda kalır.`, () => run(() => unlinkTelegramAction(m.id)))} className="flex shrink-0 items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs text-foreground hover:bg-secondary disabled:opacity-40">
                    <Link2Off className="size-3.5" aria-hidden="true" />
                    Bağlantıyı kaldır
                  </button>
                )}
              </div>
              <button disabled={busy} onClick={() => confirmed(`${m.name} tüm cihazlarda oturumdan çıkarılsın mı? Yeniden giriş yapması gerekir.`, () => run(() => revokeSessionsAction(m.id)))} className="flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2 text-sm text-foreground hover:bg-secondary disabled:opacity-40">
                <LogOut className="size-4" aria-hidden="true" />
                Güvenlik sıfırla (tüm oturumları kapat)
              </button>
              <div className={cn('flex flex-col gap-2 rounded-lg px-3 py-2 text-sm', m.sameIpMembers.length ? 'bg-live/10' : 'bg-background')}>
                <span className="flex items-center gap-2 font-medium text-foreground">
                  <AlertTriangle className={cn('size-4', m.sameIpMembers.length ? 'text-live' : 'text-muted-foreground')} aria-hidden="true" />
                  Çoklu hesap kontrolü
                </span>
                {m.sameIpMembers.length ? (
                  <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
                    {m.sameIpMembers.map((s) => (
                      <li key={s.id} className="truncate">
                        Aynı IP / cihaz: {s.name} · {s.email}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-xs text-muted-foreground">Aynı IP ya da cihazdan başka hesap görünmüyor.</span>
                )}
              </div>
            </Section>
              </>
            )}
          </div>
        )}
      </aside>
    </div>
  )
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border p-4">
      <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <span className="text-primary">{icon}</span>
        {title}
      </h4>
      {children}
    </div>
  )
}
