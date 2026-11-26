'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
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
  const { remaining, locked, left, refresh } = useMiniLock(game)
  const Game = GAMES[game]
  const router = useRouter()

  function onWin() {
    refreshBalance()
    refresh()
  }

  // Back goes where the visitor came from (home tile, tasks, games list); a page opened from a link has nowhere to go back to.
  function goBack() {
    const cameFromSite = document.referrer.startsWith(window.location.origin) || window.history.state?.idx > 0
    if (cameFromSite && window.history.length > 1) router.back()
    else router.push('/oyunlar')
  }

  return (
    <div className="mx-auto w-full max-w-5xl">
      <LandscapeFit label={LABELS[game]}>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={goBack}
              className="flex h-10 shrink-0 touch-manipulation items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 text-sm font-bold text-foreground transition-colors hover:bg-secondary"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              Geri
            </button>
            <p className="min-w-0 truncate text-sm font-semibold text-muted-foreground">{LABELS[game]}</p>
          </div>
          <Game
            onWin={onWin}
            lockedFor={locked ? remaining : 0}
            playsLeft={member ? left : null}
            canPlay={() => (member ? !locked : requireLogin())}
            onPlayed={refresh}
          />
        </div>
      </LandscapeFit>
    </div>
  )
}
