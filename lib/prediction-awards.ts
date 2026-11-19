import 'server-only'
import { rows, sql } from '@/lib/db'
import { credit } from '@/lib/member'
import { ensureLeague } from '@/lib/predictions'
import {
  SITE_USERNAME_MAX,
  SITE_USERNAME_MIN,
  prizeText,
  type Award,
  type AwardStatus,
  type PeriodKind,
  type Prize,
} from '@/lib/predictions-shared'

type AwardRow = {
  id: number
  user_id: string
  user_name: string
  source: string
  title: string
  kind: Prize['kind']
  amount: number
  item_ref: string
  item_name: string
  status: AwardStatus
  needs_username: boolean
  site_username: string | null
  note: string | null
  created_at: string
}

const toAward = (r: AwardRow): Award => ({
  id: Number(r.id),
  userId: r.user_id,
  userName: r.user_name,
  source: r.source === 'week' || r.source === 'month' ? r.source : 'match',
  title: r.title,
  prize: { kind: r.kind, amount: Number(r.amount), ref: r.item_ref, name: r.item_name },
  status: r.status,
  siteUsername: r.site_username,
  needsUsername: Boolean(r.needs_username),
  note: r.note,
  createdAt: new Date(r.created_at).toISOString(),
})

async function tell(userId: string, userName: string, title: string, body: string) {
  try {
    const { sendMessage } = await import('@/lib/inbox')
    await sendMessage({ userId, targetLabel: userName, title, body, url: '/tahminler', sentBy: 'Tahmin ligi' })
  } catch (error) {
    console.error('[league] ödül mesajı gönderilemedi', error)
  }
}

/**
 * Hands a prize to a member exactly once per source and reference. Coins and points land on the
 * account at once; a sponsor prize, or a market product that cannot be delivered by the site itself,
 * waits in the panel until the team delivers it.
 */
export async function grantAward(input: {
  userId: string
  userName: string
  source: 'match' | PeriodKind
  ref: string
  place: number | null
  title: string
  prize: Prize
}): Promise<boolean> {
  await ensureLeague()
  const { prize } = input
  let status: AwardStatus = prize.kind === 'kc' || prize.kind === 'kp' ? 'verildi' : 'beklemede'
  let needsUsername = prize.kind === 'cash'
  if (prize.kind === 'market') {
    const item = await rows<{ kind: string; needs_username: boolean }>(sql`SELECT kind, needs_username FROM market_items WHERE id = ${prize.ref}`).catch(() => [])
    needsUsername = item[0]?.kind === 'sponsor' || Boolean(item[0]?.needs_username)
  }
  const inserted = await rows<{ id: number }>(sql`INSERT INTO league_awards (user_id, user_name, source, ref, place, title, kind, amount, item_ref, item_name, status, needs_username, resolved_at)
    VALUES (${input.userId}, ${input.userName.slice(0, 60)}, ${input.source}, ${input.ref}, ${input.place}, ${input.title.slice(0, 200)}, ${prize.kind}, ${prize.amount},
      ${prize.ref}, ${prize.name}, ${status}, ${needsUsername}, ${status === 'verildi' ? new Date().toISOString() : null})
    ON CONFLICT (user_id, source, ref) DO NOTHING RETURNING id`)
  if (!inserted.length) return false

  if (prize.kind === 'kc') {
    await credit(input.userId, prize.amount, input.title)
  } else if (prize.kind === 'kp') {
    const { ensureKp } = await import('@/lib/kanka-puan')
    await ensureKp()
    await rows(sql`INSERT INTO kp_events (user_id, source, points, ref, note)
      VALUES (${input.userId}, 'tahmin-odul', ${prize.amount}, ${`${input.source}:${input.ref}`}, ${input.title.slice(0, 120)}) ON CONFLICT DO NOTHING`)
  } else if (prize.kind === 'market' && !needsUsername) {
    const { deliverInSiteItem } = await import('@/lib/market')
    const delivered = await deliverInSiteItem(input.userId, prize.ref).catch(() => null)
    if (delivered) {
      status = 'verildi'
      await rows(sql`UPDATE league_awards SET status = 'verildi', resolved_at = now(), note = 'Site içi ürün, otomatik teslim edildi.' WHERE id = ${inserted[0].id}`)
    }
  }

  const how =
    status === 'verildi'
      ? 'Hesabına eklendi.'
      : needsUsername
        ? 'Teslim edebilmemiz için Tahminler sayfasındaki "Ödüllerim" bölümüne sitedeki kullanıcı adını yaz.'
        : 'Ekibimiz ödülünü en kısa sürede teslim edecek; durumunu Tahminler sayfasındaki "Ödüllerim" bölümünden izleyebilirsin.'
  await tell(input.userId, input.userName, 'Tahmin ligi ödülün', `${input.title}: ${prizeText(prize)}. ${how}`)
  return true
}

export async function myAwards(userId: string): Promise<Award[]> {
  await ensureLeague()
  const r = await rows<AwardRow>(sql`SELECT * FROM league_awards WHERE user_id = ${userId} ORDER BY (status = 'beklemede') DESC, created_at DESC LIMIT 20`)
  return r.map(toAward)
}

/** The member tells us who they are on the sponsor site, which is what the team needs to deliver the prize. */
export async function claimAward(userId: string, id: number, siteUsername: string) {
  await ensureLeague()
  const name = String(siteUsername ?? '').trim()
  if (name.length < SITE_USERNAME_MIN || name.length > SITE_USERNAME_MAX) {
    throw new Error(`Site kullanıcı adı ${SITE_USERNAME_MIN}-${SITE_USERNAME_MAX} karakter olmalı.`)
  }
  const r = await rows(sql`UPDATE league_awards SET site_username = ${name}
    WHERE id = ${id} AND user_id = ${userId} AND status = 'beklemede' AND needs_username RETURNING id`)
  if (!r.length) throw new Error('Bu ödül için kullanıcı adı artık değiştirilemez.')
}

export async function listAwards(limit = 200): Promise<Award[]> {
  await ensureLeague()
  const r = await rows<AwardRow>(sql`SELECT * FROM league_awards ORDER BY (status = 'beklemede') DESC, created_at DESC LIMIT ${limit}`)
  return r.map(toAward)
}

export async function pendingAwardCount(): Promise<number> {
  await ensureLeague()
  const r = await rows<{ n: string }>(sql`SELECT count(*) AS n FROM league_awards WHERE status = 'beklemede'`)
  return Number(r[0]?.n ?? 0)
}

/** Closes a waiting prize as delivered or cancelled and tells the member which. */
export async function resolveAward(id: number, delivered: boolean, note: string): Promise<Award> {
  await ensureLeague()
  const text = String(note ?? '').trim()
  if (text.length > 300) throw new Error(`Not en fazla 300 karakter olabilir (şu an ${text.length}).`)
  if (!delivered && !text) throw new Error('İptal ederken üyeye gidecek bir sebep yaz.')
  const r = await rows<AwardRow>(sql`UPDATE league_awards SET status = ${delivered ? 'verildi' : 'iptal'}, note = ${text || null}, resolved_at = now()
    WHERE id = ${id} AND status = 'beklemede' RETURNING *`)
  if (!r[0]) throw new Error('Ödül bulunamadı ya da zaten sonuçlandı.')
  const award = toAward(r[0])
  await tell(
    award.userId,
    award.userName,
    delivered ? 'Ödülün teslim edildi' : 'Ödülün iptal edildi',
    `${award.title}: ${prizeText(award.prize)}. ${delivered ? 'Teslim edildi.' : 'İptal edildi.'}${text ? ` Not: ${text}` : ''}`,
  )
  return award
}
