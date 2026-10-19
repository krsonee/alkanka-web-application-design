import 'server-only'
import { createHash } from 'node:crypto'
import { rows, sql } from '@/lib/db'
import { credit } from '@/lib/member'

export type WithdrawStatus = 'pending' | 'approved' | 'rejected' | 'fake'

export type WithdrawShare = {
  id: number
  siteId: string
  siteName: string
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

export type AdminWithdrawShare = WithdrawShare & { userId: string; fullUsername: string; imageHash: string }

export type WithdrawReward = { coin: number; kp: number; item: string }

export type WithdrawSettings = WithdrawReward & {
  weekly: number
  minAmount: number
  maxAgeDays: number
  minAccountDays: number
  tgEnabled: boolean
  tgShowAmount: boolean
}

export type SiteReward = WithdrawReward & { siteId: string }

export const WITHDRAW_DEFAULTS: WithdrawSettings = {
  coin: 25,
  kp: 50,
  item: '',
  weekly: 3,
  minAmount: 100,
  maxAgeDays: 7,
  minAccountDays: 3,
  tgEnabled: true,
  tgShowAmount: true,
}

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024
export const IMAGE_TYPES: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }

const REJECT_LIMIT = 3
const REJECT_WINDOW_DAYS = 30
const REJECT_BLOCK_DAYS = 14

let ready: Promise<unknown> | null = null
function ensure() {
  ready ??= (async () => {
    await rows(sql`CREATE TABLE IF NOT EXISTS withdraw_shares (
      id serial PRIMARY KEY, site_id text NOT NULL, user_id text NOT NULL, user_name text NOT NULL,
      site_username text NOT NULL, amount numeric(12,2) NOT NULL, paid_at timestamptz NOT NULL, image_path text NOT NULL,
      status text NOT NULL DEFAULT 'pending', reward_coin int NOT NULL DEFAULT 0, reward_kp int NOT NULL DEFAULT 0,
      reward_item text, note text, created_at timestamptz NOT NULL DEFAULT now(), resolved_at timestamptz)`)
    await rows(sql`ALTER TABLE withdraw_shares ADD COLUMN IF NOT EXISTS site_name text NOT NULL DEFAULT ''`)
    await rows(sql`ALTER TABLE withdraw_shares ADD COLUMN IF NOT EXISTS image_hash text NOT NULL DEFAULT ''`)
    await rows(sql`CREATE INDEX IF NOT EXISTS withdraw_shares_site_idx ON withdraw_shares (site_id, status, paid_at DESC)`)
    await rows(sql`CREATE INDEX IF NOT EXISTS withdraw_shares_user_idx ON withdraw_shares (user_id, created_at DESC)`)
    await rows(sql`CREATE INDEX IF NOT EXISTS withdraw_shares_hash_idx ON withdraw_shares (image_hash)`)
    await rows(sql`CREATE TABLE IF NOT EXISTS withdraw_config (id int PRIMARY KEY DEFAULT 1, value jsonb NOT NULL)`)
    await rows(sql`CREATE TABLE IF NOT EXISTS withdraw_rewards (
      site_id text PRIMARY KEY, coin int NOT NULL DEFAULT 0, kp int NOT NULL DEFAULT 0, item text NOT NULL DEFAULT '')`)
    await rows(sql`CREATE TABLE IF NOT EXISTS withdraw_blocks (
      user_id text PRIMARY KEY, until timestamptz, reason text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now())`)
  })().catch((error) => {
    ready = null
    throw error
  })
  return ready
}

/** "krsone2" -> "kr***e2". The full name stays panel-only so members are not targeted. */
export function maskUsername(name: string) {
  const s = name.trim()
  if (s.length <= 3) return `${s.slice(0, 1)}***`
  if (s.length <= 5) return `${s.slice(0, 2)}***`
  return `${s.slice(0, 2)}***${s.slice(-2)}`
}

const imageUrl = (path: string) => `/api/cekim/${path.slice('cekim/'.length)}`

function mapPublic(r: Record<string, unknown>): WithdrawShare {
  return {
    id: Number(r.id),
    siteId: String(r.site_id),
    siteName: String(r.site_name || ''),
    userName: String(r.user_name).split(' ')[0],
    siteUsername: maskUsername(String(r.site_username)),
    amount: Number(r.amount),
    paidAt: new Date(String(r.paid_at)).toISOString(),
    image: imageUrl(String(r.image_path)),
    status: String(r.status) as WithdrawStatus,
    rewardCoin: Number(r.reward_coin),
    rewardKp: Number(r.reward_kp),
    rewardItem: r.reward_item ? String(r.reward_item) : null,
    note: r.note ? String(r.note) : null,
    createdAt: new Date(String(r.created_at)).toISOString(),
  }
}

function mapAdmin(r: Record<string, unknown>): AdminWithdrawShare {
  return { ...mapPublic(r), userId: String(r.user_id), fullUsername: String(r.site_username), imageHash: String(r.image_hash) }
}

const int = (v: unknown, min: number, max: number) => Math.min(max, Math.max(min, Math.trunc(Number(v) || 0)))

function cleanSettings(input: Partial<WithdrawSettings> | null | undefined): WithdrawSettings {
  const d = WITHDRAW_DEFAULTS
  const v = input ?? {}
  return {
    coin: int(v.coin ?? d.coin, 0, 100000),
    kp: int(v.kp ?? d.kp, 0, 100000),
    item: String(v.item ?? d.item).trim().slice(0, 80),
    weekly: int(v.weekly ?? d.weekly, 1, 50),
    minAmount: int(v.minAmount ?? d.minAmount, 0, 1_000_000),
    maxAgeDays: int(v.maxAgeDays ?? d.maxAgeDays, 1, 30),
    minAccountDays: int(v.minAccountDays ?? d.minAccountDays, 0, 90),
    tgEnabled: v.tgEnabled ?? d.tgEnabled,
    tgShowAmount: v.tgShowAmount ?? d.tgShowAmount,
  }
}

export async function getWithdrawSettings(): Promise<WithdrawSettings> {
  await ensure()
  const [r] = await rows<{ value: Partial<WithdrawSettings> }>(sql`SELECT value FROM withdraw_config WHERE id = 1`)
  return cleanSettings(r?.value)
}

export async function saveWithdrawSettings(input: Partial<WithdrawSettings>) {
  await ensure()
  const s = cleanSettings(input)
  await rows(sql`INSERT INTO withdraw_config (id, value) VALUES (1, ${JSON.stringify(s)}::jsonb)
    ON CONFLICT (id) DO UPDATE SET value = EXCLUDED.value`)
}

export async function listSiteRewards(): Promise<SiteReward[]> {
  await ensure()
  const r = await rows<{ site_id: string; coin: number; kp: number; item: string }>(sql`SELECT * FROM withdraw_rewards`)
  return r.map((x) => ({ siteId: x.site_id, coin: Number(x.coin), kp: Number(x.kp), item: x.item }))
}

export async function saveSiteReward(siteId: string, reward: WithdrawReward | null) {
  await ensure()
  if (!/^\d+$/.test(siteId)) throw new Error('Geçersiz site.')
  if (!reward) {
    await rows(sql`DELETE FROM withdraw_rewards WHERE site_id = ${siteId}`)
    return
  }
  const coin = int(reward.coin, 0, 100000)
  const kp = int(reward.kp, 0, 100000)
  const item = String(reward.item ?? '').trim().slice(0, 80)
  await rows(sql`INSERT INTO withdraw_rewards (site_id, coin, kp, item) VALUES (${siteId}, ${coin}, ${kp}, ${item})
    ON CONFLICT (site_id) DO UPDATE SET coin = EXCLUDED.coin, kp = EXCLUDED.kp, item = EXCLUDED.item`)
}

/** Site-specific reward when the panel set one, otherwise the global default. */
export async function rewardFor(siteId: string): Promise<WithdrawReward> {
  await ensure()
  const [r] = await rows<{ coin: number; kp: number; item: string }>(sql`SELECT coin, kp, item FROM withdraw_rewards WHERE site_id = ${siteId}`)
  if (r) return { coin: Number(r.coin), kp: Number(r.kp), item: r.item }
  const s = await getWithdrawSettings()
  return { coin: s.coin, kp: s.kp, item: s.item }
}

export type ShareInput = { siteId: string; siteUsername: string; amount: number; paidAt: string; consent: boolean }
export type CheckedShare = { siteId: string; siteName: string; username: string; amount: number; paidAt: Date }

/** Every abuse rule runs before the image is stored, so rejected requests leave nothing behind. */
export async function checkWithdrawShare(user: { id: string }, input: ShareInput, image: { bytes: ArrayBuffer; type: string; size: number }) {
  await ensure()
  const s = await getWithdrawSettings()

  if (!input.consent) throw new Error('Görüntüdeki IBAN, ad soyad gibi kişisel bilgileri kapattığını onayla.')
  if (!IMAGE_TYPES[image.type]) throw new Error('Sadece JPG, PNG veya WEBP yükleyebilirsin.')
  if (image.size > MAX_IMAGE_BYTES) throw new Error('Görüntü en fazla 5 MB olabilir.')
  if (image.size < 10 * 1024) throw new Error('Görüntü çok küçük, çekim sayfasının net ekran görüntüsünü yükle.')

  const [block] = await rows<{ until: string | null; reason: string }>(sql`SELECT until, reason FROM withdraw_blocks
    WHERE user_id = ${user.id} AND (until IS NULL OR until > now())`)
  if (block) {
    throw new Error(block.until
      ? `Çok sayıda reddedilen paylaşım nedeniyle ${new Date(block.until).toLocaleDateString('tr-TR')} tarihine kadar paylaşım yapamazsın.`
      : 'Hesabın çekim paylaşımından kalıcı olarak engellendi.')
  }

  const [account] = await rows<{ created: string; verified: boolean }>(sql`SELECT "createdAt" AS created, "emailVerified" AS verified
    FROM public."user" WHERE id = ${user.id}`)
  if (!account) throw new Error('Hesap bulunamadı.')
  const ageDays = (Date.now() - new Date(account.created).getTime()) / 86_400_000
  if (ageDays < s.minAccountDays) throw new Error(`Çekim paylaşmak için üyeliğin en az ${s.minAccountDays} günlük olmalı.`)
  const { mailEnabled } = await import('@/lib/mail')
  if (mailEnabled && !account.verified) throw new Error('Önce e-posta adresini doğrulamalısın.')

  const { activeSiteRecordId, siteNameLookup } = await import('@/lib/sites')
  const siteId = /^\d+$/.test(input.siteId) ? await activeSiteRecordId(input.siteId) : null
  if (!siteId) throw new Error('Site bulunamadı.')
  const siteName = (await siteNameLookup())(siteId)

  const username = input.siteUsername.trim().replace(/\s+/g, '').slice(0, 40)
  if (username.length < 3) throw new Error('Sitedeki kullanıcı adını yaz.')
  const amount = Math.round(Number(input.amount) * 100) / 100
  if (!Number.isFinite(amount) || amount <= 0 || amount > 10_000_000) throw new Error('Geçerli bir çekim tutarı gir.')
  if (amount < s.minAmount) throw new Error(`En az ${s.minAmount.toLocaleString('tr-TR')} TL'lik çekimler paylaşılabilir.`)

  const paidAt = new Date(input.paidAt)
  if (Number.isNaN(paidAt.getTime())) throw new Error('Çekim tarih ve saatini seç.')
  if (paidAt.getTime() > Date.now() + 5 * 60_000) throw new Error('Çekim zamanı gelecekte olamaz.')
  if (paidAt.getTime() < Date.now() - s.maxAgeDays * 86_400_000) throw new Error(`Sadece son ${s.maxAgeDays} günde yapılan çekimleri paylaşabilirsin.`)

  const [pending] = await rows(sql`SELECT 1 FROM withdraw_shares WHERE user_id = ${user.id} AND status = 'pending' LIMIT 1`)
  if (pending) throw new Error('Onay bekleyen bir paylaşımın var. Sonuçlanınca yenisini gönderebilirsin.')

  const [{ n }] = await rows<{ n: string }>(sql`SELECT count(*) AS n FROM withdraw_shares
    WHERE user_id = ${user.id} AND status = 'approved' AND created_at > now() - interval '7 days'`)
  if (Number(n) >= s.weekly) throw new Error(`Haftada en fazla ${s.weekly} onaylı paylaşım yapabilirsin.`)

  const [owner] = await rows<{ user_id: string }>(sql`SELECT user_id FROM withdraw_shares
    WHERE site_id = ${siteId} AND lower(site_username) = lower(${username}) AND status IN ('pending', 'approved') AND user_id <> ${user.id} LIMIT 1`)
  if (owner) throw new Error('Bu site kullanıcı adı başka bir üyeye kayıtlı.')

  const hash = createHash('sha256').update(Buffer.from(image.bytes)).digest('hex')
  const [dupImage] = await rows(sql`SELECT 1 FROM withdraw_shares WHERE image_hash = ${hash} LIMIT 1`)
  if (dupImage) throw new Error('Bu ekran görüntüsü daha önce yüklenmiş.')

  const [dupPayout] = await rows(sql`SELECT 1 FROM withdraw_shares
    WHERE site_id = ${siteId} AND amount = ${amount} AND status IN ('pending', 'approved')
      AND abs(extract(epoch FROM paid_at - ${paidAt.toISOString()}::timestamptz)) < 600 LIMIT 1`)
  if (dupPayout) throw new Error('Bu çekim zaten paylaşılmış.')

  return { checked: { siteId, siteName, username, amount, paidAt } satisfies CheckedShare, hash }
}

export async function insertWithdrawShare(user: { id: string; name: string }, c: CheckedShare, imagePath: string, hash: string) {
  await ensure()
  await rows(sql`INSERT INTO withdraw_shares (site_id, site_name, user_id, user_name, site_username, amount, paid_at, image_path, image_hash)
    VALUES (${c.siteId}, ${c.siteName}, ${user.id}, ${user.name.slice(0, 40)}, ${c.username}, ${c.amount}, ${c.paidAt.toISOString()}, ${imagePath}, ${hash})`)
  const { notifyApproval } = await import('@/lib/telegram-bots')
  await notifyApproval('complaint', {
    uye: user.name,
    detay: `Çekim paylaşımı onay bekliyor: ${c.siteName}, ${c.amount.toLocaleString('tr-TR')} TL`,
  }).catch(() => {})
}

export async function siteWithdrawals(siteId: string, limit = 12) {
  await ensure()
  return (await rows(sql`SELECT * FROM withdraw_shares WHERE site_id = ${siteId} AND status = 'approved' ORDER BY paid_at DESC LIMIT ${limit}`)).map(mapPublic)
}

export async function recentWithdrawals(limit = 12) {
  await ensure()
  return (await rows(sql`SELECT * FROM withdraw_shares WHERE status = 'approved' ORDER BY resolved_at DESC NULLS LAST LIMIT ${limit}`)).map(mapPublic)
}

export type WithdrawStat = { siteId: string; count: number; total: number; last: string | null }

export async function withdrawStats(): Promise<WithdrawStat[]> {
  await ensure()
  const r = await rows<{ site_id: string; n: string; total: string; last: string | null }>(sql`SELECT site_id, count(*) AS n,
    coalesce(sum(amount), 0) AS total, max(paid_at) AS last FROM withdraw_shares WHERE status = 'approved' GROUP BY site_id`)
  return r.map((x) => ({ siteId: x.site_id, count: Number(x.n), total: Number(x.total), last: x.last ? new Date(x.last).toISOString() : null }))
}

export async function myWithdrawals(userId: string, limit = 5) {
  await ensure()
  return (await rows(sql`SELECT * FROM withdraw_shares WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT ${limit}`)).map(mapPublic)
}

export async function imageStatus(path: string): Promise<WithdrawStatus | null> {
  await ensure()
  const [r] = await rows<{ status: WithdrawStatus }>(sql`SELECT status FROM withdraw_shares WHERE image_path = ${path} LIMIT 1`)
  return r?.status ?? null
}

export async function imageOwner(path: string): Promise<string | null> {
  await ensure()
  const [r] = await rows<{ user_id: string }>(sql`SELECT user_id FROM withdraw_shares WHERE image_path = ${path} LIMIT 1`)
  return r?.user_id ?? null
}

export async function adminWithdrawals() {
  await ensure()
  return (await rows(sql`SELECT * FROM withdraw_shares ORDER BY (status = 'pending') DESC, created_at DESC LIMIT 150`)).map(mapAdmin)
}

/** Ticker rows for the last 48 hours of approved payouts. */
export async function withdrawFeed(limit = 15) {
  await ensure()
  return (await rows(sql`SELECT * FROM withdraw_shares WHERE status = 'approved' AND resolved_at > now() - interval '48 hours'
    ORDER BY resolved_at DESC LIMIT ${limit}`)).map((r) => ({ ...mapPublic(r), resolvedAt: new Date(String(r.resolved_at)).toISOString() }))
}

async function message(userId: string, title: string, body: string) {
  const { sendMessage } = await import('@/lib/inbox')
  await sendMessage({ userId, targetLabel: 'Çekim paylaşımı', title, body, url: '/guven', sentBy: 'Sistem' }).catch(() => {})
}

export async function approveWithdrawal(id: number, reward: WithdrawReward) {
  await ensure()
  const coin = int(reward.coin, 0, 100000)
  const kp = int(reward.kp, 0, 100000)
  const item = String(reward.item ?? '').trim().slice(0, 80) || null
  const [row] = await rows<Record<string, unknown>>(sql`UPDATE withdraw_shares SET status = 'approved', reward_coin = ${coin}, reward_kp = ${kp},
    reward_item = ${item}, resolved_at = now() WHERE id = ${id} AND status = 'pending' RETURNING *`)
  if (!row) throw new Error('Kayıt zaten sonuçlanmış.')
  const userId = String(row.user_id)
  if (coin > 0) await credit(userId, coin)
  if (kp > 0) {
    const { ensureKp } = await import('@/lib/kanka-puan')
    await ensureKp()
    await rows(sql`INSERT INTO kp_events (user_id, source, points, ref, note) VALUES (${userId}, 'cekim', ${kp}, ${String(id)}, 'Çekim paylaşımı')
      ON CONFLICT DO NOTHING`)
  }
  const parts = [coin && `${coin} KC`, kp && `${kp} KP`, item].filter(Boolean)
  const prize = parts.length ? parts.join(' + ') : ''
  await message(userId, 'Çekim paylaşımın onaylandı', prize ? `Ödülün hesabına eklendi: ${prize}.` : 'Paylaşımın Güven merkezinde yayında.')

  const { after } = await import('next/server')
  const share = mapAdmin(row)
  const path = String(row.image_path)
  after(() => postToTelegram(share, path).catch((error) => console.error('[cekim] telegram', error)))

  return prize ? `Onaylandı, ödül: ${prize}` : 'Onaylandı.'
}

export async function rejectWithdrawal(id: number, note: string) {
  await ensure()
  const reason = note.trim().slice(0, 200) || 'Kurallara uygun değil.'
  const [row] = await rows<{ user_id: string }>(sql`UPDATE withdraw_shares SET status = 'rejected', note = ${reason}, resolved_at = now()
    WHERE id = ${id} AND status = 'pending' RETURNING user_id`)
  if (!row) throw new Error('Kayıt zaten sonuçlanmış.')
  await message(row.user_id, 'Çekim paylaşımın reddedildi', `Sebep: ${reason}`)
  const [{ n }] = await rows<{ n: string }>(sql`SELECT count(*) AS n FROM withdraw_shares WHERE user_id = ${row.user_id}
    AND status IN ('rejected', 'fake') AND resolved_at > now() - make_interval(days => ${REJECT_WINDOW_DAYS})`)
  if (Number(n) >= REJECT_LIMIT) {
    await rows(sql`INSERT INTO withdraw_blocks (user_id, until, reason)
      VALUES (${row.user_id}, now() + make_interval(days => ${REJECT_BLOCK_DAYS}), 'Çok sayıda ret')
      ON CONFLICT (user_id) DO UPDATE SET until = CASE WHEN withdraw_blocks.until IS NULL THEN NULL ELSE EXCLUDED.until END, reason = EXCLUDED.reason`)
    return `Reddedildi. Üye ${REJECT_WINDOW_DAYS} günde ${REJECT_LIMIT} ret aldığı için ${REJECT_BLOCK_DAYS} gün engellendi.`
  }
  return 'Reddedildi.'
}

/** Marks a share as fake: takes back any reward, hides it and permanently blocks the member from sharing. */
export async function markWithdrawalFake(id: number) {
  await ensure()
  const [row] = await rows<{ user_id: string; reward_coin: number; status: string }>(sql`SELECT user_id, reward_coin, status FROM withdraw_shares WHERE id = ${id}`)
  if (!row) throw new Error('Kayıt bulunamadı.')
  if (row.status === 'fake') throw new Error('Zaten sahte olarak işaretli.')
  if (row.status === 'approved') {
    const coin = Number(row.reward_coin)
    if (coin > 0) await rows(sql`UPDATE wallets SET balance = greatest(0, balance - ${coin}), updated_at = now() WHERE user_id = ${row.user_id}`)
    await rows(sql`DELETE FROM kp_events WHERE user_id = ${row.user_id} AND source = 'cekim' AND ref = ${String(id)}`).catch(() => {})
  }
  await rows(sql`UPDATE withdraw_shares SET status = 'fake', note = 'Sahte paylaşım', resolved_at = now() WHERE id = ${id}`)
  await rows(sql`INSERT INTO withdraw_blocks (user_id, until, reason) VALUES (${row.user_id}, NULL, 'Sahte paylaşım')
    ON CONFLICT (user_id) DO UPDATE SET until = NULL, reason = EXCLUDED.reason`)
  await message(row.user_id, 'Çekim paylaşımın sahte olarak işaretlendi', 'Verilen ödül geri alındı ve çekim paylaşımı hesabın için kapatıldı.')
  return 'Sahte olarak işaretlendi, ödül geri alındı, üye kalıcı engellendi.'
}

export async function unblockWithdrawUser(userId: string) {
  await ensure()
  await rows(sql`DELETE FROM withdraw_blocks WHERE user_id = ${userId}`)
}

export async function listWithdrawBlocks() {
  await ensure()
  const r = await rows<{ user_id: string; until: string | null; reason: string; name: string | null }>(sql`SELECT b.user_id, b.until, b.reason, u.name
    FROM withdraw_blocks b LEFT JOIN public."user" u ON u.id = b.user_id WHERE b.until IS NULL OR b.until > now() ORDER BY b.created_at DESC`)
  return r.map((x) => ({ userId: x.user_id, name: x.name ?? 'Üye', until: x.until ? new Date(x.until).toISOString() : null, reason: x.reason }))
}

export async function deleteWithdrawal(id: number) {
  await ensure()
  const [row] = await rows<{ image_path: string }>(sql`DELETE FROM withdraw_shares WHERE id = ${id} RETURNING image_path`)
  if (row) {
    const { del } = await import('@vercel/blob')
    await del(row.image_path).catch(() => {})
  }
}

const fmtTime = (iso: string) => new Date(iso).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })

/** Posts the approved payout with its screenshot to the site's Telegram group. Never throws into the approval. */
async function postToTelegram(share: WithdrawShare, imagePath: string) {
  const s = await getWithdrawSettings()
  if (!s.tgEnabled) return
  const { getChatConfig } = await import('@/lib/telegram-chat')
  const chat = await getChatConfig()
  if (!chat) return
  const { botToken } = await import('@/lib/telegram-mirror')
  const { getBotSuite } = await import('@/lib/telegram-bots')
  const [token, suite] = await Promise.all([botToken(chat.botId), getBotSuite()])
  const origin = suite.siteOrigin || 'https://alkanka.com'
  const lines = [
    'ONAYLI ÇEKİM',
    '',
    `Site: ${share.siteName}`,
    `Üye: ${share.siteUsername}`,
    s.tgShowAmount ? `Tutar: ${share.amount.toLocaleString('tr-TR')} TL` : null,
    `Saat: ${fmtTime(share.paidAt)}`,
    '',
    `Sen de çekimini paylaş, ödülü kap: ${origin}/guven`,
  ].filter((l) => l !== null)
  const caption = lines.join('\n')

  const { get } = await import('@vercel/blob')
  const file = await get(imagePath, { access: 'private' })
  const form = new FormData()
  form.set('chat_id', chat.chatId)
  form.set('caption', caption)
  if (file?.stream) {
    const bytes = await new Response(file.stream).arrayBuffer()
    form.set('photo', new Blob([bytes], { type: file.blob.contentType || 'image/jpeg' }), 'cekim.jpg')
    const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, { method: 'POST', body: form, signal: AbortSignal.timeout(20_000) })
    if (res.ok) return
    console.error('[cekim] sendPhoto failed', res.status, await res.text().catch(() => ''))
  }
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chat.chatId, text: caption, link_preview_options: { is_disabled: true } }),
    signal: AbortSignal.timeout(15_000),
  })
}
