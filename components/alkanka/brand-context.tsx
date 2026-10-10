'use client'

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

export const EMBLEM_IDS = [
  'pro-wolf',
  'pro-lion',
  'pro-eagle',
  'pro-monogram',
  'pro-crown',
  'pro-badge',
  'pro-chip',
  'pro-handshake',
  'lion',
  'wolf',
  'tiger',
  'eagle',
  'horse',
  'crown',
  'coin',
  'diamond',
  'shield-emblem',
  'bolt',
  'laurel',
  'fist',
] as const

export type EmblemId = (typeof EMBLEM_IDS)[number]
export type SvgConcept = 'wordmark' | 'monogram' | 'network' | 'shield'
export type LogoConcept = EmblemId | SvgConcept

const STORAGE_KEY = 'alkanka-logo-v2'
const DEFAULT_CONCEPT: LogoConcept = 'fist'
const ALL_CONCEPTS: readonly string[] = [...EMBLEM_IDS, 'wordmark', 'monogram', 'network', 'shield']

type BrandContextValue = {
  concept: LogoConcept
  setConcept: (concept: LogoConcept) => void
}

const BrandContext = createContext<BrandContextValue | null>(null)

export function BrandProvider({ children }: { children: ReactNode }) {
  const [concept, setConceptState] = useState<LogoConcept>(DEFAULT_CONCEPT)

  useEffect(() => {
    window.localStorage.removeItem(STORAGE_KEY)
  }, [])

  const setConcept = useCallback((next: LogoConcept) => {
    if (ALL_CONCEPTS.includes(next)) setConceptState(next)
  }, [])

  return <BrandContext.Provider value={{ concept, setConcept }}>{children}</BrandContext.Provider>
}

export function useBrand() {
  const ctx = useContext(BrandContext)
  if (!ctx) throw new Error('useBrand must be used within BrandProvider')
  return ctx
}
