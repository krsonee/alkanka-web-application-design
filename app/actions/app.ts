'use server'

import { rows, sql } from '@/lib/db'
import { credit, getBalance, getMember, recordHistory } from '@/lib/member'
import { getPublicKey, saveSubscription } from '@/lib/push'
import { getAppSettings } from '@/lib/app-settings'

type BonusResult =
  | { ok: true; awarded: boolean; amount: number; balance: number }
  | { ok: false; error: string }

type PushResult = { ok: true; awarded: boolean; amount: number; balance?: number } | { ok: false; error: string }

let ready: Promise<unknown> | null = null
function ensureTable() {
  ready ??= (async () => {
    await rows(sql`CREATE TABLE IF NOT EXISTS app_installs (
      user_id text PRIMARY KEY, platform text NOT NULL, created_at timestamptz NOT NULL DEFAULT now())`)
    await rows(sql`CREATE TABLE IF NOT EXISTS app_push_rewards (
      user_id text PRIMARY KEY, endpoint text NOT NULL UNIQUE, amount int NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now())`)
  })().catch((error) => {
    ready = null
    throw error
  })
  return ready
}

/** One-time bonus for members who sign in from the installed app. */
export async function claimAppBonus(platform: string): Promise<BonusResult> {
  const member = await getMember()
  if (!member) return { ok: false, error: 'Bonus için giriş yapmalısın.' }
  const { hitRateLimit, RATE_LIMIT_MESSAGE } = await import('@/lib/rate-limit')
  if (await hitRateLimit(`appbonus:${member.id}`, 5, 60)) return { ok: false, error: RATE_LIMIT_MESSAGE }
  const safePlatform = ['android', 'ios', 'desktop'].includes(platform) ? platform : 'desktop'
  await ensureTable()
  const { installBonus } = await getAppSettings()
  const inserted = await rows(sql`INSERT INTO app_installs (user_id, platform) VALUES (${member.id}, ${safePlatform})
    ON CONFLICT (user_id) DO NOTHING RETURNING user_id`)
  if (inserted.length === 0 || installBonus <= 0) {
    return { ok: true, awarded: false, amount: 0, balance: await getBalance(member.id) }
  }
  await credit(member.id, installBonus)
  await recordHistory({
    userId: member.id,
    userName: member.name,
    game: 'uygulama',
    mode: 'odul',
    opponent: 'Mobil uygulama bonusu',
    stake: 0,
    result: 'win',
    delta: installBonus,
  })
  return { ok: true, awarded: true, amount: installBonus, balance: await getBalance(member.id) }
}

export async function getAppProgress(): Promise<{ install: boolean; push: boolean }> {
  const member = await getMember()
  if (!member) return { install: false, push: false }
  await ensureTable()
  const r = await rows<{ install: boolean; push: boolean }>(sql`SELECT
    EXISTS (SELECT 1 FROM app_installs WHERE user_id = ${member.id}) AS install,
    EXISTS (SELECT 1 FROM app_push_rewards WHERE user_id = ${member.id}) AS push`)
  return { install: Boolean(r[0]?.install), push: Boolean(r[0]?.push) }
}

export async function getPushKey() {
  return getPublicKey()
}

/** Saves the device subscription and pays the one-time notification bonus (one per member and per device). */
export async function subscribePush(sub: { endpoint?: string; keys?: { p256dh?: string; auth?: string } }): Promise<PushResult> {
  const endpoint = String(sub?.endpoint ?? '')
  const p256dh = String(sub?.keys?.p256dh ?? '')
  const auth = String(sub?.keys?.auth ?? '')
  if (!endpoint.startsWith('https://') || endpoint.length > 1000 || !p256dh || !auth || p256dh.length > 200 || auth.length > 100) {
    return { ok: false, error: 'Geçersiz abonelik.' }
  }
  const member = await getMember()
  await saveSubscription({ endpoint, p256dh, auth }, member?.id ?? null)
  if (!member) return { ok: true, awarded: false, amount: 0 }

  await ensureTable()
  const { pushBonus } = await getAppSettings()
  const inserted = await rows(sql`INSERT INTO app_push_rewards (user_id, endpoint, amount)
    VALUES (${member.id}, ${endpoint}, ${pushBonus}) ON CONFLICT DO NOTHING RETURNING user_id`)
  if (!inserted.length || pushBonus <= 0) return { ok: true, awarded: false, amount: 0 }
  await credit(member.id, pushBonus)
  await recordHistory({
    userId: member.id,
    userName: member.name,
    game: 'uygulama',
    mode: 'odul',
    opponent: 'Bildirim bonusu',
    stake: 0,
    result: 'win',
    delta: pushBonus,
  })
  return { ok: true, awarded: true, amount: pushBonus, balance: await getBalance(member.id) }
}
