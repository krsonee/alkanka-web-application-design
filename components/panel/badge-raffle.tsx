'use client'

import { useState, useTransition } from 'react'
import { Ticket } from 'lucide-react'
import { drawRaffleAction } from '@/app/panel/raffle-actions'
import type { RaffleRow } from '@/lib/badge-value'

const field = 'h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground'

export function BadgeRaffle({ badges, recent }: { badges: { id: string; name: string; holders: number }[]; recent: RaffleRow[] }) {
  const [badgeId, setBadgeId] = useState(badges.find((b) => b.holders > 0)?.id ?? '')
  const [prize, setPrize] = useState(500)
  const [note, setNote] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const draw = () =>
    start(async () => {
      const r = await drawRaffleAction(badgeId, prize, note)
      setMsg(r.ok ? `Kazanan: ${r.winner}. ${prize} KP hesabına geçti.` : r.error)
    })

  return (
    <section aria-labelledby="rozet-cekilis" className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-col gap-1">
        <h2 id="rozet-cekilis" className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
          <Ticket className="size-5 text-gold" aria-hidden /> Rozet sahiplerine özel çekiliş
        </h2>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Seçtiğin rozetin sahipleri arasından rastgele bir kişi seçilir ve ödül KP olarak hesabına geçer.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
          Rozet
          <select value={badgeId} onChange={(e) => setBadgeId(e.target.value)} className={field}>
            {badges.map((b) => (
              <option key={b.id} value={b.id} disabled={!b.holders}>
                {b.name} ({b.holders} sahibi)
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
          Ödül (KP)
          <input type="number" min={1} max={100000} value={prize} onChange={(e) => setPrize(Number(e.target.value))} className={field} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
          Not
          <input value={note} maxLength={120} onChange={(e) => setNote(e.target.value)} placeholder="Ekim Elmas çekilişi" className={field} />
        </label>
      </div>
      <button
        type="button"
        onClick={draw}
        disabled={pending || !badgeId}
        className="h-10 w-fit rounded-lg bg-primary px-5 text-sm font-bold text-primary-foreground disabled:opacity-60"
      >
        {pending ? 'Çekiliyor...' : 'Çekilişi yap'}
      </button>
      {msg && <p role="status" className="text-sm text-foreground">{msg}</p>}
      {recent.length > 0 && (
        <ul className="flex flex-col divide-y divide-border border-t border-border text-xs">
          {recent.map((r) => (
            <li key={r.id} className="flex flex-wrap justify-between gap-2 py-2">
              <span className="text-foreground"><b>{r.userName}</b> · {r.badgeName}{r.note ? ` · ${r.note}` : ''}</span>
              <span className="text-muted-foreground">+{r.prize.toLocaleString('tr-TR')} KP · {new Date(r.drawnAt).toLocaleDateString('tr-TR')}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
