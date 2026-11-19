'use client'

import { useState, useTransition } from 'react'
import useSWR from 'swr'
import { Ticket } from 'lucide-react'
import { drawRaffleAction, rafflePoolAction } from '@/app/panel/raffle-actions'
import { confirmed } from '@/components/panel/confirm-dialog'
import { ALL_BADGES, MAX_RAFFLE_WINNERS, type RaffleRow } from '@/lib/badge-raffle-shared'
import { cn } from '@/lib/utils'

type BadgeOption = { id: string; name: string; holders: number; role: boolean }

const field = 'h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground'
const kp = (n: number) => n.toLocaleString('tr-TR')

export function BadgeRaffle({ badges, recent }: { badges: BadgeOption[]; recent: RaffleRow[] }) {
  const [all, setAll] = useState(false)
  const [picked, setPicked] = useState<string[]>([])
  const [prize, setPrize] = useState(500)
  const [winners, setWinners] = useState(1)
  const [note, setNote] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [rows, setRows] = useState(recent)
  const [pending, start] = useTransition()

  const chosen = all ? ALL_BADGES : picked
  const chosenKey = all ? ALL_BADGES : [...picked].sort().join('\u0001')
  const anything = all || picked.length > 0

  // One member can hold several of the chosen badges, so the number of different members has to come from the server.
  const { data: poolResult } = useSWR(anything ? ['raffle-pool', chosenKey] : null, () => rafflePoolAction(chosen), { revalidateOnFocus: false })
  const pool = poolResult?.ok ? poolResult.size : null

  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
  const names = all ? 'Tüm rozetler' : badges.filter((b) => picked.includes(b.id)).map((b) => b.name).join(', ')
  const validPrize = Number.isInteger(prize) && prize >= 1 && prize <= 100000
  const validWinners = Number.isInteger(winners) && winners >= 1 && winners <= MAX_RAFFLE_WINNERS
  const tooMany = pool !== null && winners > pool
  const ready = anything && validPrize && validWinners && pool !== null && pool > 0 && !tooMany

  const draw = () =>
    confirmed(
      `${names} sahibi ${pool} farklı üye arasından ${winners} kişi seçilip her birine ${kp(prize)} KP hemen yatırılsın mı? Toplam ${kp(prize * winners)} KP. Çekiliş geri alınamaz.`,
      () =>
        start(async () => {
          const r = await drawRaffleAction(chosen, prize, note, winners)
          if (!r.ok) return setMsg({ ok: false, text: r.error })
          setRows(r.recent)
          setMsg({ ok: true, text: `${r.winners.length > 1 ? 'Kazananlar' : 'Kazanan'}: ${r.winners.join(', ')}. Her birine ${kp(prize)} KP geçti.` })
        }),
    )

  return (
    <section aria-labelledby="rozet-cekilis" className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-col gap-1">
        <h2 id="rozet-cekilis" className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
          <Ticket className="size-5 text-gold" aria-hidden /> Rozet sahiplerine özel çekiliş
        </h2>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Seçtiğin rozetlerin sahipleri tek havuzda toplanır. Birden çok rozeti olan üye havuza bir kez girer ve en fazla bir kez kazanır. Ödül KP olarak hemen
          hesaba geçer. Rolü &quot;KP kazanmaz&quot; olan üyeler havuza alınmaz.
        </p>
      </div>

      <fieldset className="flex flex-col gap-2 rounded-xl border border-border p-3">
        <legend className="px-1 text-xs font-semibold text-muted-foreground">Hangi rozetler</legend>
        <label className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <input type="checkbox" className="size-4 accent-primary" checked={all} onChange={(e) => setAll(e.target.checked)} />
          Tüm rozetler (roller hariç)
        </label>
        <div className={cn('flex flex-wrap gap-1.5', all && 'opacity-40')}>
          {badges.map((b) => {
            const on = !all && picked.includes(b.id)
            return (
              <button
                key={b.id}
                type="button"
                aria-pressed={on}
                disabled={all || !b.holders}
                onClick={() => toggle(b.id)}
                title={b.holders ? undefined : 'Bu rozetin henüz sahibi yok'}
                className={cn(
                  'rounded-lg border px-2.5 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50',
                  on ? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted-foreground hover:text-foreground',
                )}
              >
                {b.name}
                {b.role ? ' (rol)' : ''} · {b.holders}
              </button>
            )
          })}
        </div>
        <p role="status" className="text-xs text-foreground">
          {!anything ? 'Rozet seç ya da "Tüm rozetler"i işaretle.' : pool === null ? 'Havuz sayılıyor...' : `Havuzda ${pool} farklı üye var.`}
        </p>
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
          Kazanan sayısı
          <input type="number" min={1} max={MAX_RAFFLE_WINNERS} value={winners} onChange={(e) => setWinners(Number(e.target.value))} className={field} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
          Kişi başı ödül (KP)
          <input type="number" min={1} max={100000} value={prize} onChange={(e) => setPrize(Number(e.target.value))} className={field} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
          Not
          <input value={note} maxLength={120} onChange={(e) => setNote(e.target.value)} placeholder="Ekim Elmas çekilişi" className={field} />
        </label>
      </div>
      {!validWinners && <p role="alert" className="text-xs text-destructive">Kazanan sayısı 1 ile {MAX_RAFFLE_WINNERS} arasında tam sayı olmalı.</p>}
      {!validPrize && <p role="alert" className="text-xs text-destructive">Ödül 1 ile 100.000 KP arasında tam sayı olmalı.</p>}
      {validWinners && tooMany && <p role="alert" className="text-xs text-destructive">Havuzda {pool} üye var; {winners} kazanan seçilemez.</p>}

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={draw} disabled={pending || !ready} className="h-10 w-fit rounded-lg bg-primary px-5 text-sm font-bold text-primary-foreground disabled:opacity-60">
          {pending ? 'Çekiliyor...' : 'Çekilişi yap'}
        </button>
        {ready && <span className="text-xs text-muted-foreground">Toplam {kp(prize * winners)} KP dağıtılır.</span>}
      </div>
      {msg && <p role="status" className={cn('text-sm', msg.ok ? 'text-foreground' : 'text-destructive')}>{msg.text}</p>}
      {rows.length > 0 && (
        <ul className="flex flex-col divide-y divide-border border-t border-border text-xs">
          {rows.map((r) => (
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
