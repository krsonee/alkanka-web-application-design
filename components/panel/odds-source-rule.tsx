'use client'

import { useActionState, useState } from 'react'
import { Filter, Hourglass, Loader2 } from 'lucide-react'
import { resolveOddsQueueAction, updateOddsSourceRuleAction } from '@/app/panel/odds-bot-actions'
import type { ActionState } from '@/app/panel/actions'
import { ODDS_PASS_OPTIONS, type OddsPassMode, type OddsQueueItem, type OddsSource } from '@/lib/special-odds-shared'
import { cn } from '@/lib/utils'
import { ButtonRows, type LinkChoice } from './tg-button-rows'

const input = 'w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none'
const label = 'flex flex-col gap-1.5 text-sm font-medium text-foreground'
const hint = 'text-xs font-normal leading-relaxed text-muted-foreground'
const smallBtn = 'inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary disabled:opacity-50'

type RuleSource = Pick<OddsSource, 'passMode' | 'passWords' | 'buttons'>

/** Which posts of the source are shared, and the buttons under them. */
export function RuleFields({ source, links }: { source?: RuleSource; links?: LinkChoice[] }) {
  const [mode, setMode] = useState<OddsPassMode>(source?.passMode ?? 'odds')
  const option = ODDS_PASS_OPTIONS.find((o) => o.value === mode)!
  return (
    <>
      <label className={label}>
        Hangi postlar paylaşılsın?
        <select name="passMode" value={mode} onChange={(e) => setMode(e.target.value as OddsPassMode)} className={input}>
          {ODDS_PASS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <span className={hint}>{option.hint}</span>
      </label>
      <label className={label}>
        Anahtar kelimeler
        <input
          name="passWords"
          defaultValue={source?.passWords ?? ''}
          maxLength={400}
          disabled={mode !== 'keyword'}
          placeholder="özel oran, boost, süper oran"
          className={cn(input, 'disabled:opacity-50')}
        />
        <span className={hint}>{mode === 'keyword' ? 'Virgülle ayır. Büyük küçük harf fark etmez.' : 'Sadece “Anahtar kelime geçenler” seçiliyken kullanılır.'}</span>
      </label>
      <div className="md:col-span-2">
        <ButtonRows initial={source?.buttons} links={links} />
      </div>
    </>
  )
}

const MODE_SHORT: Record<OddsPassMode, string> = { odds: 'sadece oranlar', keyword: 'anahtar kelime', all: 'hepsi' }

export function RuleEditor({ source, links }: { source: OddsSource; links?: LinkChoice[] }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(updateOddsSourceRuleAction, {})
  return (
    <details className="w-full rounded-xl border border-border bg-background/50">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 px-3 py-2 text-xs font-semibold text-foreground">
        <Filter className="size-3.5" aria-hidden="true" />
        Paylaşım kuralı ve butonlar
        <span className="font-normal text-muted-foreground">
          · {MODE_SHORT[source.passMode]} · {source.buttons.length ? `${source.buttons.length} buton` : 'buton yok'}
        </span>
      </summary>
      <form action={action} className="grid gap-3 border-t border-border p-3 md:grid-cols-2">
        <input type="hidden" name="id" value={source.id} />
        <RuleFields source={source} links={links} />
        <div className="flex items-center gap-3 md:col-span-2">
          <button disabled={pending} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50">
            {pending && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}Kaydet
          </button>
          {state.message && (
            <p role="status" className={cn('text-xs', state.ok ? 'text-primary' : 'text-destructive')}>
              {state.message}
            </p>
          )}
        </div>
      </form>
    </details>
  )
}

const STATE_LABEL: Record<OddsQueueItem['state'], string> = { held: 'Bekliyor', skipped: 'Atlandı', sent: 'Oransız paylaşıldı' }

function QueueRow({ item }: { item: OddsQueueItem }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(resolveOddsQueueAction, {})
  const firstLine = item.text.split('\n').find((line) => line.trim()) ?? '(yazısız post)'
  return (
    <li className="flex flex-col gap-2 p-3">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        <span
          className={cn(
            'rounded-md px-1.5 py-0.5 font-bold uppercase tracking-wide',
            item.state === 'held' ? 'bg-primary/15 text-primary' : item.state === 'sent' ? 'bg-accent/15 text-accent' : 'bg-secondary text-muted-foreground',
          )}
        >
          {STATE_LABEL[item.state]}
        </span>
        <span className="font-semibold text-foreground">{item.siteName}</span>
        <span className="text-muted-foreground">
          {new Date(item.at).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', dateStyle: 'short', timeStyle: 'short' })}
          {item.hasMedia ? ' · medyalı' : ''}
        </span>
      </div>
      {item.reason && <p className="text-sm leading-relaxed text-foreground">{item.reason}</p>}
      <details className="text-sm text-muted-foreground">
        <summary className="cursor-pointer truncate">{firstLine.slice(0, 120)}</summary>
        <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-background p-3 font-sans text-xs leading-relaxed text-foreground">{item.text}</pre>
      </details>
      <form action={action} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="id" value={item.id} />
        {item.state === 'held' && (
          <>
            <button type="submit" name="action" value="media" disabled={pending} className={smallBtn}>
              Medyayla tekrar dene
            </button>
            <button type="submit" name="action" value="text" disabled={pending} className={smallBtn}>
              Yazıyla gönder
            </button>
          </>
        )}
        {item.state === 'skipped' && (
          <button type="submit" name="action" value="send" disabled={pending} className={smallBtn}>
            Yine de paylaş
          </button>
        )}
        <button type="submit" name="action" value="dismiss" disabled={pending} className={cn(smallBtn, 'text-destructive')}>
          Kaydı sil
        </button>
        {pending && <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden="true" />}
        {state.message && (
          <p role="status" className={cn('text-xs', state.ok ? 'text-primary' : 'text-destructive')}>
            {state.message}
          </p>
        )}
      </form>
    </li>
  )
}

export function OddsQueueCard({ items }: { items: OddsQueueItem[] }) {
  const held = items.filter((item) => item.state === 'held').length
  return (
    <section aria-labelledby="ob-queue" className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent">
          <Hourglass className="size-4" aria-hidden="true" />
        </span>
        <div className="flex flex-col gap-1">
          <h2 id="ob-queue" className="text-base font-semibold text-foreground">
            Bekleyen ve atlanan postlar
          </h2>
          <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
            Kaynağın kuralına takılan postlar “Atlandı”, medyası alınamayanlar “Bekliyor” olarak burada durur. Atlanan ve oransız paylaşılan kayıtlar 7 gün
            sonra kendiliğinden silinir; bekleyenler sen karar verene kadar kalır.
          </p>
        </div>
      </div>
      {items.length ? (
        <>
          {held > 0 && (
            <p role="status" className="rounded-lg bg-primary/10 p-3 text-sm font-medium text-foreground">
              {held} post medyası alınamadığı için bekliyor.
            </p>
          )}
          <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
            {items.map((item) => (
              <QueueRow key={item.id} item={item} />
            ))}
          </ul>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Bekleyen ya da atlanan post yok.</p>
      )}
    </section>
  )
}
