'use client'

import { Check, Trophy } from 'lucide-react'
import { sponsorVoteAction } from '@/app/actions/community'
import { cn } from '@/lib/utils'
import { usePoints } from '../points-context'
import { StatusLine, useAction } from './use-action'

export type VoteOption = { siteId: string; name: string; votes: number }

export function SponsorVote({ options, mine, month }: { options: VoteOption[]; mine: string | null; month: string }) {
  const { member } = usePoints()
  const action = useAction()
  const total = options.reduce((a, o) => a + o.votes, 0)
  const leader = total ? options[0]?.siteId : null

  return (
    <div className="flex flex-col gap-3">
      <ul className="grid gap-2 sm:grid-cols-2">
        {options.map((o) => {
          const pct = total ? Math.round((o.votes / total) * 100) : 0
          const chosen = mine === o.siteId
          return (
            <li key={o.siteId}>
              <button
                type="button"
                disabled={!member || action.pending}
                aria-pressed={chosen}
                onClick={() => action.run(() => sponsorVoteAction(o.siteId))}
                className={cn(
                  'relative flex h-12 w-full items-center justify-between gap-3 overflow-hidden rounded-lg border px-3 text-left text-sm transition-colors disabled:cursor-not-allowed',
                  chosen ? 'border-primary' : 'border-border hover:border-primary/50',
                )}
              >
                <span aria-hidden className="absolute inset-y-0 left-0 bg-primary/15 transition-[width] duration-500" style={{ width: `${pct}%` }} />
                <span className="relative flex min-w-0 items-center gap-2 font-semibold text-foreground">
                  {chosen ? <Check className="size-4 shrink-0 text-primary" aria-hidden /> : leader === o.siteId ? <Trophy className="size-4 shrink-0 text-primary" aria-hidden /> : null}
                  <span className="truncate">{o.name}</span>
                </span>
                <span className="relative shrink-0 text-xs tabular-nums text-muted-foreground">
                  {o.votes} oy · %{pct}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      <p className="text-xs leading-relaxed text-muted-foreground">
        {member
          ? mine
            ? `${month} oyunu verdin. Ay bitene kadar değiştirebilirsin.`
            : `Her üyenin ${month} için tek oyu var. Kazanan ayın 1'inde Telegram'da duyurulur.`
          : 'Oy vermek için giriş yap.'}
      </p>
      <StatusLine status={action.status} />
    </div>
  )
}
