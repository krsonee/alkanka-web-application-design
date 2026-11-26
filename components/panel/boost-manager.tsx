'use client'

import { useEffect, useState, useTransition } from 'react'
import { Copy, Pencil, Plus, Trash2 } from 'lucide-react'
import { saveBoostsAction } from '@/app/panel/boost-actions'
import { askConfirm, notify } from '@/components/panel/confirm-dialog'
import { SideSheet } from '@/components/panel/side-sheet'
import { cn } from '@/lib/utils'
import {
  BOOST_SOURCES,
  CAMPAIGN_KINDS,
  MAX_CAMPAIGNS,
  MAX_TOTAL_MULT,
  WEEKDAYS,
  campaignDetail,
  campaignGap,
  campaignWindow,
  whenLabel,
  type BoostConfig,
  type Campaign,
  type CampaignWhen,
} from '@/lib/boosts-shared'

type Option = { id: string; name: string }

const label = 'flex flex-col gap-1 text-xs font-semibold text-muted-foreground'
const input = 'h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground'
const box = 'flex flex-col gap-3 rounded-2xl border border-border bg-card p-4'
const check = 'flex items-center gap-2 text-sm font-semibold text-foreground'
const ghost = 'flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-40'

const toLocal = (iso: string | null) => (iso ? new Date(Date.parse(iso) + 3 * 3_600_000).toISOString().slice(0, 16) : '')
const fromLocal = (v: string) => (v ? new Date(`${v}:00+03:00`).toISOString() : null)
const HOURS = Array.from({ length: 24 }, (_, h) => h)
const hourText = (h: number) => `${String(h).padStart(2, '0')}:00`
/** Monday first, the way a week is read in Turkey; the stored numbers stay Sunday = 0. */
const WEEK = [1, 2, 3, 4, 5, 6, 0]

const WHEN_TYPES: { id: CampaignWhen['type']; label: string; hint: string }[] = [
  { id: 'saat', label: 'Saat aralığı', hint: 'Her gün ya da seçtiğin günlerde, iki saat arasında.' },
  { id: 'hafta', label: 'Her hafta, günden güne', hint: 'Bir günden daha uzun süren haftalık pencere. Örnek: Cuma 18:00 → Pazartesi 00:00.' },
  { id: 'tarih', label: 'Bir kez, tarih aralığı', hint: 'Yazdığın bitiş anına kadar sürer, sonra kendiliğinden kapanır.' },
]

const DEFAULT_WHEN: Record<CampaignWhen['type'], CampaignWhen> = {
  saat: { type: 'saat', days: [], start: 20, end: 22 },
  hafta: { type: 'hafta', fromDay: 5, fromHour: 18, toDay: 1, toHour: 0 },
  tarih: { type: 'tarih', from: null, until: null },
}

const newCampaign = (): Campaign => ({
  id: `k${Date.now().toString(36)}`,
  name: '',
  on: true,
  kind: 'carpan',
  sources: [],
  mult: 2,
  pct: 20,
  badgeId: '',
  siteId: '',
  text: '',
  when: DEFAULT_WHEN.saat,
})

type Status = { text: string; tone: 'live' | 'wait' | 'off' | 'warn' }

function statusOf(c: Campaign, now: number | null): Status {
  if (!c.on) return { text: 'Kapalı', tone: 'off' }
  const gap = campaignGap(c)
  if (gap) return { text: gap, tone: 'warn' }
  if (now === null) return { text: 'Açık', tone: 'wait' }
  if (campaignWindow(c.when, now)) return { text: 'Şu an aktif', tone: 'live' }
  if (c.when.type === 'tarih' && c.when.until && Date.parse(c.when.until) <= now) return { text: 'Süresi doldu', tone: 'off' }
  return { text: 'Açık, zamanını bekliyor', tone: 'wait' }
}

const TONES: Record<Status['tone'], string> = {
  live: 'bg-success/15 text-success',
  wait: 'bg-primary/15 text-primary',
  off: 'bg-secondary text-muted-foreground',
  warn: 'bg-destructive/15 text-destructive',
}

function Picker({ value, onChange, options, empty, name }: { value: string; onChange: (id: string) => void; options: Option[]; empty: string; name: string }) {
  const known = options.some((o) => o.id === value)
  return (
    <select aria-label={name} className={input} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{empty}</option>
      {!known && value && <option value={value}>{value} (listede yok)</option>}
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.name}
        </option>
      ))}
    </select>
  )
}

function HourSelect({ value, onChange }: { value: number; onChange: (h: number) => void }) {
  return (
    <select className={input} value={value} onChange={(e) => onChange(Number(e.target.value))}>
      {HOURS.map((h) => (
        <option key={h} value={h}>
          {hourText(h)}
        </option>
      ))}
    </select>
  )
}

function DaySelect({ value, onChange }: { value: number; onChange: (d: number) => void }) {
  return (
    <select className={input} value={value} onChange={(e) => onChange(Number(e.target.value))}>
      {WEEK.map((d) => (
        <option key={d} value={d}>
          {WEEKDAYS[d]}
        </option>
      ))}
    </select>
  )
}

function CampaignForm({ draft, setDraft, badges, sites }: { draft: Campaign; setDraft: (c: Campaign) => void; badges: Option[]; sites: Option[] }) {
  const set = (patch: Partial<Campaign>) => setDraft({ ...draft, ...patch })
  const when = draft.when
  const kind = CAMPAIGN_KINDS.find((k) => k.id === draft.kind)
  const toggleSource = (id: Campaign['sources'][number]) =>
    set({ sources: draft.sources.includes(id) ? draft.sources.filter((s) => s !== id) : [...draft.sources, id] })

  return (
    <div className="flex flex-col gap-4">
      <label className={label}>
        Kampanya adı
        <input className={input} value={draft.name} maxLength={60} onChange={(e) => set({ name: e.target.value })} placeholder="Örn. Mutlu Saatler" />
        <span className="font-normal">Sitenin üstündeki şeritte bu ad görünür.</span>
      </label>

      <label className={label}>
        Kampanya ne yapacak
        <select className={input} value={draft.kind} onChange={(e) => set({ kind: e.target.value as Campaign['kind'] })}>
          {CAMPAIGN_KINDS.map((k) => (
            <option key={k.id} value={k.id}>
              {k.label}
            </option>
          ))}
        </select>
        <span className="font-normal leading-relaxed">{kind?.hint}</span>
      </label>

      {draft.kind === 'carpan' && (
        <>
          <fieldset className="flex flex-col gap-2 rounded-xl border border-border p-3">
            <legend className="px-1 text-xs font-semibold text-muted-foreground">Hangi kazançlar çarpılsın</legend>
            <div className="flex flex-wrap gap-2 text-xs">
              <button type="button" className="font-semibold text-primary underline" onClick={() => set({ sources: BOOST_SOURCES.map((s) => s.id) })}>
                Hepsini seç
              </button>
              <button type="button" className="font-semibold text-muted-foreground underline" onClick={() => set({ sources: [] })}>
                Temizle
              </button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {BOOST_SOURCES.map((s) => (
                <label key={s.id} className="flex items-start gap-2 text-sm text-foreground">
                  <input type="checkbox" name={`kaynak-${s.id}`} className="mt-0.5 size-4 shrink-0 accent-primary" checked={draft.sources.includes(s.id)} onChange={() => toggleSource(s.id)} />
                  {s.label}
                </label>
              ))}
            </div>
            {draft.sources.includes('kasa') && (
              <p className="rounded-lg border border-primary/40 bg-primary/5 px-2.5 py-2 text-xs leading-relaxed text-foreground text-pretty">
                Blackjack ve Rulet kasaya karşı oynanır: sınırsız çarpan bu iki oyunda masanın aldığından fazlasını öder. Bu yüzden çarpanın bir üyeye bir günde ekleyeceği coin sınırlıdır; sınırı aşağıdaki &quot;Seri ve sadakat&quot; kutusundan ayarlarsın. Sınır dolunca üye o gün normal kazancını almaya devam eder.
              </p>
            )}
          </fieldset>
          <label className={label}>
            Çarpan
            <input type="number" step={0.5} min={1} max={5} className={cn(input, 'w-32')} value={draft.mult} onChange={(e) => set({ mult: Number(e.target.value) })} />
            <span className="font-normal leading-relaxed">
              1 ile 5 arası. Aynı kazanca denk gelen kampanyalar birbiriyle çarpılır; toplam en fazla x{MAX_TOTAL_MULT} uygulanır.
            </span>
          </label>
        </>
      )}

      {draft.kind === 'rozet' && (
        <label className={label}>
          Rozet
          <Picker name="Rozet" value={draft.badgeId} onChange={(badgeId) => set({ badgeId })} options={badges} empty="Rozet seç" />
        </label>
      )}

      {(draft.kind === 'indirim' || draft.kind === 'rozet') && (
        <label className={label}>
          İndirim (%)
          <input type="number" min={1} max={90} className={cn(input, 'w-32')} value={draft.pct} onChange={(e) => set({ pct: Number(e.target.value) })} />
          <span className="font-normal leading-relaxed">İndirimler üst üste binmez: üyeye o an geçerli en yüksek indirim uygulanır.</span>
        </label>
      )}

      {draft.kind === 'sponsor' && (
        <label className={label}>
          Sponsor
          <Picker name="Sponsor" value={draft.siteId} onChange={(siteId) => set({ siteId })} options={sites} empty="Sponsor seç" />
        </label>
      )}

      <label className={label}>
        Şerit yazısı (isteğe bağlı)
        <input className={input} value={draft.text} maxLength={160} onChange={(e) => set({ text: e.target.value })} placeholder={campaignDetail({ ...draft, text: '' })} />
        <span className="font-normal leading-relaxed">Boş bırakırsan şeritte şu yazar: {campaignDetail({ ...draft, text: '' })}</span>
      </label>

      <fieldset className="flex flex-col gap-3 rounded-xl border border-border p-3">
        <legend className="px-1 text-xs font-semibold text-muted-foreground">Ne zaman geçerli (İstanbul saati)</legend>
        <div className="flex flex-col gap-2">
          {WHEN_TYPES.map((t) => (
            <label key={t.id} className="flex items-start gap-2 text-sm text-foreground">
              <input
                type="radio"
                name="zaman"
                value={t.id}
                className="mt-0.5 size-4 shrink-0 accent-primary"
                checked={when.type === t.id}
                onChange={() => set({ when: DEFAULT_WHEN[t.id] })}
              />
              <span className="flex flex-col gap-0.5">
                {t.label}
                <span className="text-xs leading-relaxed text-muted-foreground">{t.hint}</span>
              </span>
            </label>
          ))}
        </div>

        {when.type === 'saat' && (
          <>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-muted-foreground">Günler (hiçbiri seçili değilse her gün)</span>
              <div className="flex flex-wrap gap-1.5">
                {WEEK.map((d) => {
                  const on = when.days.includes(d)
                  return (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={on}
                      onClick={() => set({ when: { ...when, days: on ? when.days.filter((x) => x !== d) : [...when.days, d] } })}
                      className={cn('h-9 rounded-lg border px-3 text-xs font-semibold', on ? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted-foreground hover:text-foreground')}
                    >
                      {WEEKDAYS[d].slice(0, 3)}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className={label}>
                Başlangıç saati
                <HourSelect value={when.start} onChange={(start) => set({ when: { ...when, start } })} />
              </label>
              <label className={label}>
                Bitiş saati
                <HourSelect value={when.end} onChange={(end) => set({ when: { ...when, end } })} />
              </label>
            </div>
            {when.start > when.end && <p className="text-xs leading-relaxed text-muted-foreground">Bitiş saati başlangıçtan küçük: kampanya gece yarısını geçip ertesi gün {hourText(when.end)} saatinde biter.</p>}
          </>
        )}

        {when.type === 'hafta' && (
          <div className="grid grid-cols-2 gap-2">
            <label className={label}>
              Başlangıç günü
              <DaySelect value={when.fromDay} onChange={(fromDay) => set({ when: { ...when, fromDay } })} />
            </label>
            <label className={label}>
              Başlangıç saati
              <HourSelect value={when.fromHour} onChange={(fromHour) => set({ when: { ...when, fromHour } })} />
            </label>
            <label className={label}>
              Bitiş günü
              <DaySelect value={when.toDay} onChange={(toDay) => set({ when: { ...when, toDay } })} />
            </label>
            <label className={label}>
              Bitiş saati
              <HourSelect value={when.toHour} onChange={(toHour) => set({ when: { ...when, toHour } })} />
            </label>
          </div>
        )}

        {when.type === 'tarih' && (
          <div className="grid gap-2 sm:grid-cols-2">
            <label className={label}>
              Başlangıç (boşsa hemen)
              <input type="datetime-local" className={input} value={toLocal(when.from)} onChange={(e) => set({ when: { ...when, from: fromLocal(e.target.value) } })} />
            </label>
            <label className={label}>
              Bitiş
              <input type="datetime-local" className={input} value={toLocal(when.until)} onChange={(e) => set({ when: { ...when, until: fromLocal(e.target.value) } })} />
            </label>
          </div>
        )}
        <p className="text-xs leading-relaxed text-foreground">{whenLabel(when)}</p>
      </fieldset>

      <label className={check}>
        <input type="checkbox" name="acik" className="size-4 accent-primary" checked={draft.on} onChange={(e) => set({ on: e.target.checked })} />
        Kampanya açık
      </label>
    </div>
  )
}

export function BoostManager({ initial, badges, sites }: { initial: BoostConfig; badges: Option[]; sites: Option[] }) {
  const [saved, setSaved] = useState(initial)
  const [cfg, setCfg] = useState(initial)
  const [draft, setDraft] = useState<Campaign | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [now, setNow] = useState<number | null>(null)
  const [pending, start] = useTransition()

  useEffect(() => {
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])

  const set = <K extends keyof BoostConfig>(k: K, v: Partial<BoostConfig[K]>) =>
    setCfg((c) => ({ ...c, [k]: typeof c[k] === 'object' && !Array.isArray(c[k]) ? { ...(c[k] as object), ...v } : v }))

  /** Campaign changes are stored right away, on top of what was last saved: half-typed fields in the boxes below are not sent along. */
  const saveCampaigns = (campaigns: Campaign[], done: string, after?: () => void) =>
    start(async () => {
      const r = await saveBoostsAction({ ...saved, campaigns })
      if (!r.ok) return notify(false, r.error)
      setSaved(r.cfg)
      setCfg((c) => ({ ...c, campaigns: r.cfg.campaigns }))
      notify(true, done)
      after?.()
    })

  const saveRest = () =>
    start(async () => {
      const r = await saveBoostsAction({ ...cfg, campaigns: saved.campaigns })
      if (!r.ok) return notify(false, r.error)
      setSaved(r.cfg)
      setCfg(r.cfg)
      notify(true, 'Hediye, seri ve sponsor ayarları kaydedildi.')
    })

  const list = saved.campaigns
  const full = list.length >= MAX_CAMPAIGNS
  const restChanged = JSON.stringify({ ...cfg, campaigns: null }) !== JSON.stringify({ ...saved, campaigns: null })

  const submitDraft = () => {
    if (!draft) return
    const next = isNew ? [...list, draft] : list.map((c) => (c.id === draft.id ? draft : c))
    saveCampaigns(next, isNew ? 'Kampanya eklendi.' : 'Kampanya kaydedildi.', () => setDraft(null))
  }

  return (
    <section aria-labelledby="boost-title" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-0 flex-1 basis-80 flex-col gap-1">
          <h2 id="boost-title" className="font-display text-lg font-bold text-foreground">Kampanyalar ve çarpanlar</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Şu an aktif olan kampanyalar sitenin üstünde geri sayımlı şerit olarak görünür. Saatler İstanbul saatidir. Aynı kazanca denk gelen çarpanlar
            birbiriyle çarpılır, toplam en fazla x{MAX_TOTAL_MULT}.
          </p>
        </div>
        <button
          type="button"
          disabled={pending || full}
          onClick={() => {
            setIsNew(true)
            setDraft(newCampaign())
          }}
          className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50"
        >
          <Plus className="size-4" aria-hidden /> Yeni kampanya
        </button>
      </div>

      {list.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          Henüz kampanya yok. &quot;Yeni kampanya&quot; ile ilkini aç.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {list.map((c) => {
            const status = statusOf(c, now)
            const kind = CAMPAIGN_KINDS.find((k) => k.id === c.kind)?.label ?? c.kind
            return (
              <li key={c.id} data-find={`kampanya-${c.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                <div className="flex min-w-0 flex-1 basis-72 flex-col gap-0.5">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-semibold text-foreground">{c.name}</span>
                    <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', TONES[status.tone])}>{status.text}</span>
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {kind} · {campaignDetail(c)}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">{whenLabel(c.when)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={c.on}
                    aria-label={`${c.name} kampanyası ${c.on ? 'açık' : 'kapalı'}`}
                    disabled={pending}
                    onClick={() => saveCampaigns(list.map((x) => (x.id === c.id ? { ...x, on: !x.on } : x)), c.on ? `${c.name} kapatıldı.` : `${c.name} açıldı.`)}
                    className={cn('h-9 rounded-lg border px-3 text-xs font-semibold disabled:opacity-40', c.on ? 'border-primary text-primary' : 'border-border text-muted-foreground')}
                  >
                    {c.on ? 'Açık' : 'Kapalı'}
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      setIsNew(false)
                      setDraft(c)
                    }}
                    aria-label={`${c.name} kampanyasını düzenle`}
                    title="Düzenle"
                    className={ghost}
                  >
                    <Pencil className="size-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    disabled={pending || full}
                    onClick={() => {
                      setIsNew(true)
                      setDraft({ ...c, id: newCampaign().id, name: `${c.name} (kopya)`.slice(0, 60), on: false })
                    }}
                    aria-label={`${c.name} kampanyasını kopyala`}
                    title="Kopyala"
                    className={ghost}
                  >
                    <Copy className="size-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      void askConfirm(`"${c.name}" kampanyası silinsin mi? Şu an aktifse hemen biter.`).then(
                        (ok) => ok && saveCampaigns(list.filter((x) => x.id !== c.id), `${c.name} silindi.`),
                      )
                    }
                    aria-label={`${c.name} kampanyasını sil`}
                    title="Sil"
                    className={cn(ghost, 'hover:bg-destructive/15 hover:text-destructive')}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
      {full && <p className="text-xs text-muted-foreground">En fazla {MAX_CAMPAIGNS} kampanya olabilir. Yenisi için kullanmadığın birini sil.</p>}

      <div className="flex flex-col gap-1 pt-2">
        <h3 className="font-display text-base font-bold text-foreground">Hediyeler, seri ve sponsor hatırlatmaları</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">Bu ayarlar kampanya listesinden ayrıdır; alttaki düğmeyle kaydedilir.</p>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className={box}>
          <label className={check}><input type="checkbox" className="size-4 accent-primary" checked={cfg.comeback.on} onChange={(e) => set('comeback', { on: e.target.checked })} />Geri dönüş hediyesi</label>
          <div className="grid grid-cols-2 gap-2">
            <label className={label}>Kaç gün yoksa<input type="number" min={3} max={60} className={input} value={cfg.comeback.days} onChange={(e) => set('comeback', { days: Number(e.target.value) })} /></label>
            <label className={label}>Coin<input type="number" min={0} className={input} value={cfg.comeback.coin} onChange={(e) => set('comeback', { coin: Number(e.target.value) })} /></label>
          </div>
          <label className={check}><input type="checkbox" className="size-4 accent-primary" checked={cfg.birthday.on} onChange={(e) => set('birthday', { on: e.target.checked })} />Doğum günü hediyesi</label>
          <label className={label}>Doğum günü coin<input type="number" min={0} className={input} value={cfg.birthday.coin} onChange={(e) => set('birthday', { coin: Number(e.target.value) })} /></label>
        </div>

        <div className={box}>
          <span className="text-sm font-semibold text-foreground">Seri ve sadakat</span>
          <div className="grid grid-cols-3 gap-2">
            <label className={label}>14 gün seri KP<input type="number" min={0} className={input} value={cfg.streak14} onChange={(e) => setCfg((c) => ({ ...c, streak14: Number(e.target.value) }))} /></label>
            <label className={label}>Kalkan fiyatı KC<input type="number" min={1} className={input} value={cfg.shieldPrice} onChange={(e) => setCfg((c) => ({ ...c, shieldPrice: Number(e.target.value) }))} /></label>
            <label className={label}>Sadakat günü<input type="number" min={7} max={365} className={input} value={cfg.loyaltyDays} onChange={(e) => setCfg((c) => ({ ...c, loyaltyDays: Number(e.target.value) }))} /></label>
          </div>
          <label className={label}>
            Blackjack ve Rulette çarpanın bir üyeye günde ekleyeceği en fazla coin
            <input type="number" min={0} max={1000000} className={input} value={cfg.houseCap} onChange={(e) => setCfg((c) => ({ ...c, houseCap: Number(e.target.value) }))} />
          </label>
          <p className="text-xs leading-relaxed text-muted-foreground text-pretty">
            Sadece kazanç türlerinde &quot;Blackjack ve Rulette kazanılan kâr&quot; işaretli bir çarpan kampanyası çalışırken işler. 0 yazarsan çarpan bu iki oyunda hiç işlemez.
          </p>
        </div>

        <div className={box}>
          <label className={check}><input type="checkbox" className="size-4 accent-primary" checked={cfg.bestBonus.on} onChange={(e) => set('bestBonus', { on: e.target.checked })} />Haftanın en iyi bonusu vitrini</label>
          <div className="grid grid-cols-2 gap-2">
            <label className={label}>Sponsor<Picker name="Vitrin sponsoru" value={cfg.bestBonus.siteId} onChange={(siteId) => set('bestBonus', { siteId })} options={sites} empty="Sponsor seç" /></label>
            <label className={label}>Tıklama KP<input type="number" min={0} className={input} value={cfg.bestBonus.kp} onChange={(e) => set('bestBonus', { kp: Number(e.target.value) })} /></label>
          </div>
          <label className={label}>Başlık<input className={input} value={cfg.bestBonus.title} onChange={(e) => set('bestBonus', { title: e.target.value })} /></label>
          <label className={label}>Metin<input className={input} value={cfg.bestBonus.text} onChange={(e) => set('bestBonus', { text: e.target.value })} /></label>
        </div>

        <div className={box}>
          <span className="text-sm font-semibold text-foreground">Kayıp bonusu (cashback) günleri</span>
          {cfg.cashback.map((c, i) => (
            <div key={i} className="grid grid-cols-2 items-end gap-2 sm:grid-cols-[1fr_1fr_2fr_auto]">
              <label className={label}>Sponsor<Picker name="Kayıp bonusu sponsoru" value={c.siteId} onChange={(siteId) => setCfg((s) => ({ ...s, cashback: s.cashback.map((x, j) => (j === i ? { ...x, siteId } : x)) }))} options={sites} empty="Sponsor seç" /></label>
              <label className={label}>Gün
                <select className={input} value={c.weekday} onChange={(e) => setCfg((s) => ({ ...s, cashback: s.cashback.map((x, j) => (j === i ? { ...x, weekday: Number(e.target.value) } : x)) }))}>
                  {WEEKDAYS.map((d, n) => <option key={d} value={n}>{d}</option>)}
                </select>
              </label>
              <label className={label}>Metin<input className={input} value={c.text} onChange={(e) => setCfg((s) => ({ ...s, cashback: s.cashback.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) }))} /></label>
              <button type="button" onClick={() => setCfg((s) => ({ ...s, cashback: s.cashback.filter((_, j) => j !== i) }))} className="h-10 rounded-lg border border-border px-3 text-sm text-foreground">Sil</button>
            </div>
          ))}
          <button type="button" onClick={() => setCfg((s) => ({ ...s, cashback: [...s.cashback, { siteId: '', weekday: 1, text: '' }] }))} className="h-10 self-start rounded-lg border border-border px-4 text-sm font-semibold text-foreground">Gün ekle</button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" disabled={pending || !restChanged} onClick={saveRest} className="h-10 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50">Kaydet</button>
        <span role="status" className="text-sm text-muted-foreground">{restChanged ? 'Kaydedilmemiş değişiklik var.' : 'Değişiklik yok.'}</span>
      </div>

      {draft && (
        <SideSheet
          title={isNew ? 'Yeni kampanya' : draft.name || 'Kampanya'}
          eyebrow="Kampanyalar ve çarpanlar"
          onClose={() => setDraft(null)}
          footer={
            <>
              <button type="button" disabled={pending || !draft.name.trim()} onClick={submitDraft} className="h-10 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50">
                {pending ? 'Kaydediliyor...' : isNew ? 'Kampanyayı ekle' : 'Kaydet'}
              </button>
              {campaignGap(draft) && draft.on && <span className="text-xs text-destructive">{campaignGap(draft)}: bu haliyle kampanya çalışmaz.</span>}
            </>
          }
        >
          <CampaignForm draft={draft} setDraft={setDraft} badges={badges} sites={sites} />
        </SideSheet>
      )}
    </section>
  )
}
