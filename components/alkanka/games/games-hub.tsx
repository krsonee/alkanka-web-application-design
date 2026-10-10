'use client'

import { SectionHeading } from '../section-heading'
import { usePoints } from '../points-context'
import { LuckyWheel } from './lucky-wheel'
import { DiceRoll } from './dice-roll'
import { MysteryChests } from './mystery-chests'

export function GamesHub() {
  const { add } = usePoints()

  return (
    <section id="oyunlar" aria-labelledby="oyunlar-title" className="flex scroll-mt-20 flex-col gap-6">
      <SectionHeading
        id="oyunlar-title"
        title="Çark · Zar · Sandık"
        description="Tamamen ücretsiz mini oyunlar. Kazandığın Kanka Coin anında bakiyene eklenir ve puan marketinde harcanır."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <LuckyWheel onWin={add} />
        <DiceRoll onWin={add} />
        <MysteryChests onWin={add} />
      </div>
    </section>
  )
}
