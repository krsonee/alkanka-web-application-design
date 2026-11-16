'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { adminCancelTable } from '@/app/panel/arena-actions'
import { askConfirm, notify } from '@/components/panel/confirm-dialog'

export type OpenTable = {
  id: string
  game: string
  status: 'bekliyor' | 'oynaniyor'
  stake: number
  seats: number
  players: { name: string; bot: boolean }[]
  updatedAt: string
  createdAt: string
}

const STUCK_MS = 30 * 60 * 1000

function ago(iso: string, now: number) {
  const minutes = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000))
  if (minutes < 1) return 'şimdi'
  if (minutes < 60) return `${minutes} dk önce`
  const hours = Math.floor(minutes / 60)
  return hours < 48 ? `${hours} sa önce` : `${Math.floor(hours / 24)} gün önce`
}

export function OpenTables({ tables, now }: { tables: OpenTable[]; now: number }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [busy, setBusy] = useState<string | null>(null)

  const close = async (t: OpenTable) => {
    const humans = t.players.filter((p) => !p.bot).length
    const ok = await askConfirm(
      `${t.game} masası kapatılsın mı? ${humans} oyuncuya ${t.stake.toLocaleString('tr-TR')} KC giriş ücreti iade edilir. Oyun yarıda kalır, geri alınamaz.`,
    )
    if (!ok) return
    setBusy(t.id)
    start(async () => {
      const form = new FormData()
      form.set('id', t.id)
      const r = await adminCancelTable({}, form)
      notify(Boolean(r.ok), r.message ?? (r.ok ? 'Masa kapatıldı.' : 'Masa kapatılamadı.'))
      setBusy(null)
      router.refresh()
    })
  }

  return (
    <section aria-labelledby="open-tables-title" className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <header className="flex flex-col gap-0.5">
        <h2 id="open-tables-title" className="font-display text-lg font-bold text-foreground">
          Açık masalar
        </h2>
        <p className="text-sm text-muted-foreground">
          Üyeler arası bekleyen ve oynanan masalar (turnuva masaları hariç, en yeni 60). Takılı kalan masayı buradan kapatırsın; giriş ücretleri oyunculara geri döner.
        </p>
      </header>
      {tables.length === 0 ? (
        <p className="text-sm text-muted-foreground">Şu an açık masa yok.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th scope="col" className="py-2 pr-3 font-semibold">Oyun</th>
                <th scope="col" className="py-2 pr-3 font-semibold">Durum</th>
                <th scope="col" className="py-2 pr-3 font-semibold">Oyuncular</th>
                <th scope="col" className="py-2 pr-3 text-right font-semibold">Giriş</th>
                <th scope="col" className="py-2 pr-3 font-semibold">Son hareket</th>
                <th scope="col" className="py-2 font-semibold">
                  <span className="sr-only">İşlem</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {tables.map((t) => {
                const stuck = now - new Date(t.updatedAt).getTime() > STUCK_MS
                return (
                  <tr key={t.id} className="border-t border-border align-top">
                    <td className="py-2 pr-3 font-medium text-foreground">{t.game}</td>
                    <td className="py-2 pr-3 text-foreground">
                      {t.status === 'oynaniyor' ? 'Oynanıyor' : 'Oyuncu bekliyor'}
                      {stuck && <span className="ml-2 rounded border border-destructive/40 px-1.5 text-xs text-destructive">Takılmış olabilir</span>}
                    </td>
                    <td className="py-2 pr-3 text-foreground">
                      {t.players.map((p) => (p.bot ? `${p.name} (bot)` : p.name)).join(', ') || '-'}
                      <span className="text-muted-foreground">{` · ${t.players.length}/${t.seats}`}</span>
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums text-foreground">{t.stake.toLocaleString('tr-TR')} KC</td>
                    <td className="py-2 pr-3 text-muted-foreground">{ago(t.updatedAt, now)}</td>
                    <td className="py-2 text-right">
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => close(t)}
                        className="h-9 rounded-md border border-destructive/50 px-3 text-sm text-destructive hover:bg-destructive/10 disabled:opacity-60"
                      >
                        {busy === t.id ? 'Kapatılıyor...' : 'Kapat ve iade et'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
