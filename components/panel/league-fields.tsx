'use client'

import { useId } from 'react'
import {
  MARKETS,
  MARKET_IDS,
  MAX_BONUS_POINTS,
  MAX_MARKET_AMOUNT,
  MAX_MARKET_POINTS,
  MAX_PRIZE_AMOUNT,
  PRIZE_KIND_LABEL,
  lineText,
  marketList,
  marketTitle,
  prizeText,
  setCeiling,
  type MarketId,
  type MarketRule,
  type Prize,
  type PrizeKind,
  type QuestionSet,
} from '@/lib/predictions-shared'
import { cn } from '@/lib/utils'

export type PrizeOptions = {
  products: { id: string; name: string; sponsor: boolean }[]
  sites: { id: string; name: string }[]
}

const box = 'h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring'
const caption = 'flex flex-col gap-1 text-xs font-semibold text-muted-foreground'
const fmt = (n: number) => n.toLocaleString('tr-TR')

export function NumberField({ label, value, max, onChange, className }: { label: string; value: number; max: number; onChange: (n: number) => void; className?: string }) {
  return (
    <label className={cn(caption, className)}>
      {label}
      <input
        inputMode="numeric"
        value={String(value)}
        onChange={(e) => onChange(Math.min(max, Number(e.target.value.replace(/\D/g, '') || 0)))}
        className={cn(box, 'w-full tabular-nums')}
      />
    </label>
  )
}

/** Why a prize cannot be saved yet, or null when it is complete. */
export function prizeProblem(p: Prize | null): string | null {
  if (!p) return null
  if (p.kind === 'market') return p.ref ? null : 'Market ürününü seç.'
  if (p.kind === 'cash' && !p.ref) return 'Sponsor siteyi seç.'
  if (p.amount <= 0) return 'Ödül tutarını gir.'
  return null
}

const KINDS: PrizeKind[] = ['kc', 'kp', 'market', 'cash']

/** One prize: coins, points, a market product or cash paid by a sponsor site. */
export function PrizeField({
  label,
  value,
  onChange,
  options,
  optional = false,
}: {
  label: string
  value: Prize | null
  onChange: (p: Prize | null) => void
  options: PrizeOptions
  /** Lets the prize be left out altogether. */
  optional?: boolean
}) {
  const id = useId()
  const pickKind = (kind: string) => {
    if (!kind) return onChange(null)
    const amount = kind === 'market' ? 1 : value && value.kind !== 'market' ? value.amount : 0
    onChange({ kind: kind as PrizeKind, amount, ref: '', name: '' })
  }
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-end gap-2">
        <label htmlFor={`${id}-kind`} className={cn(caption, 'w-full sm:w-52')}>
          {label}
          <select id={`${id}-kind`} value={value?.kind ?? ''} onChange={(e) => pickKind(e.target.value)} className={cn(box, 'w-full')}>
            <option value="">{optional ? 'Ek ödül yok' : 'Ödül türü seç'}</option>
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {PRIZE_KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </label>
        {value?.kind === 'market' && (
          <label className={cn(caption, 'min-w-0 flex-1 basis-56')}>
            Ürün
            <select
              value={value.ref}
              onChange={(e) => onChange({ ...value, ref: e.target.value, name: options.products.find((p) => p.id === e.target.value)?.name ?? '' })}
              className={cn(box, 'w-full')}
            >
              <option value="">Ürün seç</option>
              {options.products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.sponsor ? `${p.name} (sponsor ürünü)` : p.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {value?.kind === 'cash' && (
          <label className={cn(caption, 'min-w-0 flex-1 basis-48')}>
            Ödeyen sponsor site
            <select
              value={value.ref}
              onChange={(e) => onChange({ ...value, ref: e.target.value, name: options.sites.find((s) => s.id === e.target.value)?.name ?? '' })}
              className={cn(box, 'w-full')}
            >
              <option value="">Site seç</option>
              {options.sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {value && value.kind !== 'market' && (
          <NumberField
            label={value.kind === 'cash' ? 'Tutar (TL)' : value.kind === 'kp' ? 'Tutar (KP)' : 'Tutar (KC)'}
            value={value.amount}
            max={MAX_PRIZE_AMOUNT}
            onChange={(amount) => onChange({ ...value, amount })}
            className="w-32"
          />
        )}
      </div>
      {value?.kind === 'cash' && (
        <p className="text-xs leading-relaxed text-muted-foreground">
          Üye kazanınca sitedeki kullanıcı adını yazar; ödül &quot;Ödül teslimi&quot; sekmesine düşer ve sponsor ödemeyi yapınca oradan teslim edildi olarak işaretlenir.
        </p>
      )}
      {value?.kind === 'market' && (
        <p className="text-xs leading-relaxed text-muted-foreground">
          Üyeden coin düşülmez. Site içi ürünler (ek oyun hakkı, seri kalkanı) hemen hesaba yazılır; diğerleri &quot;Ödül teslimi&quot; sekmesinde teslim edilmeyi bekler.
        </p>
      )}
    </div>
  )
}

const DEFAULT_RULES: Record<MarketId, MarketRule> = {
  side: { pts: 1, coin: 'kc', amount: 40 },
  score: { pts: 3, coin: 'kc', amount: 150, nearPts: 1, nearAmount: 40 },
  goals: { pts: 1, coin: 'kc', amount: 40, line: 2.5 },
  btts: { pts: 1, coin: 'kc', amount: 40 },
  half: { pts: 1, coin: 'kc', amount: 40 },
  corners: { pts: 2, coin: 'kc', amount: 60, line: 9.5 },
  cards: { pts: 2, coin: 'kc', amount: 60, line: 4.5 },
}

const PRESETS: { label: string; ids: MarketId[] }[] = [
  { label: 'Sadece taraf', ids: ['side'] },
  { label: 'Sadece skor', ids: ['score'] },
  { label: 'Taraf + alt/üst', ids: ['side', 'goals'] },
  { label: 'Taraf, gol, korner, kart', ids: ['side', 'goals', 'corners', 'cards'] },
  { label: 'Hepsi', ids: [...MARKET_IDS] },
]

const NEEDS_TEXT = {
  half: 'Sonuç girilirken ilk yarı skoru da istenir.',
  corners: 'Sonuç girilirken toplam korner sayısı da istenir.',
  cards: 'Sonuç girilirken toplam kart sayısı da istenir.',
} as const

/** Why a question set cannot be saved yet, or null when it is complete. */
export function setProblem(set: QuestionSet): string | null {
  const ids = marketList(set)
  if (!ids.length) return 'En az bir soru seç.'
  for (const id of ids) {
    const r = set.markets[id]!
    if (r.pts <= 0 && r.amount <= 0) return `"${MARKETS[id].label}" sorusunun puanı da ödülü de 0. Birini gir ya da soruyu kapat.`
  }
  if (set.bonus) {
    const problem = prizeProblem(set.bonus.prize)
    if (problem) return `Hepsini bilene ek ödül: ${problem}`
    if (set.bonus.pts <= 0 && !set.bonus.prize) return 'Hepsini bilene ek ödül açık ama puanı da ödülü de boş. Birini gir ya da kapat.'
  }
  return null
}

/** What a member who answers everything right takes home, bonus included. */
export function ceilingLine(set: QuestionSet) {
  const c = setCeiling(set)
  return [`${c.pts} lig puanı`, c.kc > 0 ? `${fmt(c.kc)} KC` : '', c.kp > 0 ? `${fmt(c.kp)} KP` : '', c.gift ? prizeText(c.gift) : ''].filter(Boolean).join(' + ')
}

/** The questions as one line, for lists and confirmations. */
export function questionLine(set: QuestionSet) {
  return marketList(set)
    .map((id) => marketTitle(id, set.markets[id]))
    .join(', ')
}

function lineChoices(id: MarketId) {
  const spec = MARKETS[id].line
  if (!spec) return []
  const out: number[] = []
  for (let n = spec.min; n <= spec.max; n += 1) out.push(n)
  return out
}

/** Which questions a match asks, what each right answer pays and what answering them all adds. */
export function QuestionSetEditor({ value, onChange, options }: { value: QuestionSet; onChange: (set: QuestionSet) => void; options: PrizeOptions }) {
  const ids = marketList(value)
  const patch = (id: MarketId, rule: Partial<MarketRule>) => onChange({ ...value, markets: { ...value.markets, [id]: { ...value.markets[id]!, ...rule } } })
  const withBonus = (markets: QuestionSet['markets']): QuestionSet => ({ markets, bonus: MARKET_IDS.filter((id) => markets[id]).length > 1 ? value.bonus : null })
  const toggle = (id: MarketId) => {
    const markets = { ...value.markets }
    if (markets[id]) delete markets[id]
    else markets[id] = DEFAULT_RULES[id]
    onChange(withBonus(markets))
  }
  const preset = (list: MarketId[]) => onChange(withBonus(Object.fromEntries(list.map((id) => [id, value.markets[id] ?? DEFAULT_RULES[id]]))))
  const sameAs = (list: MarketId[]) => list.length === ids.length && list.every((id) => value.markets[id])

  return (
    <div className="flex flex-col gap-3">
      <div role="group" aria-label="Hazır soru setleri" className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-semibold text-muted-foreground">Hazır set:</span>
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            aria-pressed={sameAs(p.ids)}
            onClick={() => preset(p.ids)}
            className={cn(
              'rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
              sameAs(p.ids) ? 'border-primary bg-primary/15 text-primary' : 'border-border text-foreground hover:border-primary hover:text-primary',
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      <ul className="flex flex-col gap-2">
        {MARKET_IDS.map((id) => {
          const rule = value.markets[id]
          const info = MARKETS[id]
          return (
            <li key={id} className={cn('flex flex-col gap-3 rounded-lg border p-3', rule ? 'border-primary/40 bg-background' : 'border-border')}>
              <label className="flex cursor-pointer items-start gap-3">
                <input type="checkbox" checked={Boolean(rule)} disabled={Boolean(rule) && ids.length === 1} onChange={() => toggle(id)} className="mt-0.5 size-4 shrink-0 accent-primary" />
                <span className="flex min-w-0 flex-col">
                  <span className="text-sm font-bold text-foreground">{info.label}</span>
                  <span className="text-xs leading-relaxed text-muted-foreground">
                    {info.ask}
                    {info.line ? ' (alt / üst)' : ''}
                    {info.needs ? ` · ${NEEDS_TEXT[info.needs]}` : ''}
                  </span>
                </span>
              </label>
              {rule && (
                <div className="flex flex-col gap-2 pl-7">
                  <div className="flex flex-wrap items-end gap-2">
                    {info.line && (
                      <label className={cn(caption, 'w-24')}>
                        Baraj
                        <select value={String(rule.line ?? info.line.def)} onChange={(e) => patch(id, { line: Number(e.target.value) })} className={cn(box, 'w-full')}>
                          {lineChoices(id).map((n) => (
                            <option key={n} value={String(n)}>
                              {lineText(n)}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    <NumberField label="Lig puanı" value={rule.pts} max={MAX_MARKET_POINTS} onChange={(pts) => patch(id, { pts })} className="w-24" />
                    <NumberField label="Ödül" value={rule.amount} max={MAX_MARKET_AMOUNT} onChange={(amount) => patch(id, { amount })} className="w-28" />
                    <label className={cn(caption, 'w-36')}>
                      Ödül türü
                      <select value={rule.coin} onChange={(e) => patch(id, { coin: e.target.value === 'kp' ? 'kp' : 'kc' })} className={cn(box, 'w-full')}>
                        <option value="kc">Kanka Coin</option>
                        <option value="kp">Kanka Puan</option>
                      </select>
                    </label>
                  </div>
                  {id === 'score' && (
                    <div className="flex flex-col gap-1.5">
                      <div className="flex flex-wrap items-end gap-2">
                        <NumberField label="Skor tutmadı, taraf doğru: puan" value={rule.nearPts ?? 0} max={MAX_MARKET_POINTS} onChange={(nearPts) => patch(id, { nearPts })} className="w-56" />
                        <NumberField label={`Teselli ödülü (${rule.coin === 'kp' ? 'KP' : 'KC'})`} value={rule.nearAmount ?? 0} max={MAX_MARKET_AMOUNT} onChange={(nearAmount) => patch(id, { nearAmount })} className="w-40" />
                      </div>
                      {value.markets.side && ((rule.nearPts ?? 0) > 0 || (rule.nearAmount ?? 0) > 0) && (
                        <p className="text-xs leading-relaxed text-muted-foreground">
                          &quot;Maç sonucu&quot; sorusu da açık: tarafı bilen üye hem o sorudan hem bu teselliden kazanır. İstemiyorsan teselliyi 0 yap.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>

      {ids.length > 1 && (
        <div className={cn('flex flex-col gap-3 rounded-lg border p-3', value.bonus ? 'border-primary/40 bg-background' : 'border-border')}>
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={Boolean(value.bonus)}
              onChange={() => onChange({ ...value, bonus: value.bonus ? null : { pts: 2, prize: null } })}
              className="mt-0.5 size-4 shrink-0 accent-primary"
            />
            <span className="flex min-w-0 flex-col">
              <span className="text-sm font-bold text-foreground">Hepsini bilene ek ödül</span>
              <span className="text-xs leading-relaxed text-muted-foreground">Maçın bütün sorularını doğru cevaplayan üye, soru ödüllerinin üstüne bunu da alır. İptal edilen soru hesaba katılmaz.</span>
            </span>
          </label>
          {value.bonus && (
            <div className="flex flex-col gap-2 pl-7">
              <NumberField label="Ek lig puanı" value={value.bonus.pts} max={MAX_BONUS_POINTS} onChange={(pts) => onChange({ ...value, bonus: { ...value.bonus!, pts } })} className="w-28" />
              <PrizeField label="Ek ödül" optional value={value.bonus.prize} options={options} onChange={(prize) => onChange({ ...value, bonus: { ...value.bonus!, prize } })} />
            </div>
          )}
        </div>
      )}

      <p className="rounded-lg bg-secondary px-3 py-2 text-xs leading-relaxed text-secondary-foreground">
        {ids.length} soru soruluyor. Hepsini bilen üye en fazla <b>{ceilingLine(value)}</b> kazanır. Lig puanı sıralamayı belirler ve Rozetler &amp; puan ayarındaki &quot;Tahmin ligi puanı&quot; kuralı kadar Kanka Puan da getirir.
      </p>
    </div>
  )
}
