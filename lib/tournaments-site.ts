import 'server-only'
import { getHidden } from '@/lib/catalog'
import { withoutHidden } from '@/lib/hidden-shared'
import { readTournaments } from '@/lib/tournaments'
import type { Tournament } from '@/lib/tournaments-shared'

/** What /turnuvalar shows: hidden and cancelled tournaments left out, contact details kept off the public page. */
export async function siteTournaments(): Promise<Tournament[]> {
  const [list, hidden] = await Promise.all([readTournaments(), getHidden()])
  return withoutHidden(list, hidden, 'tournament')
    .filter((t) => t.status !== 'iptal')
    .map((t) => ({ ...t, entries: t.entries.map((e) => ({ ...e, telegram: '' })) }))
}
