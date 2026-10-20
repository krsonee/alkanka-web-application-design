import 'server-only'
import { rows, sql } from '@/lib/db'
import { credit } from '@/lib/member'
import { ensureCommunity } from '@/lib/community'
import { trDay } from '@/lib/task-period'

export const PROOF_KP = 30
export const HELPFUL_KP = 150
export const HELPFUL_COIN = 250
export const HELPFUL_MIN_VOTES = 3

let ready: Promise<unknown> | null = null
export function ensureTrustExtra() {
  ready ??= (async () => {
    await ensureCommunity()
    await rows(sql`ALTER TABLE site_reviews ADD COLUMN IF NOT EXISTS proof_path text,
      ADD COLUMN IF NOT EXISTS proof_status text NOT NULL DEFAULT 'none'`)
    await rows(sql`CREATE TABLE IF NOT EXISTS review_votes (
      review_id int NOT NULL REFERENCES site_reviews(id) ON DELETE CASCADE, user_id text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (review_id, user_id))`)
    await rows(sql`CREATE TABLE IF NOT EXISTS sponsor_votes (
      month text NOT NULL, user_id text NOT NULL, site_id text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (month, user_id))`)
    await rows(sql`CREATE TABLE IF NOT EXISTS trust_runs (
      kind text NOT NULL, period text NOT NULL, result jsonb, created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (kind, period))`)
  })().catch((error) => {
    ready = null
    throw error
  })
  return ready
}

const DAY = 86400000

/** Monday (TR) of the week containing `date`, as YYYY-MM-DD. */
export function weekKey(date = new Date()) {
  const d = new Date(`${trDay(date)}T00:00:00Z`)
  const dow = (d.getUTCDay() + 6) % 7
  return new Date(d.getTime() - dow * DAY).toISOString().slice(0, 10)
}

export function monthKey(date = new Date()) {
  return trDay(date).slice(0, 7)
}

function prevMonthKey(date = new Date()) {
  const [y, m] = monthKey(date).split('-').map(Number)
  const p = m === 1 ? { y: y - 1, m: 12 } : { y, m: m - 1 }
  return `${p.y}-${String(p.m).padStart(2, '0')}`
}

const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']
export const monthLabel = (key: string) => `${MONTHS[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`

async function claimRun(kind: string, period: string) {
  const r = await rows(sql`INSERT INTO trust_runs (kind, period) VALUES (${kind}, ${period}) ON CONFLICT DO NOTHING RETURNING kind`)
  return r.length > 0
}

async function grantKp(userId: string, source: string, points: number, ref: string, note: string) {
  const { ensureKp } = await import('@/lib/kanka-puan')
  await ensureKp()
  await rows(sql`INSERT INTO kp_events (user_id, source, points, ref, note) VALUES (${userId}, ${source}, ${points}, ${ref}, ${note})
    ON CONFLICT DO NOTHING`)
}

async function inbox(userId: string, title: string, body: string, url = '/guven') {
  const { sendMessage } = await import('@/lib/inbox')
  await sendMessage({ userId, targetLabel: 'Güven merkezi', title, body, url, sentBy: 'Sistem' }).catch(() => {})
}

// --- T2 Kanıtlı yorum ------------------------------------------------------

export type ReviewExtra = { helpful: number; mine: boolean; own: boolean; verified: boolean }

export async function reviewExtras(ids: number[], userId: string | null): Promise<Record<number, ReviewExtra>> {
  await ensureTrustExtra()
  if (!ids.length) return {}
  const r = await rows<{ id: number; proof_status: string; helpful: string; mine: boolean; own: boolean }>(sql`SELECT s.id, s.proof_status,
      s.user_id = ${userId ?? ''} AS own,
      (SELECT count(*) FROM review_votes v WHERE v.review_id = s.id) AS helpful,
      EXISTS (SELECT 1 FROM review_votes v WHERE v.review_id = s.id AND v.user_id = ${userId ?? ''}) AS mine
    FROM site_reviews s WHERE s.id = ANY(${`{${ids.filter((n) => Number.isSafeInteger(n)).join(',')}}`}::int[])`)
  return Object.fromEntries(
    r.map((x) => [Number(x.id), { helpful: Number(x.helpful), mine: Boolean(x.mine), own: Boolean(x.own), verified: x.proof_status === 'verified' }]),
  )
}

/** Links a screenshot to the member's own review of that site. The review goes back to moderation. */
export async function attachReviewProof(userId: string, siteId: string, path: string) {
  await ensureTrustExtra()
  const r = await rows<{ id: number; old: string | null }>(sql`UPDATE site_reviews s SET proof_path = ${path}, proof_status = 'pending'
    FROM (SELECT id, proof_path AS old FROM site_reviews WHERE site_id = ${siteId} AND user_id = ${userId}) o
    WHERE s.id = o.id RETURNING s.id, o.old`)
  if (!r[0]) throw new Error('Önce bu site için yorumunu gönder, sonra kanıt ekle.')
  return { reviewId: Number(r[0].id), previous: r[0].old }
}

export async function proofAccess(path: string): Promise<{ status: string; userId: string } | null> {
  await ensureTrustExtra()
  const [r] = await rows<{ proof_status: string; user_id: string }>(sql`SELECT proof_status, user_id FROM site_reviews WHERE proof_path = ${path}`)
  return r ? { status: r.proof_status, userId: r.user_id } : null
}

export type PendingProof = { reviewId: number; userName: string; siteId: string; rating: number; body: string; proofPath: string }

export async function pendingProofs(): Promise<PendingProof[]> {
  await ensureTrustExtra()
  const r = await rows(sql`SELECT id, user_name, site_id, rating, body, proof_path FROM site_reviews
    WHERE proof_status = 'pending' AND proof_path IS NOT NULL ORDER BY created_at ASC LIMIT 50`)
  return r.map((x) => ({
    reviewId: Number(x.id),
    userName: String(x.user_name),
    siteId: String(x.site_id),
    rating: Number(x.rating),
    body: String(x.body),
    proofPath: String(x.proof_path),
  }))
}

export async function decideProof(reviewId: number, ok: boolean) {
  await ensureTrustExtra()
  const [row] = await rows<{ user_id: string }>(sql`UPDATE site_reviews SET proof_status = ${ok ? 'verified' : 'rejected'},
    status = CASE WHEN ${ok} THEN 'approved' ELSE status END
    WHERE id = ${reviewId} AND proof_status = 'pending' RETURNING user_id`)
  if (!row) throw new Error('Kanıt zaten sonuçlanmış.')
  if (ok) {
    await grantKp(row.user_id, 'kanitli-yorum', PROOF_KP, String(reviewId), 'Kanıtlı yorum')
    await inbox(row.user_id, 'Yorumun doğrulandı', `Yorumuna "Doğrulanmış" rozeti eklendi, ${PROOF_KP} KP hesabında.`)
  } else {
    await inbox(row.user_id, 'Kanıtın onaylanmadı', 'Ekran görüntüsü yorumu doğrulamadı. Yorumun kanıtsız olarak kalmaya devam ediyor.')
  }
}

// --- T5 Faydalı oyu --------------------------------------------------------

export async function toggleHelpful(userId: string, reviewId: number) {
  await ensureTrustExtra()
  const [rev] = await rows<{ user_id: string; status: string }>(sql`SELECT user_id, status FROM site_reviews WHERE id = ${reviewId}`)
  if (!rev || rev.status !== 'approved') throw new Error('Yorum bulunamadı.')
  if (rev.user_id === userId) throw new Error('Kendi yorumuna oy veremezsin.')
  const removed = await rows(sql`DELETE FROM review_votes WHERE review_id = ${reviewId} AND user_id = ${userId} RETURNING review_id`)
  if (!removed.length) await rows(sql`INSERT INTO review_votes (review_id, user_id) VALUES (${reviewId}, ${userId}) ON CONFLICT DO NOTHING`)
  const [{ n }] = await rows<{ n: string }>(sql`SELECT count(*) AS n FROM review_votes WHERE review_id = ${reviewId}`)
  return { voted: !removed.length, count: Number(n) }
}

export type HelpfulLeader = { userId: string; name: string; votes: number }

async function helpfulBoard(from: string, to: string, limit = 5): Promise<HelpfulLeader[]> {
  const r = await rows<{ user_id: string; user_name: string; votes: string }>(sql`SELECT s.user_id, max(s.user_name) AS user_name, count(*) AS votes
    FROM review_votes v JOIN site_reviews s ON s.id = v.review_id
    WHERE v.created_at >= ${from}::date AND v.created_at < ${to}::date AND s.status = 'approved'
    GROUP BY s.user_id ORDER BY votes DESC, min(v.created_at) ASC LIMIT ${limit}`)
  return r.map((x) => ({ userId: x.user_id, name: String(x.user_name).split(' ')[0], votes: Number(x.votes) }))
}

export async function helpfulThisWeek() {
  await ensureTrustExtra()
  const from = weekKey()
  const to = new Date(new Date(`${from}T00:00:00Z`).getTime() + 7 * DAY).toISOString().slice(0, 10)
  return helpfulBoard(from, to)
}

async function payHelpfulWeek() {
  const thisWeek = weekKey()
  const from = new Date(new Date(`${thisWeek}T00:00:00Z`).getTime() - 7 * DAY).toISOString().slice(0, 10)
  if (!(await claimRun('faydali', from))) return null
  const [top] = await helpfulBoard(from, thisWeek, 1)
  if (!top || top.votes < HELPFUL_MIN_VOTES) return null
  await grantKp(top.userId, 'faydali', HELPFUL_KP, from, 'Haftanın en faydalı yorumu')
  await credit(top.userId, HELPFUL_COIN)
  await rows(sql`UPDATE trust_runs SET result = ${JSON.stringify(top)}::jsonb WHERE kind = 'faydali' AND period = ${from}`)
  await inbox(top.userId, 'Haftanın en faydalı yorumcusu sensin', `Yorumların ${top.votes} "faydalı" oyu aldı. ${HELPFUL_KP} KP + ${HELPFUL_COIN} KC hesabında.`)
  return top
}

// --- T4 Şikâyet takip sayacı -----------------------------------------------

export type ComplaintTracker = {
  open: number
  forwarded: number
  resolved: number
  avgDays: number | null
  recentResolved: { id: number; siteId: string; title: string; userName: string; days: number; updatedAt: string }[]
}

export async function complaintTracker(): Promise<ComplaintTracker> {
  await ensureCommunity()
  const [t] = await rows<Record<string, string | null>>(sql`SELECT
      count(*) FILTER (WHERE status = 'open') AS open,
      count(*) FILTER (WHERE status = 'forwarded') AS forwarded,
      count(*) FILTER (WHERE status = 'resolved') AS resolved,
      avg(extract(epoch FROM updated_at - created_at) / 86400) FILTER (WHERE status = 'resolved') AS avg_days
    FROM complaints`)
  const recent = await rows(sql`SELECT id, site_id, title, user_name, created_at, updated_at FROM complaints
    WHERE status = 'resolved' ORDER BY updated_at DESC LIMIT 6`)
  return {
    open: Number(t?.open ?? 0),
    forwarded: Number(t?.forwarded ?? 0),
    resolved: Number(t?.resolved ?? 0),
    avgDays: t?.avg_days == null ? null : Math.round(Number(t.avg_days) * 10) / 10,
    recentResolved: recent.map((r) => ({
      id: Number(r.id),
      siteId: String(r.site_id),
      title: String(r.title),
      userName: String(r.user_name).split(' ')[0],
      days: Math.max(0, Math.round((new Date(String(r.updated_at)).getTime() - new Date(String(r.created_at)).getTime()) / DAY)),
      updatedAt: new Date(String(r.updated_at)).toISOString(),
    })),
  }
}

// --- T6 Ayın güvenilir sponsoru --------------------------------------------

export type SponsorVoteRow = { siteId: string; votes: number }

export async function sponsorVoteBoard(month = monthKey()): Promise<SponsorVoteRow[]> {
  await ensureTrustExtra()
  const r = await rows<{ site_id: string; n: string }>(sql`SELECT site_id, count(*) AS n FROM sponsor_votes WHERE month = ${month}
    GROUP BY site_id ORDER BY n DESC, min(created_at) ASC`)
  return r.map((x) => ({ siteId: x.site_id, votes: Number(x.n) }))
}

export async function mySponsorVote(userId: string, month = monthKey()) {
  await ensureTrustExtra()
  const [r] = await rows<{ site_id: string }>(sql`SELECT site_id FROM sponsor_votes WHERE month = ${month} AND user_id = ${userId}`)
  return r?.site_id ?? null
}

export async function castSponsorVote(userId: string, siteId: string) {
  await ensureTrustExtra()
  const { activeSiteRecordId } = await import('@/lib/sites')
  const recordId = await activeSiteRecordId(siteId)
  if (!recordId) throw new Error('Site bulunamadı.')
  const [{ age }] = await rows<{ age: boolean }>(sql`SELECT EXISTS (SELECT 1 FROM public."user" WHERE id = ${userId}
    AND "createdAt" < now() - interval '3 days') AS age`)
  if (!age) throw new Error('Oy vermek için hesabının en az 3 günlük olması gerekiyor.')
  await rows(sql`INSERT INTO sponsor_votes (month, user_id, site_id) VALUES (${monthKey()}, ${userId}, ${recordId})
    ON CONFLICT (month, user_id) DO UPDATE SET site_id = EXCLUDED.site_id, created_at = now()`)
}

export type SponsorOfMonth = { month: string; siteId: string; name: string; votes: number }

export async function lastSponsorOfMonth(): Promise<SponsorOfMonth | null> {
  await ensureTrustExtra()
  const [r] = await rows<{ period: string; result: SponsorOfMonth | null }>(sql`SELECT period, result FROM trust_runs
    WHERE kind = 'ayin-sponsoru' AND result IS NOT NULL ORDER BY period DESC LIMIT 1`)
  return r?.result ?? null
}

async function siteNames(): Promise<Record<string, string>> {
  const { listSites } = await import('@/lib/sites')
  return Object.fromEntries((await listSites()).map((s) => [String(s.id), s.name]))
}

async function settleSponsorMonth() {
  const month = prevMonthKey()
  if (!(await claimRun('ayin-sponsoru', month))) return null
  const [top] = await sponsorVoteBoard(month)
  if (!top) return null
  const names = await siteNames()
  const result: SponsorOfMonth = { month, siteId: top.siteId, name: names[top.siteId] ?? 'Sponsor', votes: top.votes }
  await rows(sql`UPDATE trust_runs SET result = ${JSON.stringify(result)}::jsonb WHERE kind = 'ayin-sponsoru' AND period = ${month}`)
  const { broadcastPodium } = await import('@/lib/telegram-bots')
  await broadcastPodium((origin) =>
    [
      `${monthLabel(month)} · Ayın Güvenilir Sponsoru`,
      '',
      `${result.name} · ${result.votes} üye oyu`,
      '',
      'Oyunu veren tüm kankalara teşekkürler. Yeni ayın oylaması başladı.',
      `${origin}/guven#ayin-sponsoru`,
    ].join('\n'),
  ).catch(() => 0)
  return result
}

// --- T1 Haftalık sponsor karnesi -------------------------------------------

export type KarneRow = { siteId: string; name: string; rating: number | null; reviews: number; resolved: number; complaints: number; withdrawals: number }

export async function weeklyKarne(): Promise<KarneRow[]> {
  await ensureCommunity()
  const names = await siteNames()
  const rv = await rows<{ site_id: string; avg: string; n: string }>(sql`SELECT site_id, avg(rating) AS avg, count(*) AS n FROM site_reviews
    WHERE status = 'approved' AND created_at > now() - interval '7 days' GROUP BY site_id`)
  const cp = await rows<{ site_id: string; n: string; ok: string }>(sql`SELECT site_id, count(*) AS n, count(*) FILTER (WHERE status = 'resolved') AS ok
    FROM complaints WHERE status <> 'rejected' AND updated_at > now() - interval '7 days' GROUP BY site_id`)
  const wd = await rows<{ site_id: string; n: string }>(sql`SELECT site_id, count(*) AS n FROM withdraw_shares
    WHERE status = 'approved' AND resolved_at > now() - interval '7 days' GROUP BY site_id`).catch(() => [])
  const ids = new Set([...rv, ...cp, ...wd].map((x) => x.site_id))
  return [...ids]
    .filter((id) => names[id])
    .map((id) => {
      const r = rv.find((x) => x.site_id === id)
      const c = cp.find((x) => x.site_id === id)
      return {
        siteId: id,
        name: names[id],
        rating: r ? Math.round(Number(r.avg) * 10) / 10 : null,
        reviews: Number(r?.n ?? 0),
        complaints: Number(c?.n ?? 0),
        resolved: Number(c?.ok ?? 0),
        withdrawals: Number(wd.find((x) => x.site_id === id)?.n ?? 0),
      }
    })
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || b.withdrawals - a.withdrawals)
}

export function karneText(list: KarneRow[], origin: string, helpful?: HelpfulLeader | null) {
  return [
    'Haftalık Sponsor Karnesi',
    '',
    ...list.slice(0, 10).map((k, i) => {
      const parts = [k.rating === null ? 'puan yok' : `${k.rating.toFixed(1)}/5 (${k.reviews} yorum)`]
      if (k.withdrawals) parts.push(`${k.withdrawals} onaylı çekim`)
      if (k.complaints) parts.push(`${k.resolved}/${k.complaints} şikâyet çözüldü`)
      return `${i + 1}. ${k.name} · ${parts.join(' · ')}`
    }),
    ...(helpful ? ['', `Haftanın en faydalı yorumcusu: ${helpful.name} (${helpful.votes} oy)`] : []),
    '',
    'Sen de karneye katıl: yorum yaz, çekimini paylaş, KP kazan.',
    `${origin}/guven`,
  ].join('\n')
}

async function postWeeklyKarne(helpful: HelpfulLeader | null) {
  if (!(await claimRun('karne', weekKey()))) return 0
  const list = await weeklyKarne()
  if (!list.length) return 0
  const { broadcastPodium } = await import('@/lib/telegram-bots')
  return broadcastPodium((origin) => karneText(list, origin, helpful)).catch(() => 0)
}

/** Daily cron entry. Weekly jobs run on the first call of each week, monthly ones on the first call of each month. */
export async function runTrustCron() {
  await ensureTrustExtra()
  const helpful = await payHelpfulWeek()
  const karne = await postWeeklyKarne(helpful)
  const sponsor = await settleSponsorMonth()
  return { helpful: helpful?.name ?? null, karnePosted: karne, sponsorOfMonth: sponsor?.name ?? null }
}
