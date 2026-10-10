'use client'

import { useState } from 'react'
import { Coins } from 'lucide-react'
import { SectionHeading } from '../section-heading'
import { LuckyWheel } from './lucky-wheel'
import { DiceRoll } from './dice-roll'
import { MysteryChests } from './mystery-chests'

export function GamesHub() {
  const [points, setPoints] = useState(1250)
  const [lastGain, setLastGain] = useState<{ id: number; value: number } | null>(null)

  function handleWin(value: number) {
    if (value <= 0) return
    setPoints((p) => p + value)
    setLastGain({ id: Date.now(), value })
  }

  return (
    <section id="games" aria-labelledby="games-title" className="scroll-mt-20">
      <div className="mx-auto flex max-w-7xl flex-col gap-10 px-4 py-20 sm:px-6">
        <SectionHeading
          id="games-title"
          eyebrow="Mini-Games Hub"
          title={
            <>
              Interactive bonus games. <span className="text-neon">Zero cost to play.</span>
            </>
          }
          description="Spin, roll and unlock. Every game is free, skill-free and rewards you with points you can redeem on partner campaigns."
          action={
            <div className="glass flex items-center gap-3 self-start rounded-2xl px-4 py-3 md:self-auto">
              <Coins className="size-5 text-gold" aria-hidden="true" />
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">Your balance</span>
                <span className="flex items-baseline gap-2">
                  <span className="font-display text-xl font-bold text-foreground tabular-nums">
                    {points.toLocaleString('en-US')}
                  </span>
                  <span className="text-xs text-muted-foreground">pts</span>
                  {lastGain && (
                    <span key={lastGain.id} className="animate-pop text-xs font-semibold text-live">
                      +{lastGain.value}
                    </span>
                  )}
                </span>
              </div>
            </div>
          }
        />

        <div className="grid gap-6 lg:grid-cols-2">
          <LuckyWheel onWin={handleWin} />
          <DiceRoll onWin={handleWin} />
          <MysteryChests onWin={handleWin} />
        </div>
      </div>
    </section>
  )
}
