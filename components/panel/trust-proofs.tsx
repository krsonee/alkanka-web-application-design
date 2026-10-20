'use client'

import { Check, Send, X } from 'lucide-react'
import { decideReviewProof, postKarneNow } from '@/app/panel/community-actions'
import type { PendingProof } from '@/lib/trust-extra'
import { StatusLine, useAction } from '@/components/alkanka/community/use-action'

export function TrustProofs({ proofs, siteNames }: { proofs: PendingProof[]; siteNames: Record<string, string> }) {
  const action = useAction()
  const karne = useAction()

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
        <div className="flex flex-col">
          <span className="text-sm font-bold text-foreground">Haftalık güven karnesi</span>
          <span className="text-xs text-muted-foreground">Her pazartesi otomatik Telegram kanalına gider. Şimdi göndermek için butona bas.</span>
        </div>
        <button
          type="button"
          disabled={karne.pending}
          onClick={() => karne.run(() => postKarneNow())}
          className="flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-bold text-primary-foreground disabled:opacity-50"
        >
          <Send className="size-3.5" aria-hidden />
          Karneyi gönder
        </button>
        <StatusLine status={karne.status} />
      </div>

      <h3 className="text-sm font-bold text-foreground">Kanıt bekleyen yorumlar ({proofs.length})</h3>
      {proofs.length ? (
        <ul className="grid gap-3 md:grid-cols-2">
          {proofs.map((p) => (
            <li key={p.reviewId} className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3">
              <span className="text-xs text-muted-foreground">
                <b className="text-foreground">{p.userName}</b> · {siteNames[p.siteId] ?? p.siteId} · {p.rating} yıldız
              </span>
              <p className="line-clamp-3 text-sm text-foreground">{p.body}</p>
              <a href={`/api/guven/kanit/${encodeURIComponent(p.proofPath.split('/').pop() ?? '')}`} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/guven/kanit/${encodeURIComponent(p.proofPath.split('/').pop() ?? '')}`} alt={`${p.userName} kanıt görüntüsü`} className="max-h-64 w-full object-contain" />
              </a>
              <div className="flex gap-2">
                <button type="button" disabled={action.pending} onClick={() => action.run(() => decideReviewProof(p.reviewId, true))} className="flex h-9 flex-1 items-center justify-center gap-1 rounded-lg bg-primary text-xs font-bold text-primary-foreground disabled:opacity-50">
                  <Check className="size-3.5" aria-hidden /> Onayla
                </button>
                <button type="button" disabled={action.pending} onClick={() => action.run(() => decideReviewProof(p.reviewId, false))} className="flex h-9 flex-1 items-center justify-center gap-1 rounded-lg border border-border text-xs font-bold text-foreground disabled:opacity-50">
                  <X className="size-3.5" aria-hidden /> Reddet
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Bekleyen kanıt yok.</p>
      )}
      <StatusLine status={action.status} />
    </div>
  )
}
