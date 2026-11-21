'use client'

import { useState, useTransition } from 'react'
import { Check, Coins, X } from 'lucide-react'
import { requestMarketItem } from '@/app/actions/market'
import type { MarketProduct } from '@/lib/market'
import { rewardText } from '@/lib/market-shared'
import { useEscape } from '@/lib/use-escape'
import { formatAC } from '../points-context'

export type RequestResult = Awaited<ReturnType<typeof requestMarketItem>>

export function RequestDialog({
  item,
  points,
  error,
  onClose,
  onDone,
}: {
  item: MarketProduct
  points: number
  error: string | null
  onClose: () => void
  onDone: (res: RequestResult) => void
}) {
  const [username, setUsername] = useState('')
  const [pending, startTransition] = useTransition()
  useEscape(true, onClose)
  const short = item.price - points
  const auto = item.deliveryMode === 'auto' && item.reward

  function submit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => onDone(await requestMarketItem(item.id, item.needsUsername ? username : null)))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 p-4 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="market-request-title"
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-md flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-bold uppercase tracking-wider text-primary">{item.kind === 'sponsor' ? item.sponsorName : 'AL KANKA'}</span>
            <h2 id="market-request-title" className="font-display text-lg font-bold text-foreground text-balance">
              {item.name}
            </h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Kapat" className="rounded-md p-1 text-muted-foreground hover:text-foreground">
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        {item.needsUsername && (
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-foreground">{item.kind === 'sponsor' ? `${item.sponsorName} kullanıcı adın` : 'Kullanıcı adın'}</span>
            <input
              autoFocus
              required
              minLength={2}
              maxLength={60}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Sitedeki kullanıcı adını yaz"
              className="h-11 rounded-lg border border-border bg-background px-3 text-foreground outline-none focus:border-primary"
            />
            <span className="text-xs leading-relaxed text-muted-foreground">Bonus bu kullanıcı adına yüklenecek. Yanlış yazılan taleplerde iade yapılır.</span>
          </label>
        )}

        <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
          {auto && item.reward
            ? item.reward.kind === 'rozet'
              ? 'Onayladığın anda rozet profiline takılır.'
              : `Onayladığın anda ${rewardText(item.reward)} hesabına eklenir.`
            : 'Coin şimdi düşer, talebin ekibin sırasına girer. Reddedilirse coinin iade edilir.'}
        </p>

        <div className="flex items-center justify-between rounded-lg bg-secondary px-3 py-2 text-sm">
          <span className="text-muted-foreground">Ödenecek</span>
          <span className="flex items-center gap-1 font-display font-bold text-foreground tabular-nums">
            <Coins className="size-4 text-primary" aria-hidden="true" />
            {formatAC(item.price)} KC
          </span>
        </div>

        <p aria-live="polite" className="min-h-4 text-xs text-destructive">
          {error ?? (short > 0 ? `${formatAC(short)} KC eksik. Oyunlardan ve görevlerden toplayabilirsin.` : '')}
        </p>

        <button
          type="submit"
          disabled={pending || short > 0}
          className="flex h-11 items-center justify-center gap-2 rounded-lg bg-primary text-xs font-bold uppercase tracking-wider text-primary-foreground disabled:opacity-50"
        >
          <Check className="size-4" aria-hidden="true" />
          {pending ? 'Gönderiliyor...' : auto ? 'Satın al' : 'Talebi gönder'}
        </button>
      </form>
    </div>
  )
}
