'use client'

import { useState, useTransition } from 'react'
import { ThumbsUp } from 'lucide-react'
import { toggleHelpfulAction } from '@/app/actions/community'
import { cn } from '@/lib/utils'

export function HelpfulButton({ reviewId, count, voted, own }: { reviewId: number; count: number; voted: boolean; own: boolean }) {
  const [state, setState] = useState({ count, voted })
  const [error, setError] = useState('')
  const [pending, start] = useTransition()

  return (
    <span className="flex items-center gap-2">
      <button
        type="button"
        disabled={pending || own}
        aria-pressed={state.voted}
        title={own ? 'Kendi yorumuna oy veremezsin' : 'Bu yorum işime yaradı'}
        onClick={() =>
          start(async () => {
            setError('')
            const r = await toggleHelpfulAction(reviewId)
            if (r.ok) setState({ count: r.count, voted: r.voted })
            else setError(r.error)
          })
        }
        className={cn(
          'flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60',
          state.voted ? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground',
        )}
      >
        <ThumbsUp className={cn('size-3.5', state.voted && 'fill-current')} aria-hidden />
        Faydalı
        <span className="tabular-nums">{state.count}</span>
      </button>
      {error && <span role="status" className="text-[11px] text-destructive">{error}</span>}
    </span>
  )
}
