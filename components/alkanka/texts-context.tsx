'use client'

import { createContext, useCallback, useContext } from 'react'
import { fillText, mergeTexts, type SiteTexts } from '@/lib/site-texts-shared'

const fallback = mergeTexts(null)
const TextsContext = createContext<SiteTexts>(fallback)

export function TextsProvider({ value, children }: { value: SiteTexts; children: React.ReactNode }) {
  return <TextsContext.Provider value={value}>{children}</TextsContext.Provider>
}

export function useTexts() {
  const texts = useContext(TextsContext)
  return useCallback((key: string, otherwise = '') => fillText(texts[key] ?? otherwise, texts), [texts])
}
