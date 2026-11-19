'use client'

import { useState } from 'react'
import { claimAwardAction } from '@/app/actions/community'
import { AWARD_STATUS_LABEL, SITE_USERNAME_MAX, SITE_USERNAME_MIN, prizeText, type Award, type AwardStatus } from '@/lib/predictions-shared'
import { cn } from '@/lib/utils'
import { StatusLine, useAction } from '../community/use-action'

const STATUS_TONE: Record<AwardStatus, string> = {
  verildi: 'text-success',
  beklemede: 'text-primary',
  iptal: 'text-muted-foreground',
}

function UsernameForm({ award }: { award: Award }) {
  const { pending, status, run } = useAction()
  const [name, setName] = useState(award.siteUsername ?? '')
  const [editing, setEditing] = useState(!award.siteUsername)
  const inputId = `odul-${award.id}`
  // A sponsor cash prize names its site; a sponsor's market product only names the product.
  const site = award.prize.kind === 'cash' ? award.prize.name : 'Sponsor'

  if (!editing) {
    return (
      <p className="text-xs leading-relaxed text-muted-foreground">
        {site} sitesindeki kullanıcı adın: <b className="text-foreground">{award.siteUsername}</b>.{' '}
        <button type="button" onClick={() => setEditing(true)} className="font-semibold text-primary underline-offset-2 hover:underline">
          Değiştir
        </button>
      </p>
    )
  }
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        run(() => claimAwardAction(award.id, name), () => setEditing(false))
      }}
    >
      <label htmlFor={inputId} className="text-xs leading-relaxed text-muted-foreground">
        Ödülü teslim edebilmemiz için {site} sitesindeki kullanıcı adını yaz.
      </label>
      <div className="flex gap-2">
        <input
          id={inputId}
          value={name}
          onChange={(e) => setName(e.target.value)}
          minLength={SITE_USERNAME_MIN}
          maxLength={SITE_USERNAME_MAX}
          autoComplete="off"
          placeholder="Kullanıcı adın"
          className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <button type="submit" disabled={pending || name.trim().length < SITE_USERNAME_MIN} className="h-10 shrink-0 rounded-lg bg-primary px-4 text-xs font-bold text-primary-foreground disabled:bg-primary/15 disabled:text-primary">
          {pending ? 'Kaydediliyor...' : 'Kaydet'}
        </button>
      </div>
      <StatusLine status={status} />
    </form>
  )
}

export function MyAwards({ awards }: { awards: Award[] }) {
  if (!awards.length) return null
  return (
    <section aria-labelledby="odullerim" className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <h2 id="odullerim" className="font-display text-base font-bold text-foreground">
        Ödüllerim
      </h2>
      <ul className="flex flex-col gap-3">
        {awards.map((a) => (
          <li key={a.id} className="flex flex-col gap-1.5 border-b border-border pb-3 last:border-0 last:pb-0">
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 text-sm font-bold text-foreground">{prizeText(a.prize)}</span>
              <span className={cn('shrink-0 text-xs font-semibold', STATUS_TONE[a.status])}>{AWARD_STATUS_LABEL[a.status]}</span>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">{a.title}</p>
            {a.status === 'beklemede' && a.needsUsername && <UsernameForm award={a} />}
            {a.status === 'beklemede' && !a.needsUsername && <p className="text-xs leading-relaxed text-muted-foreground">Ekibimiz ödülünü teslim edince mesajla haber verecek.</p>}
            {a.note && a.status !== 'beklemede' && <p className="text-xs leading-relaxed text-muted-foreground">Not: {a.note}</p>}
          </li>
        ))}
      </ul>
    </section>
  )
}
