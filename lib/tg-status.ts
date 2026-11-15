import 'server-only'
import { rows, sql } from '@/lib/db'
import { getOddsBotConfig } from '@/lib/special-odds'
import { getInviteConfig } from '@/lib/table-invite'
import { getBotSuite } from '@/lib/telegram-bots'
import { getChatConfig } from '@/lib/telegram-chat'
import { botToken, callBot, ensureTables, listBots } from '@/lib/telegram-mirror'
import { getHub } from '@/lib/tg-hub'
import { NEED_LABEL, byHealth, judgeBot, judgeChat, type BotHealth, type ChatHealth, type ChatNeed, type MemberRights, type TgStatus } from '@/lib/tg-status-shared'

type Usage = { botId: number; chatId: string; title: string; use: string; needs: ChatNeed[] }
type HookInfo = { url: string; pending_update_count: number; last_error_message?: string; last_error_date?: number }

const BATCH = 6

/** Telegram allows bursts, but a status check is never worth tripping its rate limit. */
async function inBatches<T, R>(items: T[], run: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = []
  for (let i = 0; i < items.length; i += BATCH) out.push(...(await Promise.all(items.slice(i, i + BATCH).map(run))))
  return out
}

/** Every place a bot is expected to work, and which rights that job needs there. */
async function collectUsages() {
  const [hub, suite, odds, chat, invite, targets] = await Promise.all([
    getHub(),
    getBotSuite().catch(() => null),
    getOddsBotConfig().catch(() => null),
    getChatConfig().catch(() => null),
    getInviteConfig().catch(() => null),
    rows<{ bot_id: number; chat_id: string; title: string }>(sql`SELECT bot_id, chat_id, title FROM tg_targets WHERE active ORDER BY id`),
  ])
  const usages: Usage[] = []
  const roles = new Map<number, string[]>()
  const role = (botId: number | null | undefined, name: string) => {
    if (!botId) return
    const list = roles.get(botId) ?? []
    if (!list.includes(name)) roles.set(botId, [...list, name])
  }
  const use = (botId: number | null | undefined, chatId: string | null | undefined, title: string, label: string, needs: ChatNeed[]) => {
    if (botId && chatId) usages.push({ botId, chatId: String(chatId), title: title || String(chatId), use: label, needs })
  }

  role(hub.guardBotId, 'Bekçi')
  role(hub.supportBotId, 'Destek')
  for (const g of hub.groups) {
    if (g.type === 'channel') use(hub.guardBotId, g.chatId, g.title, 'Bekçi (kanal)', hub.shield.channelJoinAlert > 0 ? ['delete', 'restrict'] : ['delete'])
    else use(hub.guardBotId, g.chatId, g.title, 'Bekçi', ['delete', 'restrict', 'invite'])
  }
  use(hub.guardBotId ?? hub.supportBotId, hub.logChatId, hub.logChatTitle, 'Kayıt grubu', ['write'])
  use(hub.guardBotId, hub.counter.postToChatId, hub.groups.find((g) => g.chatId === hub.counter.postToChatId)?.title ?? '', 'Haftalık sıralama', ['write'])
  use(hub.supportBotId, hub.support.staffChatId, hub.support.staffChatTitle, 'Destek yetkili grubu', ['write'])
  for (const s of hub.support.sponsors) use(hub.supportBotId, s.chatId, s.title, `Sponsor destek: ${s.name}`, ['write'])

  for (const t of targets) {
    role(Number(t.bot_id), 'Post hedefi var')
    use(Number(t.bot_id), t.chat_id, t.title, 'Post hedefi', ['write'])
  }
  if (suite) {
    role(suite.share.botId, 'Postçu')
    if (suite.approvals.enabled) {
      role(suite.approvals.botId, 'Bildirim')
      use(suite.approvals.botId, suite.approvals.chatId, suite.approvals.chatTitle, 'Bildirim botu', ['write'])
    }
  }
  if (odds?.enabled) {
    role(odds.botId, 'Özel Oran')
    use(odds.botId, odds.channelId, odds.channelTitle, 'Özel oran kanalı', ['write'])
  }
  if (chat) {
    role(chat.botId, 'Canlı Sohbet')
    use(chat.botId, chat.chatId, chat.title, 'Canlı sohbet', ['write'])
  }
  if (invite) {
    role(invite.botId, 'Masa daveti')
    use(invite.botId, invite.chatId, invite.title, 'Masa daveti', ['write'])
  }
  return { usages, roles, mustListen: new Set([hub.guardBotId, hub.supportBotId, chat?.botId].filter((id): id is number => Boolean(id))), chatBotId: chat?.botId ?? null, oddsBotId: odds?.botId ?? null }
}

/** Live check of every bot and every chat a bot works in. Calls Telegram, so it runs on request only. */
export async function loadTgStatus(): Promise<TgStatus> {
  await ensureTables()
  const [bots, plan, secrets] = await Promise.all([
    listBots(),
    collectUsages(),
    rows<{ key: string }>(sql`SELECT key FROM tg_settings WHERE key LIKE 'hook_secret_%'`),
  ])
  const hasSecret = new Set(secrets.map((s) => Number(s.key.replace('hook_secret_', ''))))
  const now = Date.now()
  const tokens = new Map<number, string>()
  const sameName = (name: string) => bots.filter((b) => b.name.trim().toLocaleLowerCase('tr') === name.trim().toLocaleLowerCase('tr')).length > 1

  const botHealth = await inBatches(bots, async (b): Promise<BotHealth> => {
    const roles = plan.roles.get(b.id) ?? []
    const base = { id: b.id, username: b.username, name: b.name, roles }
    try {
      const token = await botToken(b.id)
      const info = await callBot<HookInfo>(token, 'getWebhookInfo')
      tokens.set(b.id, token)
      const verdict = judgeBot({
        roles,
        listens: plan.mustListen.has(b.id) || hasSecret.has(b.id),
        ownPaths: [`/api/telegram/hook/${b.id}`, ...(plan.chatBotId === b.id ? ['/api/telegram/webhook'] : []), ...(plan.oddsBotId === b.id ? ['/api/telegram/odds'] : [])],
        url: info.url ?? '',
        pending: Number(info.pending_update_count ?? 0),
        lastError: info.last_error_message ?? null,
        lastErrorAt: info.last_error_date ? info.last_error_date * 1000 : null,
        now,
      })
      // Two bots with one display name look identical to members in a group.
      if (verdict.state === 'ok' && !verdict.note && sameName(b.name)) {
        return { ...base, state: 'warn', pending: Number(info.pending_update_count ?? 0), note: 'Görünen adı başka bir botla aynı. BotFather üzerinden değiştir, üyeler karıştırmasın.' }
      }
      return { ...base, ...verdict, pending: Number(info.pending_update_count ?? 0) }
    } catch (error) {
      return { ...base, state: 'bad', pending: 0, note: `Bota ulaşılamadı: ${String((error as Error).message)}` }
    }
  })

  // One row per bot and chat; a chat used for several jobs needs the rights of all of them.
  const pairs = new Map<string, Usage & { uses: string[] }>()
  for (const u of plan.usages) {
    const key = `${u.botId}:${u.chatId}`
    const seen = pairs.get(key)
    if (seen) {
      if (!seen.uses.includes(u.use)) seen.uses.push(u.use)
      seen.needs = [...new Set([...seen.needs, ...u.needs])]
    } else pairs.set(key, { ...u, uses: [u.use] })
  }

  const chatHealth = await inBatches([...pairs.entries()], async ([key, p]): Promise<ChatHealth> => {
    const bot = bots.find((b) => b.id === p.botId)
    const base = { key, chatId: p.chatId, title: p.title, botUsername: bot?.username ?? `#${p.botId}`, uses: p.uses }
    const token = tokens.get(p.botId)
    if (!bot) return { ...base, kind: 'unknown', state: 'bad', missing: [], note: 'Bu iş için seçilen bot silinmiş. Sistem kontrolünden "Kontrol et ve onar".' }
    if (!token) return { ...base, kind: 'unknown', state: 'bad', missing: [], note: 'Bota ulaşılamadığı için kontrol edilemedi.' }
    try {
      const info = await callBot<{ id: number; title?: string; type: string }>(token, 'getChat', { chat_id: p.chatId })
      const member = await callBot<MemberRights>(token, 'getChatMember', { chat_id: info.id, user_id: Number(token.split(':')[0]) })
      const verdict = judgeChat(info.type, member, p.needs)
      return {
        ...base,
        title: info.title ?? p.title,
        kind: info.type === 'channel' ? 'channel' : 'group',
        state: verdict.state,
        missing: verdict.missing.map((n) => NEED_LABEL[n]),
        note: verdict.note,
      }
    } catch (error) {
      return { ...base, kind: 'unknown', state: 'bad', missing: [], note: String((error as Error).message) }
    }
  })

  return { checkedAt: new Date(now).toISOString(), bots: botHealth.sort(byHealth), chats: chatHealth.sort(byHealth) }
}
