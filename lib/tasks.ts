import 'server-only'
import { rows, sql } from '@/lib/db'
import { ensureKp } from '@/lib/kanka-puan'
import { credit, getBalance } from '@/lib/member'

export type TaskRecord = {
  id: number
  title: string
  detail: string
  points: number
  link: string | null
  needsApproval: boolean
  active: boolean
  sort: number
}

export type TaskInput = {
  id: number | null
  title: string
  detail: string
  points: number
  link: string
  needsApproval: boolean
  active: boolean
  sort: number
}

export type ClaimStatus = 'beklemede' | 'onaylandi' | 'reddedildi'

export type PendingClaim = {
  id: number
  userName: string
  email: string
  taskTitle: string
  createdAt: string
}

const LINK_ERROR = 'Bağlantı https:// ile başlamalı.'

let ready: Promise<unknown> | null = null

export function ensureTasks() {
  ready ??= (async () => {
    await rows(sql`CREATE TABLE IF NOT EXISTS tasks (
      id serial PRIMARY KEY,
      title text NOT NULL,
      detail text NOT NULL DEFAULT '',
      points int NOT NULL,
      active boolean NOT NULL DEFAULT true,
      sort int NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now())`)
    await rows(sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS link text`)
    await rows(sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS needs_approval boolean NOT NULL DEFAULT true`)
    await rows(sql`CREATE TABLE IF NOT EXISTS task_claims (
      id serial PRIMARY KEY,
      user_id text NOT NULL,
      task_id int NOT NULL,
      status text NOT NULL DEFAULT 'beklemede',
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (user_id, task_id))`)
  })().catch((error) => {
    ready = null
    throw error
  })
  return ready
}

export function cleanLink(value: unknown): string | null {
  const link = String(value ?? '').trim()
  if (!link) return null
  let url: URL
  try {
    url = new URL(link)
  } catch {
    throw new Error(LINK_ERROR)
  }
  if (url.protocol !== 'https:' || !link.startsWith('https://') || link.length > 300) throw new Error(LINK_ERROR)
  return link
}

function mapTask(row: Record<string, unknown>): TaskRecord {
  const rawLink = String(row.link ?? '').trim()
  return {
    id: Number(row.id),
    title: String(row.title),
    detail: String(row.detail ?? ''),
    points: Number(row.points),
    link: rawLink.startsWith('https://') ? rawLink : null,
    needsApproval: Boolean(row.needs_approval),
    active: Boolean(row.active),
    sort: Number(row.sort),
  }
}

export async function listTasks(): Promise<TaskRecord[]> {
  await ensureTasks()
  const found = await rows(sql`SELECT id, title, detail, points, link, needs_approval, active, sort FROM tasks ORDER BY sort, id`)
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

export async function taskClaimMap(userId: string): Promise<Record<number, ClaimStatus>> {
  await ensureTasks()
  const found = await rows<{ task_id: number; status: string }>(sql`SELECT task_id, status FROM task_claims WHERE user_id = ${userId}`)
  const map: Record<number, ClaimStatus> = {}
  for (const row of found) {
    if (row.status === 'beklemede' || row.status === 'onaylandi' || row.status === 'reddedildi') map[Number(row.task_id)] = row.status
  }
  return map
}

export async function listPendingClaims(): Promise<PendingClaim[]> {
  await ensureTasks()
  const found = await rows(sql`SELECT c.id, c.created_at, t.title AS task_title, u.name AS user_name, u.email
    FROM task_claims c
    JOIN tasks t ON t.id = c.task_id
    LEFT JOIN public."user" u ON u.id = c.user_id
    WHERE c.status = 'beklemede'
    ORDER BY c.created_at`)
  return found.map((row) => ({
    id: Number(row.id),
    userName: String(row.user_name ?? '').trim() || 'Üye',
    email: String(row.email ?? ''),
    taskTitle: String(row.task_title ?? ''),
    createdAt: new Date(String(row.created_at)).toISOString(),
  }))
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
  const link = cleanLink(input.link)
  const needsApproval = Boolean(input.needsApproval)
  await ensureTasks()
  const active = Boolean(input.active)
  if (input.id != null && input.id !== 0) {
    const id = Number(input.id)
    if (!Number.isInteger(id) || id < 1) throw new Error('Görev bulunamadı.')
    const updated = await rows<{ id: number }>(sql`UPDATE tasks SET
      title = ${title}, detail = ${detail}, points = ${points}, link = ${link}, needs_approval = ${needsApproval}, active = ${active}, sort = ${sort}
      WHERE id = ${id} RETURNING id`)
    if (!updated.length) throw new Error('Görev bulunamadı.')
    return id
  }
  const inserted = await rows<{ id: number }>(sql`INSERT INTO tasks (title, detail, points, link, needs_approval, active, sort)
    VALUES (${title}, ${detail}, ${points}, ${link}, ${needsApproval}, ${active}, ${sort}) RETURNING id`)
  return Number(inserted[0]?.id)
}

/** Writes one kp_events row and, only then, the visible coin balance. A repeat inserts nothing. */
export async function awardTask(userId: string, taskId: number): Promise<{ awarded: boolean; points: number; balance: number }> {
  await ensureTasks()
  await ensureKp()
  const found = await rows<{ id: number; points: number }>(sql`SELECT id, points FROM tasks WHERE id = ${taskId} AND active`)
  const task = found[0]
  if (!task) throw new Error('Görev bulunamadı.')
  const points = Math.trunc(Number(task.points))
  const ref = String(task.id)
  const inserted = await rows<{ id: number }>(sql`INSERT INTO kp_events (user_id, source, points, ref)
    VALUES (${userId}, 'gorev', ${points}, ${ref})
    ON CONFLICT DO NOTHING
    RETURNING id`)
  const awarded = inserted.length > 0
  if (awarded) await credit(userId, points)
  return { awarded, points, balance: await getBalance(userId) }
}

export async function requestTaskApproval(userId: string, taskId: number): Promise<{ status: ClaimStatus; points: number }> {
  await ensureTasks()
  const found = await rows<{ id: number; points: number }>(sql`SELECT id, points FROM tasks WHERE id = ${taskId} AND active AND needs_approval`)
  const task = found[0]
  if (!task) throw new Error('Görev bulunamadı.')
  const inserted = await rows<{ id: number }>(sql`INSERT INTO task_claims (user_id, task_id, status)
    VALUES (${userId}, ${task.id}, 'beklemede')
    ON CONFLICT (user_id, task_id) DO NOTHING
    RETURNING id`)
  if (inserted.length > 0) return { status: 'beklemede', points: Number(task.points) }
  const existing = await rows<{ status: string }>(sql`SELECT status FROM task_claims WHERE user_id = ${userId} AND task_id = ${task.id}`)
  const status = existing[0]?.status
  if (status === 'beklemede' || status === 'onaylandi' || status === 'reddedildi') return { status, points: Number(task.points) }
  throw new Error('Görev talebi kaydedilemedi.')
}

export async function approveClaim(claimId: number): Promise<{ awarded: boolean; points: number }> {
  await ensureTasks()
  const found = await rows<{ id: number; user_id: string; task_id: number; status: string }>(sql`SELECT id, user_id, task_id, status FROM task_claims WHERE id = ${claimId}`)
  const claim = found[0]
  if (!claim || claim.status !== 'beklemede') throw new Error('Talep bulunamadı.')
  const result = await awardTask(String(claim.user_id), Number(claim.task_id))
  await rows(sql`UPDATE task_claims SET status = 'onaylandi' WHERE id = ${claim.id} AND status = 'beklemede'`)
  return { awarded: result.awarded, points: result.points }
}

export async function rejectClaim(claimId: number): Promise<void> {
  await ensureTasks()
  const updated = await rows<{ id: number }>(sql`UPDATE task_claims SET status = 'reddedildi' WHERE id = ${claimId} AND status = 'beklemede' RETURNING id`)
  if (!updated.length) throw new Error('Talep bulunamadı.')
}
