import 'server-only'
import { rows, sql } from '@/lib/db'
import {
  MAX_TEMPLATES,
  OUTBOX_GRACE_MIN,
  OUTBOX_MAX_WAITING,
  type MessageTemplate,
  type OutboxItem,
  type OutboxKind,
  type OutboxStatus,
} from '@/lib/outbox-shared'

let ready: Promise<unknown> | undefined

function ensure() {
  ready ??= (async () => {
    await rows(sql`CREATE TABLE IF NOT EXISTS panel_outbox (
      id serial PRIMARY KEY,
      kind text NOT NULL,
      title text NOT NULL,
      body text NOT NULL,
      url text,
      image_url text,
      user_id text,
      target_label text NOT NULL DEFAULT '',
      send_at timestamptz NOT NULL,
      status text NOT NULL DEFAULT 'waiting',
      created_by text NOT NULL DEFAULT '',
      created_at timestamptz NOT NULL DEFAULT now(),
      started_at timestamptz,
      done_at timestamptz,
      result text NOT NULL DEFAULT ''
    )`)
    await rows(sql`CREATE TABLE IF NOT EXISTS message_templates (
      id serial PRIMARY KEY,
      title text NOT NULL,
      body text NOT NULL,
      url text NOT NULL DEFAULT '',
      created_by text NOT NULL DEFAULT '',
      created_at timestamptz NOT NULL DEFAULT now()
    )`)
  })().catch((error) => {
    ready = undefined
    throw error
  })
  return ready
}

type Row = {
  id: number
  kind: string
  title: string
  body: string
  url: string | null
  image_url: string | null
  user_id: string | null
  target_label: string
  send_at: string
  status: string
  created_by: string
  result: string
  stuck?: boolean
}

const STATUSES: OutboxStatus[] = ['waiting', 'sending', 'sent', 'failed', 'cancelled', 'missed']

const toItem = (r: Row): OutboxItem => ({
  id: Number(r.id),
  kind: r.kind === 'push' ? 'push' : 'message',
  title: r.title,
  body: r.body,
  target: r.target_label,
  sendAt: new Date(r.send_at).toISOString(),
  status: STATUSES.includes(r.status as OutboxStatus) ? (r.status as OutboxStatus) : 'failed',
  stuck: Boolean(r.stuck),
  createdBy: r.created_by,
  result: r.result,
})

/** Waiting sends first (soonest on top), then what finished in the last two weeks. */
export async function listOutbox(kind: OutboxKind): Promise<OutboxItem[]> {
  await ensure()
  const r = await rows<Row>(sql`SELECT *, (status = 'sending' AND started_at < now() - interval '10 minutes') AS stuck
    FROM panel_outbox
    WHERE kind = ${kind} AND (status IN ('waiting', 'sending') OR coalesce(done_at, created_at) > now() - interval '14 days')
    ORDER BY (status = 'waiting') DESC, CASE WHEN status = 'waiting' THEN send_at END ASC, coalesce(done_at, send_at) DESC
    LIMIT 40`)
  return r.map(toItem)
}

/** Returns the new row's id, or null when the waiting list for this kind is full. */
export async function scheduleSend(input: {
  kind: OutboxKind
  title: string
  body: string
  url: string | null
  imageUrl?: string | null
  userId?: string | null
  targetLabel: string
  sendAt: string
  createdBy: string
}) {
  await ensure()
  const [{ n }] = await rows<{ n: string }>(sql`SELECT count(*) AS n FROM panel_outbox WHERE kind = ${input.kind} AND status = 'waiting'`)
  if (Number(n) >= OUTBOX_MAX_WAITING) return null
  const r = await rows<{ id: number }>(sql`INSERT INTO panel_outbox (kind, title, body, url, image_url, user_id, target_label, send_at, created_by)
    VALUES (${input.kind}, ${input.title}, ${input.body}, ${input.url}, ${input.imageUrl ?? null}, ${input.userId ?? null},
      ${input.targetLabel}, ${input.sendAt}, ${input.createdBy})
    RETURNING id`)
  return Number(r[0].id)
}

export async function outboxKind(id: number): Promise<OutboxKind | null> {
  await ensure()
  const [r] = await rows<{ kind: string }>(sql`SELECT kind FROM panel_outbox WHERE id = ${id}`)
  if (!r) return null
  return r.kind === 'push' ? 'push' : 'message'
}

/** Only a send that has not started can be cancelled; returns its title, or null when it was too late. */
export async function cancelScheduled(id: number) {
  await ensure()
  const [r] = await rows<{ title: string }>(sql`UPDATE panel_outbox SET status = 'cancelled', done_at = now()
    WHERE id = ${id} AND status = 'waiting' RETURNING title`)
  return r ? r.title : null
}

async function finish(id: number, status: OutboxStatus, result: string) {
  await rows(sql`UPDATE panel_outbox SET status = ${status}, result = ${result.slice(0, 300)}, done_at = now() WHERE id = ${id} AND status = 'sending'`)
}

async function deliver(row: Row): Promise<{ status: OutboxStatus; result: string }> {
  const lateMin = (Date.now() - new Date(row.send_at).getTime()) / 60_000
  if (lateMin > OUTBOX_GRACE_MIN) {
    return { status: 'missed', result: `Zamanından ${Math.round(lateMin / 60)} saat sonra sıra geldi, gönderilmedi.` }
  }
  if (row.kind === 'push') {
    const { sendToAll } = await import('@/lib/push')
    const r = await sendToAll({ title: row.title, body: row.body, url: row.url || '/' }, row.created_by)
    return { status: 'sent', result: `${r.sent} cihaza gönderildi${r.failed ? `, ${r.failed} başarısız` : ''}.` }
  }
  if (row.user_id) {
    const [member] = await rows(sql`SELECT 1 FROM "user" WHERE id = ${row.user_id}`)
    if (!member) return { status: 'failed', result: 'Üye artık yok, mesaj gönderilmedi.' }
  }
  const { sendMessage } = await import('@/lib/inbox')
  await sendMessage({
    userId: row.user_id,
    targetLabel: row.target_label,
    title: row.title,
    body: row.body,
    url: row.url,
    imageUrl: row.image_url,
    sentBy: row.created_by,
  })
  return { status: 'sent', result: 'Gelen kutusuna düştü.' }
}

/**
 * Sends what has come due. A row is claimed before it is sent and never retried on its own:
 * a crash halfway leaves it marked as sending rather than risking the same push going out twice.
 */
export async function runOutbox() {
  await ensure()
  const due = await rows<Row>(sql`UPDATE panel_outbox SET status = 'sending', started_at = now()
    WHERE id IN (
      SELECT id FROM panel_outbox WHERE status = 'waiting' AND send_at <= now() ORDER BY send_at LIMIT 5 FOR UPDATE SKIP LOCKED
    )
    RETURNING *`)
  if (!due.length) return 0
  const { logPanel } = await import('@/lib/panel-log')
  for (const row of due) {
    const outcome = await deliver(row).catch((error): { status: OutboxStatus; result: string } => {
      console.error('[outbox] gönderilemedi', row.id, error)
      return { status: 'failed', result: 'Gönderim sırasında hata oluştu.' }
    })
    await finish(Number(row.id), outcome.status, outcome.result)
    const what = row.kind === 'push' ? 'Zamanlanmış bildirim' : 'Zamanlanmış mesaj'
    const verb = outcome.status === 'sent' ? 'gönderildi' : outcome.status === 'missed' ? 'zamanı geçtiği için gönderilmedi' : 'gönderilemedi'
    await logPanel(row.kind === 'push' ? 'push' : 'messages', `${what} ${verb}`, row.title, outcome.result, `${row.created_by || 'panel'} (zamanlanmış)`)
  }
  await rows(sql`DELETE FROM panel_outbox WHERE status <> 'waiting' AND created_at < now() - interval '60 days'`).catch(() => null)
  return due.length
}

export async function listTemplates(): Promise<MessageTemplate[]> {
  await ensure()
  const r = await rows<{ id: number; title: string; body: string; url: string }>(
    sql`SELECT id, title, body, url FROM message_templates ORDER BY lower(title) LIMIT ${MAX_TEMPLATES}`,
  )
  return r.map((t) => ({ id: Number(t.id), title: t.title, body: t.body, url: t.url }))
}

/** A template with the same title is overwritten, so saving twice does not pile up copies. */
export async function saveTemplate(input: { title: string; body: string; url: string; by: string }): Promise<'saved' | 'updated' | 'full'> {
  await ensure()
  const updated = await rows(sql`UPDATE message_templates SET body = ${input.body}, url = ${input.url}, created_by = ${input.by}
    WHERE lower(title) = lower(${input.title}) RETURNING id`)
  if (updated.length) return 'updated'
  const [{ n }] = await rows<{ n: string }>(sql`SELECT count(*) AS n FROM message_templates`)
  if (Number(n) >= MAX_TEMPLATES) return 'full'
  await rows(sql`INSERT INTO message_templates (title, body, url, created_by) VALUES (${input.title}, ${input.body}, ${input.url}, ${input.by})`)
  return 'saved'
}

export async function deleteTemplate(id: number) {
  await ensure()
  const [r] = await rows<{ title: string }>(sql`DELETE FROM message_templates WHERE id = ${id} RETURNING title`)
  return r ? r.title : null
}
