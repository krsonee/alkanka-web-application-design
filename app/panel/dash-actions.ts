'use server'

import { isPanelOwner } from '@/lib/admin-auth'
import { dashStats, parseRange, type DashStats } from '@/lib/panel-stats'

export async function loadDashStats(range: number): Promise<DashStats | null> {
  if (!(await isPanelOwner())) return null
  try {
    return await dashStats(parseRange(String(range)))
  } catch (error) {
    console.error('[panel:dash-stats]', error)
    return null
  }
}
