import 'server-only'
import { rows, sql } from '@/lib/db'
import { credit } from '@/lib/member'

export type WithdrawStatus = 'pending' | 'approved' | 'rejected'

export type WithdrawShare = {
  id: number
  siteId: string
  userName: string
  siteUsername: string
  amount: number
  paidAt: string
  image: string
  status: WithdrawStatus
  rewardCoin: number
  rewardKp: number
  rewardItem: string | null
  note: string | null
  createdAt: string
}

export type WithdrawSettings = { coin: number; kp: number; item: string; weekly: number }

const DEFAULTS: WithdrawSettings = { coin: 50, kp: 25, item: '', weekly: 3 }

let ready: Promise<unknown> | null = null
function ensure() {
  ready ??= (async () => {
    await rows(sql`CREATE TABLE IF NOT EXISTS withdraw_shares (
      id serial PRIMARY KEY, site_id text NOT NULL, user_id text NOT NULL, user_name text NOT NULL,
      site_username text NOT NULL, amount numeric(12,2) NOT NULL, paid_at timestamptz NOT NULL, image_path text NOT NULL,
      status text NOT NULL DEFAULT 'pending', reward_coin int NOT NULL DEFAULT 0, reward_kp int NOT NULL DEFAULT 0,
      reward_item text, note text, created_at timestamptz NOT NULL DEFAULT now(), resolved_at timestamptz)`)
    await rows(sql`CREATE INDEX IF NOT EXISTS withdraw_shares_site_idx ON withdraw_shares (site_id, status, paid_at DESC)`)
    await rows(sql`CREATE INDEX IF NOT EXISTS withdraw_shares_user_idx ON withdraw_shares (user_id, created_at DESC)`)
    await rows(sql`CREATE TABLE IF NOT EXISTS withdraw_settings (
      id int PRIMARY KEY DEFAULT 1, coin int NOT NULL, kp int NOT NULL, item text NOT NULL DEFAULT '', weekly int NOT NULL)`)
  })().catch((error) => {
    ready = null
    throw error
  })
  return ready
}

const imageUrl = (path: string) => `/api/cekim/${path.slice('cekim/'.length)}`

const map = (r: Record<string, unknown>): WithdrawShare => ({
  id: Number(r.id),
  siteId: String(r.site_id),
  userName: String(r.user_name).split(' ')[0],
  siteUsername: String(r.site_username),
  amount: Number(r.amount),
  paidAt: new Date(String(r.paid_at)).toISOString(),
  image: imageUrl(String(r.image_path)),
  status: String(r.status) as WithdrawStatus,
  rewardCoin: Number(r.reward_coin),
  rewardKp: Number(r.reward_kp),
  rewardItem: r.reward_item ? String(r.reward_item) : null,
  note: r.note ? String(r.note) : null,
  createdAt: new Date(String(r.created_at)).toISOString(),
})

export async function getWithdrawSettings(): Promise<WithdrawSettings> {
  await ensure()
  const [r] = await rows<{ coin: number; kp: number; item: string; weekly: number }>(sql`SELECT coin, kp, item, weekly FROM withdraw_settings WHERE id = 1`)
  return r ? { coin: Number(r.coin), kp: Number(r.kp), item: r.item, weekly: Number(r.weekly) } : DEFAULTS
}

const int = (v: unknown, min: number, max: number) => Math.min(max, Math.max(min, Math.trunc(Number(v) || 0)))

export async function saveWithdrawSettings(input: WithdrawSettings) {
  await ensure()
  const s = { coin: int(input.coin, 0, 100000), kp: int(input.kp, 0, 100000), item: String(input.item ?? '').trim().slice(0, 80), weekly: int(input.weekly, 1, 50) }
  await rows(sql`INSERT INTO withdraw_settings (id, coin, kp, item, weekly) VALUES (1, ${s.coin}, ${s.kp}, ${s.item}, ${s.weekly})
    ON CONFLICT (id) DO UPDATE SET coin = EXCLUDED.coin, kp = EXCLUDED.kp, item = EXCLUDED.item, weekly = EXCLUDED.weekly`)
}

export async function addWithdrawShare(
  user: { id: string; name: string },
  input: { siteId: string; siteUsername: string; amount: number; paidAt: string; imagePath: string },
) {
  await ensure()
  const { activeSiteRecordId } = await import('@/lib/sites')
  const siteId = /^\d+$/.test(input.siteId) ? await activeSiteRecordId(input.siteId) : null
  if (!siteId) throw new Error('Site bulunamadı.')
  const username = input.siteUsername.trim().slice(0, 60)
  if (username.length < 2) throw new Error('Site kullanıcı adını yaz.')
  const amount = Math.round(Number(input.amount) * 100) / 100
  if (!Number.isFinite(amount) || amount <= 0 || amount > 10_000_000) throw new Error('Geçerli bir çekim tutarı gir.')
  const paid = new Date(input.paidAt)
  if (Number.isNaN(paid.getTime())) throw new Error('Çekim tarih ve saatini seç.')
  if (paid.getTime() > Date.now() + 5 * 60_000) throw new Error('Çekim zamanı gelecekte olamaz.')
  if (paid.getTime() < Date.now() - 30 * 86_400_000) throw new Error('Son 30 gün içindeki çekimleri paylaşabilirsin.')
  const { weekly } = await getWithdrawSettings()
  const [{ n }] = await rows<{ n: string }>(sql`SELECT count(*) AS n FROM withdraw_shares
    WHERE user_id = ${user.id} AND status <> 'rejected' AND created_at > now() - interval '7 days'`)
  if (Number(n) >= weekly) throw new Error(`Haftada en fazla ${weekly} çekim paylaşabilirsin.`)
  await rows(sql`INSERT INTO withdraw_shares (site_id, user_id, user_name, site_username, amount, paid_at, image_path)
    VALUES (${siteId}, ${user.id}, ${user.name.slice(0, 40)}, ${username}, ${amount}, ${paid.toISOString()}, ${input.imagePath})`)
  const { notifyApproval } = await import('@/lib/telegram-bots')
  await notifyApproval('complaint', { uye: user.name, detay: `Çekim paylaşımı: ${amount.toLocaleString('tr-TR')} TL` }).catch(() => {})
}

export async function siteWithdrawals(siteId: string, limit = 24) {
  await ensure()
  return (await rows(sql`SELECT * FROM withdraw_shares WHERE site_id = ${siteId} AND status = 'approved' ORDER BY paid_at DESC LIMIT ${limit}`)).map(map)
}

export async function recentWithdrawals(limit = 12) {
  await ensure()
  return (await rows(sql`SELECT * FROM withdraw_shares WHERE status = 'approved' ORDER BY resolved_at DESC NULLS LAST LIMIT ${limit}`)).map(map)
}

export type WithdrawStat = { siteId: string; count: number; total: number }

export async function withdrawStats(): Promise<WithdrawStat[]> {
  await ensure()
  const r = await rows<{ site_id: string; n: string; total: string }>(sql`SELECT site_id, count(*) AS n, coalesce(sum(amount), 0) AS total
    FROM withdraw_shares WHERE status = 'approved' GROUP BY site_id`)
  return r.map((x) => ({ siteId: x.site_id, count: Number(x.n), total: Number(x.total) }))
}

export async function isPublicImage(path: string) {
  await ensure()
  const r = await rows(sql`SELECT 1 FROM withdraw_shares WHERE image_path = ${path} AND status = 'approved' LIMIT 1`)
  return r.length > 0
}

export async function adminWithdrawals() {
  await ensure()
  return (await rows(sql`SELECT * FROM withdraw_shares ORDER BY (status = 'pending') DESC, created_at DESC LIMIT 100`)).map(map)
}

export async function approveWithdrawal(id: number, reward: { coin: number; kp: number; item: string }) {
  await ensure()
  const coin = int(reward.coin, 0, 100000)
  const kp = int(reward.kp, 0, 100000)
  const item = String(reward.item ?? '').trim().slice(0, 80) || null
  const [row] = await rows<{ user_id: string }>(sql`UPDATE withdraw_shares SET status = 'approved', reward_coin = ${coin}, reward_kp = ${kp},
    reward_item = ${item}, resolved_at = now() WHERE id = ${id} AND status = 'pending' RETURNING user_id`)
  if (!row) throw new Error('Kayıt zaten sonuçlanmış.')
  if (coin > 0) await credit(row.user_id, coin)
  if (kp > 0) {
    const { ensureKp } = await import('@/lib/kanka-puan')
    await ensureKp()
    await rows(sql`INSERT INTO kp_events (user_id, source, points, ref, note) VALUES (${row.user_id}, 'cekim', ${kp}, ${String(id)}, 'Çekim paylaşımı')
      ON CONFLICT DO NOTHING`)
  }
  const parts = [coin && `${coin} KC`, kp && `${kp} KP`, item].filter(Boolean)
  return parts.length ? `Onaylandı, ödül: ${parts.join(' + ')}` : 'Onaylandı.'
}

export async function rejectWithdrawal(id: number, note: string) {
  await ensure()
  await rows(sql`UPDATE withdraw_shares SET status = 'rejected', note = ${note.trim().slice(0, 200) || null}, resolved_at = now()
    WHERE id = ${id} AND status = 'pending'`)
}

export async function deleteWithdrawal(id: number) {
  await ensure()
  const [row] = await rows<{ image_path: string }>(sql`DELETE FROM withdraw_shares WHERE id = ${id} RETURNING image_path`)
  if (row) {
    const { del } = await import('@vercel/blob')
    await del(row.image_path).catch(() => {})
  }
}
