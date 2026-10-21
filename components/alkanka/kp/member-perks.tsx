'use client'

import { useState, useTransition } from 'react'
import { Cake, Shield } from 'lucide-react'
import { buyShieldAction, setBirthdayAction } from '@/app/actions/boosts'

type Props = { shields: number; shieldPrice: number; birthday: string | null; birthdayCoin: number }

export function MemberPerks({ shields: initialShields, shieldPrice, birthday: initialBirthday, birthdayCoin }: Props) {
  const [shields, setShields] = useState(initialShields)
  const [birthday, setBirthday] = useState(initialBirthday)
  const [date, setDate] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const buy = () =>
    start(async () => {
      const r = await buyShieldAction()
      if (r.ok) {
        setShields(r.count)
        setMsg('Seri kalkanı alındı. Bir günü kaçırırsan serin bozulmaz.')
      } else setMsg(r.error)
    })

  const save = () =>
    start(async () => {
      const r = await setBirthdayAction(date)
      if (r.ok) {
        setBirthday(r.date)
        setMsg('Doğum günün kaydedildi.')
      } else setMsg(r.error)
    })

  return (
    <section aria-labelledby="perks-title" className="flex flex-col gap-3">
      <h2 id="perks-title" className="font-display text-lg font-bold text-foreground">Kanka ayrıcalıkları</h2>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-full bg-secondary text-primary"><Shield className="size-5" aria-hidden /></span>
            <div className="flex flex-col">
              <span className="font-bold text-foreground">Seri kalkanı</span>
              <span className="text-sm leading-relaxed text-muted-foreground">Bir gün giremezsen kalkan devreye girer, serin sıfırlanmaz.</span>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">Elinde: <strong className="text-foreground">{shields}</strong> / 3</span>
            <button
              type="button"
              disabled={pending || shields >= 3}
              onClick={buy}
              className="h-10 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50"
            >
              {shieldPrice} KC ile al
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-full bg-secondary text-primary"><Cake className="size-5" aria-hidden /></span>
            <div className="flex flex-col">
              <span className="font-bold text-foreground">Doğum günü hediyesi</span>
              <span className="text-sm leading-relaxed text-muted-foreground">Doğum gününde siteye girdiğinde {birthdayCoin} KC hediye.</span>
            </div>
          </div>
          {birthday ? (
            <span className="text-sm text-muted-foreground">Kayıtlı tarih: <strong className="text-foreground">{birthday.split('-').reverse().join('.')}</strong></span>
          ) : (
            <div className="flex items-center gap-2">
              <label htmlFor="perk-birthday" className="sr-only">Doğum tarihin</label>
              <input
                id="perk-birthday"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
              />
              <button type="button" disabled={pending || !date} onClick={save} className="h-10 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50">
                Kaydet
              </button>
            </div>
          )}
        </div>
      </div>
      {msg && <p role="status" className="text-sm text-muted-foreground">{msg}</p>}
    </section>
  )
}
