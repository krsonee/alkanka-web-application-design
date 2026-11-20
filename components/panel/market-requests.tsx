'use client'

import { useState, useTransition } from 'react'
import { Check, Search, X, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MarketRequest, RequestStatus } from '@/lib/market'
import { resolveMarketRequestAction } from '@/app/panel/market-actions'
import { askConfirm, askReason } from '@/components/panel/confirm-dialog'
import { Flash } from '@/components/panel/flash'

const field = 'h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary'

const REJECT_REASONS = ['Site kullanıcı adı hatalı ya da eksik', 'Sponsor sitede hesap bulunamadı', 'Bu ürün şu an verilemiyor']

type Filter = RequestStatus | 'hepsi'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'beklemede', label: 'Bekleyen' },
  { id: 'onaylandi', label: 'Onaylanan' },
  { id: 'reddedildi', label: 'Reddedilen' },
  { id: 'hepsi', label: 'Hepsi' },
]

const fold = (text: string | null) => (text ?? '').toLocaleLowerCase('tr')

export function MarketRequests({ requests }: { requests: MarketRequest[] }) {
  const waiting = requests.filter((r) => r.status === 'beklemede').length
  const [filter, setFilter] = useState<Filter>(waiting ? 'beklemede' : 'hepsi')
  const [query, setQuery] = useState('')
  const [notes, setNotes] = useState<Record<number, string>>({})
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, start] = useTransition()

  const needle = fold(query.trim())
  const shown = requests.filter(
    (r) => (filter === 'hepsi' || r.status === filter) && (!needle || [r.itemName, r.userName, r.siteUsername, r.sponsorName].some((text) => fold(text).includes(needle))),
  )
  const count = (id: Filter) => (id === 'hepsi' ? requests.length : requests.filter((r) => r.status === id).length)

  function resolve(id: number, approve: boolean, note: string) {
    start(async () => {
      const res = await resolveMarketRequestAction(id, approve, note)
      setMsg(res.ok ? { ok: true, text: res.message ?? 'Kaydedildi.' } : { ok: false, text: res.error })
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Talep durumu" className="flex flex-wrap gap-1 rounded-lg border border-border bg-card p-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={cn('rounded-md px-3 py-1.5 text-xs font-semibold', filter === f.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
            >
              {`${f.label} (${count(f.id)})`}
            </button>
          ))}
        </div>
        <label className="relative flex min-w-48 flex-1 items-center">
          <span className="sr-only">Taleplerde ara</span>
          <Search className="pointer-events-none absolute left-3 size-4 text-muted-foreground" aria-hidden="true" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ürün, üye ya da site kullanıcı adı ara" className={cn(field, 'w-full pl-9')} />
        </label>
        <Flash ok={msg?.ok} text={msg?.text} token={msg} />
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">
        Buraya sadece elle teslim edilen ürünlerin talepleri iş olarak düşer. Otomatik teslim edilen ürünler kendiliğinden onaylanır ve &quot;Onaylanan&quot; altında kayıt olarak görünür.
      </p>

      {shown.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {requests.length === 0 ? 'Henüz talep yok.' : filter === 'beklemede' && !needle ? 'Bekleyen talep yok, sıra temiz.' : 'Bu süzgece uyan talep yok.'}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {shown.map((r) => (
            <li key={r.id} className={cn('flex flex-col gap-2 rounded-xl border bg-card p-3', r.status === 'beklemede' ? 'border-primary/50' : 'border-border')}>
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="font-semibold text-foreground">{r.itemName}</span>
                <span className="text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleString('tr-TR')}</span>
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
                <div>
                  <dt className="text-muted-foreground">Üye</dt>
                  <dd className="font-medium text-foreground">{r.userName}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Site</dt>
                  <dd className="font-medium text-foreground">{r.sponsorName ?? 'AL KANKA'}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Site kullanıcı adı</dt>
                  <dd className="select-all font-mono font-bold text-primary">{r.siteUsername ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Tutar</dt>
                  <dd className="font-medium text-foreground tabular-nums">{r.price.toLocaleString('tr-TR')} KC</dd>
                </div>
              </dl>
              {r.needsDelivery && (
                <p className="flex items-start gap-2 rounded-lg bg-primary/10 p-2 text-xs leading-relaxed text-foreground">
                  <Zap className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden="true" />
                  Bu ürün otomatik teslim edilir ama satın alma anında ödül hesaba eklenemedi. Onayladığında ödül üyenin hesabına şimdi eklenir; elle bir şey vermene gerek yok.
                </p>
              )}
              {r.status === 'beklemede' ? (
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    value={notes[r.id] ?? ''}
                    onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                    maxLength={300}
                    aria-label={`${r.userName} için not (en fazla 300 karakter, üyeye görünür)`}
                    placeholder="Not (isteğe bağlı, üyeye görünür)"
                    className={cn(field, 'min-w-0 flex-1')}
                  />
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      void askConfirm(
                        r.needsDelivery
                          ? `${r.userName} adlı üyenin "${r.itemName}" talebi onaylansın mı? Ödül üyenin hesabına şimdi eklenecek.`
                          : `${r.userName} adlı üyenin "${r.itemName}" talebi onaylansın mı? Onay geri alınamaz; ödülü üyeye teslim ettiğinden emin ol.`,
                      ).then((ok) => ok && resolve(r.id, true, notes[r.id] ?? ''))
                    }
                    className="flex h-10 items-center gap-1.5 rounded-lg bg-success px-3 text-sm font-semibold text-background disabled:opacity-50"
                  >
                    <Check className="size-4" aria-hidden="true" /> Onayla
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      void askReason(`${r.userName} adlı üyenin "${r.itemName}" talebi reddedilecek ve ${r.price.toLocaleString('tr-TR')} KC iade edilecek. Sebebi üye görür.`, {
                        label: 'Red sebebi',
                        required: true,
                        initial: notes[r.id] ?? '',
                        confirm: 'Reddet ve iade et',
                        presets: REJECT_REASONS,
                      }).then((note) => note !== null && resolve(r.id, false, note))
                    }
                    className="flex h-10 items-center gap-1.5 rounded-lg border border-destructive/50 px-3 text-sm font-semibold text-destructive disabled:opacity-50"
                  >
                    <X className="size-4" aria-hidden="true" /> Reddet ve iade et
                  </button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {r.status === 'onaylandi' ? 'Onaylandı' : 'Reddedildi (KC iade edildi)'}
                  {r.note && ` · ${r.note}`}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
