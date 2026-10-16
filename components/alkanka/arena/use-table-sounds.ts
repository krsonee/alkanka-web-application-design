'use client'

import { useEffect, useRef } from 'react'
import { playSound, type SoundName } from '@/lib/sound'

type Snapshot = {
  status: string
  version: number
  turn: number | null
  seat: number
  humans: number
  game: string
  won: boolean
}

const MOVE_SOUND: Record<string, SoundName> = {
  tavla: 'dice',
  monopoly: 'dice',
  okey: 'tile',
  okey101: 'tile',
  batak: 'card',
  pisti: 'card',
  papaz: 'card',
  bilardo: 'cue',
}

/** Plays lifecycle sounds by diffing successive table snapshots from polling. */
export function useTableSounds(snap: Snapshot | null) {
  const prev = useRef<Snapshot | null>(null)

  useEffect(() => {
    if (!snap) return
    const p = prev.current
    prev.current = snap
    // The first snapshot is just "where we are" — don't replay history on load.
    if (!p) return

    if (snap.humans > p.humans) playSound('join')
    else if (snap.humans < p.humans) playSound('leave')

    if (p.status === 'bekliyor' && snap.status === 'oynaniyor') {
      playSound('start')
      return
    }
    if (p.status !== 'bitti' && snap.status === 'bitti') {
      playSound(snap.seat < 0 ? 'start' : snap.won ? 'win' : 'lose')
      return
    }
    if (snap.status !== 'oynaniyor') return

    const myTurnNow = snap.seat >= 0 && snap.turn === snap.seat
    const myTurnBefore = p.seat >= 0 && p.turn === p.seat
    if (myTurnNow && !myTurnBefore) {
      playSound('turn')
      return
    }
    // Someone else moved (my own moves get their sound at the click).
    if (snap.version > p.version && !myTurnBefore) playSound(MOVE_SOUND[snap.game] ?? 'tick')
  }, [snap?.status, snap?.version, snap?.turn, snap?.humans]) // eslint-disable-line react-hooks/exhaustive-deps
}
