import 'server-only'
import { rows, sql } from '@/lib/db'

async function count(query: ReturnType<typeof sql>) {
  try {
    const r = await rows<{ c: string }>(query)
    return Number(r[0]?.c ?? 0)
  } catch {
    // Table may not exist yet if the module was never opened.
    return 0
  }
}

export type PendingSource = 'community' | 'tasks' | 'market' | 'growth' | 'social'

export type PendingDetail = {
  reviews: number
  complaints: number
  withdrawals: number
  claims: number
  market: number
  proofs?: number
  sponsorAccounts?: number
  socialAccounts?: number
  socialEntries?: number
}

export const EMPTY_PENDING: PendingDetail = { reviews: 0, complaints: 0, withdrawals: 0, claims: 0, market: 0, proofs: 0, sponsorAccounts: 0, socialAccounts: 0, socialEntries: 0 }

/** Mirrors exactly what the moderation queue lists, so the menu badge matches the queue length. */
export function moderationTotal(d: PendingDetail) {
  return d.reviews + d.complaints + d.claims + d.market + d.withdrawals + (d.proofs ?? 0)
}

/** Everything waiting on a person, including the approvals that live outside the moderation queue. */
export function pendingTotal(d: PendingDetail) {
  return moderationTotal(d) + (d.sponsorAccounts ?? 0) + (d.socialAccounts ?? 0) + (d.socialEntries ?? 0)
}

export async function pendingDetail(can: (id: PendingSource) => boolean): Promise<PendingDetail> {
  const [reviews, complaints, withdrawals, claims, market, proofs, sponsorAccounts, socialAccounts, socialEntries] = await Promise.all([
    can('community') ? count(sql`SELECT count(*) AS c FROM site_reviews WHERE status = 'pending'`) : 0,
    can('community') ? count(sql`SELECT count(*) AS c FROM complaints WHERE status = 'open'`) : 0,
    can('community') ? count(sql`SELECT count(*) AS c FROM withdraw_shares WHERE status = 'pending'`) : 0,
    can('tasks') ? count(sql`SELECT count(*) AS c FROM task_claims WHERE status = 'beklemede'`) : 0,
    can('market') ? count(sql`SELECT count(*) AS c FROM market_requests WHERE status = 'beklemede'`) : 0,
    can('community') ? count(sql`SELECT count(*) AS c FROM site_reviews WHERE proof_status = 'pending' AND proof_path IS NOT NULL`) : 0,
    can('growth') ? count(sql`SELECT count(*) AS c FROM sponsor_accounts WHERE status = 'pending'`) : 0,
    can('social') ? count(sql`SELECT count(*) AS c FROM social_accounts WHERE status = 'pending'`) : 0,
    can('social') ? count(sql`SELECT count(*) AS c FROM social_entries WHERE status = 'pending'`) : 0,
  ])
  return { reviews, complaints, withdrawals, claims, market, proofs, sponsorAccounts, socialAccounts, socialEntries }
}
