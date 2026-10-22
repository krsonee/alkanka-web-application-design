import 'server-only'
import { rows, sql } from '@/lib/db'
import { botToken, callBot, ensureTables } from '@/lib/telegram-mirror'
import { registerHook } from '@/lib/tg-hub'

type Json = Record<string, unknown>

const HOOK_PATH = /^(https:\/\/[^/]+)\/api\/telegram\/hook\/(\d+)$/
const CHAT_KEYS = ['chat_bot_id', 'chat_bot_username', 'chat_id', 'chat_title', 'chat_invite', 'chat_secret', 'chat_pinned', 'chat_members', 'chat_members_at']
const INVITE_KEYS = ['invite_bot_id', 'invite_chat_id', 'invite_chat_title']

async function readJson(key: string): Promise<Json | null> {
  const r = await rows<{ value: string }>(sql`SELECT value FROM tg_settings WHERE key = ${key}`)
  if (!r[0]) return null
  try {
    return JSON.parse(r[0].value) as Json
  } catch {
    return null
  }
}

async function writeJson(key: string, value: Json) {
  await rows(sql`UPDATE tg_settings SET value = ${JSON.stringify(value)} WHERE key = ${key}`)
}

async function dropKeys(keys: string[]) {
  await rows(sql`DELETE FROM tg_settings WHERE key IN ${keys}`)
}

/**
 * Clears every setting that still points at a deleted bot or target, and re-points webhooks
 * that were left on an old bot number (happens when a bot is removed and added again).
 */
export async function repairTelegram(): Promise<string[]> {
  await ensureTables()
  const fixes: string[] = []
  const botRows = await rows<{ id: number; username: string }>(sql`SELECT id, username FROM tg_bots ORDER BY id`)
  const bots = new Set(botRows.map((b) => Number(b.id)))
  const targets = new Set((await rows<{ id: number }>(sql`SELECT id FROM tg_targets`)).map((t) => Number(t.id)))
  const alive = (v: unknown) => typeof v === 'number' && bots.has(v)

  const hub = await readJson('hub_config')
  if (hub) {
    let changed = false
    for (const k of ['guardBotId', 'supportBotId'] as const) {
      if (hub[k] != null && !alive(hub[k])) {
        fixes.push(`Merkez: silinmiş bot #${hub[k]} ${k === 'guardBotId' ? 'Bekçi' : 'Destek'} rolünden çıkarıldı`)
        hub[k] = null
        changed = true
      }
    }
    if (changed) await writeJson('hub_config', hub)
  }

  const suite = await readJson('bot_suite')
  if (suite) {
    let changed = false
    for (const part of ['share', 'approvals'] as const) {
      const p = suite[part] as Json | undefined
      if (p && p.botId != null && !alive(p.botId)) {
        fixes.push(`${part === 'share' ? 'Post Paylaşım' : 'Bildirim'}: silinmiş bot #${p.botId} kaldırıldı, bölüm kapatıldı`)
        p.botId = null
        p.enabled = false
        changed = true
      }
    }
    for (const part of ['share', 'odds'] as const) {
      const p = suite[part] as Json | undefined
      if (p && Array.isArray(p.targetIds)) {
        const kept = (p.targetIds as unknown[]).filter((id) => typeof id === 'number' && targets.has(id))
        if (kept.length !== p.targetIds.length) {
          fixes.push(`${part === 'share' ? 'Post Paylaşım' : 'Oran'}: silinmiş hedef kanallar listeden çıkarıldı`)
          p.targetIds = kept
          changed = true
        }
      }
    }
    if (changed) await writeJson('bot_suite', suite)
  }

  const odds = await readJson('odds_bot')
  if (odds && odds.botId != null && !alive(odds.botId)) {
    fixes.push(`Özel Oran: silinmiş bot #${odds.botId} kaldırıldı, bot kapatıldı`)
    odds.botId = null
    odds.enabled = false
    await writeJson('odds_bot', odds)
  }

  const single = await rows<{ key: string; value: string }>(sql`SELECT key, value FROM tg_settings WHERE key IN ('chat_bot_id', 'invite_bot_id')`)
  for (const s of single) {
    if (bots.has(Number(s.value))) continue
    if (s.key === 'chat_bot_id') {
      await dropKeys(CHAT_KEYS)
      fixes.push(`Canlı Sohbet: silinmiş bot #${s.value} bağlantısı temizlendi`)
    } else {
      await dropKeys(INVITE_KEYS)
      fixes.push(`Masa daveti: silinmiş bot #${s.value} bağlantısı temizlendi`)
    }
  }

  for (const b of botRows) {
    try {
      const info = await callBot<{ url: string }>(await botToken(Number(b.id)), 'getWebhookInfo')
      const match = HOOK_PATH.exec(info.url ?? '')
      if (match && Number(match[2]) !== Number(b.id)) {
        await registerHook(Number(b.id), match[1])
        fixes.push(`@${b.username}: webhook eski bot numarasına (#${match[2]}) bakıyordu, #${b.id} olarak düzeltildi`)
      }
    } catch (error) {
      fixes.push(`@${b.username}: Telegram'a ulaşılamadı (${String((error as Error).message)})`)
    }
  }

  const secrets = await rows<{ key: string }>(sql`SELECT key FROM tg_settings WHERE key LIKE 'hook_secret_%'`)
  const stale = secrets.map((s) => s.key).filter((k) => !bots.has(Number(k.replace('hook_secret_', ''))))
  if (stale.length) {
    await dropKeys(stale)
    fixes.push(`${stale.length} eski webhook anahtarı silindi`)
  }

  return fixes
}

/** Called before a bot row is deleted so Telegram stops sending updates to a dead route. */
export async function detachBot(botId: number) {
  try {
    const token = await botToken(botId)
    const info = await callBot<{ url: string }>(token, 'getWebhookInfo')
    if (HOOK_PATH.test(info.url ?? '') || /\/api\/telegram\/(webhook|odds)$/.test(info.url ?? '')) {
      await callBot(token, 'deleteWebhook')
    }
  } catch {
    // Token may already be revoked; the reference cleanup below still runs.
  }
}
