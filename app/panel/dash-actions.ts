'use server'

import { isPanelOwner } from '@/lib/admin-auth'
import { dashStats, parseQuery, type DashStats } from '@/lib/panel-stats'

export async function loadDashStats(params: { r?: string; from?: string; to?: string }): Promise<DashStats | null> {
  if (!(await isPanelOwner())) return null
  try {
    return await dashStats(parseQuery(params))
  } catch (error) {
    console.error('[panel:dash-stats]', error)
    return null
  }
}
