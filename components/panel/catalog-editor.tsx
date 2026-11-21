'use client'


import { askConfirm } from '@/components/panel/confirm-dialog'
import { ImageField } from '@/components/panel/image-field'
import { useRef, useState, useTransition } from 'react'
import { useUrlTab } from '@/components/panel/use-url-tab'
import { CatalogCalendar, type CalendarTournament } from '@/components/panel/catalog-calendar'
import { ArrowDown, ArrowUp, ChevronDown, Loader2, Plus, RotateCcw, Save, Trash2 } from 'lucide-react'
import { loadEventBoard, loadPredictionPicks, resetCatalog, saveCatalogList, saveCategoryOrder, settleEventNow } from '@/app/panel/catalog-actions'
import { EVENT_GAME_OPTIONS, EVENT_RANKS, RANK_LABEL, RANK_SHORT, cleanPayouts, eventGameLabel, lastPrizePlace, parseKc, payoutTotal, type EventRank } from '@/lib/event-rules'
import { BONUS_TYPES, EVENT_KINDS, PREDICTION_PAYOUT, predictionPayout, sortByOrder, type Catalog, type CategoryOrder } from '@/lib/catalog-shared'
import type { LeagueMatch } from '@/lib/predictions'
import { LeagueAdmin } from '@/components/panel/league-admin'
import { GoalAdmin } from '@/components/panel/goal-admin'
import { PickList } from '@/components/panel/pick-list'
import { cn } from '@/lib/utils'
import { HideButton } from '@/components/panel/hide-button'
import { RecordLink } from '@/components/panel/record-link'
import type { HiddenMap, HiddenScope } from '@/lib/hidden-shared'

type Kind = 'events' | 'predictions' | 'campaigns' | 'bonuses'
const SCOPE: Record<Kind, HiddenScope> = { events: 'event', predictions: 'prediction', campaigns: 'campaign', bonuses: 'bonus' }
type Item = Record<string, unknown>
type Option = { id: string; name: string }

type Field =
  | { key: string; label: string; type: 'text' | 'textarea' | 'image'; max?: number; wide?: boolean }
  | { key: string; label: string; type: 'number' }
  | { key: string; label: string; type: 'datetime' }
  | { key: string; label: string; type: 'select'; options: string[] }
  | { key: string; label: string; type: 'choice'; options: { value: string; label: string }[] }
  | { key: string; label: string; type: 'sponsor' }
  | { key: string; label: string; type: 'lines'; hint: string }
  | { key: string; label: string; type: 'pairs'; hint: string; a: string; b: string; numericB?: boolean }

const SCHEMAS: Record<Kind, { title: string; hint: string; field: string; fields: Field[]; blank: () => Item }> = {
  events: {
    title: 'Etkinlikler & biletler',
    hint: 'Etkinlikler sayfasındaki bilet kartları. Bilet fiyatı Kanka Coin olarak düşülür. Sıralama türü seçilen etkinlikte güncel sıralama sitede görünür ve ödüller bitiş tarihinde kendiliğinden dağıtılır.',
    field: 'title',
    fields: [
      { key: 'title', label: 'Başlık', type: 'text', max: 60 },
      { key: 'kind', label: 'Tür', type: 'select', options: EVENT_KINDS },
      { key: 'subtitle', label: 'Alt başlık', type: 'text', max: 80, wide: true },
      { key: 'startsAt', label: 'Başlangıç tarihi · boşsa hemen açık', type: 'datetime' },
      { key: 'endsAt', label: 'Bitiş tarihi', type: 'datetime' },
      { key: 'entry', label: 'Bilet fiyatı (KC)', type: 'number' },
      { key: 'participants', label: 'Katılımcı · gerçek katılımcı sayısına eklenir', type: 'number' },
      { key: 'rank', label: 'Sıralama türü', type: 'choice', options: EVENT_RANKS.map((r) => ({ value: r, label: RANK_LABEL[r] })) },
      { key: 'game', label: 'Sayılan oyun · çekilişte kullanılmaz', type: 'choice', options: EVENT_GAME_OPTIONS },
      { key: 'payouts', label: 'Otomatik ödül (KC)', type: 'pairs', hint: 'Satır başına: sıra | KC · örnek: 1 | 5000 ve 2-10 | 1000', a: 'rank', b: 'kc', numericB: true },
      { key: 'prize', label: 'Ödül yazısı · kartta görünür', type: 'text', max: 60 },
      { key: 'image', label: 'Görsel', type: 'image', wide: true },
      { key: 'description', label: 'Açıklama', type: 'textarea', max: 600, wide: true },
      { key: 'steps', label: 'Nasıl katılınır', type: 'lines', hint: 'Her satır bir adım' },
      { key: 'rules', label: 'Kurallar', type: 'lines', hint: 'Her satır bir kural' },
      { key: 'prizes', label: 'Ödül sıralaması yazısı', type: 'pairs', hint: 'Sadece otomatik ödül boşsa sitede görünür · satır başına: sıra | ödül', a: 'place', b: 'prize' },
    ],
    blank: () => {
      const start = new Date()
      return { id: '', kind: 'Haftalık', title: 'Yeni etkinlik', subtitle: '', startsAt: toTrIso(start), endsAt: toTrIso(new Date(start.getTime() + 7 * 86_400_000)), participants: 0, entry: 100, rank: 'none', game: '', payouts: [], prize: '', image: '/images/banner-events.png', description: '', steps: [], rules: [], prizes: [] }
    },
  },
  predictions: {
    title: 'Maç tahminleri',
    hint: `Sitede "Doğru tahmin: +ödül KC" diye görünür. Üyeye ödenen ise ödülün ${PREDICTION_PAYOUT.share}'te biridir (en fazla ${PREDICTION_PAYOUT.max} KC) ve tahmini yaptığı an hesabına geçer; günde ${PREDICTION_PAYOUT.perDay} tahmine kadar. Maç sonucu girilmez, doğru tahmine ayrıca ödeme yapılmaz.`,
    field: 'home',
    fields: [
      { key: 'league', label: 'Lig', type: 'text', max: 40 },
      { key: 'kickoffAt', label: 'Maç tarihi', type: 'datetime' },
      { key: 'closesAt', label: 'Tahmin bitiş · boşsa maç saatinde kapanır', type: 'datetime' },
      { key: 'kickoff', label: 'Başlama yazısı · maç tarihi boşsa gösterilir', type: 'text', max: 30 },
      { key: 'home', label: 'Ev sahibi', type: 'text', max: 30 },
      { key: 'away', label: 'Deplasman', type: 'text', max: 30 },
      { key: 'reward', label: `Ödül (KC) · üyeye ${PREDICTION_PAYOUT.share}'te biri ödenir, en fazla ${PREDICTION_PAYOUT.max}`, type: 'number' },
      { key: 'options', label: 'Seçenekler', type: 'pairs', hint: 'Satır başına: seçenek | oy', a: 'label', b: 'votes', numericB: true },
    ],
    blank: () => ({ id: '', league: 'Süper Lig', home: 'Ev sahibi', away: 'Deplasman', kickoff: '', kickoffAt: toTrIso(new Date(Date.now() + 86_400_000)), closesAt: '', reward: 100, options: [{ id: 'o1', label: '1', votes: 0 }, { id: 'o2', label: 'X', votes: 0 }, { id: 'o3', label: '2', votes: 0 }] }),
  },
  campaigns: {
    title: 'Sponsor kampanyaları',
    hint: 'Kampanyalar sayfası ve “Bitmek üzere” şeridi.',
    field: 'title',
    fields: [
      { key: 'title', label: 'Başlık', type: 'text', max: 60 },
      { key: 'sponsorId', label: 'Sponsor', type: 'sponsor' },
      { key: 'tag', label: 'Etiket', type: 'text', max: 20 },
      { key: 'startsAt', label: 'Başlangıç tarihi', type: 'datetime' },
      { key: 'endsAt', label: 'Bitiş tarihi', type: 'datetime' },
      { key: 'url', label: 'Yönlendirme linki · boşsa sponsorun linki kullanılır', type: 'text', max: 400, wide: true },
      { key: 'image', label: 'Görsel', type: 'image', wide: true },
      { key: 'description', label: 'Açıklama', type: 'textarea', max: 300, wide: true },
    ],
    blank: () => {
      const start = new Date()
      const end = new Date(start.getTime() + 7 * 86_400_000)
      return { id: '', sponsorId: '', title: 'Yeni kampanya', description: '', ends: '', image: '/images/banner-events.png', tag: 'Kampanya', hoursLeft: 168, startsAt: toTrIso(start), endsAt: toTrIso(end), url: '' }
    },
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

/** Campaign dates are entered and stored in Turkey time (UTC+3, no DST). */
function toTrIso(d: Date) {
  return `${new Date(d.getTime() + 3 * 3_600_000).toISOString().slice(0, 16)}:00+03:00`
}

function fromTrIso(v: unknown) {
  if (typeof v !== 'string' || !v) return ''
  const t = Date.parse(v)
  return Number.isFinite(t) ? new Date(t + 3 * 3_600_000).toISOString().slice(0, 16) : ''
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
      // Prize amounts are typed the Turkish way ("5.000"), which Number() would read as five.
      [b]: b === 'kc' ? parseKc(y) || 0 : numericB ? Math.max(0, Number(y) || 0) : y,
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
      ) : field.type === 'datetime' ? (
        <input
          id={id}
          type="datetime-local"
          className={input}
          value={fromTrIso(value)}
          onChange={(e) => set({ [field.key]: e.target.value ? `${e.target.value}:00+03:00` : '' })}
        />
      ) : field.type === 'select' ? (
        <select id={id} className={input} value={String(value ?? '')} onChange={(e) => set({ [field.key]: e.target.value })}>
          {field.options.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      ) : field.type === 'choice' ? (
        <select id={id} className={input} value={String(value ?? field.options[0]?.value ?? '')} onChange={(e) => set({ [field.key]: e.target.value })}>
          {field.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
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

const TEMPLATE_RULES = ['Etkinliğe katıldıktan sonra oynadığın oyunlar sayılır', 'Eşitlikte puana önce ulaşan üstte yer alır', 'Turnuva maçları sayılmaz']

/** `days` is how long the event runs from the moment it is added. */
const EVENT_TEMPLATES: (Item & { days: number })[] = [
  { days: 7, kind: 'Haftalık', title: 'Tavla Haftası', subtitle: 'En çok maç kazanan ödülü alır', entry: 0, prize: '5.000 KC', rank: 'wins', game: 'tavla', payouts: [{ rank: '1', kc: 2500 }, { rank: '2', kc: 1500 }, { rank: '3', kc: 1000 }], description: 'Hafta boyunca tavla masalarında en çok galibiyet alan ilk 3 oyuncu ödül kazanır.', steps: ['Etkinliğe katıl', 'Tavla masasına otur ve maç kazan', 'Sıralamayı etkinlik detayından takip et'], rules: TEMPLATE_RULES },
  { days: 1, kind: 'Günlük', title: 'Okey Gecesi', subtitle: 'Bugün en çok Okey eli kazanan', entry: 0, prize: '1.000 KC', rank: 'wins', game: 'okey', payouts: [{ rank: '1', kc: 1000 }], description: 'Bir gün boyunca Okey masalarında en çok el kazanan oyuncu ödülü alır.', steps: ['Etkinliğe katıl', 'Okey masasına otur ve el kazan', 'Sıralamayı etkinlik detayından takip et'], rules: TEMPLATE_RULES },
  { days: 7, kind: 'Haftalık', title: 'Batak Ligi', subtitle: 'Haftalık galibiyet yarışı', entry: 50, prize: '3.000 KC', rank: 'wins', game: 'batak', payouts: [{ rank: '1', kc: 1500 }, { rank: '2', kc: 1000 }, { rank: '3', kc: 500 }], description: 'Batak masalarında kazandığın her oyun seni sıralamada yukarı taşır. Hafta sonunda zirvedekiler kazanır.', steps: ['Lige katıl', 'Batak masalarında oyun kazan', 'Sıralamayı etkinlik detayından takip et'], rules: ['Katılım ücreti bir kez alınır', ...TEMPLATE_RULES] },
  { days: 3, kind: 'Haftalık', title: 'Bilardo Düellosu', subtitle: 'En çok düello kazanan', entry: 100, prize: '2.000 KC', rank: 'wins', game: 'bilardo', payouts: [{ rank: '1', kc: 2000 }], description: 'Üç gün boyunca Amerikan Bilardo masalarında en çok düello kazanan oyuncu ödülü alır.', steps: ['Etkinliğe katıl', 'Bilardo masasında düello kazan', 'Sıralamayı etkinlik detayından takip et'], rules: ['Katılım ücreti bir kez alınır', ...TEMPLATE_RULES] },
  { days: 7, kind: 'Haftalık', title: 'Bilet Çekilişi', subtitle: 'Katılanlar arasından çekiliş', entry: 50, prize: '1. ödül 5.000 KC', rank: 'draw', game: '', payouts: [{ rank: '1', kc: 5000 }, { rank: '2-3', kc: 1000 }], description: 'Bilet alan herkes çekilişe girer. Bitiş tarihinde kazananlar rastgele çekilir ve ödülleri hesaplarına eklenir.', steps: ['Biletini al', 'Bitiş tarihini bekle', 'Kazananları etkinlik detayında gör'], rules: ['Hesap başına bir bilet alınır', 'Çekiliş bitiş tarihinde kendiliğinden yapılır'] },
]

type SaveResult = { ok: true; message: string } | { ok: false; error: string }

const eventRank = (item: Item): EventRank => (EVENT_RANKS.includes(item.rank as EventRank) ? (item.rank as EventRank) : 'none')

function scoringText(rank: EventRank, game: string) {
  const games = game ? `${eventGameLabel(game)} oyunları` : 'tüm oyunlar'
  if (rank === 'draw') return 'Bitiş tarihinde kazananlar katılanlar arasından rastgele çekilir.'
  const counted = rank === 'wins' ? `kazandığı oyunlar sayılır (${games})` : rank === 'coins' ? `oyunlardan kazandığı KC toplanır (${games}; kayıplar düşülmez)` : `oynadığı oyunlar sayılır (${games})`
  return `Üyenin etkinliğe katıldıktan sonra ve etkinlik tarihleri içinde ${counted}. Bota karşı oyunlar da sayılır, turnuva maçları sayılmaz. Puanı sıfır olan ödül almaz.`
}

/** Standings and payout state of one saved event, plus the manual "settle now" fallback. */
function EventBoardBox({ id, item }: { id: string; item: Item }) {
  const [version, setVersion] = useState(0)
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null)
  const [closed, setClosed] = useState(false)
  const [pending, start] = useTransition()
  const [now] = useState(() => Date.now())
  const rank = eventRank(item)
  const payouts = cleanPayouts(item.payouts)
  const end = Date.parse(String(item.endsAt ?? ''))
  const ended = rank !== 'none' && Number.isFinite(end) && end <= now

  const settle = () =>
    void askConfirm('Etkinlik şimdi sonuçlandırılsın mı? Sıralama dondurulur ve ödüller kazananların hesabına eklenir. Bu işlem geri alınamaz.').then((ok) => {
      if (!ok) return
      start(async () => {
        const r = await settleEventNow(id)
        setStatus(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error })
        setVersion((v) => v + 1)
      })
    })

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border p-3">
      {rank === 'none' ? (
        <p className="text-xs leading-relaxed text-muted-foreground">
          <span className="font-bold text-foreground">Otomatik sıralama kapalı.</span> Bu etkinlikte kimse kendiliğinden sıralanmaz ve ödül almaz; kazananı ve ödülü sen belirlersin. Açmak için bir sıralama türü seç, bitiş tarihi ve otomatik ödül yaz.
        </p>
      ) : (
        <p className="text-xs leading-relaxed text-muted-foreground">
          {payouts.length ? (
            <>
              Dağıtılacak ödül en fazla <span className="font-bold text-foreground">{`${payoutTotal(payouts).toLocaleString('tr-TR')} KC`}</span>
              {` (ilk ${lastPrizePlace(payouts)} sıra). `}
            </>
          ) : (
            <span className="font-bold text-destructive">Otomatik ödül satırı yok. </span>
          )}
          {scoringText(rank, String(item.game ?? ''))} Ödüller bitiş tarihinde kendiliğinden hesaplara eklenir ve kazanana site içi mesaj gider.
        </p>
      )}
      <PickList
        cacheKey={`event-board-${id}-${version}`}
        load={() => loadEventBoard(id)}
        title="Sıralama ve katılımcılar"
        pickLabel="Puan"
        whenLabel="Katıldı"
        empty="Henüz katılan yok."
        onData={(d) => setClosed(d.ok && Boolean(d.closed))}
      />
      <p className="text-xs text-muted-foreground">Liste kaydedilmiş ayarlara göre gelir; değişiklik yaptıysan önce kaydet.</p>
      {ended && (!closed || status) && (
        <div className="flex flex-wrap items-center gap-3">
          {!closed && (
            <button type="button" onClick={settle} disabled={pending} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-foreground hover:bg-secondary disabled:opacity-60">
              {pending && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
              Şimdi sonuçlandır
            </button>
          )}
          {status && (
            <p role="status" className={cn('text-xs', status.ok ? 'text-primary' : 'text-destructive')}>
              {status.text}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

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

function ListEditor({ kind, initial, sponsors, library, hidden, order, setOrder, focusId, onSaved }: { kind: Kind; initial: Item[]; sponsors: Option[]; library: string[]; hidden: string[]; order: CategoryOrder; setOrder: (o: CategoryOrder) => void; focusId?: string; onSaved: (items: Item[]) => void }) {
  const schema = SCHEMAS[kind]
  const [items, setItems] = useState<Item[]>(initial)
  const [open, setOpen] = useState<number | null>(() => {
    const i = focusId ? initial.findIndex((x) => String(x.id) === focusId) : -1
    return i >= 0 ? i : null
  })
  const arrived = useRef(false)
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
      if (r.ok) onSaved(items)
    })
  const reset = () => {
    void askConfirm('Bu liste varsayılana dönsün mü? Yaptığın değişiklikler silinir.').then((ok) => {
      if (!ok) return
    start(async () => {
      const r = await resetCatalog(kind)
      setStatus(r.ok ? { ok: true, text: `${r.message} Ekran yenileniyor...` } : { ok: false, text: r.error })
      // The form keeps its own copy of the list, so only a reload shows the restored defaults.
      if (r.ok) setTimeout(() => window.location.reload(), 900)
    })
    })
  }

  const orphans =
    kind === 'campaigns' || kind === 'bonuses'
      ? items
          .filter((x) => !sponsors.some((s) => s.id === String(x.sponsorId ?? '')) && (kind === 'bonuses' || !String(x.url ?? '').trim()))
          .map((x) => `"${String(x.title ?? '').slice(0, 30)}"`)
      : []

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

      {orphans.length > 0 && (
        <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-xs leading-relaxed text-foreground">
          <strong>{`${orphans.length} kayıtta sponsor listede yok${kind === 'campaigns' ? ' ve yönlendirme linki boş' : ''}.`}</strong>{' '}
          {`Sitede bu ${kind === 'campaigns' ? 'kampanyaların "Katıl"' : 'bonusların "Siteye git"'} düğmesi hiçbir yere gitmez. Sponsor seç${kind === 'campaigns' ? ', link yaz' : ''} ya da kaydı sil: `}
          {orphans.slice(0, 6).join(', ')}
          {orphans.length > 6 ? ` ve ${orphans.length - 6} kayıt daha.` : '.'}
        </p>
      )}

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
                  const { days, ...template } = t
                  const start = new Date()
                  const dates = { startsAt: toTrIso(start), endsAt: toTrIso(new Date(start.getTime() + days * 86_400_000)) }
                  setItems((list) => [{ ...schema.blank(), ...template, ...dates, id: `events-${Date.now().toString(36)}` }, ...list])
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
            <li
              key={id}
              ref={
                id === focusId
                  ? (el) => {
                      if (!el || arrived.current) return
                      arrived.current = true
                      el.scrollIntoView({ block: 'center' })
                      el.querySelector<HTMLButtonElement>('button[aria-expanded]')?.focus({ preventScroll: true })
                    }
                  : undefined
              }
              className={cn('overflow-hidden rounded-xl border border-border', isHidden && 'border-dashed')}
            >
              <div className="flex items-center gap-2 pr-2 hover:bg-secondary/60">
                <button type="button" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : i)} className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left">
                  <span className={cn('min-w-0 flex-1 truncate text-sm font-medium', isHidden ? 'text-muted-foreground line-through' : 'text-foreground')}>{name}</span>
                  {isHidden && <span className="shrink-0 text-xs font-bold uppercase text-muted-foreground">Gizli</span>}
                  {kind === 'events' && !item.endsAt && <span className="shrink-0 text-xs font-bold text-destructive">Bitiş tarihi yok</span>}
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {kind === 'events' ? `${RANK_SHORT[eventRank(item)]} · ${item.entry} KC` : kind === 'predictions' ? `${item.reward} KC` : (sponsors.find((s) => s.id === String(item.sponsorId))?.name ?? 'Sponsor yok')}
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
                  {kind === 'events' && <EventBoardBox id={id} item={item} />}
                  {kind === 'predictions' && (
                    <div className="flex flex-col gap-2 rounded-xl border border-border p-3">
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        Tahmin başına ödenen: <span className="font-bold text-foreground">{`${predictionPayout(Number(item.reward))} KC`}</span>
                        {`, tahmin yapıldığı an (günde ${PREDICTION_PAYOUT.perDay} tahmine kadar). Bu tahmin türünde sonuç girilmez ve doğru bilene ayrıca ödül verilmez; sonuçlu, puanlı tahmin için Tahmin ligini kullan.`}
                      </p>
                      <PickList cacheKey={`prediction-picks-${id}`} load={() => loadPredictionPicks(id)} pickLabel="Seçtiği" />
                    </div>
                  )}
                  {(kind === 'campaigns' || kind === 'bonuses') &&
                    (initial.some((x) => String(x.id) === id) ? (
                      <RecordLink kind="kampanya" id={id} name={String(name)} />
                    ) : (
                      <p className="text-xs leading-relaxed text-muted-foreground">Linki kaydettikten sonra buradan kopyalarsın.</p>
                    ))}
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

/** `league` is the prediction league and `goal` the per-goal reward events: both live under the Tahminler tab, next to the option predictions. */
type Tab = Kind | 'calendar' | 'league' | 'goal'

const TABS: { id: Exclude<Tab, 'league' | 'goal'>; label: string }[] = [
  { id: 'events', label: 'Etkinlik & bilet' },
  { id: 'predictions', label: 'Tahminler' },
  { id: 'campaigns', label: 'Kampanyalar' },
  { id: 'bonuses', label: 'Bonuslar' },
  { id: 'calendar', label: 'Takvim' },
]

const PREDICTION_KINDS = [
  {
    id: 'predictions',
    label: 'Seçenekli tahminler',
    about: `Üye bir seçeneğe oy verir (1, X, 2 gibi). Tahmini yaptığı an katılım ödülünü alır; sonuç girilmez, puan yazılmaz.`,
  },
  {
    id: 'league',
    label: 'Tahmin ligi',
    about: `Üye maçın sorularını cevaplar: maç sonucu, tam skor, gol, korner, kart gibi. Hangi soruların sorulacağını ve her doğru cevabın ödülünü sen seçersin. Sonuç girilince puanlar ve ödüller dağıtılır; puanlar /tahminler sayfasındaki haftalık ve aylık lig tablosuna yazılır.`,
  },
  {
    id: 'goal',
    label: 'Gol başı ödül',
    about: `Üye takım seçmez: maça katılır ve maçta atılan her gol için ayarladığın ödülü kazanır (gol başı 10 KC, 5 gol, 50 KC). Alkanka etkinliğinde üye ödülü, maç günü Alkanka'da senin belirlediğin şartı (oyun oyna, oyun kazan, oyunda vakit geçir, görev tamamla) tamamlayınca alır; şartı sistem kendisi sayar ve KC kendiliğinden yatar. Sponsor etkinliğinde üye kupon numarasını girer, ödülü sponsor verir, kuponu sen onaylar ve teslimi sen işaretlersin. Tahmin liginden ayrıdır: lig puanına yazılmaz.`,
  },
] as const

export function CatalogEditor({
  catalog,
  sponsors,
  library,
  hidden = {},
  tournaments = [],
  league = null,
}: {
  catalog: Omit<Catalog, 'rewards'>
  sponsors: Option[]
  library: string[]
  hidden?: HiddenMap
  tournaments?: CalendarTournament[]
  /** Prediction-league matches, when this account may manage them here. */
  league?: LeagueMatch[] | null
}) {
  const [tab, setTab] = useUrlTab<Tab>(league ? ['events', 'predictions', 'league', 'goal', 'campaigns', 'bonuses', 'calendar'] : ['events', 'predictions', 'campaigns', 'bonuses', 'calendar'], 'events')
  const [order, setOrder] = useState<CategoryOrder>(catalog.order ?? { campaignTags: [], bonusTypes: [] })
  const [focus, setFocus] = useState<{ kind: Kind; id: string } | null>(null)
  // One copy of the lists for every tab: what the calendar saves shows in the list and the other way round.
  const [lists, setLists] = useState(() => ({ events: catalog.events, predictions: catalog.predictions, campaigns: catalog.campaigns, bonuses: catalog.bonuses }))
  const keep = (kind: Kind, items: Item[]) => setLists((all) => ({ ...all, [kind]: items }))
  const top = tab === 'league' || tab === 'goal' ? 'predictions' : tab
  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label="Katalog bölümleri" className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={top === t.id}
            onClick={() => setTab(t.id)}
            className={cn('rounded-full border px-4 py-2 text-sm font-medium transition-colors', top === t.id ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-foreground hover:bg-secondary')}
          >
            {t.label}
          </button>
        ))}
      </div>
      {top === 'predictions' && league && (
        <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
          <div role="group" aria-label="Tahmin türü" className="flex w-fit flex-wrap gap-1 rounded-lg border border-border bg-background p-1">
            {PREDICTION_KINDS.map((k) => (
              <button
                key={k.id}
                type="button"
                aria-pressed={tab === k.id}
                onClick={() => setTab(k.id)}
                className={cn('h-9 rounded-md px-3 text-xs font-bold', tab === k.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
              >
                {k.id === 'goal' ? k.label : k.id === 'league' ? `${k.label} (${league.filter((m) => !m.settled).length})` : `${k.label} (${catalog.predictions.length})`}
              </button>
            ))}
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">{PREDICTION_KINDS.find((k) => k.id === tab)?.about}</p>
        </div>
      )}
      {tab === 'league' ? (
        league && <LeagueAdmin matches={league} />
      ) : tab === 'goal' ? (
        league && <GoalAdmin />
      ) : tab === 'calendar' ? (
        <CatalogCalendar
          catalog={lists}
          tournaments={tournaments}
          league={league}
          hidden={hidden}
          blank={(kind) => SCHEMAS[kind].blank()}
          renderFields={(kind, item, set) => (
            <div className="grid gap-3 md:grid-cols-2">
              {SCHEMAS[kind].fields.map((f) => (
                <FieldInput key={f.key} field={f} item={item} set={set} sponsors={sponsors} library={library} />
              ))}
            </div>
          )}
          onSaved={keep}
          onOpen={(kind, id) => {
            setFocus({ kind, id })
            setTab(kind)
          }}
          onJump={setTab}
        />
      ) : (
        <ListEditor
          key={tab}
          kind={tab}
          initial={lists[tab] as unknown as Item[]}
          onSaved={(items) => keep(tab, items)}
          sponsors={sponsors}
          library={library}
          hidden={hidden[SCOPE[tab]] ?? []}
          order={order}
          setOrder={setOrder}
          focusId={focus?.kind === tab ? focus.id : undefined}
        />
      )}
    </div>
  )
}
