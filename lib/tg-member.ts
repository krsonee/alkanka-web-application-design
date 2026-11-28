import 'server-only'
import { rows, sql } from '@/lib/db'
import { LOG_COLUMNS, ensureHubTables, getHub, mapLogRow, trustOf } from '@/lib/tg-hub'
import type { MemberCard } from '@/lib/tg-hub-shared'

const iso = (v: unknown) => new Date(String(v)).toISOString()

/** "Ali Veli (@ali)" or "Ali Veli (123)" as the guard writes it in the log. */
function splitWho(who: string) {
  const m = /^(.*) \((@?[^()]+)\)$/.exec(who.trim())
  if (!m) return { name: who.trim(), username: null }
  return { name: m[1].trim(), username: m[2].startsWith('@') ? m[2].slice(1) : null }
}

/**
 * Everything the panel knows about one Telegram account. Each source is optional: an account can be
 * on the ban list without ever having written, or linked to the site without the guard having met it.
 */
export async function memberCard(tgId: number, opts: { withEmail: boolean }): Promise<MemberCard | null> {
  if (!Number.isSafeInteger(tgId) || tgId <= 0) return null
  await ensureHubTables()
  const [hub, trust, warnRows, banRows, msgRows, joinRows, linkRows, logRows] = await Promise.all([
    getHub(),
    trustOf(tgId),
    rows<{ count: number }>(sql`SELECT count FROM tg_warns WHERE tg_id = ${tgId}`),
    rows<{ who: string | null; reason: string | null; created_at: string }>(sql`SELECT who, reason, created_at FROM tg_global_bans WHERE tg_id = ${tgId}`),
    rows<{ chat_id: string; n: number; last: string; name: string | null }>(sql`SELECT chat_id, count(*)::int AS n, max(created_at) AS last,
      (array_agg(name ORDER BY created_at DESC))[1] AS name FROM tg_guard_msgs WHERE tg_id = ${tgId} GROUP BY chat_id ORDER BY n DESC`),
    // These two tables belong to features that may never have been switched on.
    rows<{ chat_id: string; name: string; username: string | null; via: string | null; removed: boolean; joined_at: string }>(
      sql`SELECT chat_id, name, username, via, removed, joined_at FROM tg_join_log WHERE tg_id = ${tgId} ORDER BY joined_at DESC LIMIT 5`,
    ).catch(() => []),
    rows<{ user_id: string; tg_username: string | null; tg_name: string; linked_at: string; name: string | null; email: string | null }>(
      sql`SELECT l.user_id, l.tg_username, l.tg_name, l.linked_at, u.name, u.email FROM tg_links l LEFT JOIN public."user" u ON u.id = l.user_id WHERE l.tg_id = ${tgId}`,
    ).catch(() => []),
    rows(sql`SELECT ${LOG_COLUMNS} FROM tg_mod_log WHERE tg_id = ${tgId} ORDER BY id DESC LIMIT 20`),
  ])

  const titleOf = (chatId: string) => hub.groups.find((g) => g.chatId === chatId)?.title ?? chatId
  const log = logRows.map(mapLogRow)
  const link = linkRows[0]
  const ban = banRows[0]
  const lastMsgName = [...msgRows].sort((a, b) => +new Date(b.last) - +new Date(a.last))[0]?.name ?? null

  // The log keeps the fullest form of the name; the other sources only fill gaps.
  const fromLog = log.find((l) => l.who) ? splitWho(log.find((l) => l.who)!.who) : null
  const fromBan = ban?.who ? splitWho(ban.who) : null
  const handle = (s: string | null | undefined) => (s && s.startsWith('@') ? s.slice(1) : null)
  const username = fromLog?.username ?? link?.tg_username ?? joinRows[0]?.username ?? handle(lastMsgName) ?? fromBan?.username ?? null
  const plain = (s: string | null | undefined) => (s && !s.startsWith('@') ? s : null)
  const name = fromLog?.name || link?.tg_name || joinRows[0]?.name || plain(lastMsgName) || fromBan?.name || (username ? `@${username}` : `ID ${tgId}`)

  const total = msgRows.reduce((sum, r) => sum + Number(r.n), 0)
  return {
    tgId,
    name,
    username,
    known: trust.known || Boolean(ban || link || total || joinRows.length || log.length),
    trust: { score: trust.score, trusted: trust.trusted, firstSeen: trust.firstSeen ? new Date(trust.firstSeen).toISOString() : null, needsCheck: trust.needsCheck },
    warns: Number(warnRows[0]?.count ?? 0),
    ban: ban ? { reason: String(ban.reason ?? ''), at: iso(ban.created_at) } : null,
    messages: {
      total,
      lastAt: msgRows.length ? iso(msgRows.map((r) => r.last).sort((a, b) => +new Date(b) - +new Date(a))[0]) : null,
      chats: msgRows.map((r) => ({ title: titleOf(r.chat_id), count: Number(r.n) })),
    },
    joins: joinRows.map((j) => ({ title: titleOf(j.chat_id), at: iso(j.joined_at), via: j.via, removed: Boolean(j.removed) })),
    site: link
      ? { userId: link.user_id, name: link.name || link.tg_name, email: opts.withEmail ? link.email : null, linkedAt: iso(link.linked_at) }
      : null,
    log,
  }
}

/** Resolves what a moderator typed (id, @username or display name) to Telegram ids, newest writers first. */
/** Removes the site connection of a Telegram account; returns the member's name, or null when there was none. */
export async function unlinkByTelegram(tgId: number) {
  const gone = await rows<{ user_id: string }>(sql`DELETE FROM tg_links WHERE tg_id = ${tgId} RETURNING user_id`)
  if (!gone[0]) return null
  const [u] = await rows<{ name: string | null }>(sql`SELECT name FROM public."user" WHERE id = ${gone[0].user_id}`)
  return u?.name ?? 'Üye'
}

export async function findMemberIds(query: string): Promise<number[]> {
  const raw = query.trim().slice(0, 80)
  if (!raw) return []
  if (/^\d{4,15}$/.test(raw)) return [Number(raw)]
  await ensureHubTables()
  const plain = raw.replace(/^@/, '')
  const found = await rows<{ tg_id: string }>(sql`SELECT tg_id FROM (
      SELECT tg_id, max(created_at) AS at FROM tg_guard_msgs WHERE lower(name) = lower(${plain}) OR lower(name) = lower(${`@${plain}`}) GROUP BY tg_id
      UNION ALL SELECT tg_id, linked_at FROM tg_links WHERE lower(tg_username) = lower(${plain})
    ) x GROUP BY tg_id ORDER BY max(at) DESC LIMIT 5`).catch(() => [])
  return found.map((x) => Number(x.tg_id))
}
