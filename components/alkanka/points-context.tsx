'use client'

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

type PointsContextValue = {
  points: number
  lastGain: { id: number; value: number } | null
  add: (value: number) => void
  spend: (value: number) => boolean
}

const PointsContext = createContext<PointsContextValue | null>(null)

export function PointsProvider({ children }: { children: ReactNode }) {
  const [points, setPoints] = useState(1250)
  const [lastGain, setLastGain] = useState<{ id: number; value: number } | null>(null)

  const add = useCallback((value: number) => {
    if (value <= 0) return
    setPoints((p) => p + value)
    setLastGain({ id: Date.now(), value })
  }, [])

  const spend = useCallback(
    (value: number) => {
      if (value > points) return false
      setPoints((p) => p - value)
      setLastGain({ id: Date.now(), value: -value })
      return true
    },
    [points],
  )

  const value = useMemo(() => ({ points, lastGain, add, spend }), [points, lastGain, add, spend])
  return <PointsContext.Provider value={value}>{children}</PointsContext.Provider>
}

export function usePoints() {
  const ctx = useContext(PointsContext)
  if (!ctx) throw new Error('usePoints must be used within PointsProvider')
  return ctx
}

export function formatAC(value: number) {
  return value.toLocaleString('tr-TR')
}
