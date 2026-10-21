import 'server-only'
import { generateText } from 'ai'
import { rows, sql } from '@/lib/db'
import { botToken, callBot } from '@/lib/telegram-mirror'
import type { TgMessage } from '@/lib/telegram-chat'
import { ensureHubTables, getHub, modLog, who, type TgCallback, type TgUser } from '@/lib/tg-hub'
import type { HubConfig, SponsorSupportStat, TicketRow } from '@/lib/tg-hub-shared'

const AI_MODEL = 'google/gemini-3.5-flash'
const MAX_OPEN_PER_USER = 3
const GENERAL = 'Alkanka (genel)'

let supportReady: Promise<void> | null = null
export function ensureSupportTables() {
  supportReady ??= (async () => {
    await ensureHubTables()
    await rows(sql`CREATE TABLE IF NOT EXISTS tg_tickets (
      id serial PRIMARY KEY, tg_id bigint NOT NULL, name text NOT NULL, username text, sponsor text NOT NULL, category text NOT NULL,
      text text NOT NULL, status text NOT NULL DEFAULT 'open', answer text, rating int, claimed_by text,
      created_at timestamptz NOT NULL DEFAULT now(), closed_at timestamptz)`)
    await rows(sql`CREATE INDEX IF NOT EXISTS tg_tickets_status_idx ON tg_tickets (status, id DESC)`)
    await rows(sql`CREATE INDEX IF NOT EXISTS tg_tickets_user_idx ON tg_tickets (tg_id, id DESC)`)
    await rows(sql`CREATE TABLE IF NOT EXISTS tg_ticket_msgs (
      chat_id text NOT NULL, message_id bigint NOT NULL, ticket_id int NOT NULL, mode text NOT NULL DEFAULT 'answer', PRIMARY KEY (chat_id, message_id))`)
    await rows(sql`CREATE TABLE IF NOT EXISTS tg_support_state (
      tg_id bigint PRIMARY KEY, step text NOT NULL, sponsor text, category text, pending_text text, pending_msg bigint,
      updated_at timestamptz NOT NULL DEFAULT now())`)
  })().catch((error) => {
    supportReady = null
    throw error
  })
  return supportReady
}

type State = { step: string; sponsor: string | null; category: string | null; pending_text: string | null; pending_msg: number | null }

async function getState(tgId: number): Promise<State | null> {
  const r = await rows(sql`SELECT step, sponsor, category, pending_text, pending_msg FROM tg_support_state
    WHERE tg_id = ${tgId} AND updated_at > now() - interval '2 hours'`)
  if (!r[0]) return null
  return { step: String(r[0].step), sponsor: r[0].sponsor as string | null, category: r[0].category as string | null, pending_text: r[0].pending_text as string | null, pending_msg: r[0].pending_msg == null ? null : Number(r[0].pending_msg) }
}

async function setState(tgId: number, s: Partial<State> & { step: string }) {
  await rows(sql`INSERT INTO tg_support_state (tg_id, step, sponsor, category, pending_text, pending_msg, updated_at)
    VALUES (${tgId}, ${s.step}, ${s.sponsor ?? null}, ${s.category ?? null}, ${s.pending_text ?? null}, ${s.pending_msg ?? null}, now())
    ON CONFLICT (tg_id) DO UPDATE SET step = EXCLUDED.step,
      sponsor = COALESCE(EXCLUDED.sponsor, tg_support_state.sponsor),
      category = COALESCE(EXCLUDED.category, tg_support_state.category),
      pending_text = EXCLUDED.pending_text, pending_msg = EXCLUDED.pending_msg, updated_at = now()`)
}

const clearState = (tgId: number) => rows(sql`DELETE FROM tg_support_state WHERE tg_id = ${tgId}`)

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const STATUS_TR: Record<string, string> = { open: 'Bekliyor', claimed: 'İnceleniyor', resolved: 'Çözüldü', rejected: 'Reddedildi' }

function staffChatsFor(hub: HubConfig, sponsor: string) {
  const chats = new Set<string>()
  if (hub.support.staffChatId) chats.add(hub.support.staffChatId)
  const sp = hub.support.sponsors.find((s) => s.name === sponsor)
  if (sp?.chatId) chats.add(sp.chatId)
  return [...chats]
}

function isStaffChat(hub: HubConfig, chatId: number | string) {
  const id = String(chatId)
  return id === hub.support.staffChatId || hub.support.sponsors.some((s) => s.chatId === id)
}

// --- Menu --------------------------------------------------------------------

async function sendMenu(token: string, hub: HubConfig, chatId: number, tgId: number) {
  await clearState(tgId)
  const sponsors = hub.support.sponsors
  if (!sponsors.length) return sendCategories(token, hub, chatId, tgId, GENERAL, hub.support.welcome)
  const buttons = sponsors.map((s, i) => [{ text: s.name, callback_data: `sp:${i}` }])
  buttons.push([{ text: GENERAL, callback_data: 'sp:-1' }])
  await setState(tgId, { step: 'sponsor' })
  await callBot(token, 'sendMessage', {
    chat_id: chatId,
    text: `${hub.support.welcome}\n\nSorunun hangi siteyle ilgili?`,
    reply_markup: { inline_keyboard: buttons },
  })
}

async function sendCategories(token: string, hub: HubConfig, chatId: number, tgId: number, sponsor: string, intro?: string) {
  await setState(tgId, { step: 'category', sponsor })
  const cats = hub.support.categories.length ? hub.support.categories : ['Diğer']
  const rowsOf: { text: string; callback_data: string }[][] = []
  cats.forEach((c, i) => {
    if (i % 2 === 0) rowsOf.push([])
    rowsOf.at(-1)!.push({ text: c, callback_data: `ct:${i}` })
  })
  await callBot(token, 'sendMessage', {
    chat_id: chatId,
    text: `${intro ? `${intro}\n\n` : ''}Site: ${sponsor}\nKonu ne?`,
    reply_markup: { inline_keyboard: rowsOf },
  })
}

// --- FAQ ---------------------------------------------------------------------

async function faqAnswer(question: string): Promise<string | null> {
  try {
    const { listFaqs } = await import('@/lib/faqs')
    const faqs = (await listFaqs()).filter((f) => f.active).slice(0, 60)
    if (!faqs.length) return null
    const { text } = await generateText({
      model: AI_MODEL,
      prompt: `Bir üyenin destek sorusu var. Aşağıdaki SSS listesinde bu soruyu KESİN olarak cevaplayan bir madde varsa,
o maddeye dayanarak kısa, samimi bir Türkçe cevap yaz. Emin değilsen, hesap/ödeme gibi kişiye özel bir inceleme gerekiyorsa
ya da SSS bunu kapsamıyorsa null döndür. Sadece JSON döndür: {"answer": "..." } veya {"answer": null}

SSS:
${faqs.map((f, i) => `${i + 1}. S: ${f.question}\n   C: ${f.answer.replace(/<[^>]+>/g, ' ').slice(0, 400)}`).join('\n')}

ÜYE SORUSU:
${question.slice(0, 800)}`,
    })
    const json = text.match(/\{[\s\S]*\}/)?.[0]
    const parsed = json ? (JSON.parse(json) as { answer?: string | null }) : null
    const answer = parsed?.answer?.trim()
    return answer && answer.length > 5 ? answer.slice(0, 1500) : null
  } catch (error) {
    console.error('[tg-support] faq failed', error)
    return null
  }
}

// --- Tickets -----------------------------------------------------------------

async function createTicket(token: string, hub: HubConfig, user: TgUser, chatId: number, state: State, text: string, sourceMsg: number | null) {
  const [{ n }] = await rows<{ n: string }>(sql`SELECT count(*) AS n FROM tg_tickets WHERE tg_id = ${user.id} AND status IN ('open','claimed')`)
  if (Number(n) >= MAX_OPEN_PER_USER) {
    await callBot(token, 'sendMessage', { chat_id: chatId, text: `Şu an ${n} açık talebin var. Yeni talep açmadan önce onların cevaplanmasını bekle. Durumu görmek için /durum yaz.` })
    await clearState(user.id)
    return
  }
  const sponsor = state.sponsor ?? GENERAL
  const category = state.category ?? 'Diğer'
  const name = [user.first_name, user.last_name].filter(Boolean).join(' ') || 'Üye'
  const [t] = await rows<{ id: number }>(sql`INSERT INTO tg_tickets (tg_id, name, username, sponsor, category, text)
    VALUES (${user.id}, ${name}, ${user.username ?? null}, ${sponsor}, ${category}, ${text.slice(0, 3000) || '[Medya]'}) RETURNING id`)
  await clearState(user.id)

  const header = `<b>Destek talebi #${t.id}</b>\nSite: ${esc(sponsor)}\nKonu: ${esc(category)}\nÜye: ${esc(who(user))}\n\n${esc(text.slice(0, 3000) || '[Medya ekli]')}\n\n<i>Cevap vermek için bu mesaja yanıt yaz. Reddetmek için yanıtın başına /red yaz.</i>`
  const keyboard = { inline_keyboard: [[{ text: 'Üstlen', callback_data: `tk:claim:${t.id}` }, { text: 'Çözüldü', callback_data: `tk:ok:${t.id}` }, { text: 'Reddet', callback_data: `tk:rej:${t.id}` }]] }
  const chats = staffChatsFor(hub, sponsor)
  if (!chats.length) console.error('[tg-support] no staff chat configured')
  for (const c of chats) {
    const sent = await callBot<{ message_id: number }>(token, 'sendMessage', { chat_id: c, text: header, parse_mode: 'HTML', reply_markup: keyboard }).catch((e) => {
      console.error('[tg-support] staff send failed', e)
      return null
    })
    if (sent) await rows(sql`INSERT INTO tg_ticket_msgs (chat_id, message_id, ticket_id) VALUES (${c}, ${sent.message_id}, ${t.id}) ON CONFLICT DO NOTHING`)
    if (sent && sourceMsg) {
      const copy = await callBot<{ message_id: number }>(token, 'copyMessage', { chat_id: c, from_chat_id: chatId, message_id: sourceMsg, reply_parameters: { message_id: sent.message_id, allow_sending_without_reply: true } }).catch(() => null)
      if (copy) await rows(sql`INSERT INTO tg_ticket_msgs (chat_id, message_id, ticket_id) VALUES (${c}, ${copy.message_id}, ${t.id}) ON CONFLICT DO NOTHING`)
    }
  }
  await callBot(token, 'sendMessage', {
    chat_id: chatId,
    text: `Talebin alındı. Numaran: #${t.id}\nYetkililer en kısa sürede cevap verecek, cevap buraya gelecek. Eklemek istediğin bir şey olursa buraya yazman yeterli.`,
  })
}

async function appendToTicket(token: string, hub: HubConfig, user: TgUser, m: TgMessage, ticket: { id: number; sponsor: string }) {
  for (const c of staffChatsFor(hub, ticket.sponsor)) {
    const head = await callBot<{ message_id: number }>(token, 'sendMessage', { chat_id: c, text: `Bilet #${ticket.id} için ek mesaj (${who(user)}):` }).catch(() => null)
    const copy = await callBot<{ message_id: number }>(token, 'copyMessage', { chat_id: c, from_chat_id: m.chat.id, message_id: m.message_id }).catch(() => null)
    for (const id of [head?.message_id, copy?.message_id]) {
      if (id) await rows(sql`INSERT INTO tg_ticket_msgs (chat_id, message_id, ticket_id) VALUES (${c}, ${id}, ${ticket.id}) ON CONFLICT DO NOTHING`)
    }
  }
  await callBot(token, 'sendMessage', { chat_id: m.chat.id, text: `Mesajın #${ticket.id} numaralı talebine eklendi.` })
}

async function closeTicket(token: string, ticketId: number, status: 'resolved' | 'rejected', answer: string, staff: TgUser | undefined) {
  const r = await rows(sql`UPDATE tg_tickets SET status = ${status}, answer = ${answer.slice(0, 3000)}, closed_at = now(),
      claimed_by = COALESCE(claimed_by, ${staff ? who(staff) : null})
    WHERE id = ${ticketId} AND status IN ('open','claimed') RETURNING tg_id, sponsor`)
  if (!r[0]) return false
  const text =
    status === 'resolved'
      ? `Talep #${ticketId} çözüldü.\n\nYetkili cevabı:\n${answer}`
      : `Talep #${ticketId} reddedildi.\n\nNeden:\n${answer}\n\nYeni bir sorun için /destek yazabilirsin.`
  await callBot(token, 'sendMessage', {
    chat_id: Number(r[0].tg_id),
    text: text.slice(0, 4000),
    reply_markup: { inline_keyboard: [[1, 2, 3, 4, 5].map((n) => ({ text: '★'.repeat(n), callback_data: `rt:${ticketId}:${n}` }))] },
  }).catch((e) => console.error('[tg-support] user notify failed', e))
  await modLog({ action: status === 'resolved' ? 'Destek çözüldü' : 'Destek reddedildi', reason: `#${ticketId} (${r[0].sponsor}) · ${staff ? who(staff) : 'panel'}`, notify: false })
  return true
}

async function markStaffMessages(token: string, ticketId: number, label: string) {
  const msgs = await rows<{ chat_id: string; message_id: string }>(sql`SELECT chat_id, min(message_id) AS message_id FROM tg_ticket_msgs WHERE ticket_id = ${ticketId} GROUP BY chat_id`)
  for (const s of msgs) {
    await callBot(token, 'editMessageReplyMarkup', { chat_id: s.chat_id, message_id: Number(s.message_id), reply_markup: { inline_keyboard: [[{ text: label, callback_data: 'tk:noop:0' }]] } }).catch(() => null)
  }
}

// --- Entry points ------------------------------------------------------------

export async function handleSupportMessage(botId: number, m: TgMessage): Promise<boolean> {
  await ensureSupportTables()
  const hub = await getHub()
  const token = await botToken(botId)
  if (!m.from || m.from.is_bot) return false

  if (m.chat.type !== 'private') {
    if (!isStaffChat(hub, m.chat.id)) return false
    const text = (m.text ?? m.caption ?? '').trim()
    if (/^\/acik(@\w+)?$/i.test(text)) {
      const open = await rows(sql`SELECT id, sponsor, category, name FROM tg_tickets WHERE status IN ('open','claimed') ORDER BY id LIMIT 20`)
      await callBot(token, 'sendMessage', { chat_id: m.chat.id, text: open.length ? `Açık talepler:\n${open.map((o) => `#${o.id} · ${o.sponsor} · ${o.category} · ${o.name}`).join('\n')}` : 'Açık talep yok.' })
      return true
    }
    const replyTo = m.reply_to_message?.message_id
    if (!replyTo) return false
    const map = await rows<{ ticket_id: number; mode: string }>(sql`SELECT ticket_id, mode FROM tg_ticket_msgs WHERE chat_id = ${String(m.chat.id)} AND message_id = ${replyTo}`)
    if (!map[0]) return false
    const ticketId = Number(map[0].ticket_id)
    const reject = map[0].mode === 'reject' || /^\/red\b/i.test(text)
    const answer = text.replace(/^\/red(@\w+)?\s*/i, '').trim()
    if (!answer) {
      await callBot(token, 'sendMessage', { chat_id: m.chat.id, text: reject ? 'Red nedenini yazmalısın.' : 'Cevap boş olamaz.', reply_parameters: { message_id: m.message_id } })
      return true
    }
    const ok = await closeTicket(token, ticketId, reject ? 'rejected' : 'resolved', answer, m.from)
    if (ok) await markStaffMessages(token, ticketId, `${reject ? 'Reddedildi' : 'Çözüldü'} · ${m.from.first_name ?? ''}`)
    await callBot(token, 'sendMessage', {
      chat_id: m.chat.id,
      text: ok ? `#${ticketId} ${reject ? 'reddedildi' : 'cevaplandı'}, üyeye iletildi.` : `#${ticketId} zaten kapatılmış.`,
      reply_parameters: { message_id: m.message_id, allow_sending_without_reply: true },
    })
    return true
  }

  if (!hub.support.enabled) return false
  const text = (m.text ?? m.caption ?? '').trim()
  const hasMedia = Boolean(m.photo || m.video || (m as { document?: unknown }).document)
  if (/^\/(start|destek|menu|menü)\b/i.test(text)) {
    await sendMenu(token, hub, m.chat.id, m.from.id)
    return true
  }
  if (/^\/durum\b/i.test(text)) {
    const list = await rows(sql`SELECT id, sponsor, status FROM tg_tickets WHERE tg_id = ${m.from.id} ORDER BY id DESC LIMIT 5`)
    await callBot(token, 'sendMessage', {
      chat_id: m.chat.id,
      text: list.length ? `Son taleplerin:\n${list.map((t) => `#${t.id} · ${t.sponsor} · ${STATUS_TR[String(t.status)] ?? t.status}`).join('\n')}` : 'Henüz talebin yok. Yeni talep için /destek yaz.',
    })
    return true
  }

  const state = await getState(m.from.id)
  if (state?.step === 'text') {
    if (!text && !hasMedia) return true
    if (hub.support.aiFaq && text.length >= 8) {
      const answer = await faqAnswer(text)
      if (answer) {
        await setState(m.from.id, { step: 'faq', sponsor: state.sponsor, category: state.category, pending_text: text, pending_msg: hasMedia ? m.message_id : null })
        await callBot(token, 'sendMessage', {
          chat_id: m.chat.id,
          text: `${answer}\n\nBu cevap işini gördü mü?`,
          reply_markup: { inline_keyboard: [[{ text: 'Evet, çözüldü', callback_data: 'fq:ok' }, { text: 'Hayır, yetkiliye ilet', callback_data: 'fq:no' }]] },
        })
        return true
      }
    }
    await createTicket(token, hub, m.from, m.chat.id, state, text, hasMedia ? m.message_id : null)
    return true
  }

  const open = await rows<{ id: number; sponsor: string }>(sql`SELECT id, sponsor FROM tg_tickets WHERE tg_id = ${m.from.id} AND status IN ('open','claimed') ORDER BY id DESC LIMIT 1`)
  if (open[0] && (text || hasMedia)) {
    await appendToTicket(token, hub, m.from, m, { id: Number(open[0].id), sponsor: String(open[0].sponsor) })
    return true
  }
  await sendMenu(token, hub, m.chat.id, m.from.id)
  return true
}

export async function handleSupportCallback(botId: number, q: TgCallback) {
  await ensureSupportTables()
  const hub = await getHub()
  const token = await botToken(botId)
  const answer = (text = '') => callBot(token, 'answerCallbackQuery', { callback_query_id: q.id, text }).catch(() => null)
  const parts = (q.data ?? '').split(':')
  const chatId = q.message?.chat.id
  const removeButtons = () =>
    q.message ? callBot(token, 'editMessageReplyMarkup', { chat_id: q.message.chat.id, message_id: q.message.message_id, reply_markup: { inline_keyboard: [] } }).catch(() => null) : null

  if (parts[0] === 'sp' && chatId) {
    const idx = Number(parts[1])
    const sponsor = idx >= 0 ? hub.support.sponsors[idx]?.name : GENERAL
    await removeButtons()
    await answer()
    if (!sponsor) return sendMenu(token, hub, chatId, q.from.id)
    return sendCategories(token, hub, chatId, q.from.id, sponsor)
  }
  if (parts[0] === 'ct' && chatId) {
    const category = hub.support.categories[Number(parts[1])] ?? 'Diğer'
    const state = await getState(q.from.id)
    await setState(q.from.id, { step: 'text', sponsor: state?.sponsor ?? GENERAL, category })
    await removeButtons()
    await answer()
    await callBot(token, 'sendMessage', {
      chat_id: chatId,
      text: `Konu: ${category}\n\nŞimdi sorununu tek mesajda anlat. Site kullanıcı adını, tutarı ve saati yazarsan çok daha hızlı çözülür. Ekran görüntüsü de ekleyebilirsin.`,
    })
    return
  }
  if (parts[0] === 'fq' && chatId) {
    const state = await getState(q.from.id)
    await removeButtons()
    if (!state || state.step !== 'faq') return answer('Bu işlem zaman aşımına uğradı. /destek yaz.')
    if (parts[1] === 'ok') {
      const name = [q.from.first_name, q.from.last_name].filter(Boolean).join(' ') || 'Üye'
      await rows(sql`INSERT INTO tg_tickets (tg_id, name, username, sponsor, category, text, status, answer, closed_at, claimed_by)
        VALUES (${q.from.id}, ${name}, ${q.from.username ?? null}, ${state.sponsor ?? GENERAL}, ${state.category ?? 'Diğer'},
          ${(state.pending_text ?? '').slice(0, 3000)}, 'resolved', 'Otomatik SSS cevabı', now(), 'Destek botu')`)
      await clearState(q.from.id)
      await answer('Harika!')
      await callBot(token, 'sendMessage', { chat_id: chatId, text: 'Sevindim! Başka bir sorun olursa /destek yazman yeterli.' })
      return
    }
    await answer()
    return createTicket(token, hub, q.from, chatId, state, state.pending_text ?? '', state.pending_msg)
  }
  if (parts[0] === 'rt') {
    const rating = Math.max(1, Math.min(5, Number(parts[2])))
    await rows(sql`UPDATE tg_tickets SET rating = ${rating} WHERE id = ${Number(parts[1])} AND tg_id = ${q.from.id}`)
    await removeButtons()
    return answer('Puanın için teşekkürler!')
  }
  if (parts[0] === 'tk' && q.message) {
    const ticketId = Number(parts[2])
    if (!isStaffChat(hub, q.message.chat.id) || !ticketId) return answer()
    if (parts[1] === 'claim') {
      const r = await rows(sql`UPDATE tg_tickets SET status = 'claimed', claimed_by = ${who(q.from)} WHERE id = ${ticketId} AND status = 'open' RETURNING tg_id`)
      if (!r[0]) return answer('Bu talep zaten üstlenilmiş ya da kapalı.')
      await callBot(token, 'sendMessage', { chat_id: Number(r[0].tg_id), text: `Talep #${ticketId} bir yetkili tarafından inceleniyor.` }).catch(() => null)
      await callBot(token, 'sendMessage', { chat_id: q.message.chat.id, text: `#${ticketId} ${q.from.first_name ?? 'yetkili'} tarafından üstlenildi.`, reply_parameters: { message_id: q.message.message_id } }).catch(() => null)
      return answer('Üstlendin. Cevabı bu mesaja yanıt olarak yaz.')
    }
    if (parts[1] === 'ok') {
      const ok = await closeTicket(token, ticketId, 'resolved', 'Sorunun çözüldü. Kontrol edebilirsin.', q.from)
      if (ok) await markStaffMessages(token, ticketId, `Çözüldü · ${q.from.first_name ?? ''}`)
      return answer(ok ? 'Çözüldü olarak kapatıldı.' : 'Zaten kapalı.')
    }
    if (parts[1] === 'rej') {
      const prompt = await callBot<{ message_id: number }>(token, 'sendMessage', {
        chat_id: q.message.chat.id,
        text: `#${ticketId} için red nedenini bu mesaja YANIT olarak yaz. Neden üyeye iletilecek.`,
        reply_parameters: { message_id: q.message.message_id, allow_sending_without_reply: true },
        reply_markup: { force_reply: true, selective: true },
      }).catch(() => null)
      if (prompt) await rows(sql`INSERT INTO tg_ticket_msgs (chat_id, message_id, ticket_id, mode) VALUES (${String(q.message.chat.id)}, ${prompt.message_id}, ${ticketId}, 'reject') ON CONFLICT DO NOTHING`)
      return answer()
    }
  }
  return answer()
}

// --- Panel / reports ---------------------------------------------------------

export async function listTickets(filter: 'open' | 'all' = 'open', limit = 40): Promise<TicketRow[]> {
  await ensureSupportTables()
  const r =
    filter === 'open'
      ? await rows(sql`SELECT * FROM tg_tickets WHERE status IN ('open','claimed') ORDER BY id DESC LIMIT ${limit}`)
      : await rows(sql`SELECT * FROM tg_tickets ORDER BY id DESC LIMIT ${limit}`)
  return r.map((t) => ({
    id: Number(t.id),
    name: String(t.name),
    username: (t.username as string | null) ?? null,
    sponsor: String(t.sponsor),
    category: String(t.category),
    text: String(t.text),
    status: String(t.status) as TicketRow['status'],
    answer: (t.answer as string | null) ?? null,
    rating: t.rating == null ? null : Number(t.rating),
    createdAt: new Date(String(t.created_at)).toISOString(),
    closedAt: t.closed_at ? new Date(String(t.closed_at)).toISOString() : null,
  }))
}

export async function panelCloseTicket(ticketId: number, status: 'resolved' | 'rejected', answer: string) {
  const hub = await getHub()
  if (!hub.supportBotId) throw new Error('Destek botu seçili değil')
  if (answer.trim().length < 2) throw new Error('Cevap/neden yazmalısın')
  const token = await botToken(hub.supportBotId)
  const ok = await closeTicket(token, ticketId, status, answer.trim(), undefined)
  if (ok) await markStaffMessages(token, ticketId, status === 'resolved' ? 'Çözüldü · panel' : 'Reddedildi · panel')
  return ok
}

export async function sponsorSupportStats(days = 7): Promise<SponsorSupportStat[]> {
  await ensureSupportTables()
  const r = await rows(sql`SELECT sponsor, count(*) AS total,
      count(*) FILTER (WHERE status = 'resolved') AS resolved,
      count(*) FILTER (WHERE status = 'rejected') AS rejected,
      avg(EXTRACT(EPOCH FROM closed_at - created_at) / 60) FILTER (WHERE closed_at IS NOT NULL AND answer <> 'Otomatik SSS cevabı') AS avg_min,
      avg(rating) AS rating
    FROM tg_tickets WHERE created_at > now() - make_interval(days => ${days}) GROUP BY sponsor ORDER BY total DESC`)
  return r.map((x) => ({
    sponsor: String(x.sponsor),
    total: Number(x.total),
    resolved: Number(x.resolved),
    rejected: Number(x.rejected),
    avgMin: x.avg_min == null ? null : Math.round(Number(x.avg_min)),
    rating: x.rating == null ? null : Math.round(Number(x.rating) * 10) / 10,
  }))
}
