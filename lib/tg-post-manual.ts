import 'server-only'
import { rows, sql } from '@/lib/db'
import { botToken, callBot } from '@/lib/telegram-mirror'
import type { TgMessage } from '@/lib/telegram-chat'
import { botListens, editPost, ensurePostTables, explain, getPost, liveSends, parse, sponsors, type SendOutcome } from '@/lib/tg-posts'
import {
  CAPTION_LIMIT,
  SIGNATURE_LIMIT,
  TEXT_LIMIT,
  buttonProblems,
  entitiesToHtml,
  escapeText,
  needsListener,
  normalizeContent,
  signatureHtml,
  visibleLength,
  type ChannelRule,
} from '@/lib/tg-posts-shared'

const RULES_KEY = 'post_rules'
/** A post another of our bots just sent is filed under its real sender within seconds; the rule waits that out. */
const RULE_DELAY_SEC = 20
const MEDIA_KEYS = ['photo', 'video', 'animation', 'document', 'audio', 'voice', 'video_note', 'sticker'] as const
const CONTENT_KEYS = ['text', 'poll', ...MEDIA_KEYS] as const

// --- Rules -----------------------------------------------------------------------

export async function getRules(): Promise<ChannelRule[]> {
  const r = await rows<{ value: string }>(sql`SELECT value FROM tg_settings WHERE key = ${RULES_KEY}`)
  const list = parse<Partial<ChannelRule>[]>(r[0]?.value, [])
  return (Array.isArray(list) ? list : [])
    .filter((rule) => rule && rule.chatId && Number(rule.botId) > 0)
    .map((rule) => ({
      botId: Number(rule.botId),
      chatId: String(rule.chatId),
      title: String(rule.title ?? rule.chatId),
      enabled: Boolean(rule.enabled),
      signature: String(rule.signature ?? ''),
      sponsorId: String(rule.sponsorId ?? ''),
      buttons: normalizeContent({ buttons: rule.buttons }).buttons,
    }))
}

async function storeRules(rules: ChannelRule[]) {
  await rows(sql`INSERT INTO tg_settings (key, value) VALUES (${RULES_KEY}, ${JSON.stringify(rules)}) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`)
}

export async function saveRule(input: { botId: number; chatId: string; enabled: boolean; signature: string; sponsorId: string; buttons: unknown }): Promise<SendOutcome> {
  await ensurePostTables()
  const buttons = normalizeContent({ buttons: input.buttons }).buttons
  const signature = String(input.signature ?? '').replace(/\r/g, '').trim().slice(0, SIGNATURE_LIMIT)
  const sponsorId = String(input.sponsorId ?? '').slice(0, 80)
  if (!signature && !sponsorId && !buttons.length) return { ok: false, message: 'Kural boş. İmza, sponsor imzası ya da en az bir buton ekle.' }
  const problems = [...new Set(buttonProblems(buttons.flat()))]
  if (problems.length) return { ok: false, message: problems.join(' ') }
  if (!(await botListens(input.botId))) {
    return { ok: false, message: 'Bu bot bildirim dinlemiyor, kanala düşen postları göremez. “Yeni post” sekmesinde botu seçip “Dinlemeyi aç”a bas ya da dinleyen bir bot seç.' }
  }

  const token = await botToken(input.botId)
  let title: string
  let chatId: string
  try {
    const info = await callBot<{ id: number; type: string; title?: string }>(token, 'getChat', { chat_id: input.chatId })
    if (info.type !== 'channel') return { ok: false, message: 'Kural sadece kanallarda çalışır. Gruplarda herkes yazdığı için her mesaja buton eklenmez.' }
    const me = await callBot<{ status: string; can_edit_messages?: boolean }>(token, 'getChatMember', { chat_id: info.id, user_id: Number(token.split(':')[0]) })
    if (me.status !== 'creator' && !(me.status === 'administrator' && me.can_edit_messages)) {
      return { ok: false, message: 'Bot başkasının attığı postu değiştirebilmek için kanalda yönetici olmalı ve “Mesajları düzenle” yetkisi açık olmalı.' }
    }
    title = info.title ?? String(info.id)
    chatId = String(info.id)
  } catch (error) {
    return { ok: false, message: explain(error) }
  }

  const rule: ChannelRule = { botId: input.botId, chatId, title, enabled: Boolean(input.enabled), signature, sponsorId, buttons }
  const others = (await getRules()).filter((r) => !(r.chatId === chatId && r.botId === input.botId))
  await storeRules([...others, rule])
  return { ok: true, message: rule.enabled ? `“${title}” kuralı kaydedildi. Bundan sonra kanala panel dışından düşen postlara uygulanır.` : `“${title}” kuralı kaydedildi, şu an kapalı.` }
}

export async function deleteRule(botId: number, chatId: string): Promise<SendOutcome> {
  const rules = await getRules()
  const kept = rules.filter((r) => !(r.chatId === chatId && r.botId === botId))
  if (kept.length === rules.length) return { ok: false, message: 'Kural bulunamadı.' }
  await storeRules(kept)
  return { ok: true, message: 'Kural silindi. Daha önce eklenen imza ve butonlar postlarda kalır.' }
}

// --- Posts made outside the panel ------------------------------------------------

/** Only channels the panel already posts to are followed; a source channel the bot merely reads is not. */
async function follows(botId: number, chatId: string) {
  const target = await rows(sql`SELECT 1 FROM tg_targets WHERE active AND bot_id = ${botId} AND chat_id = ${chatId} LIMIT 1`)
  if (target.length) return true
  const { getHub } = await import('@/lib/tg-hub')
  const hub = await getHub().catch(() => null)
  return Boolean(hub && hub.guardBotId === botId && hub.groups.some((g) => g.chatId === chatId))
}

/** Adds a later part of an album to the record its first part opened. Returns false when there is no such record yet. */
async function joinAlbum(chatId: string, groupKey: string, m: TgMessage, text: { html: string; locked: boolean; note: string } | null) {
  const joined = await rows<{ post_id: number }>(sql`UPDATE tg_post_sends
    SET message_ids = (message_ids::jsonb || ${JSON.stringify([m.message_id])}::jsonb)::text${text ? sql`, main_id = ${m.message_id}` : sql``}
    WHERE chat_id = ${chatId} AND group_key = ${groupKey} RETURNING post_id`)
  if (!joined.length) return false
  if (text) await rows(sql`UPDATE tg_posts SET text = ${text.html}, locked = ${text.locked}, note = ${text.note} WHERE id = ${Number(joined[0].post_id)}`)
  return true
}

/**
 * Files a post that reached a followed channel from outside the panel (typed on a phone, or sent by a bot that keeps
 * no record), so it shows in the sent list and can get buttons. Never touches Telegram; the channel rule runs later.
 */
export async function noteChannelPost(botId: number, m: TgMessage) {
  if (m.chat.type !== 'channel' || !CONTENT_KEYS.some((k) => k in m)) return
  await ensurePostTables()
  const chatId = String(m.chat.id)
  if (!(await follows(botId, chatId))) return
  const known = await rows(sql`SELECT 1 FROM tg_post_sends WHERE chat_id = ${chatId} AND message_ids::jsonb @> ${JSON.stringify([m.message_id])}::jsonb LIMIT 1`)
  if (known.length) return

  const raw = m.text ?? m.caption ?? ''
  const { html, lossless } = entitiesToHtml(raw, m.entities ?? m.caption_entities ?? [])
  const text = {
    html: lossless ? html : '',
    locked: !lossless,
    note: lossless ? '' : `Yazısında özel emoji ya da panelin yeniden kuramadığı bir biçim var; yazısı panelden değişmez, buton eklenebilir. “${raw.replace(/\s+/g, ' ').slice(0, 80)}”`,
  }
  const groupKey = m.media_group_id ? String(m.media_group_id) : null
  if (groupKey && (await joinAlbum(chatId, groupKey, m, raw ? text : null))) return

  const rule = (await getRules()).some((r) => r.enabled && r.chatId === chatId && r.botId === botId)
  const [post] = await rows<{ id: number }>(sql`INSERT INTO tg_posts (origin, note, author, bot_id, text, locked, rule_pending)
    VALUES ('manual', ${text.note}, ${String(m.author_signature ?? '').slice(0, 80)}, ${botId}, ${text.html}, ${text.locked}, ${rule}) RETURNING id`)
  const made = await rows(sql`INSERT INTO tg_post_sends (post_id, bot_id, chat_id, chat_title, chat_username, message_ids, main_id, main_media, group_key)
    VALUES (${Number(post.id)}, ${botId}, ${chatId}, ${m.chat.title ?? chatId}, ${m.chat.username ?? null}, ${JSON.stringify([m.message_id])}, ${m.message_id},
      ${MEDIA_KEYS.some((k) => k in m)}, ${groupKey}) ON CONFLICT DO NOTHING RETURNING id`)
  if (made.length) return
  // Another part of the same album was filed first, a moment ago.
  await rows(sql`DELETE FROM tg_posts WHERE id = ${Number(post.id)}`)
  if (groupKey) await joinAlbum(chatId, groupKey, m, raw ? text : null)
}

async function applyRule(postId: number, rules: ChannelRule[]) {
  const post = await getPost(postId)
  const [send] = await liveSends(postId)
  if (!post || !send) return
  const rule = rules.find((r) => r.enabled && r.chatId === send.chatId && r.botId === send.botId)
  if (!rule) return

  const notes: string[] = []
  const album = send.mainMedia && send.ids.length > 1
  const buttons = album ? [] : rule.buttons
  if (album && rule.buttons.length) notes.push('Telegram albümün altına buton koymuyor; butonlar eklenmedi.')
  if (needsListener(buttons) && !(await botListens(rule.botId))) return void (await fail(send.id, 'Kural uygulanamadı: bot buton basışlarını dinlemiyor.'))

  const sponsor = rule.sponsorId ? (await sponsors().catch(() => [])).find((s) => s.id === rule.sponsorId) : null
  const extra = [rule.signature ? escapeText(rule.signature) : '', signatureHtml(sponsor)].filter(Boolean).join('\n')
  let text = post.content.text
  if (extra) {
    const signed = [text, extra].filter(Boolean).join('\n\n')
    if (post.locked) notes.push('Yazıda özel emoji ya da özel biçim olduğu için imza eklenmedi.')
    else if (visibleLength(signed) > (send.mainMedia ? CAPTION_LIMIT : TEXT_LIMIT)) notes.push('İmza eklenince yazı Telegram sınırını aşıyor; imza eklenmedi.')
    else text = signed
  }
  if (text === post.content.text && !buttons.length) return void (notes.length && (await fail(send.id, notes.join(' '))))

  let outcome = await editPost(postId, { text, buttons })
  if (!outcome.ok && text !== post.content.text) {
    // A sticker or a poll has no text to add to; the buttons can still go on.
    notes.push('İmza eklenemedi.')
    outcome = buttons.length ? await editPost(postId, { text: post.content.text, buttons }) : outcome
  }
  if (!outcome.ok) notes.push(`Kural uygulanamadı: ${outcome.message}`)
  if (notes.length) await fail(send.id, notes.join(' '))
}

const fail = (sendId: number, note: string) => rows(sql`UPDATE tg_post_sends SET error = ${note.slice(0, 400)} WHERE id = ${sendId}`)

/** Called from the traffic-driven tick: puts the channel's signature and buttons on posts that arrived from outside the panel. */
export async function applyPendingRules() {
  await ensurePostTables()
  const due = await rows<{ id: number }>(sql`UPDATE tg_posts SET rule_pending = false WHERE id IN (
      SELECT p.id FROM tg_posts p WHERE p.origin = 'manual' AND p.rule_pending
        AND EXISTS (SELECT 1 FROM tg_post_sends s WHERE s.post_id = p.id AND s.sent_at < now() - make_interval(secs => ${RULE_DELAY_SEC}))
      ORDER BY p.id LIMIT 10 FOR UPDATE SKIP LOCKED) RETURNING id`)
  if (!due.length) return
  const rules = await getRules()
  for (const d of due) await applyRule(Number(d.id), rules).catch((error) => console.error('[tg-posts] rule not applied', error))
}
