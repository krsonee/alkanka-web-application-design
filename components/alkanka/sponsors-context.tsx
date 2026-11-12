'use client'

import { createContext, useCallback, useContext, useMemo } from 'react'
import { sponsorById as staticSponsorById, type Sponsor } from './data'

const SponsorsContext = createContext<Sponsor[]>([])

export function SponsorsProvider({ value, children }: { value: Sponsor[]; children: React.ReactNode }) {
  return <SponsorsContext.Provider value={value}>{children}</SponsorsContext.Provider>
}

/** Panel-managed sponsors win; the built-in list only fills in ids the panel doesn't know. */
export function useSponsorById() {
  const live = useContext(SponsorsContext)
  const map = useMemo(() => new Map(live.map((s) => [s.id, s])), [live])
  return useCallback((id: string) => (id ? map.get(id) ?? staticSponsorById(id) : undefined), [map])
}
