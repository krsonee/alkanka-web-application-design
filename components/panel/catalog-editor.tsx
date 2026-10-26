'use client'


import { askConfirm } from '@/components/panel/confirm-dialog'
import { ImageField } from '@/components/panel/image-field'
import { useState, useTransition } from 'react'
import { ArrowDown, ArrowUp, ChevronDown, Loader2, Plus, RotateCcw, Save, Trash2 } from 'lucide-react'
import { resetCatalog, saveCatalogList, saveCategoryOrder } from '@/app/panel/catalog-actions'
import { BONUS_TYPES, EVENT_KINDS, sortByOrder, type Catalog, type CategoryOrder } from '@/lib/catalog-shared'
import { cn } from '@/lib/utils'
import { HideButton } from '@/components/panel/hide-button'
import type { HiddenMap, HiddenScope } from '@/lib/hidden-shared'

type Kind = 'events' | 'predictions' | 'campaigns' | 'bonuses'
const SCOPE: Record<Kind, HiddenScope> = { events: 'event', predictions: 'prediction', campaigns: 'campaign', bonuses: 'bonus' }
type Item = Record<string, unknown>
type Option = { id: string; name: string }

type Field =
  | { key: string; label: string; type: 'text' | 'textarea' | 'image'; max?: number; wide?: boolean }
  | { key: string; label: string; type: 'number' }
  | { key: string; label: string; type: 'select'; options: string[] }
  | { key: string; label: string; type: 'sponsor' }
  | { key: string; label: string; type: 'lines'; hint: string }
  | { key: string; label: string; type: 'pairs'; hint: string; a: string; b: string; numericB?: boolean }

const SCHEMAS: Record<Kind, { title: string; hint: string; field: string; fields: Field[]; blank: () => Item }> = {
  events: {
    title: 'Etkinlikler & biletler',
    hint: 'Etkinlikler sayfasındaki bilet kartları. Bilet fiyatı Kanka Coin olarak düşülür.',
    field: 'title',
    fields: [
      { key: 'title', label: 'Başlık', type: 'text', max: 60 },
      { key: 'kind', label: 'Tür', type: 'select', options: EVENT_KINDS },
      { key: 'subtitle', label: 'Alt başlık', type: 'text', max: 80, wide: true },
      { key: 'entry', label: 'Bilet fiyatı (KC)', type: 'number' },
      { key: 'prize', label: 'Ödül', type: 'text', max: 60 },
      { key: 'hoursLeft', label: 'Kalan saat', type: 'number' },
      { key: 'participants', label: 'Katılımcı', type: 'number' },
      { key: 'image', label: 'Görsel', type: 'image', wide: true },
      { key: 'description', label: 'Açıklama', type: 'textarea', max: 600, wide: true },
      { key: 'steps', label: 'Nasıl katılınır', type: 'lines', hint: 'Her satır bir adım' },
      { key: 'rules', label: 'Kurallar', type: 'lines', hint: 'Her satır bir kural' },
      { key: 'prizes', label: 'Ödül sıralaması', type: 'pairs', hint: 'Satır başına: sıra | ödül', a: 'place', b: 'prize' },
    ],
    blank: () => ({ id: '', kind: 'Haftalık', title: 'Yeni etkinlik', subtitle: '', hoursLeft: 72, participants: 0, entry: 100, prize: '', image: '/images/banner-events.png', description: '', steps: [], rules: [], prizes: [] }),
  },
  predictions: {
    title: 'Maç tahminleri',
    hint: 'Doğru tahmin edene verilecek puanı belirle. Seçenek oyları sitede birikir.',
    field: 'home',
    fields: [
      { key: 'league', label: 'Lig', type: 'text', max: 40 },
      { key: 'kickoff', label: 'Başlama', type: 'text', max: 30 },
      { key: 'home', label: 'Ev sahibi', type: 'text', max: 30 },
      { key: 'away', label: 'Deplasman', type: 'text', max: 30 },
      { key: 'reward', label: 'Ödül (KC)', type: 'number' },
      { key: 'options', label: 'Seçenekler', type: 'pairs', hint: 'Satır başına: seçenek | oy', a: 'label', b: 'votes', numericB: true },
    ],
    blank: () => ({ id: '', league: 'Süper Lig', home: 'Ev sahibi', away: 'Deplasman', kickoff: 'Bugün 20:00', reward: 100, options: [{ id: 'o1', label: '1', votes: 0 }, { id: 'o2', label: 'X', votes: 0 }, { id: 'o3', label: '2', votes: 0 }] }),
  },
  campaigns: {
    title: 'Sponsor kampanyaları',
    hint: 'Kampanyalar sayfası ve “Bitmek üzere” şeridi.',
    field: 'title',
    fields: [
      { key: 'title', label: 'Başlık', type: 'text', max: 60 },
      { key: 'sponsorId', label: 'Sponsor', type: 'sponsor' },
      { key: 'tag', label: 'Etiket', type: 'text', max: 20 },
      { key: 'ends', label: 'Bitiş yazısı', type: 'text', max: 30 },
      { key: 'hoursLeft', label: 'Kalan saat', type: 'number' },
      { key: 'image', label: 'Görsel', type: 'image', wide: true },
      { key: 'description', label: 'Açıklama', type: 'textarea', max: 300, wide: true },
    ],
    blank: () => ({ id: '', sponsorId: '', title: 'Yeni kampanya', description: '', ends: '7 gün kaldı', image: '/images/banner-events.png', tag: 'Kampanya', hoursLeft: 168 }),
  },
  bonuses: {
    title: 'Sponsor bonusları',
    hint: 'Bonuslar listesi. Kod boşsa “kod gerekmez” gösterilir.',
    field: 'title',
    fields: [
      { key: 'title', label: 'Başlık', type: 'text', max: 60 },
      { key: 'sponsorId', label: 'Sponsor', type: 'sponsor' },
      { key: 'type', label: 'Tür', type: 'select', options: BONUS_TYPES },
      { key: 'amount', label: 'Tutar', type: 'text', max: 40 },
      { key: 'wager', label: 'Çevrim', type: 'text', max: 30 },
      { key: 'code', label: 'Promo kod', type: 'text', max: 30 },
    ],
    blank: () => ({ id: '', sponsorId: '', type: 'Hoş geldin', title: 'Yeni bonus', amount: '', wager: '', code: '' }),
  },
}

const input = 'w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none'

function toPairs(v: unknown, a: string, b: string) {
  return Array.isArray(v) ? v.map((p: Item) => `${p[a] ?? ''} | ${p[b] ?? ''}`).join('\n') : ''
}

function fromPairs(text: string, a: string, b: string, numericB?: boolean, prev?: unknown) {
  const old = Array.isArray(prev) ? (prev as Item[]) : []
  return text
    .split('\n')
    .map((line) => line.split('|').map((s) => s.trim()))
    .filter(([x]) => x)
    .map(([x, y = ''], i) => ({
      ...(a === 'label' ? { id: (old[i]?.id as string) || `o${i + 1}` } : {}),
      [a]: x,
      [b]: numericB ? Math.max(0, Number(y) || 0) : y,
    }))
}

function FieldInput({ field, item, set, sponsors, library }: { field: Field; item: Item; set: (v: Item) => void; sponsors: Option[]; library: string[] }) {
  const value = item[field.key]
  const wide = field.type === 'lines' || field.type === 'pairs' || ('wide' in field && field.wide)
  const id = `${String(item.id)}-${field.key}`
  return (
    <label htmlFor={id} className={cn('flex flex-col gap-1.5 text-xs font-medium text-muted-foreground', wide && 'md:col-span-2')}>
      <span>
        {field.label}
        {'hint' in field && <span className="ml-1 font-normal opacity-70">· {field.hint}</span>}
      </span>
      {field.type === 'number' ? (
        <input id={id} type="number" min={0} className={input} value={Number(value ?? 0)} onChange={(e) => set({ [field.key]: Number(e.target.value) })} />
      ) : field.type === 'select' ? (
        <select id={id} className={input} value={String(value ?? '')} onChange={(e) => set({ [field.key]: e.target.value })}>
          {field.options.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      ) : field.type === 'sponsor' ? (
        <select id={id} className={input} value={String(value ?? '')} onChange={(e) => set({ [field.key]: e.target.value })}>
          <option value="">Sponsor seç</option>
          {sponsors.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
          {value && !sponsors.some((s) => s.id === value) ? <option value={String(value)}>{String(value)}</option> : null}
        </select>
      ) : field.type === 'textarea' ? (
        <textarea id={id} rows={3} maxLength={field.max} className={cn(input, 'resize-y leading-relaxed')} value={String(value ?? '')} onChange={(e) => set({ [field.key]: e.target.value })} />
      ) : field.type === 'lines' ? (
        <textarea id={id} rows={3} className={cn(input, 'resize-y leading-relaxed')} defaultValue={Array.isArray(value) ? value.join('\n') : ''} onBlur={(e) => set({ [field.key]: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) })} />
      ) : field.type === 'pairs' ? (
        <textarea id={id} rows={3} className={cn(input, 'resize-y font-mono leading-relaxed')} defaultValue={toPairs(value, field.a, field.b)} onBlur={(e) => set({ [field.key]: fromPairs(e.target.value, field.a, field.b, field.numericB, value) })} />
      ) : field.type === 'image' ? (
        <ImageField
          value={String(value ?? '')}
          onChange={(url) => set({ [field.key]: url })}
          library={library}
          uploadId={`catalog-${field.key}`}
          placeholder="/images/... veya https://..."
        />
      ) : (
        <input id={id} maxLength={field.max} className={input} value={String(value ?? '')} onChange={(e) => set({ [field.key]: e.target.value })} />
      )}
    </label>
  )
}

const EVENT_TEMPLATES: Item[] = [
  { kind: 'Haftalık', title: 'Tavla Haftası', subtitle: 'En çok maç kazanan ödülü alır', hoursLeft: 168, entry: 0, prize: '5.000 KC', description: 'Hafta boyunca tavla masalarında en çok galibiyet alan ilk 3 oyuncu ödül kazanır.', steps: ['Tavla masasına otur', 'Maçları sonuna kadar oyna', 'Sıralamayı takip et'], rules: ['Yarıda bırakılan maçlar sayılmaz', 'Aynı rakiple en fazla 5 maç sayılır'], prizes: ['1. 2.500 KC', '2. 1.500 KC', '3. 1.000 KC'] },
  { kind: 'Günlük', title: 'Okey Gecesi', subtitle: 'Bu akşam canlı Okey masaları', hoursLeft: 24, entry: 0, prize: '1.000 KC', description: 'Bu gece Okey ve 101 Okey masalarında en çok el kazanan oyuncu ödülü alır.', steps: ['Okey ya da 101 masasına otur', 'El kazan', 'Gece yarısı sonuçları gör'], rules: ['Sadece canlı masalar sayılır'], prizes: ['1. 1.000 KC'] },
  { kind: 'Haftalık', title: 'Batak Ligi', subtitle: 'Haftalık puan yarışı', hoursLeft: 168, entry: 50, prize: '3.000 KC', description: 'Batak masalarında kazandığın her el lig puanı getirir. Hafta sonunda zirvedekiler kazanır.', steps: ['Lige katıl', 'Batak masalarında el kazan', 'Lig tablosunu takip et'], rules: ['Katılım ücreti bir kez alınır'], prizes: ['1. 1.500 KC', '2. 1.000 KC', '3. 500 KC'] },
  { kind: 'Özel', title: 'Bilardo Düellosu', subtitle: 'Birebir eleme turnuvası', hoursLeft: 72, entry: 100, prize: '2.000 KC', description: 'Amerikan Bilardo düellolarında rakiplerini eleyerek finale çık.', steps: ['Kaydını yap', 'Eşleşmeni bekle', 'Düelloyu kazan'], rules: ['Faul kuralları geçerlidir', 'Süreyi dolduran faul yer'], prizes: ['Şampiyon 2.000 KC'] },
]

type SaveResult = { ok: true; message: string } | { ok: false; error: string }

function CategoryOrderEditor({ title, values, order, onSave }: { title: string; values: string[]; order: string[]; onSave: (next: string[]) => Promise<SaveResult> }) {
  const [list, setList] = useState(() => sortByOrder(values, order))
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, start] = useTransition()
  const synced = sortByOrder(values, list)

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= synced.length) return
    const next = [...synced]
    ;[next[i], next[j]] = [next[j], next[i]]
    setList(next)
    setStatus(null)
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-background p-3">
      <div className="flex flex-col gap-0.5">
        <span className="text-xs font-semibold text-foreground">{title}</span>
        <span className="text-xs text-muted-foreground">Sitedeki filtre butonları bu sırayla görünür. “Tümü” her zaman en başta kalır.</span>
      </div>
      <ol className="flex flex-col gap-1.5">
        {synced.map((name, i) => (
          <li key={name} className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
            <span className="w-5 text-xs font-bold tabular-nums text-muted-foreground">{i + 1}</span>
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{name}</span>
            <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`${name} yukarı taşı`} className="flex size-8 items-center justify-center rounded-md border border-border text-foreground hover:bg-secondary disabled:opacity-30">
              <ArrowUp className="size-4" aria-hidden />
            </button>
            <button type="button" onClick={() => move(i, 1)} disabled={i === synced.length - 1} aria-label={`${name} aşağı taşı`} className="flex size-8 items-center justify-center rounded-md border border-border text-foreground hover:bg-secondary disabled:opacity-30">
              <ArrowDown className="size-4" aria-hidden />
            </button>
          </li>
        ))}
        {synced.length === 0 && <li className="text-xs text-muted-foreground">Henüz kategori yok.</li>}
      </ol>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await onSave(synced)
              setStatus(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error })
            })
          }
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-60"
        >
          {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Save className="size-3.5" aria-hidden />}
          Sıralamayı kaydet
        </button>
        {status && (
          <p role="status" className={cn('text-xs', status.ok ? 'text-primary' : 'text-destructive')}>
            {status.text}
          </p>
        )}
      </div>
    </div>
  )
}

function ListEditor({ kind, initial, sponsors, library, hidden, order, setOrder }: { kind: Kind; initial: Item[]; sponsors: Option[]; library: string[]; hidden: string[]; order: CategoryOrder; setOrder: (o: CategoryOrder) => void }) {
  const schema = SCHEMAS[kind]
  const [items, setItems] = useState<Item[]>(initial)
  const [open, setOpen] = useState<number | null>(null)
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, start] = useTransition()

  const update = (i: number, v: Item) => setItems((list) => list.map((x, j) => (j === i ? { ...x, ...v } : x)))
  const add = () => {
    setItems((list) => [{ ...schema.blank(), id: `${kind}-${Date.now().toString(36)}` }, ...list])
    setOpen(0)
  }
  const remove = (i: number) => {
    void askConfirm('Bu kayıt silinsin mi?').then((ok) => {
      if (!ok) return
    setItems((list) => list.filter((_, j) => j !== i))
    setOpen(null)
    })
  }
  const save = () =>
    start(async () => {
      const r = await saveCatalogList(kind, items)
      setStatus(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error })
    })
  const reset = () => {
    void askConfirm('Bu liste varsayılana dönsün mü? Yaptığın değişiklikler silinir.').then((ok) => {
      if (!ok) return
    start(async () => {
      const r = await resetCatalog(kind)
      setStatus(r.ok ? { ok: true, text: `${r.message} Sayfayı yenile.` } : { ok: false, text: r.error })
    })
    })
  }

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-sm font-semibold text-foreground">
            {schema.title} <span className="font-normal text-muted-foreground">· {items.length}</span>
          </h3>
          <p className="text-xs leading-relaxed text-muted-foreground">{schema.hint}</p>
        </div>
        <button type="button" onClick={add} className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-foreground hover:bg-secondary">
          <Plus className="size-3.5" aria-hidden />
          Yeni ekle
        </button>
      </header>

      {(kind === 'campaigns' || kind === 'bonuses') && (
        <CategoryOrderEditor
          title={kind === 'campaigns' ? 'Kampanya etiketi sıralaması' : 'Bonus türü sıralaması'}
          values={
            kind === 'campaigns'
              ? items.map((x) => String(x.tag || '')).filter(Boolean)
              : [...items.map((x) => String(x.type || '')).filter(Boolean), ...BONUS_TYPES]
          }
          order={kind === 'campaigns' ? order.campaignTags : order.bonusTypes}
          onSave={async (next) => {
            const updated = kind === 'campaigns' ? { ...order, campaignTags: next } : { ...order, bonusTypes: next }
            const r = await saveCategoryOrder(updated)
            if (r.ok) setOrder(updated)
            return r
          }}
        />
      )}

      {kind === 'events' && (
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-background p-3">
          <span className="text-xs font-semibold text-muted-foreground">Hazır oyun etkinlikleri (listeye ekler, düzenleyip kaydet)</span>
          <div className="flex flex-wrap gap-1.5">
            {EVENT_TEMPLATES.map((t) => (
              <button
                key={String(t.title)}
                type="button"
                onClick={() => {
                  setItems((list) => [{ ...schema.blank(), ...t, id: `events-${Date.now().toString(36)}` }, ...list])
                  setOpen(0)
                }}
                className="rounded-full border border-border px-2.5 py-1 text-xs font-semibold text-foreground hover:border-primary hover:text-primary"
              >
                {String(t.title)}
              </button>
            ))}
          </div>
        </div>
      )}

      <ul className="flex flex-col gap-2">
        {items.map((item, i) => {
          const expanded = open === i
          const id = String(item.id)
          const isHidden = hidden.includes(id)
          const name = kind === 'predictions' ? `${item.home} - ${item.away}` : String(item[schema.field] || 'Adsız')
          return (
            <li key={id} className={cn('overflow-hidden rounded-xl border border-border', isHidden && 'border-dashed')}>
              <div className="flex items-center gap-2 pr-2 hover:bg-secondary/60">
                <button type="button" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : i)} className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left">
                  <span className={cn('min-w-0 flex-1 truncate text-sm font-medium', isHidden ? 'text-muted-foreground line-through' : 'text-foreground')}>{name}</span>
                  {isHidden && <span className="shrink-0 text-xs font-bold uppercase text-muted-foreground">Gizli</span>}
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {kind === 'events' ? `${item.entry} KC` : kind === 'predictions' ? `${item.reward} KC` : String(item.sponsorId || '')}
                  </span>
                  <ChevronDown className={cn('size-4 shrink-0 text-muted-foreground transition-transform', expanded && 'rotate-180')} aria-hidden />
                </button>
                <HideButton key={`${id}-${isHidden}`} kind={SCOPE[kind]} id={id} hidden={isHidden} label={name} />
              </div>
              {expanded && (
                <div className="flex flex-col gap-3 border-t border-border p-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    {schema.fields.map((f) => (
                      <FieldInput key={f.key} field={f} item={item} set={(v) => update(i, v)} sponsors={sponsors} library={library} />
                    ))}
                  </div>
                  <button type="button" onClick={() => remove(i)} className="inline-flex items-center gap-1.5 self-start rounded-lg px-2 py-1.5 text-xs text-destructive hover:bg-destructive/10">
                    <Trash2 className="size-3.5" aria-hidden />
                    Sil
                  </button>
                </div>
              )}
            </li>
          )
        })}
        {items.length === 0 && <li className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">Liste boş, sitede bu bölüm gizlenir.</li>}
      </ul>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={save} disabled={pending} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60">
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Save className="size-4" aria-hidden />}
          Kaydet
        </button>
        <button type="button" onClick={reset} disabled={pending} className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2.5 text-sm text-foreground hover:bg-secondary disabled:opacity-60">
          <RotateCcw className="size-4" aria-hidden />
          Varsayılan
        </button>
        {status && (
          <p role="status" className={cn('text-sm', status.ok ? 'text-primary' : 'text-destructive')}>
            {status.text}
          </p>
        )}
      </div>
    </section>
  )
}

const TABS: { id: Kind; label: string }[] = [
  { id: 'events', label: 'Etkinlik & bilet' },
  { id: 'predictions', label: 'Tahminler' },
  { id: 'campaigns', label: 'Kampanyalar' },
  { id: 'bonuses', label: 'Bonuslar' },
]

export function CatalogEditor({ catalog, sponsors, library, hidden = {} }: { catalog: Omit<Catalog, 'rewards'>; sponsors: Option[]; library: string[]; hidden?: HiddenMap }) {
  const [tab, setTab] = useState<Kind>('events')
  const [order, setOrder] = useState<CategoryOrder>(catalog.order ?? { campaignTags: [], bonusTypes: [] })
  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label="Katalog bölümleri" className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn('rounded-full border px-4 py-2 text-sm font-medium transition-colors', tab === t.id ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-foreground hover:bg-secondary')}
          >
            {t.label}
          </button>
        ))}
      </div>
      {TABS.map((t) =>
        t.id === tab ? <ListEditor key={t.id} kind={t.id} initial={catalog[t.id] as unknown as Item[]} sponsors={sponsors} library={library} hidden={hidden[SCOPE[t.id]] ?? []} order={order} setOrder={setOrder} /> : null,
      )}
    </div>
  )
}
