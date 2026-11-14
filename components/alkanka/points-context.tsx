'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import useSWR from 'swr'
import { claimPrediction, spendKC } from '@/app/actions/wallet'

type MeResponse = { member: { id: string; name: string } | null; balance: number }

type PointsContextValue = {
  points: number
  member: MeResponse['member']
  /** The session request has not answered yet; `member` may still come from the device's last known state. */
  loading: boolean
  /** Guest or member is decided (by the request or the device's last known state), so account UI can be drawn. */
  known: boolean
  lastGain: { id: number; value: number } | null
  /** Prediction reward; the amount is decided on the server. */
  predict: (matchId: string, optionId: string) => Promise<boolean>
  /** Server-side debit (market, events). */
  spend: (value: number, source?: string) => Promise<boolean>
  /** Apply a balance returned by a server action. */
  setBalance: (balance: number) => void
  refresh: () => void
  requireLogin: () => boolean
}

const PointsContext = createContext<PointsContextValue | null>(null)

const fetcher = async (url: string) => {
  const r = await fetch(url, { cache: 'no-store' })
  if (!r.ok) throw new Error(`me ${r.status}`)
  return (await r.json()) as MeResponse
}

/**
 * The last answer of /api/me, kept on the device. Pages are served as static HTML, so the session is
 * only known after a request; the hint lets the header draw the right account state at once instead
 * of showing "Giriş yap" to a signed-in member. It only decides what is drawn: every action is still
 * checked against the real session on the server.
 */
const HINT_KEY = 'alkanka:me'
const HINT_EVENT = 'alkanka:me-hint'
let hintRaw: string | null = null
let hintValue: MeResponse | null = null

function readHint(): MeResponse | null {
  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(HINT_KEY)
  } catch {
    return null
  }
  if (raw === hintRaw) return hintValue
  hintRaw = raw
  try {
    const parsed = raw ? (JSON.parse(raw) as MeResponse) : null
    hintValue = parsed && typeof parsed.balance === 'number' ? parsed : null
  } catch {
    hintValue = null
  }
  return hintValue
}

function writeHint(me: MeResponse) {
  try {
    window.localStorage.setItem(HINT_KEY, JSON.stringify(me))
    window.dispatchEvent(new Event(HINT_EVENT))
  } catch {
    // Private mode or a full quota: the header falls back to waiting for the request.
  }
}

function subscribeHint(onChange: () => void) {
  window.addEventListener('storage', onChange)
  window.addEventListener(HINT_EVENT, onChange)
  return () => {
    window.removeEventListener('storage', onChange)
    window.removeEventListener(HINT_EVENT, onChange)
  }
}

export function PointsProvider({ children }: { children: ReactNode }) {
  const { data, error, mutate } = useSWR('/api/me', fetcher, { revalidateOnFocus: true })
  const [lastGain, setLastGain] = useState<{ id: number; value: number } | null>(null)
  const prev = useRef<number | null>(null)
  const hint = useSyncExternalStore(subscribeHint, readHint, () => null)

  useEffect(() => {
    if (data) writeHint(data)
  }, [data])

  // Until the request answers, the device's last known state stands in for it.
  const me = data ?? hint
  const member = me?.member ?? null
  const points = member ? (me?.balance ?? 0) : 0
  // A failed request is not an answer: walls and login prompts wait for a real one.
  const loading = data === undefined
  const known = me != null || error != null

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
    // Session still unknown: ask again instead of sending a possible member to the login window.
    if (loading) void mutate()
    else window.location.hash = 'giris'
    return false
  }, [member, loading, mutate])

  const predict = useCallback(
    async (matchId: string, optionId: string) => {
      if (!requireLogin()) return false
      const res = await claimPrediction(matchId, optionId)
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
    () => ({ points, member, loading, known, lastGain, predict, spend, setBalance, refresh: () => mutate(), requireLogin }),
    [points, member, loading, known, lastGain, predict, spend, setBalance, mutate, requireLogin],
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
