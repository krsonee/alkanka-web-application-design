import 'server-only'
import { randomBytes } from 'node:crypto'
import { rows, sql } from '@/lib/db'
import { ensureTasks } from '@/lib/tasks'
import { buildPlan, type PlanTask } from '@/lib/task-plan'
import { trDay } from '@/lib/task-period'
import type { TaskPart } from '@/lib/task-kinds'

export const TASK_PLAN_KEY = 'tasks:plan-2026-12'

export type PlanSeedResult = { start: string; added: string[]; skipped: { title: string; why: 'ayni-ad' | 'zaten-var' | 'sart-eksik' }[] }

type Existing = { title: string; period: string; kind: string; param: string | null; target: number; pool: boolean; chain: string | null; archived: boolean; ends_at: string | null }

// Compared here, not in SQL: the database's lower() does not fold İ/I the Turkish way.
const nameKey = (title: string) => title.trim().replace(/\s+/g, ' ').toLocaleLowerCase('tr')
const sameThing = (t: { period: string; kind: string; param: string | null; target: number }) => `${t.period}:${t.kind}:${t.param ?? ''}:${t.target}`

/**
 * Puts the task calendar on the site once, starting from the day it runs. The marker is taken before the
 * first task is written, so two visitors arriving together cannot both load the calendar; a run that fails
 * gives the marker back and the next visit carries on from the tasks already written.
 */
export async function seedTaskPlan(today = trDay()): Promise<PlanSeedResult | null> {
  const { getContent } = await import('@/lib/content')
  if (await getContent(TASK_PLAN_KEY).catch(() => null)) return null
  await ensureTasks()
  const claimed = await rows(sql`INSERT INTO site_content (key, value, updated_at)
    VALUES (${TASK_PLAN_KEY}, ${JSON.stringify({ start: today, at: new Date().toISOString() })}::jsonb, now())
    ON CONFLICT (key) DO NOTHING RETURNING key`)
  if (!claimed.length) return null
  try {
    return await writePlan(today)
  } catch (error) {
    await rows(sql`DELETE FROM site_content WHERE key = ${TASK_PLAN_KEY}`).catch(() => {})
    throw error
  }
}

async function writePlan(start: string): Promise<PlanSeedResult> {
  const existing = await rows<Existing>(sql`SELECT title, period, kind, param, target, pool, chain, archived, ends_at FROM tasks`)
  const names = new Set(existing.map((t) => nameKey(t.title)))
  const covered = new Set(
    existing
      .filter((t) => !t.pool && !t.chain && !t.archived && (!t.ends_at || Date.parse(String(t.ends_at)) > Date.now()))
      .map((t) => sameThing({ ...t, target: Number(t.target) })),
  )
  const [{ top }] = await rows<{ top: number }>(sql`SELECT COALESCE(max(sort), 0) AS top FROM tasks`)
  let sort = Math.max(500, Number(top) + 1)
  const ids = new Map<string, number>()
  const result: PlanSeedResult = { start, added: [], skipped: [] }

  for (const plan of buildPlan(start)) {
    if (names.has(nameKey(plan.title))) {
      result.skipped.push({ title: plan.title, why: 'ayni-ad' })
      continue
    }
    if (plan.dedupe && covered.has(sameThing(plan))) {
      result.skipped.push({ title: plan.title, why: 'zaten-var' })
      continue
    }
    const parts = partsOf(plan, ids)
    if (!parts) {
      result.skipped.push({ title: plan.title, why: 'sart-eksik' })
      continue
    }
    // A code nobody knows: the task stays hidden until the team writes the real one.
    const param = plan.kind === 'secret_code' ? randomBytes(9).toString('base64url').toUpperCase() : plan.param
    const [row] = await rows<{ id: number }>(sql`INSERT INTO tasks (title, detail, points, link, needs_approval, active, sort, period, starts_at, ends_at, kind, target, param,
        category, pool, chain, chain_step, badge, cap, days, parts)
      VALUES (${plan.title}, ${plan.detail}, ${plan.points}, NULL, ${plan.approval}, ${plan.active}, ${sort++}, ${plan.period}, ${plan.startsAt}, ${plan.endsAt},
        ${plan.kind}, ${plan.target}, ${param}, ${plan.category}, false, NULL, 0, NULL, 0,
        ${plan.days ? JSON.stringify(plan.days) : null}::jsonb, ${parts.length ? JSON.stringify(parts) : null}::jsonb)
      RETURNING id`)
    ids.set(plan.key, Number(row.id))
    names.add(nameKey(plan.title))
    result.added.push(plan.title)
  }
  return result
}

/** Null when a condition points at a task that was not written, so a super task is never saved with a hole in it. */
function partsOf(plan: PlanTask, ids: Map<string, number>): TaskPart[] | null {
  const parts: TaskPart[] = []
  for (const part of plan.parts) {
    if ('ref' in part) {
      const id = ids.get(part.ref)
      if (!id) return null
      parts.push({ kind: 'task', param: String(id), target: 1 })
    } else {
      parts.push({ kind: part.kind, param: part.param ?? null, target: part.target ?? 1 })
    }
  }
  return parts
}
