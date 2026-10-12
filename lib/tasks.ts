import 'server-only'
import { rows, sql } from '@/lib/db'
import { ensureKp } from '@/lib/kanka-puan'

export type TaskRecord = {
  id: number
  title: string
  detail: string
  points: number
  active: boolean
  sort: number
}

export type TaskInput = {
  id: number | null
  title: string
  detail: string
  points: number
  active: boolean
  sort: number
}

let ready: Promise<unknown> | null = null

export function ensureTasks() {
  ready ??= rows(sql`CREATE TABLE IF NOT EXISTS tasks (
    id serial PRIMARY KEY,
    title text NOT NULL,
    detail text NOT NULL DEFAULT '',
    points int NOT NULL,
    active boolean NOT NULL DEFAULT true,
    sort int NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now())`).catch((error) => {
    ready = null
    throw error
  })
  return ready
}

function mapTask(row: Record<string, unknown>): TaskRecord {
  return {
    id: Number(row.id),
    title: String(row.title),
    detail: String(row.detail ?? ''),
    points: Number(row.points),
    active: Boolean(row.active),
    sort: Number(row.sort),
  }
}

export async function listTasks(): Promise<TaskRecord[]> {
  await ensureTasks()
  const found = await rows(sql`SELECT id, title, detail, points, active, sort FROM tasks ORDER BY sort, id`)
  return found.map(mapTask)
}

export async function listPublicTasks(): Promise<TaskRecord[]> {
  return (await listTasks()).filter((task) => task.active)
}

export async function completedTaskIds(userId: string): Promise<number[]> {
  await ensureTasks()
  await ensureKp()
  const found = await rows<{ ref: string }>(sql`SELECT ref FROM kp_events WHERE user_id = ${userId} AND source = 'gorev' AND ref IS NOT NULL`)
  return found.map((row) => Number(row.ref)).filter((id) => Number.isInteger(id))
}

function clip(value: unknown, max: number) {
  return String(value ?? '').trim().slice(0, max)
}

export async function saveTask(input: TaskInput): Promise<number> {
  const title = clip(input.title, 80)
  if (!title) throw new Error('Görev adı gerekli.')
  const detail = clip(input.detail, 160)
  const points = Number(input.points)
  if (!Number.isInteger(points) || points < 1 || points > 100000) throw new Error('Puan 1 ile 100000 arasında tam sayı olmalı.')
  const sort = Number(input.sort)
  if (!Number.isInteger(sort) || sort < 0 || sort > 10000) throw new Error('Sıra 0 ile 10000 arasında tam sayı olmalı.')
  await ensureTasks()
  const active = Boolean(input.active)
  if (input.id != null && input.id !== 0) {
    const id = Number(input.id)
    if (!Number.isInteger(id) || id < 1) throw new Error('Görev bulunamadı.')
    const updated = await rows<{ id: number }>(sql`UPDATE tasks SET
      title = ${title}, detail = ${detail}, points = ${points}, active = ${active}, sort = ${sort}
      WHERE id = ${id} RETURNING id`)
    if (!updated.length) throw new Error('Görev bulunamadı.')
    return id
  }
  const inserted = await rows<{ id: number }>(sql`INSERT INTO tasks (title, detail, points, active, sort)
    VALUES (${title}, ${detail}, ${points}, ${active}, ${sort}) RETURNING id`)
  return Number(inserted[0]?.id)
}

/** Writes one kp_events row. A second completion of the same task inserts nothing. */
export async function awardTask(userId: string, taskId: number): Promise<{ awarded: boolean; points: number }> {
  await ensureTasks()
  await ensureKp()
  const found = await rows<{ id: number; points: number }>(sql`SELECT id, points FROM tasks WHERE id = ${taskId} AND active`)
  const task = found[0]
  if (!task) throw new Error('Görev bulunamadı.')
  const ref = String(task.id)
  const inserted = await rows<{ id: number }>(sql`INSERT INTO kp_events (user_id, source, points, ref)
    VALUES (${userId}, 'gorev', ${task.points}, ${ref})
    ON CONFLICT DO NOTHING
    RETURNING id`)
  return { awarded: inserted.length > 0, points: Number(task.points) }
}
