import 'server-only'
import { rows, sql } from '@/lib/db'
import { credit, debit, getBalance } from '@/lib/member'
import { levelMap } from '@/lib/kanka-puan'
import { isFlagged } from '@/lib/growth'
import {
  COVERS,
  DEFAULT_AVATARS,
  FIRST_AVATAR_REWARD,
  TEAMS,
  type AvatarCard,
  type AvatarDef,
  type AvatarGroup,
  type AvatarUnlock,
  type LookState,
} from '@/lib/avatars-shared'

export * from '@/lib/avatars-shared'

let ready: Promise<void> | null = null

export function ensureAvatars() {
  ready ??= (async () => {
    await rows(sql`CREATE TABLE IF NOT EXISTS avatar_catalog (
      id text PRIMARY KEY, name text NOT NULL, src text NOT NULL, grp text NOT NULL DEFAULT 'jako',
      unlock text NOT NULL DEFAULT 'free', level int NOT NULL DEFAULT 1, price int NOT NULL DEFAULT 0,
      active boolean NOT NULL DEFAULT true, sort int NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now())`)
    await rows(sql`CREATE TABLE IF NOT EXISTS avatar_owned (
      user_id text NOT NULL, avatar_id text NOT NULL, price int NOT NULL DEFAULT 0, acquired_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, avatar_id))`)
    await rows(sql`CREATE TABLE IF NOT EXISTS member_look (
      user_id text PRIMARY KEY, avatar_id text, cover_id text, team text,
      reward_claimed boolean NOT NULL DEFAULT false, reward_paid boolean NOT NULL DEFAULT false,
      updated_at timestamptz NOT NULL DEFAULT now())`)
    for (const d of DEFAULT_AVATARS) {
      await rows(sql`INSERT INTO avatar_catalog (id, name, src, grp, unlock, level, price, active, sort)
        VALUES (${d.id}, ${d.name}, ${d.src}, ${d.group}, ${d.unlock}, ${d.level}, ${d.price}, true, ${d.sort})
        ON CONFLICT (id) DO NOTHING`)
    }
  })().catch((e) => {
    ready = null
    throw e
  })
  return ready
}

type CatalogRow = { id: string; name: string; src: string; grp: string; unlock: string; level: number; price: number; active: boolean; sort: number }

const toDef = (r: CatalogRow): AvatarDef => ({
  id: r.id,
  name: r.name,
  src: r.src,
  group: (r.grp === 'takim' ? 'takim' : 'jako') as AvatarGroup,
  unlock: (['free', 'level', 'coin'].includes(r.unlock) ? r.unlock : 'free') as AvatarUnlock,
  level: Number(r.level),
  price: Number(r.price),
  active: r.active,
  sort: Number(r.sort),
})

export async function listCatalog(opts: { includeInactive?: boolean } = {}): Promise<AvatarDef[]> {
  await ensureAvatars()
  const list = opts.includeInactive
    ? await rows<CatalogRow>(sql`SELECT * FROM avatar_catalog ORDER BY sort, created_at`)
    : await rows<CatalogRow>(sql`SELECT * FROM avatar_catalog WHERE active ORDER BY sort, created_at`)
  return list.map(toDef)
}

async function getAvatar(id: string) {
  await ensureAvatars()
  const [r] = await rows<CatalogRow>(sql`SELECT * FROM avatar_catalog WHERE id = ${id}`)
  return r ? toDef(r) : null
}

async function memberLevel(userId: string) {
  const map = await levelMap().catch(() => ({}) as Record<string, number>)
  return map[userId] ?? 1
}

type LookRow = { avatar_id: string | null; cover_id: string | null; team: string | null; reward_claimed: boolean }

async function readLook(userId: string): Promise<LookRow> {
  const [r] = await rows<LookRow>(sql`SELECT avatar_id, cover_id, team, reward_claimed FROM member_look WHERE user_id = ${userId}`)
  return r ?? { avatar_id: null, cover_id: null, team: null, reward_claimed: false }
}

function canUse(av: AvatarDef, level: number, owned: Set<string>) {
  if (owned.has(av.id)) return true
  if (av.unlock === 'free') return true
  if (av.unlock === 'level') return level >= av.level
  return false
}

export async function getLookState(userId: string): Promise<LookState> {
  await ensureAvatars()
  const [catalog, look, ownedRows, level, balance] = await Promise.all([
    listCatalog(),
    readLook(userId),
    rows<{ avatar_id: string }>(sql`SELECT avatar_id FROM avatar_owned WHERE user_id = ${userId}`),
    memberLevel(userId),
    getBalance(userId),
  ])
  const owned = new Set(ownedRows.map((r) => r.avatar_id))
  const avatars: AvatarCard[] = catalog.map((av) => ({
    ...av,
    status: look.avatar_id === av.id
      ? 'selected'
      : owned.has(av.id)
        ? 'owned'
        : canUse(av, level, owned)
          ? 'unlocked'
          : av.unlock === 'coin'
            ? 'buy'
            : 'locked',
  }))
  return {
    avatars,
    covers: COVERS.map((c) => ({ ...c, unlocked: level >= c.level })),
    avatarId: look.avatar_id,
    coverId: look.cover_id ?? COVERS[0].id,
    team: look.team,
    level,
    balance,
    rewardPending: !look.reward_claimed,
    reward: FIRST_AVATAR_REWARD,
  }
}

/** Avatar URL the member may download, or null when they don't own/unlock it. */
export async function downloadableAvatar(userId: string, avatarId: string) {
  const av = await getAvatar(avatarId)
  if (!av) return null
  const [ownedRows, level] = await Promise.all([
    rows(sql`SELECT 1 FROM avatar_owned WHERE user_id = ${userId} AND avatar_id = ${avatarId}`),
    memberLevel(userId),
  ])
  const owned = new Set(ownedRows.length ? [avatarId] : [])
  return av.active && canUse(av, level, owned) ? av : null
}

let mapCache: { at: number; data: Record<string, string> } | null = null

function dropMapCache() {
  mapCache = null
}

/** userId → avatar image for every member who picked one. */
export async function avatarMap(): Promise<Record<string, string>> {
  if (mapCache && Date.now() - mapCache.at < 30_000) return mapCache.data
  await ensureAvatars()
  const list = await rows<{ user_id: string; src: string }>(sql`
    SELECT l.user_id, c.src FROM member_look l JOIN avatar_catalog c ON c.id = l.avatar_id WHERE c.active`)
  const data = Object.fromEntries(list.map((r) => [r.user_id, r.src]))
  mapCache = { at: Date.now(), data }
  return data
}

export async function avatarOf(userId: string) {
  const map = await avatarMap()
  return map[userId] ?? null
}

/** Pays the one-time first-avatar reward unless the account looks like a multi. */
async function claimFirstReward(userId: string): Promise<number> {
  const claimed = await rows(sql`UPDATE member_look SET reward_claimed = true
    WHERE user_id = ${userId} AND NOT reward_claimed RETURNING user_id`)
  if (!claimed.length) return 0
  if (await isFlagged(userId).catch(() => true)) return 0
  const sibling = await rows(sql`
    SELECT 1 FROM member_origin me
    JOIN member_origin other ON other.ip_hash = me.ip_hash AND other.user_id <> me.user_id
    JOIN member_look l ON l.user_id = other.user_id AND l.reward_paid
    WHERE me.user_id = ${userId} AND me.ip_hash IS NOT NULL LIMIT 1`).catch(() => [{}])
  if (sibling.length) return 0
  await rows(sql`UPDATE member_look SET reward_paid = true WHERE user_id = ${userId}`)
  await credit(userId, FIRST_AVATAR_REWARD)
  return FIRST_AVATAR_REWARD
}

export async function chooseAvatar(userId: string, avatarId: string): Promise<{ reward: number }> {
  const av = await getAvatar(avatarId)
  if (!av || !av.active) throw new Error('Bu avatar artık mevcut değil.')
  const [ownedRows, level] = await Promise.all([
    rows(sql`SELECT 1 FROM avatar_owned WHERE user_id = ${userId} AND avatar_id = ${avatarId}`),
    memberLevel(userId),
  ])
  if (!canUse(av, level, new Set(ownedRows.length ? [avatarId] : []))) {
    throw new Error(av.unlock === 'coin' ? 'Önce bu avatarı satın almalısın.' : `Bu avatar Seviye ${av.level} olunca açılır.`)
  }
  await rows(sql`INSERT INTO member_look (user_id, avatar_id) VALUES (${userId}, ${avatarId})
    ON CONFLICT (user_id) DO UPDATE SET avatar_id = EXCLUDED.avatar_id, updated_at = now()`)
  dropMapCache()
  return { reward: await claimFirstReward(userId) }
}

export async function buyAvatar(userId: string, avatarId: string) {
  const av = await getAvatar(avatarId)
  if (!av || !av.active) throw new Error('Bu avatar artık mevcut değil.')
  if (av.unlock !== 'coin' || av.price <= 0) throw new Error('Bu avatar satın alınamaz.')
  const owned = await rows(sql`SELECT 1 FROM avatar_owned WHERE user_id = ${userId} AND avatar_id = ${avatarId}`)
  if (owned.length) throw new Error('Bu avatar zaten senin.')
  if (!(await debit(userId, av.price))) throw new Error('Yeterli KC bakiyen yok.')
  const inserted = await rows(sql`INSERT INTO avatar_owned (user_id, avatar_id, price) VALUES (${userId}, ${avatarId}, ${av.price})
    ON CONFLICT DO NOTHING RETURNING avatar_id`)
  if (!inserted.length) {
    await credit(userId, av.price)
    throw new Error('Bu avatar zaten senin.')
  }
  return chooseAvatar(userId, avatarId)
}

export async function setCover(userId: string, coverId: string) {
  const cover = COVERS.find((c) => c.id === coverId)
  if (!cover) throw new Error('Kapak bulunamadı.')
  if ((await memberLevel(userId)) < cover.level) throw new Error(`Bu kapak Seviye ${cover.level} olunca açılır.`)
  await ensureAvatars()
  await rows(sql`INSERT INTO member_look (user_id, cover_id) VALUES (${userId}, ${coverId})
    ON CONFLICT (user_id) DO UPDATE SET cover_id = EXCLUDED.cover_id, updated_at = now()`)
}

export async function setTeam(userId: string, teamId: string | null) {
  if (teamId && !TEAMS.some((t) => t.id === teamId)) throw new Error('Takım bulunamadı.')
  await ensureAvatars()
  await rows(sql`INSERT INTO member_look (user_id, team) VALUES (${userId}, ${teamId})
    ON CONFLICT (user_id) DO UPDATE SET team = EXCLUDED.team, updated_at = now()`)
}

export type AvatarInput = { id?: string | null; name: string; src: string; group: AvatarGroup; unlock: AvatarUnlock; level: number; price: number; active: boolean; sort: number }

export async function saveAvatar(input: AvatarInput) {
  await ensureAvatars()
  const name = input.name.trim().slice(0, 40)
  const src = input.src.trim()
  if (!name) throw new Error('Avatar adı gerekli.')
  if (!src || !(src.startsWith('/') || src.startsWith('https://'))) throw new Error('Geçerli bir görsel seç.')
  const unlock: AvatarUnlock = ['free', 'level', 'coin'].includes(input.unlock) ? input.unlock : 'free'
  const level = unlock === 'level' ? Math.max(1, Math.min(100, Math.round(input.level) || 1)) : 1
  const price = unlock === 'coin' ? Math.max(1, Math.min(1_000_000, Math.round(input.price) || 1)) : 0
  const group: AvatarGroup = input.group === 'takim' ? 'takim' : 'jako'
  const sort = Math.round(input.sort) || 0
  const id = input.id?.trim() || `ozel-${Date.now().toString(36)}`
  await rows(sql`INSERT INTO avatar_catalog (id, name, src, grp, unlock, level, price, active, sort)
    VALUES (${id}, ${name}, ${src}, ${group}, ${unlock}, ${level}, ${price}, ${input.active}, ${sort})
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, src = EXCLUDED.src, grp = EXCLUDED.grp, unlock = EXCLUDED.unlock,
      level = EXCLUDED.level, price = EXCLUDED.price, active = EXCLUDED.active, sort = EXCLUDED.sort`)
  dropMapCache()
}

/** Removes an avatar; members still using it fall back to their initial until they pick another. */
export async function deleteAvatar(id: string) {
  await ensureAvatars()
  const owners = await rows(sql`SELECT 1 FROM avatar_owned WHERE avatar_id = ${id} LIMIT 1`)
  if (owners.length) {
    await rows(sql`UPDATE avatar_catalog SET active = false WHERE id = ${id}`)
  } else {
    await rows(sql`DELETE FROM avatar_catalog WHERE id = ${id}`)
    await rows(sql`UPDATE member_look SET avatar_id = NULL WHERE avatar_id = ${id}`)
  }
  dropMapCache()
  return owners.length ? 'Satın alan üyeler olduğu için avatar gizlendi.' : 'Avatar silindi.'
}

export type AvatarStats = Record<string, { users: number; sold: number }>

export async function avatarStats(): Promise<AvatarStats> {
  await ensureAvatars()
  const [users, sold] = await Promise.all([
    rows<{ id: string; n: string }>(sql`SELECT avatar_id AS id, count(*) AS n FROM member_look WHERE avatar_id IS NOT NULL GROUP BY avatar_id`),
    rows<{ id: string; n: string }>(sql`SELECT avatar_id AS id, count(*) AS n FROM avatar_owned GROUP BY avatar_id`),
  ])
  const out: AvatarStats = {}
  for (const r of users) out[r.id] = { users: Number(r.n), sold: 0 }
  for (const r of sold) out[r.id] = { users: out[r.id]?.users ?? 0, sold: Number(r.n) }
  return out
}
