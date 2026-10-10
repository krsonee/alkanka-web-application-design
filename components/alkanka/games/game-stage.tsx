'use client'

import { usePoints } from '../points-context'
import { LuckyWheel } from './lucky-wheel'
import { DiceRoll } from './dice-roll'
import { MysteryChests } from './mystery-chests'

const GAMES = { cark: LuckyWheel, zar: DiceRoll, sandik: MysteryChests }

export function GameStage({ game }: { game: keyof typeof GAMES }) {
  const { add } = usePoints()
  const Game = GAMES[game]
  return (
    <div className="mx-auto w-full max-w-3xl">
      <Game onWin={add} />
    </div>
  )
}
