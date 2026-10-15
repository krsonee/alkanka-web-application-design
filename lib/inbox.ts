import { rows, sql } from '@/lib/db'

export type InboxMessage = {
  id: number
  title: string
  body: string
  url: string | null
  imageUrl: string | null
  createdAt: string
  read: boolean
  personal: boolean
}

export type SentMessage = {
  id: number
  title: string
  body: string
  url: string | null
  imageUrl: string | null
  createdAt: string
  target: string
  reads: number
  sentBy: string
}

let ready: Promise<unknown> | undefined

function ensure() {
  ready ??= (async () => {
    await rows(sql`CREATE TABLE IF NOT EXISTS member_messages (
      id serial PRIMARY KEY,
      user_id text,
      target_label text NOT NULL DEFAULT 'Tüm üyeler',
      title text NOT NULL,
      body text NOT NULL,
      url text,
      sent_by text NOT NULL DEFAULT '',
      created_at timestamptz NOT NULL DEFAULT now()
    )`)
    await rows(sql`ALTER TABLE member_messages ADD COLUMN IF NOT EXISTS image_url text`)
    await rows(sql`CREATE INDEX IF NOT EXISTS member_messages_user_idx ON member_messages (user_id, created_at DESC)`)
    await rows(sql`CREATE TABLE IF NOT EXISTS member_message_reads (
      user_id text NOT NULL,
      message_id integer NOT NULL REFERENCES member_messages(id) ON DELETE CASCADE,
      read_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, message_id)
    )`)
  })().catch((error) => {
    ready = undefined
    throw error
  })
  return ready
}

type Row = { id: number; title: string; body: string; url: string | null; image_url: string | null; created_at: string; read: boolean; personal: boolean }

const toMessage = (r: Row): InboxMessage => ({
  id: Number(r.id),
  title: r.title,
  body: r.body,
  url: r.url,
  imageUrl: r.image_url,
  createdAt: new Date(r.created_at).toISOString(),
  read: !!r.read,
  personal: !!r.personal,
})

/** Broadcasts only reach members who existed when they were sent, so new members don't inherit old announcements. */
const visibleTo = (userId: string) => sql`(m.user_id = ${userId} OR (m.user_id IS NULL AND m.created_at >= coalesce((SELECT "createdAt" FROM "user" WHERE id = ${userId}), now()) - interval '30 days'))`

export async function listInbox(userId: string, limit = 50): Promise<InboxMessage[]> {
  await ensure()
  const r = await rows<Row>(sql`SELECT m.id, m.title, m.body, m.url, m.image_url, m.created_at, (m.user_id IS NOT NULL) AS personal,
      EXISTS (SELECT 1 FROM member_message_reads r WHERE r.user_id = ${userId} AND r.message_id = m.id) AS read
    FROM member_messages m WHERE ${visibleTo(userId)} ORDER BY m.created_at DESC LIMIT ${limit}`)
  return r.map(toMessage)
}

export async function inboxStatus(userId: string): Promise<{ unread: number; latest: InboxMessage | null }> {
  await ensure()
  const r = await rows<Row & { unread: string }>(sql`WITH v AS (
      SELECT m.id, m.title, m.body, m.url, m.image_url, m.created_at, (m.user_id IS NOT NULL) AS personal, false AS read
      FROM member_messages m
      WHERE ${visibleTo(userId)}
        AND NOT EXISTS (SELECT 1 FROM member_message_reads r WHERE r.user_id = ${userId} AND r.message_id = m.id)
    )
    SELECT v.*, (SELECT count(*) FROM v) AS unread FROM v ORDER BY created_at DESC LIMIT 1`)
  if (!r[0]) return { unread: 0, latest: null }
  return { unread: Number(r[0].unread), latest: toMessage(r[0]) }
}

export async function markRead(userId: string, ids: number[] | 'all') {
  await ensure()
  if (ids === 'all') {
    await rows(sql`INSERT INTO member_message_reads (user_id, message_id)
      SELECT ${userId}, m.id FROM member_messages m WHERE ${visibleTo(userId)}
      ON CONFLICT DO NOTHING`)
    return
  }
  const clean = ids.map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 100)
  for (const id of clean) {
    await rows(sql`INSERT INTO member_message_reads (user_id, message_id)
      SELECT ${userId}, m.id FROM member_messages m WHERE m.id = ${id} AND ${visibleTo(userId)}
      ON CONFLICT DO NOTHING`)
  }
}

export async function sendMessage(input: { userId: string | null; targetLabel: string; title: string; body: string; url: string | null; imageUrl?: string | null; sentBy: string }) {
  await ensure()
  const r = await rows<{ id: number }>(sql`INSERT INTO member_messages (user_id, target_label, title, body, url, image_url, sent_by)
    VALUES (${input.userId}, ${input.targetLabel}, ${input.title}, ${input.body}, ${input.url}, ${input.imageUrl ?? null}, ${input.sentBy}) RETURNING id`)
  return Number(r[0].id)
}

export async function deleteMessage(id: number) {
  await ensure()
  await rows(sql`DELETE FROM member_messages WHERE id = ${id}`)
}

export async function listSent(limit = 30): Promise<SentMessage[]> {
  await ensure()
  const r = await rows<{ id: number; title: string; body: string; url: string | null; image_url: string | null; created_at: string; target_label: string; reads: string; sent_by: string }>(
    sql`SELECT m.id, m.title, m.body, m.url, m.image_url, m.created_at, m.target_label, m.sent_by,
        (SELECT count(*) FROM member_message_reads r WHERE r.message_id = m.id) AS reads
      FROM member_messages m ORDER BY m.created_at DESC LIMIT ${limit}`,
  )
  return r.map((m) => ({
    id: Number(m.id),
    title: m.title,
    body: m.body,
    url: m.url,
    imageUrl: m.image_url,
    createdAt: new Date(m.created_at).toISOString(),
    target: m.target_label,
    reads: Number(m.reads),
    sentBy: m.sent_by,
  }))
}
