'use client'

import { useMemo, useState, useTransition } from 'react'
import { Check, Copy, Loader2, ShieldAlert, X } from 'lucide-react'
import {
  importWagersAction,
  reviewSponsorAccountAction,
  saveSiteLinkAction,
  setFlagAction,
} from '@/app/panel/growth-actions'
import type { FlaggedMember, SiteLink, SponsorAccount, TrafficReport } from '@/lib/growth'
import { cn } from '@/lib/utils'

type Site = { id: string; name: string }
type Props = {
  sites: Site[]
  links: Record<string, SiteLink>
  followers: Record<string, number>
  report: TrafficReport
  flagged: FlaggedMember[]
  accounts: SponsorAccount[]
  period: string
  siteUrl: string
}

const input = 'rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none'
const card = 'flex flex-col gap-4 rounded-2xl border border-border bg-card p-5'
const btn = 'inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:opacity-50'

function useRunner() {
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null)
  const run = (fn: () => Promise<{ ok: boolean; message: string }>) => start(async () => setMsg(await fn()))
  return { pending, msg, run }
}

function Note({ msg }: { msg: { ok: boolean; message: string } | null }) {
  if (!msg) return null
  return <p role="status" className={cn('text-sm', msg.ok ? 'text-primary' : 'text-destructive')}>{msg.message}</p>
}

function LinkBuilder({ siteUrl }: { siteUrl: string }) {
  const [src, setSrc] = useState('sms')
  const [path, setPath] = useState('/')
  const [copied, setCopied] = useState(false)
  const clean = src.toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 32)
  const url = `${siteUrl}${path.startsWith('/') ? path : `/${path}`}${path.includes('?') ? '&' : '?'}src=${clean || 'direkt'}`
  return (
    <section className={card}>
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-lg font-bold text-foreground">Kampanya linki oluştur</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          SMS, mail ve Telegram mesajlarında bu linki kullan. Gelen ziyaretçi 30 gün boyunca o kaynağa yazılır, kayıt ve tıklamalar aşağıdaki rapora düşer.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
          Kaynak etiketi
          <input className={input} value={src} onChange={(e) => setSrc(e.target.value)} placeholder="sms-ekim" />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
          Sayfa
          <input className={input} value={path} onChange={(e) => setPath(e.target.value)} placeholder="/oyunlar/cark" />
        </label>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <code className="min-w-0 flex-1 truncate rounded-lg bg-secondary px-3 py-2 text-xs text-foreground">{url}</code>
        <button
          type="button"
          className={btn}
          onClick={async () => {
            await navigator.clipboard.writeText(url)
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          }}
        >
          {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
          {copied ? 'Kopyalandı' : 'Kopyala'}
        </button>
      </div>
    </section>
  )
}

function Report({ report, names }: { report: TrafficReport; names: Record<string, string> }) {
  return (
    <section className={card}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 className="font-display text-lg font-bold text-foreground">Kaynak raporu (son {report.days} gün)</h2>
        <p className="text-sm text-muted-foreground">
          {report.totalClicks.toLocaleString('tr-TR')} sponsor tıklaması · {report.totalSignups.toLocaleString('tr-TR')} yeni üye
        </p>
      </div>
      {report.sources.length === 0 ? (
        <p className="text-sm text-muted-foreground">Henüz veri yok. Kampanya linkiyle gelen ilk ziyaretçiden sonra burası dolar.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="py-2 pr-3 font-semibold">Kaynak</th>
                <th className="py-2 pr-3 text-right font-semibold">Yeni üye</th>
                <th className="py-2 pr-3 text-right font-semibold">Sponsor tıklaması</th>
                <th className="py-2 text-right font-semibold">Tıklayan üye</th>
              </tr>
            </thead>
            <tbody>
              {report.sources.map((s) => (
                <tr key={s.src} className="border-b border-border last:border-0">
                  <td className="py-2 pr-3 font-semibold text-foreground">{s.src}</td>
                  <td className="py-2 pr-3 text-right tabular-nums text-foreground">{s.signups}</td>
                  <td className="py-2 pr-3 text-right tabular-nums text-foreground">{s.clicks}</td>
                  <td className="py-2 text-right tabular-nums text-muted-foreground">{s.clickers}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {report.sites.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {report.sites.map((s) => (
            <span key={s.siteId} className="rounded-full bg-secondary px-3 py-1 text-xs text-foreground">
              {names[s.siteId] ?? s.siteId}: <strong className="tabular-nums">{s.clicks}</strong>
            </span>
          ))}
        </div>
      )}
    </section>
  )
}

function SiteLinks({ sites, links, followers }: Pick<Props, 'sites' | 'links' | 'followers'>) {
  const [q, setQ] = useState('')
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [notify, setNotify] = useState(true)
  const { pending, msg, run } = useRunner()
  const list = useMemo(() => {
    const f = q.trim().toLowerCase()
    return sites.filter((s) => !f || s.name.toLowerCase().includes(f)).sort((a, b) => Number(Boolean(links[b.id])) - Number(Boolean(links[a.id])))
  }, [q, sites, links])

  return (
    <section className={card}>
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-lg font-bold text-foreground">Giriş adresleri ve adres alarmı</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {'Sitedeki tüm "Git" butonları buradaki adrese yönlenir ve tıklamalar kaydedilir. Adres değişince takipçilere push bildirimi ve Telegram mesajı gider.'}
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input className={cn(input, 'sm:max-w-xs')} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Site ara" aria-label="Site ara" />
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="size-4 accent-primary" />
          Adres değişince takipçilere bildir
        </label>
      </div>
      <Note msg={msg} />
      <ul className="flex max-h-[480px] flex-col overflow-y-auto rounded-xl border border-border">
        {list.map((s) => {
          const saved = links[s.id]?.url ?? ''
          const value = drafts[s.id] ?? saved
          return (
            <li key={s.id} className="flex flex-col gap-2 border-b border-border p-3 last:border-0 sm:flex-row sm:items-center">
              <div className="flex w-44 shrink-0 flex-col">
                <span className="font-semibold text-foreground">{s.name}</span>
                <span className="text-xs text-muted-foreground">{followers[s.id] ?? 0} takipçi</span>
              </div>
              <input
                className={cn(input, 'min-w-0 flex-1')}
                value={value}
                onChange={(e) => setDrafts((d) => ({ ...d, [s.id]: e.target.value }))}
                placeholder="https://..."
                aria-label={`${s.name} giriş adresi`}
              />
              <button
                type="button"
                className={btn}
                disabled={pending || value === saved}
                onClick={() => run(() => saveSiteLinkAction(s.id, value, notify))}
              >
                {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
                Kaydet
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function Accounts({ accounts, names }: { accounts: SponsorAccount[]; names: Record<string, string> }) {
  const { pending, msg, run } = useRunner()
  const pendingList = accounts.filter((a) => a.status === 'pending')
  return (
    <section className={card}>
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-lg font-bold text-foreground">Sponsor hesap onayı ({pendingList.length} bekliyor)</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Üyeler sponsor sitedeki kullanıcı adını profilinden bağlar. Affiliate panelinde referansınla kayıtlıysa onayla. Sadece onaylı hesaplar çevrim sıralamasına girer.
        </p>
      </div>
      <Note msg={msg} />
      {accounts.length === 0 ? (
        <p className="text-sm text-muted-foreground">Henüz bağlanan hesap yok.</p>
      ) : (
        <ul className="flex max-h-[420px] flex-col overflow-y-auto rounded-xl border border-border">
          {accounts.map((a) => (
            <li key={`${a.userId}-${a.siteId}`} className="flex flex-wrap items-center gap-3 border-b border-border p-3 last:border-0">
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="font-semibold text-foreground">
                  {a.userName} <span className="font-normal text-muted-foreground">→ {names[a.siteId] ?? a.siteId}</span>
                </span>
                <span className="text-xs text-muted-foreground">Kullanıcı adı: {a.username}</span>
              </div>
              {a.status === 'pending' ? (
                <div className="flex gap-2">
                  <button type="button" disabled={pending} className={btn} onClick={() => run(() => reviewSponsorAccountAction(a.userId, a.siteId, true, ''))}>
                    <Check className="size-4" aria-hidden="true" /> Onayla
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-semibold text-foreground disabled:opacity-50"
                    onClick={() => {
                      const note = window.prompt('Red sebebi (üyeye görünür)', 'Referansımızla kayıtlı değil') ?? ''
                      run(() => reviewSponsorAccountAction(a.userId, a.siteId, false, note))
                    }}
                  >
                    <X className="size-4" aria-hidden="true" /> Reddet
                  </button>
                </div>
              ) : (
                <span className={cn('rounded-full px-2.5 py-1 text-xs font-semibold', a.status === 'approved' ? 'bg-primary/15 text-primary' : 'bg-destructive/15 text-destructive')}>
                  {a.status === 'approved' ? 'Onaylı' : 'Reddedildi'}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function Wagers({ sites, period }: { sites: Site[]; period: string }) {
  const [siteId, setSiteId] = useState(sites[0]?.id ?? '')
  const [p, setP] = useState(period)
  const [text, setText] = useState('')
  const { pending, msg, run } = useRunner()
  return (
    <section className={card}>
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-lg font-bold text-foreground">Çevrim verisi yükle</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {'Sponsorun affiliate panelinden aylık raporu indir, "kullanıcıadı,tutar" sütunlarını buraya yapıştır. Aynı site ve dönem için önceki veri silinip yenisi yazılır. Sıralama sayfası anında güncellenir.'}
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
          Site
          <select className={input} value={siteId} onChange={(e) => setSiteId(e.target.value)}>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
          Dönem (YYYY-AA)
          <input className={input} value={p} onChange={(e) => setP(e.target.value)} />
        </label>
      </div>
      <textarea
        className={cn(input, 'min-h-36 font-mono text-xs')}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={'kanka123,15400\nbahisci_ali,8250.50'}
        aria-label="Çevrim verisi"
      />
      <Note msg={msg} />
      <button type="button" className={cn(btn, 'self-start')} disabled={pending || !text.trim()} onClick={() => run(() => importWagersAction(siteId, p, text))}>
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
        Yükle
      </button>
    </section>
  )
}

function Flagged({ flagged }: { flagged: FlaggedMember[] }) {
  const { pending, msg, run } = useRunner()
  return (
    <section className={card}>
      <div className="flex items-start gap-3">
        <ShieldAlert className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden="true" />
        <div className="flex flex-col gap-1">
          <h2 className="font-display text-lg font-bold text-foreground">Çoklu hesap şüphesi ({flagged.length})</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Aynı ağdan 7 gün içinde 3. hesap açılınca otomatik işaretlenir. İşaretli üyenin davet ödülleri durur, aynı ağdaki davetler sayılmaz. Gerçek bir kullanıcıysa işareti kaldır.
          </p>
        </div>
      </div>
      <Note msg={msg} />
      {flagged.length === 0 ? (
        <p className="text-sm text-muted-foreground">Şüpheli hesap yok.</p>
      ) : (
        <ul className="flex flex-col rounded-xl border border-border">
          {flagged.map((f) => (
            <li key={f.userId} className="flex flex-wrap items-center gap-3 border-b border-border p-3 last:border-0">
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="font-semibold text-foreground">{f.name}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {f.email} · kaynak: {f.src} · aynı ağda {f.siblings} hesap · {new Date(f.createdAt).toLocaleDateString('tr-TR')}
                </span>
              </div>
              <button type="button" disabled={pending} className={btn} onClick={() => run(() => setFlagAction(f.userId, false))}>
                İşareti kaldır
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export function GrowthManager(props: Props) {
  const names = useMemo(() => Object.fromEntries(props.sites.map((s) => [s.id, s.name])), [props.sites])
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <LinkBuilder siteUrl={props.siteUrl} />
        <Flagged flagged={props.flagged} />
      </div>
      <Report report={props.report} names={names} />
      <SiteLinks sites={props.sites} links={props.links} followers={props.followers} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Accounts accounts={props.accounts} names={names} />
        <Wagers sites={props.sites} period={props.period} />
      </div>
    </div>
  )
}
