/*
  One die as a real cube: six faces around a centre, turned by two angles so the rolled value ends up facing the
  viewer. The cube keeps turning forward from wherever it stopped, so every roll tumbles the same way and the
  transition never unwinds.

  Its edge length is --s, set by the stage (container units), so the cube scales with the stage.
*/

import { cn } from '@/lib/utils'

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

/** The cube's own turn (around X, then Y) that brings a value to the front. */
const FRONT: Record<number, [number, number]> = {
  1: [0, 0],
  6: [0, 180],
  3: [0, -90],
  4: [0, 90],
  5: [-90, 0],
  2: [90, 0],
}

export type DieTurn = { x: number; y: number }

export const restingTurn = (value: number): DieTurn => ({ x: FRONT[value][0], y: FRONT[value][1] })

const forward = (from: number, to: number, turns: number) => {
  const base = from + turns * 360
  return base + ((((to - base) % 360) + 360) % 360)
}

/** The next turn that shows `value`, at least `turns` full rotations further on than the current one. */
export const rollTo = (current: DieTurn, value: number, turns: number): DieTurn => ({
  x: forward(current.x, FRONT[value][0], turns),
  y: forward(current.y, FRONT[value][1], turns + 1),
})

const TONES = {
  gold: {
    face: 'bg-[radial-gradient(circle_at_28%_22%,color-mix(in_oklch,var(--gold)_78%,white),var(--gold)_52%,color-mix(in_oklch,var(--gold)_62%,black))] inset-ring inset-ring-gold-foreground/30',
    pip: 'bg-gold-foreground shadow-[inset_0_1px_1px_rgb(0_0_0/0.6)]',
  },
  dark: {
    face: 'bg-[radial-gradient(circle_at_28%_22%,color-mix(in_oklch,var(--secondary)_70%,white),var(--secondary)_45%,var(--background))] inset-ring-2 inset-ring-gold/70',
    pip: 'bg-gold shadow-[0_0_0.6cqw_color-mix(in_oklch,var(--gold)_70%,transparent)]',
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
  turn,
  tone,
  lean,
  still,
}: {
  value: number
  turn: DieTurn
  tone: keyof typeof TONES
  /** How far the cube is turned away from the viewer, so two of its sides show. */
  lean: number
  /** No tumbling: the cube snaps to its value (reduced motion). */
  still: boolean
}) {
  const look = TONES[tone]
  return (
    <div role="img" aria-label={`Zar: ${value}`} className="size-(--s) [perspective:calc(var(--s)*9)]">
      <div className="size-full [transform-style:preserve-3d]" style={{ transform: `rotateX(-16deg) rotateY(${lean}deg)` }}>
        <div
          className={cn(
            'relative size-full [transform-style:preserve-3d]',
            !still && 'transition-transform duration-[1250ms] ease-[cubic-bezier(0.2,0.7,0.2,1)]',
          )}
          style={{ transform: `rotateX(${turn.x}deg) rotateY(${turn.y}deg)` }}
        >
          {FACES.map((face) => (
            <span
              key={face.value}
              aria-hidden="true"
              className={cn('absolute inset-0 grid grid-cols-3 grid-rows-3 rounded-[13%] p-[13%]', look.face)}
              style={{ transform: `${face.place} translateZ(calc(var(--s) / 2))` }}
            >
              {Array.from({ length: 9 }, (_, i) => (
                <span key={i} className="flex items-center justify-center">
                  {PIPS[face.value].includes(i) && <span className={cn('size-[62%] rounded-full', look.pip)} />}
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
