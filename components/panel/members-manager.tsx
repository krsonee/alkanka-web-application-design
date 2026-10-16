'use client'

import { useEffect, useState, useTransition } from 'react'
import { AlertTriangle, Ban, Coins, Link2Off, Lock, LogOut, Search, ShieldCheck, Snowflake, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  banAction,
  memberActivityAction,
  memberDetailAction,
  restoreAction,
  revokeSessionsAction,
  searchMembersAction,
  suspendAction,
  unlinkTelegramAction,
  walletAction,
} from '@/app/panel/members-actions'
import type { MemberDetail, MemberRow, MemberStatus } from '@/lib/members-admin'
import { MemberActivityTabs, type ActivityTab } from '@/components/panel/member-activity-tabs'

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
const date = (iso: string | null) => (iso ? new Date(iso).toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' }) : '—')

function Avatar({ name, image }: { name: string; image: string | null }) {
  return image ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={image || '/placeholder.svg'} alt="" className="size-9 shrink-0 rounded-full object-cover" />
  ) : (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-bold text-foreground">{name.slice(0, 1).toLocaleUpperCase('tr')}</span>
  )
}

export function MembersManager({ initial, counts: initialCounts, levels }: { initial: MemberRow[]; counts: Record<Filter, number>; levels: Record<string, string> }) {
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('tumu')
  const [list, setList] = useState(initial)
  const [counts, setCounts] = useState(initialCounts)
  const [openId, setOpenId] = useState<string | null>(null)
  const [loading, start] = useTransition()

  useEffect(() => {
    const t = setTimeout(() => {
      start(async () => {
        const r = await searchMembersAction(q, filter)
        if (r) {
          setList(r.members)
          setCounts(r.counts)
        }
      })
    }, 250)
    return () => clearTimeout(t)
  }, [q, filter])

  const refresh = () =>
    start(async () => {
      const r = await searchMembersAction(q, filter)
      if (r) {
        setList(r.members)
        setCounts(r.counts)
      }
    })

  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h2 className="font-display text-xl font-bold text-foreground">Tüm üyeler</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">Üye ara, hesabı dondur, banla ya da bakiyesini düzelt. Her işlem İşlem Loglarına yazılır.</p>
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
      </div>

      <div className={cn('overflow-x-auto rounded-xl border border-border bg-card', loading && 'opacity-70')}>
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
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
              <tr key={m.id} onClick={() => setOpenId(m.id)} className="cursor-pointer border-b border-border last:border-0 hover:bg-secondary/50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={m.name} image={m.image} />
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate font-medium text-foreground">{m.name}</span>
                      <span className="truncate text-xs text-muted-foreground">{m.email}</span>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-foreground">{levels[m.id] ?? 'Çaylak'}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-col">
                    <span className="font-semibold text-foreground">{m.balance.toLocaleString('tr-TR')} KC</span>
                    <span className="text-xs text-muted-foreground">{m.points.toLocaleString('tr-TR')} puan</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col">
                    <span className="text-foreground">{new Date(m.createdAt).toLocaleDateString('tr-TR')}</span>
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
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  Bu filtreyle eşleşen üye yok.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {openId && <MemberDrawer key={openId} id={openId} level={levels[openId] ?? 'Çaylak'} onClose={() => setOpenId(null)} onChanged={refresh} />}
    </section>
  )
}

function MemberDrawer({ id, level, onClose, onChanged }: { id: string; level: string; onClose: () => void; onChanged: () => void }) {
  const [m, setM] = useState<MemberDetail | null | undefined>(undefined)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, start] = useTransition()
  const [duration, setDuration] = useState('7')
  const [suspendReason, setSuspendReason] = useState('')
  const [banReason, setBanReason] = useState('')
  const [ipBlock, setIpBlock] = useState(false)
  const [amount, setAmount] = useState('')
  const [walletReason, setWalletReason] = useState('')

  const [tab, setTab] = useState<'genel' | ActivityTab>('genel')
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

            {tab !== 'genel' &&
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
                onClick={() => run(() => suspendAction(m.id, duration, suspendReason), () => setSuspendReason(''))}
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
                  if (confirm(`${m.name} kalıcı olarak banlansın mı?`)) run(() => banAction(m.id, banReason, ipBlock), () => setBanReason(''))
                }}
                className="rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground disabled:opacity-40"
              >
                Kalıcı banla
              </button>
            </Section>

            <Section icon={<Coins className="size-4" aria-hidden="true" />} title="Bakiye düzeltme">
              <input aria-label="Tutar" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d-]/g, ''))} placeholder="Örn. 500 ya da -200" className={input} />
              <input aria-label="İşlem gerekçesi" value={walletReason} onChange={(e) => setWalletReason(e.target.value)} placeholder="İşlem gerekçesi (zorunlu)" className={input} />
              <button
                disabled={busy || !Number(amount) || walletReason.trim().length < 3}
                onClick={() => run(() => walletAction(m.id, Number(amount), walletReason), () => (setAmount(''), setWalletReason('')))}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40"
              >
                {Number(amount) < 0 ? 'Bakiyeden düş' : 'Bakiyeye ekle'}
              </button>
            </Section>

            <Section icon={<Lock className="size-4" aria-hidden="true" />} title="Güvenlik ve bağlı hesaplar">
              <div className="flex items-center justify-between gap-3 rounded-lg bg-background px-3 py-2 text-sm">
                <div className="flex min-w-0 flex-col">
                  <span className="text-xs text-muted-foreground">Telegram</span>
                  <span className="truncate font-medium text-foreground">{m.telegramId ? `${m.telegramName ?? ''} · ID ${m.telegramId}` : 'Bağlı değil'}</span>
                </div>
                {m.telegramId && (
                  <button disabled={busy} onClick={() => run(() => unlinkTelegramAction(m.id))} className="flex shrink-0 items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs text-foreground hover:bg-secondary disabled:opacity-40">
                    <Link2Off className="size-3.5" aria-hidden="true" />
                    Bağlantıyı kaldır
                  </button>
                )}
              </div>
              <button disabled={busy} onClick={() => run(() => revokeSessionsAction(m.id))} className="flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2 text-sm text-foreground hover:bg-secondary disabled:opacity-40">
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
