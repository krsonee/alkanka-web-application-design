import { rows, sql } from '@/lib/db'
import { botToken, callBot, fetchChannel } from '@/lib/telegram-mirror'
async function main() {
  const t = await botToken(4)
  for (const s of await rows(sql`SELECT chat_id, title FROM odds_sources`)) {
    try {
      const c = await callBot<Record<string, unknown>>(t, 'getChat', { chat_id: s.chat_id })
      let n = -1
      if (c.username) n = (await fetchChannel(String(c.username)).catch(() => [])).length
      console.log('SRC', s.title, c.type, c.username, 'scraped=', n)
    } catch (e) { console.log('SRC', s.title, 'HATA', (e as Error).message) }
  }
}
main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1) })
