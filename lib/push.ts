import 'server-only'
import webpush from 'web-push'
import { rows, sql } from '@/lib/db'

export type PushPayload = { title: string; body: string; url: string }
export type PushLog = { id: number; title: string; body: string; url: string; sent: number; failed: number; createdAt: string }

let ready: Promise<void> | null = null
function ensureTables() {
  ready ??= (async () => {
    await rows(sql`CREATE TABLE IF NOT EXISTS push_config (
      id int PRIMARY KEY DEFAULT 1, public_key text NOT NULL, private_key text NOT NULL, CHECK (id = 1))`)
    await rows(sql`CREATE TABLE IF NOT EXISTS push_subscriptions (
      endpoint text PRIMARY KEY, p256dh text NOT NULL, auth text NOT NULL, user_id text,
      created_at timestamptz NOT NULL DEFAULT now())`)
    await rows(sql`CREATE TABLE IF NOT EXISTS push_log (
      id serial PRIMARY KEY, title text NOT NULL, body text NOT NULL, url text NOT NULL,
      sent int NOT NULL DEFAULT 0, failed int NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now())`)
  })().catch((error) => {
    ready = null
    throw error
  })
  return ready
}

async function getVapid() {
  await ensureTables()
  const existing = await rows<{ public_key: string; private_key: string }>(sql`SELECT public_key, private_key FROM push_config WHERE id = 1`)
  if (existing[0]) return { publicKey: existing[0].public_key, privateKey: existing[0].private_key }
  const keys = webpush.generateVAPIDKeys()
  await rows(sql`INSERT INTO push_config (id, public_key, private_key) VALUES (1, ${keys.publicKey}, ${keys.privateKey}) ON CONFLICT (id) DO NOTHING`)
  const saved = await rows<{ public_key: string; private_key: string }>(sql`SELECT public_key, private_key FROM push_config WHERE id = 1`)
  return { publicKey: saved[0].public_key, privateKey: saved[0].private_key }
}

export async function getPublicKey() {
  return (await getVapid()).publicKey
}

export async function saveSubscription(sub: { endpoint: string; p256dh: string; auth: string }, userId: string | null) {
  await ensureTables()
  await rows(sql`INSERT INTO push_subscriptions (endpoint, p256dh, auth, user_id)
    VALUES (${sub.endpoint}, ${sub.p256dh}, ${sub.auth}, ${userId})
    ON CONFLICT (endpoint) DO UPDATE SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth,
      user_id = COALESCE(EXCLUDED.user_id, push_subscriptions.user_id)`)
}

export async function pushStats() {
  await ensureTables()
  const r = await rows<{ total: string; members: string }>(sql`SELECT count(*) AS total, count(user_id) AS members FROM push_subscriptions`)
  const log = await rows(sql`SELECT * FROM push_log ORDER BY created_at DESC LIMIT 10`)
  return {
    total: Number(r[0]?.total ?? 0),
    members: Number(r[0]?.members ?? 0),
    log: log.map(
      (l): PushLog => ({
        id: Number(l.id),
        title: String(l.title),
        body: String(l.body),
        url: String(l.url),
        sent: Number(l.sent),
        failed: Number(l.failed),
        createdAt: new Date(String(l.created_at)).toISOString(),
      }),
    ),
  }
}

/** Sends to the subscriptions of specific members only (not logged in push_log). */
export async function sendToUsers(userIds: string[], payload: PushPayload) {
  if (!userIds.length) return { sent: 0, failed: 0 }
  const vapid = await getVapid()
  webpush.setVapidDetails('mailto:destek@alkanka.com', vapid.publicKey, vapid.privateKey)
  const subs = await rows<{ endpoint: string; p256dh: string; auth: string }>(sql`SELECT endpoint, p256dh, auth FROM push_subscriptions
    WHERE user_id IN (${sql.join(userIds.map((id) => sql`${id}`), sql`, `)})`)
  const body = JSON.stringify(payload)
  let sent = 0
  let failed = 0
  const results = await Promise.allSettled(
    subs.map((s) => webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, { TTL: 60 * 60 * 24 })),
  )
  for (const [idx, r] of results.entries()) {
    if (r.status === 'fulfilled') sent++
    else {
      failed++
      const code = (r.reason as { statusCode?: number })?.statusCode
      if (code === 404 || code === 410) await rows(sql`DELETE FROM push_subscriptions WHERE endpoint = ${subs[idx].endpoint}`)
    }
  }
  return { sent, failed }
}

export async function sendToAll(payload: PushPayload) {
  const vapid = await getVapid()
  webpush.setVapidDetails('mailto:destek@alkanka.com', vapid.publicKey, vapid.privateKey)
  const subs = await rows<{ endpoint: string; p256dh: string; auth: string }>(sql`SELECT endpoint, p256dh, auth FROM push_subscriptions`)
  const body = JSON.stringify(payload)
  let sent = 0
  let failed = 0
  const expired: string[] = []

  for (let i = 0; i < subs.length; i += 50) {
    const batch = subs.slice(i, i + 50)
    const results = await Promise.allSettled(
      batch.map((s) => webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, { TTL: 60 * 60 * 24 })),
    )
    results.forEach((r, idx) => {
      if (r.status === 'fulfilled') return void sent++
      failed++
      const code = (r.reason as { statusCode?: number })?.statusCode
      if (code === 404 || code === 410) expired.push(batch[idx].endpoint)
    })
  }

  for (const endpoint of expired) await rows(sql`DELETE FROM push_subscriptions WHERE endpoint = ${endpoint}`)
  await rows(sql`INSERT INTO push_log (title, body, url, sent, failed) VALUES (${payload.title}, ${payload.body}, ${payload.url}, ${sent}, ${failed})`)
  return { sent, failed, removed: expired.length }
}
