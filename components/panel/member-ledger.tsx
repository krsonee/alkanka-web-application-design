'use client'

import useSWRInfinite from 'swr/infinite'
import { memberLedgerAction } from '@/app/panel/members-actions'
import { LEDGER_KEEP_DAYS, LEDGER_PAGE_SIZE } from '@/lib/wallet-ledger-shared'
import { cn } from '@/lib/utils'

const when = (iso: string) => new Date(iso).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })
const day = (iso: string) => new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
const kc = (n: number) => `${n.toLocaleString('tr-TR')} KC`
const signed = (n: number) => `${n > 0 ? '+' : ''}${n.toLocaleString('tr-TR')} KC`

export function MemberLedger({ userId, balance }: { userId: string; balance: number }) {
  const { data, error, isLoading, isValidating, size, setSize } = useSWRInfinite(
    (page) => ['member-ledger', userId, page] as const,
    async ([, id, page]) => {
      const res = await memberLedgerAction(id, page)
      if (!res) throw new Error('Döküm alınamadı.')
      return res
    },
    { revalidateOnFocus: false, revalidateFirstPage: false },
  )

  if (isLoading) return <p className="text-sm text-muted-foreground">Yükleniyor…</p>
  if (error || !data?.length) return <p className="text-sm text-destructive">Coin dökümü alınamadı. Sayfayı yenileyip tekrar dene.</p>

  const head = data[0]
  const list = data.flatMap((p) => p.rows)
  const more = list.length < head.total

  return (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-3 gap-3 text-sm">
        {[
          ['Giren', kc(head.coinsIn)],
          ['Çıkan', kc(head.coinsOut)],
          ['Şu anki bakiye', kc(balance)],
        ].map(([k, v]) => (
          <div key={k} className="flex flex-col rounded-lg bg-background px-3 py-2">
            <dt className="text-xs text-muted-foreground">{k}</dt>
            <dd className="font-display text-lg font-bold tabular-nums text-foreground">{v}</dd>
          </div>
        ))}
      </dl>

      <p className="text-xs leading-relaxed text-muted-foreground">
        {head.since
          ? `Döküm ${day(head.since)} tarihinden beri tutuluyor: o günden sonraki her coin girişi ve çıkışı burada. Hareketler ${LEDGER_KEEP_DAYS} gün saklanır, daha eskisi silinir. Öncesi için Oyunlar ve İşlemler sekmelerine bak.`
          : `Döküm bu sürümle tutulmaya başladı; ilk coin hareketiyle birlikte dolacak ve hareketler ${LEDGER_KEEP_DAYS} gün saklanır. Öncesi için Oyunlar ve İşlemler sekmelerine bak.`}
      </p>

      {list.length === 0 ? (
        <p className="rounded-lg bg-background px-3 py-6 text-center text-sm text-muted-foreground">
          {head.since ? 'Bu üyenin o tarihten beri coin hareketi yok.' : 'Henüz kayıtlı hareket yok.'}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
          {list.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <div className="flex min-w-0 flex-col">
                <span className="truncate font-medium text-foreground">{r.source ?? 'Kaynağı kayıtlı değil'}</span>
                <span className="text-xs text-muted-foreground">{when(r.createdAt)}</span>
              </div>
              <div className="flex shrink-0 flex-col items-end">
                <span className={cn('font-semibold tabular-nums', r.delta >= 0 ? 'text-primary' : 'text-destructive')}>{signed(r.delta)}</span>
                <span className="text-xs tabular-nums text-muted-foreground">{`Bakiye ${kc(r.balanceAfter)}`}</span>
              </div>
            </li>
          ))}
        </ul>
      )}

      {more && (
        <button
          type="button"
          onClick={() => setSize(size + 1)}
          disabled={isValidating}
          className="h-10 self-center rounded-lg border border-border px-4 text-sm font-semibold text-foreground hover:bg-secondary disabled:opacity-50"
        >
          {isValidating ? 'Yükleniyor…' : `Sonraki ${Math.min(LEDGER_PAGE_SIZE, head.total - list.length)} hareket`}
        </button>
      )}
      <p className="text-xs text-muted-foreground" aria-live="polite">{`${list.length.toLocaleString('tr-TR')} / ${head.total.toLocaleString('tr-TR')} hareket gösteriliyor`}</p>
    </div>
  )
}
