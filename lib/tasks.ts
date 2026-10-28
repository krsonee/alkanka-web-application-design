import 'server-only'
import { rows, sql } from '@/lib/db'
import { ensureKp } from '@/lib/kanka-puan'
import { credit, getBalance } from '@/lib/member'
import { isPeriod, periodFromKey, periodKey, periodStart, type TaskPeriod } from '@/lib/task-period'
import { isAutoKind, isCategory, isTaskKind, KIND_META, TASK_GAMES, TASK_PLATFORMS, type TaskCategory, type TaskKind } from '@/lib/task-kinds'

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
  category: TaskCategory
  /** Daily/weekly pool tasks rotate: each member sees a few per period. */
  pool: boolean
  chain: string | null
  chainStep: number
  /** Badge id granted (once per period) when the task is completed. */
  badge: string | null
  /** Max members who can complete it per period (e.g. "İlk 100 Kanka"); 0 = unlimited. */
  cap: number
}

export const DAILY_PICKS = 5
export const WEEKLY_PICKS = 4

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
  category?: TaskCategory
  pool?: boolean
  chain?: string
  chainStep?: number
  badge?: string
  cap?: number
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
    await rows(sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'genel'`)
    await rows(sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS pool boolean NOT NULL DEFAULT false`)
    await rows(sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS chain text`)
    await rows(sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS chain_step int NOT NULL DEFAULT 0`)
    await rows(sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS badge text`)
    await rows(sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS cap int NOT NULL DEFAULT 0`)
    await rows(sql`CREATE TABLE IF NOT EXISTS trust_helpful (
      user_id text NOT NULL, review_id int NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, review_id))`)
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
    category: isCategory(row.category) ? row.category : 'genel',
    pool: Boolean(row.pool),
    chain: row.chain ? String(row.chain) : null,
    chainStep: Number(row.chain_step ?? 0) || 0,
    badge: row.badge ? String(row.badge) : null,
    cap: Math.max(0, Number(row.cap ?? 0) || 0),
  }
}

export async function listTasks(): Promise<TaskRecord[]> {
  await ensureTasks()
  await seedSocialTasks().catch((error) => console.error('[tasks] social seed', (error as Error).message))
  await seedAppTask().catch((error) => console.error('[tasks] app seed', (error as Error).message))
  await seedTaskPack().catch((error) => console.error('[tasks] pack seed', (error as Error).message))
  const found = await rows(sql`SELECT id, title, detail, points, link, needs_approval, active, sort, period, starts_at, ends_at, kind, target, param,
    category, pool, chain, chain_step, badge, cap FROM tasks ORDER BY sort, id`)
  return found.map(mapTask)
}

export async function listPublicTasks(): Promise<TaskRecord[]> {
  const now = Date.now()
  const live = (await listTasks()).filter((task) =>
    task.active && (!task.startsAt || Date.parse(task.startsAt) <= now) && (!task.endsAt || Date.parse(task.endsAt) > now))
  if (!live.some((t) => t.kind === 'social_follow' && !t.link)) return live
  const official = await officialSocialLinks()
  return live.map((t) => (t.kind === 'social_follow' && !t.link && t.param ? { ...t, link: official[t.param] ?? null } : t))
}

/** Stable per-member shuffle so the picked pool tasks don't change on refresh within a period. */
function hashOf(text: string) {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return h >>> 0
}

function pickPool(tasks: TaskRecord[], seed: string, count: number) {
  return [...tasks].sort((a, b) => hashOf(`${seed}:${a.id}`) - hashOf(`${seed}:${b.id}`)).slice(0, count)
}

export type ChainState = 'done' | 'current' | 'locked'

/**
 * What a member actually sees: rotated daily/weekly pools (5 / 4 picks), all non-pool tasks,
 * and chain steps tagged done/current/locked. Guests get the rotation seeded by "misafir".
 */
export function visibleTasksFor(userId: string | null, tasks: TaskRecord[], doneIds: Set<number>) {
  const seed = userId ?? 'misafir'
  const out: TaskRecord[] = []
  for (const period of ['daily', 'weekly'] as const) {
    const pool = tasks.filter((t) => t.pool && t.period === period && !t.chain)
    out.push(...pickPool(pool, `${seed}:${periodKey(period)}`, period === 'daily' ? DAILY_PICKS : WEEKLY_PICKS))
  }
  out.push(...tasks.filter((t) => !t.pool && !t.chain))
  const chainState: Record<number, ChainState> = {}
  const chains = new Map<string, TaskRecord[]>()
  for (const t of tasks) if (t.chain) chains.set(t.chain, [...(chains.get(t.chain) ?? []), t])
  for (const steps of chains.values()) {
    steps.sort((a, b) => a.chainStep - b.chainStep)
    let open = true
    for (const step of steps) {
      if (doneIds.has(step.id)) chainState[step.id] = 'done'
      else if (open) {
        chainState[step.id] = 'current'
        open = false
      } else chainState[step.id] = 'locked'
      out.push(step)
    }
  }
  return { tasks: out, chainState }
}

async function memberView(userId: string) {
  const [all, done] = await Promise.all([listPublicTasks(), completedTaskIds(userId)])
  return { all, done: new Set(done), ...visibleTasksFor(userId, all, new Set(done)) }
}

/** Visible tasks of the same period, excluding super tasks and chain steps. */
function bundleSiblings(task: TaskRecord, visible: TaskRecord[]) {
  return visible.filter((t) => t.id !== task.id && t.period === task.period && t.kind !== 'bundle' && !t.chain && t.category === task.category)
}

export function bundleTarget(task: TaskRecord, visible: TaskRecord[]) {
  return Math.max(1, bundleSiblings(task, visible).length)
}

/** Server-side guard: a member can only claim tasks they can see, and chain steps in order. */
export async function canClaim(userId: string, taskId: number): Promise<{ ok: true; task: TaskRecord; visible: TaskRecord[] } | { ok: false; error: string }> {
  const view = await memberView(userId)
  const task = view.tasks.find((t) => t.id === taskId)
  if (!task) return { ok: false, error: 'Bu görev bugün sende yok.' }
  if (task.chain && view.chainState[task.id] === 'locked') return { ok: false, error: 'Önce zincirdeki önceki adımı bitir.' }
  return { ok: true, task, visible: view.tasks }
}

/** Follow tasks point at the panel-managed official profile unless the task sets its own link. */
export async function officialSocialLinks(): Promise<Record<string, string>> {
  const { getSocialLinks } = await import('@/lib/social')
  return (await getSocialLinks().catch(() => ({}))) as Record<string, string>
}

const SOCIAL_SEED_KEY = 'tasks:social-seed-v1'
type Seed = { title: string; detail: string; kind: TaskKind; param: string; points: number; active: boolean }
const SOCIAL_SEED: Seed[] = [
  { title: 'Instagram hesabını bağla', detail: 'Profilinden Instagram hesabını bağla ve doğrulat.', kind: 'social_link', param: 'instagram', points: 50, active: true },
  { title: 'X hesabını bağla', detail: 'Profilinden X (Twitter) hesabını bağla ve doğrulat.', kind: 'social_link', param: 'x', points: 50, active: true },
  { title: 'Twitch hesabını bağla', detail: 'Profilinden Twitch hesabını bağla ve doğrulat.', kind: 'social_link', param: 'twitch', points: 50, active: true },
  { title: 'YouTube hesabını bağla', detail: 'Profilinden YouTube kanalını bağla ve doğrulat.', kind: 'social_link', param: 'youtube', points: 50, active: true },
  { title: 'Instagram hesabımızı takip et', detail: 'Bağladığın Instagram hesabıyla bizi takip et.', kind: 'social_follow', param: 'instagram', points: 30, active: true },
  { title: 'X hesabımızı takip et', detail: 'Bağladığın X hesabıyla bizi takip et.', kind: 'social_follow', param: 'x', points: 30, active: true },
  { title: 'YouTube kanalımıza abone ol', detail: 'Bağladığın YouTube hesabıyla kanalımıza abone ol.', kind: 'social_follow', param: 'youtube', points: 30, active: true },
  { title: 'Twitch kanalımızı takip et', detail: 'Bağladığın Twitch hesabıyla kanalımızı takip et.', kind: 'social_follow', param: 'twitch', points: 30, active: true },
  { title: 'Instagram paylaşımımızı beğen', detail: 'Bağladığın Instagram hesabıyla paylaşımı beğen.', kind: 'social_like', param: 'instagram', points: 15, active: false },
  { title: 'X paylaşımımızı beğen', detail: 'Bağladığın X hesabıyla paylaşımı beğen.', kind: 'social_like', param: 'x', points: 15, active: false },
  { title: 'YouTube videomuzu beğen', detail: 'Bağladığın YouTube hesabıyla videoyu beğen.', kind: 'social_like', param: 'youtube', points: 15, active: false },
]

/** One-time starter set; like tasks start inactive until a post link is added in the panel. */
export async function seedSocialTasks() {
  const { getContent, setContent } = await import('@/lib/content')
  if (await getContent(SOCIAL_SEED_KEY).catch(() => null)) return
  await ensureTasks()
  for (const [i, s] of SOCIAL_SEED.entries()) {
    await rows(sql`INSERT INTO tasks (title, detail, points, link, needs_approval, active, sort, period, kind, target, param)
      SELECT ${s.title}, ${s.detail}, ${s.points}, NULL, false, ${s.active}, ${200 + i}, 'once', ${s.kind}, 1, ${s.param}
      WHERE NOT EXISTS (SELECT 1 FROM tasks WHERE kind = ${s.kind} AND param = ${s.param})`)
  }
  await setContent(SOCIAL_SEED_KEY, { at: new Date().toISOString() })
}

const APP_SEED_KEY = 'tasks:app-seed-v1'

/** Daily app-only task: opening Alkanka from the home-screen app pays extra. */
export async function seedAppTask() {
  const { getContent, setContent } = await import('@/lib/content')
  if (await getContent(APP_SEED_KEY).catch(() => null)) return
  await ensureTasks()
  await (await import('@/lib/mobile')).ensureMobile()
  await rows(sql`INSERT INTO tasks (title, detail, points, link, needs_approval, active, sort, period, kind, target, param)
    SELECT 'Cepten gir kanka', 'Bugün Alkanka’yı ana ekrandaki uygulamadan aç, ekstra puanı kap.', 25, '/uygulama', false, true, 5, 'daily', 'app_login', 1, NULL
    WHERE NOT EXISTS (SELECT 1 FROM tasks WHERE kind = 'app_login')`)
  await setContent(APP_SEED_KEY, { at: new Date().toISOString() })
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
  if ((kind === 'social_follow' || kind === 'social_like') && !param) throw new Error('Sosyal görev için platform seç.')
  if (kind === 'social_like') {
    if (param === 'twitch') throw new Error('Twitch’te beğeni yok; takip görevi kullan.')
    if (!link) throw new Error('Beğeni görevi için gönderi linkini yapıştır.')
    const { isPlatformUrl } = await import('@/lib/social-shared')
    if (!isPlatformUrl(param as 'x', link)) throw new Error('Gönderi linki seçilen platforma ait değil.')
  }
  if (kind === 'secret_code' && (!param || param.length < 3)) throw new Error('Gizli kod en az 3 karakter olmalı.')
  const approval = isAutoKind(kind) ? false : needsApproval
  await ensureTasks()
  const active = Boolean(input.active)
  const category = input.category === undefined ? null : isCategory(input.category) ? input.category : 'genel'
  const pool = input.pool === undefined ? null : Boolean(input.pool)
  const chain = input.chain === undefined ? undefined : clip(input.chain, 30) || null
  const chainStep = input.chainStep === undefined ? null : Math.max(0, Math.trunc(Number(input.chainStep) || 0))
  const badge = input.badge === undefined ? undefined : clip(input.badge, 40) || null
  const cap = input.cap === undefined ? null : Math.max(0, Math.min(100000, Math.trunc(Number(input.cap) || 0)))
  const keepChain = chain === undefined
  const keepBadge = badge === undefined
  if (input.id != null && input.id !== 0) {
    const id = Number(input.id)
    if (!Number.isInteger(id) || id < 1) throw new Error('Görev bulunamadı.')
    const updated = await rows<{ id: number }>(sql`UPDATE tasks SET
      title = ${title}, detail = ${detail}, points = ${points}, link = ${link}, needs_approval = ${approval}, active = ${active}, sort = ${sort},
      period = ${period}, starts_at = ${startsAt}, ends_at = ${endsAt}, kind = ${kind}, target = ${target}, param = ${param},
      category = COALESCE(${category}::text, category), pool = COALESCE(${pool}::boolean, pool),
      chain = CASE WHEN ${keepChain}::boolean THEN chain ELSE ${chain ?? null}::text END,
      chain_step = COALESCE(${chainStep}::int, chain_step),
      badge = CASE WHEN ${keepBadge}::boolean THEN badge ELSE ${badge ?? null}::text END,
      cap = COALESCE(${cap}::int, cap)
      WHERE id = ${id} RETURNING id`)
    if (!updated.length) throw new Error('Görev bulunamadı.')
    return id
  }
  const inserted = await rows<{ id: number }>(sql`INSERT INTO tasks (title, detail, points, link, needs_approval, active, sort, period, starts_at, ends_at, kind, target, param, category, pool, chain, chain_step, badge, cap)
    VALUES (${title}, ${detail}, ${points}, ${link}, ${approval}, ${active}, ${sort}, ${period}, ${startsAt}, ${endsAt}, ${kind}, ${target}, ${param},
      ${category ?? 'genel'}, ${pool ?? false}, ${chain ?? null}, ${chainStep ?? 0}, ${badge ?? null}, ${cap ?? 0}) RETURNING id`)
  return Number(inserted[0]?.id)
}

/** Writes one kp_events row and, only then, the visible coin balance. A repeat inserts nothing. */
export async function awardTask(userId: string, taskId: number, claimKey?: string): Promise<{ awarded: boolean; points: number; balance: number }> {
  await ensureTasks()
  await ensureKp()
  const found = await rows<{ id: number; points: number; period: string; kind: string; badge: string | null; cap: number; title: string }>(
    sql`SELECT id, points, period, kind, badge, cap, title FROM tasks WHERE id = ${taskId} AND active`)
  const task = found[0]
  if (!task) throw new Error('Görev bulunamadı.')
  const period = isPeriod(task.period) ? task.period : 'once'
  const key = claimKey || periodKey(period)
  const ref = taskRef(Number(task.id), period, claimKey || undefined)
  const cap = Number(task.cap) || 0
  if (cap > 0) {
    const [{ n }] = await rows<{ n: string }>(sql`SELECT count(*) AS n FROM kp_events WHERE source = 'gorev' AND ref = ${ref} AND user_id <> ${userId}`)
    if (Number(n) >= cap) throw new Error(`Kontenjan doldu: ilk ${cap} kanka ödülü kaptı.`)
  }
  const base = Math.trunc(Number(task.points))
  const { boosted } = await import('@/lib/boosts')
  const points = await boosted('gorev', task.kind === 'bundle' && period === 'daily' ? base + (hashOf(`${userId}:${ref}`) % (base + 1)) : base)
  const inserted = await rows<{ id: number }>(sql`INSERT INTO kp_events (user_id, source, points, ref)
    VALUES (${userId}, 'gorev', ${points}, ${ref})
    ON CONFLICT DO NOTHING
    RETURNING id`)
  const awarded = inserted.length > 0
  if (awarded) {
    await credit(userId, points)
    if (task.badge) {
      const { awardBadge } = await import('@/lib/kanka-puan')
      await awardBadge(task.badge, userId, key || 'tek', task.title).catch((error) => console.error('[tasks] badge', (error as Error).message))
    }
  }
  return { awarded, points, balance: await getBalance(userId) }
}

/** `review` queues auto tasks too (social checks the platform API can't confirm). */
export async function requestTaskApproval(userId: string, taskId: number, userName = 'Üye', review = false): Promise<{ status: ClaimStatus; points: number }> {
  await ensureTasks()
  const found = await rows<{ id: number; points: number; period: string; title: string }>(sql`SELECT id, points, period, title FROM tasks WHERE id = ${taskId} AND active AND (needs_approval OR ${review}::boolean)`)
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
      const arena = await count(sql`SELECT count(*) AS n FROM game_history WHERE user_id = ${userId} AND created_at >= ${since}
        AND mode NOT IN ('odul', 'harcama', 'admin') AND result <> 'refund'
        AND (${win}::boolean IS FALSE OR result = 'win') AND (${p}::text IS NULL OR game = ${p})`)
      // Çember / Kara Delik / Survival rounds only reach game_history as prize rows, so count joined rounds directly.
      const events = await count(sql`SELECT count(*) AS n FROM cember_rounds WHERE slot >= ${since} AND slot <= now()
        AND (${p}::text IS NULL OR game = ${p})
        AND participants @> jsonb_build_array(jsonb_build_object('id', ${userId}::text))
        AND (${win}::boolean IS FALSE OR winner_id = ${userId}
          OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(winner_indexes) w WHERE participants -> (w::int) ->> 'id' = ${userId}))`)
      return arena + events
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
    case 'social_follow':
    case 'social_like': {
      const { socialCheckCount } = await import('@/lib/social-verify')
      return socialCheckCount(userId, task.id).catch(() => 0)
    }
    case 'telegram_link':
      return count(sql`SELECT count(*) AS n FROM tg_links WHERE user_id = ${userId}`)
    case 'tv_watch':
      return count(sql`SELECT count(*) AS n FROM tv_watch_ticks WHERE user_id = ${userId} AND minute >= ${since}`)
    case 'tv_predict':
      return count(sql`SELECT count(*) AS n FROM tv_predictions WHERE user_id = ${userId} AND status = 'won' AND settled_at >= ${since}`)
    case 'games_distinct':
      return count(sql`SELECT count(DISTINCT game) AS n FROM game_history WHERE user_id = ${userId} AND created_at >= ${since}
        AND mode NOT IN ('odul', 'harcama', 'admin') AND result <> 'refund' AND game <> 'cember'`)
    case 'invite_active':
      return count(sql`SELECT count(*) AS n FROM referrals r WHERE r.referrer_id = ${userId} AND r.created_at >= ${since}
        AND EXISTS (SELECT 1 FROM game_history g WHERE g.user_id = r.referred_id AND g.mode NOT IN ('odul', 'harcama', 'admin'))`)
    case 'tg_comment':
      return count(sql`SELECT count(*) AS n FROM tg_channel_comments WHERE user_id = ${userId} AND created_at >= ${since}`)
    case 'tg_active_days':
      return count(sql`SELECT count(DISTINCT d) AS n FROM (
        SELECT (created_at AT TIME ZONE 'Europe/Istanbul')::date AS d FROM tg_chat_messages WHERE user_id = ${userId} AND origin = 'telegram' AND created_at >= ${since}
        UNION SELECT (created_at AT TIME ZONE 'Europe/Istanbul')::date FROM tg_channel_comments WHERE user_id = ${userId} AND created_at >= ${since}) x`)
    case 'predict':
      return count(sql`SELECT count(*) AS n FROM league_picks WHERE user_id = ${userId} AND created_at >= ${since}`)
    case 'predict_correct':
      return count(sql`SELECT count(*) AS n FROM league_picks WHERE user_id = ${userId} AND created_at >= ${since} AND points > 0`)
    case 'chat_message':
      return count(sql`SELECT count(*) AS n FROM tg_chat_messages WHERE user_id = ${userId} AND origin = 'site' AND created_at >= ${since}`)
    case 'cember_join':
      return count(sql`SELECT count(*) AS n FROM kp_events WHERE user_id = ${userId} AND source = 'cember' AND created_at >= ${since}`)
    case 'table_invite':
      return count(sql`SELECT count(*) AS n FROM tg_table_invites WHERE user_id = ${userId} AND sent_at >= ${since}`)
    case 'trust_review':
      return count(sql`SELECT count(*) AS n FROM site_reviews WHERE user_id = ${userId} AND status = 'approved' AND created_at >= ${since}`)
    case 'trust_helpful':
      return count(sql`SELECT count(*) AS n FROM trust_helpful WHERE user_id = ${userId} AND created_at >= ${since}`)
    case 'login_days':
      return count(sql`SELECT count(DISTINCT ref) AS n FROM kp_events WHERE user_id = ${userId} AND source = 'giris' AND created_at >= ${since}`)
    case 'app_login':
      return count(sql`SELECT count(*) AS n FROM app_opens WHERE user_id = ${userId} AND day >= (${since}::timestamptz AT TIME ZONE 'Europe/Istanbul')::date`)
    case 'tournament_join':
      return count(sql`SELECT count(*) AS n FROM tournament_entries WHERE user_id = ${userId} AND created_at >= ${since}`)
    case 'profile':
      return count(sql`SELECT count(*) AS n FROM member_look WHERE user_id = ${userId} AND (avatar_id IS NOT NULL OR cover_id IS NOT NULL OR team IS NOT NULL)`)
    case 'secret_code':
      return 0
    case 'bundle': {
      const view = await memberView(userId)
      const siblings = bundleSiblings(task, view.tasks)
      return siblings.filter((t) => view.done.has(t.id)).length
    }
  }
}

export async function taskProgressMap(userId: string, tasks: TaskRecord[]): Promise<Record<number, number>> {
  const auto = tasks.filter((t) => t.kind !== 'manual' && t.kind !== 'secret_code')
  const values = await Promise.all(auto.map((t) => taskProgress(userId, t).catch(() => 0)))
  return Object.fromEntries(auto.map((t, i) => [t.id, Math.min(values[i], t.kind === 'bundle' ? Infinity : t.target)]))
}

/** Normalised compare so "ALK-2026", "alk 2026" and "alk2026" all match. */
export function codeMatches(expected: string | null, given: string) {
  const norm = (v: string) => v.toLocaleUpperCase('tr-TR').replace(/[^A-Z0-9ÇĞİÖŞÜ]/g, '')
  return Boolean(expected) && norm(String(expected)) === norm(given) && norm(given).length >= 3
}

/** A6: monthly top inviters by active referrals (referred member played at least once). */
export async function inviteLeague(limit = 10): Promise<{ userId: string; name: string; count: number }[]> {
  const since = periodStart('monthly')?.toISOString() ?? new Date(0).toISOString()
  const found = await rows<{ user_id: string; name: string | null; n: string }>(sql`SELECT r.referrer_id AS user_id, u.name, count(*) AS n
    FROM referrals r LEFT JOIN public."user" u ON u.id = r.referrer_id
    WHERE r.created_at >= ${since}
      AND EXISTS (SELECT 1 FROM game_history g WHERE g.user_id = r.referred_id AND g.mode NOT IN ('odul', 'harcama', 'admin'))
    GROUP BY r.referrer_id, u.name ORDER BY count(*) DESC, min(r.created_at) LIMIT ${limit}`).catch(() => [])
  return found.map((r) => ({ userId: String(r.user_id), name: String(r.name ?? '').trim() || 'Kanka', count: Number(r.n) }))
}

const PACK_SEED_KEY = 'tasks:pack-v2'

type PackSeed = {
  title: string
  detail: string
  kind: TaskKind
  period: TaskPeriod
  points: number
  target?: number
  param?: string
  category?: TaskCategory
  pool?: boolean
  chain?: string
  chainStep?: number
  badge?: string
  approval?: boolean
  active?: boolean
}

const PACK_BADGES = [
  { id: 'haftanin-kurdu', name: 'Haftanın Kurdu', description: 'Haftanın tüm görevlerini bitirdi.', icon: 'flame', tier: 'altin', bonus: 0 },
  { id: 'aylik-sadik', name: 'Aylık Sadık', description: 'Bir ayda 25 gün giriş yaptı.', icon: 'calendar-check', tier: 'altin', bonus: 0 },
  { id: 'cok-yonlu', name: 'Çok Yönlü', description: 'Bir ayda 5 farklı oyun oynadı.', icon: 'gamepad-2', tier: 'altin', bonus: 0 },
  { id: 'ayin-yorumcusu', name: 'Ayın Yorumcusu', description: 'Güven Merkezi’nde 3 doğrulanmış yorum.', icon: 'message-square', tier: 'elmas', bonus: 0 },
  { id: 'yolcu', name: 'Yolcu', description: 'Yeni Üye Yolculuğu’nu baştan sona bitirdi.', icon: 'map', tier: 'altin', bonus: 0 },
  { id: 'sezon-kahramani', name: 'Sezon Kahramanı', description: 'Sezon Hikâyesi’nin 4 bölümünü tamamladı.', icon: 'crown', tier: 'efsane', bonus: 0 },
]

/** KP/Coin balance rule: sponsor tasks pay mostly Coin with modest points so badge pace stays intact. */
const PACK: PackSeed[] = [
  { title: 'Günaydın Kanka', detail: 'Bugün giriş ödülünü al, seriyi büyüt.', kind: 'login_days', period: 'daily', points: 15, pool: true },
  { title: '3 maç tahmini yap', detail: 'Tahminler sayfasında 3 maça skor tahmini gir.', kind: 'predict', period: 'daily', points: 25, target: 3, pool: true },
  { title: 'KankaTV’de 15 dk izle', detail: 'Yayın açıkken 15 dakika izle.', kind: 'tv_watch', period: 'daily', points: 25, target: 15, pool: true },
  { title: 'Arenada 3 oyun oyna', detail: 'Herhangi bir oyunda 3 maç bitir.', kind: 'game_play', period: 'daily', points: 25, target: 3, pool: true },
  { title: 'Sohbete 5 mesaj yaz', detail: 'Site sohbetinde kankalarla 5 mesaj yaz.', kind: 'chat_message', period: 'daily', points: 15, target: 5, pool: true },
  { title: 'Telegram gönderisine yorum yap', detail: 'Kanalda günün gönderisinin altına bağlı hesabınla yorum bırak.', kind: 'tg_comment', period: 'daily', points: 20, category: 'sosyal', pool: true },
  { title: 'Günün bonusuna göz at', detail: 'Bir sponsorun günün bonusuna “Git” butonuyla bak.', kind: 'sponsor_visit', period: 'daily', points: 15, category: 'sponsor', pool: true },
  { title: 'Jako Çemberi’ne katıl', detail: 'Bugünkü Çember seanslarından birine katıl.', kind: 'cember_join', period: 'daily', points: 20, pool: true },
  { title: 'Arkadaşına masa daveti gönder', detail: 'Bir masaya otur, "Oyuncu davet et" butonuyla Telegram kanalına davet gönder.', kind: 'table_invite', period: 'daily', points: 15, pool: true },
  { title: 'Başka bir yorumu faydalı bul', detail: 'Güven Merkezi’nde başka bir üyenin yorumundaki “Faydalı” butonuna bas. Kendi yorumun sayılmaz.', kind: 'trust_helpful', period: 'daily', points: 10, pool: true },
  { title: 'Günün Kankası sandığı', detail: 'Günün 5 görevini bitir, rastgele Coin sandığını aç.', kind: 'bundle', period: 'daily', points: 60 },

  { title: '7 gün seri giriş', detail: 'Bu hafta 7 gün giriş ödülünü al.', kind: 'login_days', period: 'weekly', points: 120, target: 7, pool: true },
  { title: '20 tahmin yap', detail: 'Bu hafta 20 maç tahmini yap.', kind: 'predict', period: 'weekly', points: 80, target: 20, pool: true },
  { title: '8 tahmin tuttur', detail: 'Bu hafta en az 8 tahminin puan alsın.', kind: 'predict_correct', period: 'weekly', points: 120, target: 8, pool: true },
  { title: 'KankaTV’de 2 saat izle', detail: 'Hafta boyunca toplam 120 dakika izle.', kind: 'tv_watch', period: 'weekly', points: 120, target: 120, pool: true },
  { title: 'Blackjack’te 3 el kazan', detail: 'Blackjack masasında 3 el kazan.', kind: 'game_win', period: 'weekly', points: 80, target: 3, param: 'blackjack', pool: true },
  { title: 'Rulette 10 tur oyna', detail: 'Rulet masasında 10 tur oyna.', kind: 'game_play', period: 'weekly', points: 70, target: 10, param: 'rulet', pool: true },
  { title: 'Bir turnuvaya katıl', detail: 'Bu hafta bir turnuvaya kayıt ol. Turnuva ödülü ayrıca verilir.', kind: 'tournament_join', period: 'weekly', points: 80, pool: true },
  { title: '2 aktif davet getir', detail: 'Davet ettiğin 2 kişi ilk oyununu oynasın.', kind: 'invite_active', period: 'weekly', points: 200, target: 2, pool: true },
  { title: 'Telegram’da 3 gün aktif ol', detail: 'Sohbet grubunda veya kanal yorumlarında 3 farklı gün yaz.', kind: 'tg_active_days', period: 'weekly', points: 70, target: 3, category: 'sosyal', pool: true },
  { title: 'Bir sponsora kayıt ol', detail: 'Affiliate linkimizle bir sponsora kayıt ol, hesabını profilden bağla.', kind: 'sponsor_link', period: 'weekly', points: 150, category: 'sponsor', pool: true },
  { title: 'Haftanın Kurdu', detail: 'Haftanın 4 görevini bitir: rozet + Coin.', kind: 'bundle', period: 'weekly', points: 300, badge: 'haftanin-kurdu' },

  { title: 'Ayda 25 gün giriş', detail: 'Bu ay 25 farklı gün giriş ödülünü al.', kind: 'login_days', period: 'monthly', points: 400, target: 25, badge: 'aylik-sadik' },
  { title: 'Kâhin: 50 tahmin', detail: 'Bu ay 50 maç tahmini yap.', kind: 'predict', period: 'monthly', points: 150, target: 50 },
  { title: 'Kâhin: 100 tahmin', detail: 'Bu ay 100 maç tahmini yap.', kind: 'predict', period: 'monthly', points: 300, target: 100, badge: 'kahin' },
  { title: 'Kâhin: 150 tahmin', detail: 'Bu ay 150 maç tahmini yap.', kind: 'predict', period: 'monthly', points: 450, target: 150 },
  { title: 'Çok Yönlü', detail: 'Bu ay arenada 5 farklı oyun oyna.', kind: 'games_distinct', period: 'monthly', points: 250, target: 5, badge: 'cok-yonlu' },
  { title: '3 sponsorda aktif ol', detail: '3 farklı sponsorda hesabını bağla ve onaylat.', kind: 'sponsor_link', period: 'monthly', points: 600, target: 3, category: 'sponsor' },
  { title: 'Ayın Yorumcusu', detail: 'Güven Merkezi’nde 3 onaylı yorum yaz.', kind: 'trust_review', period: 'monthly', points: 250, target: 3, badge: 'ayin-yorumcusu' },

  { title: 'Telegram kanal + sohbetimize katıl', detail: 't.me/alkankaresmi ve t.me/alkankachat. Katıl ve Telegram hesabını bağla.', kind: 'telegram_link', period: 'once', points: 100, category: 'sosyal' },
  { title: 'Story’de Alkanka’yı etiketle', detail: 'Story’de bizi etiketle, linkini/ekran görüntüsünü panele gönder.', kind: 'manual', period: 'weekly', points: 60, category: 'sosyal', approval: true },
  { title: 'Telegram Gizli Kod', detail: 'Kanalda gün içinde paylaşılan gizli kodu buraya gir.', kind: 'secret_code', period: 'daily', points: 40, param: 'ALKANKA', category: 'sosyal', active: false },
  { title: '7 gün Telegram serisi', detail: 'Bu hafta 7 farklı gün kanalda/sohbette aktif ol.', kind: 'tg_active_days', period: 'weekly', points: 150, target: 7, category: 'sosyal' },

  { title: 'İlk yatırım: Çifte Ödül', detail: 'Sponsorda ilk yatırımını yap, kullanıcı adını yaz; sponsor bonusu + Alkanka ödülü.', kind: 'manual', period: 'once', points: 300, category: 'sponsor', approval: true },
  { title: 'Sponsorun haftalık etkinliğine katıl', detail: 'Sponsorun bu haftaki etkinliğine katıl, panel onaylar.', kind: 'manual', period: 'weekly', points: 80, category: 'sponsor', approval: true },

  { title: 'Profilini tamamla', detail: 'Avatar, kapak veya takımını seç.', kind: 'profile', period: 'once', points: 20, chain: 'yolcu', chainStep: 1, category: 'zincir' },
  { title: 'Telegram’ı bağla', detail: 'Profilden Telegram hesabını bağla.', kind: 'telegram_link', period: 'once', points: 30, chain: 'yolcu', chainStep: 2, category: 'zincir' },
  { title: 'İlk tahminini yap', detail: 'Bir maça skor tahmini gir.', kind: 'predict', period: 'once', points: 20, chain: 'yolcu', chainStep: 3, category: 'zincir' },
  { title: 'İlk oyununu oyna', detail: 'Arenada bir maç bitir.', kind: 'game_play', period: 'once', points: 20, chain: 'yolcu', chainStep: 4, category: 'zincir' },
  { title: 'KankaTV’de 10 dk izle', detail: 'Yayını 10 dakika izle.', kind: 'tv_watch', period: 'once', points: 20, target: 10, chain: 'yolcu', chainStep: 5, category: 'zincir' },
  { title: 'İlk sponsorunu bağla', detail: 'Bir sponsor hesabını bağla ve onaylat.', kind: 'sponsor_link', period: 'once', points: 60, chain: 'yolcu', chainStep: 6, category: 'zincir' },
  { title: 'Bir kanka davet et', detail: 'Davet linkinle bir arkadaşın kayıt olsun. Bitirince “Yolcu” rozeti.', kind: 'invite', period: 'once', points: 80, chain: 'yolcu', chainStep: 7, category: 'zincir', badge: 'yolcu' },

  { title: 'Sezon 1. Bölüm: Isınma', detail: '15 maç oyna.', kind: 'game_play', period: 'once', points: 100, target: 15, chain: 'sezon', chainStep: 1, category: 'zincir' },
  { title: 'Sezon 2. Bölüm: Kâhinlik', detail: '30 maç tahmini yap.', kind: 'predict', period: 'once', points: 150, target: 30, chain: 'sezon', chainStep: 2, category: 'zincir' },
  { title: 'Sezon 3. Bölüm: Ekran Başı', detail: 'KankaTV’de toplam 3 saat izle.', kind: 'tv_watch', period: 'once', points: 200, target: 180, chain: 'sezon', chainStep: 3, category: 'zincir' },
  { title: 'Sezon 4. Bölüm: Ekip', detail: '3 aktif davet getir. Bitirince “Sezon Kahramanı” rozeti.', kind: 'invite_active', period: 'once', points: 400, target: 3, chain: 'sezon', chainStep: 4, category: 'zincir', badge: 'sezon-kahramani' },
]

/** One-time pack: badges first, then tasks. Old daily/weekly game tasks become pool so rotation stays at 5 / 4. */
export async function seedTaskPack() {
  const { getContent, setContent } = await import('@/lib/content')
  if (await getContent(PACK_SEED_KEY).catch(() => null)) return
  await ensureTasks()
  await ensureKp()
  for (const [i, b] of PACK_BADGES.entries()) {
    await rows(sql`INSERT INTO kp_badges (id, name, description, icon, tier, bonus, auto, sort)
      VALUES (${b.id}, ${b.name}, ${b.description}, ${b.icon}, ${b.tier}, ${b.bonus}, NULL, ${50 + i}) ON CONFLICT DO NOTHING`)
  }
  await rows(sql`UPDATE tasks SET pool = true WHERE period IN ('daily', 'weekly') AND kind <> 'bundle' AND chain IS NULL`)
  for (const [i, s] of PACK.entries()) {
    await rows(sql`INSERT INTO tasks (title, detail, points, link, needs_approval, active, sort, period, kind, target, param, category, pool, chain, chain_step, badge, cap)
      SELECT ${s.title}, ${s.detail}, ${s.points}, NULL, ${s.approval ?? false}, ${s.active ?? true}, ${300 + i}, ${s.period}, ${s.kind}, ${s.target ?? 1},
        ${s.param ?? null}, ${s.category ?? 'genel'}, ${s.pool ?? false}, ${s.chain ?? null}, ${s.chainStep ?? 0}, ${s.badge ?? null}, 0
      WHERE NOT EXISTS (SELECT 1 FROM tasks WHERE title = ${s.title})`)
  }
  await setContent(PACK_SEED_KEY, { at: new Date().toISOString() })
}
