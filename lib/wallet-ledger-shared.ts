export const LEDGER_PAGE_SIZE = 50
/** Every coin movement of every member lands in the ledger, so it is kept for a fixed window instead of growing without end. */
export const LEDGER_KEEP_DAYS = 90

export type LedgerRow = { id: number; delta: number; balanceAfter: number; source: string | null; createdAt: string }

export type LedgerPage = {
  page: number
  total: number
  coinsIn: number
  coinsOut: number
  /** When the ledger started being kept; movements before it are not listed. */
  since: string | null
  rows: LedgerRow[]
}
