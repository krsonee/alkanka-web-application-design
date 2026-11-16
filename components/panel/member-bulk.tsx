'use client'

import { useEffect, useState, useTransition } from 'react'
import { Gift, Mail, Snowflake, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { parseAmount } from '@/lib/amount'
import { confirmed, notify } from '@/components/panel/confirm-dialog'
import { bulkMembersAction } from '@/app/panel/members-actions'
import { BULK_GIFT_MAX, BULK_LIMIT, bulkProblem, SUSPEND_DURATIONS, type BulkInput, type BulkSkipped } from '@/lib/members-bulk-shared'
import type { MemberStatus } from '@/lib/members-admin'

export type Picked = { id: string; name: string; status: MemberStatus }

type Kind = BulkInput['kind']

const field = 'rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary'
const tr = (n: number) => n.toLocaleString('tr-TR')

const TITLES: Record<Kind, string> = { message: 'Toplu mesaj', gift: 'Toplu hediye', suspend: 'Toplu dondurma' }
const SUBMIT: Record<Kind, string> = { message: 'Mesajı gönder', gift: 'Hediyeleri gönder', suspend: 'Dondur' }

export function BulkBar({ picked, canMessage, onClear, onDone }: { picked: Picked[]; canMessage: boolean; onClear: () => void; onDone: () => void }) {
  const [kind, setKind] = useState<Kind | null>(null)
  if (picked.length === 0) return null

  const action = 'flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-semibold text-foreground hover:bg-secondary'

  return (
    <>
      <div
        role="region"
        aria-label="Toplu işlem"
        className="sticky bottom-3 z-20 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/40 bg-card px-4 py-3 shadow-lg"
      >
        <p className="text-sm font-semibold text-foreground" aria-live="polite">
          {`${picked.length} üye seçili`}
          <span className="font-normal text-muted-foreground">{` · en fazla ${BULK_LIMIT}`}</span>
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {canMessage && (
            <button type="button" onClick={() => setKind('message')} className={action}>
              <Mail className="size-4" aria-hidden="true" />
              Mesaj gönder
            </button>
          )}
          <button type="button" onClick={() => setKind('gift')} className={action}>
            <Gift className="size-4" aria-hidden="true" />
            Hediye gönder
          </button>
          <button type="button" onClick={() => setKind('suspend')} className={action}>
            <Snowflake className="size-4" aria-hidden="true" />
            Dondur
          </button>
          <button type="button" onClick={onClear} className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground">
            Seçimi bırak
          </button>
        </div>
      </div>
      {kind && <BulkDialog key={kind} kind={kind} picked={picked} onClose={() => setKind(null)} onDone={onDone} />}
    </>
  )
}

function BulkDialog({ kind, picked, onClose, onDone }: { kind: Kind; picked: Picked[]; onClose: () => void; onDone: () => void }) {
  const [busy, start] = useTransition()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [url, setUrl] = useState('')
  const [amount, setAmount] = useState('')
  const [giftMsg, setGiftMsg] = useState('')
  const [duration, setDuration] = useState('7')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<{ message: string; skipped: BulkSkipped[] } | null>(null)

  const count = picked.length
  const blocked = picked.filter((p) => p.status === 'banli' || p.status === 'donduruldu').length
  const gift = amount.trim() === '' ? NaN : (parseAmount(amount) ?? NaN)
  const giftTotal = Number.isInteger(gift) && gift > 0 ? gift * count : 0
  const input: BulkInput = kind === 'message' ? { kind, title, body, url } : kind === 'gift' ? { kind, amount: gift, message: giftMsg } : { kind, duration, reason }
  const problem = bulkProblem(input, count)
  const touched = kind === 'message' ? !!(title || body || url) : kind === 'gift' ? !!(amount || giftMsg) : !!reason

  const finish = () => {
    if (report) onDone()
    onClose()
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && finish()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy, report])

  const question =
    kind === 'message'
      ? `${count} üyenin gelen kutusuna "${title.trim()}" mesajı gönderilsin mi?`
      : kind === 'gift'
        ? `${count} üyenin her birine ${tr(gift)} KC hediye gönderilsin mi? Toplam ${tr(giftTotal)} KC hemen hesaplara eklenir, geri alınamaz.`
        : `${count} üye ${SUSPEND_DURATIONS.find((d) => d.id === duration)?.label.toLocaleLowerCase('tr') ?? ''} dondurulsun mu? Bu sürede hesaplarına giremezler, açık oturumları kapanır.`

  const send = () =>
    start(async () => {
      setError(null)
      const r = await bulkMembersAction(
        picked.map((p) => p.id),
        input,
      )
      if (!r.ok) return setError(r.error)
      if (r.skipped.length === 0) {
        notify(true, r.message)
        onDone()
        onClose()
        return
      }
      setReport({ message: r.message, skipped: r.skipped })
    })

  const names = picked.slice(0, 5).map((p) => p.name).join(', ')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={TITLES[kind]}>
      <button type="button" aria-label="Kapat" disabled={busy} onClick={finish} className="absolute inset-0 bg-background/70 backdrop-blur-sm" />
      <div className="relative flex max-h-full w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-xl border border-border bg-card p-5">
        <header className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <h3 className="font-display text-lg font-bold text-foreground">{TITLES[kind]}</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {`${count} üye: ${names}${count > 5 ? ` ve ${count - 5} kişi daha` : ''}`}
            </p>
          </div>
          <button type="button" onClick={finish} disabled={busy} aria-label="Kapat" className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground">
            <X className="size-5" aria-hidden="true" />
          </button>
        </header>

        {report ? (
          <>
            <p role="status" className="rounded-lg bg-primary/15 px-3 py-2 text-sm text-primary">
              {report.message}
            </p>
            <div className="flex flex-col gap-2">
              <h4 className="text-sm font-semibold text-foreground">Atlanan üyeler</h4>
              <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto rounded-lg bg-background p-3 text-sm">
                {report.skipped.map((s, i) => (
                  <li key={`${s.name}-${i}`} className="flex flex-col">
                    <span className="truncate font-medium text-foreground">{s.name}</span>
                    <span className="text-xs leading-relaxed text-muted-foreground">{s.why}</span>
                  </li>
                ))}
              </ul>
            </div>
            <button type="button" onClick={finish} className="self-end rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
              Tamam
            </button>
          </>
        ) : (
          <>
            {blocked > 0 && (
              <p className="rounded-lg bg-live/10 px-3 py-2 text-sm leading-relaxed text-foreground">
                {kind === 'suspend'
                  ? `Seçilenlerin ${blocked} tanesi zaten banlı ya da dondurulmuş. Onlara dokunulmaz, sonunda listelenir.`
                  : `Seçilenlerin ${blocked} tanesi banlı ya da dondurulmuş. ${kind === 'gift' ? 'Hediye' : 'Mesaj'} onlara da gider.`}
              </p>
            )}

            {kind === 'message' && (
              <>
                <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                  Başlık
                  <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} className={field} />
                </label>
                <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                  Mesaj
                  <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} maxLength={1000} className={cn(field, 'resize-y leading-relaxed')} />
                </label>
                <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                  Link (isteğe bağlı)
                  <input value={url} onChange={(e) => setUrl(e.target.value)} maxLength={200} placeholder="/oyunlar/cark" className={field} />
                </label>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Her üyeye ayrı bir mesaj gider; &quot;Site içi mesajlar&quot; ekranındaki gönderilenler listesinde de üye başına bir satır olur.
                </p>
              </>
            )}

            {kind === 'gift' && (
              <>
                <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                  Üye başına tutar (KC)
                  <input autoFocus inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} maxLength={12} placeholder={`1 - ${tr(BULK_GIFT_MAX)}`} className={field} />
                </label>
                <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                  Hediye mesajı (isteğe bağlı)
                  <textarea value={giftMsg} onChange={(e) => setGiftMsg(e.target.value)} rows={2} maxLength={300} placeholder="Örn. Turnuva tesellisi, iyi şanslar!" className={cn(field, 'resize-y leading-relaxed')} />
                </label>
                <p className="text-sm text-foreground">
                  {`Toplam: ${tr(giftTotal)} KC`}
                  <span className="text-muted-foreground">{` (${count} üye)`}</span>
                </p>
              </>
            )}

            {kind === 'suspend' && (
              <>
                <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                  Süre
                  <select value={duration} onChange={(e) => setDuration(e.target.value)} className={field}>
                    {SUSPEND_DURATIONS.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                  Dondurma sebebi (zorunlu, hepsine aynı sebep yazılır)
                  <textarea autoFocus value={reason} onChange={(e) => setReason(e.target.value)} rows={2} maxLength={500} className={cn(field, 'resize-y leading-relaxed')} />
                </label>
              </>
            )}

            <p aria-live="polite" className={cn('text-sm leading-relaxed', error ? 'text-destructive' : 'text-live')}>
              {error ?? (touched && problem ? problem : '')}
            </p>

            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" onClick={finish} disabled={busy} className="rounded-lg border border-border px-4 py-2 text-sm text-foreground hover:bg-secondary disabled:opacity-40">
                Vazgeç
              </button>
              <button
                type="button"
                disabled={busy || !!problem}
                onClick={() => confirmed(question, send)}
                className={cn('rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-40', kind === 'suspend' ? 'bg-destructive text-destructive-foreground' : 'bg-primary text-primary-foreground')}
              >
                {busy ? 'Yapılıyor…' : SUBMIT[kind]}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
