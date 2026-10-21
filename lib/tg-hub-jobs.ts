import 'server-only'
import { rows, sql } from '@/lib/db'
import { botToken, callBot } from '@/lib/telegram-mirror'
import { chatLeaderboard, ensureHubTables, getHub, hubStats, modLog, processBroadcasts, weekStart } from '@/lib/tg-hub'

async function claimOnce(key: string) {
  const r = await rows(sql`INSERT INTO tg_settings (key, value) VALUES (${key}, ${new Date().toISOString()}) ON CONFLICT (key) DO NOTHING RETURNING key`)
  return r.length > 0
}

/** Monday job: pays the weekly chat counter rewards and sends the summary report to the log group. */
export async function runWeeklyHub(force = false) {
  await ensureHubTables()
  const hub = await getHub()
  const thisWeek = weekStart()
  if (!force && !(await claimOnce(`hub_weekly_${thisWeek.slice(0, 10)}`))) return null
  const lastWeek = weekStart(1)
  const board = await chatLeaderboard(lastWeek, thisWeek, 10)
  const { leaderboardText } = await import('@/lib/tg-guard')
  const paid: string[] = []

  if (hub.counter.enabled && !force) {
    const { credit } = await import('@/lib/member')
    for (const [i, b] of board.entries()) {
      const amount = hub.counter.rewards[i]
      if (!amount || b.key.startsWith('tg:')) continue
      await credit(b.key, amount).catch((e) => console.error('[hub-weekly] credit failed', e))
      paid.push(`${b.name} +${amount} KC`)
    }
    const botId = hub.guardBotId ?? hub.supportBotId
    const chatId = hub.counter.postToChatId || hub.groups[0]?.chatId
    if (botId && chatId) {
      await callBot(await botToken(botId), 'sendMessage', {
        chat_id: chatId,
        text: `${leaderboardText(board, hub.counter.rewards, 'Geçen haftanın en çok yazanları')}\n\nÖdüller sitede hesabını bağlamış üyelerin cüzdanına yüklendi. Bu hafta liste sıfırdan başladı!`,
      }).catch((e) => console.error('[hub-weekly] post failed', e))
    }
  }

  if (!hub.report.enabled && !force) return { board, paid }
  const stats = await hubStats()
  const { sponsorSupportStats } = await import('@/lib/tg-support')
  const support = await sponsorSupportStats(7)
  const [dm] = await rows<{ sent: string; n: string }>(sql`SELECT COALESCE(sum(sent),0) AS sent, count(*) AS n FROM tg_broadcasts WHERE created_at > now() - interval '7 days'`)
  const [share] = await rows<{ n: string }>(sql`SELECT count(*) AS n FROM tg_share_log WHERE status = 'sent' AND created_at > now() - interval '7 days'`).catch(() => [{ n: '0' }])
  const report = [
    'Alkanka Haftalık Telegram Raporu',
    '',
    'GÜVENLİK',
    `Silinen mesaj: ${stats.deletedWeek} · Susturma: ${stats.mutedWeek} · Ban: ${stats.bannedWeek}`,
    `Engellenen giriş (bot/spam/taklit): ${stats.joinsBlockedWeek} · Global ban listesi: ${stats.globalBans}`,
    '',
    'DESTEK',
    `Açık talep: ${stats.openTickets} · Bu hafta çözülen: ${stats.resolvedWeek}${stats.avgResolveMin != null ? ` · Ortalama çözüm: ${stats.avgResolveMin} dk` : ''}`,
    ...(support.length
      ? support.map((s) => `- ${s.sponsor}: ${s.total} talep, ${s.resolved} çözüldü, ${s.rejected} red${s.avgMin != null ? `, ort. ${s.avgMin} dk` : ''}${s.rating != null ? `, puan ${s.rating}/5` : ''}`)
      : ['- Bu hafta talep yok']),
    '',
    'SOHBET',
    ...(board.length ? board.slice(0, 5).map((b, i) => `${i + 1}. ${b.name} · ${b.count} mesaj`) : ['Sayılan mesaj yok']),
    ...(paid.length ? [`Ödenen: ${paid.join(', ')}`] : []),
    '',
    'PAYLAŞIM',
    `Postçu paylaşımı: ${Number(share?.n ?? 0)} · DM duyuru: ${Number(dm.n)} adet, ${Number(dm.sent)} kişiye ulaştı`,
  ].join('\n')
  await modLog({ action: 'Haftalık rapor', reason: report.slice(0, 480), notify: false })
  const botId = hub.guardBotId ?? hub.supportBotId
  if (botId && hub.logChatId) {
    await callBot(await botToken(botId), 'sendMessage', { chat_id: hub.logChatId, text: report.slice(0, 4000) }).catch((e) => console.error('[hub-weekly] report failed', e))
  }
  return { board, paid, report }
}

/** Runs every minute from the traffic-driven tick. */
export async function hubTick() {
  const hub = await getHub()
  const { expireCaptchas, flushAutoDelete } = await import('@/lib/tg-guard')
  await Promise.all([
    hub.guard.enabled ? expireCaptchas().catch((e) => console.error('[hub-tick] captcha', e)) : null,
    flushAutoDelete().catch((e) => console.error('[hub-tick] autodel', e)),
    processBroadcasts().catch((e) => console.error('[hub-tick] broadcast', e)),
  ])
  // Monday after 00:00 Istanbul; claimOnce keeps it to a single run per week.
  await runWeeklyHub().catch((e) => console.error('[hub-tick] weekly', e))
  // Keep the guard's message log small; 35 days covers weekly counts and 48h deletions.
  await rows(sql`DELETE FROM tg_guard_msgs WHERE created_at < now() - interval '35 days'`).catch(() => null)
  await rows(sql`DELETE FROM tg_joins WHERE created_at < now() - interval '1 day'`).catch(() => null)
}
