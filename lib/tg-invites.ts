import 'server-only'
import { rows, sql } from '@/lib/db'
import { botToken, callBot } from '@/lib/telegram-mirror'
import { ensureHubTables, getHub, modLog } from '@/lib/tg-hub'
import { INVITE_NAME_MAX, type InviteRow } from '@/lib/tg-resilience-shared'

const OPEN_MAX = 50
const LIST_MAX = 100

let ready: Promise<void> | null = null
export function ensureInviteTables() {
  ready ??= (async () => {
    await ensureHubTables()
    await rows(sql`CREATE TABLE IF NOT EXISTS tg_invite_links (
      id serial PRIMARY KEY, chat_id text NOT NULL, chat_title text NOT NULL DEFAULT '', name text NOT NULL, link text NOT NULL UNIQUE,
      approval boolean NOT NULL DEFAULT false, created_by text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now(),
      revoked_at timestamptz, revoked_by text, joins int NOT NULL DEFAULT 0, last_join_at timestamptz,
      recent int NOT NULL DEFAULT 0, recent_from timestamptz)`)
  })().catch((error) => {
    ready = null
    throw error
  })
  return ready
}

const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null)

function mapInvite(x: Record<string, unknown>): InviteRow {
  return {
    id: Number(x.id),
    chatId: String(x.chat_id),
    chatTitle: String(x.chat_title ?? ''),
    name: String(x.name),
    link: String(x.link),
    approval: Boolean(x.approval),
    createdBy: String(x.created_by ?? ''),
    createdAt: iso(x.created_at)!,
    revokedAt: iso(x.revoked_at),
    joins: Number(x.joins),
    lastJoinAt: iso(x.last_join_at),
    recentJoins: Number(x.recent_now ?? 0),
  }
}

const COLUMNS = sql`id, chat_id, chat_title, name, link, approval, created_by, created_at, revoked_at, joins, last_join_at,
  CASE WHEN recent_from > now() - interval '1 hour' THEN recent ELSE 0 END AS recent_now`

export async function listInvites(): Promise<InviteRow[]> {
  await ensureInviteTables()
  const r = await rows(sql`SELECT ${COLUMNS} FROM tg_invite_links ORDER BY (revoked_at IS NOT NULL), created_at DESC LIMIT ${LIST_MAX}`)
  return r.map(mapInvite)
}

/** While a link is open, the guard bot has to be told about joins; nothing else can count them. */
export async function hasOpenInvites() {
  await ensureInviteTables()
  const r = await rows(sql`SELECT 1 FROM tg_invite_links WHERE revoked_at IS NULL LIMIT 1`)
  return r.length > 0
}

export async function createInvite(input: { chatId: string; name: string; approval: boolean; by: string }): Promise<InviteRow> {
  await ensureInviteTables()
  const hub = await getHub()
  if (!hub.guardBotId) throw new Error('Önce Bekçi botunu seç (Telegram Merkezi > Kurulum).')
  const chat = hub.groups.find((g) => g.chatId === String(input.chatId))
  if (!chat) throw new Error('Davet linki, korunan listedeki bir grup ya da kanal için açılır. Önce sohbeti listeye ekle.')
  const name = String(input.name ?? '').trim().replace(/\s+/g, ' ')
  if (!name) throw new Error('Kampanyaya bir ad ver (örnek: "Instagram reklamı").')
  if (name.length > INVITE_NAME_MAX) throw new Error(`Kampanya adı en fazla ${INVITE_NAME_MAX} karakter olabilir (Telegram sınırı).`)
  const open = await rows<{ name: string; chat_id: string }>(sql`SELECT name, chat_id FROM tg_invite_links WHERE revoked_at IS NULL`)
  if (open.length >= OPEN_MAX) throw new Error(`En fazla ${OPEN_MAX} açık link olabilir. Kullanılmayanları iptal et.`)
  if (open.some((o) => o.chat_id === chat.chatId && o.name.toLocaleLowerCase('tr') === name.toLocaleLowerCase('tr'))) {
    throw new Error('Bu sohbette aynı adla açık bir link var. Farklı bir ad ver ya da eskisini iptal et.')
  }
  const made = await callBot<{ invite_link: string }>(await botToken(hub.guardBotId), 'createChatInviteLink', {
    chat_id: chat.chatId,
    name,
    ...(input.approval ? { creates_join_request: true } : {}),
  })
  const [row] = await rows(sql`INSERT INTO tg_invite_links (chat_id, chat_title, name, link, approval, created_by)
    VALUES (${chat.chatId}, ${chat.title}, ${name}, ${made.invite_link}, ${Boolean(input.approval)}, ${input.by})
    RETURNING ${COLUMNS}`)
  await modLog({ chatId: chat.chatId, chatTitle: chat.title, action: 'Davet linki açıldı', reason: `"${name}" (açan: ${input.by})`, notify: false })
  return mapInvite(row)
}

/** Telegram's wording when the link no longer works; such a link is safe to mark as revoked. */
const ALREADY_DEAD = /INVITE_HASH_EXPIRED|INVITE_HASH_INVALID|invite link.*(revoked|expired)/i

export async function revokeInvite(id: number, by: string): Promise<{ ok: boolean; message: string }> {
  await ensureInviteTables()
  const [row] = await rows<{ chat_id: string; chat_title: string; name: string; link: string; joins: number; revoked_at: string | null }>(
    sql`SELECT chat_id, chat_title, name, link, joins, revoked_at FROM tg_invite_links WHERE id = ${id}`,
  )
  if (!row) return { ok: false, message: 'Link bulunamadı.' }
  if (row.revoked_at) return { ok: true, message: 'Bu link zaten iptal edilmiş.' }
  const hub = await getHub()
  if (!hub.guardBotId) return { ok: false, message: 'Bekçi botu seçili değil; link Telegram tarafında iptal edilemedi.' }
  try {
    await callBot(await botToken(hub.guardBotId), 'revokeChatInviteLink', { chat_id: row.chat_id, invite_link: row.link })
  } catch (error) {
    const description = String((error as { description?: string }).description ?? (error as Error).message)
    // Marking a link revoked while it still lets people in would hide a live door, so any other failure stops here.
    if (!ALREADY_DEAD.test(description)) return { ok: false, message: `Link iptal edilemedi, hâlâ çalışıyor: ${(error as Error).message}` }
  }
  await rows(sql`UPDATE tg_invite_links SET revoked_at = now(), revoked_by = ${by} WHERE id = ${id}`)
  await modLog({
    chatId: row.chat_id,
    chatTitle: row.chat_title,
    action: 'Davet linki iptal edildi',
    reason: `"${row.name}" (${Number(row.joins)} kişi bu linkle girmişti; iptal eden: ${by})`,
    notify: false,
  })
  return { ok: true, message: `"${row.name}" linki iptal edildi. Bu linkle artık kimse giremez; önceden girenler içeride kalır.` }
}

/** Telegram shows a bot the full address only for links the bot itself made, which are exactly the ones stored here. */
export async function noteInviteJoin(chatId: string, link: string) {
  await ensureInviteTables()
  await rows(sql`UPDATE tg_invite_links SET joins = joins + 1, last_join_at = now(),
      recent = CASE WHEN recent_from > now() - interval '1 hour' THEN recent + 1 ELSE 1 END,
      recent_from = CASE WHEN recent_from > now() - interval '1 hour' THEN recent_from ELSE now() END
    WHERE chat_id = ${chatId} AND link = ${link}`)
}
