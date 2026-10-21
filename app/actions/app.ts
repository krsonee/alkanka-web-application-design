'use server'

import { rows, sql } from '@/lib/db'
import { credit, getBalance, getMember, recordHistory } from '@/lib/member'
import { getPublicKey, saveSubscription } from '@/lib/push'
import { getAppSettings } from '@/lib/app-settings'
import {
  claimCombo,
  dismissPushReminder,
  getPushPrefs,
  grantPocketBadge,
  pushReminderDue,
  recordAppOpen,
  reportPushState,
  savePushPrefs,
} from '@/lib/mobile'

type BonusResult =
  | { ok: true; awarded: boolean; amount: number; balance: number }
  | { ok: false; error: string }

type PushResult = { ok: true; awarded: boolean; amount: number; balance?: number } | { ok: false; error: string }

const ensureTable = async () => (await import('@/lib/mobile')).ensureMobile()

/** Pays the install + notifications combo once, when both are done. */
async function payCombo(member: { id: string; name: string }, amount: number) {
  const paid = await claimCombo(member.id, amount).catch(() => 0)
  if (!paid) return 0
  await credit(member.id, paid)
  await recordHistory({
    userId: member.id,
    userName: member.name,
    game: 'uygulama',
    mode: 'odul',
    opponent: 'Uygulama + bildirim kombo bonusu',
    stake: 0,
    result: 'win',
    delta: paid,
  })
  return paid
}

/** One-time bonus for members who sign in from the installed app. */
export async function claimAppBonus(platform: string): Promise<BonusResult> {
  const member = await getMember()
  if (!member) return { ok: false, error: 'Bonus için giriş yapmalısın.' }
  const { hitRateLimit, RATE_LIMIT_MESSAGE } = await import('@/lib/rate-limit')
  if (await hitRateLimit(`appbonus:${member.id}`, 5, 60)) return { ok: false, error: RATE_LIMIT_MESSAGE }
  const safePlatform = ['android', 'ios', 'desktop'].includes(platform) ? platform : 'desktop'
  await ensureTable()
  const { installBonus, comboBonus } = await getAppSettings()
  const inserted = await rows(sql`INSERT INTO app_installs (user_id, platform, last_seen) VALUES (${member.id}, ${safePlatform}, now())
    ON CONFLICT (user_id) DO NOTHING RETURNING user_id`)
  await recordAppOpen(member.id).catch((error) => console.error('[app] açılış kaydedilemedi', error))
  if (inserted.length) await grantPocketBadge(member.id)
  if (inserted.length === 0 || installBonus <= 0) {
    return { ok: true, awarded: false, amount: 0, balance: await getBalance(member.id) }
  }
  const combo = await payCombo(member, comboBonus)
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
  return { ok: true, awarded: true, amount: installBonus + combo, balance: await getBalance(member.id) }
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
  const { pushBonus, comboBonus } = await getAppSettings()
  const inserted = await rows(sql`INSERT INTO app_push_rewards (user_id, endpoint, amount)
    VALUES (${member.id}, ${endpoint}, ${pushBonus}) ON CONFLICT DO NOTHING RETURNING user_id`)
  await reportPushState(member.id, 'granted', true).catch(() => {})
  if (!inserted.length || pushBonus <= 0) return { ok: true, awarded: false, amount: 0 }
  const combo = await payCombo(member, comboBonus)
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
  return { ok: true, awarded: true, amount: pushBonus + combo, balance: await getBalance(member.id) }
}

/** Client reports the notification permission once per visit; lets us remind members who switched it off. */
export async function reportPush(state: string, subscribed: boolean) {
  const member = await getMember()
  if (!member) return
  await reportPushState(member.id, String(state).slice(0, 20), Boolean(subscribed)).catch((error) => console.error('[push] durum kaydedilemedi', error))
}

export async function getPushReminder(): Promise<boolean> {
  const member = await getMember()
  if (!member) return false
  return pushReminderDue(member.id).catch(() => false)
}

export async function dismissReminder() {
  const member = await getMember()
  if (member) await dismissPushReminder(member.id).catch(() => {})
}

export async function getMyPushPrefs(): Promise<string[] | null> {
  const member = await getMember()
  if (!member) return null
  return getPushPrefs(member.id)
}

export async function saveMyPushPrefs(off: string[]): Promise<{ ok: boolean; off: string[] }> {
  const member = await getMember()
  if (!member) return { ok: false, off: [] }
  const { hitRateLimit } = await import('@/lib/rate-limit')
  if (await hitRateLimit(`pushprefs:${member.id}`, 20, 60)) return { ok: false, off: await getPushPrefs(member.id) }
  return { ok: true, off: await savePushPrefs(member.id, Array.isArray(off) ? off.map(String).slice(0, 10) : []) }
}
