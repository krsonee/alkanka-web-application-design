'use client'

import { usePoints } from '../points-context'
import { LuckyWheel } from './lucky-wheel'
import { MysteryChests } from './mystery-chests'
import { DiceRoll } from './dice-roll'
import { useMiniLock } from './mini-status'

import { LandscapeFit } from '../arena/landscape-fit'

const GAMES = { cark: LuckyWheel, sandik: MysteryChests, zar: DiceRoll }
const LABELS = { cark: 'Şans Çarkı', sandik: 'Gizemli Sandık', zar: 'Zar At' }

export function GameStage({ game }: { game: keyof typeof GAMES }) {
  const { member, requireLogin, refresh: refreshBalance } = usePoints()
  const { remaining, locked, refresh } = useMiniLock(game)
  const Game = GAMES[game]

  function onWin() {
    refreshBalance()
    refresh()
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <LandscapeFit label={LABELS[game]}>
        <Game
          onWin={onWin}
          lockedFor={locked ? remaining : 0}
          canPlay={() => (member ? !locked : requireLogin())}
          onPlayed={refresh}
        />
      </LandscapeFit>
    </div>
  )
}
