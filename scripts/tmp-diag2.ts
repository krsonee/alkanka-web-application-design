import { rows, sql } from '@/lib/db'
import { botToken, callBot } from '@/lib/telegram-mirror'
async function main() {
  const t = await botToken(4)
  const me = await callBot<{ id: number }>(t, 'getMe')
  for (const s of await rows(sql`SELECT chat_id, title FROM odds_sources`)) {
    try {
      const c = await callBot<Record<string, unknown>>(t, 'getChat', { chat_id: s.chat_id })
      const m = await callBot<Record<string, unknown>>(t, 'getChatMember', { chat_id: s.chat_id, user_id: me.id })
      console.log('SRC', s.title, 'type=', c.type, 'status=', m.status, 'linked=', c.linked_chat_id)
    } catch (e) { console.log('SRC', s.title, 'HATA', (e as Error).message) }
  }
  const h = await rows(sql`SELECT key, left(value, 1500) v FROM tg_settings WHERE key LIKE 'hub%' OR key LIKE 'tg_hub%'`)
  for (const r of h) console.log('HUB', r.key, r.v)
  try { console.log('ODDS_ROWS', JSON.stringify(await rows(sql`SELECT count(*), max(created_at) FROM special_odds`))) } catch (e) { console.log(e) }
}
main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1) })
