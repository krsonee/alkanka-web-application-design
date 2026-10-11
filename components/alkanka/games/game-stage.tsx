'use client'

import { usePoints } from '../points-context'
import { LuckyWheel } from './lucky-wheel'
import { MysteryChests } from './mystery-chests'
import { useMiniLock } from './mini-status'

const GAMES = { cark: LuckyWheel, sandik: MysteryChests }

export function GameStage({ game }: { game: keyof typeof GAMES }) {
  const { add, member, requireLogin } = usePoints()
  const { remaining, locked, refresh } = useMiniLock(game)
  const Game = GAMES[game]

  async function onWin(points: number) {
    await add(points, game)
    refresh()
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <Game
        onWin={onWin}
        lockedFor={locked ? remaining : 0}
        canPlay={() => (member ? !locked : requireLogin())}
        onPlayed={refresh}
      />
    </div>
  )
}
