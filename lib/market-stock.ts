export type StockLevel = 'ok' | 'low' | 'out'

/** Stock at or below this counts as running low: a fifth of the total, at least 3, but never the full stock itself. */
export function lowStockAt(total: number) {
  const fifth = Math.max(3, Math.ceil(total * 0.2))
  return total > 0 ? Math.min(fifth, total - 1) : 3
}

export function stockLevel(stock: number, total: number): StockLevel {
  if (stock <= 0) return 'out'
  return stock <= lowStockAt(total) ? 'low' : 'ok'
}

export function stockWarning(stock: number, total: number): string | null {
  const level = stockLevel(stock, total)
  if (level === 'out') return 'Stok bitti'
  return level === 'low' ? `Stok azaldı: ${stock} kaldı` : null
}
