/*
  One die as a real cube: six faces around a centre, with three planes through the middle so nothing shows through
  its rounded edges while it tumbles. It rests showing `value`; a throw moves and turns it frame by frame through
  the two elements it hands out (throw.ts), and ends on the same pose this component draws. Each face has a dark
  layer over it (data-shade): the faces turned away from the lamp over the table are in shade, and the throw
  rewrites that on every frame, so the cube reads as a solid thing while it turns.

  Its edge length is --s, set by the stage (container units), so the cube scales with the stage.
*/

import type { Ref } from 'react'
import { cn } from '@/lib/utils'
import { restPose, restShades } from './throw'

const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
}

/** Where each value sits on the cube (opposite faces add up to seven). */
const FACES: { value: number; place: string }[] = [
  { value: 1, place: 'rotateY(0deg)' },
  { value: 6, place: 'rotateY(180deg)' },
  { value: 3, place: 'rotateY(90deg)' },
  { value: 4, place: 'rotateY(-90deg)' },
  { value: 5, place: 'rotateX(90deg)' },
  { value: 2, place: 'rotateX(-90deg)' },
]

const CORE = ['rotateY(0deg)', 'rotateY(90deg)', 'rotateX(90deg)']

const TONES = {
  gold: {
    face: 'bg-[radial-gradient(circle_at_28%_22%,color-mix(in_oklch,var(--gold)_78%,white),var(--gold)_52%,color-mix(in_oklch,var(--gold)_62%,black))] inset-ring inset-ring-gold-foreground/30',
    pip: 'bg-gold-foreground shadow-[inset_0_1px_1px_rgb(0_0_0/0.6)]',
    core: 'bg-[color-mix(in_oklch,var(--gold)_62%,black)]',
  },
  dark: {
    face: 'bg-[radial-gradient(circle_at_28%_22%,color-mix(in_oklch,var(--secondary)_70%,white),var(--secondary)_45%,var(--background))] inset-ring-2 inset-ring-gold/70',
    pip: 'bg-gold shadow-[0_0_0.6cqw_color-mix(in_oklch,var(--gold)_70%,transparent)]',
    core: 'bg-background',
  },
}

/** One face drawn flat, for the pay tiles: its size follows the text around it. */
export function MiniDie({ value }: { value: number }) {
  return (
    <span aria-hidden="true" className="grid size-[1.2em] shrink-0 grid-cols-3 grid-rows-3 rounded-[22%] bg-gold p-[12%]">
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} className="flex items-center justify-center">
          {PIPS[value].includes(i) && <span className="size-[74%] rounded-full bg-gold-foreground" />}
        </span>
      ))}
    </span>
  )
}

export function Die({
  value,
  tone,
  lean,
  moverRef,
  cubeRef,
}: {
  value: number
  tone: keyof typeof TONES
  /** How far the cube is turned away from the viewer, so two of its sides show. */
  lean: number
  moverRef: Ref<HTMLDivElement>
  cubeRef: Ref<HTMLDivElement>
}) {
  const look = TONES[tone]
  const shades = restShades(value, lean)
  return (
    <div ref={moverRef} className="size-(--s) will-change-transform">
      <div role="img" aria-label={`Zar: ${value}`} className="size-full [perspective:calc(var(--s)*9)]">
        <div ref={cubeRef} className="relative size-full [transform-style:preserve-3d]" style={{ transform: restPose(value, lean) }}>
          {CORE.map((place) => (
            <span key={place} aria-hidden="true" className={cn('absolute inset-[5%]', look.core)} style={{ transform: place }} />
          ))}
          {FACES.map((face, at) => (
            <span
              key={face.value}
              aria-hidden="true"
              className={cn('absolute inset-0 grid grid-cols-3 grid-rows-3 overflow-hidden rounded-[13%] p-[13%] [backface-visibility:hidden]', look.face)}
              style={{ transform: `${face.place} translateZ(calc(var(--s) / 2))` }}
            >
              {Array.from({ length: 9 }, (_, i) => (
                <span key={i} className="flex items-center justify-center">
                  {PIPS[face.value].includes(i) && <span className={cn('size-[62%] rounded-full', look.pip)} />}
                </span>
              ))}
              <span data-shade="" className="pointer-events-none absolute inset-0 bg-background" style={{ opacity: shades[at] }} />
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
