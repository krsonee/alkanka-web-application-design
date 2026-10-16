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

export async function pendingCounts(can: (id: 'community' | 'tasks' | 'market') => boolean): Promise<Record<string, number>> {
  const [reviews, complaints, claims, market] = await Promise.all([
    can('community') ? count(sql`SELECT count(*) AS c FROM site_reviews WHERE status = 'pending'`) : 0,
    can('community') ? count(sql`SELECT count(*) AS c FROM complaints WHERE status = 'open'`) : 0,
    can('tasks') ? count(sql`SELECT count(*) AS c FROM task_claims WHERE status = 'beklemede'`) : 0,
    can('market') ? count(sql`SELECT count(*) AS c FROM market_requests WHERE status = 'beklemede'`) : 0,
  ])
  return { community: reviews + complaints, tasks: claims, market }
}
