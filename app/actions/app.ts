'use server'

import { rows, sql } from '@/lib/db'
import { credit, getBalance, getMember, recordHistory } from '@/lib/member'
import { getPublicKey, saveSubscription } from '@/lib/push'
import { APP_BONUS } from '@/lib/app-config'

type BonusResult =
  | { ok: true; awarded: boolean; balance: number }
  | { ok: false; error: string }

let ready: Promise<unknown> | null = null
function ensureTable() {
  ready ??= rows(sql`CREATE TABLE IF NOT EXISTS app_installs (
    user_id text PRIMARY KEY, platform text NOT NULL, created_at timestamptz NOT NULL DEFAULT now())`)
  return ready
}

/** One-time bonus for members who sign in from the installed app. */
export async function claimAppBonus(platform: string): Promise<BonusResult> {
  const member = await getMember()
  if (!member) return { ok: false, error: 'Bonus için giriş yapmalısın.' }
  const safePlatform = ['android', 'ios', 'desktop'].includes(platform) ? platform : 'desktop'
  await ensureTable()
  const inserted = await rows(sql`INSERT INTO app_installs (user_id, platform) VALUES (${member.id}, ${safePlatform})
    ON CONFLICT (user_id) DO NOTHING RETURNING user_id`)
  if (inserted.length === 0) return { ok: true, awarded: false, balance: await getBalance(member.id) }
  await credit(member.id, APP_BONUS)
  await recordHistory({
    userId: member.id,
    userName: member.name,
    game: 'uygulama',
    mode: 'odul',
    opponent: 'Mobil uygulama bonusu',
    stake: 0,
    result: 'win',
    delta: APP_BONUS,
  })
  return { ok: true, awarded: true, balance: await getBalance(member.id) }
}

export async function getAppBonusClaimed(): Promise<boolean> {
  const member = await getMember()
  if (!member) return false
  await ensureTable()
  const r = await rows(sql`SELECT 1 FROM app_installs WHERE user_id = ${member.id}`)
  return r.length > 0
}

export async function getPushKey() {
  return getPublicKey()
}

export async function subscribePush(sub: { endpoint?: string; keys?: { p256dh?: string; auth?: string } }) {
  const endpoint = String(sub?.endpoint ?? '')
  const p256dh = String(sub?.keys?.p256dh ?? '')
  const auth = String(sub?.keys?.auth ?? '')
  if (!endpoint.startsWith('https://') || endpoint.length > 1000 || !p256dh || !auth || p256dh.length > 200 || auth.length > 100) {
    return { ok: false as const, error: 'Geçersiz abonelik.' }
  }
  const member = await getMember()
  await saveSubscription({ endpoint, p256dh, auth }, member?.id ?? null)
  return { ok: true as const }
}
