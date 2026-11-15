import 'server-only'
import { rows, sql } from '@/lib/db'
import { botToken, callBot } from '@/lib/telegram-mirror'
import { getHub, modLog } from '@/lib/tg-hub'
import { inQuietHours, rulesFor, type QuietConfig, type QuietRow } from '@/lib/tg-hub-shared'
import { ensureShieldTables } from '@/lib/tg-shield'

const SEND_FLAGS = [
  'can_send_messages',
  'can_send_audios',
  'can_send_documents',
  'can_send_photos',
  'can_send_videos',
  'can_send_video_notes',
  'can_send_voice_notes',
  'can_send_polls',
  'can_send_other_messages',
  'can_add_web_page_previews',
] as const

const RETRY_MS = 30_000
const COMPLAIN_EVERY_SEC = 6 * 60 * 60
const END_NOTE_MINUTES = 10

type Perms = Record<string, boolean>
type Open = { chat_id: string; mode: string; perms: string | null; msg_id: string | null; failed_at: string | null }

/**
 * Quiet hours only ever take permissions away. A group an admin has already closed stays closed in "text only" mode,
 * and everything that is not about sending (adding members, pinning) is left exactly as it was.
 */
function quietPerms(current: Perms, mode: QuietConfig['mode']): Perms {
  const next: Perms = { ...current }
  for (const flag of SEND_FLAGS) next[flag] = false
  if (mode === 'text') next.can_send_messages = current.can_send_messages !== false
  return next
}

const modeText = (mode: string) => (mode === 'text' ? 'sadece yazıya açık; fotoğraf, video, çıkartma, anket ve link önizlemesi kapalı' : 'yazmaya kapalı')

async function oncePer(key: string, seconds: number) {
  const r = await rows(sql`INSERT INTO tg_settings (key, value) VALUES (${key}, ${new Date().toISOString()})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
    WHERE tg_settings.value::timestamptz < now() - make_interval(secs => ${seconds})
    RETURNING key`)
  return r.length > 0
}

async function begin(token: string, chatId: string, title: string, q: QuietConfig) {
  // The row is the claim: of two passes running together only one goes on to touch the group.
  const claimed = await rows(sql`INSERT INTO tg_quiet (chat_id, mode) VALUES (${chatId}, ${q.mode}) ON CONFLICT (chat_id) DO NOTHING RETURNING chat_id`)
  if (!claimed.length) return
  const drop = () => rows(sql`DELETE FROM tg_quiet WHERE chat_id = ${chatId}`)
  const complain = async (why: string) => {
    await drop()
    if (!(await oncePer(`quiet_fail_${chatId}`, COMPLAIN_EVERY_SEC))) return
    await modLog({
      chatId,
      chatTitle: title,
      action: 'Sessiz saatler başlatılamadı',
      reason: `${why}. Bekçi botunun bu grupta "üyeleri kısıtlama" yetkisi olmalı. Bot yeniden deneyecek; bu sürede gelen mesajları tek tek siliyor.`,
    })
  }

  // A raid or /kilit lock that closed the group is holding its own copy of the permissions; quiet hours wait for it to end.
  const held = await rows(sql`SELECT 1 FROM tg_locks WHERE chat_id = ${chatId} AND locked`)
  if (held.length) return void (await drop())

  const info = await callBot<{ permissions?: Perms }>(token, 'getChat', { chat_id: chatId }).catch(() => null)
  if (!info?.permissions) return complain('Grubun izinleri okunamadı')
  const next = quietPerms(info.permissions, q.mode)
  const changed = SEND_FLAGS.some((flag) => Boolean(info.permissions?.[flag]) !== next[flag])
  if (changed) {
    try {
      await callBot(token, 'setChatPermissions', { chat_id: chatId, permissions: next, use_independent_chat_permissions: true })
    } catch (error) {
      return complain(`Grup izinleri değiştirilemedi (${String((error as Error).message)})`)
    }
    // Saved only when something was changed: a group that was already closed has nothing of ours to put back.
    await rows(sql`UPDATE tg_quiet SET perms = ${JSON.stringify(info.permissions)} WHERE chat_id = ${chatId}`)
    if (q.announce) {
      const sent = await callBot<{ message_id: number }>(token, 'sendMessage', {
        chat_id: chatId,
        text: `Sessiz saatler başladı. Grup saat ${q.to}'e kadar ${modeText(q.mode)}.`,
        disable_notification: true,
      }).catch(() => null)
      if (sent) await rows(sql`UPDATE tg_quiet SET msg_id = ${sent.message_id} WHERE chat_id = ${chatId}`)
    }
  }
  await modLog({
    chatId,
    chatTitle: title,
    action: 'Sessiz saatler başladı',
    reason: `${q.from}–${q.to} · grup ${modeText(q.mode)}${changed ? '' : ' · izinler zaten bu kadar kapalıydı, dokunulmadı'}`,
    notify: false,
  })
}

async function finish(token: string, row: Open, title: string, raidLock: boolean) {
  const chatId = row.chat_id
  let handedOver = false
  if (row.perms) {
    // A raid or /kilit lock took over while the group was quiet: it now carries the original permissions and restores them when it ends.
    // One that began in a fully closed group found nothing to close and left itself unlocked, so it is recognised by its kind instead.
    const handed = await rows(sql`UPDATE tg_locks SET perms = ${row.perms}, locked = true
      WHERE chat_id = ${chatId} AND (locked OR kind = 'manual' OR (${raidLock} AND kind = 'raid' AND until > now())) RETURNING chat_id`)
    handedOver = handed.length > 0
    if (!handedOver) {
      let perms: Perms | null = null
      try {
        perms = JSON.parse(row.perms) as Perms
      } catch {
        perms = null
      }
      const error = perms
        ? await callBot(token, 'setChatPermissions', { chat_id: chatId, permissions: perms, use_independent_chat_permissions: true })
            .then(() => null)
            .catch((e) => String((e as Error).message))
        : null
      if (error) {
        // The row stays so the next pass tries again; a group left closed all day is worse than a repeated attempt.
        if (!row.failed_at) {
          await rows(sql`UPDATE tg_quiet SET failed_at = now() WHERE chat_id = ${chatId}`)
          await modLog({
            chatId,
            chatTitle: title,
            action: 'Sessiz saat kilidi açılamadı',
            reason: `${error}. Bot açmayı denemeye devam ediyor. Acilse Telegram'da grup izinlerinden mesaj göndermeyi elle aç.`,
          })
        }
        return
      }
    }
  }
  // Two passes can get here together; only the one that removes the row tells the group and writes the log.
  const closed = await rows(sql`DELETE FROM tg_quiet WHERE chat_id = ${chatId} RETURNING chat_id`)
  if (!closed.length) return
  if (row.msg_id) {
    await callBot(token, 'deleteMessage', { chat_id: chatId, message_id: Number(row.msg_id) }).catch(() => null)
    // A group that stays closed under a lock is not told it has reopened; the lock says so itself when it ends.
    const sent = handedOver
      ? null
      : await callBot<{ message_id: number }>(token, 'sendMessage', { chat_id: chatId, text: 'Sessiz saatler bitti. Grup yeniden açıldı.', disable_notification: true }).catch(() => null)
    if (sent) {
      await rows(sql`INSERT INTO tg_autodel (chat_id, message_id, due_at) VALUES (${chatId}, ${sent.message_id}, now() + make_interval(mins => ${END_NOTE_MINUTES}))`).catch(() => null)
    }
  }
  const reason = handedOver
    ? 'Grup kapalı kaldı: baskın modu ya da kilit sürüyor. Asıl izinler ona devredildi, o bitince grup açılır.'
    : row.perms
      ? 'Grubun izinleri eski haline döndü.'
      : 'İzinlere dokunulmamıştı.'
  await modLog({ chatId, chatTitle: title, action: 'Sessiz saatler bitti', reason, notify: false })
}

/** What this server instance last saw, so a message handler can tell without a query whether a pass is needed. */
const seen = new Map<string, { on: boolean; at: number }>()

/** True when the clock says the group should be in a different state than the last pass left it in. */
export function quietOutOfStep(chatId: string, q: QuietConfig | undefined, now = Date.now()) {
  const last = seen.get(chatId)
  return inQuietHours(q, now) !== (last?.on ?? false) && now - (last?.at ?? 0) > RETRY_MS
}

const openRows = () => rows<Open>(sql`SELECT chat_id, mode, perms, msg_id, failed_at FROM tg_quiet`)

/**
 * Brings every protected group in line with its quiet hours. There is no timer behind this: it runs on site visits and
 * on incoming Telegram updates, so a window starts and ends at the first activity after its clock time.
 */
export async function runQuietHours() {
  const hub = await getHub()
  if (!hub.guardBotId) return
  const now = Date.now()
  const groups = hub.groups.filter((g) => g.type !== 'channel')
  const wanted = new Map<string, { title: string; q: QuietConfig }>()
  if (hub.guard.enabled) {
    for (const g of groups) {
      const q = rulesFor(hub, g.chatId).quiet
      if (inQuietHours(q, now)) wanted.set(g.chatId, { title: g.title, q })
    }
  }
  await ensureShieldTables()
  let open = await openRows()
  if (open.length || wanted.size) {
    const token = await botToken(hub.guardBotId)
    const titleOf = (chatId: string) => groups.find((g) => g.chatId === chatId)?.title ?? chatId
    // Also covers a group whose setting was switched off, or the guard itself, in the middle of a window.
    const ending = open.filter((row) => wanted.get(row.chat_id)?.q.mode !== row.mode)
    for (const row of ending) {
      await finish(token, row, titleOf(row.chat_id), rulesFor(hub, row.chat_id).raidLock).catch((error) => console.error('[tg-quiet] end failed', error))
    }
    if (ending.length) open = await openRows()
    const starting = [...wanted].filter(([chatId]) => !open.some((row) => row.chat_id === chatId))
    for (const [chatId, w] of starting) await begin(token, chatId, w.title, w.q).catch((error) => console.error('[tg-quiet] start failed', error))
    if (starting.length) open = await openRows()
  }
  const on = new Set(open.map((row) => row.chat_id))
  for (const g of groups) seen.set(g.chatId, { on: on.has(g.chatId), at: now })
}

export async function listQuiet(): Promise<QuietRow[]> {
  await ensureShieldTables()
  const [hub, open] = await Promise.all([getHub(), rows<{ chat_id: string; mode: string; started_at: string; failed_at: string | null }>(sql`SELECT chat_id, mode, started_at, failed_at FROM tg_quiet ORDER BY started_at`)])
  return open.map((row) => ({
    chatId: row.chat_id,
    title: hub.groups.find((g) => g.chatId === row.chat_id)?.title ?? row.chat_id,
    mode: row.mode === 'text' ? 'text' : 'lock',
    since: new Date(String(row.started_at)).toISOString(),
    stuck: Boolean(row.failed_at),
  }))
}
