'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { Check, X, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { askConfirm, askReason, notify } from '@/components/panel/confirm-dialog'
import { decideReviewProof, moderateReview } from '@/app/panel/community-actions'
import { approveClaimAction, rejectClaimAction } from '@/app/panel/task-actions'
import { resolveMarketRequestAction } from '@/app/panel/market-actions'
import { rejectShare } from '@/app/panel/withdraw-actions'

export type ModerationKind = 'proof' | 'review' | 'claim' | 'market' | 'complaint' | 'withdraw'

export type ModerationItem = {
  key: string
  kind: ModerationKind
  id: number
  title: string
  who: string
  detail: string
  createdAt?: string
  image?: string
}

const KIND_LABEL: Record<ModerationKind, string> = {
  proof: 'Çekim kanıtı',
  review: 'Yorum',
  claim: 'Görev onayı',
  market: 'Market talebi',
  complaint: 'Şikayet',
  withdraw: 'Çekim paylaşımı',
}

/** Where the full screen for a kind lives; `s` opens the right tab inside that section. */
const KIND_LINK: Record<ModerationKind, string> = {
  proof: '/panel?b=community&s=kanit',
  review: '/panel?b=community&s=reviews',
  complaint: '/panel?b=community&s=complaints',
  withdraw: '/panel?b=community&s=cekim',
  claim: '/panel?b=tasks',
  market: '/panel?b=market',
}

/** These need more than yes or no (a reply, or a reward amount), so the queue sends the admin to their own screen to approve. */
const OPEN_TO_APPROVE = new Set<ModerationKind>(['complaint', 'withdraw'])
/** A rejection of these reaches the member, so the queue asks why. */
const REASONED = new Set<ModerationKind>(['claim', 'market', 'withdraw'])

type Result = { ok: true; message?: string } | { ok: false; error: string }

function decide(item: ModerationItem, approve: boolean, note: string): Promise<Result> {
  switch (item.kind) {
    case 'proof':
      return decideReviewProof(item.id, approve)
    case 'review':
      return moderateReview(item.id, approve ? 'approved' : 'rejected')
    case 'claim':
      return approve ? approveClaimAction(item.id) : rejectClaimAction(item.id, note)
    case 'market':
      return resolveMarketRequestAction(item.id, approve, note) as Promise<Result>
    case 'withdraw':
      return approve ? Promise.resolve({ ok: false, error: 'Çekim paylaşımı ödül seçilerek onaylanır, "İncele" ile aç.' }) : (rejectShare(item.id, note) as Promise<Result>)
    default:
      return Promise.resolve({ ok: false, error: 'Şikayetler yanıt gerektirir, Topluluk bölümünden işle.' })
  }
}

export function ModerationQueue({ items }: { items: ModerationItem[] }) {
  const [list, setList] = useState(items)
  const [filter, setFilter] = useState<ModerationKind | 'all'>('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, startBusy] = useTransition()

  const counts = list.reduce<Record<string, number>>((acc, i) => ((acc[i.kind] = (acc[i.kind] ?? 0) + 1), acc), {})
  const visible = filter === 'all' ? list : list.filter((i) => i.kind === filter)
  const actionable = visible.filter((i) => !OPEN_TO_APPROVE.has(i.kind))
  const allChecked = actionable.length > 0 && actionable.every((i) => selected.has(i.key))

  const toggle = (key: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  /** Null when the admin backs out of the reason box; an empty string when no reason is needed. */
  const reasonFor = (targets: ModerationItem[]) => {
    const reasoned = targets.filter((i) => REASONED.has(i.kind))
    if (reasoned.length === 0) return Promise.resolve('')
    return askReason(
      reasoned.length === 1
        ? `"${reasoned[0].title}" reddedilecek. Sebep üyeye gider.`
        : `${reasoned.length} kayıt reddedilecek. Yazdığın sebep hepsinde üyeye gider.`,
      { label: 'Red sebebi', confirm: 'Reddet', presets: ['Kanıt eksik ya da okunmuyor', 'Bilgiler eşleşmiyor', 'Kurallara uygun değil'] },
    )
  }

  const reject = async (targets: ModerationItem[]) => {
    const note = await reasonFor(targets)
    if (note !== null) run(targets, false, note)
  }

  const run = (targets: ModerationItem[], approve: boolean, note = '') =>
    startBusy(async () => {
      const doneKeys = new Set<string>()
      const failed: string[] = []
      for (const item of targets) {
        const res = await decide(item, approve, note)
        if (res.ok) doneKeys.add(item.key)
        else failed.push(res.error)
      }
      setList((prev) => prev.filter((i) => !doneKeys.has(i.key)))
      setSelected((prev) => new Set([...prev].filter((k) => !doneKeys.has(k))))
      if (failed.length === 0) notify(true, `${doneKeys.size} kayıt ${approve ? 'onaylandı' : 'reddedildi'}.`)
      else notify(false, `${doneKeys.size} işlendi, ${failed.length} hata: ${failed[0]}`)
    })

  const bulk = async (approve: boolean) => {
    const targets = list.filter((i) => selected.has(i.key) && !OPEN_TO_APPROVE.has(i.kind))
    if (!targets.length) return
    if (!approve && targets.some((i) => REASONED.has(i.kind))) return reject(targets)
    if (!(await askConfirm(`${targets.length} kayıt ${approve ? 'onaylanacak' : 'reddedilecek'}. Emin misin?`))) return
    run(targets, approve)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Kuyruk filtresi">
        {(['all', 'proof', 'review', 'withdraw', 'claim', 'market', 'complaint'] as const).map((k) => {
          const n = k === 'all' ? list.length : counts[k] ?? 0
          return (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={filter === k}
              onClick={() => setFilter(k)}
              className={cn(
                'flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm',
                filter === k ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-foreground hover:bg-secondary',
              )}
            >
              {k === 'all' ? 'Tümü' : KIND_LABEL[k]}
              <span className="tabular-nums opacity-80">{n}</span>
            </button>
          )
        })}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card px-6 py-12 text-center text-sm text-muted-foreground">
          Bu kuyrukta bekleyen iş yok.
        </div>
      ) : (
        <div className="flex flex-col overflow-hidden rounded-lg border border-border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={allChecked}
                disabled={!actionable.length}
                onChange={() => setSelected(allChecked ? new Set() : new Set(actionable.map((i) => i.key)))}
              />
              Görünenleri seç {selected.size > 0 && <span className="text-muted-foreground">({selected.size} seçili)</span>}
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={busy || selected.size === 0}
                onClick={() => bulk(false)}
                className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-secondary disabled:opacity-50"
              >
                <X className="size-4" aria-hidden="true" /> Seçilenleri reddet
              </button>
              <button
                type="button"
                disabled={busy || selected.size === 0}
                onClick={() => bulk(true)}
                className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                <Check className="size-4" aria-hidden="true" /> Seçilenleri onayla
              </button>
            </div>
          </div>
          <ul className="flex flex-col divide-y divide-border">
            {visible.map((item) => (
              <li key={item.key} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  {!OPEN_TO_APPROVE.has(item.kind) ? (
                    <input
                      type="checkbox"
                      aria-label={`${item.title} seç`}
                      className="mt-1 size-4 shrink-0 accent-primary"
                      checked={selected.has(item.key)}
                      onChange={() => toggle(item.key)}
                    />
                  ) : (
                    <span className="size-4 shrink-0" aria-hidden="true" />
                  )}
                  {item.image && (
                    <a href={item.image} target="_blank" rel="noreferrer" className="shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.image || '/placeholder.svg'} alt={`${item.who} çekim kanıtı`} className="size-14 rounded-md border border-border object-cover" />
                    </a>
                  )}
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded bg-secondary px-1.5 py-0.5 text-xs font-medium text-secondary-foreground">{KIND_LABEL[item.kind]}</span>
                      <span className="truncate text-sm font-medium text-foreground">{item.title}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {item.who}
                      {item.createdAt && ` · ${new Date(item.createdAt).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })}`}
                    </span>
                    {item.detail && <p className="line-clamp-2 text-sm leading-relaxed text-foreground">{item.detail}</p>}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2 pl-7 sm:pl-0">
                  {OPEN_TO_APPROVE.has(item.kind) ? (
                    <>
                      {item.kind === 'withdraw' && (
                        <button type="button" disabled={busy} onClick={() => reject([item])} className="flex size-9 items-center justify-center rounded-md border border-border text-foreground hover:bg-secondary disabled:opacity-50" aria-label="Reddet">
                          <X className="size-4" aria-hidden="true" />
                        </button>
                      )}
                      <Link href={KIND_LINK[item.kind]} className="flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-sm text-foreground hover:bg-secondary">
                        {item.kind === 'complaint' ? 'Yanıtla' : 'İncele ve onayla'} <ExternalLink className="size-3.5" aria-hidden="true" />
                      </Link>
                    </>
                  ) : (
                    <>
                      <button type="button" disabled={busy} onClick={() => reject([item])} className="flex size-9 items-center justify-center rounded-md border border-border text-foreground hover:bg-secondary disabled:opacity-50" aria-label="Reddet">
                        <X className="size-4" aria-hidden="true" />
                      </button>
                      <button type="button" disabled={busy} onClick={() => run([item], true)} className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50" aria-label="Onayla">
                        <Check className="size-4" aria-hidden="true" />
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
