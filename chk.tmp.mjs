import { neon } from '@neondatabase/serverless'
import { createDecipheriv, createHash } from 'node:crypto'
const sql = neon(process.env.DATABASE_URL)
const [r] = await sql`SELECT token_enc FROM tg_bots WHERE id = 11`
const key = createHash('sha256').update(`tg-token:${process.env.BETTER_AUTH_SECRET}`).digest()
const [iv, tag, data] = String(r.token_enc).split('.').map((p) => Buffer.from(p, 'base64'))
const d = createDecipheriv('aes-256-gcm', key, iv); d.setAuthTag(tag)
const token = Buffer.concat([d.update(data), d.final()]).toString('utf8')
const chat = '-1004352437824'
const call = async (m, b) => (await fetch(`https://api.telegram.org/bot${token}/${m}`, { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify(b) })).json()
let undeletable = []
async function chunk(ids) {
  const res = await call('deleteMessages', { chat_id: chat, message_ids: ids })
  if (res.ok) return ids.length
  if (res.error_code === 429) { await new Promise(r => setTimeout(r, (res.parameters?.retry_after ?? 3) * 1000 + 300)); return chunk(ids) }
  if (ids.length === 1) { undeletable.push(ids[0]); return 0 }
  const h = Math.ceil(ids.length / 2)
  return (await chunk(ids.slice(0, h))) + (await chunk(ids.slice(h)))
}
await sql`DELETE FROM tg_wipe WHERE chat_id = ${chat}`
let ok = 0
for (let next = 22400; next >= 1; next -= 100) {
  const ids = []; for (let i = next; i > Math.max(0, next - 100); i--) ids.push(i)
  ok += await chunk(ids)
}
console.log('ok batches ids', ok, 'undeletable', undeletable.length, undeletable.slice(0, 40))
