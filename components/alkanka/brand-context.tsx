'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'

export type LogoConcept = 'wordmark' | 'monogram' | 'network' | 'shield'

type BrandContextValue = {
  concept: LogoConcept
  setConcept: (concept: LogoConcept) => void
}

const BrandContext = createContext<BrandContextValue | null>(null)

export function BrandProvider({ children }: { children: ReactNode }) {
  const [concept, setConcept] = useState<LogoConcept>('shield')
  return <BrandContext.Provider value={{ concept, setConcept }}>{children}</BrandContext.Provider>
}

export function useBrand() {
  const ctx = useContext(BrandContext)
  if (!ctx) throw new Error('useBrand must be used within BrandProvider')
  return ctx
}
