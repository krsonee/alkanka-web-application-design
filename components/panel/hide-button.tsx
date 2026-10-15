'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { setVisibility, type VisibilityKind } from '@/app/panel/visibility-actions'
import { cn } from '@/lib/utils'

/** Toggles whether an item is shown on the public site. Sits next to each row's delete button. */
export function HideButton({
  kind,
  id,
  hidden,
  label,
  onChange,
  className,
}: {
  kind: VisibilityKind
  id: string | number
  hidden: boolean
  label?: string
  onChange?: (hidden: boolean) => void
  className?: string
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [isHidden, setIsHidden] = useState(hidden)
  const [error, setError] = useState('')

  const toggle = () =>
    start(async () => {
      setError('')
      const next = !isHidden
      const result = await setVisibility(kind, id, !next)
      if (!result.ok) {
        setError(result.error)
        return
      }
      setIsHidden(next)
      onChange?.(next)
      router.refresh()
    })

  const Icon = pending ? Loader2 : isHidden ? Eye : EyeOff
  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      title={error || (isHidden ? 'Sitede tekrar göster' : 'Siteden gizle, üyeler göremesin')}
      aria-label={`${label ? `${label}: ` : ''}${isHidden ? 'Göster' : 'Gizle'}`}
      aria-pressed={isHidden}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-semibold transition-colors disabled:opacity-60',
        isHidden
          ? 'border-primary/60 bg-primary/10 text-primary hover:bg-primary/20'
          : 'border-border text-foreground hover:bg-secondary',
        error && 'border-destructive text-destructive',
        className,
      )}
    >
      <Icon className={cn('size-3.5', pending && 'animate-spin')} aria-hidden="true" />
      {isHidden ? 'Göster' : 'Gizle'}
    </button>
  )
}
