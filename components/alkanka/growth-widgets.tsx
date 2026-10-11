'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Bell, BellOff, Link2, Loader2, Trash2 } from 'lucide-react'
import { linkSponsorAccountAction, removeSponsorAccountAction, toggleFollowAction } from '@/app/actions/growth'
import { StatusLine, useAction } from './community/use-action'
import { cn } from '@/lib/utils'

export function FollowButton({ siteId, initial, loggedIn }: { siteId: string; initial: boolean; loggedIn: boolean }) {
  const [following, setFollowing] = useState(initial)
  const { pending, status, run } = useAction()
  if (!loggedIn) {
    return (
      <Link
        href="/profil"
        className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border px-4 text-sm font-semibold text-foreground hover:bg-secondary"
      >
        <Bell className="size-4" aria-hidden="true" />
        Adres alarmı için giriş yap
      </Link>
    )
  }
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={pending}
        aria-pressed={following}
        onClick={() =>
          run(
            async () => {
              const r = await toggleFollowAction(siteId)
              if (r.ok && typeof r.following === 'boolean') setFollowing(r.following)
              return r
            },
          )
        }
        className={cn(
          'inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold disabled:opacity-60',
          following ? 'border border-primary bg-primary/10 text-primary' : 'border border-border text-foreground hover:bg-secondary',
        )}
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : following ? (
          <BellOff className="size-4" aria-hidden="true" />
        ) : (
          <Bell className="size-4" aria-hidden="true" />
        )}
        {following ? 'Adres alarmı açık' : 'Adres değişince haber ver'}
      </button>
      <StatusLine status={status} />
    </div>
  )
}

type Account = { siteId: string; username: string; status: 'pending' | 'approved' | 'rejected'; note: string | null }
const STATUS: Record<Account['status'], [string, string]> = {
  pending: ['Onay bekliyor', 'bg-secondary text-muted-foreground'],
  approved: ['Onaylı', 'bg-primary/15 text-primary'],
  rejected: ['Reddedildi', 'bg-destructive/15 text-destructive'],
}

export function SponsorAccountsCard({ accounts, sites }: { accounts: Account[]; sites: { id: string; name: string }[] }) {
  const [siteId, setSiteId] = useState(sites[0]?.id ?? '')
  const [username, setUsername] = useState('')
  const { pending, status, run } = useAction()
  const names = Object.fromEntries(sites.map((s) => [s.id, s.name]))

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-col gap-1">
        <h3 className="flex items-center gap-2 font-display text-base font-bold text-foreground">
          <Link2 className="size-4 text-primary" aria-hidden="true" />
          Sponsor hesaplarım
        </h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Sponsor sitedeki kullanıcı adını bağla. Onaylandıktan sonra çevrimin aylık sıralamaya girer ve ödüllerden pay alırsın.
        </p>
      </div>
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault()
          run(() => linkSponsorAccountAction(siteId, username), () => setUsername(''))
        }}
      >
        <select
          aria-label="Sponsor site"
          value={siteId}
          onChange={(e) => setSiteId(e.target.value)}
          className="h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground sm:w-44"
        >
          {sites.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <input
          aria-label="Sitedeki kullanıcı adın"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Sitedeki kullanıcı adın"
          className="h-10 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-sm text-foreground"
        />
        <button
          type="submit"
          disabled={pending || username.trim().length < 3}
          className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          Bağla
        </button>
      </form>
      <StatusLine status={status} />
      {accounts.length > 0 && (
        <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
          {accounts.map((a) => (
            <li key={a.siteId} className="flex items-center gap-3 p-3">
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-semibold text-foreground">{names[a.siteId] ?? a.siteId}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {a.username}
                  {a.status === 'rejected' && a.note ? ` · ${a.note}` : ''}
                </span>
              </div>
              <span className={cn('rounded-full px-2.5 py-1 text-xs font-semibold', STATUS[a.status][1])}>{STATUS[a.status][0]}</span>
              <button
                type="button"
                aria-label={`${names[a.siteId] ?? a.siteId} hesabını kaldır`}
                disabled={pending}
                onClick={() => run(() => removeSponsorAccountAction(a.siteId))}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
