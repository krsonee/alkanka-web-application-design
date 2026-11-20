import 'server-only'
import { rows, sql } from '@/lib/db'
import { TelegramError, botToken, callBot } from '@/lib/telegram-mirror'
import type { EmojiPack } from '@/lib/tg-posts-shared'

const MAX_PACKS = 20
const MAX_IMAGE_BYTES = 512 * 1024
const IMAGE_TYPES: Record<string, string> = { webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg' }

type TgSticker = { custom_emoji_id?: string; emoji?: string; is_animated?: boolean; is_video?: boolean; file_id: string; thumbnail?: { file_id: string } }
type TgStickerSet = { name: string; title: string; sticker_type: string; stickers: TgSticker[] }

let ready: Promise<void> | null = null

function ensureEmojiTables() {
  ready ??= (async () => {
    await rows(sql`CREATE TABLE IF NOT EXISTS tg_emoji_packs (
      name text PRIMARY KEY, title text NOT NULL, bot_id integer NOT NULL, added_at timestamptz NOT NULL DEFAULT now())`)
    await rows(sql`CREATE TABLE IF NOT EXISTS tg_emoji (
      id text PRIMARY KEY, pack text NOT NULL, emoji text NOT NULL, pos integer NOT NULL DEFAULT 0, file_id text, image text, mime text)`)
    await rows(sql`CREATE INDEX IF NOT EXISTS tg_emoji_pack ON tg_emoji (pack, pos)`)
  })().catch((error) => {
    ready = null
    throw error
  })
  return ready
}

/** Reads the pack name out of a t.me/addemoji link, or takes a bare name. */
export function packNameOf(input: string) {
  const raw = String(input ?? '').trim()
  const link = /(?:t\.me\/addemoji\/|addemoji\?set=)([A-Za-z0-9_]+)/i.exec(raw)
  const name = link ? link[1] : raw.replace(/^@/, '')
  return /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(name) ? name : null
}

/**
 * Reads a premium emoji pack through the bot and keeps its emoji ids. Adding a pack that is already known
 * refreshes it. Images are not fetched here; each one is fetched the first time the panel shows it.
 */
export async function addEmojiPack(botId: number, input: string) {
  const name = packNameOf(input)
  if (!name) throw new Error('Paket linki geçersiz. Örnek: https://t.me/addemoji/PaketAdi')
  await ensureEmojiTables()
  const token = await botToken(botId)
  let set: TgStickerSet
  try {
    set = await callBot<TgStickerSet>(token, 'getStickerSet', { name })
  } catch (error) {
    if (error instanceof TelegramError && /STICKERSET_INVALID|not found/i.test(error.description)) throw new Error('Telegram bu adla bir paket bulamadı. Linki kontrol et.')
    throw error
  }
  if (set.sticker_type !== 'custom_emoji') throw new Error('Bu bir çıkartma paketi. Premium emoji paketinin linki t.me/addemoji/ ile başlar.')
  const emojis = set.stickers
    .filter((s) => s.custom_emoji_id && s.emoji)
    // A moving emoji is shown by its still thumbnail; without one the panel shows the plain emoji instead.
    .map((s, pos) => ({ id: String(s.custom_emoji_id), emoji: String(s.emoji), pos, file_id: s.thumbnail?.file_id ?? (s.is_animated || s.is_video ? null : s.file_id) }))
  if (!emojis.length) throw new Error('Bu pakette emoji yok.')

  const known = await rows<{ name: string }>(sql`SELECT name FROM tg_emoji_packs`)
  if (!known.some((p) => p.name === set.name) && known.length >= MAX_PACKS) throw new Error(`En fazla ${MAX_PACKS} paket eklenebilir. Önce kullanmadığın bir paketi kaldır.`)

  const list = JSON.stringify(emojis)
  await rows(sql`INSERT INTO tg_emoji_packs (name, title, bot_id) VALUES (${set.name}, ${set.title}, ${botId})
    ON CONFLICT (name) DO UPDATE SET title = EXCLUDED.title, bot_id = EXCLUDED.bot_id`)
  await rows(sql`DELETE FROM tg_emoji WHERE pack = ${set.name} AND id NOT IN (SELECT x.id FROM jsonb_to_recordset(${list}::jsonb) AS x(id text))`)
  // An emoji id always means the same picture, so an image fetched earlier stays.
  await rows(sql`INSERT INTO tg_emoji (id, pack, emoji, pos, file_id)
    SELECT x.id, ${set.name}::text, x.emoji, x.pos, x.file_id FROM jsonb_to_recordset(${list}::jsonb) AS x(id text, emoji text, pos integer, file_id text)
    ON CONFLICT (id) DO UPDATE SET pack = EXCLUDED.pack, emoji = EXCLUDED.emoji, pos = EXCLUDED.pos, file_id = EXCLUDED.file_id`)
  return { ok: true, message: `Emoji paketi eklendi: ${set.title} (${emojis.length} emoji).`, name: set.name }
}

export async function removeEmojiPack(name: string) {
  await ensureEmojiTables()
  const [pack] = await rows<{ title: string }>(sql`DELETE FROM tg_emoji_packs WHERE name = ${name} RETURNING title`)
  if (!pack) throw new Error('Bu paket zaten kaldırılmış.')
  await rows(sql`DELETE FROM tg_emoji WHERE pack = ${name}`)
  return { ok: true, message: `Emoji paketi kaldırıldı: ${pack.title}. Yazılmış postlardaki emojiler yerinde kalır.` }
}

export async function listEmojiPacks(): Promise<EmojiPack[]> {
  await ensureEmojiTables()
  const packs = await rows<{ name: string; title: string }>(sql`SELECT name, title FROM tg_emoji_packs ORDER BY added_at, name`)
  if (!packs.length) return []
  const emojis = await rows<{ id: string; pack: string; emoji: string }>(sql`SELECT id, pack, emoji FROM tg_emoji ORDER BY pack, pos`)
  return packs.map((p) => ({ name: p.name, title: p.title, emojis: emojis.filter((e) => e.pack === p.name).map((e) => ({ id: e.id, emoji: e.emoji })) }))
}

/** The still picture of one premium emoji. Fetched from Telegram once, then served from the database. */
export async function emojiImage(id: string): Promise<{ mime: string; bytes: Buffer } | null> {
  await ensureEmojiTables()
  const [row] = await rows<{ image: string | null; mime: string | null; file_id: string | null; bot_id: number | null }>(sql`
    SELECT e.image, e.mime, e.file_id, p.bot_id FROM tg_emoji e LEFT JOIN tg_emoji_packs p ON p.name = e.pack WHERE e.id = ${id}`)
  if (!row) return null
  if (row.image && row.mime) return { mime: row.mime, bytes: Buffer.from(row.image, 'base64') }
  if (!row.file_id || !row.bot_id) return null

  const token = await botToken(Number(row.bot_id))
  const file = await callBot<{ file_path?: string }>(token, 'getFile', { file_id: row.file_id })
  const mime = IMAGE_TYPES[/\.([a-z0-9]+)$/i.exec(file.file_path ?? '')?.[1].toLowerCase() ?? '']
  if (!file.file_path || !mime) return null
  const res = await fetch(`https://api.telegram.org/file/bot${token}/${file.file_path}`, { signal: AbortSignal.timeout(20_000) })
  if (!res.ok) return null
  const bytes = Buffer.from(await res.arrayBuffer())
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) return null
  await rows(sql`UPDATE tg_emoji SET image = ${bytes.toString('base64')}, mime = ${mime} WHERE id = ${id}`)
  return { mime, bytes }
}
