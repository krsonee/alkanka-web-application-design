import 'server-only'
import { pool } from '@/lib/db'
import { ARENA_META, type ArenaGame } from '@/lib/arena'
import { botToken, callBot, ensureTables, normalizeChat } from '@/lib/telegram-mirror'
import { getTableRow } from '@/lib/pvp/tables'

export const INVITE_COOLDOWN_SECONDS = 4 * 60

export type InviteConfig = { botId: number; chatId: string; title: string }

let ready: Promise<void> | null = null
function ensureInviteTables() {
  ready ??= (async () => {
    await ensureTables()
    await pool.query(`CREATE TABLE IF NOT EXISTS tg_table_invites (
      user_id text PRIMARY KEY, table_id text NOT NULL, sent_at timestamptz NOT NULL DEFAULT now())`)
  })().catch((error) => {
    ready = null
    throw error
  })
  return ready
}

export async function getInviteConfig(): Promise<InviteConfig | null> {
  await ensureInviteTables()
  const r = await pool.query<{ key: string; value: string }>(
    `SELECT key, value FROM tg_settings WHERE key IN ('invite_bot_id', 'invite_chat_id', 'invite_chat_title')`,
  )
  const s = Object.fromEntries(r.rows.map((x) => [x.key, x.value]))
  if (!s.invite_bot_id || !s.invite_chat_id) return null
  return { botId: Number(s.invite_bot_id), chatId: s.invite_chat_id, title: s.invite_chat_title ?? 'Telegram' }
}

export async function connectInviteChannel(botId: number, chatInput: string) {
  await ensureInviteTables()
  const token = await botToken(botId)
  const chat = normalizeChat(chatInput)
  if (!chat) throw new Error('Kanal kullanıcı adı ya da ID’si geçersiz.')
  const info = await callBot<{ id: number; title?: string }>(token, 'getChat', { chat_id: chat })
  const me = await callBot<{ id: number }>(token, 'getMe')
  const member = await callBot<{ status: string; can_post_messages?: boolean }>(token, 'getChatMember', { chat_id: info.id, user_id: me.id })
  if (!['administrator', 'creator'].includes(member.status)) {
    throw new Error('Bot bu kanalda yönetici değil. Botu kanala yönetici olarak ekle ve "Mesaj gönder" iznini aç.')
  }
  const title = info.title ?? 'Telegram'
  const values: [string, string][] = [
    ['invite_bot_id', String(botId)],
    ['invite_chat_id', String(info.id)],
    ['invite_chat_title', title],
  ]
  for (const [key, value] of values) {
    await pool.query(
      `INSERT INTO tg_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [key, value],
    )
  }
  return title
}

export async function disconnectInviteChannel() {
  await ensureInviteTables()
  await pool.query(`DELETE FROM tg_settings WHERE key IN ('invite_bot_id', 'invite_chat_id', 'invite_chat_title')`)
}

export async function inviteWaitSeconds(userId: string) {
  await ensureInviteTables()
  const r = await pool.query<{ wait: number }>(
    `SELECT greatest(0, ceil(extract(epoch FROM (sent_at + make_interval(secs => $2)) - now())))::int AS wait
       FROM tg_table_invites WHERE user_id = $1`,
    [userId, INVITE_COOLDOWN_SECONDS],
  )
  return r.rows[0]?.wait ?? 0
}

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export type InviteResult = { ok: true; wait: number } | { ok: false; error: string; wait?: number }

export async function sendTableInvite(user: { id: string; name: string }, tableId: string, origin: string): Promise<InviteResult> {
  const config = await getInviteConfig()
  if (!config) return { ok: false, error: 'Davet kanalı henüz bağlanmadı. Yakında aktif olacak.' }

  const table = await getTableRow(tableId)
  if (!table) return { ok: false, error: 'Masa bulunamadı.' }
  if (table.status !== 'bekliyor') return { ok: false, error: 'Masa artık oyuncu beklemiyor.' }
  if (!table.players.some((p) => p.id === user.id && !p.bot)) return { ok: false, error: 'Sadece masadaki oyuncular davet gönderebilir.' }

  // Claim the cooldown slot atomically so two quick clicks cannot both post.
  const claim = await pool.query(
    `INSERT INTO tg_table_invites (user_id, table_id, sent_at) VALUES ($1, $2, now())
     ON CONFLICT (user_id) DO UPDATE SET table_id = EXCLUDED.table_id, sent_at = now()
       WHERE tg_table_invites.sent_at < now() - make_interval(secs => $3)
     RETURNING user_id`,
    [user.id, tableId, INVITE_COOLDOWN_SECONDS],
  )
  if (!claim.rowCount) {
    const wait = await inviteWaitSeconds(user.id)
    return { ok: false, error: 'Az önce davet gönderdin, biraz bekle.', wait }
  }

  const meta = ARENA_META[table.game as ArenaGame]
  const gameTitle = meta?.title ?? table.game
  const humans = table.players.filter((p) => !p.bot).length
  const freeSeats = table.seats - table.options.bots - humans
  const link = `${origin}/oyunlar/${table.game}?masa=${table.id}`
  const mode = table.game === 'okey' ? (table.options.team ? ' · Takımlı' : ' · Tekli') : ''
  const text = [
    `<b>Oyuncu aranıyor!</b>`,
    ``,
    `<b>${escapeHtml(user.name)}</b> bir <b>${escapeHtml(gameTitle)}</b> masası açtı${mode}.`,
    `Bahis: <b>${table.stake} KC</b> · Boş koltuk: <b>${Math.max(1, freeSeats)}</b>`,
    ``,
    `Masaya otur, oyun hemen başlasın.`,
  ].join('\n')

  let sentId: number | null = null
  try {
    const token = await botToken(config.botId)
    const sent = await callBot<{ message_id: number }>(token, 'sendMessage', {
      chat_id: config.chatId,
      text,
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
      reply_markup: { inline_keyboard: [[{ text: 'Oyuna katıl', url: link }]] },
    })
    sentId = sent.message_id
  } catch (e) {
    // Release the slot so a Telegram outage doesn't lock the member out.
    await pool.query(`DELETE FROM tg_table_invites WHERE user_id = $1`, [user.id])
    return { ok: false, error: `Telegram'a gönderilemedi: ${(e as Error).message}` }
  }

  // Bots never receive their own messages, so the invite has to be written into the site chat feed directly.
  try {
    const { getChatConfig } = await import('@/lib/telegram-chat')
    const chat = await getChatConfig()
    if (chat) {
      const plain = `Oyuncu aranıyor! ${user.name} bir ${gameTitle} masası açtı${mode}. Bahis: ${table.stake} KC · Boş koltuk: ${Math.max(1, freeSeats)}. Katıl: ${link}`
      await pool.query(
        `INSERT INTO tg_chat_messages (chat_id, tg_message_id, from_tg_id, user_id, author, text, origin)
         VALUES ($1, $2, NULL, $3, 'Jako', $4, 'site') ON CONFLICT DO NOTHING`,
        [chat.chatId, chat.chatId === config.chatId ? sentId : null, user.id, plain],
      )
    }
  } catch (e) {
    console.error('[table-invite] site chat insert failed', e)
  }
  return { ok: true, wait: INVITE_COOLDOWN_SECONDS }
}
