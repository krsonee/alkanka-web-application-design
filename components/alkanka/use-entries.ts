'use client'

import { useState } from 'react'
import type { EventItem, MarketItem } from './data'
import { EVENT_DETAILS, VISIT_TARGET, type TaskItem } from './details'
import { usePoints } from './points-context'

export function useEventEntry(event: EventItem) {
  const { points, spend, counts, bump } = usePoints()
  const detail = EVENT_DETAILS[event.id]
  const owned = counts[`event:${event.id}`] ?? 0
  const remaining = Math.max(0, detail.maxPerUser - owned)
  const [error, setError] = useState<string | null>(null)

  function join(qty = 1) {
    const amount = Math.min(qty, remaining)
    if (amount <= 0) return false
    const cost = event.entry * amount
    if (cost > 0 && !spend(cost)) {
      setError(`${(cost - points).toLocaleString('tr-TR')} AC eksik — oyunlardan topla`)
      return false
    }
    bump(`event:${event.id}`, amount)
    setError(null)
    return true
  }

  return { detail, owned, remaining, joined: owned > 0, join, error, points }
}

export function useMarketItem(item: MarketItem) {
  const { points, spend, counts, bump } = usePoints()
  const owned = counts[`market:${item.id}`] ?? 0
  const left = Math.max(0, item.stock - owned)
  const limitReached = owned >= item.perUser
  const [status, setStatus] = useState<'idle' | 'ok' | 'funds'>('idle')

  function claim() {
    if (!left || limitReached) return
    if (!spend(item.price)) {
      setStatus('funds')
      return
    }
    bump(`market:${item.id}`)
    setStatus('ok')
  }

  return {
    owned,
    left,
    soldOut: left === 0,
    limitReached,
    affordable: points >= item.price,
    missing: item.price - points,
    status,
    claim,
    points,
  }
}

export function useTask(task: TaskItem) {
  const { add, counts, bump } = usePoints()
  const done = (counts[`task:${task.id}`] ?? 0) > 0
  const visited = Object.keys(counts).filter((k) => k.startsWith('visit:')).length
  const canComplete = task.kind !== 'visit' || visited >= VISIT_TARGET

  function complete() {
    if (done || !canComplete) return
    bump(`task:${task.id}`)
    add(task.reward)
  }

  function visit(siteId: string) {
    if (counts[`visit:${siteId}`]) return
    bump(`visit:${siteId}`)
  }

  return { done, complete, canComplete, visited, visit, isVisited: (id: string) => !!counts[`visit:${id}`] }
}
