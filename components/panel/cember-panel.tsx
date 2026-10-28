import { rows, sql } from '@/lib/db'
import { ARENA_GAMES, ARENA_META } from '@/lib/arena'
import { getCemberEvents, getInstantBudget, recentRounds, upcomingSlots } from '@/lib/cember'
import { CemberEditor } from '@/components/panel/cember-editor'

export async function CemberPanel() {
  const [config, recent, tasks, badges, items] = await Promise.all([
    getCemberEvents(),
    recentRounds(12).catch(() => []),
    rows<{ id: number; title: string }>(sql`SELECT id, title FROM tasks WHERE active ORDER BY sort, id`).catch(() => []),
    rows<{ id: string; name: string }>(sql`SELECT id, name FROM kp_badges WHERE active ORDER BY sort, name`).catch(() => []),
    rows<{ id: string; name: string }>(sql`SELECT id, name FROM market_items ORDER BY sort, created_at`).catch(() => []),
  ])
  const budget = await getInstantBudget(config).catch(() => ({ dailyKc: 0, usedKc: 0 }))
  return (
    <CemberEditor
      initial={config}
      budget={budget}
      recent={recent}
      upcoming={upcomingSlots(config)}
      tasks={tasks.map((t) => ({ id: String(t.id), name: t.title }))}
      games={ARENA_GAMES.map((g) => ({ id: g, name: ARENA_META[g].title }))}
      badges={badges}
      items={items}
    />
  )
}
