import { Children } from 'react'
import { cn } from '@/lib/utils'

export function Marquee({
  children,
  label,
  itemClassName,
  duration = 40,
  repeat = 2,
}: {
  children: React.ReactNode
  label: string
  itemClassName: string
  duration?: number
  repeat?: number
}) {
  const items = Children.toArray(children)
  const half = Array.from({ length: repeat }, () => items).flat()

  const group = (copy: 'a' | 'b') => (
    <ul
      aria-label={copy === 'a' ? label : undefined}
      aria-hidden={copy === 'b' || undefined}
      inert={copy === 'b' || undefined}
      className="flex shrink-0 gap-3 pr-3"
    >
      {half.map((child, i) => (
        <li
          key={`${copy}-${i}`}
          aria-hidden={copy === 'a' && i >= items.length ? true : undefined}
          className={cn('shrink-0', itemClassName)}
        >
          {child}
        </li>
      ))}
    </ul>
  )

  return (
    <div className="group/marquee relative overflow-hidden py-1 [mask-image:linear-gradient(to_right,transparent,black_5%,black_95%,transparent)] motion-reduce:overflow-x-auto motion-reduce:no-scrollbar">
      <div
        className="flex w-max motion-safe:animate-[marquee_var(--marquee-duration)_linear_infinite] group-hover/marquee:[animation-play-state:paused] group-focus-within/marquee:[animation-play-state:paused]"
        style={{ '--marquee-duration': `${duration}s` } as React.CSSProperties}
      >
        {group('a')}
        {group('b')}
      </div>
    </div>
  )
}
