import 'server-only'
import { rows, sql } from '@/lib/db'
import { ensureKp } from '@/lib/kanka-puan'
import { credit, getBalance } from '@/lib/member'
import { isPeriod, periodFromKey, periodKey, periodStart, type TaskPeriod } from '@/lib/task-period'
import { isAutoKind, isTaskKind, KIND_META, TASK_GAMES, TASK_PLATFORMS, type TaskKind } from '@/lib/task-kinds'

export type TaskRecord = {
  id: number
  title: string
  detail: string
  points: number
  link: string | null
  needsApproval: boolean
  active: boolean
  sort: number
  period: TaskPeriod
  startsAt: string | null
  endsAt: string | null
  kind: TaskKind
  target: number
  param: string | null
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
  period: TaskPeriod
  startsAt: string
  endsAt: string
  kind: TaskKind
  target: number
  param: string
}

function taskRef(id: number, period: TaskPeriod, key = periodKey(period)) {
  return period === 'once' ? String(id) : `${id}:${key}`
}

function isCurrentKey(key: string) {
  return key === '' || key === periodKey(periodFromKey(key))
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
    await rows(sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS period text NOT NULL DEFAULT 'once'`)
    await rows(sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS starts_at timestamptz`)
    await rows(sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS ends_at timestamptz`)
    await rows(sql`ALTER TABLE task_claims ADD COLUMN IF NOT EXISTS period_key text NOT NULL DEFAULT ''`)
    await rows(sql`CREATE UNIQUE INDEX IF NOT EXISTS task_claims_period_uniq ON task_claims (user_id, task_id, period_key)`)
    await rows(sql`ALTER TABLE task_claims DROP CONSTRAINT IF EXISTS task_claims_user_id_task_id_key`)
    await rows(sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'manual'`)
    await rows(sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS target int NOT NULL DEFAULT 1`)
    await rows(sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS param text`)
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
    period: isPeriod(row.period) ? row.period : 'once',
    startsAt: row.starts_at ? new Date(String(row.starts_at)).toISOString() : null,
    endsAt: row.ends_at ? new Date(String(row.ends_at)).toISOString() : null,
    kind: isTaskKind(row.kind) ? row.kind : 'manual',
    target: Math.max(1, Number(row.target ?? 1) || 1),
    param: row.param ? String(row.param) : null,
  }
}

export async function listTasks(): Promise<TaskRecord[]> {
  await ensureTasks()
  const found = await rows(sql`SELECT id, title, detail, points, link, needs_approval, active, sort, period, starts_at, ends_at, kind, target, param FROM tasks ORDER BY sort, id`)
  return found.map(mapTask)
}

export async function listPublicTasks(): Promise<TaskRecord[]> {
  const now = Date.now()
  return (await listTasks()).filter((task) =>
    task.active && (!task.startsAt || Date.parse(task.startsAt) <= now) && (!task.endsAt || Date.parse(task.endsAt) > now))
}

/** Ids done in the current period: one-off refs are plain ids, recurring refs are `id:periodKey`. */
export async function completedTaskIds(userId: string): Promise<number[]> {
  await ensureTasks()
  await ensureKp()
  const found = await rows<{ ref: string }>(sql`SELECT ref FROM kp_events WHERE user_id = ${userId} AND source = 'gorev' AND ref IS NOT NULL`)
  const ids: number[] = []
  for (const { ref } of found) {
    const [id, key = ''] = String(ref).split(':')
    if (Number.isInteger(Number(id)) && isCurrentKey(key)) ids.push(Number(id))
  }
  return ids
}

export async function taskClaimMap(userId: string): Promise<Record<number, ClaimStatus>> {
  await ensureTasks()
  const found = await rows<{ task_id: number; status: string; period_key: string }>(sql`SELECT task_id, status, period_key FROM task_claims WHERE user_id = ${userId}`)
  const map: Record<number, ClaimStatus> = {}
  for (const row of found) {
    if (!isCurrentKey(String(row.period_key ?? ''))) continue
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

/** Panel sends `YYYY-MM-DDTHH:mm` in Turkey time; stored as an absolute timestamp. */
function cleanDate(value: unknown, label: string): string | null {
  const raw = String(value ?? '').trim()
  if (!raw) return null
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw)) throw new Error(`${label} tarihi geçersiz.`)
  const ms = Date.parse(`${raw}:00+03:00`)
  if (!Number.isFinite(ms)) throw new Error(`${label} tarihi geçersiz.`)
  return new Date(ms).toISOString()
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
  if (!isPeriod(input.period)) throw new Error('Tekrar türü geçersiz.')
  const period = input.period
  const startsAt = cleanDate(input.startsAt, 'Başlangıç')
  const endsAt = cleanDate(input.endsAt, 'Bitiş')
  if (startsAt && endsAt && Date.parse(endsAt) <= Date.parse(startsAt)) throw new Error('Bitiş, başlangıçtan sonra olmalı.')
  if (!isTaskKind(input.kind)) throw new Error('Görev türü geçersiz.')
  const kind = input.kind
  const meta = KIND_META[kind]
  const target = meta.counted ? Number(input.target) : 1
  if (!Number.isInteger(target) || target < 1 || target > 1000) throw new Error('Hedef sayı 1 ile 1000 arasında olmalı.')
  const rawParam = clip(input.param, 60)
  const param = !meta.param || !rawParam ? null : rawParam
  if (param && meta.param === 'game' && !TASK_GAMES.some((g) => g.value === param)) throw new Error('Oyun geçersiz.')
  if (param && meta.param === 'platform' && !TASK_PLATFORMS.some((g) => g.value === param)) throw new Error('Platform geçersiz.')
  const approval = isAutoKind(kind) ? false : needsApproval
  await ensureTasks()
  const active = Boolean(input.active)
  if (input.id != null && input.id !== 0) {
    const id = Number(input.id)
    if (!Number.isInteger(id) || id < 1) throw new Error('Görev bulunamadı.')
    const updated = await rows<{ id: number }>(sql`UPDATE tasks SET
      title = ${title}, detail = ${detail}, points = ${points}, link = ${link}, needs_approval = ${approval}, active = ${active}, sort = ${sort},
      period = ${period}, starts_at = ${startsAt}, ends_at = ${endsAt}, kind = ${kind}, target = ${target}, param = ${param}
      WHERE id = ${id} RETURNING id`)
    if (!updated.length) throw new Error('Görev bulunamadı.')
    return id
  }
  const inserted = await rows<{ id: number }>(sql`INSERT INTO tasks (title, detail, points, link, needs_approval, active, sort, period, starts_at, ends_at, kind, target, param)
    VALUES (${title}, ${detail}, ${points}, ${link}, ${approval}, ${active}, ${sort}, ${period}, ${startsAt}, ${endsAt}, ${kind}, ${target}, ${param}) RETURNING id`)
  return Number(inserted[0]?.id)
}

/** Writes one kp_events row and, only then, the visible coin balance. A repeat inserts nothing. */
export async function awardTask(userId: string, taskId: number, claimKey?: string): Promise<{ awarded: boolean; points: number; balance: number }> {
  await ensureTasks()
  await ensureKp()
  const found = await rows<{ id: number; points: number; period: string }>(sql`SELECT id, points, period FROM tasks WHERE id = ${taskId} AND active`)
  const task = found[0]
  if (!task) throw new Error('Görev bulunamadı.')
  const points = Math.trunc(Number(task.points))
  const period = isPeriod(task.period) ? task.period : 'once'
  const ref = taskRef(Number(task.id), period, claimKey || undefined)
  const inserted = await rows<{ id: number }>(sql`INSERT INTO kp_events (user_id, source, points, ref)
    VALUES (${userId}, 'gorev', ${points}, ${ref})
    ON CONFLICT DO NOTHING
    RETURNING id`)
  const awarded = inserted.length > 0
  if (awarded) await credit(userId, points)
  return { awarded, points, balance: await getBalance(userId) }
}

export async function requestTaskApproval(userId: string, taskId: number, userName = 'Üye'): Promise<{ status: ClaimStatus; points: number }> {
  await ensureTasks()
  const found = await rows<{ id: number; points: number; period: string; title: string }>(sql`SELECT id, points, period, title FROM tasks WHERE id = ${taskId} AND active AND needs_approval`)
  const task = found[0]
  if (!task) throw new Error('Görev bulunamadı.')
  const key = periodKey(isPeriod(task.period) ? task.period : 'once')
  const inserted = await rows<{ id: number }>(sql`INSERT INTO task_claims (user_id, task_id, status, period_key)
    VALUES (${userId}, ${task.id}, 'beklemede', ${key})
    ON CONFLICT (user_id, task_id, period_key) DO NOTHING
    RETURNING id`)
  if (inserted.length > 0) {
    const { notifyApproval } = await import('@/lib/telegram-bots')
    await notifyApproval('task', { uye: userName, detay: `${task.title} (+${Number(task.points)} KP)` }).catch(() => {})
    return { status: 'beklemede', points: Number(task.points) }
  }
  const existing = await rows<{ status: string }>(sql`SELECT status FROM task_claims WHERE user_id = ${userId} AND task_id = ${task.id} AND period_key = ${key}`)
  const status = existing[0]?.status
  if (status === 'beklemede' || status === 'onaylandi' || status === 'reddedildi') return { status, points: Number(task.points) }
  throw new Error('Görev talebi kaydedilemedi.')
}

export async function approveClaim(claimId: number): Promise<{ awarded: boolean; points: number }> {
  await ensureTasks()
  const found = await rows<{ id: number; user_id: string; task_id: number; status: string; period_key: string }>(sql`SELECT id, user_id, task_id, status, period_key FROM task_claims WHERE id = ${claimId}`)
  const claim = found[0]
  if (!claim || claim.status !== 'beklemede') throw new Error('Talep bulunamadı.')
  const result = await awardTask(String(claim.user_id), Number(claim.task_id), String(claim.period_key ?? ''))
  await rows(sql`UPDATE task_claims SET status = 'onaylandi' WHERE id = ${claim.id} AND status = 'beklemede'`)
  return { awarded: result.awarded, points: result.points }
}

export async function rejectClaim(claimId: number): Promise<void> {
  await ensureTasks()
  const updated = await rows<{ id: number }>(sql`UPDATE task_claims SET status = 'reddedildi' WHERE id = ${claimId} AND status = 'beklemede' RETURNING id`)
  if (!updated.length) throw new Error('Talep bulunamadı.')
}

/** Counts what the member actually did in the task's current period, straight from the source tables. */
export async function taskProgress(userId: string, task: TaskRecord): Promise<number> {
  if (task.kind === 'manual') return 0
  const start = periodStart(task.period)
  const floor = task.startsAt ? Date.parse(task.startsAt) : 0
  const since = new Date(Math.max(start?.getTime() ?? 0, floor)).toISOString()
  const p = task.param
  const count = async (query: ReturnType<typeof sql>) => Number((await rows<{ n: string }>(query).catch(() => []))[0]?.n ?? 0)
  switch (task.kind) {
    case 'game_play':
    case 'game_win': {
      const win = task.kind === 'game_win'
      return count(sql`SELECT count(*) AS n FROM game_history WHERE user_id = ${userId} AND created_at >= ${since}
        AND mode NOT IN ('odul', 'harcama', 'admin') AND result <> 'refund'
        AND (${win}::boolean IS FALSE OR result = 'win') AND (${p}::text IS NULL OR game = ${p})`)
    }
    case 'sponsor_visit': {
      let siteKey: string | null = null
      if (p) {
        const { activeSiteRecordId } = await import('@/lib/sites')
        siteKey = await activeSiteRecordId(p).catch(() => null)
        if (!siteKey) return 0
      }
      return count(sql`SELECT count(*) AS n FROM link_clicks WHERE user_id = ${userId} AND created_at >= ${since} AND (${siteKey}::text IS NULL OR site_id = ${siteKey})`)
    }
    case 'sponsor_link':
      return count(sql`SELECT count(*) AS n FROM sponsor_accounts WHERE user_id = ${userId} AND status = 'approved' AND (${p}::text IS NULL OR site_id = ${p})`)
    case 'invite':
      return count(sql`SELECT count(*) AS n FROM referrals WHERE referrer_id = ${userId} AND created_at >= ${since}`)
    case 'social_link':
      return count(sql`SELECT count(*) AS n FROM social_accounts WHERE user_id = ${userId} AND status = 'verified' AND (${p}::text IS NULL OR platform = ${p})`)
    case 'telegram_link':
      return count(sql`SELECT count(*) AS n FROM tg_links WHERE user_id = ${userId}`)
    case 'tv_watch':
      return count(sql`SELECT count(*) AS n FROM tv_watch_ticks WHERE user_id = ${userId} AND minute >= ${since}`)
    case 'tv_predict':
      return count(sql`SELECT count(*) AS n FROM tv_predictions WHERE user_id = ${userId} AND status = 'won' AND settled_at >= ${since}`)
  }
}

export async function taskProgressMap(userId: string, tasks: TaskRecord[]): Promise<Record<number, number>> {
  const auto = tasks.filter((t) => t.kind !== 'manual')
  const values = await Promise.all(auto.map((t) => taskProgress(userId, t).catch(() => 0)))
  return Object.fromEntries(auto.map((t, i) => [t.id, Math.min(values[i], t.target)]))
}
