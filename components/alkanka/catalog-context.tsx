'use client'

import { createContext, useContext } from 'react'
import { DEFAULT_CATALOG, type Catalog } from '@/lib/catalog-shared'

const CatalogContext = createContext<Catalog>(DEFAULT_CATALOG)

export function CatalogProvider({ value, children }: { value: Catalog; children: React.ReactNode }) {
  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>
}

export function useCatalog() {
  return useContext(CatalogContext)
}
