'use client'

import { useId, useState, type ReactNode } from 'react'
import { Hand, Loader2, Save, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TR_TZ } from '@/lib/tr-time'
import type { MarketKind, ProductInput } from '@/lib/market'
import { REWARD_KINDS, rewardMeta, type DeliveryMode, type RewardKind } from '@/lib/market-shared'
import { ImageField } from '@/components/panel/image-field'
import { SideSheet } from '@/components/panel/side-sheet'

export type SponsorOption = { id: string; name: string }
export type BadgeOption = { id: string; name: string }
export type TaskOption = { id: number; title: string; period: string; live: boolean }

const PERIOD_NOTE: Record<string, string> = { daily: 'günlük', weekly: 'haftalık', monthly: 'aylık', once: 'tek seferlik', special: 'özel' }

const field = 'h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary'

const NUMBERS = [
  ['price', 'Fiyat (KC)', 1],
  ['stock', 'Kalan stok', 0],
  ['total', 'Toplam stok', 0],
  ['perUser', 'Kişi başı sınır', 1],
] as const

export function MarketProductForm({
  value,
  sponsors,
  badges,
  tasks,
  pending,
  error,
  onSave,
  onCancel,
}: {
  value: ProductInput
  sponsors: SponsorOption[]
  badges: BadgeOption[]
  tasks: TaskOption[]
  pending: boolean
  error: string | null
  onSave: (v: ProductInput) => void
  onCancel: () => void
}) {
  const formId = useId()
  const [v, setV] = useState(value)
  const set = <K extends keyof ProductInput>(k: K, x: ProductInput[K]) => setV((p) => ({ ...p, [k]: x }))
  const sponsor = v.kind === 'sponsor'
  const mode: DeliveryMode = sponsor ? 'manual' : v.deliveryMode
  const reward = v.reward ?? { kind: 'cark' as RewardKind, amount: 1, ref: null }
  const meta = rewardMeta(reward.kind)
  const [dealOn, setDealOn] = useState(Boolean(value.dealTaskId))
  const dealTask = tasks.find((t) => t.id === v.dealTaskId)
  const dealBad = dealOn && Number(v.dealPrice) >= Number(v.price)
  // The link time on record belongs to the task the product was saved with; a newly picked task starts its own.
  const dealStarted =
    value.dealSince && value.dealTaskId != null && v.dealTaskId === value.dealTaskId
      ? new Date(value.dealSince).toLocaleString('tr-TR', { timeZone: TR_TZ, day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
      : null

  function setDeal(on: boolean) {
    setDealOn(on)
    if (on) setV((p) => ({ ...p, dealTaskId: p.dealTaskId ?? tasks[0]?.id ?? null, dealPrice: p.dealPrice || Math.max(1, Math.floor(Number(p.price) / 2)) }))
  }

  function setKind(kind: MarketKind) {
    setV((p) => ({
      ...p,
      kind,
      type: kind === 'sponsor' ? 'SPONSOR BONUSU' : p.type === 'SPONSOR BONUSU' ? 'HEDİYE' : p.type,
      needsUsername: kind === 'sponsor' ? true : p.needsUsername,
      deliveryMode: kind === 'sponsor' ? 'manual' : p.deliveryMode,
    }))
  }

  function setMode(next: DeliveryMode) {
    setV((p) => ({ ...p, deliveryMode: next, reward: next === 'auto' ? (p.reward ?? reward) : p.reward }))
  }

  return (
    <SideSheet
      size="lg"
      eyebrow={value.id ? 'Ürünü düzenle' : 'Market'}
      title={value.id ? value.name : 'Yeni ürün'}
      onClose={onCancel}
      footer={
        <>
          <button
            form={formId}
            disabled={pending}
            className="flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />}
            {pending ? 'Kaydediliyor…' : value.id ? 'Kaydet' : 'Ürünü ekle'}
          </button>
          {error && (
            <p role="alert" className="min-w-0 flex-1 text-sm leading-relaxed text-destructive text-pretty">
              {error}
            </p>
          )}
        </>
      }
    >
      <form
        id={formId}
        data-no-guard
        onSubmit={(e) => {
          e.preventDefault()
          onSave({ ...v, deliveryMode: mode, reward: mode === 'auto' ? reward : null, dealTaskId: dealOn ? v.dealTaskId : null, dealPrice: dealOn ? v.dealPrice : 0, dealUses: dealOn ? v.dealUses : 1 })
        }}
        className="grid gap-4 md:grid-cols-2"
      >
        <Group>Tür</Group>
        <fieldset className="flex flex-col gap-1.5 md:col-span-2">
          <legend className="sr-only">Ürün türü</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            <Choice
              name="kind"
              checked={sponsor}
              disabled={Boolean(value.id) && !sponsor}
              onChange={() => setKind('sponsor')}
              title="Sponsor bonusu"
              text="Ödül sponsorun sitesinde yüklenir. Üyeden o sitedeki kullanıcı adı istenir."
            />
            <Choice
              name="kind"
              checked={!sponsor}
              disabled={Boolean(value.id) && sponsor}
              onChange={() => setKind('alkanka')}
              title="Site içi ürün"
              text="Ödül bu sitede verilir: coin, puan, ek hak, rozet ya da elle teslim edilen hediye."
            />
          </div>
          {value.id && <p className="text-xs leading-relaxed text-muted-foreground">Kayıtlı ürünün türü değişmez; farklı türde ürün için yeni ürün ekle.</p>}
        </fieldset>

        {sponsor ? (
          <Label text="Sponsor site">
            <select
              required
              value={v.sponsorId ?? ''}
              onChange={(e) => {
                const s = sponsors.find((x) => x.id === e.target.value)
                setV((p) => ({ ...p, sponsorId: s?.id ?? null, sponsorName: s?.name ?? null }))
              }}
              className={field}
            >
              <option value="">{sponsors.length ? 'Seç' : 'Kayıtlı sponsor yok, önce Sponsorlar ekranından ekle'}</option>
              {sponsors.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Label>
        ) : (
          <Label text="Etiket (kartın köşesinde yazar)">
            <input value={v.type} onChange={(e) => set('type', e.target.value)} maxLength={30} className={field} placeholder="ROZET, HEDİYE, EKSTRA HAK" />
          </Label>
        )}
        <Label text="Ürün adı">
          <input required value={v.name} onChange={(e) => set('name', e.target.value)} maxLength={120} className={field} placeholder="Örn: 500 TL deneme bonusu" />
        </Label>
        <Label text="Açıklama" wide>
          <textarea value={v.description} onChange={(e) => set('description', e.target.value)} rows={2} maxLength={600} className={cn(field, 'h-auto py-2')} />
        </Label>
        <Label text="Görsel" wide>
          <ImageField value={v.image} onChange={(url) => set('image', url)} uploadId="market" placeholder="/images/tile-market.png veya https://..." />
        </Label>

        <Group>Fiyat ve stok</Group>
        <div className="grid grid-cols-2 gap-3 md:col-span-2 md:grid-cols-4">
          {NUMBERS.map(([k, label, min]) => (
            <Label key={k} text={label}>
              <input type="number" inputMode="numeric" min={min} value={v[k]} onChange={(e) => set(k, Number(e.target.value))} className={field} />
            </Label>
          ))}
        </div>

        <Group>Görevle indirim</Group>
        <div className="flex flex-col gap-3 text-sm text-foreground md:col-span-2">
          <Check checked={dealOn} onChange={setDeal} text="Seçtiğim görevi tamamlayan üye bu ürünü daha ucuza alsın" />
          {dealOn && (
            <div className="grid gap-3 rounded-xl border border-primary/40 bg-primary/5 p-3 sm:grid-cols-2">
              <Label text="Tamamlanacak görev">
                <select required value={v.dealTaskId ?? ''} onChange={(e) => set('dealTaskId', Number(e.target.value) || null)} className={field}>
                  <option value="">{tasks.length ? 'Seç' : 'Kayıtlı görev yok, önce Görevler ekranından ekle'}</option>
                  {v.dealTaskId != null && !dealTask && <option value={v.dealTaskId}>Silinmiş ya da arşivlenmiş görev</option>}
                  {tasks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {`${t.title} (${PERIOD_NOTE[t.period] ?? t.period}${t.live ? '' : ', şu an yayında değil'})`}
                    </option>
                  ))}
                </select>
              </Label>
              <Label text="Görevi tamamlayanın fiyatı (KC)">
                <input
                  type="number"
                  inputMode="numeric"
                  required
                  min={1}
                  max={Math.max(1, Number(v.price) - 1)}
                  value={v.dealPrice}
                  onChange={(e) => set('dealPrice', Number(e.target.value))}
                  aria-invalid={dealBad}
                  className={field}
                />
              </Label>
              <Label text="Görevi bir kez tamamlayan kaç adet indirimli alır?">
                <input
                  type="number"
                  inputMode="numeric"
                  required
                  min={1}
                  max={100}
                  value={v.dealUses}
                  onChange={(e) => set('dealUses', Number(e.target.value))}
                  className={field}
                />
              </Label>
              <p className="self-end text-xs leading-relaxed text-muted-foreground text-pretty">
                {`Üye görevi her tamamlayışında ${Math.max(1, Number(v.dealUses) || 1)} adet indirimli alır; sonraki adetler normal fiyattan satılır. ${dealTask && dealTask.period !== 'once' ? 'Tekrarlanan görevde hak, görev yeniden tamamlanınca yenilenir.' : 'Tek seferlik görevde hak bir kez verilir.'} Kişi başı toplam adet sınırı yine geçerlidir.`}
              </p>
              <p className={cn('text-xs leading-relaxed text-pretty sm:col-span-2', dealBad ? 'text-destructive' : 'text-muted-foreground')}>
                {dealBad
                  ? 'Görev fiyatı normal fiyattan düşük olmalı.'
                  : `Üye bu ürünü ${Number(v.price).toLocaleString('tr-TR')} KC ödeyerek her zaman alabilir. Seçtiğin görevi tamamlamışsa ve indirimli adet hakkı duruyorsa ${Number(v.dealPrice).toLocaleString('tr-TR')} KC öder; fiyat kendiliğinden uygulanır, sana iş düşmez. Ürün markette "Görevli fırsatlar" sekmesinde de görünür.`}
              </p>
              <p className="rounded-lg border border-border bg-background px-3 py-2 text-xs leading-relaxed text-foreground text-pretty sm:col-span-2">
                <b className="font-semibold">İndirim geriye dönük işlemez.</b>{' '}
                {dealStarted
                  ? `Bu görev ürüne ${dealStarted} tarihinde bağlandı; üyenin o andan sonra yaptıkları sayılır.`
                  : 'Üyenin, görev bu ürüne bağlandıktan (kaydettiğin andan) sonra yaptıkları sayılır.'}{' '}
                Örnek: görev "5 mesaj yaz" ise, önceden yazılmış mesajlar indirim açmaz; üye bağlandıktan sonra 5 mesaj yazınca fiyat düşer. Başka bir görev seçersen sayım o andan yeniden başlar; fiyatı ya da adedi değiştirmek sayımı bozmaz.
              </p>
              <p className="text-xs leading-relaxed text-muted-foreground text-pretty sm:col-span-2">
                Günlük görevde üyenin görevi o gün, haftalık görevde o hafta tamamlamış olması gerekir. Onay isteyen görevde indirim, görev onaylandıktan sonra açılır.
                {dealTask && !dealTask.live ? ' Seçtiğin görev şu an yayında değil: üyeler görevi yapamadığı sürece indirim sitede gösterilmez.' : ''}
              </p>
            </div>
          )}
        </div>

        <Group>Teslim</Group>
        <fieldset className="flex flex-col gap-3 md:col-span-2">
          <legend className="sr-only">Teslim şekli</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            <Choice
              name="delivery"
              checked={mode === 'auto'}
              disabled={sponsor}
              onChange={() => setMode('auto')}
              icon={<Zap className="size-4" aria-hidden="true" />}
              title="Otomatik"
              text="Üye satın alır almaz ödül hesabına eklenir. Görevliye iş düşmez."
            />
            <Choice
              name="delivery"
              checked={mode === 'manual'}
              onChange={() => setMode('manual')}
              icon={<Hand className="size-4" aria-hidden="true" />}
              title="Elle"
              text="Talep, Talepler sekmesinde görevlinin sırasına düşer. Onaylanana kadar coin bekler, reddedilirse iade edilir."
            />
          </div>
          {sponsor && <p className="text-xs leading-relaxed text-muted-foreground">Sponsor bonusu sponsorun sitesinde yüklendiği için her zaman elle teslim edilir.</p>}

          {mode === 'auto' && (
            <div className="grid gap-3 rounded-xl border border-primary/40 bg-primary/5 p-3 sm:grid-cols-2">
              <Label text="Hesaba ne eklenecek?">
                <select
                  value={reward.kind}
                  onChange={(e) => set('reward', { kind: e.target.value as RewardKind, amount: e.target.value === 'rozet' ? 1 : reward.amount || 1, ref: null })}
                  className={field}
                >
                  {REWARD_KINDS.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </Label>
              {reward.kind === 'rozet' ? (
                <Label text="Rozet">
                  <select required value={reward.ref ?? ''} onChange={(e) => set('reward', { ...reward, ref: e.target.value || null })} className={field}>
                    <option value="">{badges.length ? 'Seç' : 'Kayıtlı rozet yok, önce Rozetler ekranından ekle'}</option>
                    {badges.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </Label>
              ) : (
                <Label text={`Miktar (${meta.unit}, en fazla ${meta.max.toLocaleString('tr-TR')})`}>
                  <input
                    type="number"
                    inputMode="numeric"
                    required
                    min={1}
                    max={meta.max}
                    value={reward.amount}
                    onChange={(e) => set('reward', { ...reward, amount: Number(e.target.value) })}
                    className={field}
                  />
                </Label>
              )}
              <p className="text-xs leading-relaxed text-muted-foreground sm:col-span-2">{meta.hint}</p>
            </div>
          )}
        </fieldset>

        <Label text="Teslimat notu (ürün detayında üyeye görünür)" wide>
          <input value={v.delivery} onChange={(e) => set('delivery', e.target.value)} maxLength={300} className={field} />
        </Label>
        <Label text="Kurallar (her satır bir kural)" wide>
          <textarea value={v.rules.join('\n')} onChange={(e) => set('rules', e.target.value.split('\n'))} rows={3} className={cn(field, 'h-auto py-2')} />
        </Label>

        <Group>Görünüm</Group>
        <div className="flex flex-col gap-2.5 text-sm text-foreground md:col-span-2">
          <Check checked={v.active} onChange={(x) => set('active', x)} text="Markette göster" />
          <Check checked={v.featured} onChange={(x) => set('featured', x)} text="Öne çıkar (market sayfasının üstünde büyük kartla gösterilir)" />
          <Check
            checked={v.needsUsername || sponsor}
            disabled={sponsor}
            onChange={(x) => set('needsUsername', x)}
            text="Satın alırken kullanıcı adı sor"
          />
        </div>
      </form>
    </SideSheet>
  )
}

function Group({ children }: { children: ReactNode }) {
  return <h3 className="border-b border-border pb-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground md:col-span-2">{children}</h3>
}

function Label({ text, wide, children }: { text: string; wide?: boolean; children: ReactNode }) {
  return (
    <label className={cn('flex flex-col gap-1 text-xs text-muted-foreground', wide && 'md:col-span-2')}>
      {text}
      {children}
    </label>
  )
}

function Check({ checked, disabled, onChange, text }: { checked: boolean; disabled?: boolean; onChange: (x: boolean) => void; text: string }) {
  return (
    <label className={cn('flex items-start gap-2 leading-relaxed', disabled && 'text-muted-foreground')}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="mt-1" />
      {text}
    </label>
  )
}

function Choice({
  name,
  checked,
  disabled,
  onChange,
  icon,
  title,
  text,
}: {
  name: string
  checked: boolean
  disabled?: boolean
  onChange: () => void
  icon?: ReactNode
  title: string
  text: string
}) {
  return (
    <label
      className={cn(
        'flex cursor-pointer gap-3 rounded-xl border p-3 text-sm',
        checked ? 'border-primary bg-primary/10' : 'border-border bg-background',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      <input type="radio" name={name} checked={checked} disabled={disabled} onChange={onChange} className="mt-1" />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="flex items-center gap-1.5 font-semibold text-foreground">
          {icon}
          {title}
        </span>
        <span className="text-xs leading-relaxed text-muted-foreground text-pretty">{text}</span>
      </span>
    </label>
  )
}
