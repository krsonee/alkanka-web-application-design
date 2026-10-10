'use client'

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import useSWR from 'swr'
import { claimReward, spendKC } from '@/app/actions/wallet'

type MeResponse = { member: { id: string; name: string } | null; balance: number }

type PointsContextValue = {
  points: number
  member: MeResponse['member']
  loading: boolean
  lastGain: { id: number; value: number } | null
  /** Server-capped reward (wheel, chest, tasks, predictions). */
  add: (value: number, source?: string) => Promise<boolean>
  /** Server-side debit (market, events). */
  spend: (value: number, source?: string) => Promise<boolean>
  /** Apply a balance returned by a server action. */
  setBalance: (balance: number) => void
  refresh: () => void
  requireLogin: () => boolean
}

const PointsContext = createContext<PointsContextValue | null>(null)

const fetcher = (url: string) => fetch(url, { cache: 'no-store' }).then((r) => r.json() as Promise<MeResponse>)

export function PointsProvider({ children }: { children: ReactNode }) {
  const { data, isLoading, mutate } = useSWR('/api/me', fetcher, { revalidateOnFocus: true })
  const [lastGain, setLastGain] = useState<{ id: number; value: number } | null>(null)
  const prev = useRef<number | null>(null)

  const member = data?.member ?? null
  const points = member ? (data?.balance ?? 0) : 0

  const setBalance = useCallback(
    (balance: number) => {
      const before = prev.current ?? points
      if (balance !== before) setLastGain({ id: Date.now(), value: balance - before })
      prev.current = balance
      mutate((d) => (d ? { ...d, balance } : d), { revalidate: false })
    },
    [mutate, points],
  )

  const requireLogin = useCallback(() => {
    if (member) return true
    window.location.hash = 'giris'
    return false
  }, [member])

  const add = useCallback(
    async (value: number, source = 'gorev') => {
      if (!requireLogin() || value <= 0) return false
      const res = await claimReward(source, value)
      if (typeof res.balance === 'number') setBalance(res.balance)
      return res.ok
    },
    [requireLogin, setBalance],
  )

  const spend = useCallback(
    async (value: number, source = 'market') => {
      if (!requireLogin()) return false
      if (value > points) return false
      const res = await spendKC(source, value)
      if (typeof res.balance === 'number') setBalance(res.balance)
      return res.ok
    },
    [points, requireLogin, setBalance],
  )

  if (member && prev.current === null && data) prev.current = data.balance

  const value = useMemo(
    () => ({ points, member, loading: isLoading, lastGain, add, spend, setBalance, refresh: () => mutate(), requireLogin }),
    [points, member, isLoading, lastGain, add, spend, setBalance, mutate, requireLogin],
  )
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
