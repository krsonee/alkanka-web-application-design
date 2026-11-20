'use client'

import { useMemo, useState } from 'react'
import { ArrowRight, Plus, X } from 'lucide-react'
import { MAX_RULES, RULE_KINDS, mergeRules, parseReplacements, rewritePlain, ruleError, type ReplaceRule, type RuleKind } from '@/lib/text-replace'
import { cn } from '@/lib/utils'

const input =
  'w-full min-w-0 rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none'

type Row = ReplaceRule & { own: boolean }

const SAMPLE = `EskiMarka'da bu akşama özel oran!
Galatasaray - Fenerbahçe 2.5 üst 1.85 → 3.60
Kayıt: https://eskisite.com/kayit?ref=kanal
Duyurular: @eskikanal · t.me/eskikanal`

/** Ready rules for the things changed most often; the empty side is filled in by hand. */
function presets(mainLink: string): { label: string; rule: ReplaceRule }[] {
  return [
    { label: 'Marka adını değiştir', rule: { kind: 'word', from: '', to: 'Alkanka' } },
    { label: 'Kanal adını değiştir', rule: { kind: 'username', from: '@', to: '@' } },
    { label: 'Sitenin tüm linkleri bizim linke', rule: { kind: 'domain', from: '', to: mainLink } },
    { label: 'Kayıt linkini değiştir', rule: { kind: 'link', from: '/kayit', to: mainLink } },
    { label: 'Buton linkini değiştir', rule: { kind: 'button', from: '', to: mainLink } },
    { label: 'Kaynağın butonunu kaldır', rule: { kind: 'button', from: '', to: '' } },
  ]
}

/**
 * Row-by-row replacement rules with a live before/after. Posts the source's own rules as `name` and,
 * when sharing is offered, the rows marked for every source as `sharedRules`.
 */
export function RuleTable({
  name = 'replacements',
  initial = '',
  mainLink = '',
  mode,
  shared = [],
  offerShare = true,
}: {
  name?: string
  initial?: string
  /** The source's main link, used by the preview and to prefill ready rules. */
  mainLink?: string
  mode: 'odds' | 'mirror'
  /** Rules already applied to every source, shown in the preview. */
  shared?: ReplaceRule[]
  offerShare?: boolean
}) {
  const [rows, setRows] = useState<Row[]>(() => parseReplacements(initial).map((rule) => ({ ...rule, own: true })))
  const [sample, setSample] = useState(SAMPLE)
  const link = mainLink || 'https://bizim-link.com'

  const edit = (index: number, patch: Partial<Row>) => setRows((list) => list.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  const add = (rule: ReplaceRule) => setRows((list) => (list.length >= MAX_RULES ? list : [...list, { ...rule, own: true }]))

  const plain = (list: Row[]) => list.map(({ kind, from, to }) => ({ kind, from, to }))
  const own = plain(rows.filter((row) => row.own || !offerShare))
  const forAll = offerShare ? plain(rows.filter((row) => !row.own)) : []
  const invalid = ruleError(plain(rows))
  const after = useMemo(() => {
    // The preview only uses rows that would be saved; half-typed rows are left out, not guessed.
    const usable = parseReplacements(JSON.stringify(rows.map(({ kind, from, to }) => ({ kind, from, to }))))
    return rewritePlain(sample, mergeRules(usable, shared), link, mode)
  }, [rows, sample, shared, link, mode])

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1.5 text-sm font-medium text-foreground">Değiştirme kuralları</legend>
      <input type="hidden" name={name} value={JSON.stringify(own)} />
      {offerShare && <input type="hidden" name="sharedRules" value={JSON.stringify(forAll)} />}

      {rows.length > 0 && (
        <ul className="flex flex-col gap-2">
          {rows.map((row, i) => {
            const kind = RULE_KINDS.find((k) => k.id === row.kind)!
            return (
              <li key={i} className="flex flex-col gap-2 rounded-xl border border-border bg-background/50 p-2">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
                  <select
                    aria-label={`${i + 1}. kuralın türü`}
                    value={row.kind}
                    onChange={(e) => edit(i, { kind: e.target.value as RuleKind })}
                    className={cn(input, 'lg:w-40 lg:shrink-0')}
                  >
                    {RULE_KINDS.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.label}
                      </option>
                    ))}
                  </select>
                  <input
                    aria-label={`${i + 1}. kuralda aranan`}
                    value={row.from}
                    maxLength={200}
                    placeholder={`Aranan: ${kind.from}`}
                    onChange={(e) => edit(i, { from: e.target.value })}
                    className={cn(input, 'lg:flex-1')}
                  />
                  <ArrowRight className="hidden size-4 shrink-0 text-muted-foreground lg:block" aria-hidden="true" />
                  <input
                    aria-label={`${i + 1}. kuralda yerine konacak`}
                    value={row.to}
                    maxLength={400}
                    placeholder={`Yerine: ${kind.to}`}
                    onChange={(e) => edit(i, { to: e.target.value })}
                    className={cn(input, 'lg:flex-1')}
                  />
                  <button
                    type="button"
                    onClick={() => setRows((list) => list.filter((_, at) => at !== i))}
                    aria-label={`${i + 1}. kuralı kaldır`}
                    className="inline-flex size-9 shrink-0 items-center justify-center self-end rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive lg:self-auto"
                  >
                    <X className="size-4" aria-hidden="true" />
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1">
                  <p className="text-xs leading-relaxed text-muted-foreground">{kind.hint}</p>
                  {offerShare && (
                    <label className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                      <input type="checkbox" checked={row.own} onChange={(e) => edit(i, { own: e.target.checked })} className="size-3.5 accent-primary" />
                      Sadece bu kaynak için
                    </label>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={rows.length >= MAX_RULES}
          onClick={() => add({ kind: 'word', from: '', to: '' })}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary disabled:opacity-50"
        >
          <Plus className="size-3.5" aria-hidden="true" />
          Kural ekle
        </button>
        {presets(mainLink).map((preset) => (
          <button
            key={preset.label}
            type="button"
            disabled={rows.length >= MAX_RULES}
            onClick={() => add(preset.rule)}
            className="rounded-lg border border-dashed border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-50"
          >
            {preset.label}
          </button>
        ))}
      </div>

      {invalid && (
        <p role="alert" className="text-xs text-destructive">
          {invalid}
        </p>
      )}
      <p className="text-xs leading-relaxed text-muted-foreground">
        {rows.length ? `${rows.length} kural. ` : 'Kural yok. '}
        Kuralın tutmadığı her link ana linke gider.
        {offerShare && ' “Sadece bu kaynak için” işaretini kaldırdığın kural kaydedince ortak kurallara taşınır ve bütün kaynaklarda uygulanır.'}
        {shared.length > 0 && ` Ayrıca ${shared.length} ortak kural uygulanıyor.`}
      </p>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-xs font-medium text-foreground">
          Önce (örnek post, değiştirebilirsin)
          <textarea value={sample} onChange={(e) => setSample(e.target.value)} rows={5} className={cn(input, 'text-xs leading-relaxed')} />
        </label>
        <div className="flex flex-col gap-1.5 text-xs font-medium text-foreground">
          <span>Sonra</span>
          <pre aria-live="polite" className="min-h-24 flex-1 whitespace-pre-wrap rounded-xl border border-border bg-card p-3 font-sans text-xs leading-relaxed text-foreground">
            {after || '(boş)'}
          </pre>
        </div>
      </div>
    </fieldset>
  )
}
