'use client'


import { askConfirm } from '@/components/panel/confirm-dialog'
import { useMemo, useState, useTransition } from 'react'
import { Check, Copy, Loader2, Pause, Pencil, Play, Plus, Send, Trash2, X } from 'lucide-react'
import {
  deleteCampaignAction,
  deleteEarningAction,
  saveCampaignAction,
  saveEarningAction,
  saveTrackingAction,
  setEarningStatusAction,
} from '@/app/panel/marketing-actions'
import {
  CHANNELS,
  EARNING_MODELS,
  EARNING_STATUSES,
  TRACKING_RULES,
  type CampaignView,
  type EarningStatus,
  type EarningView,
  type TrackingSettings,
} from '@/lib/marketing-shared'
import { cn } from '@/lib/utils'

export type MarketingSite = { id: number; name: string; slug: string; active: boolean }
type Msg = { ok: boolean; message: string } | null

const input = 'rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none'
const btn = 'inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:opacity-50'
const ghost = 'inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-semibold text-foreground hover:bg-secondary disabled:opacity-50'
const label = 'flex flex-col gap-1 text-xs font-semibold text-muted-foreground'

const fmt = (n: number, digits = 0) => n.toLocaleString('tr-TR', { maximumFractionDigits: digits, minimumFractionDigits: 0 })
const money = (n: number, currency: string) => `${fmt(n, 2)} ${currency === 'TRY' ? '₺' : currency}`

function Note({ msg }: { msg: Msg }) {
  if (!msg) return null
  return (
    <p role="status" className={cn('text-sm', msg.ok ? 'text-primary' : 'text-destructive')}>
      {msg.message}
    </p>
  )
}

function CopyButton({ value, text = 'Kopyala' }: { value: string; text?: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      className={ghost}
      onClick={async () => {
        await navigator.clipboard.writeText(value)
        setDone(true)
        setTimeout(() => setDone(false), 1500)
      }}
    >
      {done ? <Check className="size-3.5" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
      {done ? 'Kopyalandı' : text}
    </button>
  )
}

function Stat({ title, value, hint }: { title: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg bg-secondary px-3 py-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</span>
      <span className="text-base font-bold tabular-nums text-foreground">{value}</span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  )
}

function Spark({ data }: { data: number[] }) {
  const max = Math.max(1, ...data)
  return (
    <div className="flex h-8 items-end gap-0.5" role="img" aria-label={`Son 14 gün ziyaret: ${data.join(', ')}`}>
      {data.map((n, i) => (
        <span key={i} className={cn('w-1.5 rounded-sm', n ? 'bg-primary' : 'bg-border')} style={{ height: `${Math.max(8, (n / max) * 100)}%` }} />
      ))}
    </div>
  )
}

/* ---------------- Ölçüm etiketleri ---------------- */

export function TrackingEditor({ settings }: { settings: TrackingSettings }) {
  const [d, setD] = useState(settings)
  const [msg, setMsg] = useState<Msg>(null)
  const [pending, start] = useTransition()
  const keys = Object.keys(TRACKING_RULES) as (keyof TrackingSettings)[]
  const live = [d.ga4Id && 'Google Analytics', d.adsId && 'Google Ads', d.metaPixelId && 'Meta Pixel'].filter(Boolean)

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        start(async () => setMsg(await saveTrackingAction(d)))
      }}
    >
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold text-foreground">Durum:</span>
        {live.length ? (
          live.map((n) => (
            <span key={String(n)} className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
              {n} açık
            </span>
          ))
        ) : (
          <span className="text-muted-foreground">Henüz hiçbir etiket bağlı değil.</span>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {keys.map((key) => {
          const rule = TRACKING_RULES[key]
          const bad = d[key] && !rule.re.test(key === 'ga4Id' || key === 'adsId' ? d[key].toUpperCase() : d[key])
          return (
            <label key={key} className={label}>
              {rule.label}
              <input
                className={cn(input, 'font-mono', bad && 'border-destructive')}
                value={d[key]}
                onChange={(e) => setD((p) => ({ ...p, [key]: e.target.value.trim() }))}
                placeholder={rule.example}
                spellCheck={false}
                autoComplete="off"
              />
              {bad && <span className="font-normal text-destructive">Biçim hatalı, örnek: {rule.example}</span>}
            </label>
          )
        })}
      </div>

      <div className="rounded-lg border border-border p-3 text-xs leading-relaxed text-muted-foreground">
        Etiketler kaydedilince sitede şu olaylar otomatik gönderilir: <b className="text-foreground">sayfa görüntüleme</b>, yeni üye olunca{' '}
        <b className="text-foreground">sign_up / CompleteRegistration</b>, sponsor butonuna tıklanınca{' '}
        <b className="text-foreground">sponsor_click / SponsorClick</b>. Kutuları boş bırakırsan o etiket kapanır.
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className={btn} disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          Kaydet
        </button>
        <Note msg={msg} />
      </div>
    </form>
  )
}

/* ---------------- Kampanya linkleri ---------------- */

type CampaignDraft = { id?: number; code: string; name: string; channel: string; target: string; cost: string; active: boolean }
const EMPTY_CAMPAIGN: CampaignDraft = { code: '', name: '', channel: 'telegram', target: '/', cost: '', active: true }

function slug(value: string) {
  return value
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32)
}

const PAGE_TARGETS = [
  { value: '/', label: 'Ana sayfa' },
  { value: '/sponsorlar', label: 'Sponsorlar' },
  { value: '/firsatlar', label: 'Fırsatlar' },
  { value: '/turnuvalar', label: 'Turnuvalar' },
  { value: '/oyunlar', label: 'Oyunlar' },
  { value: '/rehber', label: 'Rehber' },
]

function CampaignEditor({ draft, sites, siteUrl, onClose }: { draft: CampaignDraft; sites: MarketingSite[]; siteUrl: string; onClose?: () => void }) {
  const [d, setD] = useState(draft)
  const [codeTouched, setCodeTouched] = useState(Boolean(draft.id))
  const [msg, setMsg] = useState<Msg>(null)
  const [pending, start] = useTransition()
  const set = (patch: Partial<CampaignDraft>) => setD((p) => ({ ...p, ...patch }))
  const sponsorTargets = sites.filter((s) => s.active).map((s) => ({ value: `/git/${s.slug || s.id}`, label: `${s.name} (direkt sponsora)` }))
  const known = [...PAGE_TARGETS, ...sponsorTargets].some((t) => t.value === d.target)
  const [custom, setCustom] = useState(!known)
  const host = siteUrl.replace(/^https?:\/\//, '')

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        start(async () => {
          const r = await saveCampaignAction({ id: d.id, code: d.code, name: d.name, channel: d.channel, target: d.target, cost: Number(d.cost || 0), active: d.active })
          setMsg(r)
          if (r.ok && !d.id) {
            setD(EMPTY_CAMPAIGN)
            setCodeTouched(false)
          }
          if (r.ok && onClose) onClose()
        })
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={label}>
          Kampanya adı
          <input
            className={input}
            value={d.name}
            onChange={(e) => set({ name: e.target.value, ...(codeTouched ? {} : { code: slug(e.target.value) }) })}
            placeholder="Ör. Ekim Telegram duyurusu"
            maxLength={80}
            required
          />
        </label>
        <label className={label}>
          Kanal
          <select className={input} value={d.channel} onChange={(e) => set({ channel: e.target.value })}>
            {CHANNELS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className={label}>
        Kampanya linki
        <div className="flex items-stretch overflow-hidden rounded-lg border border-input bg-background focus-within:border-primary">
          <span className="flex items-center bg-secondary px-3 font-mono text-xs text-muted-foreground">{host}/k/</span>
          <input
            className="min-w-0 flex-1 bg-transparent px-3 py-2 font-mono text-sm text-foreground focus:outline-none"
            value={d.code}
            onChange={(e) => {
              setCodeTouched(true)
              set({ code: slug(e.target.value) })
            }}
            placeholder="ekim-telegram"
            required
          />
        </div>
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className={label}>
          Tıklayan nereye gitsin?
          {custom ? (
            <input className={cn(input, 'font-mono')} value={d.target} onChange={(e) => set({ target: e.target.value })} placeholder="/turnuvalar/ekim-kupasi" />
          ) : (
            <select className={input} value={d.target} onChange={(e) => set({ target: e.target.value })}>
              <optgroup label="Sitemizin sayfaları">
                {PAGE_TARGETS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </optgroup>
              {sponsorTargets.length > 0 && (
                <optgroup label="Sponsora yönlendir">
                  {sponsorTargets.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          )}
          <button type="button" className="self-start text-xs font-semibold text-primary" onClick={() => setCustom((c) => !c)}>
            {custom ? 'Listeden seç' : 'Başka bir sayfa yaz'}
          </button>
        </label>
        <label className={label}>
          Harcanan bütçe (₺, opsiyonel)
          <input className={input} value={d.cost} onChange={(e) => set({ cost: e.target.value.replace(/[^\d.]/g, '') })} inputMode="decimal" placeholder="0" />
          <span className="font-normal">Girersen üye başı maliyeti otomatik hesaplarız.</span>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className={btn} disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : d.id ? <Check className="size-4" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}
          {d.id ? 'Kaydet' : 'Link oluştur'}
        </button>
        {onClose && (
          <button type="button" className={ghost} onClick={onClose}>
            <X className="size-3.5" aria-hidden="true" /> Vazgeç
          </button>
        )}
        <Note msg={msg} />
      </div>
    </form>
  )
}

function CampaignCard({ c, sites, siteUrl }: { c: CampaignView; sites: MarketingSite[]; siteUrl: string }) {
  const [editing, setEditing] = useState(false)
  const [msg, setMsg] = useState<Msg>(null)
  const [pending, start] = useTransition()
  const link = `${siteUrl}/k/${c.code}`
  const channel = CHANNELS.find((ch) => ch.id === c.channel)?.label ?? c.channel
  const conv = c.uniques ? (c.signups / c.uniques) * 100 : 0
  const cpl = c.cost && c.signups ? c.cost / c.signups : 0

  if (editing) {
    return (
      <li className="rounded-xl border border-primary/40 bg-card p-4">
        <CampaignEditor
          draft={{ id: c.id, code: c.code, name: c.name, channel: c.channel, target: c.target, cost: c.cost ? String(c.cost) : '', active: c.active }}
          sites={sites}
          siteUrl={siteUrl}
          onClose={() => setEditing(false)}
        />
      </li>
    )
  }

  return (
    <li className={cn('flex flex-col gap-3 rounded-xl border border-border bg-card p-4', !c.active && 'opacity-60')}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-semibold text-foreground">{c.name}</h4>
            <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-muted-foreground">{channel}</span>
            {!c.active && <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-muted-foreground">Durduruldu</span>}
          </div>
          <p className="truncate font-mono text-xs text-muted-foreground">
            {link} <span aria-hidden="true">{'→'}</span> {c.target}
          </p>
        </div>
        <Spark data={c.daily} />
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Stat title="Ziyaret" value={fmt(c.visits)} hint={`son 7 gün ${fmt(c.week)}`} />
        <Stat title="Tekil kişi" value={fmt(c.uniques)} />
        <Stat title="Yeni üye" value={fmt(c.signups)} hint={c.uniques ? `%${fmt(conv, 1)} dönüşüm` : undefined} />
        <Stat title="Sponsor tık." value={fmt(c.sponsorClicks)} />
        <Stat title="Üye başı maliyet" value={cpl ? money(cpl, 'TRY') : '—'} hint={c.cost ? `bütçe ${money(c.cost, 'TRY')}` : 'bütçe girilmedi'} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <CopyButton value={link} text="Linki kopyala" />
        <button type="button" className={ghost} onClick={() => setEditing(true)}>
          <Pencil className="size-3.5" aria-hidden="true" /> Düzenle
        </button>
        <button
          type="button"
          className={ghost}
          disabled={pending}
          onClick={() =>
            start(async () =>
              setMsg(await saveCampaignAction({ id: c.id, code: c.code, name: c.name, channel: c.channel, target: c.target, cost: c.cost, active: !c.active })),
            )
          }
        >
          {c.active ? <Pause className="size-3.5" aria-hidden="true" /> : <Play className="size-3.5" aria-hidden="true" />}
          {c.active ? 'Durdur' : 'Başlat'}
        </button>
        <button
          type="button"
          className={cn(ghost, 'text-destructive')}
          disabled={pending}
          onClick={() => {
            void askConfirm(`"${c.name}" kampanyası ve ziyaret kayıtları silinsin mi?`).then((ok) => {
      if (ok) start(async () => setMsg(await deleteCampaignAction(c.id)))
    })
  }}
        >
          <Trash2 className="size-3.5" aria-hidden="true" /> Sil
        </button>
        <Note msg={msg} />
      </div>
    </li>
  )
}

export function CampaignsManager({ campaigns, sites, siteUrl }: { campaigns: CampaignView[]; sites: MarketingSite[]; siteUrl: string }) {
  const totals = useMemo(
    () =>
      campaigns.reduce(
        (t, c) => ({ visits: t.visits + c.visits, signups: t.signups + c.signups, clicks: t.clicks + c.sponsorClicks, cost: t.cost + c.cost }),
        { visits: 0, signups: 0, clicks: 0, cost: 0 },
      ),
    [campaigns],
  )
  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-xl border border-border bg-card p-4" aria-labelledby="new-campaign">
        <h3 id="new-campaign" className="mb-3 font-semibold text-foreground">
          Yeni kampanya linki
        </h3>
        <CampaignEditor draft={EMPTY_CAMPAIGN} sites={sites} siteUrl={siteUrl} />
      </section>

      {campaigns.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat title="Toplam ziyaret" value={fmt(totals.visits)} />
          <Stat title="Toplam yeni üye" value={fmt(totals.signups)} />
          <Stat title="Sponsor tıklaması" value={fmt(totals.clicks)} />
          <Stat title="Toplam bütçe" value={money(totals.cost, 'TRY')} />
        </div>
      )}

      {campaigns.length ? (
        <ul className="flex flex-col gap-3">
          {campaigns.map((c) => (
            <CampaignCard key={c.id} c={c} sites={sites} siteUrl={siteUrl} />
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Henüz kampanya yok. Her paylaşım yeri için ayrı link oluştur, hangisinin üye getirdiğini burada gör.
        </p>
      )}
    </div>
  )
}

/* ---------------- Affiliate hakediş ---------------- */

type EarningDraft = { id?: number; siteId: string; period: string; model: string; ftd: string; amount: string; currency: string; note: string }

function lastMonth() {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const STATUS_STYLE: Record<EarningStatus, string> = {
  pending: 'bg-secondary text-muted-foreground',
  claimed: 'bg-accent/15 text-accent-foreground',
  paid: 'bg-primary/10 text-primary',
  rejected: 'bg-destructive/10 text-destructive',
}

function EarningEditor({ draft, sites, onClose }: { draft: EarningDraft; sites: MarketingSite[]; onClose?: () => void }) {
  const [d, setD] = useState(draft)
  const [msg, setMsg] = useState<Msg>(null)
  const [pending, start] = useTransition()
  const set = (patch: Partial<EarningDraft>) => setD((p) => ({ ...p, ...patch }))
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        start(async () => {
          const r = await saveEarningAction({
            id: d.id,
            siteId: Number(d.siteId),
            period: d.period,
            model: d.model,
            ftd: Number(d.ftd || 0),
            amount: Number(d.amount || 0),
            currency: d.currency,
            note: d.note,
          })
          setMsg(r)
          if (r.ok && !d.id) setD({ ...draft, siteId: d.siteId, period: d.period, currency: d.currency, model: d.model })
          if (r.ok && onClose) onClose()
        })
      }}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <label className={label}>
          Sponsor
          <select className={input} value={d.siteId} onChange={(e) => set({ siteId: e.target.value })} required>
            <option value="">Seç</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className={label}>
          Dönem (ay)
          <input type="month" className={input} value={d.period} onChange={(e) => set({ period: e.target.value })} required />
        </label>
        <label className={label}>
          Anlaşma modeli
          <select className={input} value={d.model} onChange={(e) => set({ model: e.target.value })}>
            {EARNING_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <label className={label}>
          İlk yatırım yapan (FTD)
          <input className={input} value={d.ftd} onChange={(e) => set({ ftd: e.target.value.replace(/\D/g, '') })} inputMode="numeric" placeholder="0" />
        </label>
        <label className={label}>
          Hakediş tutarı
          <div className="flex gap-2">
            <input className={cn(input, 'min-w-0 flex-1')} value={d.amount} onChange={(e) => set({ amount: e.target.value.replace(/[^\d.]/g, '') })} inputMode="decimal" placeholder="0" required />
            <select className={input} value={d.currency} onChange={(e) => set({ currency: e.target.value })} aria-label="Para birimi">
              {['TRY', 'USD', 'EUR', 'USDT'].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
        </label>
        <label className={label}>
          Not
          <input className={input} value={d.note} onChange={(e) => set({ note: e.target.value })} placeholder="Ör. panel ekran görüntüsü alındı" maxLength={400} />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className={btn} disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}
          {d.id ? 'Kaydet' : 'Hakediş ekle'}
        </button>
        {onClose && (
          <button type="button" className={ghost} onClick={onClose}>
            <X className="size-3.5" aria-hidden="true" /> Vazgeç
          </button>
        )}
        <Note msg={msg} />
      </div>
    </form>
  )
}

function claimText(e: EarningView) {
  const model = EARNING_MODELS.find((m) => m.id === e.model)?.label ?? e.model
  return [
    'Merhaba,',
    '',
    `Alkanka olarak ${e.period} dönemine ait affiliate hakedişimizi talep ediyoruz.`,
    '',
    `Sponsor: ${e.siteName}`,
    `Model: ${model}`,
    `İlk yatırım (FTD): ${e.ftd}`,
    `Bizim tarafımızda kayıtlı yönlendirme: ${e.clicks} tıklama`,
    `Talep edilen tutar: ${money(e.amount, e.currency)}`,
    '',
    'Ödeme bilgilerimizi teyit edip süreci başlatmanızı rica ederiz. Teşekkürler.',
  ].join('\n')
}

function EarningRow({ e, sites }: { e: EarningView; sites: MarketingSite[] }) {
  const [editing, setEditing] = useState(false)
  const [msg, setMsg] = useState<Msg>(null)
  const [pending, start] = useTransition()
  const epc = e.clicks ? e.amount / e.clicks : 0
  const status = EARNING_STATUSES.find((s) => s.id === e.status)

  if (editing) {
    return (
      <li className="rounded-xl border border-primary/40 bg-card p-4">
        <EarningEditor
          draft={{ id: e.id, siteId: String(e.siteId), period: e.period, model: e.model, ftd: String(e.ftd), amount: String(e.amount), currency: e.currency, note: e.note }}
          sites={sites}
          onClose={() => setEditing(false)}
        />
      </li>
    )
  }

  return (
    <li className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="font-semibold text-foreground">{e.siteName}</h4>
          <span className="font-mono text-xs text-muted-foreground">{e.period}</span>
          <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', STATUS_STYLE[e.status])}>{status?.label}</span>
        </div>
        <span className="text-lg font-bold tabular-nums text-foreground">{money(e.amount, e.currency)}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat title="Model" value={EARNING_MODELS.find((m) => m.id === e.model)?.label.split(' ')[0] ?? e.model} />
        <Stat title="FTD" value={fmt(e.ftd)} />
        <Stat title="Bizden giden tık." value={fmt(e.clicks)} hint="o ay, /git üzerinden" />
        <Stat title="Tık başı kazanç" value={epc ? money(epc, e.currency) : '—'} />
      </div>
      {e.note && <p className="text-xs text-muted-foreground">{e.note}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor={`st-${e.id}`}>
          Durum
        </label>
        <select
          id={`st-${e.id}`}
          className={cn(input, 'h-8 py-0 text-xs')}
          value={e.status}
          disabled={pending}
          onChange={(ev) => start(async () => setMsg(await setEarningStatusAction(e.id, ev.target.value as EarningStatus)))}
        >
          {EARNING_STATUSES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <CopyButton value={claimText(e)} text="Talep mesajını kopyala" />
        <button type="button" className={ghost} onClick={() => setEditing(true)}>
          <Pencil className="size-3.5" aria-hidden="true" /> Düzenle
        </button>
        <button
          type="button"
          className={cn(ghost, 'text-destructive')}
          disabled={pending}
          onClick={() => {
            void askConfirm('Bu hakediş kaydı silinsin mi?').then((ok) => {
      if (ok) start(async () => setMsg(await deleteEarningAction(e.id)))
    })
  }}
        >
          <Trash2 className="size-3.5" aria-hidden="true" /> Sil
        </button>
        <Note msg={msg} />
      </div>
    </li>
  )
}

export function EarningsManager({ earnings, sites }: { earnings: EarningView[]; sites: MarketingSite[] }) {
  const [filter, setFilter] = useState<EarningStatus | 'all'>('all')
  const summary = useMemo(() => {
    const out = new Map<string, Record<EarningStatus, number>>()
    for (const e of earnings) {
      const row = out.get(e.currency) ?? { pending: 0, claimed: 0, paid: 0, rejected: 0 }
      row[e.status] += e.amount
      out.set(e.currency, row)
    }
    return [...out.entries()]
  }, [earnings])
  const shown = filter === 'all' ? earnings : earnings.filter((e) => e.status === filter)

  return (
    <div className="flex flex-col gap-5">
      {summary.length > 0 && (
        <div className="flex flex-col gap-2">
          {summary.map(([currency, s]) => (
            <div key={currency} className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Stat title={`Bekleyen (${currency})`} value={money(s.pending, currency)} hint="talep edilmedi" />
              <Stat title={`Talep edilen (${currency})`} value={money(s.claimed, currency)} hint="ödeme bekleniyor" />
              <Stat title={`Tahsil edilen (${currency})`} value={money(s.paid, currency)} />
            </div>
          ))}
        </div>
      )}

      <section className="rounded-xl border border-border bg-card p-4" aria-labelledby="new-earning">
        <h3 id="new-earning" className="mb-1 font-semibold text-foreground">
          Hakediş kaydı ekle
        </h3>
        <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
          Her ay başında sponsorun affiliate panelindeki rakamları buraya gir. Bizim tıklama sayımızla yan yana görünür, tutarsızlık varsa hemen fark edersin.
        </p>
        <EarningEditor draft={{ siteId: '', period: lastMonth(), model: 'cpa', ftd: '', amount: '', currency: 'TRY', note: '' }} sites={sites} />
      </section>

      {earnings.length > 0 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Duruma göre filtrele">
          {[{ id: 'all', label: 'Tümü' }, ...EARNING_STATUSES].map((s) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={filter === s.id}
              className={cn(ghost, filter === s.id && 'border-primary bg-primary text-primary-foreground hover:bg-primary')}
              onClick={() => setFilter(s.id as EarningStatus | 'all')}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      {shown.length ? (
        <ul className="flex flex-col gap-3">
          {shown.map((e) => (
            <EarningRow key={e.id} e={e} sites={sites} />
          ))}
        </ul>
      ) : (
        <p className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          <Send className="size-4" aria-hidden="true" />
          {earnings.length ? 'Bu durumda kayıt yok.' : 'Henüz hakediş kaydı yok.'}
        </p>
      )}
    </div>
  )
}
